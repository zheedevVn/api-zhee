const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "d1c6f950bcda4177b9cbce6759a8a57f";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "f1717db397d44af9822f109277ccdeee";

let cachedToken = null;
let tokenExpiresAt = 0;

// 1. Lấy Token chính thức từ Spotify
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

  // Fallback Token
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
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics) return data.lyrics.trim();
    }
  } catch (_) {}

  try {
    const resMirror = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(trackTitle)}&artist_name=${encodeURIComponent(artistName)}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (resMirror.ok) {
      const lrcData = await resMirror.json();
      if (lrcData.plainLyrics) return lrcData.plainLyrics.trim();
      if (lrcData.syncedLyrics) return lrcData.syncedLyrics.trim();
    }
  } catch (_) {}

  return "Không tìm thấy lời bài hát.";
}

// 3. Resolver lấy link tải Full MP3 từ Spotify Track URL
async function fetchSpotifyFullMp3(spotifyUrl, trackTitle, artistName) {
  // Tier 1: Spotify-DL Engine
  try {
    const res = await fetch(`https://api.fabdl.com/spotify/get?url=${encodeURIComponent(spotifyUrl)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(7000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.result && data.result.gid && data.result.id) {
        const convertRes = await fetch(`https://api.fabdl.com/spotify/mp3-convert-task/${data.result.gid}/${data.result.id}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (convertRes.ok) {
          const cData = await convertRes.json();
          if (cData.result?.download_url) {
            return `https://api.fabdl.com${cData.result.download_url}`;
          }
        }
      }
    }
  } catch (_) {}

  // Tier 2: Spotisong & Music Mirror Resolver
  try {
    const resMirror = await fetch(`https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(spotifyUrl)}`, {
      signal: AbortSignal.timeout(7000)
    });
    if (resMirror.ok) {
      const mData = await resMirror.json();
      if (mData.data?.download) return mData.data.download;
      if (mData.download_url) return mData.download_url;
    }
  } catch (_) {}

  return null;
}

// 4. Tra cứu Track chính thức
async function lookupSpotify(query, baseUrl) {
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
    const spotifyUrl = trackItem.external_urls?.spotify || `https://open.spotify.com/track/${trackItem.id}`;
    
    // Đồng thời lấy lyrics và link full MP3
    const [lyrics, fullMp3Url] = await Promise.all([
      fetchLyrics(trackItem.name, trackItem.artists?.[0]?.name || artistName),
      fetchSpotifyFullMp3(spotifyUrl, trackItem.name, artistName)
    ]);

    return {
      id: trackItem.id,
      ten_bai_hat: trackItem.name,
      ca_si: artistName,
      album: trackItem.album?.name || "Single",
      ngay_phat_hanh: trackItem.album?.release_date || "N/A",
      thoi_luong_giay: Math.round((trackItem.duration_ms || 0) / 1000),
      do_pho_bien: `${trackItem.popularity || 0}/100`,
      link_full_mp3: fullMp3Url,
      link_stream_truc_tiep: `${baseUrl}/api/mxh/spotify?download=true&url=${encodeURIComponent(spotifyUrl)}`,
      anh_bia_hd: trackItem.album?.images?.[0]?.url || "",
      spotify_url: spotifyUrl,
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
      chuyen_muc: "Spotify Track, Lyrics & Full MP3 Downloader Gateway",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/mxh/spotify?={ten_bai_hat_hoac_link}`,
        `${baseUrl}/api/mxh/spotify?download=true&url={spotify_track_url}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/spotify?=Shape Of You`,
        `${baseUrl}/api/mxh/spotify?download=true&url=https://open.spotify.com/track/7qiZfU4191Wllzx7mPBI3"`
      ]
    });
  }

  const result = await lookupSpotify(query, baseUrl);

  if (!result) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy bài hát trên Spotify khớp với từ khóa: "${query}"`
    });
  }

  // Chế độ tải / phát trực tiếp MP3
  if (isDownload) {
    if (result.link_full_mp3) {
      return res.redirect(result.link_full_mp3);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: "Không thể trích xuất luồng MP3 hoàn chỉnh cho bài hát này."
    });
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Spotify Track, Full MP3 & Lyrics Lookup",
    du_lieu: result
  });
};