const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// Clone chính xác thuật toán bóc tách từ package free-fire-apis (BD Games Topup Engine)
async function fetchBDGamesPlayer(loginId) {
  const uid = String(loginId).trim();

  // 1. Cổng BD Games Topup API (Endpoint gốc của package free-fire-apis)
  const endpoints = [
    {
      url: "https://shop.garena.my/api/auth/player_id_login",
      body: { app_id: 100067, login_id: uid }
    },
    {
      url: "https://topup.garena.sg/api/auth/player_id_login",
      body: { app_id: 100067, login_id: uid }
    },
    {
      url: "https://kame.garena.vn/api/auth/login_by_player_id",
      body: { app_id: 100067, player_id: uid }
    }
  ];

  for (const ep of endpoints) {
    try {
      const response = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Referer": "https://shop.garena.my/app/100067/idlogin"
        },
        body: JSON.stringify(ep.body),
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        const data = await response.json();
        const nickname = data.nickname || data.player_name || data.name;

        if (nickname) {
          return {
            Region: data.region || "VN",
            Nickname: nickname,
            Uid: uid,
            Author: "ZheeDevTool"
          };
        }
      }
    } catch (err) {}
  }

  // 2. Gateway dự phòng BD Games Proxy nếu cổng chính gặp captcha
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://shop.garena.my/api/auth/player_id_login`)}`;
  try {
    const backupRes = await fetch(`https://api.gametools.club/freefire/player/${uid}`, {
      headers: { "User-Agent": "ZheeDevTool/1.0" },
      signal: AbortSignal.timeout(5000)
    });
    if (backupRes.ok) {
      const resJson = await backupRes.json();
      if (resJson && resJson.name) {
        return {
          Region: resJson.region || "VN",
          Nickname: resJson.name,
          Uid: uid,
          Author: "ZheeDevTool"
        };
      }
    }
  } catch (e) {}

  throw new Error(`Không thể tìm thấy thông tin cho UID: ${uid}`);
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const pathname = fullUrl.split("?")[0].toLowerCase();
  const rawQuery = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?") + 1) : "";
  const firstParam = rawQuery ? decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim()) : "";

  // Tài liệu hướng dẫn
  if (!firstParam || (!fullUrl.includes("?") && (pathname === "/tools" || pathname === "/api/tools"))) {
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Game Utilities (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 1,
      danh_sach_tool: {
        freefire_lookup: {
          ten_api: "Free Fire Account Lookup (BD Games Engine)",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu thông tin tài khoản Free Fire (Tên nhân vật, Region, UID) qua cổng BD Games API.",
          cu_phap: [
            `${baseUrl}/tools/freefire?={uid_game}`,
            `${baseUrl}/tools/freefire?uid={uid_game}&key={api_key}`
          ],
          vi_du: [
            `${baseUrl}/tools/freefire?=86744126`,
            `${baseUrl}/tools/freefire?uid=86744126&key=zhee_vip`
          ]
        }
      }
    });
  }

  try {
    let uid = req.query.uid || req.query.id || "";
    let key = req.query.key || "";

    if (!uid && firstParam) {
      const parts = firstParam.split("/");
      uid = parts[0]?.trim();
      if (parts[1]) key = parts[1].trim();
    }

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập UID Free Fire hợp lệ (chỉ gồm các chữ số)."
      });
    }

    if (key && !VALID_KEYS.includes(key)) {
      return res.status(403).json({
        trang_thai: "that_bai",
        thong_bao: "API Key không hợp lệ."
      });
    }

    const result = await fetchBDGamesPlayer(uid);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      Region: result.Region,
      Nickname: result.Nickname,
      Uid: result.Uid,
      Author: result.Author
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};