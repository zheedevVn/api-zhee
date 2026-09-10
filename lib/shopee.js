const SITES = {
  vn: { host: "shopee.vn", img: "https://down-vn.img.susercontent.com/file" },
  th: { host: "shopee.co.th", img: "https://down-th.img.susercontent.com/file" },
  id: { host: "shopee.co.id", img: "https://down-id.img.susercontent.com/file" },
  sg: { host: "shopee.sg", img: "https://down-sg.img.susercontent.com/file" },
  my: { host: "shopee.com.my", img: "https://down-my.img.susercontent.com/file" },
  ph: { host: "shopee.ph", img: "https://down-ph.img.susercontent.com/file" },
  tw: { host: "shopee.tw", img: "https://down-tw.img.susercontent.com/file" }
};

function extractFirstParam(searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) return value.trim();
    if (key && !value) return key.replace(/^=/, "").trim();
  }
  return "";
}

function formatUnix(ts) {
  if (!ts) return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("vi-VN");
}

function formatSeconds(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 60) return `${n} giây`;
  if (n < 3600) return `${Math.round(n / 60)} phút`;
  if (n < 86400) return `${(n / 3600).toFixed(1)} giờ`;
  return `${Math.round(n / 86400)} ngày`;
}

function fileUrl(imgBase, id) {
  if (!id) return "";
  if (String(id).startsWith("http")) return id;
  return `${imgBase}/${id}`;
}

function coKhong(v) {
  return v ? "CÓ" : "KHÔNG";
}

function textVal(v, fallback = "Chưa cập nhật") {
  if (v == null || v === "") return fallback;
  return v;
}

function metricVal(isSeller, value, suffix = "") {
  if (!isSeller) return "Chưa có (chưa mở shop)";
  if (value == null || value === "") return "Chưa cập nhật";
  return suffix ? `${value}${suffix}` : value;
}

function detectSiteFromInput(input) {
  const raw = String(input || "").toLowerCase();
  if (raw.includes("shopee.co.th")) return "th";
  if (raw.includes("shopee.co.id")) return "id";
  if (raw.includes("shopee.com.my")) return "my";
  if (raw.includes("shopee.ph")) return "ph";
  if (raw.includes("shopee.tw")) return "tw";
  if (raw.includes("shopee.sg")) return "sg";
  return "vn";
}

function parseShopeeInput(input) {
  if (!input) return { username: "", shopid: "" };
  let raw = String(input).trim();
  try { raw = decodeURIComponent(raw); } catch (_) {}

  const shopIdUrl = raw.match(/shopee\.[^/]+\/shop\/(\d+)/i);
  if (shopIdUrl) return { username: "", shopid: shopIdUrl[1] };

  const userUrl = raw.match(/shopee\.[^/]+\/([a-zA-Z0-9._-]+)\/?$/i);
  if (userUrl && userUrl[1] && !["shop", "product", "search", "mall", "cart", "buyer"].includes(userUrl[1].toLowerCase())) {
    return { username: userUrl[1], shopid: "" };
  }

  if (/^\d{4,}$/.test(raw)) return { username: "", shopid: raw };
  return { username: raw.replace(/^@+/, "").replace(/\/+$/, ""), shopid: "" };
}

function isPlaceholderShopName(name, username) {
  if (!name) return true;
  if (username && String(name).toLowerCase() === String(username).toLowerCase()) return false;
  return /^[a-z0-9]{8,14}$/.test(String(name));
}

function pickNickname(...candidates) {
  for (const value of candidates) {
    const text = value == null ? "" : String(value).trim();
    if (text) return text;
  }
  return "";
}

function parseCookieMap(cookieStr) {
  const map = {};
  String(cookieStr || "").split(";").forEach((part) => {
    const item = part.trim();
    const idx = item.indexOf("=");
    if (idx > 0) map[item.slice(0, idx)] = item.slice(idx + 1);
  });
  return map;
}

