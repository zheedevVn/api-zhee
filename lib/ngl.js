const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1"
];

const BULK_KEYS = ["threads", "count", "so_luong", "soluong", "list", "bulk", "spam", "proxy", "use_proxy", "proxies"];

function extractFirstParam(searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) return value.trim();
    if (key && !value) return key.replace(/^=/, "").trim();
  }
  return "";
}

function pick(searchParams, body, ...keys) {
  for (const key of keys) {
    const fromQuery = searchParams.get(key);
    if (fromQuery) return String(fromQuery).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDeviceId() {
  const hex = (n) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
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

function hasBulkAttempt(searchParams, body) {
  for (const key of BULK_KEYS) {
    if (searchParams.has(key) && isBulkValue(key, searchParams.get(key))) return key;
    if (body && isBulkValue(key, body[key])) return key;
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

async function sendOneNglMessage(username, question) {
  const deviceId = randomDeviceId();
  const body = new URLSearchParams({
    username,
    question,
    deviceId,
    gameSlug: "",
    referrer: ""
  });

  const res = await fetch("https://ngl.link/api/submit", {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Accept-Language": "vi-VN,vi;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://ngl.link",
      Referer: `https://ngl.link/${username}`,
      "User-Agent": randomUserAgent(),
      "X-Requested-With": "XMLHttpRequest"
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10000)
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}

  return {
    ok: res.ok,
    status: res.status,
    json,
    text
  };
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "NGL.link — Check Username & Gửi 1 Tin Nhắn Ẩn Danh",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Kiểm tra username NGL còn trống hay đã đăng ký. Gửi đúng 1 tin nhắn ẩn danh mỗi lần gọi (không spam, không proxy farm, không multi-thread).",
    luu_y: [
      "Không hỗ trợ threads/count/proxy/spam. Mỗi request chỉ gửi 1 tin.",
      "Nội dung tối đa 300 ký tự theo giới hạn NGL."
    ],
    cu_phap: [
      `${baseUrl}/api/tools/ngl?={username}`,
      `${baseUrl}/api/tools/ngl?username={username}`,
      `${baseUrl}/api/tools/ngl?action=send&username={username}&question={noi_dung}`
    ],
    vi_du: [
      `${baseUrl}/api/tools/ngl?=hoducminh`,
      `${baseUrl}/api/tools/ngl?username=https://ngl.link/hoducminh`,
      `${baseUrl}/api/tools/ngl?action=send&username=hoducminh&question=hello`
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

  const requestUrl = new URL(req.url || "", baseUrl);
  const searchParams = requestUrl.searchParams;
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const firstParam = extractFirstParam(searchParams);

  const bulkKey = hasBulkAttempt(searchParams, body);
  if (bulkKey) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: `Không hỗ trợ tham số '${bulkKey}'. API chỉ gửi đúng 1 tin nhắn NGL mỗi lần, không spam.`
    });
  }

  const action = (pick(searchParams, body, "action", "type") || "").toLowerCase();
  const username = convertUsername(
    pick(searchParams, body, "username", "user", "q") || firstParam
  );
  const question = pick(searchParams, body, "question", "msg", "message", "noidung", "text");

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

      const message = (question || "Hello").trim();
      if (message.length > 300) {
        return res.status(400).json({
          trang_thai: "that_bai",
          thong_bao: "Nội dung tin nhắn không được quá 300 ký tự."
        });
      }

      const sent = await sendOneNglMessage(username, message);
      if (!sent.ok) {
        return res.status(502).json({
          trang_thai: "that_bai",
          thong_bao: "Gửi tin nhắn NGL thất bại. Vui lòng thử lại sau.",
          ma_http: sent.status
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "NGL Send Message",
        thong_bao: "Đã gửi 1 tin nhắn ẩn danh.",
        du_lieu: {
          username,
          noi_dung: message,
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
