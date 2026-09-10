const SITES = {
  vn: { host: "shopee.vn" },
  th: { host: "shopee.co.th" },
  id: { host: "shopee.co.id" },
  sg: { host: "shopee.sg" },
  my: { host: "shopee.com.my" },
  ph: { host: "shopee.ph" },
  tw: { host: "shopee.tw" }
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

// Bộ giải mã bóc tách đa tầng: Cá nhân, Shop Thường, Shop Mall
function extractShopeeUniversal(html, defaultQuery) {
  const src = String(html || "");

  // --- 1. TÊN SHOP / TÊN HIỂN THỊ ---
  let name = "";

  // Kiểu 1: Giao diện cá nhân/người bán (DOM H1)
  const h1Match = src.match(/class=["'][^"']*portrait-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                  src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    const cleanH1 = decodeHtml(h1Match[1]).replace(/<!--[\s\S]*?-->/g, "").trim();
    if (cleanH1 && !cleanH1.toLowerCase().includes("shopee")) {
      name = cleanH1;
    }
  }

  // Kiểu 2: OpenGraph Title (Cho các Shop Mall / Official Store)
  if (!name) {
    const ogTitle = src.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitle && ogTitle[1]) {
      const cleanOg = decodeHtml(ogTitle[1])
        .replace(/\s*\|\s*Shopee.*$/i, "")
        .replace(/\s*-\s*Shopee.*$/i, "")
        .replace(/,\s*Cửa hàng trực tuyến.*$/i, "")
        .replace(/,\s*Online Store.*$/i, "")
        .trim();
      if (cleanOg && !cleanOg.toLowerCase().includes("hot deals")) {
        name = cleanOg;
      }
    }
  }

  // Kiểu 3: Title trang
  if (!name) {
    const titleMatch = src.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const cleanTitle = decodeHtml(titleMatch[1])
        .replace(/\s*\|\s*Shopee.*$/i, "")
        .replace(/\s*-\s*Shopee.*$/i, "")
        .replace(/,\s*Cửa hàng trực tuyến.*$/i, "")
        .trim();
      if (cleanTitle && !cleanTitle.toLowerCase().includes("hot deals")) {
        name = cleanTitle;
      }
    }
  }

  // Fallback: Lấy username làm tên nếu trang tồn tại
  if (!name) {
    name = defaultQuery;
  }

  // --- 2. AVATAR ---
  let avatar = "";

  // Thẻ img avatar trực tiếp
  const avatarImg = src.match(/class=["'][^"']*shopee-avatar__img[^"']*["'][^>]+src=["']([^"']+)["']/i) ||
                    src.match(/src=["']([^"']+)["'][^>]+class=["'][^"']*shopee-avatar__img[^"']*["']/i);
  if (avatarImg && avatarImg[1]) {
    avatar = avatarImg[1].trim();
  }

  // Fallback OpenGraph Image
  if (!avatar) {
    const ogImg = src.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImg && ogImg[1] && !ogImg[1].includes("icon_favicon")) {
      avatar = ogImg[1].trim();
    }
  }

  // Fallback URL MMS ảnh của Shopee trong mã nguồn
  if (!avatar) {
    const mmsImg = src.match(/https:\/\/img\.ws\.mms\.shopee\.vn\/[a-zA-Z0-9_-]+/i) ||
                   src.match(/https:\/\/down-vn\.img\.susercontent\.com\/file\/[a-zA-Z0-9_-]+/i);
    if (mmsImg) {
      avatar = mmsImg[0];
    }
  }

  if (!avatar) {
    avatar = "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_default_avatar.png";
  }

  // --- 3. CÁC CHỈ SỐ: FOLLOWER, FOLLOWING, RATING, JOINED ---
  let followers = "0";
  const followerMatch = src.match(/(?:Người theo dõi|Follower)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([\s\S]*?)<\/div>/i);
  if (followerMatch && followerMatch[1]) {
    followers = followerMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  let following = "0";
  const followingMatch = src.match(/(?:Đang Theo|Following)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([\s\S]*?)<\/div>/i);
  if (followingMatch && followingMatch[1]) {
    following = followingMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  let rating = "0 Đánh giá";
  const ratingMatch = src.match(/(?:đánh giá|Rating)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([\s\S]*?)<\/div>/i);
  if (ratingMatch && ratingMatch[1]) {
    rating = ratingMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  let joined = "Chưa rõ";
  const joinedMatch = src.match(/(?:tham gia|Joined)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([\s\S]*?)<\/div>/i);
  if (joinedMatch && joinedMatch[1]) {
    joined = joinedMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  // --- 4. NHẬN DIỆN MALL ---
  const isMall = src.includes("shopee-avatar__official-badge") ||
                 src.includes("official_shop") ||
                 src.toLowerCase().includes("official store") ||
                 src.toLowerCase().includes("flagship");

  return {
    ten_hien_thi: name,
    avatar: avatar,
    so_nguoi_theo_doi: followers,
    dang_theo_doi: following,
    danh_gia: rating,
    thoi_gian_tham_gia: joined,
    is_mall: isMall
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
        `${baseUrl}/api/mxh/shopee?=hoducminh2k9`,
        `${baseUrl}/api/mxh/shopee?=apple_flagship_store`
      ]
    });
  }

  const parsed = parseShopeeInput(rawInput);
  const queryTerm = parsed.username || parsed.shopid;

  try {
    const targetUrl = parsed.shopid 
      ? `https://shopee.vn/shop/${encodeURIComponent(parsed.shopid)}` 
      : `https://shopee.vn/${encodeURIComponent(parsed.username)}`;

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
        "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"'
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      return res.status(404).json({
        trang_thai: "that_bai",
        ma_loi: response.status,
        thong_bao: `Không thể tải trang Shopee của tài khoản: ${queryTerm}`,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    const html = await response.text();
    const result = extractShopeeUniversal(html, queryTerm);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Shopee Account & Shop Lookup",
      du_lieu: {
        ton_tai: true,
        loai_tai_khoan: result.is_mall ? "Shop Mall chính hãng" : "Tài khoản cá nhân / Shop",
        site: "VN",
        username: queryTerm,
        ten_hien_thi: result.ten_hien_thi,
        avatar: result.avatar,
        link_trang: targetUrl,
        so_nguoi_theo_doi: result.so_nguoi_theo_doi,
        dang_theo_doi: result.dang_theo_doi,
        danh_gia: result.danh_gia,
        thoi_gian_tham_gia: result.thoi_gian_tham_gia,
        nhan_hieu: {
          mall_chinh_hang: result.is_mall ? "CÓ" : "KHÔNG"
        }
      },
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Lỗi kết nối tới Shopee: " + error.message,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }
};
