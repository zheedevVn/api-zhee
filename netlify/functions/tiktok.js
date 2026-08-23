exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Tự động nhận diện input
  let query = params.url || params.user || params.username || params[""] || null;
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
        thong_bao: "Vui lòng nhập username (@username hoặc username) hoặc link video TikTok.",
        cu_phap: "https://api-zhee.netlify.app/tiktok?={username_hoac_link}"
      }, null, 2)
    };
  }

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: LINK VIDEO TIKTOK (TẢI KHÔNG LOGO)
    // -------------------------------------------------------------
    if (query.includes("tiktok.com")) {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(query)}`);
      const oembedData = oembedRes.ok ? await oembedRes.json().catch(() => null) : null;

      let linkTai = "Đang cập nhật link tải trực tiếp";
      try {
        const tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(query)}`, { headers: browserHeaders });
        const tikwmData = await tikwmRes.json();
        if (tikwmData.code === 0 && tikwmData.data) {
          linkTai = {
            video_khong_logo: tikwmData.data.play,
            video_hd: tikwmData.data.hdplay || tikwmData.data.play,
            nhac_mp3: tikwmData.data.music
          };
        }
      } catch (e) {}

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          trang_thai: "thanh_cong",
          loai: "video",
          tieu_de: oembedData?.title || "Video TikTok",
          tac_gia: {
            ten_hien_thi: oembedData?.author_name || "TikTok User",
            username: oembedData?.author_unique_id || null,
            link_trang_ca_nhan: oembedData?.author_url || null
          },
          anh_bia: oembedData?.thumbnail_url || null,
          link_tai: linkTai
        }, null, 2)
      };
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: PROFILE TIKTOK + TẤT CẢ LINK VIDEO GẦN NHẤT
    // -------------------------------------------------------------
    const cleanUser = query.trim().replace(/^@+/, "");
    const profileUrl = `https://www.tiktok.com/@${cleanUser}`;

    const profileRes = await fetch(profileUrl, { headers: browserHeaders });
    const html = await profileRes.text();

    const regexUniversal = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/;
    const regexSigi = /<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/;

    let userInfo = null;
    let userStats = null;
    let rawItems = [];

    if (regexUniversal.test(html)) {
      const json = JSON.parse(html.match(regexUniversal)[1]);
      const defaultScope = json?.["__DEFAULT_SCOPE__"] || {};
      const userDetail = defaultScope["webapp.user-detail"] || {};
      const userPost = defaultScope["webapp.user-post"] || {};

      if (userDetail.userInfo) {
        userInfo = userDetail.userInfo.user;
        userStats = userDetail.userInfo.stats;
      }

      // Quét video từ cả user-detail và user-post
      if (Array.isArray(userDetail.itemList)) {
        rawItems = userDetail.itemList;
      } else if (Array.isArray(userPost.itemList)) {
        rawItems = userPost.itemList;
      } else if (userDetail.itemModule) {
        rawItems = Object.values(userDetail.itemModule);
      }
    } else if (regexSigi.test(html)) {
      const json = JSON.parse(html.match(regexSigi)[1]);
      userInfo = json?.["UserModule"]?.users?.[cleanUser];
      userStats = json?.["UserModule"]?.stats?.[cleanUser];
      if (json["ItemModule"]) {
        rawItems = Object.values(json["ItemModule"]);
      }
    }

    if (!userInfo) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy tài khoản TikTok: @${cleanUser}`
        }, null, 2)
      };
    }

    // Bóc tách link và thông tin từng video (tối đa 10 video)
    const danhSachVideo = rawItems.slice(0, 10).map((item, index) => {
      const videoId = typeof item === "string" ? item : (item.id || item.video_id);
      const title = typeof item === "object" ? (item.desc || item.title || "Không có tiêu đề") : "Video TikTok";
      const cover = typeof item === "object" ? (item.video?.cover || item.cover || null) : null;
      const plays = typeof item === "object" ? (item.stats?.playCount || item.play_count || 0) : 0;
      const likes = typeof item === "object" ? (item.stats?.diggCount || item.digg_count || 0) : 0;

      return {
        stt: index + 1,
        id_video: videoId,
        tieu_de: title,
        link_video: `https://www.tiktok.com/@${cleanUser}/video/${videoId}`,
        anh_bia: cover,
        luot_xem: plays,
        luot_thich: likes
      };
    }).filter(v => v.id_video);

    const responseData = {
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

    if (danhSachVideo.length > 0) {
      responseData.tong_so_video_lay_duoc = danhSachVideo.length;
      responseData.danh_sach_video_gan_nhat = danhSachVideo;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify(responseData, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        trang_thai: "that_bai",
        thong_bao: error.message
      }, null, 2)
    };
  }
};