/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const WAIFU_BASE_URL = "https://api.waifu.im";
const CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;
const ALLOWED_FILTERS = [
  "IncludedTags",
  "ExcludedTags",
  "IsNsfw",
  "IncludedArtists",
  "Orientation",
  "Width",
  "Height",
  "FileSize",
  "IsAnimated"
];

function queryFromRequest(req) {
  if (req.query && typeof req.query === "object") return new URLSearchParams(req.query);
  return new URL(req.url || "/", "http://localhost").searchParams;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function buildUpstreamUrl(req, resource) {
  const input = queryFromRequest(req);
  const output = new URL(`${WAIFU_BASE_URL}/${resource}`);
  if (resource === "images") {
    output.searchParams.set("PageSize", String(clampInteger(input.get("PageSize"), 1, 1, 20)));
    output.searchParams.set("Page", String(clampInteger(input.get("Page"), 1, 1, 100000)));
  }
  ALLOWED_FILTERS.forEach((key) => {
    const value = input.get(key);
    if (value !== null && value !== "") output.searchParams.set(key, value);
  });
  return output;
}

async function fetchWaifu(url) {
  const cacheKey = url.toString();
  const cached = CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.payload, cache_hit: true };

  const headers = { Accept: "application/json", "User-Agent": "Zhee-Anime-API/1.0" };
  if (process.env.WAIFU_API_KEY) headers["X-Api-Key"] = process.env.WAIFU_API_KEY;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { raw: text }; }
  if (!response.ok) {
    const error = new Error(payload?.detail || payload?.message || `Waifu.im HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const result = { ...payload, cache_hit: false };
  CACHE.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload: result });
  return result;
}

module.exports = async function animeHandler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const requestUrl = new URL(req.url || "/api/anime", "http://localhost");
    const pathname = requestUrl.pathname.toLowerCase();
    const action = String(requestUrl.searchParams.get("action") || "").toLowerCase();
    const resource = pathname.endsWith("/tags") || action === "tags" ? "tags" : "images";
    const upstream = buildUpstreamUrl(req, resource);
    const data = await fetchWaifu(upstream);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      type: resource === "images" ? "anime_images" : "anime_tags",
      nguon: "Waifu.im",
      duong_dan: `/api/anime/${resource}`,
      du_lieu: data,
      tac_gia: AUTHOR
    });
  } catch (error) {
    return res.status(error.status && error.status < 500 ? error.status : 502).json({
      trang_thai: "that_bai",
      thong_bao: error.message,
      nguon: "Waifu.im",
      tac_gia: AUTHOR
    });
  }
};

module.exports.buildUpstreamUrl = buildUpstreamUrl;
