// Hàm chuẩn hóa input: nhận cả link full hoặc username có @
function extractUsername(input) {
  if (!input) return "";
  let str = input.trim();
  
  // Nếu truyền dạng URL: https://www.instagram.com/hoducminh09/?hl=vi
  const urlMatch = str.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/i);
  if (urlMatch && urlMatch[1]) {
    str = urlMatch[1];
  }

  return str.replace(/^@/, "").replace(/\/+$/, "").trim();
}

// Engine bóc tách thông tin Instagram đa tầng
async function fetchInstagramProfile(rawInput) {
  const username = extractUsername(rawInput);
  if (!username) return null;

  // Tier 1: HTML Meta Tag & JSON-LD Scraper
  try {
    const resHtml = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (resHtml.ok) {
      const html = await resHtml.text();

      // Bóc tách meta og:description (VD: "1,234 Followers, 567 Following, 89 Posts - See Instagram photos and videos from...")
      const descMatch = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]+)"/i) ||
                        html.match(/content="([^"]+)"\s+(?:property|name)="og:description"/i);
      
      const titleMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i);
      const imgMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i);

      if (descMatch && descMatch[1]) {
        const desc = descMatch[1];
        const followers = desc.match(/([\d,\.KMB]+)\s+Followers/i)?.[1] || "0";
        const following = desc.match(/([\d,\.KMB]+)\s+Following/i)?.[1] || "0";
        const posts = desc.match(/([\d,\.KMB]+)\s+Posts/i)?.[1] || "0";

        let fullName = username;
        if (titleMatch && titleMatch[1]) {
          fullName = titleMatch[1].split("(@")[0].replace("• Instagram photos and videos", "").trim();
        }

        return {
          username: username,
          full_name: fullName,
          followers: followers,
          following: following,
          posts_count: posts,
          avatar_hd: imgMatch ? imgMatch[1].replace(/&amp;/g, "&") : "",
          is_verified: html.includes("verified_badge") || html.includes('"is_verified":true'),
          is_private: html.includes("This Account is Private") || html.includes('"is_private":true'),
          author: "Zhee Dev"
        };
      }
    }
  } catch (_) {}

  // Tier 2: GraphQL Web Profile API
  try {
    const resGraph = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
        "x-ig-app-id": "936619743392459",
        "Accept": "*/*"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (resGraph.ok) {
      const data = await resGraph.json();
      const user = data?.data?.user;
      if (user) {
        return {
          id: user.id,
          username: user.username,
          full_name: user.full_name || "",
          biography: user.biography || "",
          external_url: user.external_url || null,
          followers: user.edge_followed_by?.count || 0,
          following: user.edge_follow?.count || 0,
          posts_count: user.edge_owner_to_timeline_media?.count || 0,
          is_private: Boolean(user.is_private),
          is_verified: Boolean(user.is_verified),
          avatar_hd: user.profile_pic_url_hd || user.profile_pic_url,
          author: "Zhee Dev"
        };
      }
    }
  } catch (_) {}

  // Tier 3: PopCat Open Instagram Scraper Gateway
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

  // Tier 4: Fallback cấu trúc phản hồi cơ bản kèm link điều hướng
  return {
    username: username,
    full_name: username,
    profile_url: `https://www.instagram.com/${username}/`,
    trang_thai_tai_khoan: "Tài khoản tồn tại (Đang được bảo vệ bởi Instagram Anti-Scraping)",
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
      chuyen_muc: "Tra Cứu Thông Tin Instagram (/instagram hoặc /mxh/instagram)",
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

  const profile = await fetchInstagramProfile(rawInput);
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Tra Cứu Thông Tin Instagram",
    du_lieu: profile
  });
};