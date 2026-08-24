const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "d1c6f950bcda4177b9cbce6759a8a57f";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "f1717db397d44af9822f109277ccdeee";

let cachedToken = null;
let tokenExpiresAt = 0;

// 1. Trích xuất ID bài hát từ URL
function extractSpotifyTrackId(input) {
  const match = input.match(/track\/([a-zA-Z0-9]+)/i);
  return match && match[1] ? match[1] : null;
}

// 2. Lấy Access Token chính thức từ Spotify
async function getOfficialSpotifyToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  try {
    const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(5000)
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

  // Fallback Web Token
  try {
    const resWeb = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player", {
      signal: AbortSignal.timeout(4000)
    });
    if (resWeb.ok) {
      const webData = await resWeb.json();
      return webData.accessToken;
    }
  } catch (_) {}

  return null;
}

// 3. Lấy Lời Bài Hát (Lyrics)
async function fetchLyrics(trackTitle, artistName) {
  try {
    const cleanTitle = trackTitle.replace(/\(.*?\)|\[.*?\]/g, "").trim();
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(cleanTitle)}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics) return data.lyrics.trim();
    }
  } catch (_) {}

  try {
    const resMirror = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(trackTitle)}&artist_name=${encodeURIComponent(artistName)}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (resMirror.ok) {
      const lrcData = await resMirror.json();
      if (lrcData.plainLyrics) return lrcData.plainLyrics.trim();
      if (lrcData.syncedLyrics) return lrcData.syncedLyrics.trim();
    }
  } catch (_) {}

  return "Không tìm thấy lời bài hát khớp với dữ liệu Spotify.";
}

// 4. Bóc tách link MP3 320kbps qua Spotifydown Engine
async function resolveSpotifyMp3Download(trackId, cleanUrl) {
  // Engine 1: SpotifyDown V2
  try {
    const res = await fetch(`https://api.spotifydown.com/download/${trackId}`, {
      headers: {
        "Origin": "https://spotifydown.com",
        "Referer": "https://spotifydown.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.link) {
        return data.link;
      }
    }
  } catch (_) {}

  // Engine 2: Spotmate Gateway
  try {
    const res = await fetch("https://spotmate.online/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({ url: cleanUrl }),
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.downloadUrl || data.url) return data.downloadUrl || data.url;
    }
  } catch (_) {}

  // Engine 3: SpotiSong Single Bridge
  try {
    const res = await fetch("https://spotisongdownloader.com/api/composer/spotify/xsingle_track.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `url=${encodeURIComponent(cleanUrl)}`,
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.dlink || data.song_url) return data.dlink || data.song_url;
    }
  } catch (_) {}

  return null;
}

// 5. Lookup tổng hợp dữ liệu
async function lookupSpotify(query, baseUrl) {
  const token = await getOfficialSpotifyToken();
  if (!token) return null;

  try {
    const trackId = extractSpotifyTrackId(query);
    let trackItem = null;

    if (trackId) {
      const resTrack = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: AbortSignal.timeout(6000)
      });
      if (resTrack.ok) trackItem = await resTrack.json();
    } else {
      const resSearch = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: AbortSignal.timeout(6000)
      });
      if (resSearch.ok) {
        const searchData = await resSearch.json();
        trackItem = searchData.tracks?.items?.[0] || null;
      }
    }

    if (!trackItem) return null;

    const finalCleanUrl = `https://open.spotify.com/track/${trackItem.id}`;
    const artistName = trackItem.artists?.map(a => a.name).join(", ") || "Unknown";

    const [lyrics, mp3Link] = await Promise.all([
      fetchLyrics(trackItem.name, trackItem.artists?.[0]?.name || artistName),
      resolveSpotifyMp3Download(trackItem.id, finalCleanUrl)
    ]);

    return {
      id: trackItem.id,
      ten_bai_hat: trackItem.name,
      ca_si: artistName,
      album: trackItem.album?.name || "Single",
      ngay_phat_hanh: trackItem.album?.release_date || "N/A",
      thoi_luong_giay: Math.round((trackItem.duration_ms || 0) / 1000),
      do_pho_bien: `${trackItem.popularity || 0}/100`,
      link_tai_mp3: mp3Link,
      link_stream_truc_tiep: `${baseUrl}/api/mxh/spotify?download=true&url=${encodeURIComponent(finalCleanUrl)}`,
      anh_bia_hd: trackItem.album?.images?.[0]?.url || "",
      spotify_url: finalCleanUrl,
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

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const searchParams = requestUrl.searchParams;

  if (requestUrl.pathname.includes("/callback")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "thanh_cong",
      thong_bao: "Spotify Callback Connected!"
    });
  }

  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value && !["download", "stream"].includes(key)) {
      firstParam = key.replace(/^=/, "").trim();
      break;
    }
  }

  const query =
    searchParams.get("q") ||
    searchParams.get("query") ||
    searchParams.get("song") ||
    searchParams.get("url") ||
    firstParam;

  const isDownload = searchParams.get("download") === "true" || searchParams.get("stream") === "true";

  if (!query) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Spotify Full Track, MP3 & Lyrics Downloader",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/mxh/spotify?={ten_bai_hat_hoac_link}`,
        `${baseUrl}/api/mxh/spotify?download=true&url={spotify_track_url}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/spotify?=https://open.spotify.com/track/2JZH5Rwp2WCAWzm3hXYzQf?si=d625b519c4244395`,
        `${baseUrl}/api/mxh/spotify?download=true&url=https://open.spotify.com/track/2JZH5Rwp2WCAWzm3hXYzQf`
      ]
    });
  }

  const result = await lookupSpotify(query, baseUrl);

  if (!result) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy bài hát trên Spotify khớp với: "${query}"`
    });
  }

  // Khi có cờ download=true, redirect thẳng sang link MP3
  if (isDownload) {
    if (result.link_tai_mp3) {
      return res.redirect(result.link_tai_mp3);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: "Không tìm thấy luồng MP3 trực tiếp cho track này hoặc máy chủ chuyển đổi đang bận."
    });
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Spotify Track & Full MP3 Downloader",
    du_lieu: result
  });
};