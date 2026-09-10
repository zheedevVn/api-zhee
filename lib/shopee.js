const crypto = require("crypto");

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

// 1. Handshake sinh bộ Header giả lập trình duyệt hợp lệ
function generateShopeeHeaders(host) {
  const fakeFp = crypto.randomBytes(16).toString("hex");
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": `https://${host}/`,
    "Origin": `https://${host}`,
    "X-Shopee-Language": "vi",
    "X-Requested-With": "XMLHttpRequest",
    "X-Api-Source": "pc",
    "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Cookie": `SPC_F=${fakeFp}; _gcl_au=1.1.${Date.now()}; REC_T_ID=${crypto.randomUUID()};`
  };
}

// 2. Tra cứu qua User Search API (Bypass WAF 90309999 thành công)
async function searchShopeeUser(host, keyword) {
  try {
    const endpoint = `https://${host}/api/v4/search/search_user?keyword=${encodeURIComponent(keyword)}&page=0&page_size=5`;
    const res = await fetch(endpoint, {
      headers: generateShopeeHeaders(host),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.data && Array.isArray(json.data.users) && json.data.users.length > 0) {
      // Tìm chính xác user khớp username hoặc shopid
      const targetUser = json.data.users.find(
        (u) => String(u.username).toLowerCase() === String(keyword).toLowerCase() || String(u.shopid) === String(keyword)
      ) || json.data.users[0];

      return targetUser;
    }
  } catch (_) {}
  return null;
}

// 3. Fallback bóc tách SSR State từ HTML khi tải trang
function parseShopeeDOM(html, queryTerm) {
  const src = String(html || "");

  // Bóc tách tên hiển thị
  let name = "";
  const nameMatch = src.match(/class=["'][^"']*section-seller-overview-horizontal__portrait-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                    src.match(/class=["'][^"']*portrait-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  // Bóc tách avatar
  let avatar = "";
  const avatarMatch = src.match(/class=["'][^"']*shopee-avatar__img[^"']*["'][^>]+src=["']([^"']+)["']/i) ||
                      src.match(/https:\/\/img\.ws\.mms\.shopee\.vn\/[a-zA-Z0-9_-]+/i);
  if (avatarMatch) {
    avatar = avatarMatch[1] || avatarMatch[0];
  }

  // Bóc tách chỉ số
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

  let joined = "Chưa rõ";
  const joinedMatch = src.match(/(?:tham gia|Joined)[\s\S]*?class=["'][^"']*item-text-value[^"']*["']>([\s\S]*?)<\/div>/i);
  if (joinedMatch && joinedMatch[1]) {
    joined = joinedMatch[1].replace(/<!--[\s\S]*?-->/g, "").trim();
  }

  const isMall = src.includes("official-badge") || src.includes("official_shop");

  if (!name && !avatar) return null;

  return {
    shopid: 0,
    userid: 0,
    username: queryTerm,
    ten_hien_thi: name || queryTerm,
    avatar: avatar || "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_default_avatar.png",
    so_nguoi_theo_doi: followers,
    dang_theo_doi: following,
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
  const cfg = SITES.vn;
  const queryTerm = parsed.username || parsed.shopid;

  try {
    // 1. Thử Search API (Bypass WAF 90309999 trên Vercel)
    let userData = await searchShopeeUser(cfg.host, queryTerm);

    // 2. Nếu API không thấy, fallback tải HTML SSR
    if (!userData) {
      const targetUrl = parsed.shopid 
        ? `https://${cfg.host}/shop/${encodeURIComponent(parsed.shopid)}` 
        : `https://${cfg.host}/${encodeURIComponent(parsed.username)}`;

      const htmlRes = await fetch(targetUrl, {
        headers: generateShopeeHeaders(cfg.host),
        signal: AbortSignal.timeout(8000)
      });

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const domResult = parseShopeeDOM(html, queryTerm);
        if (domResult) {
          return res.status(200).json({
            trang_thai: "thanh_cong",
            chuyen_muc: "Shopee Account & Shop Lookup",
            nguon_du_lieu: "Shopee HTML SSR Engine",
            du_lieu: {
              ton_tai: true,
              loai_tai_khoan: domResult.is_mall ? "Shop Mall chính hãng" : "Tài khoản cá nhân / Shop",
              site: "VN",
              username: domResult.username,
              ten_hien_thi: domResult.ten_hien_thi,
              avatar: domResult.avatar,
              link_trang: targetUrl,
              so_nguoi_theo_doi: domResult.so_nguoi_theo_doi,
              dang_theo_doi: domResult.dang_theo_doi,
              thoi_gian_tham_gia: domResult.thoi_gian_tham_gia,
              nhan_hieu: {
                mall_chinh_hang: domResult.is_mall ? "CÓ" : "KHÔNG"
              }
            },
            tac_gia: "Hồ Đức Minh (Zhee Dev)"
          });
        }
      }
    }

    // 3. Nếu tìm thấy qua User API
    if (userData) {
      const isMall = Boolean(userData.is_official_shop || userData.is_shopee_verified);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "Shopee Account & Shop Lookup",
        nguon_du_lieu: "Shopee Verified API",
        du_lieu: {
          ton_tai: true,
          loai_tai_khoan: isMall ? "Shop Mall chính hãng" : "Tài khoản cá nhân / Shop",
          site: "VN",
          shopid: userData.shopid || 0,
          userid: userData.userid || 0,
          username: userData.username || queryTerm,
          ten_hien_thi: userData.shopname || userData.username || queryTerm,
          avatar: getAvatarUrl(cfg.img, userData.portrait),
          link_trang: `https://${cfg.host}/${userData.username || queryTerm}`,
          so_nguoi_theo_doi: userData.follower_count ?? "Chưa cập nhật",
          so_san_pham: userData.item_count ?? "Chưa cập nhật",
          diem_danh_gia: userData.rating_star ? Number(Number(userData.rating_star).toFixed(2)) : "Chưa có đánh giá",
          nhan_hieu: {
            mall_chinh_hang: isMall ? "CÓ" : "KHÔNG"
          }
        },
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    return res.status(404).json({
      trang_thai: "that_bai",
      ma_loi: 404,
      thong_bao: `Không tìm thấy tài khoản hoặc Shopee đã giới hạn lượt tra cứu cho: ${queryTerm}`,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Lỗi xử lý hệ thống: " + error.message,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }
};
