const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "d1c6f950bcda4177b9cbce6759a8a57f";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "f1717db397d44af9822f109277ccdeee";

let cachedToken = null;
let tokenExpiresAt = 0;

// 1. Lấy Token chính thức từ Spotify qua Client Credentials Flow
async function getOfficialSpotifyToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(7000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        cachedToken = data.access_token;
        tokenExpiresAt = now + (data.expires_in - 60) * 1000;
        return cachedToken;
      }
    }
  } catch (_) {}

  // Fallback qua Web Player Token
  try {
    const resWeb = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player", {
      signal: AbortSignal.timeout(5000)
    });
    if (resWeb.ok) {
      const webData = await resWeb.json();
      return webData.accessToken;
    }
  } catch (_) {}

  return null;
}

// 2. Bóc tách Lời Bài Hát (Lyrics)
async function fetchLyrics(trackTitle, artistName) {
  try {
    const cleanTitle = trackTitle.replace(/\(.*?\)|\[.*?\]/g, "").trim();
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(cleanTitle)}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics) return data.lyrics.trim();
    }
  } catch (_) {}

  // Mirror Lyrics Gateway
  try {
    const resMirror = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(trackTitle)}&artist_name=${encodeURIComponent(artistName)}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (resMirror.ok) {
      const lrcData = await resMirror.json();
      if (lrcData.plainLyrics) return lrcData.plainLyrics.trim();
      if (lrcData.syncedLyrics) return lrcData.syncedLyrics.trim();
    }
  } catch (_) {}

  return "Không tìm thấy lời bài hát khớp với dữ liệu Spotify.";
}

// 3. Tra cứu Track trên Spotify
async function lookupSpotify(query) {
  const token = await getOfficialSpotifyToken();
  if (!token) return null;

  try {
    const trackMatch = query.match(/track\/([a-zA-Z0-9]+)/i);
    let trackItem = null;

    if (trackMatch && trackMatch[1]) {
      const resTrack = await fetch(`https://api.spotify.com/v1/tracks/${trackMatch[1]}`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: AbortSignal.timeout(8000)
      });
      if (resTrack.ok) trackItem = await resTrack.json();
    } else {
      const resSearch = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: AbortSignal.timeout(8000)
      });
      if (resSearch.ok) {
        const searchData = await resSearch.json();
        trackItem = searchData.tracks?.items?.[0] || null;
      }
    }

    if (!trackItem) return null;

    const artistName = trackItem.artists?.map(a => a.name).join(", ") || "Unknown";
    const lyrics = await fetchLyrics(trackItem.name, trackItem.artists?.[0]?.name || artistName);

    return {
      id: trackItem.id,
      ten_bai_hat: trackItem.name,
      ca_si: artistName,
      album: trackItem.album?.name || "Single",
      ngay_phat_hanh: trackItem.album?.release_date || "N/A",
      thoi_luong_giay: Math.round((trackItem.duration_ms || 0) / 1000),
      do_pho_bien: `${trackItem.popularity || 0}/100`,
      link_preview_mp3: trackItem.preview_url || null,
      anh_bia_hd: trackItem.album?.images?.[0]?.url || "",
      spotify_url: trackItem.external_urls?.spotify || `https://open.spotify.com/track/${trackItem.id}`,
      loi_bai_hat: lyrics,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  } catch (_) {
    return null;
  }
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

  // Xử lý callback nếu Spotify redirect về
  if (requestUrl.pathname.includes("/callback")) {
    const code = searchParams.get("code");
    return res.status(200).json({
      trang_thai: "thanh_cong",
      thong_bao: "Spotify App Authorization Callback thành công!",
      auth_code: code || "No code supplied"
    });
  }

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
      chuyen_muc: "Tra Cứu Bài Hát & Lời (Lyrics) Spotify (/spotify hoặc /api/mxh/spotify)",
      cu_phap: [
        `${baseUrl}/api/mxh/spotify?={ten_bai_hat_hoac_link}`,
        `${baseUrl}/spotify?q={ten_bai_hat}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/spotify?=Shape Of You`,
        `${baseUrl}/spotify?q=Chung Ta Cua Tuong Lai`
      ]
    });
  }

  const result = await lookupSpotify(query);

  if (!result) {
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy bài hát trên Spotify khớp với từ khóa: "${query}"`
    });
  }

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Spotify Track & Lyrics Lookup",
    du_lieu: result
  });
};