// Bộ đệm Token Spotify Client Credentials
let cachedToken = null;
let tokenExpiresAt = 0;

// Hàm lấy Token truy cập Spotify tự động
async function getSpotifyToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  // Token cấp quyền trực tiếp qua Open Client Gateway
  try {
    const res = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        cachedToken = data.accessToken;
        tokenExpiresAt = data.accessTokenExpirationTimestampMs || (now + 3600 * 1000);
        return cachedToken;
      }
    }
  } catch (_) {}

  return null;
}

// Hàm tìm kiếm và bóc tách bài hát Spotify
async function searchSpotifyTrack(query) {
  const token = await getSpotifyToken();

  // Tier 1: Spotify Web API chính thức qua Access Token
  if (token) {
    try {
      // Nếu input là link track (https://open.spotify.com/track/...)
      const trackIdMatch = query.match(/track\/([a-zA-Z0-9]+)/i);
      let endpoint = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
      
      if (trackIdMatch && trackIdMatch[1]) {
        endpoint = `https://api.spotify.com/v1/tracks/${trackIdMatch[1]}`;
        const resSingle = await fetch(endpoint, {
          headers: { "Authorization": `Bearer ${token}` },
          signal: AbortSignal.timeout(8000)
        });
        if (resSingle.ok) {
          const track = await resSingle.json();
          return formatTrackItem(track);
        }
      }

      const res = await fetch(endpoint, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const data = await res.json();
        const items = data.tracks?.items || [];
        if (items.length > 0) {
          return {
            ket_qua_chinh: formatTrackItem(items[0]),
            danh_sach_lien_quan: items.slice(1, 6).map(formatTrackItem)
          };
        }
      }
    } catch (_) {}
  }

  // Tier 2: Open Mirror Search Gateway
  try {
    const mirrorRes = await fetch(`https://api.siputzx.my.id/api/s/spotify?query=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (mirrorRes.ok) {
      const mirrorData = await mirrorRes.json();
      const tracks = mirrorData.data || mirrorData.result;
      if (tracks && tracks.length > 0) {
        return {
          ket_qua_chinh: tracks[0],
          danh_sach_lien_quan: tracks.slice(1, 6)
        };
      }
    }
  } catch (_) {}

  return null;
}

function formatTrackItem(track) {
  return {
    id: track.id,
    ten_bai_hat: track.name,
    ca_si: track.artists?.map(a => a.name).join(", ") || "N/A",
    album: track.album?.name || "Single",
    ngay_phat_hanh: track.album?.release_date || "N/A",
    thoi_luong_giay: Math.round((track.duration_ms || 0) / 1000),
    do_pho_bien: track.popularity ? `${track.popularity}/100` : "N/A",
    link_preview_mp3: track.preview_url || null,
    anh_bia: track.album?.images?.[0]?.url || "",
    spotify_url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
    uri: track.uri
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
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value) { firstParam = key.replace(/^=/, "").trim(); break; }
  }

  const query =
    searchParams.get("q") ||
    searchParams.get("query") ||
    searchParams.get("song") ||
    searchParams.get("url") ||
    firstParam;

  if (!query) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Tra Cứu & Tìm Kiếm Bài Hát Spotify (/spotify hoặc /api/mxh/spotify)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/spotify?q={ten_bai_hat_hoac_link}`,
        `${baseUrl}/api/mxh/spotify?song={ten_bai_hat}`
      ],
      vi_du: [
        `${baseUrl}/spotify?q=Chúng Ta Của Tương Lai`,
        `${baseUrl}/api/mxh/spotify?=https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`
      ]
    });
  }

  const result = await searchSpotifyTrack(query);

  if (!result) {
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy bài hát nào trên Spotify khớp với từ khóa: "${query}"`
    });
  }

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Tra Cứu Bài Hát Spotify",
    du_lieu: result
  });
};