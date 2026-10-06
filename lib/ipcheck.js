/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
const net = require("net");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const IPSTACK_BASE_URL = "https://api.ipstack.com";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ITEMS = 200;
const TIMEOUT_MS = 9000;
const cache = new Map();

function getParams(req) {
  return new URL(req.url || "", "https://api-zhee.local").searchParams;
}

function getIp(params) {
  return String(
    params.get("ip") || params.get("address") || params.get("query") || params.get("") || ""
  ).trim();
}

function getCached(ip) {
  const item = cache.get(ip);
  if (!item || item.expiresAt <= Date.now()) {
    if (item) cache.delete(ip);
    return null;
  }
  return { ...item.value, cache_hit: true };
}

function saveCached(ip, value) {
  if (cache.size >= CACHE_MAX_ITEMS) cache.delete(cache.keys().next().value);
  cache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...value, cache_hit: false };
}

function normalizedIp(value) {
  const ip = String(value || "").trim();
  if (!ip || net.isIP(ip) === 0) return null;
  return ip;
}

async function lookup(ip) {
  const apiKey = String(process.env.IPSTACK_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("IP lookup chưa được cấu hình. Hãy thêm biến môi trường IPSTACK_API_KEY.");
    error.status = 503;
    error.code = "IPSTACK_CONFIG_MISSING";
    throw error;
  }

  const hit = getCached(ip);
  if (hit) return hit;

  const url = new URL(`${IPSTACK_BASE_URL}/${encodeURIComponent(ip)}`);
  url.searchParams.set("access_key", apiKey);

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Zhee-API/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = {}; }

  if (!response.ok || payload.success === false || payload.error) {
    const upstreamStatus = payload.error?.code || response.status;
    const message = payload.error?.info || payload.error?.message || `IPStack trả HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status === 429 ? 429 : response.status >= 400 ? response.status : 502;
    error.upstreamStatus = upstreamStatus;
    throw error;
  }

  return saveCached(ip, payload);
}

module.exports = async function ipCheckHandler(req, res) {
  const params = getParams(req);
  const rawIp = getIp(params);
  const ip = normalizedIp(rawIp);

  if (!ip) {
    return res.status(400).json({
      trang_thai: "that_bai",
      loai: "ip_lookup",
      thong_bao: "Vui lòng nhập một địa chỉ IPv4 hoặc IPv6 hợp lệ qua ?ip=113.175.232.110.",
      tac_gia: AUTHOR
    });
  }

  try {
    const data = await lookup(ip);
    const updatedAt = new Date();
    const response = {
      trang_thai: "thanh_cong",
      loai: "ipstack_ip_lookup",
      nguon: "ipstack.com",
      cache_hit: data.cache_hit === true,
      cap_nhat: {
        thoi_gian_utc: updatedAt.toISOString(),
        ngay_utc: updatedAt.toISOString().slice(0, 10)
      },
      ...data
    };
    delete response.cache_hit;
    response.cache_hit = data.cache_hit === true;
    response.tac_gia = AUTHOR;
    return res.status(200).json(response);
  } catch (error) {
    return res.status(Number.isInteger(error.status) ? error.status : 502).json({
      trang_thai: "that_bai",
      loai: "ipstack_ip_lookup",
      ip,
      thong_bao: error.message || "Không thể kết nối IPStack.",
      upstream_status: error.upstreamStatus || null,
      tac_gia: AUTHOR
    });
  }
};

module.exports._internals = { normalizedIp, getIp };
