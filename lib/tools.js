const https = require("https");
const { PUBLIC_CREATION_SECRET, MASTER_ADMIN_SECRET, createKey, verifyAndConsumeKey, deleteKey, listAllKeys } = require("./keyManager");

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || "JKsYj7QVipWHtzy5KZXS7WZA";
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || "").trim();

const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026", "Zhee_secret@2026", "minhhocgioi"];

// 1. ENGINE FREE FIRE LOOKUP
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

// 2. ENGINE AI CHAT TRỰC TIẾP
async function requestAiChat(promptText, modelType = "gemini") {
  const isGemini = modelType.toLowerCase() === "gemini";

  if (isGemini && GEMINI_API_KEY) {
    const flashModels = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-flash",
      "gemini-2.0-flash-exp"
    ];

    for (const model of flashModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }]
          }),
          signal: AbortSignal.timeout(10000)
        });

        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (res.ok && reply) {
          return {
            model: `Google ${model} (Official API)`,
            response: reply.trim()
          };
        }
      } catch (_) {}
    }
  }

  if (!isGemini && OPENAI_API_KEY) {
    try {
      const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: promptText }],
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(10000)
      });
      const json = await openAiRes.json();
      if (openAiRes.ok && json.choices?.[0]?.message?.content) {
        return {
          model: "ChatGPT-4o Mini (Official API)",
          response: json.choices[0].message.content.trim()
        };
      }
    } catch (_) {}
  }

  try {
    const gatewayRes = await fetch("https://api.airforce/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: isGemini ? "gemini-2.0-flash" : "gpt-4o-mini",
        messages: [{ role: "user", content: promptText }]
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (gatewayRes.ok) {
      const dataGpt = await gatewayRes.json();
      if (dataGpt.choices?.[0]?.message?.content) {
        return {
          model: isGemini ? "Google Gemini 2.0 (High Speed Gateway)" : "ChatGPT-4o Mini (High Speed Gateway)",
          response: dataGpt.choices[0].message.content.trim()
        };
      }
    }
  } catch (_) {}

  throw new Error("Không thể kết nối đến máy chủ AI. Vui lòng thử lại sau ít phút.");
}

// 3. ENGINE UPLOAD FREE HOST
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

