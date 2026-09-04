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

function dateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function latestNeoItems(data) {
  return Object.values(data?.near_earth_objects || {})
    .flat()
    .sort((a, b) => {
      const aTime = a.close_approach_data?.[0]?.epoch_date_close_approach || 0;
      const bTime = b.close_approach_data?.[0]?.epoch_date_close_approach || 0;
      return bTime - aTime;
    })
    .slice(0, 20)
    .map((item) => {
      const approach = item.close_approach_data?.[0] || {};
      return {
        id: item.id,
        ten: item.name,
        nguy_co: item.is_potentially_hazardous_asteroid === true,
        kich_thuoc_met: item.estimated_diameter?.meters || null,
        tiep_can: {
          thoi_gian_utc: approach.close_approach_date_full || null,
          ngay_utc: approach.close_approach_date || null,
          khoang_cach_km: approach.miss_distance?.kilometers || null,
          toc_do_km_s: approach.relative_velocity?.kilometers_per_second || null
        },
        link_nasa: item.nasa_jpl_url || null
      };
    });
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
    query.set("start_date", getInput(params, "start_date", dateDaysAgo(6)));
    query.set("end_date", getInput(params, "end_date", today));
    return `/neo/rest/v1/feed?${query}`;
  }

  if (action === "mars") {
    const error = new Error("NASA Mars Rover Photos API đã được NASA lưu trữ và endpoint hiện trả HTTP 404. API key không thể khắc phục tình trạng này.");
    error.status = 410;
    error.upstreamStatus = 404;
    throw error;
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
    const latestList = action === "neo"
      ? latestNeoItems(data)
      : Array.isArray(data)
        ? data.slice(0, 20)
        : data && typeof data === "object"
          ? [data]
          : [];
    const updatedAt = new Date();
    const response = {
      trang_thai: "thanh_cong",
      loai: `nasa_${action}`,
      action,
      nguon: NASA_BASE_URL,
      du_lieu: data,
      cache_hit: data.cache_hit === true,
      cap_nhat: {
        thoi_gian_utc: updatedAt.toISOString(),
        ngay_utc: updatedAt.toISOString().slice(0, 10),
        danh_sach_moi_nhat: action === "neo" ? latestNeoItems(data) : null
      },
      tac_gia: AUTHOR
    };
    return res.status(200).json(response);
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
