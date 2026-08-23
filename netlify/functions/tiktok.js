exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Tự động nhận diện từ: ?={input}, ?url={input}, ?user={input}
  let query = params.url || params.user || params.username || params[""] || null;

  if (!query && event.rawQuery) {
    query = decodeURIComponent(event.rawQuery.replace(/^=/, "").trim());
  }

  // Nếu thiếu tham số
  if (!query) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập link video hoặc username TikTok.",
        cach_dung: {
          check_video: "https://api-zhee.netlify.app/tiktok?={link_video_tiktok}",
          check_user: "https://api-zhee.netlify.app/tiktok?={username_tiktok}"
        }
      }, null, 2)
    };
  }

  try {
    // TRƯỜNG HỢP 1: TRUYỀN LINK VIDEO (tiktok.com/...)
    if (query.includes("tiktok.com")) {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(query)}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (data.code !== 0) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            trang_thai: "that_bai",
            thong_bao: "Không thể lấy thông tin video TikTok. Vui lòng kiểm tra lại đường link."
          }, null, 2)
        };
      }

      const v = data.data;

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          trang_thai: "thanh_cong",
          loai_du_lieu: "video",
          tac_gia: {
            id: v.author.id,
            username: v.author.unique_id,
            ten_hien_thi: v.author.nickname,
            anh_dai_dien: v.author.avatar
          },
          thong_tin_video: {
            id_video: v.id,
            tieu_de: v.title,
            thoi_luong_giay: v.duration,
            anh_bia: v.cover,
            ngay_dang: new Date(v.create_time * 1000).toLocaleString("vi-VN"),
            thong_ke: {
              luot_xem: v.play_count,
              luot_tim: v.digg_count,
              binh_luan: v.comment_count,
              chia_se: v.share_count,
              luot_tai: v.download_count
            }
          },
          am_thanh: {
            id: v.music_info.id,
            ten_bai_hat: v.music_info.title,
            tac_gia: v.music_info.author,
            link_audio_mp3: v.music
          },
          link_tai_video: {
            video_khong_logo: v.play,
            video_chuan_hd: v.hdplay || v.play,
            video_goc_co_logo: v.wmplay
          }
        }, null, 2)
      };
    } 

    // TRƯỜNG HỢP 2: TRUYỀN USERNAME (@username hoặc username)
    else {
      const cleanUser = query.replace(/^@/, "").trim();
      const apiUrl = `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanUser)}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (data.code !== 0 || !data.data) {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            trang_thai: "that_bai",
            thong_bao: `Không tìm thấy tài khoản TikTok: @${cleanUser}`
          }, null, 2)
        };
      }

      const u = data.data.user;
      const s = data.data.stats;

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          trang_thai: "thanh_cong",
          loai_du_lieu: "tai_khoan",
          thong_tin_ca_nhan: {
            id: u.id,
            username: u.uniqueId,
            ten_hien_thi: u.nickname,
            anh_dai_dien: u.avatarLarger || u.avatarMedium,
            tieu_su: u.signature || "Không có tiểu sử",
            link_trang_ca_nhan: `https://www.tiktok.com/@${u.uniqueId}`,
            tich_xanh: u.verified,
            tai_khoan_rieng_tu: u.privateAccount
          },
          thong_ke: {
            dang_theo_doi: s.followingCount,
            nguoi_theo_doi: s.followerCount,
            tong_luot_thich: s.heartCount,
            tong_so_video: s.videoCount
          }
        }, null, 2)
      };
    }
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