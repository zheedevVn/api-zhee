/**
 * ZheeDevTool — (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Phan mem doc quyen — Cam sao chep / phan phoi lai khi chua duoc cap phep.
 * Xem giay phep day du tai file LICENSE.
 */
const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ITEMS = 100;
const TIMEOUT_MS = 9000;
const cache = new Map();
let accessToken = null;
let accessTokenExpiresAt = 0;

function inputFromRequest(req) {
  const requestUrl = new URL(req.url || "", "https://api-zhee.local");
  const query = req.query || {};
  let value = query.url || query.username || query.user || query.login || query.id || query[""] || "";
  if (!value) {
    for (const [key, item] of requestUrl.searchParams.entries()) {
      value = item || key;
      if (value) break;
    }
  }
  return String(value || "").trim();
}

function parseTarget(input) {
  const value = input.trim().replace(/^@+/, "");
  const urlMatch = value.match(/^https?:\/\/(?:www\.)?twitch\.tv\/(?:directory\/category\/)?([^/?#]+)/i);
  const login = (urlMatch ? urlMatch[1] : value).replace(/^user\//i, "").trim();
  if (/^\d+$/.test(login)) return { id: login };
  if (!/^[A-Za-z0-9_]{1,25}$/.test(login)) return null;
  return { login: login.toLowerCase() };
}

function cached(key) {
  const item = cache.get(key);
  if (!item || item.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return { ...item.value, cache_hit: true };
}

function saveCache(key, value) {
  if (cache.size >= CACHE_MAX_ITEMS) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...value, cache_hit: false };
}

function isoDate(value) {
  return value ? new Date(value).toISOString() : null;
}

async function getAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const error = new Error("Thiếu TWITCH_CLIENT_ID hoặc TWITCH_CLIENT_SECRET.");
    error.code = "TWITCH_CONFIG_MISSING";
    throw error;
  }
  if (accessToken && accessTokenExpiresAt > Date.now()) return accessToken;

  const tokenUrl = new URL("https://id.twitch.tv/oauth2/token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("grant_type", "client_credentials");
  const response = await fetch(tokenUrl, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    const error = new Error(`Twitch OAuth trả HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  accessToken = payload.access_token;
  accessTokenExpiresAt = Date.now() + Math.max(30, Number(payload.expires_in || 3600) - 60) * 1000;
  return accessToken;
}

async function twitchApi(path, params = {}) {
  const token = await getAccessToken();
  const url = new URL(`https://api.twitch.tv/helix${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    const error = new Error(`Twitch API trả HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function mapVideo(item) {
  return {
    id: item.id,
    tieu_de: item.title,
    loai: item.type,
    game_id: item.game_id || null,
    ngon_ngu: item.language,
    luot_xem: item.view_count,
    thoi_luong: item.duration,
    ngay_tao: isoDate(item.created_at),
    ngay_cong_bo: isoDate(item.published_at),
    anh_thumbnail: item.thumbnail_url,
    link: item.url
  };
}

function mapClip(item) {
  return {
    id: item.id,
    tieu_de: item.title,
    nguoi_tao: item.creator_name,
    nguoi_tao_id: item.creator_id,
    luot_xem: item.view_count,
    thoi_luong_giay: item.duration,
    ngay_tao: isoDate(item.created_at),
    anh_thumbnail: item.thumbnail_url,
    link: item.url,
    embed_url: item.embed_url
  };
}

async function lookup(target) {
  const cacheKey = target.id ? `id:${target.id}` : `login:${target.login}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const users = await twitchApi("/users", target);
  const user = users?.data?.[0];
  if (!user) {
    const error = new Error(`Không tìm thấy tài khoản Twitch: ${target.login || target.id}`);
    error.status = 404;
    throw error;
  }

  const [channelResult, streamResult, videosResult, clipsResult] = await Promise.allSettled([
    twitchApi("/channels", { broadcaster_id: user.id }),
    twitchApi("/streams", { user_id: user.id }),
    twitchApi("/videos", { user_id: user.id, first: 10, type: "archive" }),
    twitchApi("/clips", { broadcaster_id: user.id, first: 10 })
  ]);
  const channel = channelResult.status === "fulfilled" ? channelResult.value?.data?.[0] : null;
  const stream = streamResult.status === "fulfilled" ? streamResult.value?.data?.[0] : null;
  const videos = videosResult.status === "fulfilled" ? videosResult.value?.data || [] : [];
  const clips = clipsResult.status === "fulfilled" ? clipsResult.value?.data || [] : [];

  const data = {
    trang_thai: "thanh_cong",
    loai: "twitch_channel_lookup",
    thong_tin_kenh: {
      id: user.id,
      username: user.login,
      ten_hien_thi: user.display_name,
      tieu_su: user.description || "",
      anh_dai_dien: user.profile_image_url,
      anh_banner: user.offline_image_url || null,
      ngay_tao: isoDate(user.created_at),
      link_trang_ca_nhan: `https://www.twitch.tv/${user.login}`,
      email_da_xac_minh: Boolean(user.email_verified),
      loai_tai_khoan: user.broadcaster_type || "normal"
    },
    thong_tin_kenh_phat: channel ? {
      tieu_de: channel.title,
      danh_muc: channel.game_name || null,
      game_id: channel.game_id || null,
      ngon_ngu: channel.language,
      do_tre: channel.delay,
      noi_dung_thuong_hieu: Boolean(channel.is_branded_content),
      ngay_cap_nhat: isoDate(channel.updated_at)
    } : null,
    trang_thai_live: stream ? {
      dang_phat: true,
      tieu_de: stream.title,
      danh_muc: stream.game_name || null,
      game_id: stream.game_id || null,
      nguoi_xem: stream.viewer_count,
      luot_like: null,
      ngon_ngu: stream.language,
      ngay_bat_dau: isoDate(stream.started_at),
      thumbnail: stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720")
    } : { dang_phat: false },
    video_luu_tru_gan_day: videos.map(mapVideo),
    clip_gan_day: clips.map(mapClip),
    nguon: "Twitch Helix API",
    cache_hit: false
  };
  return saveCache(cacheKey, data);
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const input = inputFromRequest(req);
  const target = parseTarget(input);
  if (!input || !target) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập username Twitch, ID kênh hoặc link twitch.tv.",
      cu_phap: "/api/mxh/twitch?=username_hoac_link_twitch",
      tac_gia: AUTHOR
    });
  }

  try {
    const result = await lookup(target);
    return res.status(200).json({ ...result, tac_gia: AUTHOR });
  } catch (error) {
    const status = error.code === "TWITCH_CONFIG_MISSING" ? 503 : error.status === 404 ? 404 : 502;
    return res.status(status).json({
      trang_thai: "that_bai",
      thong_bao: error.code === "TWITCH_CONFIG_MISSING"
        ? "Twitch tool chưa được cấu hình API. Hãy thêm TWITCH_CLIENT_ID và TWITCH_CLIENT_SECRET trên Vercel."
        : error.status === 404 ? error.message : "Không thể lấy dữ liệu Twitch lúc này.",
      upstream_status: error.status || null,
      tac_gia: AUTHOR
    });
  }
};
