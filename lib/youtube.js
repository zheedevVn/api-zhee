const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
let youtubeClientPromise;

function getYoutubeClient() {
  if (!youtubeClientPromise) {
    youtubeClientPromise = (async () => {
      // Load lazily so a packaging/runtime issue in the optional stream
      // decoder cannot take down the whole API function.
      const { Innertube, Platform } = require("youtubei.js");
      // YouTube frequently signs stream URLs. YouTube.js needs an evaluator
      // to decode the short-lived signature before a browser can play it.
      Platform.shim.eval = async (data) => new Function(data.output)();
      return Innertube.create({ lang: "en", location: "US" });
    })();
  }
  return youtubeClientPromise;
}

async function getDirectVideoStream(videoId) {
  const youtube = await getYoutubeClient();
  const format = await youtube.getStreamingData(videoId, {
    type: "video+audio",
    quality: "best",
    format: "mp4"
  });
  return {
    url: format?.url || null,
    quality: format?.quality_label || null,
    mimeType: format?.mime_type || null
  };
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.url || req.query.user || req.query.channel || req.query.username || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập link video hoặc handle kênh YouTube.",
      cu_phap: "https://{domain}/api/mxh/youtube?={link_hoac_handle}",
      tac_gia: AUTHOR
    });
  }

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+478"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: LINK VIDEO YOUTUBE
    // -------------------------------------------------------------
    const isVideo = query.includes("watch?v=") || query.includes("youtu.be/") || query.includes("/shorts/");
    
    if (isVideo) {
      let videoId = null;
      if (query.includes("youtu.be/")) {
        videoId = query.split("youtu.be/")[1]?.split("?")[0];
      } else if (query.includes("watch?v=")) {
        videoId = query.split("watch?v=")[1]?.split("&")[0];
      } else if (query.includes("/shorts/")) {
        videoId = query.split("/shorts/")[1]?.split("?")[0];
      }

      const cleanVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      let directMp4 = null;
      let directAudio = null;
      let directVideoQuality = null;
      let videoTitle = "YouTube Video";
      let videoAuthor = "Chưa xác định";

      try {
        const ytRes = await fetch(cleanVideoUrl, { headers: browserHeaders });
        const html = await ytRes.text();

        const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (playerMatch) {
          const playerData = JSON.parse(playerMatch[1]);
          videoTitle = playerData.videoDetails?.title || videoTitle;
          videoAuthor = playerData.videoDetails?.author || videoAuthor;

          const formats = playerData.streamingData?.formats || [];
          const adaptiveFormats = playerData.streamingData?.adaptiveFormats || [];

          const progressiveMp4 = formats.find(f => f.mimeType?.includes("video/mp4") && f.url);
          if (progressiveMp4) directMp4 = progressiveMp4.url;

          const audioFormat = adaptiveFormats.find(f => f.mimeType?.includes("audio/mp4") && f.url);
          if (audioFormat) directAudio = audioFormat.url;
        }
      } catch (err) {}

      if (!directMp4) {
        try {
          const stream = await Promise.race([
            getDirectVideoStream(videoId),
            new Promise((_, reject) => setTimeout(() => reject(new Error("stream_timeout")), 12000))
          ]);
          directMp4 = stream.url;
          directVideoQuality = stream.quality;
        } catch (_) {}
      }

      if (!directMp4) {
        const fallbackNodes = [
          "https://invidious.jing.rocks",
          "https://inv.nadeko.net",
          "https://invidious.futo.org"
        ];

        for (const node of fallbackNodes) {
          try {
            const apiRes = await fetch(`${node}/api/v1/videos/${videoId}`, { headers: browserHeaders });
            if (apiRes.ok) {
              const data = await apiRes.json();
              videoTitle = data.title || videoTitle;
              videoAuthor = data.author || videoAuthor;

              const streams = data.formatStreams || [];
              const chosenStream = streams.find(s => s.container === "mp4") || streams[0];
              if (chosenStream?.url) directMp4 = chosenStream.url;

              const adaptive = data.adaptiveFormats || [];
              const chosenAudio = adaptive.find(a => a.type?.includes("audio/mp4") || a.type?.includes("audio/webm"));
              if (chosenAudio?.url) directAudio = chosenAudio.url;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      if (videoTitle === "YouTube Video") {
        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${cleanVideoUrl}&format=json`);
          const oembedData = oembedRes.ok ? await oembedRes.json().catch(() => null) : null;
          if (oembedData) {
            videoTitle = oembedData.title || videoTitle;
            videoAuthor = oembedData.author_name || videoAuthor;
          }
        } catch (_) {
          // Metadata is optional; never fail a video response because oEmbed is unavailable.
        }
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "video",
        thong_tin_video: {
          id_video: videoId,
          tieu_de: videoTitle,
          tac_gia: videoAuthor,
          link_xem_goc: cleanVideoUrl,
          anh_thumbnail: {
            chuan_maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            chuan_hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            mac_dinh: `https://img.youtube.com/vi/${videoId}/default.jpg`
          }
        },
        link_tai_truc_tiep: {
          file_mp4_video: directMp4,
          chat_luong_video: directVideoQuality || (directMp4 ? "Tự động tốt nhất" : null),
          file_mp3_audio: directAudio || null,
          trang_thai_link_video: directMp4 ? "Link tạm thời, nên tải ngay" : "Không lấy được luồng video hiện tại"
        },
        tac_gia: AUTHOR
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: PROFILE KÊNH YOUTUBE
    // -------------------------------------------------------------
    let cleanHandle = query.trim().replace(/^@+/, "");
    const channelPageUrl = `https://www.youtube.com/@${cleanHandle}`;

    const pageRes = await fetch(channelPageUrl, { headers: browserHeaders });
    const html = await pageRes.text();

    let channelInfo = null;
    let videoList = [];

    const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    if (jsonMatch) {
      try {
        const ytData = JSON.parse(jsonMatch[1]);
        const header = ytData.header?.c4TabbedHeaderRenderer || ytData.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
        const metadata = ytData.metadata?.channelMetadataRenderer;

        const title = metadata?.title || header?.title?.text || cleanHandle;
        const avatar = metadata?.avatar?.thumbnails?.[0]?.url || header?.image?.decoratedAvatarViewModel?.avatar?.avatar?.image?.sources?.[0]?.url || null;
        const desc = metadata?.description || "Không có mô tả";
        const channelId = metadata?.externalId || html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1] || null;

        channelInfo = {
          id_kenh: channelId,
          ten_kenh: title,
          handle: `@${cleanHandle}`,
          anh_dai_dien: avatar,
          mo_ta: desc,
          link_kenh: metadata?.channelUrl || channelPageUrl
        };

        const tabList = ytData.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
        for (const tab of tabList) {
          const content = tab.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.gridRenderer?.items || [];
          for (const item of content) {
            const v = item.gridVideoRenderer;
            if (v && v.videoId) {
              videoList.push({
                stt: videoList.length + 1,
                id_video: v.videoId,
                tieu_de: v.title?.runs?.[0]?.text || "Video YouTube",
                link_video: `https://www.youtube.com/watch?v=${v.videoId}`,
                anh_bia: v.thumbnail?.thumbnails?.pop()?.url || null
              });
            }
          }
        }
      } catch (e) {}
    }

    if (!channelInfo) {
      const channelId = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1] || null;
      if (!channelId) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy kênh YouTube: @${cleanHandle}`,
          tac_gia: AUTHOR
        });
      }

      channelInfo = {
        id_kenh: channelId,
        ten_kenh: `@${cleanHandle}`,
        handle: `@${cleanHandle}`,
        link_kenh: channelPageUrl
      };
    }

    const payload = {
      trang_thai: "thanh_cong",
      thong_tin_kenh: channelInfo
    };

    if (videoList.length > 0) {
      payload.tong_so_video_lay_duoc = videoList.length;
      payload.danh_sach_video = videoList.slice(0, 10);
    } else {
      payload.thong_bao_video = "Kênh này hiện chưa đăng tải video công khai nào.";
    }

    payload.tac_gia = AUTHOR;
    return res.status(200).json(payload);

  } catch (error) {
    return res.status(500).json({ trang_thai: "that_bai", thong_bao: error.message, tac_gia: AUTHOR });
  }
};