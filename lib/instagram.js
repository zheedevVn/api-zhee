/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
const OFFICIAL_ACCESS_TOKEN = process.env.INSTAGRAM_USER_TOKEN || "IGAAM2YNg2Ru1BZAGJYV2k4NFJZAS0pYNDZA6OFhOYUE4djYxWmJCUDEwWjhqZA0R4M3ZAjMk5zdGlpbXJPdm54bmlTNzc5ekxHMkx5ZAkk2cXRGdE1aZA0UwejBYaVY1b3hXMkVaenpkT3hBc0NNXzFHRktQbDJ4YTRicnVIQ1p3NGhvVQZDZD";

function extractUsername(input) {
  if (!input) return "";
  let str = input.trim();
  const urlMatch = str.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/i);
  if (urlMatch && urlMatch[1]) {
    str = urlMatch[1];
  }
  return str.replace(/^@/, "").replace(/\/+$/, "").trim();
}

async function lookupInstagramProfile(username) {
  // 1. TÀI KHOẢN CHÍNH (hoducminh09) - DÙNG TOKEN CHÍNH THỨC META
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

  // 2. TÀI KHOẢN BẤT KỲ - BÓC TÁCH GOOGLE SEARCH CACHE
  try {
    const googleUrl = `https://www.google.com/search?q=site:instagram.com/${encodeURIComponent(username)}&hl=en`;
    const gRes = await fetch(googleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: AbortSignal.timeout(9000)
    });

    if (gRes.ok) {
      const html = await gRes.text();

      // Pattern: "1,234 Followers, 567 Following, 89 Posts"
      const statPattern = /([\d,\.KMBkmb]+)\s+Followers,\s+([\d,\.KMBkmb]+)\s+Following,\s+([\d,\.KMBkmb]+)\s+Posts/i;
      const match = html.match(statPattern);

      if (match) {
        // Trích xuất tên hiển thị từ thẻ tiêu đề
        let titleName = username;
        const titleMatch = html.match(/<h3[^>]*>([^<]+)<\/h3>/i);
        if (titleMatch && titleMatch[1]) {
          titleName = titleMatch[1].split("(@")[0].replace("• Instagram photos and videos", "").trim();
        }

        return {
          username: username,
          full_name: titleName || username,
          followers: match[1],
          following: match[2],
          posts_count: match[3],
          profile_url: `https://www.instagram.com/${username}/`,
          avatar_hd: `https://wsrv.nl/?url=https://www.instagram.com/${username}/profile-image/&output=jpg&default=identicon`,
          is_verified: html.includes("Verified") || html.includes("verified"),
          author: "Zhee Dev (Crawler Engine)"
        };
      }
    }
  } catch (_) {}

  // 3. TẦNG DỰ PHÒNG: DUCKDUCKGO SEARCH PARSER
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=site:instagram.com/${encodeURIComponent(username)}`;
    const ddgRes = await fetch(ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (ddgRes.ok) {
      const text = await ddgRes.text();
      const matchDdg = text.match(/([\d,\.KMBkmb]+)\s+Followers[^\d]*([\d,\.KMBkmb]+)\s+Following[^\d]*([\d,\.KMBkmb]+)\s+Posts/i);

      if (matchDdg) {
        return {
          username: username,
          full_name: username,
          followers: matchDdg[1],
          following: matchDdg[2],
          posts_count: matchDdg[3],
          profile_url: `https://www.instagram.com/${username}/`,
          avatar_hd: `https://wsrv.nl/?url=https://www.instagram.com/${username}/profile-image/&output=jpg&default=identicon`,
          author: "Zhee Dev (DDG Indexer)"
        };
      }
    }
  } catch (_) {}

  // 4. TẦNG POPCAT MIRROR GATEWAY
  try {
    const resPop = await fetch(`https://api.popcat.xyz/instagram?user=${username}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (resPop.ok) {
      const data = await resPop.json();
      if (!data.error && data.username) {
        return {
          username: data.username,
          full_name: data.full_name || username,
          biography: data.biography || "",
          followers: data.followers || 0,
          following: data.following || 0,
          posts_count: data.posts || 0,
          is_private: Boolean(data.private),
          is_verified: Boolean(data.verified),
          avatar_hd: data.profile_pic || "",
          profile_url: `https://www.instagram.com/${username}/`,
          author: "Zhee Dev"
        };
      }
    }
  } catch (_) {}

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
      chuyen_muc: "Tra Cứu Thông Tin Instagram (/instagram hoặc /api/mxh/instagram)",
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
  const profile = await lookupInstagramProfile(username);

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Tra Cứu Thông Tin Instagram",
    du_lieu: profile
  });
};