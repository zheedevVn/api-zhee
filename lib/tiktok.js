require("./zheeProtect.js").verifyOrThrow();
const youtubeHandler = require("./youtube");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://www.tiktok.com/"
};

const CARD_HEADERS = {
  "User-Agent": "Twitterbot/1.0",
  Accept: "text/html",
  "Accept-Language": "en-US,en;q=0.9"
};

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function metaContent(html, key) {
  const byName = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const byContent = new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i");
  const match = String(html || "").match(byName) || String(html || "").match(byContent);
  return match ? decodeHtml(match[1]) : "";
}

function scriptById(html, id) {
  const match = String(html || "").match(new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i"));
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function parseCount(text, labels) {
  for (const label of labels) {
    const match = String(text || "").match(new RegExp(`([\\d.,]+)\\s*([KMB])?\\s+${label}`, "i"));
    if (!match) continue;
    let raw = match[1].replace(/,/g, "");
    if (!match[2] && /^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const unit = String(match[2] || "").toUpperCase();
    const multiplier = unit === "K" ? 1e3 : unit === "M" ? 1e6 : unit === "B" ? 1e9 : 1;
    return Math.round(value * multiplier);
  }
  return 0;
}

function profileFromHtml(html, cleanUser) {
  const expected = String(cleanUser || "").toLowerCase();
  const universal = scriptById(html, "__UNIVERSAL_DATA_FOR_REHYDRATION__");
  const detail = universal?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"];
  if (detail?.userInfo?.user?.uniqueId) {
    return {
      userInfo: detail.userInfo.user,
      userStats: detail.userInfo.stats || {},
      secUid: detail.userInfo.user.secUid || ""
    };
  }

  const sigi = scriptById(html, "SIGI_STATE");
  const users = sigi?.UserModule?.users || {};
  const sigiUser = users[cleanUser] || Object.values(users).find((user) => String(user?.uniqueId || "").toLowerCase() === expected);
  if (sigiUser?.uniqueId) {
    const stats = sigi?.UserModule?.stats || {};
    return {
      userInfo: sigiUser,
      userStats: stats[sigiUser.uniqueId] || stats[cleanUser] || {},
      secUid: sigiUser.secUid || ""
    };
  }

  const description = metaContent(html, "og:description") || metaContent(html, "description") || metaContent(html, "twitter:description");
  const pageUrl = metaContent(html, "og:url") || metaContent(html, "twitter:url");
  const title = decodeHtml(metaContent(html, "og:title") || metaContent(html, "twitter:title") || (String(html).match(/<title>([^<]*)<\/title>/i) || [])[1] || "");
  const handle = (pageUrl.match(/@([^/?#]+)/) || description.match(/@([A-Za-z0-9._]+)/) || title.match(/\(@([A-Za-z0-9._]+)\)/) || [])[1] || "";
  const isTikTokPage = /tiktok/i.test(title) || /tiktok/i.test(metaContent(html, "og:site_name")) || /tiktok\.com\/@/i.test(pageUrl) || /tiktok\.com/i.test(description);
  const handleMatch = (!handle && new RegExp(`@${cleanUser}\\b`, "i").test(pageUrl || description || title)) || (handle && handle.toLowerCase() === expected);
  if (!isTikTokPage || !handleMatch) return null;

  const nickname = title
    .replace(/\s+(?:on|trên|auf|sur|em|en)\s+TikTok$/i, "")
    .replace(/\s*\(@[^)]+\)\s*\|\s*TikTok$/i, "")
    .replace(/\s*\|\s*TikTok$/i, "")
    .trim() || handle || cleanUser;

  const avatar = metaContent(html, "og:image")
    || metaContent(html, "twitter:image")
    || (String(html).match(/https:\/\/[^"'\s]*(?:-avt-|\/avt\/)[^"'\s]*/i) || [])[0]
    || "";

  const id = (String(html).match(/user\/profile\/(\d+)/) || String(html).match(/"userId":\s*"(\d+)"/) || [])[1] || "";

  return {
    userInfo: {
      id,
      uniqueId: handle || cleanUser,
      nickname,
      avatarLarger: avatar,
      signature: "",
      verified: false,
      privateAccount: false
    },
    userStats: {
      followerCount: parseCount(description, ["Follower", "Followers", "Người theo dõi", "Seguidores", "Abonnés", "Pengikut"]),
      followingCount: parseCount(description, ["Following", "Đang follow", "Đang theo dõi", "Siguiendo", "Seguindo"]),
      heartCount: parseCount(description, ["Likes", "Lượt thích", "Thích", "Me gusta", "Curtidas", "J'aime"]),
      videoCount: parseCount(description, ["Videos", "Video", "Vidéos"])
    },
    secUid: ""
  };
}

function plainCount(raw) {
  if (!raw) return 0;
  return parseCount(`${raw} count`, ["count"]);
}

function profileFromJina(text, cleanUser) {
  const expected = String(cleanUser || "").toLowerCase();
  const body = String(text || "");
  const title = (body.match(/^Title:\s*(.+)$/m) || [])[1] || "";
  const handle = (title.match(/\(@([A-Za-z0-9._]+)\)/) || body.match(/@([A-Za-z0-9._]+)/) || [])[1] || "";
  if (!handle || handle.toLowerCase() !== expected) {
    if (!new RegExp(`\\b${cleanUser}\\b`, "i").test(title)) return null;
  }
  const nickname = title
    .replace(/\s+(?:on|trên|auf|sur|em|en)\s+TikTok$/i, "")
    .replace(/\s*\(@[^)]+\)\s*\|\s*TikTok$/i, "")
    .replace(/\s*\|\s*TikTok$/i, "")
    .trim() || cleanUser;

  const followers = (body.match(/\*\*([0-9][0-9.,]*\s*[KMB]?)\*\*\s*Followers\b/i) || body.match(/([0-9][0-9.,]*\s*[KMB]?)\s*Followers\b/i) || [])[1];
  const following = (body.match(/\*\*([0-9][0-9.,]*\s*[KMB]?)\*\*\s*Following\b/i) || body.match(/([0-9][0-9.,]*\s*[KMB]?)\s*Following\b/i) || [])[1];
  const likes = (body.match(/\*\*([0-9][0-9.,]*\s*[KMB]?)\*\*\s*Likes\b/i) || body.match(/([0-9][0-9.,]*\s*[KMB]?)\s*Likes\b/i) || [])[1];

  let avatar = (body.match(new RegExp(`!\\[[^\\]]*Avatar for ${cleanUser.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\]]*\\]\\((https?:[^)]+)\\)`, "i")) || [])[1] || "";
  if (!avatar) {
    avatar = (body.match(/!\[[^\]]*Avatar[^\]]*\]\((https?:[^)]+)\)/i) || body.match(/!\[[^\]]*\]\((https?:[^)]*(?:-avt-|\/avt\/)[^)]+)\)/i) || [])[1] || "";
  }

  let signature = "";
  const bioMatch = body.match(/(?:\*\*Likes\*\*|\bLikes\b)[^\n]*\n+([\s\S]*?)\n+(?:Suggested accounts|Videos|Reposts)/i);
  if (bioMatch && bioMatch[1]) {
    signature = bioMatch[1].replace(/^[#\s*\->]+/, "").trim();
  }

  return {
    userInfo: {
      id: "",
      uniqueId: cleanUser,
      nickname,
      avatarLarger: avatar,
      signature,
      verified: false,
      privateAccount: false
    },
    userStats: {
      followerCount: plainCount(followers),
      followingCount: plainCount(following),
      heartCount: plainCount(likes),
      videoCount: 0
    },
    secUid: ""
  };
}

async function fetchJinaProfile(cleanUser) {
  const response = await fetch(`https://r.jina.ai/https://www.tiktok.com/@${encodeURIComponent(cleanUser)}`, {
    headers: { Accept: "text/plain", "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  return profileFromJina(await response.text(), cleanUser);
}

async function fetchOembedProfile(cleanUser) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@${cleanUser}`)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || !data.author_name) return null;
    return {
      userInfo: {
        id: "",
        uniqueId: cleanUser,
        nickname: data.author_name || cleanUser,
        avatarLarger: data.thumbnail_url || "",
        signature: "",
        verified: false,
        privateAccount: false
      },
      userStats: {
        followerCount: 0,
        followingCount: 0,
        heartCount: 0,
        videoCount: 0
      },
      secUid: ""
    };
  } catch {
    return null;
  }
}

async function fetchProfileHtml(url, headers) {
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(8000) });
  return response.text();
}

async function fetchTikwmMedia(url, headers = BROWSER_HEADERS) {
  const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers,
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.code !== 0 || !payload.data) return null;
  const images = Array.isArray(payload.data.images) ? payload.data.images.filter(Boolean) : [];
  const photo = images.length > 0 || /\/photo\//i.test(url);
  const play = payload.data.hdplay || payload.data.play || null;
  const playIsAudio = /\.(mp3|m4a|aac)(\?|$)/i.test(play || "") || /ies-music|audio_mpeg/i.test(play || "");
  return {
    video_khong_logo: photo || playIsAudio ? null : payload.data.play || null,
    video_hd: photo || playIsAudio ? null : play,
    nhac_mp3: payload.data.music || (playIsAudio ? play : null),
    tieu_de: payload.data.title || null,
    anh_bia: payload.data.cover || payload.data.origin_cover || null,
    anh: images,
    loai: photo ? "tiktok_photo" : "tiktok_video"
  };
}

async function downloadCobaltMedia(query) {
  const url = String(query || "").trim();
  if (!url) {
    const error = new Error("Vui lòng nhập URL media qua ?url=...");
    error.statusCode = 400;
    throw error;
  }
  let cobaltError = null;
  try {
    const response = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url, downloadMode: "auto" }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && (data.url || data.audio)) {
      const result = {
        trang_thai: "thanh_cong",
        loai: "cobalt_media",
        link_nguon: url,
        link_tai: data.url || null,
        link_audio: data.audio || null,
        nguon_tai: "Cobalt",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      };
      if (/tiktok\.com|douyin\.com/i.test(url)) {
        const extra = await fetchTikwmMedia(url).catch(() => null);
        if (extra?.anh?.length) {
          result.loai = "tiktok_photo";
          result.danh_sach_anh = extra.anh;
          result.anh_bia = extra.anh_bia;
          result.tieu_de = extra.tieu_de;
          result.link_audio = result.link_audio || extra.nhac_mp3;
          if (/\.(mp3|m4a)(\?|$)|ies-music|audio_mpeg/i.test(result.link_tai || "")) {
            result.link_audio = result.link_audio || result.link_tai;
            result.link_tai = extra.video_hd || extra.video_khong_logo || null;
          }
        }
      }
      return result;
    }
    cobaltError = data.error?.code || data.error || data.message || `HTTP ${response.status}`;
  } catch (error) {
    cobaltError = error.message;
  }

  if (/tiktok\.com|douyin\.com|iesdouyin\.com/i.test(url)) {
    const fallback = await fetchTikwmMedia(url).catch(() => null);
    if (fallback?.video_khong_logo || fallback?.video_hd || fallback?.nhac_mp3 || fallback?.anh?.length) {
      return {
        trang_thai: "thanh_cong",
        loai: fallback.loai === "tiktok_photo" ? "tiktok_photo" : "cobalt_media",
        link_nguon: url,
        link_tai: fallback.video_hd || fallback.video_khong_logo || null,
        link_audio: fallback.nhac_mp3 || null,
        danh_sach_anh: fallback.anh || [],
        nguon_tai: "TikWM (dự phòng Cobalt)",
        tieu_de: fallback.tieu_de,
        anh_bia: fallback.anh_bia,
        canh_bao: cobaltError
          ? `Cobalt không xác thực được yêu cầu (${cobaltError}); hệ thống đã dùng TikWM dự phòng.`
          : undefined,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      };
    }
  }

  const error = new Error(
    /youtube\.com|youtu\.be/i.test(url)
      ? "Cobalt public yêu cầu API key/JWT; YouTube fallback cũng không lấy được stream."
      : "Cobalt public yêu cầu API key/JWT. Với nền tảng này hiện chưa có fallback phù hợp."
  );
  error.statusCode = 502;
  error.payload = {
    trang_thai: "that_bai",
    loai: "cobalt_media",
    link_nguon: url,
    link_tai: null,
    link_audio: null,
    ma_loi: "COBALT_AUTH_REQUIRED",
    thong_bao: error.message,
    chi_tiet_upstream: cobaltError,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
  throw error;
}

function extractSessionId(input) {
  if (!input) return null;
  const str = String(input).trim();
  const cookieMatch = str.match(/(?:^|[;\s])sessionid=([a-zA-Z0-9_-]+)/i);
  if (cookieMatch) return cookieMatch[1];
  const paramMatch = str.match(/(?:^|[?&])(?:sessionid|session_id|sid)=([a-zA-Z0-9_-]+)/i);
  if (paramMatch) return paramMatch[1];
  if (!str.includes("/") && !str.includes("?") && !str.includes("&") && !str.startsWith("@") && str.length >= 30 && /^[a-zA-Z0-9_-]{30,128}$/.test(str)) {
    return str;
  }
  return null;
}

async function checkTikTokSession(sessionId) {
  const cleanSid = String(sessionId || "").trim();
  if (!cleanSid) {
    return {
      trang_thai: "that_bai",
      thong_bao: "Mã sessionid không hợp lệ hoặc đang để trống.",
      tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.tiktok.com/",
    "Cookie": `sessionid=${cleanSid};`
  };

  try {
    const passportRes = await fetch("https://www.tiktok.com/passport/web/account/info/", {
      headers,
      signal: AbortSignal.timeout(10000)
    });

    if (!passportRes.ok) {
      return {
        trang_thai: "that_bai",
        thong_bao: `Session ID không hợp lệ hoặc hết hạn (HTTP ${passportRes.status}).`,
        tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
      };
    }

    const passportJson = await passportRes.json().catch(() => null);
    const pData = (passportJson && passportJson.data) || {};

    if (!pData.user_id_str && !pData.username && !pData.screen_name) {
      const msg = passportJson?.message;
      const thongBao = (!msg || msg === "error")
        ? "Session ID không hợp lệ hoặc đã hết hạn/đăng xuất."
        : msg;
      return {
        trang_thai: "that_bai",
        thong_bao: thongBao,
        tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
      };
    }

    const username = pData.username || "";
    let uInfo = {};
    let uStats = {};

    if (username) {
      try {
        const profileRes = await fetch(`https://www.tiktok.com/api/user/detail/?unique_id=${encodeURIComponent(username)}`, {
          headers,
          signal: AbortSignal.timeout(10000)
        });
        if (profileRes.ok) {
          const profileJson = await profileRes.json().catch(() => null);
          if (profileJson && profileJson.userInfo) {
            uInfo = profileJson.userInfo.user || {};
            uStats = profileJson.userInfo.stats || {};
          }
        }
      } catch (_) {}

      if (uStats.followerCount === undefined || uStats.followerCount === null) {
        try {
          const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
          const [browserHtml, cardHtml, jinaData] = await Promise.all([
            fetchProfileHtml(profileUrl, BROWSER_HEADERS).catch(() => ""),
            fetchProfileHtml(profileUrl, CARD_HEADERS).catch(() => ""),
            fetchJinaProfile(username).catch(() => null)
          ]);
          let parsed = profileFromHtml(browserHtml, username)
            || profileFromHtml(cardHtml, username)
            || jinaData;
          if (!parsed) parsed = await fetchOembedProfile(username).catch(() => null);
          if (parsed) {
            if (parsed.userInfo) {
              uInfo = { ...parsed.userInfo, ...uInfo };
            }
            if (parsed.userStats) {
              uStats = { ...parsed.userStats, ...uStats };
            }
          }
        } catch (_) {}
      }
    }

    let taoLuc = null;
    if (pData.create_time) {
      const d = new Date(pData.create_time * 1000);
      taoLuc = d.toISOString().replace("T", " ").substring(0, 19);
    }

    return {
      trang_thai: "thanh_cong",
      loai: "tiktok_session_check",
      thong_tin_cong_khai: {
        ten_hien_thi: uInfo.nickname || pData.screen_name || "Không rõ",
        username: `@${pData.username || username}`,
        tieu_su: uInfo.signature || "Trống",
        da_xac_minh: Boolean(uInfo.verified),
        so_nguoi_theo_doi: uStats.followerCount ?? "Đang cập nhật",
        so_dang_theo_doi: uStats.followingCount ?? "Đang cập nhật",
        tong_luot_thich: uStats.heartCount ?? uStats.heart ?? "Đang cập nhật",
        tong_video: uStats.videoCount ?? "Đang cập nhật",
        anh_dai_dien: uInfo.avatarLarger || uInfo.avatarMedium || uInfo.avatarThumb || null
      },
      thong_tin_bao_mat: {
        user_id: pData.user_id_str || String(pData.user_id || ""),
        sec_user_id: pData.sec_user_id || "",
        email: pData.email || "Trống",
        so_dien_thoai: pData.mobile || "Không liên kết / Trống",
        da_co_mat_khau: pData.has_password === 1 ? "Có" : "Không",
        thoi_gian_tao: taoLuc || "Không rõ"
      },
      lien_ket_mang_xa_hoi: Array.isArray(pData.connects) && pData.connects.length ? pData.connects.map((c) => ({
        nen_tang: String(c.platform || "").toUpperCase(),
        ten_hien_thi: c.screen_name || ""
      })) : "Không có liên kết nào khác.",
      cookie_hoat_dong: `sessionid=${cleanSid};`,
      tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
    };
  } catch (err) {
    return {
      trang_thai: "that_bai",
      thong_bao: `Lỗi kết nối kiểm tra Session: ${err.message || err}`,
      tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
    };
  }
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-zhee-key, secretkey");
  if (req.method === "OPTIONS") return res.status(204).end();

  req.query = req.query || {};
  let query = req.query.url
    || req.query.user
    || req.query.username
    || req.query.sessionid
    || req.query.session_id
    || req.query.sid
    || req.query.link
    || req.query.q
    || req.query.id
    || req.query[""]
    || null;

  if (!query) {
    try {
      const parsedUrl = new URL(req.url || "/", "http://localhost");
      query = parsedUrl.searchParams.get("url")
        || parsedUrl.searchParams.get("user")
        || parsedUrl.searchParams.get("username")
        || parsedUrl.searchParams.get("sessionid")
        || parsedUrl.searchParams.get("session_id")
        || parsedUrl.searchParams.get("sid")
        || parsedUrl.searchParams.get("link")
        || parsedUrl.searchParams.get("q")
        || parsedUrl.searchParams.get("id")
        || parsedUrl.searchParams.get("")
        || null;
      if (!query) {
        for (const [k, v] of parsedUrl.searchParams.entries()) {
          if (["key", "secret", "secretkey", "token", "format"].includes(k.toLowerCase())) continue;
          if (v) { query = v; break; }
          if (k && !v) { query = k; break; }
        }
      }
    } catch (_) {}
  }

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  if (!query && rawQuery) {
    const firstParam = rawQuery.split("&").find((p) => !/^(?:key|secret|token)=/i.test(p)) || rawQuery.split("&")[0];
    query = decodeURIComponent(firstParam.replace(/^=/, "")).trim();
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host || "api-zhee.vercel.app";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${host}`;

  const requestedPath = new URL(req.url || "/", baseUrl).pathname.toLowerCase();
  const browserHeaders = BROWSER_HEADERS;
  if (requestedPath.includes("/cobalt")) {
    try {
      const payload = await downloadCobaltMedia(query);
      return res.status(200).json(payload);
    } catch (error) {
      if (/youtube\.com|youtu\.be/i.test(query || "")) {
        try { return await youtubeHandler(req, res); } catch (_) {}
      }
      return res.status(error.statusCode || 502).json(error.payload || {
        trang_thai: "that_bai",
        thong_bao: error.message,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập username (@username), link video TikTok hoặc sessionid.",
      cu_phap: {
        xem_profile: `${baseUrl}/api/mxh/tiktok?user=tiktok`,
        tai_video: `${baseUrl}/api/mxh/tiktok?url=https://www.tiktok.com/@tiktok/video/...`,
        check_session: `${baseUrl}/api/mxh/tiktok?sessionid=YOUR_SESSION_ID`
      },
      tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 0: CHECK TÀI KHOẢN TIKTOK BẰNG SESSION ID
    // -------------------------------------------------------------
    const detectedSessionId = extractSessionId(query) || (req.query && (req.query.sessionid || req.query.session_id || req.query.sid));
    if (detectedSessionId) {
      const sessionResult = await checkTikTokSession(detectedSessionId);
      const statusCode = sessionResult.trang_thai === "thanh_cong" ? 200 : 400;
      return res.status(statusCode).json(sessionResult);
    }
    // -------------------------------------------------------------
    // PHÂN BIỆT PROFILE VÀ VIDEO KHI TRUYỀN LINK TIKTOK
    // -------------------------------------------------------------
    const isTikTokUrl = /tiktok\.com|douyin\.com|iesdouyin\.com/i.test(query);
    const isTikTokShortUrl = /^https?:\/\/(?:vm|vt|m)\.tiktok\.com\//i.test(query);
    const isTikTokVideoUrl = (isTikTokUrl && /\/(?:video|v|photo)\/\d+/i.test(query)) || isTikTokShortUrl;

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: TẢI VIDEO TIKTOK (KHI TRUYỀN LINK VIDEO)
    // -------------------------------------------------------------
    if (isTikTokVideoUrl || /douyin\.com|iesdouyin\.com/i.test(query)) {
      let oembedData = null;
      if (/tiktok\.com/i.test(query)) {
        try {
          const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(query)}`);
          oembedData = oembedRes.ok ? await oembedRes.json().catch(() => null) : null;
        } catch (_) {}
      }

      let linkTai = null;
      let nguonTai = [];
      let tikwmMeta = null;
      try {
        const tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(query)}`, { headers: browserHeaders });
        const tikwmData = await tikwmRes.json();
        if (tikwmData.code === 0 && tikwmData.data) {
          tikwmMeta = tikwmData.data;
          linkTai = {
            video_khong_logo: tikwmData.data.play,
            video_hd: tikwmData.data.hdplay || tikwmData.data.play,
            nhac_mp3: tikwmData.data.music,
            anh: Array.isArray(tikwmData.data.images) ? tikwmData.data.images.filter(Boolean) : []
          };
          nguonTai.push("TikWM");
        }
      } catch (_) {}
      try {
        const cobaltRes = await fetch("https://api.cobalt.tools/", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ url: query, downloadMode: "auto" }),
          signal: AbortSignal.timeout(12000)
        });
        const cobalt = await cobaltRes.json().catch(() => ({}));
        if (cobaltRes.ok && (cobalt.url || cobalt.audio)) {
          linkTai = { ...(linkTai || {}), video_khong_logo: linkTai?.video_khong_logo || cobalt.url || null, video_hd: linkTai?.video_hd || cobalt.url || null, nhac_mp3: linkTai?.nhac_mp3 || cobalt.audio || null };
          nguonTai.push("Cobalt");
        }
      } catch (_) {}

      // TikTok app share links (vm/vt.tiktok.com) do not expose /photo/<id>
      // in the original URL. TikWM's images array is the reliable Photo Mode signal.
      const photoMode = /\/photo\/\d+/i.test(query) || Boolean(linkTai?.anh?.length);
      const hasMedia = Boolean(linkTai && (linkTai.video_khong_logo || linkTai.video_hd || linkTai.nhac_mp3 || (Array.isArray(linkTai.anh) && linkTai.anh.length)));
      return res.status(200).json({
        trang_thai: hasMedia ? "thanh_cong" : "that_bai",
        loai: photoMode ? "tiktok_photo" : /douyin\.com|iesdouyin\.com/i.test(query) ? "douyin_video" : "tiktok_video",
        nen_tang: /douyin\.com|iesdouyin\.com/i.test(query) ? "Douyin" : "TikTok",
        tieu_de: oembedData?.title || tikwmMeta?.title || "Video TikTok/Douyin",
        tac_gia: {
          ten_hien_thi: oembedData?.author_name || tikwmMeta?.author?.nickname || tikwmMeta?.author?.unique_id || "Không rõ",
          username: oembedData?.author_unique_id || tikwmMeta?.author?.unique_id || tikwmMeta?.author?.id || null,
          link_trang_ca_nhan: oembedData?.author_url || (tikwmMeta?.author?.unique_id ? `https://www.tiktok.com/@${tikwmMeta.author.unique_id}` : null)
        },
        anh_bia: oembedData?.thumbnail_url || tikwmMeta?.cover || tikwmMeta?.origin_cover || null,
        link_tai: linkTai || "Không thể lấy link tải trực tiếp từ TikWM/Cobalt.",
        nguon_tai: nguonTai,
        tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: LẤY PROFILE VÀ VIDEO QUA USERNAME / LINK PROFILE
    // -------------------------------------------------------------
    const profileMatch = query.match(/tiktok\.com\/@([^/?#]+)/i);
    const rawUser = String(profileMatch?.[1] || query).trim();
    let cleanUser = rawUser;
    try { cleanUser = decodeURIComponent(rawUser); } catch { cleanUser = rawUser; }
    cleanUser = cleanUser.replace(/^@+/, "");
    const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(cleanUser)}`;

    const [browserHtml, cardHtml, jinaData] = await Promise.all([
      fetchProfileHtml(profileUrl, browserHeaders).catch(() => ""),
      fetchProfileHtml(profileUrl, CARD_HEADERS).catch(() => ""),
      fetchJinaProfile(cleanUser).catch(() => null)
    ]);
    let parsed = profileFromHtml(browserHtml, cleanUser)
      || profileFromHtml(cardHtml, cleanUser)
      || jinaData;
    if (!parsed) parsed = await fetchOembedProfile(cleanUser).catch(() => null);
    const userInfo = parsed?.userInfo || null;
    const userStats = parsed?.userStats || null;
    const secUid = parsed?.secUid || "";
    const html = browserHtml || cardHtml;

    if (!userInfo) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy tài khoản TikTok: @${cleanUser}`
      });
    }

    let videoList = [];
    if (secUid) {
      try {
        const feedUrl = `https://www.tiktok.com/api/post/item_list/?aid=1988&count=10&secUid=${encodeURIComponent(secUid)}&cursor=0`;
        const feedRes = await fetch(feedUrl, { headers: browserHeaders });
        const feedData = await feedRes.json();

        if (feedData.itemList && Array.isArray(feedData.itemList)) {
          videoList = feedData.itemList.map((v, idx) => ({
            stt: idx + 1,
            id_video: v.id,
            tieu_de: v.desc || "Không có tiêu đề",
            link_video: `https://www.tiktok.com/@${cleanUser}/video/${v.id}`,
            anh_bia: v.video?.cover || null,
            thoi_luong_giay: v.video?.duration || 0,
            luot_xem: v.stats?.playCount || 0,
            luot_thich: v.stats?.diggCount || 0
          }));
        }
      } catch (e) {
        const videoRegex = new RegExp(`https:\\/\\/www\\.tiktok\\.com\\/@${cleanUser}\\/video\\/(\\d+)`, "g");
        const found = [...new Set(html.match(videoRegex) || [])];
        videoList = found.slice(0, 10).map((link, idx) => ({
          stt: idx + 1,
          id_video: link.split("/").pop(),
          tieu_de: "Video TikTok",
          link_video: link
        }));
      }
    }

    const payload = {
      trang_thai: "thanh_cong",
      thong_tin_ca_nhan: {
        id: userInfo.id || "",
        tai_khoan: userInfo.uniqueId || cleanUser,
        ho_ten: userInfo.nickname || cleanUser,
        anh_dai_dien: userInfo.avatarLarger || userInfo.avatarMedium || userInfo.avatarThumb || "",
        link_trang_ca_nhan: `https://www.tiktok.com/@${userInfo.uniqueId || cleanUser}`,
        tieu_su: userInfo.signature || "Không có tiểu sử",
        tich_xanh: Boolean(userInfo.verified),
        tai_khoan_rieng_tu: Boolean(userInfo.privateAccount),
        nguoi_theo_doi: userStats?.followerCount || 0,
        dang_theo_doi: userStats?.followingCount || 0,
        tong_luot_thich: userStats?.heartCount ?? userStats?.heart ?? 0,
        tong_so_video: userStats?.videoCount || 0
      }
    };

    if (videoList.length > 0) {
      payload.tong_so_video_lay_duoc = videoList.length;
      payload.danh_sach_video_gan_nhat = videoList;
    }

    return res.status(200).json(payload);

  } catch (error) {
    return res.status(500).json({ trang_thai: "that_bai", thong_bao: error.message });
  }
};

module.exports.downloadCobaltMedia = downloadCobaltMedia;
module.exports.fetchTikwmMedia = fetchTikwmMedia;
module.exports.profileFromHtml = profileFromHtml;
module.exports.profileFromJina = profileFromJina;
module.exports.fetchOembedProfile = fetchOembedProfile;
module.exports.fetchJinaProfile = fetchJinaProfile;