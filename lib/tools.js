const https = require("https");

// Điền API Key Gemini của bạn vào đây (hoặc cấu hình trong Vercel Environment Variables: GEMINI_API_KEY)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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

// 2. TẢI VÀ CHUYỂN ẢNH THÀNH BASE64
async function fetchImageBase64(imageUrl) {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Không thể tải ảnh gốc từ URL cung cấp.");
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/jpeg";
  return {
    base64: Buffer.from(buffer).toString("base64"),
    mimeType: contentType.split(";")[0]
  };
}

// 3. ENGINE TRỰC TIẾP GOOGLE GEMINI AI
async function callGeminiAiImage(imageUrl, mode = "removebg") {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("DIEN_API_KEY")) {
    throw new Error("Vui lòng cấu hình GEMINI_API_KEY trong mã nguồn hoặc Vercel Environment Variables.");
  }

  const { base64, mimeType } = await fetchImageBase64(imageUrl);

  let prompt = "";
  if (mode === "removebg") {
    prompt = "Please remove the background of this image completely, keep only the main subject, and output as a transparent PNG image.";
  } else if (mode === "enhance") {
    prompt = "Enhance the resolution, remove blur, denoise, and increase quality of this image to ultra-sharp HD.";
  } else if (mode === "both") {
    prompt = "Remove the background completely to make it transparent, enhance the sharpness and details of the main subject to high resolution.";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      response_modalities: ["TEXT", "IMAGE"]
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Gemini API báo lỗi (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0]?.content?.parts;

  if (!candidate) {
    throw new Error("Không nhận được phản hồi xử lý ảnh từ Gemini AI.");
  }

  let outputImageBase64 = null;
  let outputMime = "image/png";
  let explanation = "";

  for (const part of candidate) {
    if (part.inline_data) {
      outputImageBase64 = part.inline_data.data;
      outputMime = part.inline_data.mime_type || "image/png";
    } else if (part.text) {
      explanation += part.text;
    }
  }

  if (!outputImageBase64) {
    return {
      che_do: mode,
      thong_diep_ai: explanation || "Gemini đã phân tích xong hình ảnh.",
      anh_goc: imageUrl
    };
  }

  return {
    che_do: mode,
    dinh_dang: outputMime,
    du_lieu_data_url: `data:${outputMime};base64,${outputImageBase64}`,
    ghi_chu_ai: explanation || undefined
  };
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
      ai_engine: "Google Gemini Multimodal AI Direct",
      tong_so_tool: 4,
      danh_sach_tool: {
        freefire_lookup: {
          ten_api: "Tra Cứu Thông Tin Free Fire (Player Info Lookup)",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          cu_phap: `${baseUrl}/tools/freefire?={uid_game}`
        },
        ai_remove_bg: {
          ten_api: "Xóa Phông Nền Bằng Google Gemini AI",
          duong_dan: "/tools/removebg",
          phuong_thuc: "GET",
          mo_ta: "Tách nền trực tiếp qua Google Gemini API, xuất kết quả Data URI / Base64.",
          cu_phap: `${baseUrl}/tools/removebg?url={link_anh}`
        },
        ai_enhance_image: {
          ten_api: "Làm Nét & Phục Chế Ảnh Bằng Gemini AI",
          duong_dan: "/tools/enhance",
          phuong_thuc: "GET",
          mo_ta: "Nâng cấp độ nét, tái tạo chi tiết ảnh trực tiếp bằng AI Google.",
          cu_phap: `${baseUrl}/tools/enhance?url={link_anh}`
        },
        ai_all_in_one: {
          ten_api: "Tích Hợp Kép: Xóa Nền + Làm Nét Bằng Gemini AI",
          duong_dan: "/tools/all-in-one",
          phuong_thuc: "GET",
          mo_ta: "Xóa nền và tăng chất lượng ảnh bằng một lệnh duy nhất.",
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
  // ROUTE 2, 3, 4: GOOGLE GEMINI AI IMAGE PROCESSOR
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
    const aiData = await callGeminiAiImage(imgUrl, mode);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: `ai_gemini_${mode}`,
      tac_gia: "ZheeDevTool",
      du_lieu_anh: aiData
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Lỗi xử lý hình ảnh qua Google Gemini AI."
    });
  }
};