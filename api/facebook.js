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
      thong_bao: "Vui lòng nhập UID, Username hoặc Link Facebook.",
      cu_phap: "https://{domain}/api/mxh/facebook?={uid_hoac_username}"
    });
  }

  const cleanQuery = query.trim();
  const isVideo = cleanQuery.includes("/videos/") || 
                  cleanQuery.includes("/reel/") || 
                  cleanQuery.includes("/reels/") || 
                  cleanQuery.includes("/watch") || 
                  cleanQuery.includes("fb.watch/");

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
          thong_bao: "Không tìm thấy video hoặc video ở chế độ riêng tư."
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

    // 1. Phân giải Username -> UID qua các cổng API chuyên dụng
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
        },
        async () => {
          const r = await fetch(`https://lookup-id.com/`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `fburl=${encodeURIComponent(targetUrl)}&check=Lookup`
          });
          const text = await r.text();
          const match = text.match(/id="code" class="result-box">(\d+)</) || text.match(/(\d{10,20})/);
          return match ? match[1] : null;
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

    // 2. Lấy Tên hiển thị thật qua Facebook Graph OpenData API
    const tokenList = [
      "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662",
      "EAAAAAYsX7TsBO",
      "EAAD6V7os0gcBO"
    ];

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

    // Fallback tên qua OpenGraph Title
    if (!fullName) {
      try {
        const ogRes = await fetch(`https://graph.facebook.com/${uid}/picture?redirect=false`);
        if (ogRes.ok) {
          const pic = await ogRes.json();
          if (pic?.data?.url) {
            fullName = `Facebook User (${uid})`;
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
        ten_hien_thi: fullName || `Người dùng (${uid})`,
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