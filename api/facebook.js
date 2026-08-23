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
      thong_bao: "Vui lòng nhập link video, profile hoặc username Facebook.",
      cu_phap: {
        check_user: "https://{domain}/api/mxh/facebook?={username_hoac_link_profile}",
        download_video: "https://{domain}/api/mxh/facebook?={link_video_reels_watch}"
      }
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
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: TẢI VIDEO / REELS / WATCH FACEBOOK (MP4 HD & SD)
    // -------------------------------------------------------------
    if (isVideo) {
      let downloadData = null;

      // Pipeline bóc tách luồng video đa nguồn
      try {
        const snapRes = await fetch("https://snapsave.app/action.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
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

      // Fallback engine nếu snapsave gặp hạn chế
      if (!downloadData) {
        try {
          const fdownRes = await fetch(`https://api.vkrdownloader.com/server?vkr=${encodeURIComponent(cleanQuery)}`);
          if (fdownRes.ok) {
            const vkr = await fdownRes.json();
            if (vkr.data?.downloads) {
              const dList = vkr.data.downloads;
              const hd = dList.find(d => d.format_id?.includes("hd") || d.quality?.includes("HD") || d.quality?.includes("720"));
              const sd = dList.find(d => d.format_id?.includes("sd") || d.quality?.includes("SD") || d.quality?.includes("360"));
              downloadData = {
                tieu_de: vkr.data.title || "Facebook Video",
                anh_thumbnail: vkr.data.thumbnail || null,
                thoi_luong: vkr.data.duration || null,
                video_mp4_hd: hd?.url || null,
                video_mp4_sd: sd?.url || dList[0]?.url || null
              };
            }
          }
        } catch (e) {}
      }

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
    // TRƯỜNG HỢP 2: PROFILE / FANPAGE LOOKUP & TÌM UID FACEBOOK
    // -------------------------------------------------------------
    let cleanUser = cleanQuery
      .replace(/^https?:\/\/(?:www\.|m\.|mobile\.)?facebook\.com\//, "")
      .replace(/^@+/, "")
      .replace(/profile\.php\?id=/, "")
      .split("/")[0]
      .split("?")[0];

    let uid = null;
    let name = cleanUser;

    // 1. Nếu query truyền vào là số UID sẵn
    if (/^\d{5,25}$/.test(cleanUser)) {
      uid = cleanUser;
    } else {
      // 2. Tìm UID từ username/link qua findid lookup engine
      try {
        const findIdRes = await fetch("https://id.traodoisub.net/api.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `link=${encodeURIComponent(`https://facebook.com/${cleanUser}`)}`
        });
        const findData = await findIdRes.json();
        if (findData.code === 200 && findData.id) {
          uid = findData.id;
        }
      } catch (e) {}

      // Fallback quét mã nguồn HTML nếu lookup thứ nhất bận
      if (!uid) {
        try {
          const profileRes = await fetch(`https://www.facebook.com/${cleanUser}`, { headers: browserHeaders });
          const html = await profileRes.text();
          const uidMatch = html.match(/"userID":"(\d+)"/) || html.match(/fb:\/\/profile\/(\d+)/) || html.match(/"entity_id":"(\d+)"/);
          if (uidMatch) uid = uidMatch[1];
          const nameMatch = html.match(/<title id="pageTitle">([^<]+)<\/title>/) || html.match(/<meta property="og:title" content="([^"]+)"/);
          if (nameMatch) name = nameMatch[1];
        } catch (e) {}
      }
    }

    if (!uid) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy thông tin hoặc UID cho Facebook: ${cleanUser}`
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "facebook_profile",
      thong_tin: {
        uid: uid,
        tai_khoan: cleanUser,
        ten_hien_thi: name,
        anh_dai_dien_hd: `https://graph.facebook.com/${uid}/picture?width=1080&height=1080&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
        anh_dai_dien_goc: `https://graph.facebook.com/${uid}/picture?type=large`,
        link_trang_ca_nhan: `https://facebook.com/${uid}`,
        link_app: `fb://profile/${uid}`
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};