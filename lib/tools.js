const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// Hàm clone trực tiếp logic từ free-fire-apis bằng fetch native (không cần npm package)
async function lookupFreeFireNative(uid) {
  const targetUid = String(uid).trim();

  // Danh sách các upstream endpoint mà free-fire-apis sử dụng
  const endpoints = [
    `https://ff-community-api.vercel.app/api/player?uid=${targetUid}`,
    `https://ff-info-service.onrender.com/api/v1/player?uid=${targetUid}`,
    `https://freefireapi.com.br/api/search_id?id=${targetUid}&region=VN`
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "application/json"
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        const nickname = data.Nickname || data.nickname || data.player_name || data.name;
        if (nickname) {
          return {
            Region: data.Region || data.region || "VN",
            Nickname: nickname,
            Uid: targetUid,
            Author: "ZheeDevTool" // Ép cứng Author thành ZheeDevTool
          };
        }
      }
    } catch (e) {}
  }

  throw new Error(`Không tìm thấy thông tin cho UID: ${targetUid}`);
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

  // -------------------------------------------------------------
  // TRANG TÀI LIỆU CHUYÊN MỤC /tools
  // -------------------------------------------------------------
  if (!firstParam || (!fullUrl.includes("?") && (pathname === "/tools" || pathname === "/api/tools"))) {
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Game Utilities (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 1,
      danh_sach_tool: {
        freefire_lookup: {
          ten_api: "Free Fire Account Lookup (ZheeDevTool Engine)",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu thông tin tài khoản Free Fire (Tên nhân vật, Khu vực, UID) siêu tốc không phụ thuộc thư viện ngoài.",
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

  // =============================================================
  // XỬ LÝ TRA CỨU FREE FIRE
  // =============================================================
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

    const data = await lookupFreeFireNative(uid);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      ket_qua: data
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};