function inspectCookie(cookieStr) {
  const raw = String(cookieStr || "").trim();
  if (!raw) {
    return {
      hop_le: false,
      da_gui: [],
      thieu: ["SPC_EC", "SPC_U", "SPC_SI"],
      thong_bao: "Chưa gửi cookie."
    };
  }
  const map = parseCookieMap(raw);
  const keys = Object.keys(map);
  const hasEC = Boolean(map.SPC_EC);
  const hasU = Boolean(map.SPC_U);
  const onlyF = keys.length === 1 && keys[0] === "SPC_F";
  const thieu = ["SPC_EC", "SPC_U", "SPC_SI"].filter((k) => !map[k]);
  if (onlyF) {
    return {
      hop_le: false,
      da_gui: keys,
      thieu,
      thong_bao: "Chỉ gửi SPC_F. Đó là fingerprint máy, không đăng nhập được."
    };
  }
  if (!hasEC) {
    return {
      hop_le: false,
      da_gui: keys,
      thieu,
      thong_bao: "Thiếu SPC_EC (HttpOnly). document.cookie trên Console không lấy được cookie này nên URL bị thiếu session. Copy Cookie từ tab Network rồi POST, đừng gắn cookie dài lên URL."
    };
  }
  return {
    hop_le: true,
    da_gui: keys,
    thieu: [],
    thong_bao: "Cookie phiên hợp lệ (có SPC_EC)."
  };
}

function extractCookieFromCurl(curl) {
  const text = String(curl || "");
  if (!text) return "";
  const patterns = [
    /-H ['"]Cookie:\s*([^'"]+)['"]/i,
    /-H ['"]cookie:\s*([^'"]+)['"]/i,
    /--header ['"]Cookie:\s*([^'"]+)['"]/i,
    /-b ['"]([^'"]+)['"]/,
    /--cookie ['"]([^'"]+)['"]/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].replace(/\\\n/g, " ").trim();
  }
  return "";
}

async function shopeeGet(host, path, referer, cookie = "", extraHeaders = {}) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    Referer: referer,
    Origin: `https://${host}`,
    "X-API-SOURCE": "pc",
    "X-Requested-With": "XMLHttpRequest",
    ...extraHeaders
  };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`https://${host}${path}`, {
    headers,
    signal: AbortSignal.timeout(10000)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { ok: res.ok, status: res.status, json, text };
}

function extractNicknameFromData(data) {
  if (!data || typeof data !== "object") return "";
  const nested = data.user || data.account || data.profile || data;
  return pickNickname(
    nested.nickname,
    nested.nick_name,
    nested.display_name,
    nested.shopname,
    nested.shop_name,
    data.nickname,
    data.nick_name,
    data.display_name
  );
}

async function fetchDisplayName(host, cookie) {
  const cookieInfo = inspectCookie(cookie);
  const map = parseCookieMap(cookie);
  if (!cookie || (!map.SPC_EC && !map.SPC_U)) return { nickname: "", cookieInfo };
  const csrf = map.csrftoken || map.CSRFToken || "";
  const cds = map.SPC_CDS || csrf || "";
  const extra = {};
  if (csrf) extra["x-csrftoken"] = csrf;
  const referer = `https://${host}/user/account/profile`;
  const paths = [
    `/api/v4/account/basic/get_account_info${cds ? `?SPC_CDS=${encodeURIComponent(cds)}` : ""}`,
    `/api/v4/account/get_profile${cds ? `?SPC_CDS=${encodeURIComponent(cds)}` : ""}`,
    "/api/v4/account/basic/get_account_info",
    "/api/v4/account/get_profile"
  ];
  for (const path of paths) {
    const res = await shopeeGet(host, path, referer, cookie, extra);
    const payload = res.json && (res.json.data || res.json);
    const nick = extractNicknameFromData(payload);
    if (nick) return { nickname: nick, cookieInfo };
  }
  return { nickname: "", cookieInfo };
}

