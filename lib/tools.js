const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// Thuật toán bóc tách trực tiếp từ endpoint chính thức của free-fire-apis
async function lookupPlayer(uid) {
  const targetUid = String(uid).trim();

  const configs = [
    {
      url: "https://shop2game.com/api/auth/player_id_login",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://shop2game.com",
        "Referer": "https://shop2game.com/app/100067/idlogin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json"
      },
      body: JSON.stringify({ app_id: 100067, login_id: targetUid })
    },
    {
      url: "https://topup.pk.garena.com/api/auth/player_id_login",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://topup.pk.garena.com",
        "Referer": "https://topup.pk.garena.com/app/100067/idlogin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({ app_id: 100067, login_id: targetUid })
    }
  ];

  for (const cfg of configs) {
    try {
      const response = await fetch(cfg.url, {
        method: "POST",
        headers: cfg.headers,
        body: cfg.body,
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        const nickname = data.nickname || data.player_name || data.name;
        if (nickname) {
          return {
            Region: data.region || "VN",
            Nickname: nickname,
            Uid: targetUid,
            Author: "ZheeDevTool"
          };
        }
      }
    } catch (e) {}
  }

  return null;
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

  // 1. Tài liệu API
  if (!firstParam || (!fullUrl.includes("?") && (pathname === "/tools" || pathname === "/api/tools"))) {
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Game Utilities (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 1,
      danh_sach_tool: {
        freefire_lookup: {
          ten_api: "Free Fire Account Player Info Lookup",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu thông tin tài khoản Free Fire (Tên nhân vật, Region, UID) qua UID.",
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

  // 2. Xử lý tra cứu
  let uid = req.query?.uid || req.query?.id || "";
  let key = req.query?.key || "";

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

  const result = await lookupPlayer(uid);

  if (!result) {
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: `Không tìm thấy thông tin cho UID: ${uid}`
    });
  }

  return res.status(200).json({
    trang_thai: "thanh_cong",
    loai: "freefire_player_lookup",
    xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
    Region: result.Region,
    Nickname: result.Nickname,
    Uid: result.Uid,
    Author: result.Author
  });
};