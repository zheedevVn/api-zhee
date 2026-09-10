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

// Bóc tách siêu chuẩn trực tiếp từ HTML Shopee
function extractShopeeHtml(html, defaultUsername) {
  const src = String(html || "");

  // 1. Tên hiển thị shop
  let displayName = "";
  const nameMatch = src.match(/class=["'][^"']*portrait-name[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
                    src.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (nameMatch && nameMatch[1]) {
    displayName = decodeHtml(nameMatch[1].trim());
  }

  // 2. Avatar
  let avatarUrl = "";
  const avatarMatch = src.match(/class=["'][^"']*shopee-avatar__img[^"']*["'][^>]+src=["']([^"']+)["']/i) ||
                      src.match(/src=["']([^"']+)["'][^>]+class=["'][^"']*shopee-avatar__img[^"']*["']/i) ||
                      src.match(/https:\/\/img\.ws\.mms\.shopee\.vn\/[a-zA-Z0-9_-]+/i);
  if (avatarMatch) {
    avatarUrl = avatarMatch[1] || avatarMatch[0];
  }

  // 3. Người theo dõi (Followers)
  let followerCount = "0";
  const followerMatch = src.match(/(?:Người theo dõi|Follower)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([^<]+)<\/div>/i);
  if (followerMatch && followerMatch[1]) {
    followerCount = followerMatch[1].trim();
  }

  // 4. Đang theo dõi (Following)
  let followingCount = "0";
  const followingMatch = src.match(/(?:Đang Theo|Following)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([^<]+)<\/div>/i);
  if (followingMatch && followingMatch[1]) {
    followingCount = followingMatch[1].trim();
  }

  // 5. Đánh giá (Ratings)
  let ratingText = "0 Đánh giá";
  const ratingMatch = src.match(/(?:đánh giá|Rating)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([^<]+)<\/div>/i);
  if (ratingMatch && ratingMatch[1]) {
    ratingText = ratingMatch[1].trim();
  }

  // 6. Tham gia (Joined)
  let joinedText = "Chưa rõ";
  const joinedMatch = src.match(/(?:tham gia|Joined)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([^<]+)<\/div>/i);
  if (joinedMatch && joinedMatch[1]) {
    joinedText = joinedMatch[1].trim();
  }

  // 7. Nhãn Mall
  const isMall = src.includes("official-badge") || src.includes("official_shop");

  if (!displayName && !avatarUrl) {
    return null;
  }

  return {
    username: defaultUsername,
    ten_hien_thi: displayName || defaultUsername,
    avatar: avatarUrl || "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_default_avatar.png",
    so_nguoi_theo_doi: followerCount,
    dang_theo_doi: followingCount,
    danh_gia: ratingText,
    thoi_gian_tham_gia: joinedText,
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
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000)
    });

    const html = await response.text();
    const result = extractShopeeHtml(html, queryTerm);

    if (!result) {
      return res.status(404).json({
        trang_thai: "that_bai",
        ma_loi: 404,
        thong_bao: `Không tìm thấy thông tin hiển thị của tài khoản: ${queryTerm}`,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Shopee Account & Shop Lookup",
      du_lieu: {
        ton_tai: true,
        loai_tai_khoan: result.is_mall ? "Shop Mall chính hãng" : "Tài khoản cá nhân / Shop",
        site: "VN",
        username: result.username,
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
