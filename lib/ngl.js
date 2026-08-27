const { randomUUID } = require("crypto");

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1"
];

const BULK_KEYS = ["threads", "count", "so_luong", "soluong", "list", "bulk", "spam", "proxy", "use_proxy", "proxies"];

function safeDecodeComponent(value) {
  if (value == null) return "";
  const normalized = String(value).replace(/\+/g, " ");
  try {
    return decodeURIComponent(normalized);
  } catch (_) {}
  try {
    return decodeURIComponent(normalized.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
  } catch (_) {}
  return normalized;
}

function parseRawQuery(reqUrl) {
  const str = String(reqUrl || "");
  const idx = str.indexOf("?");
  if (idx < 0) return {};
  const out = {};
  for (const part of str.slice(idx + 1).split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawVal = eq === -1 ? "" : part.slice(eq + 1);
    const key = safeDecodeComponent(rawKey);
    const val = safeDecodeComponent(rawVal);
    if (!key) {
      if (val) out[""] = val;
      continue;
    }
    out[key] = val;
  }
  return out;
}

function decodeBase64Utf8(value) {
  if (!value) return "";
  try {
    const padded = String(value).replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(padded, "base64").toString("utf8").trim();
  } catch (_) {
    return "";
  }
}

function extractFirstParam(params) {
  if (params[""]) return String(params[""]).trim();
  return "";
}

function pick(params, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
  }
  return "";
}

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function uuidv4() {
  return randomUUID();
}

function collectCookies(res, existing = "") {
  const jar = new Map();
  String(existing)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf("=");
      if (idx > 0) jar.set(part.slice(0, idx), part.slice(idx + 1));
    });

  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const raw of setCookies) {
    const pair = String(raw).split(";")[0];
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }

  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function formHeaders(username, ua, cookie) {
  const headers = {
    Accept: "*/*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: "https://ngl.link",
    Referer: `https://ngl.link/${username}`,
    "User-Agent": ua,
    "X-Requested-With": "XMLHttpRequest"
  };
  if (cookie) headers.Cookie = cookie;
  return headers;
}

function convertUsername(input) {
  if (!input) return "";
  let raw = String(input).trim();
  try { raw = decodeURIComponent(raw); } catch (_) {}
  const linkMatch = raw.match(/ngl\.link\/([a-zA-Z0-9_.-]+)/i);
  if (linkMatch && linkMatch[1]) raw = linkMatch[1];
  raw = raw.replace(/^@+/, "").replace(/\/+$/, "").trim();
  if (!/^[a-zA-Z0-9_.-]{1,30}$/.test(raw)) return "";
  return raw.toLowerCase();
}

function isBulkValue(key, val) {
  if (val == null) return false;
  const raw = String(val).trim().toLowerCase();
  if (!raw || raw === "false" || raw === "0" || raw === "no" || raw === "off") return false;
  if (["threads", "count", "so_luong", "soluong"].includes(key)) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 1;
  }
  return true;
}

function hasBulkAttempt(params) {
  for (const key of BULK_KEYS) {
    if (isBulkValue(key, params[key])) return key;
  }
  return "";
}