// 4. ENGINE REMOVE.BG
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
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

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
  // ROUTE AI CHAT (/tools/chat & /api/tools/chat)
  // =============================================================
  if (pathname.includes("/chat")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const promptText = searchParams.get("q") || searchParams.get("ask") || searchParams.get("text") || firstParam;
    const modelType = searchParams.get("model") || searchParams.get("type") || "gemini";
    const key = searchParams.get("key") || "";

    if (!promptText) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập câu hỏi qua tham số ?q={noi_dung_hoi}."
      });
    }

    if (key && !VALID_KEYS.includes(key)) {
      return res.status(403).json({ trang_thai: "that_bai", thong_bao: "API Key không hợp lệ." });
    }

    try {
      const aiResult = await requestAiChat(promptText, modelType);
      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "Trợ Lý Trò Chuyện Trí Tuệ Nhân Tạo (/tools/chat)",
        tac_gia: "Hồ Đức Minh (Zhee Dev)",
        cau_hoi: promptText,
        mo_hinh: aiResult.model,
        phan_hoi: aiResult.response
      });
    } catch (err) {
      return res.status(500).json({
        trang_thai: "that_bai",
        thong_bao: err.message || "Lỗi xử lý phản hồi từ AI API."
      });
    }
  }

  // =============================================================
  // ROUTE QUẢN LÝ KEY (/tools/key & /api/tools/key)
  // =============================================================
  if (pathname.includes("/key") || (searchParams.has("action") && !pathname.includes("/freefire"))) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const action = searchParams.get("action") || pathname.split("/").pop();
    const userSecret = searchParams.get("secret") || searchParams.get("key") || req.headers["x-admin-secret"] || "";

    if (action === "create" || action === "tao") {
      if (userSecret !== PUBLIC_CREATION_SECRET && userSecret !== MASTER_ADMIN_SECRET) {
        return res.status(403).json({ trang_thai: "that_bai", ma_loi: 403, thong_bao: "Sai mã secret tạo key!" });
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

    if (action === "check" || action === "kiemtra") {
      const key = searchParams.get("key") || firstParam || "";
      const consume = searchParams.get("consume") !== "false";
      const encrypt = searchParams.get("encrypt") === "true";

      const checkResult = verifyAndConsumeKey(key, clientIp, consume, encrypt);
      if (!checkResult.hop_le && !checkResult.encrypted_data) {
        return res.status(400).json(checkResult);
      }

      return res.status(200).json(checkResult);
    }

    if (action === "delete" || action === "xoa") {
      if (userSecret !== PUBLIC_CREATION_SECRET && userSecret !== MASTER_ADMIN_SECRET) {
        return res.status(403).json({ trang_thai: "that_bai", ma_loi: 403, thong_bao: "Sai mã secret xóa key!" });
      }

      const keyToDelete = searchParams.get("target_key") || searchParams.get("del_key") || firstParam || "";
      const deleted = deleteKey(keyToDelete);

      if (!deleted) {
        return res.status(404).json({ trang_thai: "that_bai", thong_bao: "Không tìm thấy Key để xóa!" });
      }

      return res.status(200).json({ trang_thai: "thanh_cong", thong_bao: `Đã xóa vĩnh viễn Key ${keyToDelete}` });
    }

    if (action === "list" || action === "danhsach") {
      if (userSecret !== "minhhocgioi" && userSecret !== MASTER_ADMIN_SECRET) {
        return res.status(403).json({
          trang_thai: "that_bai",
          ma_loi: 403,
          thong_bao: "Chỉ Admin chính thức mới có quyền xem danh sách Key!"
        });
      }

      const showRaw = searchParams.get("raw_key") === "true";

      return res.status(200).json({
        trang_thai: "thanh_cong",
        admin_xac_thuc: "m...gioi",
        tong_so_key: listAllKeys(!showRaw).length,
        danh_sach: listAllKeys(!showRaw)
      });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Hệ Thống Quản Trị & Cấp Khóa Key ZheeTool (/tools/key)",
      dinh_dang_key: "ZheeTool-xxxxx-xxxx-xxxxx-xxxx-xxxx-xxx",
      co_che_bao_mat: "HMAC-SHA256 Digital Signature + Chống Replay Nonce + Session Lock IP 1 giờ",
      cac_endpoint: {
        tao_key: {
          cu_phap: `${baseUrl}/api/tools/key?action=create&uses={so_luot}&hours={so_gio}&note={ghi_chu}&secret=Zhee_secret@2026`,
          vi_du: `${baseUrl}/api/tools/key?action=create&uses=20&hours=48&note=KhachVIP&secret=Zhee_secret@2026`
        },
        check_va_tru_luot: {
          cu_phap: `${baseUrl}/api/tools/key?action=check&key={zheetool_key}`,
          vi_du: `${baseUrl}/api/tools/key?action=check&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI`
        },
        check_ma_hoa_chong_dump: {
          cu_phap: `${baseUrl}/api/tools/key?action=check&encrypt=true&key={zheetool_key}`,
          vi_du: `${baseUrl}/api/tools/key?action=check&encrypt=true&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI`
        },
        check_khong_tru_luot: {
          cu_phap: `${baseUrl}/api/tools/key?action=check&consume=false&key={zheetool_key}`,
          vi_du: `${baseUrl}/api/tools/key?action=check&consume=false&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI`
        },
        xoa_key: {
          cu_phap: `${baseUrl}/api/tools/key?action=delete&target_key={zheetool_key}&secret=Zhee_secret@2026`,
          vi_du: `${baseUrl}/api/tools/key?action=delete&target_key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI&secret=Zhee_secret@2026`
        },
        danh_sach_key: {
          cu_phap: `${baseUrl}/api/tools/key?action=list&secret=m...gioi`,
          vi_du: `${baseUrl}/api/tools/key?action=list&secret=m...gioi`
        }
      }
    });
  }

  // =============================================================
  // TRANG TÀI LIỆU HƯỚNG DẪN CHI TIẾT CHUYÊN MỤC /tools & /api/tools
  // =============================================================
  if (!firstParam && !searchParams.get("uid") && !searchParams.get("url") && (pathname === "/tools" || pathname === "/api/tools")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Tiện Ích Đa Năng AI (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 11,
      danh_sach_tool: {
        tao_captcha: {
          ten_api: "Tạo Captcha Ảnh (méo chữ, lưới, nhiễu)",
          duong_dan: "/api/tools/captcha",
          phuong_thuc: "GET/POST",
          mo_ta: "Nhiều kiểu: ký tự, số, mã ABC-123, toán, chọn hình. Ảnh qua trường anh. Token HMAC 5 phút.",
          cu_phap: [
            `${baseUrl}/api/tools/captcha?kieu=kytu`,
            `${baseUrl}/api/tools/captcha?kieu=so`,
            `${baseUrl}/api/tools/captcha?kieu=code`,
            `${baseUrl}/api/tools/captcha?kieu=toan`,
            `${baseUrl}/api/tools/captcha?kieu=hinh`,
            `${baseUrl}/api/tools/captcha?action=verify&token={token}&traloi={dap_an}`
          ],
          vi_du: [
            `${baseUrl}/api/tools/captcha?kieu=toan`,
            `${baseUrl}/api/tools/captcha?kieu=hinh`
          ]
        },
        dich_thuat: {
          ten_api: "Dịch Thuật Đa Ngôn Ngữ (Google Translate)",
          duong_dan: "/api/tools/trans",
          phuong_thuc: "GET/POST",
          mo_ta: "Dịch văn bản giữa các ngôn ngữ. Tự nhận diện ngôn ngữ nguồn, mặc định dịch sang tiếng Việt. Hỗ trợ alias: anh, nhat, han, trung, phap, duc, nga, thai...",
          cu_phap: [
            `${baseUrl}/api/tools/trans?={cau_can_dich}`,
            `${baseUrl}/api/tools/trans?text={cau}&to={ma_ngon_ngu}`,
            `${baseUrl}/api/tools/trans?text={cau}&from={nguon}&to={dich}`,
            `${baseUrl}/api/tools/trans?action=langs`
          ],
          vi_du: [
            `${baseUrl}/api/tools/trans?=Hello, how are you?`,
            `${baseUrl}/api/tools/trans?text=${encodeURIComponent("Xin chào")}&to=en`,
            `${baseUrl}/api/tools/trans?text=${encodeURIComponent("こんにちは")}&to=vi`,
            `${baseUrl}/api/tools/trans?text=I love you&to=ja`
          ]
        },
        ngl_lookup: {
          ten_api: "NGL.link — Check Username & Gửi 1 Tin Nhắn Ẩn Danh",
          duong_dan: "/api/tools/ngl",
          phuong_thuc: "GET/POST",
          mo_ta: "Kiểm tra username NGL còn trống hay đã đăng ký. Gửi đúng 1 tin nhắn ẩn danh mỗi lần gọi. Không hỗ trợ spam, proxy farm hay multi-thread.",
          cu_phap: [
            `${baseUrl}/api/tools/ngl?={username}`,
            `${baseUrl}/api/tools/ngl?username={username}`,
            `${baseUrl}/api/tools/ngl?action=send&username={username}&question={noi_dung}`
          ],
          vi_du: [
            `${baseUrl}/api/tools/ngl?=hoducminh`,
            `${baseUrl}/api/tools/ngl?username=https://ngl.link/hoducminh`,
            `${baseUrl}/api/tools/ngl?action=send&username=hoducminh&question=${encodeURIComponent("con mẹ mày")}`
          ]
        },
        check_locket_username: {
          ten_api: "Locket Widget — Check Username & Tài Khoản (Token / Email / SĐT)",
          duong_dan: "/api/tools/locket",
          phuong_thuc: "GET/POST",
          mo_ta: "Check username công khai. Đăng nhập token/email/SĐT để lấy tài khoản, bạn bè, moment (mặc định mã hóa AES-256, giải bằng action=decrypt hoặc xem thô bằng encrypt=false), gửi/hủy đúng 1 lời mời. Tạo đúng 1 tài khoản / 5 phút (tự nhập email). Không hỗ trợ spam / farm.",
          cu_phap: [
            `${baseUrl}/api/tools/locket?={username}`,
            `${baseUrl}/api/tools/locket?action=me&token={id_token}`,
            `${baseUrl}/api/tools/locket?action=me&email={email}&password={mat_khau}`,
            `${baseUrl}/api/tools/locket?action=friends&token={id_token}`,
            `${baseUrl}/api/tools/locket?action=moments&token={id_token}`,
            `${baseUrl}/api/tools/locket?action=decrypt&iv={iv}&data={encrypted_data}`,
            `${baseUrl}/api/tools/locket?action=add&token={id_token}&username={username}`,
            `${baseUrl}/api/tools/locket?action=cancel&token={id_token}&uid={uid}&direction=outgoing`,
            `${baseUrl}/api/tools/locket?action=register&email={email}&password={mat_khau}&username={username}&ten={ten}`
          ],
          vi_du: [
            `${baseUrl}/api/tools/locket?=minh`,
            `${baseUrl}/api/tools/locket?username=alex`,
            `${baseUrl}/api/tools/locket?action=me&token={id_token}`,
            `${baseUrl}/api/tools/locket?action=friends&token={id_token}`,
            `${baseUrl}/api/tools/locket?action=moments&token={id_token}&limit=8`,
            `${baseUrl}/api/tools/locket?action=friends&token={id_token}&encrypt=false`,
            `${baseUrl}/api/tools/locket?action=decrypt&iv={iv}&data={encrypted_data}`,
            `${baseUrl}/api/tools/locket?action=add&token={id_token}&username=minh`,
            `${baseUrl}/api/tools/locket?action=register&email={email}&password={mat_khau}&username=tenban&ten=Minh`
          ]
        },
        check_sdt_lookup: {
          ten_api: "Tra Cứu Thông Tin Số Điện Thoại (Twilio Lookup V2 Carrier & SIM Inspector)",
          duong_dan: "/api/tools/checksdt",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu thông tin nhà mạng, loại thuê bao, quốc gia, tình trạng SIM Swap và chuyển tiếp cuộc gọi.",
          cu_phap: [
            `${baseUrl}/api/tools/checksdt?={so_dien_thoai}`,
            `${baseUrl}/api/tools/checksdt?phone={so_dien_thoai}`,
            `${baseUrl}/api/tools/checksdt?sdt={so_dien_thoai}`
          ],
          vi_du: [
            `${baseUrl}/api/tools/checksdt?=0944921186`,
            `${baseUrl}/api/tools/checksdt?phone=+84944921186`
          ]
        },
        check_imei_ios: {
          ten_api: "Kiểm Tra IMEI / Serial / Số Máy Apple iOS (Check IMEI & Device Inspector)",
          duong_dan: "/api/tools/checkimei",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu thông tin thiết bị Apple (iPhone, iPad, Mac) qua IMEI, Serial hoặc Model Number. Bảo mật 100%, không lưu lịch sử máy.",
          cu_phap: [
            `${baseUrl}/api/tools/checkimei?={imei_hoac_serial_hoac_so_may}`,
            `${baseUrl}/api/tools/checkimei?imei={15_so_imei}`,
            `${baseUrl}/api/tools/checkimei?serial={so_seri}`,
            `${baseUrl}/api/tools/checkimei?model={so_may_mp_number}`
          ],
          vi_du: [
            `${baseUrl}/api/tools/checkimei?=MLXJ3VN/A`,
            `${baseUrl}/api/tools/checkimei?=F17DQC010D6L`,
            `${baseUrl}/api/tools/checkimei?imei=352707665849620`
          ]
        },
        ai_chat_assistant: {
          ten_api: "Trò Chuyện Trí Tuệ Nhân Tạo (ChatGPT & Gemini AI)",
          duong_dan: "/api/tools/chat",
          phuong_thuc: "GET",
          mo_ta: "Tương tác trò chuyện với Google Gemini hoặc OpenAI ChatGPT.",
          cu_phap: [
            `${baseUrl}/api/tools/chat?q={cau_hoi}&model=gemini`,
            `${baseUrl}/api/tools/chat?q={cau_hoi}&model=chatgpt`
          ],
          vi_du: [
            `${baseUrl}/api/tools/chat?q=bạn là ai&model=gemini`,
            `${baseUrl}/api/tools/chat?q=bạn hãy làm thơ&model=gemini`
          ]
        },
        quan_ly_key: {
          ten_api: "Hệ Thống Cấp Khóa & Quản Lý Key (ZheeTool Key Manager)",
          duong_dan: "/api/tools/key",
          phuong_thuc: "GET/POST",
          mo_ta: "Tạo, kiểm tra số lượt nhập, hạn dùng theo thời gian và xóa key. Tích hợp ký số HMAC-SHA256, mã hóa AES-256, ẩn key m...gioi và chống trừ lượt theo Session IP.",
          cu_phap: [
            `${baseUrl}/api/tools/key?action=check&key={zheetool_key}`,
            `${baseUrl}/api/tools/key?action=list&secret=m...gioi`,
            `${baseUrl}/api/tools/key?action=create&uses={so_luot}&hours={so_gio}&secret=Zhee_secret@2026`
          ],
          vi_du: [
            `${baseUrl}/api/tools/key?action=create&uses=15&hours=72&secret=Zhee_secret@2026`,
            `${baseUrl}/api/tools/key?action=check&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI`,
            `${baseUrl}/api/tools/key?action=list&secret=m...gioi`
          ]
        },
        freefire_lookup: {
          ten_api: "Tra Cứu Thông Tin Free Fire (Player Info Lookup)",
          duong_dan: "/api/tools/freefire",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu thông tin tài khoản Free Fire (Tên nhân vật, Region, UID) qua UID người chơi.",
          cu_phap: [
            `${baseUrl}/api/tools/freefire?={uid_game}`,
            `${baseUrl}/api/tools/freefire?uid={uid_game}&key={api_key}`
          ],
          vi_du: [
            `${baseUrl}/api/tools/freefire?=86744126`,
            `${baseUrl}/tools/freefire?uid=86744126&key=zhee_vip`
          ]
        },
        ai_remove_bg: {
          ten_api: "Xóa Phông Nền Ảnh Trực Tiếp (Remove.bg AI Pro)",
          duong_dan: "/api/tools/removebg",
          phuong_thuc: "GET",
          mo_ta: "Tách nền ảnh tự động bằng API Remove.bg chính hãng, trả về link file ảnh PNG trong suốt dùng được ngay và Data URI.",
          tham_so: {
            url: "Đường dẫn URL ảnh gốc cần tách nền (Bắt buộc)",
            raw: "true/false (Tùy chọn: nếu để &raw=true sẽ xuất thẳng ảnh PNG để xem/tải trực tiếp trên trình duyệt)"
          },
          cu_phap: [
            `${baseUrl}/api/tools/removebg?url={link_anh}`,
            `${baseUrl}/api/tools/removebg?={link_anh}`,
            `${baseUrl}/api/tools/removebg?url={link_anh}&raw=true`
          ],
          vi_du: [
            `${baseUrl}/api/tools/removebg?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg`
          ]
        },
        ai_enhance_image: {
          ten_api: "Làm Nét & Tăng Độ Phân Giải Ảnh (AI Image Enhancer)",
          duong_dan: "/api/tools/enhance",
          phuong_thuc: "GET",
          mo_ta: "Khử mờ, tái tạo chi tiết và làm nét ảnh chất lượng cao chuẩn HD 2K/4K.",
          tham_so: {
            url: "Đường dẫn URL ảnh gốc cần làm nét (Bắt buộc)",
            raw: "true/false (Tùy chọn: nếu để &raw=true sẽ chuyển hướng xem trực tiếp ảnh HD)"
          },
          cu_phap: [
            `${baseUrl}/api/tools/enhance?url={link_anh}`,
            `${baseUrl}/api/tools/enhance?={link_anh}`
          ],
          vi_du: [
            `${baseUrl}/api/tools/enhance?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg`
          ]
        }
      }
    });
  }

  // =============================================================
  // ROUTE FREE FIRE (/tools/freefire & /api/tools/freefire)
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
  // ROUTE ẢNH AI (REMOVEBG / ENHANCE)
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