exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Tự động nhận diện input từ: ?={input}, ?user={input}, ?url={input}
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
        thong_bao: "Vui lòng cung cấp username TikTok hoặc link video.",
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
    // ------------------------------------------------------------------
    // TRƯỜNG HỢP 1: LẤY THÔNG TIN / TẢI VIDEO (KHI TRUYỀN LINK TIKTOK)
    // ------------------------------------------------------------------
    if (query.includes("tiktok.com")) {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(query)}`);
      let oembedData = null;
      if (oembedRes.ok) {
        oembedData = await oembedRes.json().catch(() => null);
      }

      // Thử lấy link tải không logo qua API TikWM
      let downloadLinks = null;
      try {
        const tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(query)}`, { headers: browserHeaders });
        const rawTikwm = await tikwmRes.text();
        if (rawTikwm.startsWith("{")) {
          const tikwmData = JSON.parse(rawTikwm);
          if (tikwmData.code === 0 && tikwmData.data) {
            const v = tikwmData.data;
            downloadLinks = {
              video_khong_logo: v.play,
              video_hd: v.hdplay || v.play,
              nhac_mp3: v.music
            };
          }
        }
      } catch (e) {
        downloadLinks = null;
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        },
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
          link_tai: downloadLinks || "Đang cập nhật link tải trực tiếp"
        }, null, 2)
      };
    }

    // ------------------------------------------------------------------
    // TRƯỜNG HỢP 2: LẤY THÔNG TIN PROFILE + VIDEO GẦN NHẤT (USER)
    // ------------------------------------------------------------------
    const cleanUser = query.trim().replace(/^@+/, "");
    const profileUrl = `https://www.tiktok.com/@${cleanUser}`;

    // Lấy thông tin cơ bản đảm bảo 100% qua endpoint OEmbed chính thức của TikTok
    const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`);
    if (!oembedRes.ok) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          trang_thai: "that_bai",
          thong_bao: `Không tìm thấy tài khoản TikTok: @${cleanUser}`
        }, null, 2)
      };
    }

    const oembedData = await oembedRes.json();

    // Bóc tách thêm dữ liệu chi tiết (Followers, Likes, Video list) từ HTML gốc
    let extraStats = null;
    let videoList = [];

    try {
      const htmlRes = await fetch(profileUrl, { headers: browserHeaders });
      const html = await htmlRes.text();

      const regexUniversal = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/;
      const regexSigi = /<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/;

      if (regexUniversal.test(html)) {
        const json = JSON.parse(html.match(regexUniversal)[1]);
        const userDetail = json?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"];
        if (userDetail) {
          const u = userDetail.userInfo?.user;
          const s = userDetail.userInfo?.stats;
          extraStats = {
            id: u?.id,
            anh_dai_dien: u?.avatarLarger || u?.avatarMedium,
            tieu_su: u?.signature || "Không có tiểu sử",
            tich_xanh: Boolean(u?.verified),
            tai_khoan_rieng_tu: Boolean(u?.privateAccount),
            nguoi_theo_doi: s?.followerCount || 0,
            dang_theo_doi: s?.followingCount || 0,
            tong_luot_thich: s?.heartCount || 0,
            tong_so_video: s?.videoCount || 0
          };

          const items = userDetail.itemList || [];
          const itemModule = userDetail.itemModule || {};
          videoList = items.slice(0, 10).map((id, idx) => ({
            stt: idx + 1,
            id_video: id,
            tieu_de: itemModule[id]?.desc || "Không có tiêu đề",
            link_video: `https://www.tiktok.com/@${cleanUser}/video/${id}`,
            luot_xem: itemModule[id]?.stats?.playCount || 0
          }));
        }
      } else if (regexSigi.test(html)) {
        const json = JSON.parse(html.match(regexSigi)[1]);
        const s = json["UserModule"]?.stats?.[cleanUser];
        const u = json["UserModule"]?.users?.[cleanUser];
        if (u) {
          extraStats = {
            id: u.id,
            anh_dai_dien: u.avatarLarger || u.avatarMedium,
            tieu_su: u.signature || "Không có tiểu sử",
            tich_xanh: Boolean(u.verified),
            tai_khoan_rieng_tu: Boolean(u.privateAccount),
            nguoi_theo_doi: s?.followerCount || 0,
            dang_theo_doi: s?.followingCount || 0,
            tong_luot_thich: s?.heartCount || 0,
            tong_so_video: s?.videoCount || 0
          };
        }
      }
    } catch (e) {
      // Bỏ qua lỗi cào sâu, vẫn trả về dữ liệu OEmbed chuẩn
    }

    const payload = {
      trang_thai: "thanh_cong",
      thong_tin_ca_nhan: {
        id: extraStats?.id || null,
        tai_khoan: cleanUser,
        ho_ten: oembedData.author_name || cleanUser,
        anh_dai_dien: extraStats?.anh_dai_dien || null,
        link_trang_ca_nhan: profileUrl,
        tieu_su: extraStats?.tieu_su || "Không có tiểu sử",
        tich_xanh: extraStats?.tich_xanh || false,
        tai_khoan_rieng_tu: extraStats?.tai_khoan_rieng_tu || false,
        nguoi_theo_doi: extraStats?.nguoi_theo_doi || 0,
        dang_theo_doi: extraStats?.dang_theo_doi || 0,
        tong_luot_thich: extraStats?.tong_luot_thich || 0,
        tong_so_video: extraStats?.tong_so_video || 0
      }
    };

    if (videoList.length > 0) {
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