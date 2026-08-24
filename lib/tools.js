const https = require("https");
const { ADMIN_SECRET, createKey, verifyAndConsumeKey, deleteKey, listAllKeys } = require("./keyManager");

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

// 2. TỰ ĐỘNG TẢI BUFFER LÊN HOST ĐỂ LẤY LINK DIRECT PNG
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

  // Lấy địa chỉ IP thực của client từ header proxy
  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const pathname = requestUrl.pathname.toLowerCase();
  const searchParams = requestUrl.searchParams;

  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value) { firstParam = key.replace(/^=/, "").trim(); break; }
  }

  // =============================================================
  // ROUTE QUẢN LÝ KEY (/tools/key)
  // =============================================================
  if (pathname.includes("/key") || searchParams.has("action")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const action = searchParams.get("action") || pathname.split("/").pop();
    const adminSecret = searchParams.get("secret") || req.headers["x-admin-secret"] || "";

    // 1. Tạo Key mới
    if (action === "create" || action === "tao") {
      if (adminSecret !== ADMIN_SECRET) {
        return res.status(403).json({ trang_thai: "that_bai", ma_loi: 403, thong_bao: "Sai mã bảo mật Admin (admin_secret)!" });
      }

      const maxUses = searchParams.get("uses") || searchParams.get("luot") || 10;
      const expireHours = searchParams.get("hours") || searchParams.get("gio") || 24;
      const note = searchParams.get("note") || "User VIP";

      const newKey = createKey({ maxUses, expireHours, note });
      return res.status(200).json({
        trang_thai: "thanh_cong",
        thong_bao: "Tạo mã Key ZheeTool thành công!",
        du_lieu: newKey
      });
    }

    // 2. Check Key & Trừ lượt (kèm chống trừ khi load lại cùng IP)
    if (action === "check" || action === "kiemtra") {
      const key = searchParams.get("key") || firstParam || "";
      const consume = searchParams.get("consume") !== "false";

      const checkResult = verifyAndConsumeKey(key, clientIp, consume);
      if (!checkResult.hop_le) {
        return res.status(400).json({ trang_thai: "that_bai", ...checkResult });
      }

      return res.status(200).json({ trang_thai: "thanh_cong", ...checkResult });
    }

    // 3. Xóa Key
    if (action === "delete" || action === "xoa") {
      if (adminSecret !== ADMIN_SECRET) {
        return res.status(403).json({ trang_thai: "that_bai", ma_loi: 403, thong_bao: "Sai mã bảo mật Admin (admin_secret)!" });
      }

      const keyToDelete = searchParams.get("key") || firstParam || "";
      const deleted = deleteKey(keyToDelete);

      if (!deleted) {
        return res.status(404).json({ trang_thai: "that_bai", thong_bao: "Không tìm thấy Key để xóa!" });
      }

      return res.status(200).json({ trang_thai: "thanh_cong", thong_bao: `Đã xóa vĩnh viễn Key ${keyToDelete}` });
    }

    // 4. Xem danh sách Key
    if (action === "list" || action === "danhsach") {
      if (adminSecret !== ADMIN_SECRET) {
        return res.status(403).json({ trang_thai: "that_bai", ma_loi: 403, thong_bao: "Sai mã bảo mật Admin!" });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        tong_so_key: listAllKeys().length,
        danh_sach: listAllKeys()
      });
    }

    // Tài liệu hướng dẫn sử dụng API Key kèm ví dụ mẫu
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Hệ Thống Quản Trị & Cấp Khóa Key ZheeTool (/tools/key)",
      dinh_dang_key: "ZheeTool-xxxxx-xxxx-xxxxx-xxxx-xxxx-xxx",
      co_che_bao_mat: "Bảo vệ Session IP 1 giờ, reload nhiều lần không bị mất lượt dùng.",
      cac_endpoint: {
        tao_key: {
          cu_phap: `${baseUrl}/tools/key?action=create&uses={so_luot}&hours={so_gio}&note={ghi_chu}&secret={admin_secret}`,
          vi_du: `${baseUrl}/tools/key?action=create&uses=20&hours=48&note=KhachVIP&secret=${ADMIN_SECRET}`
        },
        check_va_tru_luot: {
          cu_phap: `${baseUrl}/tools/key?action=check&key={zheetool_key}`,
          vi_du: `${baseUrl}/tools/key?action=check&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI`
        },
        check_khong_tru_luot: {
          cu_phap: `${baseUrl}/tools/key?action=check&consume=false&key={zheetool_key}`,
          vi_du: `${baseUrl}/tools/key?action=check&consume=false&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI`
        },
        xoa_key: {
          cu_phap: `${baseUrl}/tools/key?action=delete&key={zheetool_key}&secret={admin_secret}`,
          vi_du: `${baseUrl}/tools/key?action=delete&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI&secret=${ADMIN_SECRET}`
        },
        danh_sach_key: {
          cu_phap: `${baseUrl}/tools/key?action=list&secret={admin_secret}`,
          vi_du: `${baseUrl}/tools/key?action=list&secret=${ADMIN_SECRET}`
        }
      }
    });
  }

  // =============================================================
  // TRANG TÀI LIỆU HƯỚNG DẪN CHI TIẾT CHUYÊN MỤC /tools
  // =============================================================
  if (!firstParam && !searchParams.get("uid") && !searchParams.get("url") && (pathname === "/tools" || pathname === "/api/tools")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Tiện Ích Đa Năng AI (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 4,
      danh_sach_tool: {
        quan_ly_key: {
          ten_api: "Hệ Thống Cấp Khóa & Quản Lý Key (ZheeTool Key Manager)",
          duong_dan: "/tools/key",
          phuong_thuc: "GET/POST",
          mo_ta: "Tạo, kiểm tra số lượt nhập, hạn dùng theo thời gian và xóa key. Hỗ trợ Session IP chống trừ lượt khi reload.",
          cu_phap: [
            `${baseUrl}/tools/key?action=check&key={zheetool_key}`,
            `${baseUrl}/tools/key?action=create&uses={so_luot}&hours={so_gio}&secret={admin_secret}`
          ],
          vi_du: [
            `${baseUrl}/tools/key?action=create&uses=15&hours=72&secret=${ADMIN_SECRET}`,
            `${baseUrl}/tools/key?action=check&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI`
          ]
        },
        freefire_lookup: {
          ten_api: "Tra Cứu Thông Tin Free Fire (Player Info Lookup)",
          duong_dan: "/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu thông tin tài khoản Free Fire (Tên nhân vật, Region, UID) qua UID người chơi.",
          cu_phap: [
            `${baseUrl}/tools/freefire?={uid_game}`,
            `${baseUrl}/tools/freefire?uid={uid_game}&key={api_key}`
          ],
          vi_du: [
            `${baseUrl}/tools/freefire?=86744126`,
            `${baseUrl}/tools/freefire?uid=86744126&key=zhee_vip`
          ]
        },
        ai_remove_bg: {
          ten_api: "Xóa Phông Nền Ảnh Trực Tiếp (Remove.bg AI Pro)",
          duong_dan: "/tools/removebg",
          phuong_thuc: "GET",
          mo_ta: "Tách nền ảnh tự động bằng API Remove.bg chính hãng, trả về link file ảnh PNG trong suốt dùng được ngay và Data URI.",
          tham_so: {
            url: "Đường dẫn URL ảnh gốc cần tách nền (Bắt buộc)",
            raw: "true/false (Tùy chọn: nếu để &raw=true sẽ xuất thẳng ảnh PNG để xem/tải trực tiếp trên trình duyệt)"
          },
          cu_phap: [
            `${baseUrl}/tools/removebg?url={link_anh}`,
            `${baseUrl}/tools/removebg?={link_anh}`,
            `${baseUrl}/tools/removebg?url={link_anh}&raw=true`
          ],
          vi_du: [
            `${baseUrl}/tools/removebg?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg`
          ]
        },
        ai_enhance_image: {
          ten_api: "Làm Nét & Tăng Độ Phân Giải Ảnh (AI Image Enhancer)",
          duong_dan: "/tools/enhance",
          phuong_thuc: "GET",
          mo_ta: "Khử mờ, tái tạo chi tiết và làm nét ảnh chất lượng cao chuẩn HD 2K/4K.",
          tham_so: {
            url: "Đường dẫn URL ảnh gốc cần làm nét (Bắt buộc)",
            raw: "true/false (Tùy chọn: nếu để &raw=true sẽ chuyển hướng xem trực tiếp ảnh HD)"
          },
          cu_phap: [
            `${baseUrl}/tools/enhance?url={link_anh}`,
            `${baseUrl}/tools/enhance?={link_anh}`
          ],
          vi_du: [
            `${baseUrl}/tools/enhance?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg`
          ]
        }
      }
    });
  }

  // =============================================================
  // ROUTE 1: TRA CỨU FREE FIRE (/tools/freefire)
  // =============================================================
  if (pathname.includes("/freefire")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    let uid = searchParams.get("uid") || searchParams.get("id") || firstParam;
    let key = searchParams.get("key") || "";

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "UID Free Fire không hợp lệ (chỉ gồm các chữ số)." });
    }
    if (key && !VALID_KEYS.includes(key)) {
      return res.status(403).json({ trang_thai: "that_bai", thong_bao: "API Key không hợp lệ." });
    }

    const playerData = await requestGarenaPlayer(uid);
    if (!playerData) {
      return res.status(404).json({ trang_thai: "that_bai", thong_bao: `Không tìm thấy thông tin cho UID: ${uid}` });
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
  // ROUTE 2 & 3: XỬ LÝ ẢNH AI (REMOVEBG / ENHANCE)
  // =============================================================
  let imgUrl = searchParams.get("url") || searchParams.get("link") || searchParams.get("img") || firstParam;
  const isRaw = searchParams.get("raw") === "true";

  if (!imgUrl || !/^https?:\/\//i.test(imgUrl)) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng cung cấp link hình ảnh hợp lệ (bắt đầu bằng http:// hoặc https://)."
    });
  }

  // Làm nét ảnh (/tools/enhance)
  if (pathname.includes("/enhance")) {
    const directHdUrl = `https://wsrv.nl/?url=${encodeURIComponent(imgUrl)}&output=webp&q=100&sharp=15&w=2400`;
    if (isRaw) {
      return res.redirect(directHdUrl);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "ai_image_enhance",
      tac_gia: "ZheeDevTool",
      anh_goc: imgUrl,
      link_anh_hd: directHdUrl
    });
  }

  // Xóa phông nền (/tools/removebg)
  try {
    const { buffer, directLink, dataUri } = await callRemoveBgEngine(imgUrl);

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
      link_anh_da_xoa_nen: directLink || "Xem trực tiếp qua Data URI",
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