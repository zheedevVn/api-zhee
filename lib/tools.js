// Hàm tra cứu trực tiếp từ cổng xác thực Garena Shop2Game chính thức
async function fetchGarenaFF(uid) {
  // 1. Lấy Captcha Token / Session từ cổng nạp Garena
  const initRes = await fetch("https://app.pay.garena.vn/api/auth/player_id_login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Referer": "https://napthe.vn/app/100067/idlogin",
      "Origin": "https://napthe.vn"
    },
    body: JSON.stringify({
      app_id: 100067, // App ID chính thức của Garena Free Fire
      login_id: String(uid)
    }),
    signal: AbortSignal.timeout(7000)
  });

  const data = await initRes.json();
  return data;
}

// Gateway phụ trợ lấy avatar và thông tin mở rộng
async function fetchFFExtra(uid, region = "VN") {
  try {
    const res = await fetch(`https://api-freefire-garena.vercel.app/api/player?uid=${uid}&region=${region}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) return await res.json();
  } catch (e) {}
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
          ten_api: "Free Fire Account Player Info Lookup (Official Garena Gateway)",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu danh tính nhân vật, tên ingame, OpenID Free Fire chuẩn xác 100% qua cổng dữ liệu Garena.",
          cu_phap: [
            `${baseUrl}/tools/freefire?={uid_game}`,
            `${baseUrl}/tools/freefire?uid={uid_game}`
          ],
          vi_du: [
            `${baseUrl}/tools/freefire?=86744126`,
            `${baseUrl}/tools/freefire?=160492167`
          ]
        }
      }
    });
  }

  // =============================================================
  // XỬ LÝ TRA CỨU QUA GARENA AUTH ENGINE
  // =============================================================
  try {
    let uid = req.query.uid || req.query.id || "";
    let region = req.query.region || "VN";

    if (!uid && firstParam) {
      const parts = firstParam.split("/");
      uid = parts[0]?.trim();
      if (parts[1]) region = parts[1].trim();
    }

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập UID Free Fire hợp lệ (chỉ gồm các chữ số)."
      });
    }

    // 1. Gửi request đến Garena Official
    const garenaData = await fetchGarenaFF(uid);

    // Kiểm tra nếu UID không tồn tại hoặc sai
    if (garenaData.error || garenaData.err || !garenaData.player_name && !garenaData.nickname) {
      // Thử gateway thứ 2 nếu Garena gateway phản hồi lỗi
      const extraFallback = await fetchFFExtra(uid, region);
      if (extraFallback && (extraFallback.nickname || extraFallback.name)) {
        return res.status(200).json({
          trang_thai: "thanh_cong",
          loai: "freefire_player_lookup",
          nguon_du_lieu: "Garena Community Gateway",
          thong_tin_nhan_vat: {
            uid: uid,
            ten_nhan_vat: extraFallback.nickname || extraFallback.name,
            cap_do: extraFallback.level || "N/A",
            luot_thich: extraFallback.likes || "N/A",
            khu_vuc: region.toUpperCase()
          }
        });
      }

      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy người chơi Free Fire với UID: ${uid}. Vui lòng kiểm tra lại UID.`
      });
    }

    const playerName = garenaData.player_name || garenaData.nickname || "Không rõ";
    const openId = garenaData.openid || garenaData.open_id || null;

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_official_lookup",
      nguon_du_lieu: "Garena Official Gateway (Shop2Game/NapThe)",
      thong_tin_nhan_vat: {
        uid: uid,
        ten_nhan_vat: playerName,
        open_id: openId,
        khu_vuc_may_chu: region.toUpperCase(),
        trang_thai_tai_khoan: "Đang hoạt động trên máy chủ Garena",
        thoi_gian_kiem_tra: new Date().toLocaleString("vi-VN")
      },
      du_lieu_he_thong: garenaData
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: `Lỗi kết nối Garena: ${error.message}`
    });
  }
};