const dns = require("dns");
const { PUBLIC_CREATION_SECRET, MASTER_ADMIN_SECRET, createKey, verifyAndConsumeKey, deleteKey, listAllKeys } = require("./keyManager");

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) {}

const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || "JKsYj7QVipWHtzy5KZXS7WZA";
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || "").trim();

const VALID_KEYS = ["zhee_vip", "hoducminh123", "free_key_2026", "Zhee_secret@2026", "minhhocgioi"];

// 1. ENGINE FREE FIRE LOOKUP
// The lookup is intentionally kept in-memory: Vercel reuses warm functions,
// so this reduces repeated upstream calls without adding a new database.
const FREE_FIRE_CACHE = new Map();
const FREE_FIRE_CACHE_TTL_MS = 5 * 60 * 1000;
const FREE_FIRE_CACHE_MAX_ITEMS = 200;
const FREE_FIRE_TIMEOUT_MS = 8000;
const FREE_FIRE_BATCH_LIMIT = 20;

const CODASHOP_FREE_FIRE_URL = "https://order-sg.codashop.com/initPayment.action";
// /ffinfo hangs from the Singapore datacenter. /name answers with the nickname on the same host.
const FFX_INFO_URL = "https://ffxinfo-ffx.ffxapis.workers.dev/name";

function upstreamError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function decodeShopName(value) {
  const text = String(value || "").replace(/\+/g, " ");
  try {
    return decodeURIComponent(text);
  } catch (_) {
    return text;
  }
}

function rememberFreeFire(uid, entry) {
  if (FREE_FIRE_CACHE.size >= FREE_FIRE_CACHE_MAX_ITEMS) {
    FREE_FIRE_CACHE.delete(FREE_FIRE_CACHE.keys().next().value);
  }
  FREE_FIRE_CACHE.set(uid, {
    ...entry,
    expiresAt: Date.now() + FREE_FIRE_CACHE_TTL_MS
  });
}

function playerRecord(loginId, nickname, region, source) {
  const name = String(nickname || "").trim();
  if (!name) return null;
  return {
    Region: String(region || "").trim() || "UNKNOWN",
    Nickname: name,
    Uid: String(loginId),
    Author: "Hồ Đức Minh",
    source
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

// Indonesia shop validates the UID and returns the nickname when that catalog can top up the account.
// Other regions come back as "region blocked" or "wrong player id" and fall through to the identity lookup.
async function requestCodashopPlayer(loginId, signal) {
  const body = JSON.stringify({
    "voucherPricePoint.id": 28153,
    "voucherPricePoint.price": 1000000,
    "voucherPricePoint.variablePrice": 0,
    "user.userId": String(loginId),
    "user.zoneId": "",
    "voucherTypeName": "FREEFIRE",
    "lvtId": "",
    "shopLang": "id_ID",
    "dynamicSkuToken": "",
    "pricePointDynamicSkuToken": "",
    "voucherTypeId": ""
  });

  let response;
  try {
    response = await fetch(CODASHOP_FREE_FIRE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://www.codashop.com",
        Referer: "https://www.codashop.com/",
        "User-Agent": "Mozilla/5.0"
      },
      body,
      signal
    });
  } catch (_) {
    return null;
  }

  const data = await readJsonResponse(response);
  if (!data || data.RESULT_CODE === 10001 || data.RESULT_CODE === "10001") return null;

  const fields = data.confirmationFields || {};
  const roleName = fields.roles && fields.roles[0] && fields.roles[0].role;
  const nickname = decodeShopName(roleName || fields.username || "");
  if (data.success && !data.errorMsg && nickname) {
    return playerRecord(loginId, nickname, "ID", "codashop");
  }
  return null;
}

