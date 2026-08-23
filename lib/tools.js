const https = require("https");

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || "JKsYj7QVipWHtzy5KZXS7WZA";
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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

// 2. TỰ ĐỘNG TẢI BUFFER LÊN HOST ẢNH ĐỂ LẤY DIRECT LINK .PNG
async function uploadToFreeHost(buffer) {
  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: "image/png" });
    formData.append("fileToUpload", blob, "removed_bg.png");
    formData.append("reqtype", "fileupload");

    const res = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const link = await res.text();
      if (link && link.startsWith("http")) return link.trim();
    }
  } catch (e) {}

  return null;
}

// 3. XỬ LÝ REMOVE.BG VÀ XUẤT BUFFER / DIRECT URL
async function callRemoveBgEngine(imageUrl) {
  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": REMOVE_BG_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image_url: imageUrl,
      size: "auto",
      format: "png"
    }),
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Remove.bg Error: ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Tải lên host để có link ảnh trực tiếp
  const directLink = await uploadToFreeHost(buffer);

  return {
    buffer,
    directLink,
    dataUri: `data:image/png;base64,${buffer.toString("base64")}`
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

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

  // 1. Trang tài liệu
  if (!firstParam && !searchParams.get("uid") && !searchParams.get("url") && (pathname === "/tools" || pathname === "/api/tools")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Tiện Ích Đa Năng AI (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      danh_sach_tool: {
        freefire: `${baseUrl}/tools/freefire?={uid_game}`,
        removebg: `${baseUrl}/tools/removebg?url={link_anh}`,
        enhance: `${baseUrl}/tools/enhance?url={link_anh}`
      }
    });
  }

  // 2. Tra cứu Free Fire
  if (pathname.includes("/freefire")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    let uid = searchParams.get("uid") || searchParams.get("id") || firstParam;
    let key = searchParams.get("key") || "";

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "UID Free Fire không hợp lệ." });
    }
    if (key && !VALID_KEYS.includes(key)) {
      return res.status(403).json({ trang_thai: "that_bai", thong_bao: "API Key không hợp lệ." });
    }

    const playerData = await requestGarenaPlayer(uid);
    if (!playerData) {
      return res.status(404).json({ trang_thai: "that_bai", thong_bao: `Không tìm thấy UID: ${uid}` });
    }

    return res.status(200).json({ trang_thai: "thanh_cong", ...playerData });
  }

  // 3. Xử lý xóa nền ảnh / Làm nét
  let imgUrl = searchParams.get("url") || searchParams.get("link") || searchParams.get("img") || firstParam;
  const isRaw = searchParams.get("raw") === "true";

  if (!imgUrl || !/^https?:\/\//i.test(imgUrl)) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng cung cấp link hình ảnh hợp lệ (bắt đầu bằng http:// hoặc https://)."
    });
  }

  // Làm nét ảnh
  if (pathname.includes("/enhance")) {
    const directHdUrl = `https://wsrv.nl/?url=${encodeURIComponent(imgUrl)}&output=webp&q=100&sharp=15&w=2400`;
    if (isRaw) {
      return res.redirect(directHdUrl);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "ai_image_enhance",
      anh_goc: imgUrl,
      link_anh_hd: directHdUrl
    });
  }

  // Xóa nền ảnh (Mặc định cho /removebg và /all-in-one)
  try {
    const { buffer, directLink, dataUri } = await callRemoveBgEngine(imgUrl);

    // Nếu muốn hiển thị trực tiếp ảnh trên trình duyệt
    if (isRaw) {
      res.setHeader("Content-Type", "image/png");
      return res.status(200).send(buffer);
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "ai_remove_bg",
      tac_gia: "ZheeDevTool",
      anh_goc: imgUrl,
      link_anh_da_xoa_nen: directLink || "Đã nhúng Data URI bên dưới",
      du_lieu_data_url: dataUri
    });

  } catch (error) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Lỗi xử lý tách nền."
    });
  }
};