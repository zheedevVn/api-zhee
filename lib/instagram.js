const OFFICIAL_ACCESS_TOKEN = process.env.INSTAGRAM_USER_TOKEN || "IGAAM2YNg2Ru1BZAGJYV2k4NFJZAS0pYNDZA6OFhOYUE4djYxWmJCUDEwWjhqZA0R4M3ZAjMk5zdGlpbXJPdm54bmlTNzc5ekxHMkx5ZAkk2cXRGdE1aZA0UwejBYaVY1b3hXMkVaenpkT3hBc0NNXzFHRktQbDJ4YTRicnVIQ1p3NGhvVQZDZD";
const BUSINESS_ACCOUNT_ID = "17841470101767080";

function extractUsername(input) {
  if (!input) return "";
  let str = input.trim();
  const urlMatch = str.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/i);
  if (urlMatch && urlMatch[1]) {
    str = urlMatch[1];
  }
  return str.replace(/^@/, "").replace(/\/+$/, "").trim();
}

async function fetchInstagramViaOfficialGraph(username) {
  const token = OFFICIAL_ACCESS_TOKEN;

  // 1. Trường hợp 1: Tra cứu chính tài khoản sở hữu Token (hoducminh09)
  if (username.toLowerCase() === "hoducminh09" || username === BUSINESS_ACCOUNT_ID || username === "me") {
    try {
      const url = `https://graph.instagram.com/v21.0/me?fields=id,username,name,account_type,media_count,profile_picture_url&access_token=${token}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();

      if (data && data.username) {
        return {
          id: data.id,
          username: data.username,
          full_name: data.name || "Duc Minhh",
          followers: 1225,
          following: 0,
          posts_count: data.media_count || 0,
          account_type: data.account_type || "CREATOR / BUSINESS",
          avatar_hd: data.profile_picture_url || "https://scontent.cdninstagram.com/...",
          is_verified: false,
          author: "Zhee Dev (Official Meta API)"
        };
      }
    } catch (_) {}
  }

  // 2. Trường hợp 2: Tra cứu tài khoản bất kỳ qua Meta Business Discovery API
  try {
    const fields = `business_discovery.username(${username}){username,name,ig_id,id,profile_picture_url,biography,follows_count,followers_count,media_count,website}`;
    const url = `https://graph.facebook.com/v21.0/${BUSINESS_ACCOUNT_ID}?fields=${encodeURIComponent(fields)}&access_token=${token}`;
    
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const data = await res.json();

    if (data?.business_discovery) {
      const user = data.business_discovery;
      return {
        id: user.id || user.ig_id,
        username: user.username,
        full_name: user.name || user.username,
        biography: user.biography || "",
        followers: user.followers_count ?? 0,
        following: user.follows_count ?? 0,
        posts_count: user.media_count ?? 0,
        avatar_hd: user.profile_picture_url || "",
        website: user.website || null,
        author: "Zhee Dev (Meta Graph API)"
      };
    }
  } catch (_) {}

  // 3. Trường hợp 3: Fallback qua API Scraper mở nếu tài khoản là cá nhân chưa convert business
  try {
    const resPop = await fetch(`https://api.popcat.xyz/instagram?user=${username}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (resPop.ok) {
      const data = await resPop.json();
      if (!data.error && data.username) {
        return {
          username: data.username,
          full_name: data.full_name || "",
          biography: data.biography || "",
          followers: data.followers || 0,
          following: data.following || 0,
          posts_count: data.posts || 0,
          is_private: Boolean(data.private),
          is_verified: Boolean(data.verified),
          avatar_hd: data.profile_pic || "",
          author: "Zhee Dev"
        };
      }
    }
  } catch (_) {}

  return null;
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const searchParams = requestUrl.searchParams;

  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) {
      firstParam = value.trim();
      break;
    }
    if (key && !value) {
      firstParam = key.replace(/^=/, "").trim();
      break;
    }
  }

  const rawInput =
    searchParams.get("username") ||
    searchParams.get("user") ||
    searchParams.get("url") ||
    searchParams.get("u") ||
    firstParam;

  if (!rawInput) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Tra Cứu Thông Tin Instagram (/instagram)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/mxh/instagram?={username_hoac_link}`,
        `${baseUrl}/instagram?username={username}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/instagram?=hoducminh09`,
        `${baseUrl}/api/mxh/instagram?=https://www.instagram.com/hoducminh09/`
      ]
    });
  }

  const username = extractUsername(rawInput);
  const profile = await fetchInstagramViaOfficialGraph(username);

  if (!profile) {
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy thông tin cho tài khoản Instagram: ${username}`
    });
  }

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Tra Cứu Thông Tin Instagram (Official Meta Graph)",
    du_lieu: profile
  });
};