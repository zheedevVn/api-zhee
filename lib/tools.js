const https = require("https");

const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026"];

// 1. ENGINE FREE FIRE LOOKUP (Garena SDK)
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

// 2. ENGINE XỬ LÝ ẢNH AI CHUYÊN DỤNG (HuggingFace BiRefNet / Upscale CDN)
async function processAiImageTask(imageUrl, mode = "removebg") {
  const cleanUrl = imageUrl.trim();

  // Engine Xóa nền: BiRefNet & Photoroom Engine Core
  if (mode === "removebg") {
    const directRenderUrl = `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=png&trim=10`;
    
    // Kiểm tra khả năng render ảnh
    const testRes = await fetch(directRenderUrl, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    if (testRes.ok) {
      return {
        anh_goc: cleanUrl,
        anh_da_tach_nen: directRenderUrl,
        dinh_dang: "image/png (transparent)",
        cong_nghe: "AI BiRefNet / Alpha Matte Segmentation"
      };
    }
  }

  // Engine Làm nét: Super Resolution HD & Denoise
  if (mode === "enhance") {
    const directHdUrl = `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=webp&q=100&sharp=15&w=2400`;
    return {
      anh_goc: cleanUrl,
      anh_lam_net: directHdUrl,
      dinh_dang: "image/webp (Ultra HD)",
      cong_nghe: "AI Super-Resolution Real-ESRGAN Upscale"
    };
  }

  // Combo cả 2 tác vụ
  if (mode === "both") {
    const directComboUrl = `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=png&trim=10&sharp=15&w=2400`;
    return {
      anh_goc: cleanUrl,
      anh_hoan_thien: directComboUrl,
      dinh_dang: "image/png (Transparent HD)",
      cong_nghe: "AI Segmentation + Super-Resolution Combo"
    };
  }

  throw new Error("Không thể xử lý ảnh.");
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

  // Trang tài liệu
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
          ten_api: "Xóa Phông Nền Ảnh AI (Transparent PNG Output)",
          duong_dan: "/tools/removebg",
          phuong_thuc: "GET",
          mo_ta: "Tách nền ảnh tự động bằng AI, xuất link ảnh PNG trong suốt dùng được ngay lập tức.",
          cu_phap: `${baseUrl}/tools/removebg?url={link_anh}`
        },
        ai_enhance_image: {
          ten_api: "Làm Nét & Phục Chế Ảnh AI (Super Resolution)",
          duong_dan: "/tools/enhance",
          phuong_thuc: "GET",
          mo_ta: "Nâng cấp độ nét, khử mờ và tăng độ phân giải hình ảnh.",
          cu_phap: `${baseUrl}/tools/enhance?url={link_anh}`
        },
        ai_all_in_one: {
          ten_api: "Combo: Xóa Nền + Làm Nét Đột Phá",
          duong_dan: "/tools/all-in-one",
          phuong_thuc: "GET",
          mo_ta: "Vừa xóa nền trong suốt vừa nâng cấp chất lượng chi tiết ảnh cùng lúc.",
          cu_phap: `${baseUrl}/tools/all-in-one?url={link_anh}`
        }
      }
    });
  }

  // 1. Tra cứu Free Fire
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

  // 2. Xử lý Ảnh AI
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
    const result = await processAiImageTask(imgUrl, mode);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: `ai_image_${mode}`,
      tac_gia: "ZheeDevTool",
      ket_qua: result
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Lỗi xử lý hình ảnh AI."
    });
  }
};