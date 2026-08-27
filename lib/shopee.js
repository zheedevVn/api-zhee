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

async function shopeeGet(host, path, referer) {
  const res = await fetch(`https://${host}${path}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      Referer: referer,
      Origin: `https://${host}`,
      "X-API-SOURCE": "pc",
      "X-Requested-With": "XMLHttpRequest"
    },
    signal: AbortSignal.timeout(10000)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { ok: res.ok, status: res.status, json, text };
}

async function lookupShopeeShop({ username, shopid, site }) {
  const cfg = SITES[site] || SITES.vn;
  const qs = shopid
    ? `shopid=${encodeURIComponent(shopid)}`
    : `username=${encodeURIComponent(username)}`;
  const referer = shopid
    ? `https://${cfg.host}/shop/${shopid}`
    : `https://${cfg.host}/${encodeURIComponent(username)}`;

  const [baseRes, detailRes] = await Promise.all([
    shopeeGet(cfg.host, `/api/v4/shop/get_shop_base?${qs}&entry_point=&need_cancel_rate=true&request_source=shop_home_page&version=1`, referer),
    shopeeGet(cfg.host, `/api/v4/shop/get_shop_detail?${qs}`, referer)
  ]);

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

  return {
    ton_tai: true,
    loai_tai_khoan: loai,
    site: site.toUpperCase(),
    userid: data.userid || 0,
    shopid: data.shopid || 0,
    username: uname || "Không rõ",
    ten_hien_thi: isSeller ? (data.name || uname) : uname,
    ten_shop: isSeller ? (data.name || uname) : "Chưa mở gian hàng",
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
    ngay_tao: formatUnix(data.ctime) || "Không rõ"
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const searchParams = requestUrl.searchParams;
  const firstParam = extractFirstParam(searchParams);

  const siteRaw = (searchParams.get("site") || searchParams.get("region") || "").toLowerCase();
  const rawInput =
    searchParams.get("username") ||
    searchParams.get("user") ||
    searchParams.get("shop") ||
    searchParams.get("shopid") ||
    searchParams.get("id") ||
    searchParams.get("q") ||
    firstParam;

  if (!rawInput) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Shopee Shop / Account Lookup",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      mo_ta: "Tra cứu gian hàng Shopee theo username, shopid hoặc link shop. Mặc định Shopee Việt Nam.",
      cu_phap: [
        `${baseUrl}/api/mxh/shopee?={username}`,
        `${baseUrl}/api/mxh/shopee?username={username}`,
        `${baseUrl}/api/mxh/shopee?shopid={shop_id}`,
        `${baseUrl}/api/mxh/shopee?={link_shop}&site=vn`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/shopee?=apple_flagship_store`,
        `${baseUrl}/api/mxh/shopee?shopid=88201679`,
        `${baseUrl}/api/mxh/shopee?=https://shopee.vn/apple_flagship_store`
      ]
    });
  }

  const parsed = parseShopeeInput(rawInput);
  const site = SITES[siteRaw] ? siteRaw : detectSiteFromInput(rawInput);

  if (!parsed.username && !parsed.shopid) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Username hoặc Shop ID Shopee không hợp lệ."
    });
  }

  try {
    const data = await lookupShopeeShop({ ...parsed, site });
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
