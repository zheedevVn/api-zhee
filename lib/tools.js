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

// 2. ENGINE XỬ LÝ ẢNH AI TRỰC TIẾP (Tạo link CDN cuối cùng)
async function processImageDirect(imageUrl, mode = "removebg") {
  // Sử dụng Photoleap / Cloudflare AI Backbone để xử lý và host ảnh trực tiếp
  const encodedUrl = encodeURIComponent(imageUrl);
  
  if (mode === "removebg") {
    // Gọi gateway xử lý và xuất link ảnh PNG trong suốt
    const res = await fetch(`https://api.vreden.my.id/api/removebg?url=${encodedUrl}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000)
    });

    if (res.ok) {
      const data = await res.json();
      const directImage = data.result?.image || data.result?.url || data.url || data.result;
      if (directImage && typeof directImage === "string") {
        return directImage;
      }
    }

    // Gateway AI dự phòng 2
    const backupRes = await fetch(`https://tools.betabotz.eu.org/ai/removebg?url=${encodedUrl}`, {
      signal: AbortSignal.timeout(15000)
    });
    if (backupRes.ok) {
      const backupData = await backupRes.json();
      return backupData.result?.url || backupData.url || backupData.result;
    }
  } else if (mode === "enhance") {
    // Engine làm nét Remini / HD Upscaler
    const res = await fetch(`https://api.vreden.my.id/api/remini?url=${encodedUrl}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000)
    });

    if (res.ok) {
      const data = await res.json();
      const directImage = data.result?.image || data.result?.url || data.url || data.result;
      if (directImage && typeof directImage === "string") {
        return directImage;
      }
    }
  } else if (mode === "both") {
    // Chạy xóa nền trước, lấy URL ảnh kết quả rồi gửi tiếp sang engine làm nét
    const step1Url = await processImageDirect(imageUrl, "removebg");
    if (step1Url) {
      const step2Url = await processImageDirect(step1Url, "enhance");
      return step2Url || step1Url;
    }
  }

  throw new Error("Không thể xử lý ảnh hoặc máy chủ AI đang quá tải.");
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
          ten_api: "Xóa Phông Nền Ảnh Trực Tiếp (AI Background Remover)",
          duong_dan: "/tools/removebg",
          phuong_thuc: "GET",
          mo_ta: "Tách nền ảnh tự động bằng AI, trả về link file ảnh PNG trong suốt dùng được ngay.",
          cu_phap: `${baseUrl}/tools/removebg?url={link_anh}`
        },
        ai_enhance_image: {
          ten_api: "Làm Nét Ảnh AI (AI Image Enhancer)",
          duong_dan: "/tools/enhance",
          phuong_thuc: "GET",
          mo_ta: "Nâng cấp chi tiết và làm nét ảnh chất lượng cao.",
          cu_phap: `${baseUrl}/tools/enhance?url={link_anh}`
        },
        ai_all_in_one: {
          ten_api: "Combo: Xóa Nền + Làm Nét Ảnh (AI All-In-One)",
          duong_dan: "/tools/all-in-one",
          phuong_thuc: "GET",
          mo_ta: "Tự động xóa nền sau đó tăng nét trực tiếp.",
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
    const finalImageUrl = await processImageDirect(imgUrl, mode);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: `ai_image_${mode}`,
      tac_gia: "ZheeDevTool",
      ket_qua: {
        anh_goc: imgUrl,
        anh_hoan_thien: finalImageUrl,
        dinh_dang: mode === "enhance" ? "image/jpeg" : "image/png"
      }
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: `Lỗi xử lý hình ảnh AI: ${error.message}`
    });
  }
};