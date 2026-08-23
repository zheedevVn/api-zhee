module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.url || req.query.user || req.query.username || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Username (@handle) hoặc link bài đăng/video trên Twitter (X).",
      cu_phap: {
        check_user: "https://{domain}/api/mxh/twitter?={username}",
        check_tweet: "https://{domain}/api/mxh/twitter?={link_tweet}"
      }
    });
  }

  const cleanQuery = query.trim();
  const isTweet = cleanQuery.includes("/status/") || cleanQuery.includes("/statuses/");

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: BÓC TÁCH BÀI ĐĂNG (TWEET) & LINK TẢI VIDEO MP4
    // -------------------------------------------------------------
    if (isTweet) {
      const tweetIdMatch = cleanQuery.match(/status(?:es)?\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

      if (!tweetId) {
        return res.status(400).json({
          trang_thai: "that_bai",
          thong_bao: "Không tìm thấy Tweet ID hợp lệ trong liên kết."
        });
      }

      // Khai thác qua engine FxTwitter API v2
      const apiRes = await fetch(`https://api.fxtwitter.com/status/${tweetId}`);
      if (!apiRes.ok) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: "Tweet không tồn tại, đã bị xóa hoặc tài khoản ở chế độ riêng tư."
        });
      }

      const data = await apiRes.json();
      const tweet = data.tweet || {};
      const author = tweet.author || {};

      // Phân loại danh sách hình ảnh & video MP4
      const danhSachAnh = [];
      const danhSachVideo = [];

      if (tweet.media?.photos) {
        tweet.media.photos.forEach((p, idx) => {
          danhSachAnh.push({ stt: idx + 1, url: p.url });
        });
      }

      if (tweet.media?.videos) {
        tweet.media.videos.forEach((v, idx) => {
          danhSachVideo.push({
            stt: idx + 1,
            anh_thumbnail: v.thumbnail_url,
            file_mp4_truc_tiep: v.url,
            dinh_dang: v.format
          });
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "tweet",
        thong_tin_tweet: {
          id_tweet: tweet.id,
          noi_dung: tweet.text || "",
          ngay_dang: tweet.created_at || null,
          ngon_ngu: tweet.lang || "N/A",
          link_goc: tweet.url,
          tac_gia: {
            id: author.id,
            ten_hien_thi: author.name,
            username: `@${author.screen_name}`,
            anh_dai_dien: author.avatar_url,
            link_trang_ca_nhan: `https://x.com/${author.screen_name}`
          },
          thong_ke: {
            luot_thich: tweet.likes || 0,
            luot_retweet: tweet.retweets || 0,
            luot_phan_hoi: tweet.replies || 0,
            luot_xem: tweet.views || 0
          }
        },
        media: {
          tong_so_anh: danhSachAnh.length,
          danh_sach_anh: danhSachAnh,
          tong_so_video: danhSachVideo.length,
          danh_sach_video_mp4: danhSachVideo
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: KIỂM TRA PROFILE NGƯỜI DÙNG TWITTER / X
    // -------------------------------------------------------------
    const cleanUser = cleanQuery
      .replace(/^https?:\/\/(?:twitter|x)\.com\//, "")
      .replace(/^@+/, "")
      .split("/")[0]
      .split("?")[0];

    const userRes = await fetch(`https://api.fxtwitter.com/${cleanUser}`);
    if (!userRes.ok) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy tài khoản Twitter/X: @${cleanUser}`
      });
    }

    const userData = await userRes.json();
    const u = userData.user || {};

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "twitter_user",
      thong_tin_ca_nhan: {
        id: u.id,
        tai_khoan: `@${u.screen_name}`,
        ho_ten: u.name,
        anh_dai_dien: u.avatar_url ? u.avatar_url.replace("_normal", "") : null,
        anh_banner: u.banner_url || null,
        tieu_su: u.description || "Không có tiểu sử",
        dia_chi: u.location || "Không có",
        trang_web: u.url || "Không có",
        ngay_tham_gia: u.joined || null,
        link_trang_ca_nhan: `https://x.com/${u.screen_name}`,
        thong_ke: {
          nguoi_theo_doi: u.followers || 0,
          dang_theo_doi: u.following || 0,
          tong_so_tweet: u.tweets || 0,
          luot_thich: u.likes || 0
        }
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};