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
        thong_bao: "Vui lòng nhập username (@username hoặc username) hoặc link video TikTok.",
        cu_phap: "https://api-zhee.netlify.app/tiktok?={username_hoac_link}"
      }, null, 2)
    };
  }

  const defaultHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*"
  };

  try {
    // 1. NẾU LÀ LINK VIDEO TIKTOK
    if (query.includes("tiktok.com")) {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(query)}`, { headers: defaultHeaders });
      const data = await res.json();

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

    // 2. NẾU LÀ USERNAME (Xử lý sạch dấu @, khoảng trắng)
    const cleanUser = query.trim().replace(/^@+/, "");

    // Gọi API lấy danh sách bài đăng & thông tin user từ TikWM User Feed
    const feedRes = await fetch(`https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(cleanUser)}&count=10`, { headers: defaultHeaders });
    const feedData = await feedRes.json();

    let userInfo = null;
    let videoList = [];

    if (feedData.code === 0 && feedData.data) {
      const videos = feedData.data.videos || [];
      videoList = videos.slice(0, 10).map((v, index) => ({
        stt: index + 1,
        id_video: v.video_id || v.id,
        tieu_de: v.title || "Không có tiêu đề",
        link_video: `https://www.tiktok.com/@${cleanUser}/video/${v.video_id || v.id}`,
        anh_bia: v.cover,
        luot_xem: v.play_count || 0,
        luot_thich: v.digg_count || 0,
        link_tai_khong_logo: v.play || null
      }));

      // Nếu có video, lấy thông tin tác giả từ video đầu
      if (videos.length > 0 && videos[0].author) {
        const a = videos[0].author;
        userInfo = {
          tai_khoan: a.unique_id || cleanUser,
          ho_ten: a.nickname || cleanUser,
          anh_dai_dien: a.avatar,
          link_trang_ca_nhan: `https://www.tiktok.com/@${a.unique_id || cleanUser}`
        };
      }
    }

    // Nếu chưa lấy được thông tin cá nhân thì cào trực tiếp từ HTML TikTok
    if (!userInfo) {
      const profileRes = await fetch(`https://www.tiktok.com/@${cleanUser}`, { headers: defaultHeaders });
      const html = await profileRes.text();

      const regexUniversal = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/;
      const regexSigi = /<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/;

      let u = null;
      let s = null;

      if (regexUniversal.test(html)) {
        const json = JSON.parse(html.match(regexUniversal)[1]);
        const userDetail = json?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"];
        if (userDetail?.userInfo) {
          u = userDetail.userInfo.user;
          s = userDetail.userInfo.stats;
        }
      } else if (regexSigi.test(html)) {
        const json = JSON.parse(html.match(regexSigi)[1]);
        const userModule = json["UserModule"] || {};
        u = userModule.users ? userModule.users[cleanUser] : null;
        s = userModule.stats ? userModule.stats[cleanUser] : null;
      }

      if (!u) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ trang_thai: "that_bai", thong_bao: `Không tìm thấy tài khoản TikTok: @${cleanUser}` }, null, 2)
        };
      }

      userInfo = {
        id: u.id,
        tai_khoan: u.uniqueId,
        ho_ten: u.nickname,
        anh_dai_dien: u.avatarLarger || u.avatarMedium,
        link_trang_ca_nhan: `https://www.tiktok.com/@${u.uniqueId}`,
        tieu_su: u.signature || "Không có tiểu sử",
        tich_xanh: Boolean(u.verified),
        tai_khoan_rieng_tu: Boolean(u.privateAccount),
        nguoi_theo_doi: s?.followerCount || 0,
        dang_theo_doi: s?.followingCount || 0,
        tong_luot_thich: s?.heartCount || 0,
        tong_so_video: s?.videoCount || 0
      };
    }

    const result = {
      trang_thai: "thanh_cong",
      thong_tin_ca_nhan: userInfo
    };

    // Chỉ hiển thị danh sách video nếu có video
    if (videoList.length > 0) {
      result.so_video_lay_duoc = videoList.length;
      result.danh_sach_video_gan_nhat = videoList;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify(result, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ trang_thai: "that_bai", thong_bao: error.message }, null, 2)
    };
  }
};