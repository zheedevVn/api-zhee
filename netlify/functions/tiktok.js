exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
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

  const defaultHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  try {
    // TRƯỜNG HỢP 1: LẤY THÔNG TIN / LINK TẢI VIDEO TIKTOK
    if (query.includes("tiktok.com")) {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(query)}`;
      const res = await fetch(apiUrl, { headers: defaultHeaders });
      const rawText = await res.text();
      
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error("Dịch vụ tải video đang bảo trì hoặc link không hợp lệ.");
      }

      if (data.code !== 0 || !data.data) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ trang_thai: "that_bai", thong_bao: "Không tìm thấy video hoặc video ở chế độ riêng tư." }, null, 2)
        };
      }

      const v = data.data;
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          trang_thai: "thanh_cong",
          loai: "video",
          tac_gia: {
            username: v.author.unique_id,
            ten_hien_thi: v.author.nickname,
            anh_dai_dien: v.author.avatar
          },
          video: {
            id: v.id,
            tieu_de: v.title,
            thoi_luong: v.duration,
            anh_bia: v.cover,
            luot_xem: v.play_count,
            luot_thich: v.digg_count,
            binh_luan: v.comment_count,
            chia_se: v.share_count
          },
          link_tai: {
            video_khong_logo: v.play,
            video_hd: v.hdplay || v.play,
            nhac_mp3: v.music
          }
        }, null, 2)
      };
    }

    // TRƯỜNG HỢP 2: LẤY THÔNG TIN USER TIKTOK
    const cleanUser = query.replace(/^@/, "").trim();
    const tiktokProfileUrl = `https://www.tiktok.com/@${cleanUser}`;
    
    const profileRes = await fetch(tiktokProfileUrl, { headers: defaultHeaders });
    const html = await profileRes.text();

    // Bóc tách JSON được nhúng sẵn trong HTML của TikTok
    const regexUniversal = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/;
    const regexSigi = /<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/;
    
    let userInfo = null;
    let userStats = null;

    if (regexUniversal.test(html)) {
      const match = html.match(regexUniversal);
      const json = JSON.parse(match[1]);
      const defaultScope = json["__DEFAULT_SCOPE__"] || {};
      const userDetail = defaultScope["webapp.user-detail"];
      if (userDetail && userDetail.userInfo) {
        userInfo = userDetail.userInfo.user;
        userStats = userDetail.userInfo.stats;
      }
    } else if (regexSigi.test(html)) {
      const match = html.match(regexSigi);
      const json = JSON.parse(match[1]);
      const userModule = json["UserModule"] || {};
      userInfo = userModule.users ? userModule.users[cleanUser] : null;
      userStats = userModule.stats ? userModule.stats[cleanUser] : null;
    }

    if (!userInfo) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy thông tin tài khoản TikTok: @${cleanUser}`
        }, null, 2)
      };
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
        loai: "tai_khoan",
        thong_tin_ca_nhan: {
          id: userInfo.id,
          username: userInfo.uniqueId,
          ten_hien_thi: userInfo.nickname,
          anh_dai_dien: userInfo.avatarLarger || userInfo.avatarMedium,
          tieu_su: userInfo.signature || "Không có tiểu sử",
          link_trang_ca_nhan: `https://www.tiktok.com/@${userInfo.uniqueId}`,
          tich_xanh: Boolean(userInfo.verified),
          tai_khoan_rieng_tu: Boolean(userInfo.privateAccount)
        },
        thong_ke: {
          dang_theo_doi: userStats?.followingCount || 0,
          nguoi_theo_doi: userStats?.followerCount || 0,
          tong_luot_thich: userStats?.heartCount || 0,
          tong_so_video: userStats?.videoCount || 0
        }
      }, null, 2)
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