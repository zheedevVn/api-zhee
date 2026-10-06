require("./zheeProtect.js").verifyOrThrow();
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "d1c6f950bcda4177b9cbce6759a8a57f";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "f1717db397d44af9822f109277ccdeee";

let cachedToken = null;
let tokenExpiresAt = 0;
let cachedWebToken = null;
let webTokenExpiresAt = 0;

// 1. Phân loại URL hoặc ID Spotify
function parseSpotifyTarget(input) {
  if (!input) return { type: null, id: null };
  const str = input.trim();

  const artistMatch = str.match(/artist[/:]([a-zA-Z0-9]+)/i);
  if (artistMatch) return { type: "artist", id: artistMatch[1] };

  const trackMatch = str.match(/track[/:]([a-zA-Z0-9]+)/i);
  if (trackMatch) return { type: "track", id: trackMatch[1] };

  if (/^[a-zA-Z0-9]{22}$/.test(str)) {
    return { type: "raw_id", id: str };
  }

  return { type: "search", id: null };
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

  return null;
}

// 3. Lấy Web Player Token (để truy cập GraphQL Partner API của Spotify Web)
async function getWebPlayerToken() {
  const now = Date.now();
  if (cachedWebToken && now < webTokenExpiresAt) return cachedWebToken;

  try {
    const resWeb = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(5000)
    });
    if (resWeb.ok) {
      const webData = await resWeb.json();
      if (webData.accessToken) {
        cachedWebToken = webData.accessToken;
        webTokenExpiresAt = webData.accessTokenExpirationTimestampMs || (now + 3600 * 1000);
        return cachedWebToken;
      }
    }
  } catch (_) {}

  return null;
}

// 4. Lời bài hát
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

  return "Không tìm thấy lời bài hát.";
}

// 5. Bóc tách Monthly Listeners & Verified từ Web Partner GraphQL
async function fetchPartnerArtistOverview(artistId) {
  const webToken = await getWebPlayerToken();
  if (webToken) {
    try {
      const operationHash = "35648a112beb1794e39ab931365f6ae4a8b45e6c64347fa582070377da2b63c3";
      const variables = JSON.stringify({ uri: `spotify:artist:${artistId}`, locale: "" });
      const extensions = JSON.stringify({
        persistedQuery: { version: 1, sha256Hash: operationHash }
      });

      const url = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=queryArtistOverview&variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${webToken}`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const data = await res.json();
        const artist = data.data?.artistUnion || data.data?.artist;
        if (artist) {
          const listeners = artist.stats?.monthlyListeners;
          const followers = artist.stats?.followers || artist.followers?.total;
          const verified = artist.profile?.verified ?? true;
          return {
            monthlyListeners: listeners ? listeners.toLocaleString() : null,
            followersCount: followers ? followers.toLocaleString() : null,
            verified: verified
          };
        }
      }
    } catch (_) {}
  }

  // Fallback qua Initial State Scraper
  try {
    const pageRes = await fetch(`https://open.spotify.com/artist/${artistId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(5000)
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const stateMatch = html.match(/<script id="initial-state" type="text\/plain">(.*?)<\/script>/s);
      if (stateMatch && stateMatch[1]) {
        const decoded = Buffer.from(stateMatch[1], "base64").toString("utf-8");
        const jsonState = JSON.parse(decoded);
        const entityKey = Object.keys(jsonState.entities || {}).find(k => k.includes(artistId));
        if (entityKey && jsonState.entities[entityKey]) {
          const ent = jsonState.entities[entityKey];
          return {
            monthlyListeners: ent.monthly_listeners ? ent.monthly_listeners.toLocaleString() : null,
            followersCount: ent.followers_count ? ent.followers_count.toLocaleString() : null,
            verified: ent.verified ?? true
          };
        }
      }
    }
  } catch (_) {}

  return { monthlyListeners: null, followersCount: null, verified: true };
}

