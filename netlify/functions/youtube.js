exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};

  // Tự động nhận diện input: ?={input}, ?url={input}, ?user={input}, ?channel={input}
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
        thong_bao: "Vui lòng nhập tên kênh (@handle/channel_id) hoặc link video YouTube.",
        cach_dung: {
          check_kenh: "https://api-zhee.netlify.app/youtube?={handle_kenh}",
          check_video: "https://api-zhee.netlify.app/youtube?={link_video_youtube}"
        }
      }, null, 2)
    };
  }

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: LẤY THÔNG TIN VIDEO YOUTUBE (HOẶC LINK SHORTS)
    // -------------------------------------------------------------
    const isVideo = query.includes("watch?v=") || query.includes("youtu.be/") || query.includes("/shorts/");
    
    if (isVideo) {
      // Trích xuất Video ID
      let videoId = null;
      if (query.includes("youtu.be/")) {
        videoId = query.split("youtu.be/")[1]?.split("?")[0];
      } else if (query.includes("watch?v=")) {
        videoId = query.split("watch?v=")[1]?.split("&")[0];
      } else if (query.includes("/shorts/")) {
        videoId = query.split("/shorts/")[1]?.split("?")[0];
      }

      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl);

      if (!res.ok) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ trang_thai: "that_bai", thong_bao: "Không tìm thấy video hoặc video ở chế độ riêng tư." }, null, 2)
        };
      }

      const v = await res.json();

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          trang_thai: "thanh_cong",
          loai: "video",
          thong_tin_video: {
            id_video: videoId,
            tieu_de: v.title,
            tac_gia: v.author_name,
            link_kenh: v.author_url,
            link_xem_video: `https://www.youtube.com/watch?v=${videoId}`,
            link_nhung: `https://www.youtube.com/embed/${videoId}`,
            anh_thumbnail: {
              chuan_hd: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              chuan_hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              mac_dinh: v.thumbnail_url
            }
          }
        }, null, 2)
      };
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: LẤY THÔNG TIN KÊNH + 10 VIDEO MỚI NHẤT QUA RSS FEED
    // -------------------------------------------------------------
    let cleanHandle = query.trim();
    if (!cleanHandle.startsWith("@") && !cleanHandle.startsWith("UC")) {
      cleanHandle = `@${cleanHandle}`;
    }

    const channelPageUrl = `https://www.youtube.com/${cleanHandle}`;
    const pageRes = await fetch(channelPageUrl, { headers: browserHeaders });
    const html = await pageRes.text();

    // Tìm Channel ID từ mã nguồn trang
    const channelIdMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
    const channelId = channelIdMatch ? channelIdMatch[1] : (query.startsWith("UC") ? query : null);

    if (!channelId) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy kênh YouTube: ${query}`
        }, null, 2)
      };
    }

    // Đọc RSS Feed chính thức của YouTube (Không bao giờ bị chặn, trả về cực nhanh)
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const rssRes = await fetch(rssUrl, { headers: browserHeaders });
    const xml = await rssRes.text();

    // Bóc tách tên kênh & link
    const channelTitle = xml.match(/<title>(.*?)<\/title>/)?.[1] || cleanHandle;
    const authorUri = xml.match(/<uri>(.*?)<\/uri>/)?.[1] || channelPageUrl;

    // Bóc tách danh sách các video mới nhất
    const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    const videoList = entryMatches.slice(0, 10).map((entry, index) => {
      const vidId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";
      const vidTitle = entry.match(/<title>(.*?)<\/title>/)?.[1] || "Video YouTube";
      const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || "";
      const views = entry.match(/<media:community>[\s\S]*?<media:statistics views="(\d+)"/)?.[1] || 0;

      return {
        stt: index + 1,
        id_video: vidId,
        tieu_de: vidTitle,
        link_video: `https://www.youtube.com/watch?v=${vidId}`,
        anh_bia: `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`,
        luot_xem: Number(views),
        ngay_dang: published ? new Date(published).toLocaleString("vi-VN") : null
      };
    });

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
        thong_tin_kenh: {
          id_kenh: channelId,
          ten_kenh: channelTitle,
          handle: cleanHandle,
          link_kenh: authorUri,
          rss_feed: rssUrl
        },
        tong_so_video_lay_duoc: videoList.length,
        danh_sach_video_moi_nhat: videoList
      }, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ trang_thai: "that_bai", thong_bao: error.message }, null, 2)
    };
  }
};