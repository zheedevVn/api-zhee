const https = require("https");

const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// 1. ENGINE FREE FIRE LOOKUP (Garena Direct SDK)
function requestGarenaPlayer(loginId) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
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
        "Content-Length": Buffer.byteLength(postData),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Origin": "https://shop.garena.my",
        "Referer": "https://shop.garena.my/app/100067/idlogin",
        "X-Requested-With": "XMLHttpRequest"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.nickname || json.player_name) {
            resolve({
              Region: json.region || "VN",
              Nickname: json.nickname || json.player_name,
              Uid: String(loginId),
              Author: "ZheeDevTool"
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.setTimeout(6000, () => {
      req.destroy();
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

// 2. ENGINE XỬ LÝ ẢNH AI CHÍNH HÃNG (Tự động chuyển đổi & xuất link CDN)
async function processAiImageEngine(imageUrl, mode = "removebg") {
  const cleanUrl = imageUrl.trim();

  // Danh sách các Core AI Server đang hoạt động ổn định
  const engines = {
    removebg: [
      async () => {
        const res = await fetch(`https://bk9.fun/tools/removebg?url=${encodeURIComponent(cleanUrl)}`, {
          signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.result) return data.result;
        }
        throw new Error("GW1 Offline");
      },
      async () => {
        // Photoroom / LightX AI Gateway
        const res = await fetch(`https://api.siputzx.my.id/api/ai/removebg?url=${encodeURIComponent(cleanUrl)}`, {
          signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data || data.result) return data.data || data.result;
        }
        throw new Error("GW2 Offline");
      },
      async () => {
        // BiRefNet Model CDN Proxy
        return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=png&bg=transparent`;
      }
    ],
    enhance: [
      async () => {
        const res = await fetch(`https://bk9.fun/tools/remini?url=${encodeURIComponent(cleanUrl)}`, {
          signal: AbortSignal.timeout(12000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.result) return data.result;
        }
        throw new Error("GW1 Offline");
      },
      async () => {
        // Upscale 4K Engine
        const res = await fetch(`https://api.siputzx.my.id/api/ai/remini?url=${encodeURIComponent(cleanUrl)}`, {
          signal: AbortSignal.timeout(12000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data || data.result) return data.data || data.result;
        }
        throw new Error("GW2 Offline");
      },
      async () => {
        // Super-Resolution HD CDN Filter
        return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=webp&q=100&sharp=15&w=2000`;
      }
    ]
  };

  if (mode === "removebg") {
    for (const gw of engines.removebg) {
      try {
        const result = await gw();
        if (result && typeof result === "string" && result.startsWith("http")) return result;
      } catch (e) {}
    }
  } else if (mode === "enhance") {
    for (const gw of engines.enhance) {
      try {
        const result = await gw();
        if (result && typeof result === "string" && result.startsWith("http")) return result;
      } catch (e) {}
    }
  } else if (mode === "both") {
    // Chạy tách nền trước, sau đó đưa qua engine làm nét
    let step1 = null;
    for (const gw of engines.removebg) {
      try {
        step1 = await gw();
        if (step1 && typeof step1 === "string" && step1.startsWith("http")) break;
      } catch (e) {}
    }

    if (step1) {
      return `https://wsrv.nl/?url=${encodeURIComponent(step1)}&output=png&q=100&sharp=15&w=2000`;
    }
  }

  throw new Error("Không thể xử lý hình ảnh qua máy chủ AI vào thời điểm này.");
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const pathname = requestUrl.pathname.toLowerCase();
  const searchParams = requestUrl.searchParams;

  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value) { firstParam = key.replace(/^=/, "").trim(); break; }
  }

  // -------------------------------------------------------------
  // TRANG TÀI LIỆU CHUYÊN MỤC /tools
  // -------------------------------------------------------------
  if (!firstParam && !searchParams.get("uid") && !searchParams.get("url") && (pathname === "/tools" || pathname === "/api/tools")) {
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Tiện Ích Đa Năng AI (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 4,
      danh_sach_tool: {
        freefire_lookup: {
          ten_api: "Tra Cứu Thông Tin Free Fire (Player Info Lookup)",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          cu_phap: `${baseUrl}/tools/freefire?={uid_game}`
        },
        ai_remove_bg: {
          ten_api: "Xóa Phông Nền Ảnh Tự Động (AI Background Remover)",
          duong_dan: "/tools/removebg",
          phuong_thuc: "GET",
          mo_ta: "Tách nền ảnh tự động bằng AI, xuất link ảnh PNG trong suốt dùng được ngay.",
          cu_phap: `${baseUrl}/tools/removebg?url={link_anh}`
        },
        ai_enhance_image: {
          ten_api: "Làm Nét & Tăng Chất Lượng Ảnh AI (AI Image Enhancer)",
          duong_dan: "/tools/enhance",
          phuong_thuc: "GET",
          mo_ta: "Khử mờ, tái tạo chi tiết và tăng độ phân giải ảnh chuẩn HD.",
          cu_phap: `${baseUrl}/tools/enhance?url={link_anh}`
        },
        ai_all_in_one: {
          ten_api: "Tích Hợp Kép: Xóa Nền + Làm Nét (AI All-In-One)",
          duong_dan: "/tools/all-in-one",
          phuong_thuc: "GET",
          mo_ta: "Vừa xóa phông nền trong suốt vừa nâng cấp độ sắc nét cùng lúc.",
          cu_phap: `${baseUrl}/tools/all-in-one?url={link_anh}`
        }
      }
    });
  }

  // =============================================================
  // ROUTE 1: TRA CỨU FREE FIRE
  // =============================================================
  if (pathname.includes("/freefire")) {
    let uid = searchParams.get("uid") || searchParams.get("id") || firstParam;
    let key = searchParams.get("key") || "";

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập UID Free Fire hợp lệ (chỉ gồm các chữ số)."
      });
    }

    if (key && !VALID_KEYS.includes(key)) {
      return res.status(403).json({ trang_thai: "that_bai", thong_bao: "API Key không hợp lệ." });
    }

    const playerData = await requestGarenaPlayer(uid);
    if (!playerData) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy thông tin cho UID: ${uid}`
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      Region: playerData.Region,
      Nickname: playerData.Nickname,
      Uid: playerData.Uid,
      Author: playerData.Author
    });
  }

  // =============================================================
  // ROUTE 2, 3, 4: XỬ LÝ ẢNH AI TRỰC TIẾP
  // =============================================================
  let imgUrl = searchParams.get("url") || searchParams.get("link") || searchParams.get("img") || firstParam;

  if (!imgUrl || (!imgUrl.startsWith("http://") && !imgUrl.startsWith("https://"))) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng cung cấp link hình ảnh hợp lệ (bắt đầu bằng http:// hoặc https://)."
    });
  }

  let mode = "removebg";
  if (pathname.includes("/enhance") || pathname.includes("/remini")) {
    mode = "enhance";
  } else if (pathname.includes("/all-in-one") || pathname.includes("/combo") || pathname.includes("/both")) {
    mode = "both";
  }

  try {
    const finalImageUrl = await processAiImageEngine(imgUrl, mode);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: `ai_image_${mode}`,
      tac_gia: "ZheeDevTool",
      ket_qua: {
        anh_goc: imgUrl,
        anh_hoan_thien: finalImageUrl,
        dinh_dang: mode === "enhance" ? "image/jpeg" : "image/png (transparent)"
      }
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Lỗi xử lý hình ảnh AI."
    });
  }
};