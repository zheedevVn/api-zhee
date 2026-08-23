exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};

  let query = params.url || params.user || params.channel || params.username || params[""] || null;
  if (!query && event.rawQuery) {
    query = decodeURIComponent(event.rawQuery.replace(/^=/, "").trim());
  }

  if (!query) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập link video hoặc handle kênh YouTube.",
        cu_phap: "https://api-zhee.netlify.app/youtube?={link_hoac_handle}"
      }, null, 2)
    };
  }

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cookie": "CONSENT=YES+1"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: LINK VIDEO (LẤY TRỰC TIẾP LINK FILE MP4 & MP3)
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

      // Danh sách các Invidious instances công khai ổn định
      const instances = [
        "https://inv.tux.pizza",
        "https://invidious.nerdvpn.de",
        "https://invidious.jing.rocks",
        "https://vid.puffyan.us"
      ];

      let videoDetails = null;
      let streamData = null;

      for (const instance of instances) {
        try {
          const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
            headers: browserHeaders
          });
          if (res.ok) {
            const data = await res.json();
            videoDetails = data;
            streamData = data.formatStreams || [];
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Lọc link MP4 có kèm cả tiếng (chất lượng 720p hoặc 360p)
      let directMp4 = null;
      if (streamData && streamData.length > 0) {
        const mp4Stream = streamData.find(s => s.resolution === "720p" && s.container === "mp4") ||
                          streamData.find(s => s.container === "mp4") ||
                          streamData[0];
        directMp4 = mp4Stream?.url || null;
      }

      // Lọc link Audio MP3 / M4A stream
      let directAudio = null;
      if (videoDetails?.adaptiveFormats) {
        const audioStream = videoDetails.adaptiveFormats.find(f => f.type?.includes("audio/mp4") || f.type?.includes("audio/webm"));
        directAudio = audioStream?.url || null;
      }

      // Lấy thông tin dự phòng qua OEmbed nếu không có videoDetails
      let title = videoDetails?.title;
      let author = videoDetails?.author;
      if (!title) {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${cleanVideoUrl}&format=json`);
        const oembedData = oembedRes.ok ? await oembedRes.json().catch(() => null) : null;
        title = oembedData?.title || "YouTube Video";
        author = oembedData?.author_name || "Chưa xác định";
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        },
        body: JSON.stringify({
          trang_thai: "thanh_cong",
          loai: "video",
          thong_tin_video: {
            id_video: videoId,
            tieu_de: title,
            tac_gia: author,
            thoi_luong_giay: videoDetails?.lengthSeconds || 0,
            luot_xem: videoDetails?.viewCount || 0,
            link_goc: cleanVideoUrl,
            anh_thumbnail: {
              chuan_maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              chuan_hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              mac_dinh: `https://img.youtube.com/vi/${videoId}/default.jpg`
            }
          },
          link_tai_truc_tiep: {
            file_mp4_video: directMp4 || `https://yewtu.be/latest_version?id=${videoId}&itag=22`,
            file_audio_nhac: directAudio || `https://yewtu.be/latest_version?id=${videoId}&itag=140`
          }
        }, null, 2)
      };
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
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            trang_thai: "that_bai",
            thong_bao: `Không tìm thấy kênh YouTube: @${cleanHandle}`
          }, null, 2)
        };
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

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify(payload, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ trang_thai: "that_bai", thong_bao: error.message }, null, 2)
    };
  }
};