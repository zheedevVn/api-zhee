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
    "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+478"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: LINK VIDEO (BÓC TÁCH FILE MP4 / AUDIO TRỰC TIẾP)
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
      let videoTitle = "YouTube Video";
      let videoAuthor = "Chưa xác định";

      // BƯỚC 1: Lấy dữ liệu trực tiếp từ YouTube Player Data
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

          // Tìm định dạng MP4 có cả hình và tiếng
          const progressiveMp4 = formats.find(f => f.mimeType?.includes("video/mp4") && f.url);
          if (progressiveMp4) {
            directMp4 = progressiveMp4.url;
          }

          // Tìm định dạng Audio trực tiếp
          const audioFormat = adaptiveFormats.find(f => f.mimeType?.includes("audio/mp4") && f.url);
          if (audioFormat) {
            directAudio = audioFormat.url;
          }
        }
      } catch (err) {}

      // BƯỚC 2: Fallback qua Invidious API nếu luồng YouTube mã hóa chữ ký số (Signature Cipher)
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
              if (chosenStream?.url) {
                directMp4 = chosenStream.url;
              }

              const adaptive = data.adaptiveFormats || [];
              const chosenAudio = adaptive.find(a => a.type?.includes("audio/mp4") || a.type?.includes("audio/webm"));
              if (chosenAudio?.url) {
                directAudio = chosenAudio.url;
              }
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      // Metadata dự phòng qua OEmbed nếu các nguồn trên chưa bóc được tên
      if (videoTitle === "YouTube Video") {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${cleanVideoUrl}&format=json`);
        const oembedData = oembedRes.ok ? await oembedRes.json().catch(() => null) : null;
        if (oembedData) {
          videoTitle = oembedData.title || videoTitle;
          videoAuthor = oembedData.author_name || videoAuthor;
        }
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
            file_mp4_video: directMp4 || `https://invidious.jing.rocks/latest_version?id=${videoId}&itag=18`,
            file_mp3_audio: directAudio || `https://invidious.jing.rocks/latest_version?id=${videoId}&itag=140`
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