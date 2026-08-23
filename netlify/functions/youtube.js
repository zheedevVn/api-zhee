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
    // TRƯỜNG HỢP 1: LINK VIDEO (LẤY LINK TẢI TRỰC TIẾP MP4 / MP3)
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

      // 1. Lấy metadata video
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${cleanVideoUrl}&format=json`);
      const oembedData = oembedRes.ok ? await oembedRes.json().catch(() => null) : null;

      // 2. Gọi backend Cobalt để lấy link trực tiếp file mp4 và mp3
      let directMp4 = null;
      let directMp3 = null;

      try {
        const cobaltApis = [
          "https://co.wuk.sh/api/json",
          "https://api.cobalt.tools/api/json"
        ];

        // Lấy link MP4
        for (const endpoint of cobaltApis) {
          try {
            const mp4Res = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                url: cleanVideoUrl,
                vQuality: "720"
              })
            });
            const resData = await mp4Res.json();
            if (resData.url) {
              directMp4 = resData.url;
              break;
            }
          } catch (err) {}
        }

        // Lấy link MP3
        for (const endpoint of cobaltApis) {
          try {
            const mp3Res = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                url: cleanVideoUrl,
                isAudioOnly: true,
                aFormat: "mp3"
              })
            });
            const resData = await mp3Res.json();
            if (resData.url) {
              directMp3 = resData.url;
              break;
            }
          } catch (err) {}
        }
      } catch (e) {}

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
            tieu_de: oembedData?.title || "YouTube Video",
            tac_gia: oembedData?.author_name || "Chưa xác định",
            link_kenh: oembedData?.author_url || null,
            link_goc: cleanVideoUrl,
            anh_thumbnail: {
              chuan_maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              chuan_hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              mac_dinh: oembedData?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/default.jpg`
            }
          },
          link_tai_truc_tiep: {
            file_mp4_720p: directMp4 || `https://api.vevioz.com/api/button/mp4/${videoId}`,
            file_mp3_audio: directMp3 || `https://api.vevioz.com/api/button/mp3/${videoId}`
          }
        }, null, 2)
      };
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: LẤY PROFILE KÊNH + VIDEO THEO HANDLE
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
                anh_bia: v.thumbnail?.thumbnails?.pop()?.url || null,
                thoi_luong: v.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || "N/A",
                luot_xem: v.viewCountText?.simpleText || "Chưa có lượt xem"
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