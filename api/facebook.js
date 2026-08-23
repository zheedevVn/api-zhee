module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // 1. Phân giải URL lấy chính xác Target và Auth Cookie/Token
  const rawUrl = req.url || "";
  let queryTarget = "";
  let userAuth = "";

  if (rawUrl.includes("?")) {
    const queryPart = rawUrl.substring(rawUrl.indexOf("?") + 1);
    
    // Bóc tách code/cookie/token
    const codeIndex = queryPart.indexOf("&code=");
    if (codeIndex !== -1) {
      queryTarget = decodeURIComponent(queryPart.substring(0, codeIndex).replace(/^=/, "").trim());
      userAuth = decodeURIComponent(queryPart.substring(codeIndex + 6).trim());
    } else {
      queryTarget = decodeURIComponent(queryPart.replace(/^=/, "").trim());
    }
  }

  // Fallback nếu người dùng dùng query params chuẩn
  if (!queryTarget && req.query) {
    queryTarget = req.query.url || req.query.user || req.query.id || req.query[""] || "";
  }
  if (!userAuth && req.query) {
    userAuth = req.query.code || req.query.cookie || req.query.token || "";
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

  // Cấu hình headers giả lập phiên đăng nhập máy tính / mobile
  const sessionHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Ch-Ua": "\"Not-A.Brand\";v=\"99\", \"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\"",
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "\"Windows\"",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };

  const isCookie = userAuth.includes("c_user=") || userAuth.includes("datr=");
  const isToken = userAuth.startsWith("EA") || userAuth.startsWith("EAA");

  if (isCookie) {
    sessionHeaders["Cookie"] = userAuth;
  }

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: TẢI VIDEO FACEBOOK
    // -------------------------------------------------------------
    if (isVideo) {
      let downloadData = null;

      // Xác thực tải bằng Cookie/Session
      if (isCookie) {
        try {
          const videoRes = await fetch(cleanTarget, { headers: sessionHeaders });
          const html = await videoRes.text();

          const hdMatch = html.match(/"browser_native_hd_url":"([^"]+)"/) || html.match(/"playable_url_quality_hd":"([^"]+)"/);
          const sdMatch = html.match(/"browser_native_sd_url":"([^"]+)"/) || html.match(/"playable_url":"([^"]+)"/);
          const thumbMatch = html.match(/"preferred_thumbnail":{"image":{"uri":"([^"]+)"/);
          const decodeUrl = (u) => u ? JSON.parse(`"${u}"`) : null;

          if (hdMatch || sdMatch) {
            downloadData = {
              phuong_thuc: "Xác thực Cookie thành công",
              anh_thumbnail: decodeUrl(thumbMatch?.[1]),
              video_mp4_hd: decodeUrl(hdMatch?.[1]),
              video_mp4_sd: decodeUrl(sdMatch?.[1]) || decodeUrl(hdMatch?.[1])
            };
          }
        } catch (e) {}
      }

      // Snapsave Engine fallback
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
          thong_bao: "Không thể lấy link video. Vui lòng kiểm tra lại Cookie/Token hoặc link bài đăng."
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
    // TRƯỜNG HỢP 2: PROFILE / UID / USERNAME CHECK (HỖ TRỢ COOKIE & TOKEN)
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
    let authMethod = "Khách (Công khai)";

    // 1. NẾU CÓ TOKEN (EAAG / EAAA...): GỌI TRỰC TIẾP GRAPH API
    if (isToken) {
      try {
        const tokenRes = await fetch(`https://graph.facebook.com/v19.0/${cleanInput}?fields=id,name,username,link&access_token=${userAuth}`);
        if (tokenRes.ok) {
          const tData = await tokenRes.json();
          if (tData.id) {
            uid = tData.id;
            fullName = tData.name;
            if (tData.username) cleanInput = tData.username;
            authMethod = "Facebook Access Token";
          }
        }
      } catch (e) {}
    }

    // 2. NẾU CÓ COOKIE: GỬI REQUEST TRỰC TIẾP BẰNG PHIÊN ĐĂNG NHẬP ĐỂ LẤY FULL PROFILE
    if (isCookie) {
      authMethod = "Facebook Cookie Session";
      try {
        const cookieUidMatch = userAuth.match(/c_user=(\d+)/);
        
        // Truy cập trang mbasic profile bằng Cookie
        const checkUrl = uid 
          ? `https://mbasic.facebook.com/profile.php?id=${uid}` 
          : `https://mbasic.facebook.com/${cleanInput}`;

        const fbRes = await fetch(checkUrl, { headers: sessionHeaders });
        const html = await fbRes.text();

        // Lấy Tên hiển thị thật từ HTML đăng nhập
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && !titleMatch[1].includes("Facebook") && !titleMatch[1].includes("Đăng nhập") && !titleMatch[1].includes("Log in")) {
          fullName = titleMatch[1].trim();
        }

        // Bóc tách UID nếu chưa có
        if (!uid) {
          const uidMatch = html.match(/owner_id=(\d+)/) || 
                           html.match(/id=(\d{5,25})/) || 
                           html.match(/;subject_id=(\d+)/) ||
                           html.match(/"userID":"(\d+)"/);
          if (uidMatch) uid = uidMatch[1];
        }

        if (!uid && cleanInput === "me" && cookieUidMatch) {
          uid = cookieUidMatch[1];
        }
      } catch (e) {}
    }

    // 3. NẾU CHƯA CÓ UID -> TRA CỨU QUA CÁC CỔNG API LOOKUP
    if (!uid) {
      const lookupApis = [
        async () => {
          const r = await fetch("https://id.traodoisub.net/api.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `link=${encodeURIComponent(`https://facebook.com/${cleanInput}`)}`
          });
          const d = await r.json();
          return d.code === 200 ? d.id : null;
        },
        async () => {
          const r = await fetch(`https://api.findids.net/api/get-uid-from-username?username=${encodeURIComponent(cleanInput)}`);
          const d = await r.json();
          return d.data?.id || d.id || null;
        }
      ];

      for (const api of lookupApis) {
        try {
          const foundId = await api();
          if (foundId) {
            uid = String(foundId).trim();
            break;
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

    // 4. LẤY TÊN HIỂN THỊ NẾU CHƯA CÓ
    if (!fullName || fullName === "Lỗi") {
      const systemTokens = [
        "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662",
        "EAAAAAYsX7TsBO"
      ];
      for (const t of systemTokens) {
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
        ten_hien_thi: (fullName && fullName !== "Lỗi") ? fullName : `Người dùng Facebook (${uid})`,
        che_do_xac_thuc: authMethod,
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