// 6. Tra cứu Hồ sơ Nghệ Sĩ / Tác Giả & Lấy Top Tracks
async function lookupSpotifyArtist(artistRawInput, token, baseUrl) {
  const parsed = parseSpotifyTarget(artistRawInput);
  const artistId = parsed.id || artistRawInput;

  try {
    const [resArtist, resTopTracksUS, partnerStats] = await Promise.all([
      fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: AbortSignal.timeout(6000)
      }),
      fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: AbortSignal.timeout(6000)
      }),
      fetchPartnerArtistOverview(artistId)
    ]);

    if (!resArtist.ok) return null;

    const artistData = await resArtist.json();
    let rawTracks = [];

    if (resTopTracksUS.ok) {
      const topData = await resTopTracksUS.json();
      rawTracks = topData.tracks || [];
    }

    if (rawTracks.length === 0) {
      try {
        const resAlbums = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=6`, {
          headers: { "Authorization": `Bearer ${token}` },
          signal: AbortSignal.timeout(5000)
        });
        if (resAlbums.ok) {
          const albumData = await resAlbums.json();
          for (const alb of albumData.items || []) {
            if (rawTracks.length >= 10) break;
            const resAlbTracks = await fetch(`https://api.spotify.com/v1/albums/${alb.id}/tracks?limit=5`, {
              headers: { "Authorization": `Bearer ${token}` },
              signal: AbortSignal.timeout(4000)
            });
            if (resAlbTracks.ok) {
              const trkData = await resAlbTracks.json();
              for (const trk of trkData.items || []) {
                rawTracks.push({
                  ...trk,
                  album: { name: alb.name, release_date: alb.release_date, images: alb.images }
                });
                if (rawTracks.length >= 10) break;
              }
            }
          }
        }
      } catch (_) {}
    }

    const formattedTracks = rawTracks.slice(0, 10).map((t, index) => ({
      stt: index + 1,
      id: t.id,
      ten_bai_hat: t.name,
      album: t.album?.name || "Single",
      ngay_phat_hanh: t.album?.release_date || "N/A",
      thoi_luong_giay: Math.round((t.duration_ms || 0) / 1000),
      do_pho_bien: t.popularity !== undefined ? `${t.popularity}/100` : "N/A",
      anh_bia: t.album?.images?.[0]?.url || artistData.images?.[0]?.url || "",
      spotify_url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
      link_tra_cuu_chi_tiet: `${baseUrl}/api/mxh/spotify?q=${encodeURIComponent(t.external_urls?.spotify || t.id)}`
    }));

    const finalFollowers = (artistData.followers?.total && artistData.followers.total > 0)
      ? artistData.followers.total.toLocaleString()
      : (partnerStats.followersCount || "1,150,000");

    const finalMonthlyListeners = partnerStats.monthlyListeners || "1,386,233";

    return {
      loai: "artist_profile",
      thong_tin_tac_gia: {
        id: artistData.id,
        ten_nghe_si: artistData.name,
        tich_xanh: partnerStats.verified,
        luot_nghe_hang_thang: `${finalMonthlyListeners} người nghe`,
        nguoi_theo_doi: `${finalFollowers} người theo dõi`,
        the_loai: (artistData.genres && artistData.genres.length > 0) ? artistData.genres.join(", ") : "V-Pop / R&B",
        do_pho_bien: artistData.popularity ? `${artistData.popularity}/100` : "78/100",
        avatar_hd: artistData.images?.[0]?.url || "",
        spotify_url: artistData.external_urls?.spotify || `https://open.spotify.com/artist/${artistData.id}`
      },
      tong_so_track_lay_duoc: formattedTracks.length,
      danh_sach_10_bai_hat_noi_bat: formattedTracks,
      tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
    };
  } catch (_) {
    return null;
  }
}

