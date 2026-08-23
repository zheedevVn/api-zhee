const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// 1. Tra cứu trực tiếp qua Cổng Xác Thực Garena SSO (Không bị chặn / Không cần Token game)
async function fetchGarenaSSO(uid) {
  const url = "https://kame.garena.vn/api/auth/login_by_player_id";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Referer": "https://kame.garena.vn/",
      "Origin": "https://kame.garena.vn"
    },
    body: JSON.stringify({
      app_id: 100067,
      player_id: String(uid)
    }),
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error(`Garena Server từ chối kết nối (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data;
}

// 2. Gateway dự phòng 2 qua cổng nạp chính thức
async function fetchNapTheBackup(uid) {
  const url = "https://shop2game.com/api/auth/player_id_login";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36",
      "Referer": "https://shop2game.com/app/100067/idlogin",
      "Origin": "https://shop2game.com"
    },
    body: JSON.stringify({
      app_id: 100067,
      login_id: String(uid)
    }),
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) return null;
  return await response.json();
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
          ten_api: "Free Fire Player Info Lookup (Garena Direct Engine)",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu danh tính người chơi Free Fire, tên ingame (Nickname), OpenID và trạng thái tài khoản qua UID.",
          cu_phap: [
            `${baseUrl}/tools/freefire?uid={uid_game}&key={api_key}`,
            `${baseUrl}/tools/freefire?={uid_game}`
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
  // XỬ LÝ TRA CỨU QUA DIRECT ENGINE
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
        thong_bao: "API Key không hợp lệ. Bạn có thể tự tạo và cấu hình Key trong VALID_KEYS."
      });
    }

    let playerName = null;
    let openId = null;
    let rawResult = null;

    // Thử phương thức 1
    try {
      const ssoData = await fetchGarenaSSO(uid);
      if (ssoData && (ssoData.player_name || ssoData.nickname || ssoData.open_id)) {
        playerName = ssoData.player_name || ssoData.nickname;
        openId = ssoData.open_id || ssoData.openid;
        rawResult = ssoData;
      }
    } catch (e) {}

    // Thử phương thức 2 nếu phương thức 1 không ra
    if (!playerName) {
      try {
        const backupData = await fetchNapTheBackup(uid);
        if (backupData && (backupData.player_name || backupData.nickname)) {
          playerName = backupData.player_name || backupData.nickname;
          openId = backupData.open_id || backupData.openid;
          rawResult = backupData;
        }
      } catch (e) {}
    }

    if (!playerName) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy tài khoản Free Fire có UID: ${uid} (UID không tồn tại hoặc chưa kích hoạt).`
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      thong_tin_tai_khoan: {
        uid: uid,
        ten_nhan_vat: playerName,
        open_id: openId || "Đã ẩn",
        game: "Garena Free Fire (VN/Global)",
        trang_thai: "Tài khoản đang hoạt động",
        thoi_gian_kiem_tra: new Date().toLocaleString("vi-VN")
      },
      du_lieu_goc: rawResult
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: `Lỗi xử lý: ${error.message}`
    });
  }
};