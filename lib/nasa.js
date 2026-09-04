const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const NASA_BASE_URL = "https://api.nasa.gov";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ITEMS = 100;
const TIMEOUT_MS = 10000;
const cache = new Map();

function getSearchParams(req) {
  return new URL(req.url || "", "https://api-zhee.local").searchParams;
}

function getInput(params, name, fallback = "") {
  return String(params.get(name) || fallback).trim();
}

function cacheGet(key) {
  const item = cache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    if (item) cache.delete(key);
    return null;
  }
  return { ...item.value, cache_hit: true };
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_ITEMS) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...value, cache_hit: false };
}

function numberParam(params, name, defaultValue, min, max) {
  const value = Number(params.get(name));
  if (!Number.isFinite(value)) return defaultValue;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function actionName(params) {
  const action = getInput(params, "action", getInput(params, "type", "apod")).toLowerCase();
  return action === "neo" || action === "neows" ? "neo" : action === "mars" || action === "rover" ? "mars" : action === "epic" ? "epic" : action === "donki" ? "donki" : "apod";
}

function buildRequest(action, params, apiKey) {
  const query = new URLSearchParams({ api_key: apiKey });

  if (action === "apod") {
    const count = params.get("count");
    if (count) query.set("count", String(numberParam(params, "count", 1, 1, 10)));
    if (params.get("date")) query.set("date", getInput(params, "date"));
    if (params.get("start_date")) query.set("start_date", getInput(params, "start_date"));
    if (params.get("end_date")) query.set("end_date", getInput(params, "end_date"));
    query.set("thumbs", getInput(params, "thumbs", "true"));
    return `/planetary/apod?${query}`;
  }

  if (action === "neo") {
    const today = new Date().toISOString().slice(0, 10);
    query.set("start_date", getInput(params, "start_date", today));
    query.set("end_date", getInput(params, "end_date", query.get("start_date")));
    return `/neo/rest/v1/feed?${query}`;
  }

  if (action === "mars") {
    const rover = getInput(params, "rover", "curiosity").toLowerCase();
    if (!/^(curiosity|opportunity|spirit|perseverance)$/.test(rover)) {
      const error = new Error("Rover không hợp lệ. Chọn curiosity, opportunity, spirit hoặc perseverance.");
      error.status = 400;
      throw error;
    }
    const sol = params.get("sol");
    const earthDate = params.get("earth_date");
    if (!sol && !earthDate) {
      return `/mars-photos/api/v1/rovers/${rover}/latest_photos?${query}`;
    }
    if (sol) query.set("sol", String(numberParam(params, "sol", 0, 0, 5000)));
    if (earthDate) query.set("earth_date", getInput(params, "earth_date"));
    if (params.get("camera")) query.set("camera", getInput(params, "camera"));
    query.set("page", String(numberParam(params, "page", 1, 1, 100)));
    return `/mars-photos/api/v1/rovers/${rover}/photos?${query}`;
  }

  if (action === "epic") return `/EPIC/api/natural?${query}`;

  query.set("feedtype", getInput(params, "feedtype", "json"));
  query.set("startDate", getInput(params, "startDate", getInput(params, "start_date", "")));
  query.set("endDate", getInput(params, "endDate", getInput(params, "end_date", "")));
  if (!query.get("startDate")) query.delete("startDate");
  if (!query.get("endDate")) query.delete("endDate");
  return `/DONKI/FLR?${query}`;
}

async function fetchNasa(path) {
  const apiKey = String(process.env.NASA_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("NASA API chưa được cấu hình. Hãy thêm biến môi trường NASA_API_KEY.");
    error.status = 503;
    error.code = "NASA_CONFIG_MISSING";
    throw error;
  }

  const cacheUrl = new URL(`${NASA_BASE_URL}${path}`);
  cacheUrl.searchParams.delete("api_key");
  const cacheKey = cacheUrl.toString();
  const hit = cacheGet(cacheKey);
  if (hit) return hit;

  const response = await fetch(`${NASA_BASE_URL}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "Zhee-API/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = { raw: text.slice(0, 500) }; }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.msg || `NASA API trả HTTP ${response.status}.`);
    error.status = response.status === 400
      ? 400
      : response.status === 401 || response.status === 403
        ? 502
        : response.status === 404
          ? 404
          : response.status === 429
            ? 429
            : 502;
    error.upstreamStatus = response.status;
    throw error;
  }
  return cacheSet(cacheKey, payload);
}

module.exports = async function nasaHandler(req, res) {
  const params = getSearchParams(req);
  const action = actionName(params);

  try {
    const path = buildRequest(action, params, String(process.env.NASA_API_KEY || "").trim());
    buildRequest.currentPath = path;
    const data = await fetchNasa(path);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: `nasa_${action}`,
      action,
      nguon: NASA_BASE_URL,
      du_lieu: data,
      cache_hit: data.cache_hit === true,
      tac_gia: AUTHOR
    });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    return res.status(status).json({
      trang_thai: "that_bai",
      loai: `nasa_${action}`,
      action,
      thong_bao: error.message || "Không thể kết nối NASA API.",
      upstream_status: error.upstreamStatus || null,
      tac_gia: AUTHOR
    });
  }
};

module.exports._internals = { actionName, buildRequest };