async function lookupShopeeShop({ username, shopid, site, cookie }) {
  const cfg = SITES[site] || SITES.vn;
  const qs = shopid
    ? `shopid=${encodeURIComponent(shopid)}`
    : `username=${encodeURIComponent(username)}`;
  const referer = shopid
    ? `https://${cfg.host}/shop/${shopid}`
    : `https://${cfg.host}/${encodeURIComponent(username)}`;

  const [baseRes, detailRes, profile] = await Promise.all([
    shopeeGet(cfg.host, `/api/v4/shop/get_shop_base?${qs}&entry_point=&need_cancel_rate=true&request_source=shop_home_page&version=1`, referer, cookie),
    shopeeGet(cfg.host, `/api/v4/shop/get_shop_detail?${qs}`, referer, cookie),
    fetchDisplayName(cfg.host, cookie)
  ]);
  const cookieName = profile && profile.nickname ? profile.nickname : "";
  const cookieInfo = (profile && profile.cookieInfo) || inspectCookie(cookie);

  const base = (baseRes.json && baseRes.json.error === 0 && baseRes.json.data) ? baseRes.json.data : null;
  const detail = (detailRes.json && detailRes.json.error === 0 && detailRes.json.data) ? detailRes.json.data : null;
  const data = { ...(detail || {}), ...(base || {}) };

  if (!data.shopid && !data.userid && !data.name) {
    return {
      ton_tai: false,
      ma_http: baseRes.status,
      loi: (baseRes.json && (baseRes.json.error_msg || baseRes.json.error)) || "Không tìm thấy shop."
    };
  }

  const acc = data.account || {};
  const rating = data.shop_rating || {};
  const metrics = data.seller_metrics || {};
  const uname = acc.username || username || "";
  const isSeller = acc.is_seller === true;
  const isMall = Boolean(data.show_official_shop_label || data.is_official_shop);
  const avatar = fileUrl(cfg.img, acc.portrait) || "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_default_avatar.png";
  const cover = fileUrl(cfg.img, data.cover);
  const loai = isMall ? "Shop Mall chính hãng" : (isSeller ? "Shop / Người bán" : "Người mua (chưa mở shop)");
  const ratingStar = data.rating_star != null ? Number(Number(data.rating_star).toFixed(2)) : 0;
  const tenShop = textVal(data.name, uname || "Không rõ");
  const bietDanh = pickNickname(
    cookieName,
    acc.nickname,
    acc.nick_name,
    acc.display_name,
    data.nickname,
    data.display_name
  );
  const tenHienThi = bietDanh || tenShop || uname || "Không rõ";

  return {
    ton_tai: true,
    loai_tai_khoan: loai,
    site: site.toUpperCase(),
    userid: data.userid || 0,
    shopid: data.shopid || 0,
    username: uname || "Không rõ",
    biet_danh: bietDanh || "Không công khai (cần cookie phiên Shopee)",
    ten_hien_thi: tenHienThi,
    ten_shop: tenShop,
    mo_ta: textVal(data.description, isSeller ? "Chưa có mô tả" : "Tài khoản người mua, chưa có mô tả shop"),
    quoc_gia: data.country || site.toUpperCase(),
    dia_diem: textVal(data.shop_location || data.place, isSeller ? "Chưa cập nhật" : "Không công khai"),
    avatar,
    anh_bia: cover || "Không có ảnh bìa",
    link_trang: uname ? `https://${cfg.host}/${uname}` : `https://${cfg.host}/shop/${data.shopid}`,
    so_nguoi_theo_doi: data.follower_count ?? 0,
    dang_theo_doi: acc.following_count ?? 0,
    so_san_pham: isSeller ? (data.item_count ?? 0) : "Chưa có (chưa mở shop)",
    diem_danh_gia: isSeller && ratingStar > 0 ? ratingStar : (isSeller ? "Chưa có đánh giá" : "Chưa có (chưa mở shop)"),
    danh_gia: isSeller ? {
      tot: rating.rating_good ?? data.rating_good ?? 0,
      trung_binh: rating.rating_normal ?? data.rating_normal ?? 0,
      te: rating.rating_bad ?? data.rating_bad ?? 0
    } : "Chưa có (chưa mở shop)",
    ty_le_phan_hoi: metricVal(isSeller, data.response_rate != null ? data.response_rate : null, "%"),
    thoi_gian_phan_hoi: metricVal(isSeller, formatSeconds(data.response_time)),
    ty_le_huy_don: metricVal(isSeller, metrics.cancellation_rate ?? data.cancellation_rate),
    nhan: {
      mall_chinh_hang: coKhong(isMall),
      shopee_verified: coKhong(data.is_shopee_verified),
      preferred_plus: coKhong(data.is_preferred_plus_seller)
    },
    trang_thai: {
      dang_nghi_ban: coKhong(data.vacation),
      chat: data.chat_disabled ? "Tắt" : "Bật",
      xac_minh_sdt: coKhong(acc.phone_verified),
      xac_minh_email: coKhong(acc.email_verified),
      la_nguoi_ban: coKhong(isSeller)
    },
    hoat_dong_gan_nhat: formatUnix(data.last_active_time) || "Không rõ",
    ngay_tao: formatUnix(data.ctime) || "Không rõ",
    cookie: {
      hop_le: cookieInfo.hop_le ? "CÓ" : "KHÔNG",
      da_gui: cookieInfo.da_gui,
      thieu: cookieInfo.thieu,
      thong_bao: cookieInfo.thong_bao
    },
    ghi_chu: bietDanh
      ? ""
      : (cookieInfo.thong_bao || "ten_shop là tên trên banner shop. Biệt danh app cần cookie có SPC_EC.")
  };
}

