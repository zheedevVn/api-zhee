module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // 1. Phân giải toàn bộ query string thủ công để tránh mất mát ký tự đặc biệt
  const fullUrl = req.url || "";
  let queryTarget = "";
  let userAuth = "";

  if (fullUrl.includes("?")) {
    const searchParams = new URLSearchParams(fullUrl.slice(fullUrl.indexOf("?")));
    
    // Lấy query chính (vị trí đầu tiên hoặc key "")
    for (const [key, value] of searchParams.entries()) {
      if (key === "" || key === "url" || key === "user" || key === "id") {
        if (!queryTarget) queryTarget = value || key;
      } else if (key === "code" || key === "token" || key === "cookie") {
        userAuth = value;
      }
    }

    // Fallback cắt chuỗi thuần túy nếu dùng cú pháp ?=value&code=...
    if (!queryTarget) {
      const rawQuery = fullUrl.split("?")[1] || "";
      const parts = rawQuery.split("&code=");
      queryTarget = decodeURIComponent(parts[0].replace(/^=/, "").trim());
      if (parts[1]) userAuth = decodeURIComponent(parts[1].trim());
    }
  }

  if (!queryTarget) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập UID, Username hoặc Link Facebook.",
      cu_phap: "https://{domain}/api/mxh/facebook?={username_hoac_link}&code={cookie_hoac_token}"
    });
  }

  const cleanTarget = queryTarget.trim();
  const isVideo = cleanTarget.includes("/videos/") || 
                  cleanTarget.includes("/reel/") || 
                  cleanTarget.includes("/reels/") || 
                  cleanTarget.includes("/watch") || 
                  cleanTarget.includes("fb.watch/") ||
                  cleanTarget.includes("/posts/");

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  if (userAuth && (userAuth.includes("c_user=") || userAuth.includes("datr="))) {
    browserHeaders["Cookie"] = userAuth;
  }

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: TẢI VIDEO FACEBOOK
    // -------------------------------------------------------------
    if (isVideo) {
      let downloadData = null;

      if (userAuth && browserHeaders["Cookie"]) {
        try {
          const videoRes = await fetch(cleanTarget, { headers: browserHeaders });
          const html = await videoRes.text();
          const hdMatch = html.match(/"browser_native_hd_url":"([^"]+)"/) || html.match(/"playable_url_quality_hd":"([^"]+)"/);
          const sdMatch = html.match(/"browser_native_sd_url":"([^"]+)"/) || html.match(/"playable_url":"([^"]+)"/);
          const thumbMatch = html.match(/"preferred_thumbnail":{"image":{"uri":"([^"]+)"/);
          const decodeUrl = (u) => u ? JSON.parse(`"${u}"`) : null;

          if (hdMatch || sdMatch) {
            downloadData = {
              phuong_thuc: "Xác thực qua Cookie/Session trực tiếp",
              anh_thumbnail: decodeUrl(thumbMatch?.[1]),
              video_mp4_hd: decodeUrl(hdMatch?.[1]),
              video_mp4_sd: decodeUrl(sdMatch?.[1]) || decodeUrl(hdMatch?.[1])
            };
          }
        } catch (e) {}
      }

      if (!downloadData) {
        try {
          const snapRes = await fetch("https://snapsave.app/action.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
            body: `url=${encodeURIComponent(cleanTarget)}`
          });
          if (snapRes.ok) {
            const snapHtml = await snapRes.text();
            const hdMatch = snapHtml.match(/href="([^"]+)"[^>]*>Download HD/i) || snapHtml.match(/href="([^"]+)"[^>]*>HD/i);
            const sdMatch = snapHtml.match(/href="([^"]+)"[^>]*>Download SD/i) || snapHtml.match(/href="([^"]+)"[^>]*>SD/i);
            const thumbMatch = snapHtml.match(/src="([^"]+)"/);
            if (hdMatch || sdMatch) {
              downloadData = {
                phuong_thuc: "Bóc tách tự động",
                anh_thumbnail: thumbMatch ? thumbMatch[1] : null,
                video_mp4_hd: hdMatch ? hdMatch[1] : null,
                video_mp4_sd: sdMatch ? sdMatch[1] : null
              };
            }
          }
        } catch (e) {}
      }

      if (!downloadData) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: "Không tìm thấy video. Hãy đính kèm &code={cookie_hoac_token} nếu video ở chế độ riêng tư."
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "facebook_video",
        link_goc: cleanTarget,
        ket_qua_tai: downloadData
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: PROFILE / UID / USERNAME FACEBOOK
    // -------------------------------------------------------------
    let cleanInput = cleanTarget
      .replace(/^https?:\/\/(?:www\.|m\.|mobile\.|touch\.)?facebook\.com\//, "")
      .replace(/^@+/, "")
      .replace(/^profile\.php\?id=/, "")
      .split("/")[0]
      .split("?")[0]
      .trim();

    let uid = /^\d{5,25}$/.test(cleanInput) ? cleanInput : null;
    let fullName = null;
    let verifiedViaToken = false;

    // A. NẾU USER TRUYỀN TOKEN (EAAG...) -> GỌI THẲNG GRAPH API CHÍNH CHỦ
    if (userAuth && userAuth.startsWith("EA")) {
      try {
        const tokenRes = await fetch(`https://graph.facebook.com/v19.0/${cleanInput}?fields=id,name,username,link&access_token=${userAuth}`);
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.id) {
            uid = tokenData.id;
            fullName = tokenData.name;
            if (tokenData.username) cleanInput = tokenData.username;
            verifiedViaToken = true;
          }
        }
      } catch (e) {}
    }

    // B. NẾU CHƯA CÓ UID -> SỬ DỤNG CÁC ENGINE TRA CỨU ĐA TẦNG
    if (!uid) {
      // 1. Cổng F-ID Lookup Engine
      try {
        const fidRes = await fetch(`https://api.findids.net/api/get-uid-from-username?username=${encodeURIComponent(cleanInput)}`);
        const fidData = await fidRes.json();
        if (fidData.data?.id || fidData.id) {
          uid = String(fidData.data?.id || fidData.id).trim();
        }
      } catch (e) {}

      // 2. TraoDoiSub ID Engine
      if (!uid) {
        try {
          const tdsRes = await fetch("https://id.traodoisub.net/api.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `link=${encodeURIComponent(`https://facebook.com/${cleanInput}`)}`
          });
          const tdsData = await tdsRes.json();
          if (tdsData.code === 200 && tdsData.id) {
            uid = String(tdsData.id).trim();
          }
        } catch (e) {}
      }

      // 3. Quét trực tiếp qua Mobile Gateway (sử dụng Cookie nếu có)
      if (!uid) {
        try {
          const profileRes = await fetch(`https://mbasic.facebook.com/${cleanInput}`, { headers: browserHeaders });
          const html = await profileRes.text();
          const uidMatch = html.match(/"userID":"(\d+)"/) || 
                           html.match(/fb:\/\/profile\/(\d+)/) || 
                           html.match(/entity_id=(\d+)/) ||
                           html.match(/id=(\d{5,25})/);
          if (uidMatch) uid = uidMatch[1];
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch && !titleMatch[1].includes("Facebook") && !titleMatch[1].includes("Đăng nhập")) {
            fullName = titleMatch[1].trim();
          }
        } catch (e) {}
      }
    }

    if (!uid) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy UID cho tài khoản Facebook: ${cleanInput}`
      });
    }

    // C. LẤY TÊN HIỂN THỊ NẾU CHƯA CÓ
    if (!fullName) {
      const fallbackTokens = [
        "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662",
        "EAAAAAYsX7TsBO"
      ];
      for (const t of fallbackTokens) {
        try {
          const gRes = await fetch(`https://graph.facebook.com/v19.0/${uid}?fields=name,username&access_token=${t}`);
          if (gRes.ok) {
            const gData = await gRes.json();
            if (gData.name) {
              fullName = gData.name;
              break;
            }
          }
        } catch (e) {}
      }
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "facebook_profile",
      thong_tin: {
        uid: uid,
        tai_khoan: cleanInput,
        ten_hien_thi: fullName || `Người dùng Facebook (${uid})`,
        xac_thuc_token_rieng: verifiedViaToken,
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