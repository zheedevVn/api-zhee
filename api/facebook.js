module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  
  // Trích xuất tham số query và tham số code/cookie/token
  let query = req.query.url || req.query.user || req.query.id || req.query[""] || null;
  let userAuth = req.query.code || req.query.cookie || req.query.token || null;

  if (rawQuery) {
    const parts = rawQuery.split("&");
    if (!query) {
      query = decodeURIComponent(parts[0].replace(/^=/, "").trim());
    }
    for (const part of parts) {
      if (part.startsWith("code=") || part.startsWith("code?=")) {
        userAuth = decodeURIComponent(part.replace(/^code\??=/, "").trim());
      } else if (part.startsWith("cookie=")) {
        userAuth = decodeURIComponent(part.replace(/^cookie=/, "").trim());
      } else if (part.startsWith("token=")) {
        userAuth = decodeURIComponent(part.replace(/^token=/, "").trim());
      }
    }
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập UID, Username hoặc Link video Facebook.",
      cu_phap: {
        cong_khai: "https://{domain}/api/mxh/facebook?={link_hoac_username}",
        kem_xac_thuc_cookie_token: "https://{domain}/api/mxh/facebook?={link_video}&code={cookie_hoac_token}"
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
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate"
  };

  if (userAuth && (userAuth.includes("c_user=") || userAuth.includes("xs="))) {
    browserHeaders["Cookie"] = userAuth;
  }

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: TẢI VIDEO FACEBOOK (HỖ TRỢ COOKIE / TOKEN)
    // -------------------------------------------------------------
    if (isVideo) {
      let downloadData = null;

      // Cách 1: Sử dụng Cookie/Session của người dùng bóc tách trực tiếp HTML payload
      if (userAuth) {
        try {
          const videoRes = await fetch(cleanQuery, { headers: browserHeaders });
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

      // Cách 2: Parse engine qua Snapsave
      if (!downloadData) {
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
                phuong_thuc: "Bóc tách tự động",
                anh_thumbnail: thumbMatch ? thumbMatch[1] : null,
                video_mp4_hd: hdMatch ? hdMatch[1] : null,
                video_mp4_sd: sdMatch ? sdMatch[1] : null
              };
            }
          }
        } catch (e) {}
      }

      // Cách 3: Fallback qua API VKR
      if (!downloadData) {
        try {
          const vkrRes = await fetch(`https://api.vkrdownloader.com/server?vkr=${encodeURIComponent(cleanQuery)}`);
          if (vkrRes.ok) {
            const vkr = await vkrRes.json();
            if (vkr.data?.downloads) {
              const dList = vkr.data.downloads;
              const hd = dList.find(d => d.format_id?.includes("hd") || d.quality?.includes("HD"));
              const sd = dList.find(d => d.format_id?.includes("sd") || d.quality?.includes("SD"));
              downloadData = {
                phuong_thuc: "Serverless CDN Proxy",
                tieu_de: vkr.data.title || "Facebook Video",
                anh_thumbnail: vkr.data.thumbnail || null,
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
          thong_bao: "Không tìm thấy video hoặc video ở chế độ riêng tư/chặn quốc gia. Vui lòng kèm &code={cookie_hoac_token} để truy cập.",
          cu_phap_goi_y: `https://api-zhee.vercel.app/api/mxh/facebook?=${cleanQuery}&code={cookie_cua_ban}`
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
    // TRƯỜNG HỢP 2: PROFILE / UID / USERNAME QUA API ENGINE
    // -------------------------------------------------------------
    let cleanInput = cleanQuery
      .replace(/^https?:\/\/(?:www\.|m\.|mobile\.)?facebook\.com\//, "")
      .replace(/^@+/, "")
      .replace(/^profile\.php\?id=/, "")
      .split("/")[0]
      .split("?")[0]
      .trim();

    let uid = /^\d{5,25}$/.test(cleanInput) ? cleanInput : null;
    let fullName = null;
    const targetUrl = `https://www.facebook.com/${cleanInput}`;

    if (!uid) {
      const lookupApis = [
        async () => {
          const r = await fetch("https://id.traodoisub.net/api.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `link=${encodeURIComponent(targetUrl)}`
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

    const tokenList = [
      userAuth && userAuth.startsWith("EA") ? userAuth : null,
      "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662",
      "EAAAAAYsX7TsBO"
    ].filter(Boolean);

    for (const token of tokenList) {
      try {
        const graphRes = await fetch(`https://graph.facebook.com/v19.0/${uid}?fields=name,username,link&access_token=${token}`);
        if (graphRes.ok) {
          const gData = await graphRes.json();
          if (gData.name) {
            fullName = gData.name;
            if (gData.username) cleanInput = gData.username;
            break;
          }
        }
      } catch (e) {}
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "facebook_profile",
      thong_tin: {
        uid: uid,
        tai_khoan: cleanInput,
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