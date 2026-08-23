// Danh sách API Key hợp lệ do bạn tự quy định (hoặc để trống nếu cho dùng miễn phí)
const VALID_KEYS = ["zhee_free", "zhee_vip_2026", "hoducminh123"];

// Hàm tra cứu tài khoản Free Fire qua UID
async function lookupFreeFire(uid, region = "VN") {
  const targetRegion = region.toUpperCase();
  
  // Endpoint gateway tra cứu dữ liệu người chơi Free Fire
  const gatewayUrl = `https://freefireapi.com.br/api/search_id?id=${uid}&region=${targetRegion}`;
  
  const response = await fetch(gatewayUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "application/json"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Không thể kết nối máy chủ dữ liệu game (Mã lỗi: ${response.status})`);
  }

  const data = await response.json();
  return data;
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
      chuyen_muc: "Công Cụ & Tiện Ích Đa Năng (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 1,
      danh_sach_tool: {
        freefire_lookup: {
          ten_api: "Free Fire Account Player Info Lookup",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu toàn bộ thông tin tài khoản Free Fire (Tên nhân vật, Level, Like, Rank Tử Chiến / Sinh Tồn, Quân Đoàn, Avatar, Thẻ Vô Cực) qua UID.",
          cu_phap: [
            `${baseUrl}/tools/freefire?uid={uid_game}&region={vn|ind|br|sg}&key={api_key}`,
            `${baseUrl}/tools/freefire?={uid_game}`
          ],
          vi_du: [
            `${baseUrl}/tools/freefire?=123456789`,
            `${baseUrl}/tools/freefire?uid=123456789&region=VN&key=zhee_vip_2026`
          ]
        }
      }
    });
  }

  // =============================================================
  // XỬ LÝ TOOL: CHECK UID FREE FIRE (/tools/freefire hoặc /tools?=uid)
  // =============================================================
  try {
    let uid = req.query.uid || req.query.id || "";
    let region = req.query.region || "VN";
    let key = req.query.key || "";

    // Phân tích nếu người dùng truyền theo dạng shortcut /tools/freefire?=123456789/VN
    if (!uid && firstParam) {
      const parts = firstParam.split("/");
      uid = parts[0]?.trim();
      if (parts[1]) region = parts[1].trim();
      if (parts[2]) key = parts[2].trim();
    }

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng cung cấp UID Free Fire hợp lệ (chỉ chứa ký tự số)."
      });
    }

    // Xác thực API Key (Nếu bạn muốn bật chế độ kiểm tra bắt buộc)
    // if (key && !VALID_KEYS.includes(key)) {
    //   return res.status(403).json({ trang_thai: "that_bai", thong_bao: "API Key không hợp lệ." });
    // }

    const playerData = await lookupFreeFire(uid, region);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      may_chu_khu_vuc: region.toUpperCase(),
      thong_tin_nhan_vat: playerData
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Lỗi xử lý tra cứu thông tin game."
    });
  }
};