function buildCookieScript(baseUrl) {
  return `/* Dan vao Console tren shopee.vn (da dang nhap). KHONG gan cookie len URL. */
(function () {
  var api = "${baseUrl}/api/mxh/shopee";
  var path = (location.pathname || "/").replace(/^\\//, "").split("/")[0];
  var username = path && path !== "shop" ? path.split("?")[0] : prompt("Username Shopee:", "hoducminh2k9") || "hoducminh2k9";

  function send(cookie) {
    return fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, cookie: cookie })
    }).then(function (res) { return res.json(); }).then(function (json) {
      console.log(json);
      var blob = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
      open(blob, "_blank");
    }).catch(function (err) { console.error(err); });
  }

  var cookie = document.cookie || "";
  if (!/(?:^|; )SPC_EC=/.test(cookie)) {
    console.warn("document.cookie KHONG co SPC_EC (HttpOnly).");
    console.warn("Lam: F12 > Network > F5 > click request shopee.vn > Headers > Cookie > Copy value");
    console.warn("Hoac Copy as cURL roi dan vao prompt.");
    var full = prompt("Dan FULL Cookie HOAC curl tu tab Network (phai co SPC_EC):", "");
    if (!full) return;
    cookie = full.trim();
    if (cookie.toLowerCase().indexOf("cookie:") >= 0) {
      cookie = cookie.split(/cookie:/i)[1].replace(/^["'\\s]+/, "").split('"')[0].split("'")[0].trim();
    }
  }
  send(cookie);
})();
`;
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const searchParams = requestUrl.searchParams;
  const firstParam = extractFirstParam(searchParams);
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const pathname = (requestUrl.pathname || "").toLowerCase();
  const action = (searchParams.get("action") || body.action || firstParam || "").toLowerCase();

  if (action === "script" || pathname.endsWith("/script") || searchParams.get("script") === "true") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=shopee-cookie.js");
    return res.status(200).send(buildCookieScript(baseUrl));
  }

  const siteRaw = (searchParams.get("site") || searchParams.get("region") || body.site || "").toLowerCase();
  const rawInput =
    searchParams.get("username") ||
    searchParams.get("user") ||
    searchParams.get("shop") ||
    searchParams.get("shopid") ||
    searchParams.get("id") ||
    searchParams.get("q") ||
    body.username ||
    body.shopid ||
    firstParam;

  if (!rawInput) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Shopee Shop / Account Lookup",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      mo_ta: "Tra cứu tài khoản/shop Shopee theo username, shopid hoặc link shop. Tên trên banner shop (vd u4hbycykdf) lấy được public. Biệt danh trong app cần cookie phiên đăng nhập.",
      cu_phap: [
        `${baseUrl}/api/mxh/shopee?={username}`,
        `${baseUrl}/api/mxh/shopee?username={username}`,
        `${baseUrl}/api/mxh/shopee?shopid={shop_id}`,
        `${baseUrl}/api/mxh/shopee?username={username}&cookie={chuoi_cookie}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/shopee?=hoducminh2k9`,
        `${baseUrl}/api/mxh/shopee?=apple_flagship_store`,
        `${baseUrl}/api/mxh/shopee?shopid=88201679`
      ],
      huong_dan_cookie: {
        khong_chon_mot_minh: "Đừng chỉ copy SPC_F. SPC_F chỉ là fingerprint máy, không phải phiên đăng nhập.",
        lay_script_de_dan_console: `${baseUrl}/api/mxh/shopee?action=script`,
        cach_nhanh: [
          "1. Mở link lay_script_de_dan_console (file JS thuần)",
          "2. Ctrl+A → Ctrl+C",
          "3. Vào shopee.vn (đã đăng nhập) → F12 → Console → Ctrl+V → Enter",
          "4. Nếu prompt hỏi cookie: F12 Network → F5 → click request shopee.vn → Copy as cURL hoặc copy Cookie header → dán vào prompt",
          "5. KHÔNG dán cookie lên URL (bị cắt, thiếu SPC_EC)"
        ],
        cookie_can_thiet: [
          "SPC_EC (quan trọng nhất — session đăng nhập, thường HttpOnly nên Console không đọc được)",
          "SPC_U (user id)",
          "SPC_SI (session id)",
          "csrftoken hoặc SPC_CDS",
          "SPC_F (kèm theo, không dùng một mình)"
        ],
        neu_thieu_SPC_EC: [
          "1. Vẫn ở shopee.vn, F12 → tab Network, bật Preserve log",
          "2. F5 reload trang",
          "3. Click 1 request tới shopee.vn (không phải CDN ảnh)",
          "4. Headers → Request Headers → Cookie → chuột phải Copy value",
          "5. Dán vào prompt của script"
        ]
      }
    });
  }

  const parsed = parseShopeeInput(rawInput);
  const site = SITES[siteRaw] ? siteRaw : detectSiteFromInput(rawInput);
  const curlRaw = searchParams.get("curl") || body.curl || "";
  const cookieRaw = searchParams.get("cookie") || searchParams.get("cookies") || body.cookie || body.cookies || "";
  const cookie = extractCookieFromCurl(curlRaw) || extractCookieFromCurl(cookieRaw) || cookieRaw || req.headers.cookie || "";

  if (!parsed.username && !parsed.shopid) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Username hoặc Shop ID Shopee không hợp lệ."
    });
  }

  try {
    const data = await lookupShopeeShop({ ...parsed, site, cookie });
    if (!data.ton_tai) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy tài khoản/shop Shopee: ${parsed.username || parsed.shopid}`,
        chi_tiet: data.loi || null
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Shopee Shop Lookup",
      du_lieu: data,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Không thể kết nối tới Shopee. Vui lòng thử lại sau.",
      chi_tiet: error.message
    });
  }
};
