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

function decodeHtml(str) {
  return String(str || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

// Bóc tách siêu mạnh từ 160KB HTML của Shopee (JSON-LD + OpenGraph + Script State)
function extractDataFromShopeeHtml(html, defaultUsername, defaultShopId) {
  const source = String(html || "");
  let shopName = "";
  let avatar = "";
  let description = "";
  let shopid = defaultShopId || 0;
  let followerCount = "Chưa cập nhật";
  let ratingStar = "Chưa có đánh giá";
  let isMall = false;

  // 1. Quét từ Schema.org JSON-LD (Shopee luôn nhúng để Google Index SEO)
  const ldMatches = [...source.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ldMatches) {
    try {
      const json = JSON.parse(m[1].trim());
      const item = Array.isArray(json) ? json[0] : json;
      if (item && (item["@type"] === "Store" || item["@type"] === "Organization" || item.name)) {
        shopName = item.name || shopName;
        avatar = item.image || item.logo || avatar;
        description = item.description || description;
      }
    } catch (_) {}
  }

  // 2. Quét từ thẻ OpenGraph Meta Tags
  if (!shopName) {
    const ogTitle = source.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitle && ogTitle[1]) {
      shopName = decodeHtml(ogTitle[1].replace(/\s*\|.*$/, "").replace(/\s*-.*$/, "").trim());
    }
  }

  if (!avatar) {
    const ogImage = source.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImage && ogImage[1]) {
      avatar = ogImage[1].trim();
    }
  }

  if (!description) {
    const ogDesc = source.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                   source.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (ogDesc && ogDesc[1]) {
      description = decodeHtml(ogDesc[1].trim());
    }
  }

  // 3. Quét Shop ID từ các tham số nhúng trong HTML
  const shopIdMatch = source.match(/["']shopid["']\s*:\s*(\d{4,})/i) ||
                      source.match(/\/shop\/(\d{4,})/i) ||
                      source.match(/shop_id=(\d{4,})/i);
  if (shopIdMatch && shopIdMatch[1]) {
    shopid = parseInt(shopIdMatch[1], 10);
  }

  // 4. Kiểm tra nhãn Mall chính hãng
  if (source.includes("official_shop") || source.includes("mall") || source.includes("Official Store") || source.toLowerCase().includes("flagship")) {
    isMall = true;
  }

  // 5. Quét follower nếu có
  const followerMatch = source.match(/["']follower_count["']\s*:\s*(\d+)/i);
  if (followerMatch && followerMatch[1]) {
    followerCount = parseInt(followerMatch[1], 10);
  }

  const ratingMatch = source.match(/["']rating_star["']\s*:\s*([\d.]+)/i);
  if (ratingMatch && ratingMatch[1]) {
    ratingStar = parseFloat(ratingMatch[1]).toFixed(1);
  }

  if (!shopName && !shopid && !avatar) {
    return null;
  }

  return {
    shopid: shopid || 0,
    username: defaultUsername || `shop_${shopid}`,
    ten_shop: shopName || defaultUsername || "Không rõ",
    avatar: avatar || "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_default_avatar.png",
    mo_ta: description || "Chưa cập nhật mô tả",
    is_mall: isMall,
    follower_count: followerCount,
    rating_star: ratingStar
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
        `${baseUrl}/api/mxh/shopee?=88201679`
      ]
    });
  }

  const parsed = parseShopeeInput(rawInput);
  const cfg = SITES[siteRaw] || SITES.vn;
  const queryTerm = parsed.username || parsed.shopid;

  try {
    // Gọi tải trang công khai bằng Header trình duyệt chuẩn
    const targetUrl = parsed.shopid 
      ? `https://${cfg.host}/shop/${encodeURIComponent(parsed.shopid)}` 
      : `https://${cfg.host}/${encodeURIComponent(parsed.username)}`;

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"'
      },
      redirect: "follow",
      signal: AbortSignal.timeout(9000)
    });

    const html = await response.text();
    const shopData = extractDataFromShopeeHtml(html, parsed.username, parsed.shopid);

    if (!shopData) {
      return res.status(404).json({
        trang_thai: "that_bai",
        ma_loi: 404,
        thong_bao: `Không tìm thấy thông tin công khai của Shop: ${queryTerm}`,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Shopee Account & Shop Lookup",
      du_lieu: {
        ton_tai: true,
        loai_tai_khoan: shopData.is_mall ? "Shop Mall chính hãng (Official Store)" : "Shop / Người bán",
        site: siteRaw.toUpperCase(),
        shopid: shopData.shopid,
        username: shopData.username,
        ten_shop: shopData.ten_shop,
        mo_ta: shopData.mo_ta,
        avatar: shopData.avatar,
        link_shop: targetUrl,
        so_nguoi_theo_doi: shopData.follower_count,
        diem_danh_gia: shopData.rating_star,
        nhan_hieu: {
          mall_chinh_hang: shopData.is_mall ? "CÓ" : "KHÔNG"
        }
      },
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Lỗi kết nối máy chủ Shopee: " + error.message,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }
};