async function lookupNglUser(username) {
  const profileUrl = `https://ngl.link/${encodeURIComponent(username)}`;
  const res = await fetch(profileUrl, {
    headers: {
      "User-Agent": randomUserAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });

  const html = await res.text();
  const notFound = res.status === 404 || /Could not find user/i.test(html);

  if (notFound) {
    return { ton_tai: false, username, link_profile: profileUrl };
  }

  const igMatch = html.match(/var\s+ig_username\s*=\s*"([^"]*)"/i);
  const regionMatch = html.match(/id=["']userRegion["'][^>]*value=["']([^"']+)["']/i)
    || html.match(/value=["']([^"']+)["'][^>]*id=["']userRegion["']/i);
  const promptMatch = html.match(/class=["']prompt["'][^>]*>([^<]+)</i);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

  return {
    ton_tai: true,
    username,
    instagram: (igMatch && igMatch[1]) ? igMatch[1] : null,
    khu_vuc: (regionMatch && regionMatch[1]) ? regionMatch[1] : null,
    loi_nhan: (promptMatch && promptMatch[1]) ? promptMatch[1].trim() : null,
    tieu_de: (titleMatch && titleMatch[1]) ? titleMatch[1].trim() : `@${username}`,
    link_profile: profileUrl
  };
}

async function nglFormPost(path, username, ua, cookie, data) {
  const body = Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value == null ? "" : String(value))}`)
    .join("&");
  const res = await fetch(`https://ngl.link${path}`, {
    method: "POST",
    headers: formHeaders(username, ua, cookie),
    body,
    signal: AbortSignal.timeout(10000)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { res, text, json, cookie: collectCookies(res, cookie) };
}

async function sendOneNglMessage(username, question) {
  const ua = USER_AGENTS[0];
  const deviceId = uuidv4();

  const pageRes = await fetch(`https://ngl.link/${encodeURIComponent(username)}`, {
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });
  const html = await pageRes.text();
  let cookie = collectCookies(pageRes, "");

  const uid = (html.match(/var\s+uid\s*=\s*"([^"]+)"/) || [])[1] || "";
  const gameSlug = (html.match(/var\s+gameSlug\s*=\s*"([^"]*)"/) || [])[1] || "";
  const gameId = (html.match(/var\s+gameId\s*=\s*"([^"]*)"/) || [])[1] || "default";
  const shareStyle = (html.match(/var\s+shareStyleName\s*=\s*"([^"]+)"/) || [])[1] || "";

  const pageview = await nglFormPost("/api/pageview", username, ua, cookie, {
    uid,
    referrer: "https://l.instagram.com/",
    game: gameId,
    deviceId
  });
  cookie = pageview.cookie || cookie;

  const fingerprint = await nglFormPost("/api/fingerprint/web", username, ua, cookie, { deviceId });
  cookie = fingerprint.cookie || cookie;

  const payload = {
    username,
    question,
    deviceId,
    gameSlug,
    referrer: "https://l.instagram.com/"
  };
  if (shareStyle) payload.style = shareStyle;

  const submit = await nglFormPost("/api/submit", username, ua, cookie, payload);
  const questionId = submit.json && submit.json.questionId;

  return {
    ok: Boolean(submit.res.ok && questionId),
    status: submit.res.status,
    json: submit.json,
    text: submit.text,
    questionId: questionId || null,
    userRegion: (submit.json && submit.json.userRegion) || null,
    deviceId,
    fingerprint: fingerprint.json || null
  };
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "NGL.link — Check Username & Gửi 1 Tin Nhắn Ẩn Danh",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Kiểm tra username NGL còn trống hay đã đăng ký. Gửi đúng 1 tin nhắn ẩn danh mỗi lần gọi (không spam, không proxy farm, không multi-thread).",
    luu_y: [
      "Phải có action=send và question=... mới gửi tin. Chỉ ?={username} là check, không gửi.",
      "Tin vào hộp thư app NGL, không phải tin nhắn Instagram.",
      "Thành công phải có ma_cau_hoi (questionId). Không hỗ trợ spam/proxy/multi-thread."
    ],
    cu_phap: [
      `${baseUrl}/api/tools/ngl?={username}`,
      `${baseUrl}/api/tools/ngl?username={username}`,
      `${baseUrl}/api/tools/ngl?action=send&username={username}&question=${encodeURIComponent("{noi_dung_tieng_viet}")}`,
      `POST ${baseUrl}/api/tools/ngl  {"action":"send","username":"{user}","question":"con mẹ mày"}`
    ],
    vi_du: [
      `${baseUrl}/api/tools/ngl?=hoducminh`,
      `${baseUrl}/api/tools/ngl?username=https://ngl.link/hoducminh`,
      `${baseUrl}/api/tools/ngl?action=send&username=hoducminh&question=${encodeURIComponent("con mẹ mày")}`
    ]
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();

  const rawQuery = parseRawQuery(req.url || "");
  let urlParams = {};
  try {
    const searchParams = new URL(req.url || "", baseUrl).searchParams;
    for (const [key, value] of searchParams.entries()) urlParams[key] = value;
  } catch (_) {}
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const params = { ...urlParams, ...rawQuery, ...body };
  const firstParam = extractFirstParam(params);

  const bulkKey = hasBulkAttempt(params);
  if (bulkKey) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: `Không hỗ trợ tham số '${bulkKey}'. API chỉ gửi đúng 1 tin nhắn NGL mỗi lần, không spam.`
    });
  }

  const action = (pick(params, "action", "type") || "").toLowerCase();
  const username = convertUsername(
    pick(params, "username", "user") || (!["send", "gui"].includes(action) ? (pick(params, "q") || firstParam) : firstParam)
  );
  const question = pick(params, "question", "msg", "message", "noidung", "text", "cau")
    || decodeBase64Utf8(pick(params, "question64", "q64", "noidung64"));

  if (!username && action !== "send") {
    return res.status(200).json(buildGuide(baseUrl));
  }

  try {
    if (!username) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập username hoặc link ngl.link."
      });
    }

    const profile = await lookupNglUser(username);

    if (action === "send" || action === "gui" || question) {
      if (!profile.ton_tai) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: `Người dùng NGL không tồn tại: ${username}`
        });
      }

      const message = (question || "").trim();
      if (!message) {
        return res.status(400).json({
          trang_thai: "that_bai",
          thong_bao: "Thiếu nội dung. Thêm &question={noi_dung}. Chỉ check username thì tin không được gửi."
        });
      }
      if (message.length > 300) {
        return res.status(400).json({
          trang_thai: "that_bai",
          thong_bao: "Nội dung tin nhắn không được quá 300 ký tự."
        });
      }

      const sent = await sendOneNglMessage(username, message);
      if (!sent.ok || !sent.questionId) {
        return res.status(502).json({
          trang_thai: "that_bai",
          thong_bao: "NGL không tạo được tin trong hộp thư (thiếu questionId). Có thể bị chặn hoặc cần gửi lại.",
          ma_http: sent.status,
          phan_hoi_ngl: sent.json || (sent.text || "").slice(0, 300)
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "NGL Send Message",
        thong_bao: "Đã gửi 1 tin nhắn ẩn danh vào hộp thư NGL (app NGL, không phải Instagram DM).",
        du_lieu: {
          username,
          noi_dung: message,
          ma_cau_hoi: sent.questionId,
          khu_vuc: sent.userRegion,
          link_profile: profile.link_profile
        },
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    if (!profile.ton_tai) {
      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "NGL Username Lookup",
        du_lieu: {
          username,
          co_ton_tai: false,
          tinh_trang: "CÒN TRỐNG — Username chưa đăng ký trên NGL.",
          link_profile: profile.link_profile,
          tac_gia: "Hồ Đức Minh (Zhee Dev)"
        }
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "NGL Username Lookup",
      du_lieu: {
        username: profile.username,
        co_ton_tai: true,
        tinh_trang: "ĐÃ ĐĂNG KÝ — Username đang được sử dụng.",
        instagram: profile.instagram,
        khu_vuc: profile.khu_vuc,
        loi_nhan: profile.loi_nhan,
        tieu_de: profile.tieu_de,
        link_profile: profile.link_profile,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      }
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Không thể kết nối tới NGL. Vui lòng thử lại sau.",
      chi_tiet: error.message
    });
  }
};
