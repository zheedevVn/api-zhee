async function fetchInstagramProfile(username) {
  const cleanUser = username.replace(/^@/, "").trim();

  // Tier 1: GraphQL Web Profile Info Endpoint
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "x-ig-app-id": "936619743392459",
          "Accept": "*/*"
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (res.ok) {
      const data = await res.json();
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

  // Tier 2: Open Scraper Fallback Gateway
  try {
    const resBackup = await fetch(
      `https://api.popcat.xyz/instagram?user=${cleanUser}`,
      {
        signal: AbortSignal.timeout(10000)
      }
    );
    if (resBackup.ok) {
      const data = await resBackup.json();
      if (!data.error) {
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

  const username =
    searchParams.get("username") ||
    searchParams.get("user") ||
    searchParams.get("u") ||
    firstParam;

  if (!username) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Tra Cứu Thông Tin Instagram (/instagram)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/instagram?username={ten_tai_khoan}`,
        `${baseUrl}/instagram?={ten_tai_khoan}`
      ],
      vi_du: [
        `${baseUrl}/instagram?username=cristiano`,
        `${baseUrl}/instagram?=leomessi`
      ]
    });
  }

  const profile = await fetchInstagramProfile(username);
  if (!profile) {
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy thông tin cho tài khoản Instagram: ${username}`
    });
  }

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Tra Cứu Thông Tin Instagram",
    du_lieu: profile
  });
};