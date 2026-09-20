const youtubeHandler = require("./youtube");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://www.tiktok.com/"
};

async function fetchTikwmMedia(url, headers = BROWSER_HEADERS) {
  const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers,
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.code !== 0 || !payload.data) return null;
  const images = Array.isArray(payload.data.images) ? payload.data.images.filter(Boolean) : [];
  const photo = images.length > 0 || /\/photo\//i.test(url);
  const play = payload.data.hdplay || payload.data.play || null;
  const playIsAudio = /\.(mp3|m4a|aac)(\?|$)/i.test(play || "") || /ies-music|audio_mpeg/i.test(play || "");
  return {
    video_khong_logo: photo || playIsAudio ? null : payload.data.play || null,
    video_hd: photo || playIsAudio ? null : play,
    nhac_mp3: payload.data.music || (playIsAudio ? play : null),
    tieu_de: payload.data.title || null,
    anh_bia: payload.data.cover || payload.data.origin_cover || null,
    anh: images,
    loai: photo ? "tiktok_photo" : "tiktok_video"
  };
}

async function downloadCobaltMedia(query) {
  const url = String(query || "").trim();
  if (!url) {
    const error = new Error("Vui lòng nhập URL media qua ?url=...");
    error.statusCode = 400;
    throw error;
  }
  let cobaltError = null;
  try {
    const response = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url, downloadMode: "auto" }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && (data.url || data.audio)) {
      const result = {
        trang_thai: "thanh_cong",
        loai: "cobalt_media",
        link_nguon: url,
        link_tai: data.url || null,
        link_audio: data.audio || null,
        nguon_tai: "Cobalt",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      };
      if (/tiktok\.com|douyin\.com/i.test(url)) {
        const extra = await fetchTikwmMedia(url).catch(() => null);
        if (extra?.anh?.length) {
          result.loai = "tiktok_photo";
          result.danh_sach_anh = extra.anh;
          result.anh_bia = extra.anh_bia;
          result.tieu_de = extra.tieu_de;
          result.link_audio = result.link_audio || extra.nhac_mp3;
          if (/\.(mp3|m4a)(\?|$)|ies-music|audio_mpeg/i.test(result.link_tai || "")) {
            result.link_audio = result.link_audio || result.link_tai;
            result.link_tai = extra.video_hd || extra.video_khong_logo || null;
          }
        }
      }
      return result;
    }
    cobaltError = data.error?.code || data.error || data.message || `HTTP ${response.status}`;
  } catch (error) {
    cobaltError = error.message;
  }

  if (/tiktok\.com|douyin\.com|iesdouyin\.com/i.test(url)) {
    const fallback = await fetchTikwmMedia(url).catch(() => null);
    if (fallback?.video_khong_logo || fallback?.video_hd || fallback?.nhac_mp3 || fallback?.anh?.length) {
      return {
        trang_thai: "thanh_cong",
        loai: fallback.loai === "tiktok_photo" ? "tiktok_photo" : "cobalt_media",
        link_nguon: url,
        link_tai: fallback.video_hd || fallback.video_khong_logo || null,
        link_audio: fallback.nhac_mp3 || null,
        danh_sach_anh: fallback.anh || [],
        nguon_tai: "TikWM (dự phòng Cobalt)",
        tieu_de: fallback.tieu_de,
        anh_bia: fallback.anh_bia,
        canh_bao: cobaltError
          ? `Cobalt không xác thực được yêu cầu (${cobaltError}); hệ thống đã dùng TikWM dự phòng.`
          : undefined,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      };
    }
  }

  const error = new Error(
    /youtube\.com|youtu\.be/i.test(url)
      ? "Cobalt public yêu cầu API key/JWT; YouTube fallback cũng không lấy được stream."
      : "Cobalt public yêu cầu API key/JWT. Với nền tảng này hiện chưa có fallback phù hợp."
  );
  error.statusCode = 502;
  error.payload = {
    trang_thai: "that_bai",
    loai: "cobalt_media",
    link_nguon: url,
    link_tai: null,
    link_audio: null,
    ma_loi: "COBALT_AUTH_REQUIRED",
    thong_bao: error.message,
    chi_tiet_upstream: cobaltError,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
  throw error;
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.url || req.query.user || req.query.username || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  const requestedPath = new URL(req.url || "/", `https://${req.headers.host || "api-zhee.vercel.app"}`).pathname.toLowerCase();
  const browserHeaders = BROWSER_HEADERS;
  if (requestedPath.includes("/cobalt")) {
    try {
      const payload = await downloadCobaltMedia(query);
      return res.status(200).json(payload);
    } catch (error) {
      if (/youtube\.com|youtu\.be/i.test(query || "")) {
        try { return await youtubeHandler(req, res); } catch (_) {}
      }
      return res.status(error.statusCode || 502).json(error.payload || {
        trang_thai: "that_bai",
        thong_bao: error.message,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập username (@username hoặc username) hoặc link video TikTok.",
      cu_phap: "https://{domain}/api/mxh/tiktok?={username_hoac_link}"
    });
  }

  try {
    // -------------------------------------------------------------
    // PHÂN BIỆT PROFILE VÀ VIDEO KHI TRUYỀN LINK TIKTOK
    // -------------------------------------------------------------
    const isTikTokUrl = /tiktok\.com|douyin\.com|iesdouyin\.com/i.test(query);
    const isTikTokShortUrl = /^https?:\/\/(?:vm|vt|m)\.tiktok\.com\//i.test(query);
    const isTikTokVideoUrl = (isTikTokUrl && /\/(?:video|v|photo)\/\d+/i.test(query)) || isTikTokShortUrl;

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: TẢI VIDEO TIKTOK (KHI TRUYỀN LINK VIDEO)
    // -------------------------------------------------------------
    if (isTikTokVideoUrl || /douyin\.com|iesdouyin\.com/i.test(query)) {
      let oembedData = null;
      if (/tiktok\.com/i.test(query)) {
        try {
          const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(query)}`);
          oembedData = oembedRes.ok ? await oembedRes.json().catch(() => null) : null;
        } catch (_) {}
      }

      let linkTai = null;
      let nguonTai = [];
      let tikwmMeta = null;
      try {
        const tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(query)}`, { headers: browserHeaders });
        const tikwmData = await tikwmRes.json();
        if (tikwmData.code === 0 && tikwmData.data) {
          tikwmMeta = tikwmData.data;
          linkTai = {
            video_khong_logo: tikwmData.data.play,
            video_hd: tikwmData.data.hdplay || tikwmData.data.play,
            nhac_mp3: tikwmData.data.music,
            anh: Array.isArray(tikwmData.data.images) ? tikwmData.data.images.filter(Boolean) : []
          };
          nguonTai.push("TikWM");
        }
      } catch (_) {}
      try {
        const cobaltRes = await fetch("https://api.cobalt.tools/", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ url: query, downloadMode: "auto" }),
          signal: AbortSignal.timeout(12000)
        });
        const cobalt = await cobaltRes.json().catch(() => ({}));
        if (cobaltRes.ok && (cobalt.url || cobalt.audio)) {
          linkTai = { ...(linkTai || {}), video_khong_logo: linkTai?.video_khong_logo || cobalt.url || null, video_hd: linkTai?.video_hd || cobalt.url || null, nhac_mp3: linkTai?.nhac_mp3 || cobalt.audio || null };
          nguonTai.push("Cobalt");
        }
      } catch (_) {}

      // TikTok app share links (vm/vt.tiktok.com) do not expose /photo/<id>
      // in the original URL. TikWM's images array is the reliable Photo Mode signal.
      const photoMode = /\/photo\/\d+/i.test(query) || Boolean(linkTai?.anh?.length);
      const hasMedia = Boolean(linkTai && (linkTai.video_khong_logo || linkTai.video_hd || linkTai.nhac_mp3 || (Array.isArray(linkTai.anh) && linkTai.anh.length)));
      return res.status(200).json({
        trang_thai: hasMedia ? "thanh_cong" : "that_bai",
        loai: photoMode ? "tiktok_photo" : /douyin\.com|iesdouyin\.com/i.test(query) ? "douyin_video" : "tiktok_video",
        nen_tang: /douyin\.com|iesdouyin\.com/i.test(query) ? "Douyin" : "TikTok",
        tieu_de: oembedData?.title || tikwmMeta?.title || "Video TikTok/Douyin",
        tac_gia: {
          ten_hien_thi: oembedData?.author_name || tikwmMeta?.author?.nickname || tikwmMeta?.author?.unique_id || "Không rõ",
          username: oembedData?.author_unique_id || tikwmMeta?.author?.unique_id || tikwmMeta?.author?.id || null,
          link_trang_ca_nhan: oembedData?.author_url || (tikwmMeta?.author?.unique_id ? `https://www.tiktok.com/@${tikwmMeta.author.unique_id}` : null)
        },
        anh_bia: oembedData?.thumbnail_url || tikwmMeta?.cover || tikwmMeta?.origin_cover || null,
        link_tai: linkTai || "Không thể lấy link tải trực tiếp từ TikWM/Cobalt.",
        nguon_tai: nguonTai,
        tac_gia_api: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: LẤY PROFILE VÀ VIDEO QUA USERNAME / LINK PROFILE
    // -------------------------------------------------------------
    const profileMatch = query.match(/tiktok\.com\/@([^/?#]+)/i);
    const cleanUser = String(profileMatch?.[1] || query).trim().replace(/^@+/, "");
    const profileUrl = `https://www.tiktok.com/@${cleanUser}`;

    const profileRes = await fetch(profileUrl, { headers: browserHeaders });
    const html = await profileRes.text();

    const regexUniversal = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/;
    const regexSigi = /<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/;

    let userInfo = null;
    let userStats = null;
    let secUid = "";

    if (regexUniversal.test(html)) {
      const json = JSON.parse(html.match(regexUniversal)[1]);
      const userDetail = json?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"];
      if (userDetail?.userInfo) {
        userInfo = userDetail.userInfo.user;
        userStats = userDetail.userInfo.stats;
        secUid = userInfo.secUid || "";
      }
    } else if (regexSigi.test(html)) {
      const json = JSON.parse(html.match(regexSigi)[1]);
      userInfo = json?.["UserModule"]?.users?.[cleanUser];
      userStats = json?.["UserModule"]?.stats?.[cleanUser];
      secUid = userInfo?.secUid || "";
    }

    if (!userInfo) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy tài khoản TikTok: @${cleanUser}`
      });
    }

    let videoList = [];
    if (secUid) {
      try {
        const feedUrl = `https://www.tiktok.com/api/post/item_list/?aid=1988&count=10&secUid=${encodeURIComponent(secUid)}&cursor=0`;
        const feedRes = await fetch(feedUrl, { headers: browserHeaders });
        const feedData = await feedRes.json();

        if (feedData.itemList && Array.isArray(feedData.itemList)) {
          videoList = feedData.itemList.map((v, idx) => ({
            stt: idx + 1,
            id_video: v.id,
            tieu_de: v.desc || "Không có tiêu đề",
            link_video: `https://www.tiktok.com/@${cleanUser}/video/${v.id}`,
            anh_bia: v.video?.cover || null,
            thoi_luong_giay: v.video?.duration || 0,
            luot_xem: v.stats?.playCount || 0,
            luot_thich: v.stats?.diggCount || 0
          }));
        }
      } catch (e) {
        const videoRegex = new RegExp(`https:\\/\\/www\\.tiktok\\.com\\/@${cleanUser}\\/video\\/(\\d+)`, "g");
        const found = [...new Set(html.match(videoRegex) || [])];
        videoList = found.slice(0, 10).map((link, idx) => ({
          stt: idx + 1,
          id_video: link.split("/").pop(),
          tieu_de: "Video TikTok",
          link_video: link
        }));
      }
    }

    const payload = {
      trang_thai: "thanh_cong",
      thong_tin_ca_nhan: {
        id: userInfo.id,
        tai_khoan: userInfo.uniqueId || cleanUser,
        ho_ten: userInfo.nickname || cleanUser,
        anh_dai_dien: userInfo.avatarLarger || userInfo.avatarMedium,
        link_trang_ca_nhan: `https://www.tiktok.com/@${userInfo.uniqueId || cleanUser}`,
        tieu_su: userInfo.signature || "Không có tiểu sử",
        tich_xanh: Boolean(userInfo.verified),
        tai_khoan_rieng_tu: Boolean(userInfo.privateAccount),
        nguoi_theo_doi: userStats?.followerCount || 0,
        dang_theo_doi: userStats?.followingCount || 0,
        tong_luot_thich: userStats?.heartCount || 0,
        tong_so_video: userStats?.videoCount || 0
      }
    };

    if (videoList.length > 0) {
      payload.tong_so_video_lay_duoc = videoList.length;
      payload.danh_sach_video_gan_nhat = videoList;
    }

    return res.status(200).json(payload);

  } catch (error) {
    return res.status(500).json({ trang_thai: "that_bai", thong_bao: error.message });
  }
};

module.exports.downloadCobaltMedia = downloadCobaltMedia;
module.exports.fetchTikwmMedia = fetchTikwmMedia;