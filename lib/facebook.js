module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  let queryTarget = "";
  let userToken = "";

  // Bóc tách URL chính xác không làm hỏng chuỗi Token
  if (fullUrl.includes("?")) {
    const rawQuery = fullUrl.substring(fullUrl.indexOf("?") + 1);
    
    // Tách tham số code/token
    const tokenMatch = rawQuery.match(/[?&](?:code|token)=([^&]+)/);
    if (tokenMatch) {
      userToken = decodeURIComponent(tokenMatch[1]).trim();
    }

    // Tách target (username / link / UID)
    const firstParam = rawQuery.split("&")[0];
    queryTarget = decodeURIComponent(firstParam.replace(/^(?:url|user|id)?=/, "").trim());
  }

  // Fallback query params
  if (!queryTarget && req.query) {
    queryTarget = req.query.url || req.query.user || req.query.id || req.query[""] || "";
  }
  if (!userToken && req.query) {
    userToken = req.query.code || req.query.token || "";
  }

  if (!queryTarget) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập UID, Username hoặc Link Facebook.",
      cu_phap: "https://{domain}/api/mxh/facebook?={username_hoac_uid}&code={access_token}"
    });
  }

  let cleanInput = queryTarget.trim()
    .replace(/^https?:\/\/(?:www\.|m\.|mobile\.)?facebook\.com\//, "")
    .replace(/^@+/, "")
    .replace(/^profile\.php\?id=/, "")
    .split("/")[0]
    .split("?")[0]
    .trim();

  try {
    let uid = /^\d{5,25}$/.test(cleanInput) ? cleanInput : null;
    let fullName = null;
    let actualUsername = cleanInput;

    // 1. XỬ LÝ NẾU CÓ ACCESS TOKEN (EAAG...)
    if (userToken && userToken.startsWith("EAA")) {
      // Thử truy vấn đối tượng cụ thể hoặc endpoint /me
      const endpoints = [
        `https://graph.facebook.com/v19.0/${encodeURIComponent(cleanInput)}?fields=id,name,username,link&access_token=${userToken}`,
        `https://graph.facebook.com/v19.0/me?fields=id,name,username,link&access_token=${userToken}`
      ];

      for (const endpoint of endpoints) {
        try {
          const graphRes = await fetch(endpoint);
          if (graphRes.ok) {
            const gData = await graphRes.json();
            if (gData.id) {
              uid = gData.id;
              fullName = gData.name || fullName;
              actualUsername = gData.username || actualUsername;
              break;
            }
          }
        } catch (e) {}
      }
    }

    // 2. NẾU CHƯA CÓ UID, TRA CỨU QUA CÁC ENGINE LOOKUP
    if (!uid) {
      const lookupEngines = [
        async () => {
          const r = await fetch(`https://api.findids.net/api/get-uid-from-username?username=${encodeURIComponent(cleanInput)}`);
          const d = await r.json();
          return d.data?.id || d.id || null;
        },
        async () => {
          const r = await fetch("https://id.traodoisub.net/api.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `link=${encodeURIComponent(`https://facebook.com/${cleanInput}`)}`
          });
          const d = await r.json();
          return d.code === 200 ? d.id : null;
        }
      ];

      for (const engine of lookupEngines) {
        try {
          const idFound = await engine();
          if (idFound) {
            uid = String(idFound).trim();
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

    // 3. LẤY TÊN HIỂN THỊ NẾU CHƯA CÓ QUA GRAPH OPEN DATA
    if (!fullName) {
      const fallbackToken = userToken || "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";
      try {
        const infoRes = await fetch(`https://graph.facebook.com/v19.0/${uid}?fields=name,username&access_token=${fallbackToken}`);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          fullName = infoData.name || null;
          if (infoData.username) actualUsername = infoData.username;
        }
      } catch (e) {}
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