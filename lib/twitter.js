/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
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
        check_user: "https://{domain}/api/mxh/twitter?user={username}",
        check_tweet: "https://{domain}/api/mxh/twitter?url={link_tweet}"
      }
    });
  }

  const cleanQuery = query.trim();
  const isTweet = cleanQuery.includes("/status/") || cleanQuery.includes("/statuses/");

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: BÓC TÁCH BÀI ĐĂNG (TWEET) & VIDEO MP4
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

      const danhSachAnh = (tweet.media?.photos || []).map((p, idx) => ({ stt: idx + 1, url: p.url }));
      const danhSachVideo = (tweet.media?.videos || []).map((v, idx) => ({
        stt: idx + 1,
        anh_thumbnail: v.thumbnail_url,
        file_mp4_truc_tiep: v.url,
        dinh_dang: v.format
      }));

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
    // TRƯỜNG HỢP 2: PROFILE USER + 10 TÀI KHOẢN ĐANG FOLLOW (FOLLOWING)
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

    // Bóc tách danh sách following qua các node scraper công khai
    let followingUsernames = [];
    const nitterNodes = [
      `https://nitter.poast.org/${cleanUser}/following`,
      `https://nitter.privacydev.net/${cleanUser}/following`
    ];

    for (const node of nitterNodes) {
      try {
        const fRes = await fetch(node, { headers: browserHeaders });
        if (fRes.ok) {
          const html = await fRes.text();
          const matches = [...html.matchAll(/class="username"[^>]*>@([a-zA-Z0-9_]+)<\/a>/g)];
          if (matches.length > 0) {
            followingUsernames = [...new Set(matches.map(m => m[1]))].filter(name => name.toLowerCase() !== cleanUser.toLowerCase()).slice(0, 10);
            break;
          }
        }
      } catch (err) {
        continue;
      }
    }

    // Lấy thông tin chi tiết của từng người trong 10 người đang follow
    let danhSach10Following = [];
    if (followingUsernames.length > 0) {
      const details = await Promise.allSettled(
        followingUsernames.map(async (fUser, idx) => {
          const infoRes = await fetch(`https://api.fxtwitter.com/${fUser}`);
          if (infoRes.ok) {
            const fData = await infoRes.json();
            const fu = fData.user || {};
            return {
              stt: idx + 1,
              id: fu.id,
              tai_khoan: `@${fu.screen_name || fUser}`,
              ho_ten: fu.name || fUser,
              anh_dai_dien: fu.avatar_url ? fu.avatar_url.replace("_normal", "") : null,
              tieu_su: fu.description || "Không có tiểu sử",
              nguoi_theo_doi: fu.followers || 0,
              dang_theo_doi: fu.following || 0,
              link_trang_ca_nhan: `https://x.com/${fu.screen_name || fUser}`
            };
          }
          return {
            stt: idx + 1,
            tai_khoan: `@${fUser}`,
            link_trang_ca_nhan: `https://x.com/${fUser}`
          };
        })
      );
      danhSach10Following = details.filter(d => d.status === "fulfilled").map(d => d.value);
    }

    const payload = {
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
    };

    if (danhSach10Following.length > 0) {
      payload.tong_so_following_lay_duoc = danhSach10Following.length;
      payload.danh_sach_10_nguoi_dang_follow = danhSach10Following;
    } else {
      payload.ghi_chu_following = "Tài khoản không follow ai hoặc danh sách following đang ở chế độ hạn chế bởi X.";
    }

    return res.status(200).json(payload);

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};