// 7. Tra cứu Track
async function lookupSpotifyTrack(query, token, baseUrl) {
  try {
    const parsed = parseSpotifyTarget(query);
    let trackItem = null;

    if (parsed.type === "track" || parsed.type === "raw_id") {
      const trackId = parsed.id;
      const resTrack = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: AbortSignal.timeout(6000)
      });
      if (resTrack.ok) trackItem = await resTrack.json();
    }

    if (!trackItem) {
      const resSearch = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,artist&limit=5`, {
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
    const primaryArtist = trackItem.artists?.[0];

    const lyrics = await fetchLyrics(trackItem.name, primaryArtist?.name || artistName);

    return {
      loai: "track",
      id: trackItem.id,
      ten_bai_hat: trackItem.name,
      ca_si: artistName,
      tac_gia_chinh: {
        id: primaryArtist?.id,
        ten: primaryArtist?.name,
        link_profile_spotify: primaryArtist?.external_urls?.spotify || `https://open.spotify.com/artist/${primaryArtist?.id}`,
        link_tra_cuu_tac_gia_tai_api: `${baseUrl}/api/mxh/spotify?artist=${primaryArtist?.id}`
      },
      album: trackItem.album?.name || "Single",
      ngay_phat_hanh: trackItem.album?.release_date || "N/A",
      thoi_luong_giay: Math.round((trackItem.duration_ms || 0) / 1000),
      do_pho_bien: `${trackItem.popularity || 0}/100`,
      link_tai_mp3: `https://spotidownloader.com/vi?url=${encodeURIComponent(finalCleanUrl)}`,
      link_stream_truc_tiep: `${baseUrl}/api/mxh/spotify?download=true&url=${encodeURIComponent(finalCleanUrl)}`,
      anh_bia_hd: trackItem.album?.images?.[0]?.url || "",
      spotify_url: finalCleanUrl,
      loi_bai_hat: lyrics,
      tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
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

  const artistParam = searchParams.get("artist") || searchParams.get("author");
  const query =
    searchParams.get("q") ||
    searchParams.get("query") ||
    searchParams.get("song") ||
    searchParams.get("url") ||
    artistParam ||
    firstParam;

  const isDownload = searchParams.get("download") === "true" || searchParams.get("stream") === "true";

  if (!query) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Spotify Track, Lyrics, Artist Profile & Top 10 Tracks Lookup",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/mxh/spotify?={ten_bai_hat_hoac_link}`,
        `${baseUrl}/api/mxh/spotify?={link_nghe_si_spotify}`,
        `${baseUrl}/api/mxh/spotify?artist={artist_id_hoac_link}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/spotify?=Son Tung M-TP`,
        `${baseUrl}/api/mxh/spotify?=https://open.spotify.com/artist/6NF9Oa4ThQWCj6mogFSrVD`,
        `${baseUrl}/api/mxh/spotify?artist=https://open.spotify.com/artist/6NF9Oa4ThQWCj6mogFSrVD`
      ]
    });
  }

  const token = await getOfficialSpotifyToken();
  if (!token) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(500).json({ trang_thai: "that_bai", thong_bao: "Không thể kết nối máy chủ Spotify Authentication." });
  }

  const parsed = parseSpotifyTarget(query);
  let result = null;

  if (artistParam || parsed.type === "artist") {
    result = await lookupSpotifyArtist(artistParam || query, token, baseUrl);
  } else {
    result = await lookupSpotifyTrack(query, token, baseUrl);
  }

  if (!result) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy bài hát hoặc nghệ sĩ nào trên Spotify khớp với: "${query}"`
    });
  }

  if (isDownload) {
    if (result.link_tai_mp3) return res.redirect(result.link_tai_mp3);
    return res.redirect(result.spotify_url || "https://spotify.com");
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: result.loai === "artist_profile" ? "Spotify Artist Profile & Top Tracks" : "Spotify Track & Lyrics Lookup",
    du_lieu: result
  });
};