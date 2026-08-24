let cachedClientId = null;
let clientIdExpiresAt = 0;

// 1. Tự động trích xuất client_id công khai từ assets script của SoundCloud Web
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

      // Quét các script asset để tìm client_id
      for (const scriptUrl of scriptUrls.slice(-6)) {
        try {
          const sRes = await fetch(scriptUrl, { signal: AbortSignal.timeout(4000) });
          if (sRes.ok) {
            const sText = await sRes.text();
            const idMatch = sText.match(/client_id[:=]["']([a-zA-Z0-9]{32})["']/);
            if (idMatch && idMatch[1]) {
              cachedClientId = idMatch[1];
              clientIdExpiresAt = now + 4 * 3600 * 1000; // cache 4 giờ
              return cachedClientId;
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Fallback key dự phòng
  return "2t9loNfhTw4fhqqkehfaXEhuDpLHWhDL";
}

// 2. Định dạng thông tin Track
function formatTrack(track, clientId) {
  let progressiveStream = null;
  let hlsStream = null;

  if (track.media?.transcodings) {
    const prog = track.media.transcodings.find(t => t.format?.protocol === "progressive");
    if (prog) progressiveStream = `${prog.url}?client_id=${clientId}`;

    const hls = track.media.transcodings.find(t => t.format?.protocol === "hls");
    if (hls) hlsStream = `${hls.url}?client_id=${clientId}`;
  }

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
    ngay_tao: track.created_at || "N/A",
    luot_nghe: track.playback_count?.toLocaleString() || "0",
    luot_thich: track.likes_count?.toLocaleString() || "0",
    luot_repost: track.reposts_count?.toLocaleString() || "0",
    soundcloud_url: track.permalink_url,
    downloadable: track.downloadable || false,
    download_url: track.download_url ? `${track.download_url}?client_id=${clientId}` : null,
    stream_transcoding_url: progressiveStream || hlsStream || null,
    tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
  };
}

// 3. Tra cứu hoặc bóc tách URL SoundCloud
async function searchSoundCloud(query) {
  const clientId = await getSoundCloudClientId();
  if (!clientId) return null;

  const isUrl = /^https?:\/\/(www\.)?soundcloud\.com\//i.test(query);

  try {
    if (isUrl) {
      // Bóc tách trực tiếp track URL qua /resolve API
      const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(query)}&client_id=${clientId}`;
      const res = await fetch(resolveUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const track = await res.json();
        if (track.kind === "track") {
          return {
            ket_qua_chinh: formatTrack(track, clientId),
            danh_sach_lien_quan: []
          };
        }
      }
    }

    // Tìm kiếm theo từ khóa
    const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=6`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      const items = (data.collection || []).filter(t => t.kind === "track");
      if (items.length > 0) {
        return {
          ket_qua_chinh: formatTrack(items[0], clientId),
          danh_sach_lien_quan: items.slice(1, 6).map(t => formatTrack(t, clientId))
        };
      }
    }
  } catch (_) {}

  // Fallback qua Mirror Music Gateway
  try {
    const mirrorRes = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(7000)
    });
    if (mirrorRes.ok) {
      const mData = await mirrorRes.json();
      const list = mData.data || mData.result;
      if (list && list.length > 0) {
        return {
          ket_qua_chinh: list[0],
          danh_sach_lien_quan: list.slice(1, 5)
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
      chuyen_muc: "Tra Cứu & Bóc Tách Bài Hát SoundCloud (/soundcloud hoặc /api/mxh/soundcloud)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/mxh/soundcloud?={ten_bai_hat_hoac_link}`,
        `${baseUrl}/soundcloud?q={ten_bai_hat}`
      ],
      vi_du: [
        `${baseUrl}/api/mxh/soundcloud?=Cat Doi Noi Sau`,
        `${baseUrl}/soundcloud?url=https://soundcloud.com/user-723528254/sontungmtp-chungtacuatuonglai`
      ]
    });
  }

  const result = await searchSoundCloud(query);

  if (!result) {
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy bài hát trên SoundCloud khớp với: "${query}"`
    });
  }

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "SoundCloud Music & Metadata Lookup",
    du_lieu: result
  });
};