const { uid: ffLookup } = require("free-fire-apis");

const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

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

  // 1. Tài liệu chuyên mục /tools
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

  // 2. Tra cứu Free Fire
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

    // Gọi trực tiếp hàm từ package free-fire-apis
    const data = await ffLookup(String(uid));

    if (!data || !data.Nickname) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy thông tin cho UID: ${uid}`
      });
    }

    // Ép Author thành ZheeDevTool
    data.Author = "ZheeDevTool";

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      Region: data.Region || "VN",
      Nickname: data.Nickname,
      Uid: data.Uid || uid,
      Author: data.Author
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Lỗi xử lý tra cứu dữ liệu game."
    });
  }
};