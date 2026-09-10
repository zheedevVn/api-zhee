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

// Bóc tách trực tiếp theo DOM HTML chuẩn của Shopee Desktop
function extractFromShopeeHtmlDOM(html, queryUsername) {
  const source = String(html || "");

  // 1. Tên hiển thị shop (u4hbycykdf)
  let displayName = "";
  const nameMatch = source.match(/class=["'][^"']*section-seller-overview-horizontal__portrait-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (nameMatch && nameMatch[1]) {
    displayName = decodeHtml(nameMatch[1].trim());
  }

  // 2. Avatar ảnh đại diện (vn-11134233-81ztc-msdqdsrp8g0155)
  let avatarUrl = "";
  const avatarMatch = source.match(/<img[^>]+class=["'][^"']*shopee-avatar__img[^"']*["'][^>]+src=["']([^"']+)["']/i);
  if (avatarMatch && avatarMatch[1]) {
    avatarUrl = avatarMatch[1].trim();
  }

  // 3. Người theo dõi
  let followerCount = "0";
  const followerMatch = source.match(/Người theo dõi:[\s\S]*?class=["'][^"']*section-seller-overview__item-text-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                       source.match(/Follower:[\s\S]*?class=["'][^"']*section-seller-overview__item-text-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (followerMatch && followerMatch[1]) {
    followerCount = followerMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  // 4. Đang theo dõi
  let followingCount = "0";
  const followingMatch = source.match(/Đang Theo:[\s\S]*?class=["'][^"']*section-seller-overview__item-text-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                         source.match(/Following:[\s\S]*?class=["'][^"']*section-seller-overview__item-text-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (followingMatch && followingMatch[1]) {
    followingCount = followingMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  // 5. Đánh giá
  let ratingText = "0 Đánh giá";
  const ratingMatch = source.match(/đánh giá:[\s\S]*?class=["'][^"']*section-seller-overview__item-text-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                      source.match(/Rating:[\s\S]*?class=["'][^"']*section-seller-overview__item-text-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (ratingMatch && ratingMatch[1]) {
    ratingText = ratingMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  // 6. Thời gian tham gia
  let joinedText = "Chưa rõ";
  const joinedMatch = source.match(/tham gia:[\s\S]*?class=["'][^"']*section-seller-overview__item-text-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                      source.match(/Joined:[\s\S]*?class=["'][^"']*section-seller-overview__item-text-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (joinedMatch && joinedMatch[1]) {
    joinedText = joinedMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  // 7. Kiểm tra Mall
  const isMall = source.includes("shopee-avatar__official-badge") || source.includes("icon-mall-badge");

  if (!displayName && !avatarUrl) {
    return null;
  }

  return {
    username: queryUsername,
    ten_hien_thi: displayName || queryUsername,
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
        thong_bao: `Không tìm thấy tài khoản Shopee: ${queryTerm}`,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    const html = await response.text();
    const result = extractFromShopeeHtmlDOM(html, parsed.username || parsed.shopid);

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
