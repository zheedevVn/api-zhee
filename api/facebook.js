module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.url || req.query.user || req.query.id || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập UID, link profile hoặc username Facebook.",
      cu_phap: "https://{domain}/api/mxh/facebook?={uid_hoac_username}"
    });
  }

  const cleanQuery = query.trim();
  const isVideo = cleanQuery.includes("/videos/") || 
                  cleanQuery.includes("/reel/") || 
                  cleanQuery.includes("/reels/") || 
                  cleanQuery.includes("/watch") || 
                  cleanQuery.includes("fb.watch/") ||
                  cleanQuery.includes("/posts/");

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: TẢI VIDEO FACEBOOK
    // -------------------------------------------------------------
    if (isVideo) {
      let downloadData = null;
      try {
        const snapRes = await fetch("https://snapsave.app/action.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
          body: `url=${encodeURIComponent(cleanQuery)}`
        });
        if (snapRes.ok) {
          const snapHtml = await snapRes.text();
          const hdMatch = snapHtml.match(/href="([^"]+)"[^>]*>Download HD/i) || snapHtml.match(/href="([^"]+)"[^>]*>HD/i);
          const sdMatch = snapHtml.match(/href="([^"]+)"[^>]*>Download SD/i) || snapHtml.match(/href="([^"]+)"[^>]*>SD/i);
          const thumbMatch = snapHtml.match(/src="([^"]+)"/);
          if (hdMatch || sdMatch) {
            downloadData = {
              anh_thumbnail: thumbMatch ? thumbMatch[1] : null,
              video_mp4_hd: hdMatch ? hdMatch[1] : null,
              video_mp4_sd: sdMatch ? sdMatch[1] : null
            };
          }
        }
      } catch (e) {}

      if (!downloadData) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: "Không thể lấy link video. Video có thể ở chế độ riêng tư hoặc link không hợp lệ."
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "facebook_video",
        link_goc: cleanQuery,
        ket_qua_tai: downloadData
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: PROFILE / UID / USERNAME FACEBOOK
    // -------------------------------------------------------------
    let cleanInput = cleanQuery
      .replace(/^https?:\/\/(?:www\.|m\.|mobile\.|touch\.)?facebook\.com\//, "")
      .replace(/^@+/, "")
      .replace(/^profile\.php\?id=/, "")
      .split("/")[0]
      .split("?")[0]
      .trim();

    let uid = null;
    let fullName = null;
    let actualUsername = cleanInput;

    const isNumeric = /^\d{5,25}$/.test(cleanInput);

    if (isNumeric) {
      uid = cleanInput;
    } else {
      // Tìm UID từ username/slug
      try {
        const findIdRes = await fetch("https://id.traodoisub.net/api.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `link=${encodeURIComponent(`https://facebook.com/${cleanInput}`)}`
        });
        const findData = await findIdRes.json();
        if (findData.code === 200 && findData.id) {
          uid = findData.id;
        }
      } catch (e) {}
    }

    // Quét dữ liệu qua giao diện mbasic / touch của Facebook để lấy Name và Meta
    const profileEndpoints = isNumeric
      ? [`https://mbasic.facebook.com/profile.php?id=${uid}`, `https://www.facebook.com/${uid}`]
      : [`https://mbasic.facebook.com/${cleanInput}`, `https://www.facebook.com/${cleanInput}`];

    for (const endpoint of profileEndpoints) {
      try {
        const fbRes = await fetch(endpoint, { headers: browserHeaders });
        const html = await fbRes.text();

        // Bóc tách tên hiển thị
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && !titleMatch[1].includes("Facebook") && !titleMatch[1].includes("Đăng nhập")) {
          fullName = titleMatch[1].trim();
        }

        const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
        if (ogTitleMatch && !fullName) {
          fullName = ogTitleMatch[1].trim();
        }

        // Bóc tách UID nếu đầu vào là username
        if (!uid) {
          const uidMatch = html.match(/"userID":"(\d+)"/) || 
                           html.match(/fb:\/\/profile\/(\d+)/) || 
                           html.match(/entity_id=(\d+)/) ||
                           html.match(/"entity_id":"(\d+)"/);
          if (uidMatch) uid = uidMatch[1];
        }

        if (fullName && uid) break;
      } catch (err) {
        continue;
      }
    }

    if (!uid) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy thông tin hoặc UID cho đối tượng Facebook: ${cleanInput}`
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "facebook_profile",
      thong_tin: {
        uid: uid,
        tai_khoan: actualUsername,
        ten_hien_thi: fullName || `Người dùng Facebook (${uid})`,
        anh_dai_dien: {
          chat_luong_cao: `https://graph.facebook.com/${uid}/picture?width=1080&height=1080&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
          chuan_large: `https://graph.facebook.com/${uid}/picture?type=large`,
          chuan_normal: `https://graph.facebook.com/${uid}/picture?type=normal`
        },
        link_trang_ca_nhan: `https://www.facebook.com/profile.php?id=${uid}`,
        link_app_mobile: `fb://profile/${uid}`
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};