async function requestFfxPlayer(loginId, endpoint, signal) {
  let response;
  try {
    response = await fetch(`${endpoint}?uid=${encodeURIComponent(loginId)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      },
      signal
    });
  } catch (error) {
    if (error && error.name === "AbortError") throw error;
    throw upstreamError("upstream_unavailable");
  }

  const data = await readJsonResponse(response);
  const identity = data && data.data && (data.data.identity || data.data);
  if (identity && identity.username) {
    return playerRecord(identity.uid || loginId, identity.username, identity.region, "ffxinfo");
  }

  const message = String((data && data.msg) || "");
  if (response.status === 422 || /uid_must_contain/i.test(message)) {
    throw upstreamError("invalid_uid");
  }
  if (response.status === 429 || /rate_limited/i.test(message)) {
    throw upstreamError("upstream_rate_limit");
  }
  // This source answers unknown UIDs with 502 and a null username, not a 404.
  if (
    response.status === 404 ||
    /not_found|id_not_found|player_not_found|no_account|uid_not_found|failed to fetch player info|upstream_http_error/i.test(message)
  ) {
    return null;
  }
  throw upstreamError("upstream_unavailable");
}

function miss(code) {
  return upstreamError(code);
}

async function firstResolvedPlayer(factories) {
  const controllers = factories.map(() => new AbortController());
  const timers = controllers.map((controller) => setTimeout(() => controller.abort(), 6500));
  try {
    return await Promise.any(factories.map((factory, index) => factory(controllers[index].signal).then((player) => {
      if (!player) throw miss("not_found");
      return player;
    })));
  } catch (error) {
    const reasons = error instanceof AggregateError ? error.errors : [error];
    const hardFailure = reasons.find((reason) => reason && reason.code && reason.code !== "not_found");
    if (hardFailure) throw hardFailure;
    if (reasons.some((reason) => reason && reason.name === "AbortError")) {
      throw upstreamError("upstream_timeout");
    }
    return null;
  } finally {
    timers.forEach((timer) => clearTimeout(timer));
    controllers.forEach((controller) => controller.abort());
  }
}

async function requestFreeFirePlayer(loginId) {
  return firstResolvedPlayer([
    (signal) => requestCodashopPlayer(loginId, signal),
    (signal) => requestFfxPlayer(loginId, FFX_INFO_URL, signal)
  ]);
}

async function lookupFreeFirePlayer(loginId) {
  const normalizedUid = String(loginId);
  const cached = FREE_FIRE_CACHE.get(normalizedUid);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.notFound) return null;
    return { ...cached.player, cache_hit: true };
  }
  if (cached) FREE_FIRE_CACHE.delete(normalizedUid);

  const player = await requestFreeFirePlayer(normalizedUid);
  if (!player) {
    rememberFreeFire(normalizedUid, { notFound: true, player: null });
    return null;
  }

  rememberFreeFire(normalizedUid, { notFound: false, player });
  return { ...player, cache_hit: false };
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
async function verifyEnhancedImage(proxyUrl) {
  const response = await fetch(proxyUrl, {
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
    signal: AbortSignal.timeout(30000)
  });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!response.ok || !contentType.startsWith("image/")) {
    try { await response.body?.cancel(); } catch (_) {}
    throw new Error(`Image proxy không trả về ảnh hợp lệ (HTTP ${response.status}).`);
  }
  try { await response.body?.cancel(); } catch (_) {}
  return contentType;
}

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
      return res.status(403).json({ trang_thai: "that_bai", thong_bao: "API Key không hợp lệ.", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
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
  // ROUTE QR CODE GOQR.ME (/tools/qr & /api/tools/qr)
  // =============================================================
  if (pathname.includes("/qr")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const text = searchParams.get("text") || searchParams.get("data") || searchParams.get("url") || searchParams.get("q") || firstParam;
    const sizeRaw = Number(searchParams.get("size") || 300);
    const size = Number.isFinite(sizeRaw) ? Math.min(1000, Math.max(100, Math.round(sizeRaw))) : 300;
    if (!text) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập nội dung QR qua ?text=, ?url= hoặc ?data=.",
        vi_du: `${baseUrl}/api/tools/qr?text=https%3A%2F%2Fexample.com&size=300`,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }
    if (String(text).length > 4096) {
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Nội dung QR tối đa 4096 ký tự.", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    }
    const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "qr_code",
      nguon: "goQR.me",
      noi_dung: text,
      kich_thuoc: `${size}x${size}`,
      link_anh_qr: imageUrl,
      anh_qr: imageUrl,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  // =============================================================
  // ROUTE URL SHORTENER (TINYURL / BITLY)
  // =============================================================
  if (pathname.includes("/shortener") || pathname.includes("/shorten") || pathname.includes("/tinyurl") || pathname.includes("/bitly")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const longUrl = searchParams.get("url") || searchParams.get("link") || searchParams.get("long_url") || searchParams.get("q") || firstParam;
    const provider = (searchParams.get("provider") || (pathname.includes("bitly") ? "bitly" : "tinyurl")).toLowerCase();
    if (!longUrl || !/^https?:\/\//i.test(longUrl)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Vui lòng nhập URL hợp lệ bắt đầu bằng http:// hoặc https://.",
        vi_du: `${baseUrl}/api/tools/shortener?url=https%3A%2F%2Fexample.com&provider=tinyurl`,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }
    try {
      let shortUrl = "";
      if (provider === "bitly") {
        const token = String(process.env.BITLY_ACCESS_TOKEN || "").trim();
        if (!token) {
          return res.status(503).json({
            trang_thai: "that_bai",
            ma_loi: "BITLY_ACCESS_TOKEN_MISSING",
            thong_bao: "Bitly cần cấu hình BITLY_ACCESS_TOKEN trên server. Hãy dùng provider=tinyurl nếu chưa có token.",
            tac_gia: "Hồ Đức Minh (Zhee Dev)"
          });
        }
        const response = await fetch("https://api-ssl.bitly.com/v4/shorten", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ long_url: longUrl }),
          signal: AbortSignal.timeout(10000)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.link) throw new Error(payload.message || `Bitly HTTP ${response.status}`);
        shortUrl = payload.link;
      } else {
        const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, { signal: AbortSignal.timeout(10000) });
        const body = (await response.text()).trim();
        if (!response.ok || !/^https?:\/\//i.test(body)) throw new Error(body || `TinyURL HTTP ${response.status}`);
        shortUrl = body;
      }
      return res.status(200).json({ trang_thai: "thanh_cong", loai: "url_shortener", nha_cung_cap: provider === "bitly" ? "Bitly" : "TinyURL", link_goc: longUrl, link_ngan: shortUrl, tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    } catch (error) {
      return res.status(502).json({ trang_thai: "that_bai", ma_loi: "URL_SHORTENER_UPSTREAM_ERROR", nha_cung_cap: provider === "bitly" ? "Bitly" : "TinyURL", thong_bao: error.message || "Không thể rút gọn URL.", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    }
  }

  // =============================================================
  // ROUTE USER-AGENT PARSER
  // =============================================================
  if (pathname.includes("/ua-parser") || pathname.includes("/user-agent-parser")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const userAgent = searchParams.get("ua") || searchParams.get("user_agent") || req.headers["user-agent"] || firstParam;
    if (!userAgent) return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Nhập chuỗi User-Agent qua ?ua=...", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    const heDieuHanh = /android/i.test(userAgent) ? "Android" : /iphone|ipad|ios/i.test(userAgent) ? "iOS" : /windows/i.test(userAgent) ? "Windows" : /mac os/i.test(userAgent) ? "macOS" : /linux/i.test(userAgent) ? "Linux" : "Không xác định";
    const thietBi = /iphone/i.test(userAgent) ? "iPhone" : /ipad/i.test(userAgent) ? "iPad" : /android/i.test(userAgent) ? (/samsung|sm-|gt-|galaxy/i.test(userAgent) ? "Samsung/Android" : "Android" ) : /windows|macintosh|linux/i.test(userAgent) ? "PC" : "Không xác định";
    const trinhDuyet = /edg\//i.test(userAgent) ? "Microsoft Edge" : /chrome\//i.test(userAgent) ? "Google Chrome" : /firefox\//i.test(userAgent) ? "Mozilla Firefox" : /safari\//i.test(userAgent) && !/chrome\//i.test(userAgent) ? "Safari" : /opr\//i.test(userAgent) ? "Opera" : "Không xác định";
    return res.status(200).json({ trang_thai: "thanh_cong", loai: "user_agent_parser", user_agent: userAgent, thiet_bi: thietBi, he_dieu_hanh: heDieuHanh, trinh_duyet: trinhDuyet, tac_gia: "Hồ Đức Minh (Zhee Dev)" });
  }

  // =============================================================
  // DYNAMIC BADGE / AVATAR SVG
  // =============================================================
  if (pathname.includes("/badge") || pathname.includes("/avatar")) {
    const isAvatar = pathname.includes("/avatar");
    const source = searchParams.get("name") || searchParams.get("text") || firstParam || "User";
    const escSvg = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
    if (isAvatar) {
      const initials = source.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
      let hash = 0; for (const char of source) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
      const hue = Math.abs(hash) % 360; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><circle cx="80" cy="80" r="80" fill="hsl(${hue} 68% 45%)"/><text x="80" y="91" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" font-weight="700" fill="white">${escSvg(initials)}</text></svg>`;
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      return res.status(200).send(svg);
    }
    const label = searchParams.get("label") || "Status"; const status = searchParams.get("status") || "Passing"; const color = /^[a-zA-Z0-9#-]+$/.test(searchParams.get("color") || "") ? searchParams.get("color") : "green";
    const labelWidth = Math.max(50, label.length * 7 + 18); const statusWidth = Math.max(55, status.length * 7 + 18); const total = labelWidth + statusWidth;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${escSvg(label)}: ${escSvg(status)}"><title>${escSvg(label)}: ${escSvg(status)}</title><rect width="${labelWidth}" height="20" fill="#555"/><rect x="${labelWidth}" width="${statusWidth}" height="20" fill="${escSvg(color)}"/><g fill="#fff" text-anchor="middle" font-family="Verdana,Arial,sans-serif" font-size="11"><text x="${labelWidth / 2}" y="14">${escSvg(label)}</text><text x="${labelWidth + statusWidth / 2}" y="14">${escSvg(status)}</text></g></svg>`;
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    return res.status(200).send(svg);
  }

  // =============================================================
  // ROUTE LINK METADATA / OPEN GRAPH (MICROLINK)
  // =============================================================
  if (pathname.includes("/metadata")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const target = searchParams.get("url") || searchParams.get("link") || firstParam;
    if (!target || !/^https?:\/\//i.test(target)) return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Vui lòng nhập URL hợp lệ qua ?url=https://example.com.", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    try {
      const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(target)}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.status !== "success") throw new Error(payload.data?.error || payload.message || `Microlink HTTP ${response.status}`);
      return res.status(200).json({ trang_thai: "thanh_cong", loai: "link_metadata", nguon: "Microlink", url: target, du_lieu: payload.data || payload, tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    } catch (error) {
      return res.status(502).json({ trang_thai: "that_bai", ma_loi: "METADATA_UPSTREAM_ERROR", thong_bao: error.message || "Không thể bóc tách metadata.", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    }
  }

  // =============================================================
  // TRANG TÀI LIỆU HƯỚNG DẪN CHI TIẾT CHUYÊN MỤC /tools & /api/tools
  // =============================================================
  if (!firstParam && !searchParams.get("uid") && !searchParams.get("url") && (pathname === "/tools" || pathname === "/api/tools")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      chuyen_muc: "Công Cụ & Tiện Ích Đa Năng AI (/tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 18,
      danh_sach_tool: {
        metadata: {
          ten_api: "Link Metadata & Open Graph (Microlink)",
          duong_dan: "/api/metadata",
          phuong_thuc: "GET",
          mo_ta: "Bóc tách title, description, ảnh preview và Open Graph metadata từ URL bài viết, YouTube hoặc trang tin.",
          cu_phap: [`${baseUrl}/api/metadata?url={url}`],
          vi_du: [`${baseUrl}/api/metadata?url=https%3A%2F%2Fexample.com`]
        },
        qr_code: {
          ten_api: "QR Code Generator (goQR.me)",
          duong_dan: "/api/tools/qr",
          phuong_thuc: "GET",
          mo_ta: "Tạo nhanh mã QR từ URL hoặc chuỗi văn bản bằng link ảnh goQR.me, không cần cài thư viện nặng.",
          cu_phap: [`${baseUrl}/api/tools/qr?text={url_hoac_van_ban}&size=300`],
          vi_du: [`${baseUrl}/api/tools/qr?text=https%3A%2F%2Fexample.com&size=300`]
        },
        url_shortener: {
          ten_api: "URL Shortener (TinyURL / Bitly)",
          duong_dan: "/api/tools/shortener",
          phuong_thuc: "GET",
          mo_ta: "Tự động rút gọn link dài bằng TinyURL hoặc Bitly để gửi tin nhắn và hiển thị gọn gàng.",
          cu_phap: [`${baseUrl}/api/tools/shortener?url={url_dai}&provider=tinyurl`, `${baseUrl}/api/tools/shortener?url={url_dai}&provider=bitly`],
          vi_du: [`${baseUrl}/api/tools/shortener?url=https%3A%2F%2Fexample.com&provider=tinyurl`, `${baseUrl}/api/tools/shortener?url=https%3A%2F%2Fexample.com&provider=bitly`]
        },
        nasa_space_data: {
          ten_api: "NASA Space Data & Astronomy Lookup",
          duong_dan: "/api/tools/nasa",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu APOD, vật thể gần Trái Đất, EPIC và DONKI từ NASA Open APIs. NASA đã lưu trữ Mars Rover Photos API; API key được giữ ở server qua biến môi trường NASA_API_KEY.",
          cu_phap: [
            `${baseUrl}/api/tools/nasa?action=apod`,
            `${baseUrl}/api/tools/nasa?action=neo&start_date=2024-01-01&end_date=2024-01-02`,
            `${baseUrl}/api/tools/nasa?action=epic`,
            `${baseUrl}/api/tools/nasa?action=donki&start_date=2024-01-01&end_date=2024-01-07`
          ],
          vi_du: [
            `${baseUrl}/nasa?action=apod`,
            `${baseUrl}/tools/nasa?action=neo`,
            `${baseUrl}/api/tools/nasa?action=epic`
          ]
        },
        ip_address_intelligence: {
          ten_api: "IP Address Intelligence (IPStack)",
          duong_dan: "/api/tools/ipcheck",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu IPv4/IPv6: vị trí, quốc gia, thành phố, múi giờ, tiền tệ, ASN, ISP và tín hiệu proxy/Tor/crawler qua IPStack. Không lưu IP lâu dài ngoài cache tạm.",
          cu_phap: [
            `${baseUrl}/api/tools/ipcheck?ip={ipv4_hoac_ipv6}`,
            `${baseUrl}/ipcheck?ip=113.175.232.110`,
            `${baseUrl}/api/tools/ipcheck?ip=8.8.8.8`
          ],
          vi_du: [
            `${baseUrl}/ipcheck?ip=113.175.232.110`,
            `${baseUrl}/api/tools/ipcheck?ip=8.8.8.8`
          ]
        },
        checkkeyai: {
          ten_api: "Check API Key AI (hạn, module, token/quota)",
          duong_dan: "/api/tools/checkkeyai",
          phuong_thuc: "GET/POST",
          mo_ta: "Check key OpenAI/Gemini/xAI/Claude/Groq/OpenRouter/DeepSeek... còn hạn, model dùng được, credit/token còn lại (nếu nhà cung cấp công khai). Không lưu key.",
          cu_phap: [
            `${baseUrl}/api/tools/checkkeyai?key={api_key}`,
            `${baseUrl}/api/tools/checkkeyai?key={api_key}&nha=openai`,
            "POST /api/tools/checkkeyai { \"key\": \"...\" }"
          ],
          vi_du: [
            `${baseUrl}/api/tools/checkkeyai?key=sk-proj-...`,
            `${baseUrl}/api/tools/checkkeyai?key=AIza...&nha=gemini`
          ]
        },
        check_scam: {
          ten_api: "Checkscam — Tra cứu thông tin bị báo cáo",
          duong_dan: "/api/tools/checkscam",
          phuong_thuc: "GET/POST",
          mo_ta: "Check STK, SĐT, họ tên đã bị tố cáo/báo cáo lừa đảo (cs.mmovn.space).",
          cu_phap: [
            `${baseUrl}/api/tools/checkscam?={stk_sdt_hoac_ten}`,
            `${baseUrl}/api/tools/checkscam?q={tu_khoa}`,
            `${baseUrl}/api/tools/checkscam?stk={so_tai_khoan}`
          ],
          vi_du: [
            `${baseUrl}/api/tools/checkscam?=1903456789`
          ]
        },
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
          ten_api: "Dịch Thuật Đa Ngôn Ngữ (Google Translate + Voice)",
          duong_dan: "/api/tools/trans",
          phuong_thuc: "GET/POST",
          mo_ta: "Dịch văn bản giữa các ngôn ngữ. Voice: văn bản sang giọng nói, nhiều giọng (giong=nam|nu|brian|amy...). Danh sách: action=voices.",
          cu_phap: [
            `${baseUrl}/api/tools/trans?={cau_can_dich}`,
            `${baseUrl}/api/tools/trans?text={cau}&to={ma_ngon_ngu}`,
            `${baseUrl}/api/tools/trans?text={cau}&from={nguon}&to={dich}`,
            `${baseUrl}/api/tools/trans?action=voice&text={cau}&to={ma_ngon_ngu}`,
            `${baseUrl}/api/tools/trans?action=voice&text={cau}&to=vi&giong=nu`,
            `${baseUrl}/api/tools/trans?action=voice&text={cau}&to=vi&giong=nam`,
            `${baseUrl}/api/tools/trans?action=voice&text={cau}&to=en&giong=aria&format=mp3`,
            `${baseUrl}/api/tools/trans?action=voices`,
            `${baseUrl}/api/tools/trans?action=langs`
          ],
          vi_du: [
            `${baseUrl}/api/tools/trans?=Hello, how are you?`,
            `${baseUrl}/api/tools/trans?text=${encodeURIComponent("Xin chào")}&to=en`,
            `${baseUrl}/api/tools/trans?text=${encodeURIComponent("こんにちは")}&to=vi`,
            `${baseUrl}/api/tools/trans?text=I love you&to=ja`,
            `${baseUrl}/api/tools/trans?action=voice&text=${encodeURIComponent("Xin chào")}&to=vi&giong=nu`,
            `${baseUrl}/api/tools/trans?action=voice&text=Hello&to=en&giong=guy&format=mp3`,
            `${baseUrl}/api/tools/trans?action=voices`
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
            `${baseUrl}/api/tools/removebg?url=https://placehold.co/1200x800/png?text=Zhee%20API`
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
            `${baseUrl}/api/tools/enhance?url=https://placehold.co/1200x800/png?text=Zhee%20API`
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
    const requestedUids = searchParams.get("uids");
    const uid = searchParams.get("uid") || searchParams.get("id") || firstParam;
    const key = searchParams.get("key") || "";

    if (key && !VALID_KEYS.includes(key)) {
      return res.status(403).json({ trang_thai: "that_bai", thong_bao: "API Key không hợp lệ.", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    }

    const uidList = requestedUids
      ? [...new Set(requestedUids.split(",").map((value) => value.trim()).filter(Boolean))]
      : [String(uid || "").trim()];

    if (requestedUids && (!uidList.length || uidList.length > FREE_FIRE_BATCH_LIMIT)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: `Batch UID Free Fire phải có từ 1 đến ${FREE_FIRE_BATCH_LIMIT} UID.`,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }
    if (uidList.some((value) => !/^\d+$/.test(value))) {
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "UID Free Fire không hợp lệ (chỉ gồm các chữ số).", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    }

    const startedAt = Date.now();
    const lookupResults = [];
    for (const value of uidList) {
      try {
        lookupResults.push({ uid: value, player: await lookupFreeFirePlayer(value), error: null });
      } catch (error) {
        lookupResults.push({ uid: value, player: null, error });
      }
    }
    const elapsedMs = Date.now() - startedAt;

    const describeMiss = (requestedUid, error) => {
      if (error && error.code === "invalid_uid") {
        return { httpStatus: 400, thong_bao: "UID Free Fire phải gồm từ 6 đến 15 chữ số." };
      }
      if (error && error.code === "upstream_rate_limit") {
        return { httpStatus: 429, thong_bao: "Nguồn tra cứu Free Fire đang giới hạn tốc độ. Thử lại sau vài giây." };
      }
      if (error) {
        return { httpStatus: 502, thong_bao: "Không tra được thông tin Free Fire lúc này. Nguồn dữ liệu không phản hồi." };
      }
      return { httpStatus: 404, thong_bao: `Không tìm thấy thông tin cho UID: ${requestedUid}` };
    };

    if (requestedUids) {
      const results = lookupResults.map(({ uid: requestedUid, player, error }) => player
        ? {
            trang_thai: "thanh_cong",
            Region: player.Region,
            Nickname: player.Nickname,
            Uid: player.Uid,
            Author: player.Author,
            nguon: player.source,
            cache_hit: player.cache_hit
          }
        : {
            trang_thai: "that_bai",
            Uid: requestedUid,
            thong_bao: describeMiss(requestedUid, error).thong_bao,
            tac_gia: "Hồ Đức Minh (Zhee Dev)"
          });
      const successful = results.filter((result) => result.trang_thai === "thanh_cong").length;
      const failureStatus = lookupResults
        .map(({ uid: requestedUid, error }) => describeMiss(requestedUid, error).httpStatus)
        .find((status) => status !== 404) || 404;

      return res.status(successful ? 200 : failureStatus).json({
        trang_thai: successful === results.length ? "thanh_cong" : (successful ? "mot_phan" : "that_bai"),
        loai: "freefire_player_lookup_batch",
        xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
        so_luong: results.length,
        thanh_cong: successful,
        that_bai: results.length - successful,
        thoi_gian_phan_hoi_ms: elapsedMs,
        ket_qua: results,
        Author: "Hồ Đức Minh",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }

    const playerData = lookupResults[0].player;
    if (!playerData) {
      const miss = describeMiss(uidList[0], lookupResults[0].error);
      return res.status(miss.httpStatus).json({ trang_thai: "that_bai", thong_bao: miss.thong_bao, tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "freefire_player_lookup",
      xac_thuc_key: key ? "Key VIP hợp lệ" : "Public Mode",
      Region: playerData.Region,
      Nickname: playerData.Nickname,
      Uid: playerData.Uid,
      Author: playerData.Author,
      nguon: playerData.source,
      cache_hit: playerData.cache_hit,
      thoi_gian_phan_hoi_ms: elapsedMs,
      du_lieu: {
        uid: playerData.Uid,
        nickname: playerData.Nickname,
        region: playerData.Region
      },
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
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
    try {
      await verifyEnhancedImage(directHdUrl);
    } catch (error) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(502).json({
        trang_thai: "that_bai",
        loai: "ai_image_enhance",
        thong_bao: "Không thể tải ảnh nguồn hoặc máy chủ làm nét ảnh không trả về ảnh hợp lệ.",
        chi_tiet: error.message,
        anh_goc: imgUrl,
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      });
    }
    if (isRaw) {
      return res.redirect(directHdUrl);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "ai_image_enhance",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
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
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
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