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

async function lookupInstagramAnyUser(username) {
  // 1. Trường hợp chính tài khoản cấp Token (hoducminh09 / me)
  if (username.toLowerCase() === "hoducminh09" || username === "me") {
    try {
      const res = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username,name,account_type,media_count,profile_picture_url&access_token=${OFFICIAL_ACCESS_TOKEN}`, {
        signal: AbortSignal.timeout(8000)
      });
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
          avatar_hd: data.profile_picture_url || "",
          is_verified: false,
          author: "Zhee Dev (Official Meta API)"
        };
      }
    } catch (_) {}
  }

  // 2. Tra cứu bất kỳ tài khoản nào qua DuckDuckGo Open Search Metadata Gateway
  try {
    const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=site:instagram.com/${encodeURIComponent(username)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (ddgRes.ok) {
      const html = await ddgRes.text();
      const snippetMatch = html.match(/class="result__snippet"[^>]*>(.*?)<\/a>/i);
      
      if (snippetMatch && snippetMatch[1]) {
        const snippet = snippetMatch[1].replace(/<[^>]+>/g, "").trim();
        const followers = snippet.match(/([\d,\.KMBkmb]+)\s+Followers/i)?.[1] || "N/A";
        const following = snippet.match(/([\d,\.KMBkmb]+)\s+Following/i)?.[1] || "N/A";
        const posts = snippet.match(/([\d,\.KMBkmb]+)\s+Posts/i)?.[1] || "N/A";

        return {
          username: username,
          full_name: username,
          followers: followers,
          following: following,
          posts_count: posts,
          bio_snippet: snippet,
          profile_url: `https://www.instagram.com/${username}/`,
          avatar_hd: `https://wsrv.nl/?url=https://instagram.com/${username}/profile-image&default=identicon`,
          author: "Zhee Dev (Global Crawler)"
        };
      }
    }
  } catch (_) {}

  // 3. Fallback qua Proxy Mirror API
  try {
    const mirrorRes = await fetch(`https://api.siputzx.my.id/api/s/instagram?username=${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(9000)
    });
    if (mirrorRes.ok) {
      const mirrorData = await mirrorRes.json();
      const user = mirrorData.data || mirrorData.result;
      if (user) {
        return {
          id: user.id || null,
          username: user.username || username,
          full_name: user.full_name || user.name || username,
          biography: user.biography || user.bio || "",
          followers: user.followers || user.edge_followed_by?.count || 0,
          following: user.following || user.edge_follow?.count || 0,
          posts_count: user.posts || user.edge_owner_to_timeline_media?.count || 0,
          is_private: Boolean(user.is_private || user.private),
          is_verified: Boolean(user.is_verified || user.verified),
          avatar_hd: user.profile_pic_url_hd || user.profile_pic_url || user.avatar || "",
          author: "Zhee Dev"
        };
      }
    }
  } catch (_) {}

  // 4. Định dạng trả về cơ bản nếu bị rate limit
  return {
    username: username,
    full_name: username,
    profile_url: `https://www.instagram.com/${username}/`,
    trang_thai: "Tài khoản đang hoạt động",
    author: "Zhee Dev"
  };
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
        `${baseUrl}/api/mxh/instagram?={username}`,
        `${baseUrl}/instagram?username={username}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/instagram?=hoducminh09`,
        `${baseUrl}/api/mxh/instagram?=23o5studio`
      ]
    });
  }

  const username = extractUsername(rawInput);
  const profile = await lookupInstagramAnyUser(username);

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Tra Cứu Thông Tin Instagram",
    du_lieu: profile
  });
};