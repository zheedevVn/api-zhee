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

function formatUnix(ts) {
  if (!ts) return "Chưa cập nhật";
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "Chưa cập nhật";
  const ms = n > 1e12 ? n : n * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? "Chưa cập nhật" : date.toLocaleString("vi-VN");
}

function getAvatarUrl(imgBase, portrait) {
  if (!portrait) return "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_default_avatar.png";
  if (String(portrait).startsWith("http")) return portrait;
  return `${imgBase}/${portrait}`;
}

// Gọi API lấy Shop Base chuẩn
async function fetchShopBaseApi(host, username, shopid) {
  try {
    const qs = shopid ? `shopid=${encodeURIComponent(shopid)}` : `username=${encodeURIComponent(username)}`;
    const url = `https://${host}/api/v4/shop/get_shop_base?${qs}&entry_point=ShopByPDP`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "vi-VN,vi;q=0.9",
        "X-Shopee-Language": "vi",
        "X-Requested-With": "XMLHttpRequest",
        "X-API-SOURCE": "pc",
        "Referer": `https://${host}/`
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.data && (json.data.shopid || json.data.userid)) {
      return json.data;
    }
  } catch (_) {}
  return null;
}

// Bóc tách dữ liệu từ HTML, loại bỏ hoàn toàn Shop ID hệ thống (469064007)
function parseHtmlAccurately(html, username, shopid) {
  const source = String(html || "");

  // Tìm JSON-LD
  const ldMatches = [...source.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let ldData = null;
  for (const m of ldMatches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const item = Array.isArray(parsed) ? parsed[0] : parsed;
      // Bỏ qua nếu là Shopee Supermarket
      if (item && item.name && !item.name.toLowerCase().includes("siêu thị shopee") && !item.name.toLowerCase().includes("supermarket")) {
        ldData = item;
        break;
      }
    } catch (_) {}
  }

  // Quét shopid trong ngữ cảnh chứa chính username đó
  let resolvedShopId = shopid || 0;
  if (!resolvedShopId) {
    const contextRegex = new RegExp(`"userid":\\s*(\\d+)|"shopid":\\s*(\\d+)`, "gi");
    for (const match of source.matchAll(contextRegex)) {
      const id = parseInt(match[1] || match[2], 10);
      // Bỏ qua ID của Shopee Siêu Thị (469064007)
      if (id && id !== 469064007) {
        resolvedShopId = id;
        break;
      }
    }
  }

  // Lấy avatar thật
  let avatar = ldData?.image || ldData?.logo || "";
  if (!avatar) {
    const ogImg = source.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImg && ogImg[1] && !ogImg[1].includes("shopee-pcmall-live-sg")) {
      avatar = ogImg[1];
    }
  }

  // Lấy tên thật
  let tenShop = ldData?.name || "";
  if (!tenShop) {
    const ogTitle = source.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitle && ogTitle[1]) {
      const cleanTitle = ogTitle[1].replace(/\s*\|.*$/, "").replace(/\s*-.*$/, "").trim();
      if (!cleanTitle.toLowerCase().includes("shopee siêu thị") && !cleanTitle.toLowerCase().includes("mua sắm")) {
        tenShop = cleanTitle;
      }
    }
  }

  // Xác định chuẩn nhãn Mall (chỉ khi chính trang đó khai báo Store chính hãng)
  const isMall = source.includes('"is_official_shop":true') || source.includes('"show_official_shop_label":true');

  if (!resolvedShopId && !tenShop && !avatar) {
    return null;
  }

  return {
    shopid: resolvedShopId || 0,
    userid: resolvedShopId || 0,
    username: username || "Không rõ",
    ten_shop: tenShop || username || "Không rõ",
    avatar: avatar || "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_default_avatar.png",
    mo_ta: ldData?.description || "Tài khoản cá nhân / Chưa cập nhật mô tả",
    is_mall: isMall,
    is_seller: Boolean(resolvedShopId),
    follower_count: "Chưa cập nhật",
    rating_star: "Chưa có đánh giá",
    ctime: null
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const searchParams = requestUrl.searchParams;
  const firstParam = extractFirstParam(searchParams);
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};

  const siteRaw = (searchParams.get("site") || searchParams.get("region") || body.site || "vn").toLowerCase();
  const rawInput =
    searchParams.get("username") ||
    searchParams.get("user") ||
    searchParams.get("shop") ||
    searchParams.get("shopid") ||
    searchParams.get("q") ||
    body.username ||
    body.shopid ||
    firstParam;

  if (!rawInput) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Shopee Account & Shop Lookup",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: `${baseUrl}/api/mxh/shopee?={username_hoac_shopid}`,
      vi_du: [
        `${baseUrl}/api/mxh/shopee?=apple_flagship_store`,
        `${baseUrl}/api/mxh/shopee?=hoducminh2k9`
      ]
    });
  }

  const parsed = parseShopeeInput(rawInput);
  const cfg = SITES[siteRaw] || SITES.vn;
  const queryTerm = parsed.username || parsed.shopid;

  try {
    // 1. Thử gọi API get_shop_base trước
    let data = await fetchShopBaseApi(cfg.host, parsed.username, parsed.shopid);

    // 2. Nếu API không trả về, fallback sang HTML bóc tách chính xác
    if (!data) {
      const targetUrl = parsed.shopid 
        ? `https://${cfg.host}/shop/${encodeURIComponent(parsed.shopid)}` 
        : `https://${cfg.host}/${encodeURIComponent(parsed.username)}`;

      const htmlRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
          "Accept-Language": "vi-VN,vi;q=0.9",
          "Accept": "text/html,application/xhtml+xml"
        },
        signal: AbortSignal.timeout(6000)
      });

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        data = parseHtmlAccurately(html, parsed.username, parsed.shopid);
      }
    }

    // 3. Nếu vẫn không thấy, trả về trạng thái chuẩn là người mua hoặc không tồn tại
    if (!data) {
      return res.status(404).json({
        trang_thai: "that_bai",
        ma_loi: 404,
        thong_bao: `Không tìm thấy gian hàng của tài khoản: ${queryTerm}. Đây là tài khoản người mua hoặc chưa kích hoạt bán hàng trên Shopee.`,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    const isMall = Boolean(data.is_official_shop || data.show_official_shop_label || data.is_mall);
    const isSeller = Boolean(data.is_seller || (data.item_count && data.item_count > 0));
    const loaiTaiKhoan = isMall ? "Shop Mall chính hãng" : (isSeller ? "Người bán / Shop" : "Tài khoản cá nhân (Người mua)");
    const avatar = getAvatarUrl(cfg.img, data.portrait || data.avatar);
    const tenHienThi = data.name || data.ten_shop || parsed.username || "Không rõ";

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Shopee Account & Shop Lookup",
      du_lieu: {
        ton_tai: true,
        loai_tai_khoan: loaiTaiKhoan,
        site: siteRaw.toUpperCase(),
        shopid: data.shopid && data.shopid !== 469064007 ? data.shopid : 0,
        userid: data.userid && data.userid !== 469064007 ? data.userid : 0,
        username: parsed.username || data.username,
        ten_shop: tenHienThi,
        mo_ta: data.description || data.mo_ta || "Chưa cập nhật mô tả",
        avatar: avatar,
        link_shop: `https://${cfg.host}/${parsed.username || (data.shopid ? `shop/${data.shopid}` : "")}`,
        so_nguoi_theo_doi: data.follower_count ?? "Chưa cập nhật",
        diem_danh_gia: data.rating_star ? Number(Number(data.rating_star).toFixed(2)) : "Chưa có đánh giá",
        nhan_hieu: {
          mall_chinh_hang: isMall ? "CÓ" : "KHÔNG",
          la_nguoi_ban: isSeller ? "CÓ" : "KHÔNG"
        },
        ngay_tao: formatUnix(data.ctime)
      },
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Lỗi xử lý tra cứu Shopee: " + error.message,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }
};
