require("./zheeProtect.js").verifyOrThrow();
let cachedClientId = null;
let clientIdExpiresAt = 0;

// 1. Tự động lấy Client ID chính thức từ SoundCloud Web
async function getSoundCloudClientId() {
  const now = Date.now();
  if (cachedClientId && now < clientIdExpiresAt) {
    return cachedClientId;
  }

  try {
    const htmlRes = await fetch("https://soundcloud.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(6000)
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const scriptUrls = [...html.matchAll(/<script[^>]+src="([^">]+\.js)"/g)].map(m => m[1]);

      for (const scriptUrl of scriptUrls.slice(-6)) {
        try {
          const sRes = await fetch(scriptUrl, { signal: AbortSignal.timeout(4000) });
          if (sRes.ok) {
            const sText = await sRes.text();
            const idMatch = sText.match(/client_id[:=]["']([a-zA-Z0-9]{32})["']/);
            if (idMatch && idMatch[1]) {
              cachedClientId = idMatch[1];
              clientIdExpiresAt = now + 4 * 3600 * 1000;
              return cachedClientId;
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return "2t9loNfhTw4fhqqkehfaXEhuDpLHWhDL";
}

// 2. Fetch lần 2 vào Transcoding URL để lấy link MP3 CDN thực sự (cf-media.sndcdn.com)
async function resolveDirectCdnMp3(track, clientId) {
  if (!track.media?.transcodings) return null;

  // Ưu tiên progressive (MP3 direct) -> HLS
  const progressive = track.media.transcodings.find(t => t.format?.protocol === "progressive");
  const hls = track.media.transcodings.find(t => t.format?.protocol === "hls");
  const chosen = progressive || hls;

  if (chosen && chosen.url) {
    try {
      const res = await fetch(`${chosen.url}?client_id=${clientId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json();
        return data.url || null; // Đây là link https://cf-media.sndcdn.com/...mp3
      }
    } catch (_) {}
  }
  return null;
}

// 3. Chuẩn hóa format Track
async function formatTrack(track, clientId, baseUrl) {
  const directCdnMp3 = await resolveDirectCdnMp3(track, clientId);
  const artwork = track.artwork_url ? track.artwork_url.replace("-large", "-t500x500") : (track.user?.avatar_url || "");

  return {
    id: track.id,
    tieu_de: track.title,
    tac_gia: track.user?.username || "SoundCloud Artist",
    author_avatar: track.user?.avatar_url || "",
    author_url: track.user?.permalink_url || "",
    anh_bia_hd: artwork,
    thoi_luong_giay: Math.round((track.duration || 0) / 1000),
    the_loai: track.genre || "N/A",
    ngay_phat_hanh: track.created_at || "N/A",
    luot_nghe: track.playback_count ? track.playback_count.toLocaleString() : "0",
    luot_thich: track.likes_count ? track.likes_count.toLocaleString() : "0",
    luot_repost: track.reposts_count ? track.reposts_count.toLocaleString() : "0",
    soundcloud_url: track.permalink_url,
    link_audio_mp3: directCdnMp3,
    link_stream_truc_tiep_tai_api: `${baseUrl}/api/mxh/soundcloud?stream=true&url=${encodeURIComponent(track.permalink_url)}`
  };
}

// 4. Lấy 10 tracks đầu tiên của một User
async function getUserTracks(userId, clientId, baseUrl) {
  try {
    const res = await fetch(`https://api-v2.soundcloud.com/users/${userId}/tracks?limit=10&client_id=${clientId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      const list = data.collection || [];
      const formatted = [];
      for (const t of list.slice(0, 10)) {
        formatted.push(await formatTrack(t, clientId, baseUrl));
      }
      return formatted;
    }
  } catch (_) {}
  return [];
}

// 5. Xử lý chính: Phân luồng User Profile / Track / Keyword
async function handleSoundCloudQuery(query, baseUrl) {
  const clientId = await getSoundCloudClientId();
  if (!clientId) return null;

  const isUrl = /^https?:\/\/(www\.)?soundcloud\.com\//i.test(query);

  if (isUrl) {
    try {
      const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(query)}&client_id=${clientId}`;
      const res = await fetch(resolveUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const item = await res.json();

        // USER PROFILE
        if (item.kind === "user") {
          const top10Tracks = await getUserTracks(item.id, clientId, baseUrl);
          return {
            loai: "user_profile",
            thong_tin_user: {
              id: item.id,
              username: item.username,
              ten_that: item.full_name || "N/A",
              quoc_gia: item.city ? `${item.city}, ${item.country_code}` : (item.country_code || "N/A"),
              bio: item.description || "Không có tiểu sử",
              avatar_hd: item.avatar_url ? item.avatar_url.replace("-large", "-t500x500") : "",
              followers: item.followers_count?.toLocaleString() || "0",
              following: item.followings_count?.toLocaleString() || "0",
              tong_so_track: item.track_count?.toLocaleString() || "0",
              so_playlist: item.playlist_count?.toLocaleString() || "0",
              soundcloud_url: item.permalink_url,
              tich_xanh: item.verified || false
            },
            danh_sach_10_track_moi_nhat: top10Tracks
          };
        }

        // SINGLE TRACK
        if (item.kind === "track") {
          const trackData = await formatTrack(item, clientId, baseUrl);
          return {
            loai: "track",
            ket_qua_chinh: trackData
          };
        }
      }
    } catch (_) {}
  }

  // TÌM KIẾM THEO TỪ KHÓA
  try {
    const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=6`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      const items = (data.collection || []).filter(t => t.kind === "track");
      if (items.length > 0) {
        const mainTrack = await formatTrack(items[0], clientId, baseUrl);
        const related = [];
        for (const t of items.slice(1, 6)) {
          related.push(await formatTrack(t, clientId, baseUrl));
        }
        return {
          loai: "search",
          ket_qua_chinh: mainTrack,
          danh_sach_lien_quan: related
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

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const searchParams = requestUrl.searchParams;

  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value && !["stream", "download"].includes(key)) {
      firstParam = key.replace(/^=/, "").trim();
      break;
    }
  }

  const query =
    searchParams.get("q") ||
    searchParams.get("query") ||
    searchParams.get("song") ||
    searchParams.get("user") ||
    searchParams.get("url") ||
    firstParam;

  const isStream = searchParams.get("stream") === "true" || searchParams.get("download") === "true";

  if (!query) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "SoundCloud Direct MP3 & Profile Lookup Gateway",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/mxh/soundcloud?={ten_bai_hat_hoac_link}`,
        `${baseUrl}/api/mxh/soundcloud?stream=true&url={link_track_soundcloud}`,
        `${baseUrl}/api/mxh/soundcloud?={link_profile_user}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/soundcloud?=Cat Doi Noi Sau`,
        `${baseUrl}/api/mxh/soundcloud?=https://soundcloud.com/user-424125285`,
        `${baseUrl}/api/mxh/soundcloud?stream=true&url=https://soundcloud.com/user-723528254/sontungmtp-chungtacuatuonglai`
      ]
    });
  }

  const result = await handleSoundCloudQuery(query, baseUrl);

  if (!result) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy bài hát hoặc hồ sơ nào trên SoundCloud khớp với: "${query}"`
    });
  }

  // Chế độ phát / tải MP3 trực tiếp: Chuyển hướng thẳng sang CDN âm thanh cuối cùng
  if (isStream) {
    const audioUrl = result.ket_qua_chinh?.link_audio_mp3;
    if (audioUrl) {
      return res.redirect(audioUrl);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: "Không thể trích xuất luồng MP3 trực tiếp cho track này."
    });
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "SoundCloud Direct Resolver API",
    du_lieu: result
  });
};