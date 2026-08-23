const https = require("https");

// Hàm thực thi gốc được lấy từ package free-fire-apis
function getFreeFireData(loginId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      app_id: 100067,
      login_id: String(loginId)
    });

    const options = {
      hostname: "shop.garena.my",
      port: 443,
      path: "/api/auth/player_id_login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://shop.garena.my/app/100067/idlogin"
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.nickname || json.player_name) {
            resolve({
              Region: json.region || "VN",
              Nickname: json.nickname || json.player_name,
              Uid: String(loginId),
              Author: "ZheeDevTool"
            });
          } else {
            reject(new Error("Không tìm thấy người chơi"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.setTimeout(6000, () => {
      req.destroy();
      reject(new Error("Timeout kết nối"));
    });

    req.write(payload);
    req.end();
  });
}

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

  // 1. Trang tài liệu
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

  // 2. Tra cứu UID
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

    const data = await getFreeFireData(uid);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      Region: data.Region,
      Nickname: data.Nickname,
      Uid: data.Uid,
      Author: data.Author
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: `Không thể tìm thấy thông tin cho UID: ${uid}`
    });
  }
};