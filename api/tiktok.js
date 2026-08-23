exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Tự động nhận diện chuỗi tìm kiếm
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
        thong_bao: "Vui lòng nhập username hoặc link video TikTok.",
        cu_phap: "https://api-zhee.netlify.app/tiktok?={username_hoac_link}"
      }, null, 2)
    };
  }

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.tiktok.com/"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: TẢI VIDEO KHI TRUYỀN LINK TRỰC TIẾP
    // -------------------------------------------------------------
    if (query.includes("tiktok.com")) {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(query)}`);
      const oembedData = oembedRes.ok ? await oembedRes.json().catch(() => null) : null;

      let linkTai = null;
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
          link_tai: linkTai || "Không thể lấy link tải trực tiếp"
        }, null, 2)
      };
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: LẤY PROFILE VÀ DANH SÁCH VIDEO TỪ USERNAME
    // -------------------------------------------------------------
    const cleanUser = query.trim().replace(/^@+/, "");
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
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy tài khoản TikTok: @${cleanUser}`
        }, null, 2)
      };
    }

    // Bóc tách video qua API Post Feed của TikTok bằng secUid
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
            luot_thich: v.stats?.diggCount || 0,
            binh_luan: v.stats?.commentCount || 0
          }));
        }
      } catch (e) {
        // Fallback: Quét link video qua biểu thức chính quy trực tiếp trong HTML
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