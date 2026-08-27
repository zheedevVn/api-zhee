const XAI_API_KEY = (process.env.XAI_API_KEY || "").trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
const OCRSPACE_API_KEY = (process.env.OCRSPACE_API_KEY || "K87899142388957").trim();
const MAX_BYTES = 1.5 * 1024 * 1024;

const LOGIN_KEYS = ["username", "user", "taikhoan", "tai_khoan", "password", "pass", "matkhau", "mat_khau", "login", "login_url"];

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function detectMime(b64) {
  const head = b64.slice(0, 16);
  if (head.startsWith("iVBOR")) return "image/png";
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

function parseImageInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return { kind: "url", value: text };

  const dataUri = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (dataUri) {
    const b64 = dataUri[2].replace(/\s+/g, "");
    return { kind: "base64", mime: dataUri[1], value: b64 };
  }

  const cleaned = text.replace(/^base64,/i, "").replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/]+=*$/.test(cleaned) && cleaned.length > 80) {
    return { kind: "base64", mime: detectMime(cleaned), value: cleaned };
  }
  return null;
}

function estimatedBytes(b64) {
  return Math.floor(b64.length * 0.75);
}

function cleanCaptchaText(raw) {
  const line = String(raw || "")
    .replace(/```/g, "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)[0] || "";
  const compact = line.replace(/\s+/g, "");
  const alnum = compact.replace(/[^A-Za-z0-9]/g, "");
  return { raw: line, text: alnum || compact };
}

async function fetchUrlAsBase64(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    const err = new Error(`Không tải được ảnh (${res.status}).`);
    err.statusCode = 400;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    const err = new Error("Ảnh quá lớn (tối đa ~1.5MB).");
    err.statusCode = 400;
    throw err;
  }
  const mime = (res.headers.get("content-type") || "image/png").split(";")[0].trim() || "image/png";
  return { mime: mime.startsWith("image/") ? mime : "image/png", value: buf.toString("base64") };
}

async function ocrXai(mime, b64) {
  if (!XAI_API_KEY) return null;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "grok-2-vision-1212",
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "This is a CAPTCHA image. Read the exact characters. Reply with ONLY the captcha text. Preserve case. No quotes." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }
        ]
      }]
    }),
    signal: AbortSignal.timeout(15000)
  });
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (res.ok && text) return { engine: "SpaceXAI Vision", text };
  return null;
}

async function ocrGemini(mime, b64) {
  if (!GEMINI_API_KEY) return null;
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: "This is a CAPTCHA image. Read the exact characters. Reply with ONLY the captcha text. Preserve case. No quotes." },
                { inline_data: { mime_type: mime, data: b64 } }
              ]
            }]
          }),
          signal: AbortSignal.timeout(12000)
        }
      );
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (res.ok && text) return { engine: `Google ${model}`, text };
    } catch (_) {}
  }
  return null;
}

async function ocrSpace(mime, b64) {
  const form = new URLSearchParams();
  form.set("apikey", OCRSPACE_API_KEY);
  form.set("base64Image", `data:${mime};base64,${b64}`);
  form.set("language", "eng");
  form.set("OCREngine", "2");
  form.set("scale", "true");
  form.set("isOverlayRequired", "false");
  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(15000)
  });
  const json = await res.json();
  const text = json?.ParsedResults?.[0]?.ParsedText;
  if (res.ok && !json.IsErroredOnProcessing && text) {
    return { engine: "OCR.space", text };
  }
  return null;
}

async function solveCaptcha(mime, b64) {
  const tries = [ocrXai, ocrGemini, ocrSpace];
  for (const fn of tries) {
    try {
      const hit = await fn(mime, b64);
      if (hit && String(hit.text).trim()) return hit;
    } catch (_) {}
  }
  const missing = [];
  if (!XAI_API_KEY) missing.push("XAI_API_KEY");
  if (!GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  const hint = missing.length
    ? ` Gắn ${missing.join(" hoặc ")} trên Vercel, hoặc OCRSPACE_API_KEY.`
    : " Cắt sát ô chữ (đừng gửi cả trang login).";
  const err = new Error("Không đọc được captcha." + hint);
  err.statusCode = 502;
  throw err;
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Giải Captcha Ảnh (/tools/captcha)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Đọc chữ trên ảnh captcha (base64 hoặc URL). Trả về chuỗi để bạn tự điền. Không đăng nhập hộ vào ngân hàng, không gửi tài khoản/mật khẩu đi.",
    khong_ho_tro: [
      "Không auto-login MB Bank / ngân hàng / website có captcha chống bot.",
      "Không nhận username + password để đăng nhập hộ.",
      "Chỉ OCR ảnh bạn gửi."
    ],
    cu_phap: [
      `${baseUrl}/api/tools/captcha  (POST JSON)`,
      `${baseUrl}/api/tools/captcha?url={link_anh}`
    ],
    vi_du_post: {
      image: "data:image/png;base64,iVBORw0KGgo..."
    },
    vi_du_post_thay_the: {
      base64: "iVBORw0KGgo..."
    },
    luu_y: "Nên POST JSON. Base64 rất dài, đừng dán lên URL. Cắt đúng ô captcha (không gửi cả trang login)."
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const requestUrl = new URL(req.url || "", baseUrl);
  const params = {};
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (!key && value) params[""] = value;
    else if (key && !value) params[""] = key.replace(/^=/, "");
    else params[key] = value;
  }
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};

  const wantsLogin = LOGIN_KEYS.some((key) => pick(params, body, key));
  const imageRaw = pick(params, body, "image", "img", "base64", "captcha", "data", "anh", "url") || String(params[""] || "").trim();
  if (!imageRaw) {
    const guide = buildGuide(baseUrl);
    if (wantsLogin) {
      return res.status(400).json({
        ...guide,
        trang_thai: "that_bai",
        thong_bao: "Không hỗ trợ đăng nhập hộ. Chỉ gửi ảnh captcha (base64) để API đọc chữ."
      });
    }
    return res.status(200).json(guide);
  }

  try {
    let parsed = parseImageInput(imageRaw);
    if (!parsed) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Cần ảnh captcha: POST { image: 'data:image/png;base64,...' } hoặc { base64: '...' } hoặc ?url={link_anh}."
      });
    }
    if (parsed.kind === "url") parsed = { kind: "base64", ...(await fetchUrlAsBase64(parsed.value)) };
    if (estimatedBytes(parsed.value) > MAX_BYTES) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Ảnh quá lớn (tối đa ~1.5MB). Cắt sát ô captcha rồi encode base64."
      });
    }

    const solved = await solveCaptcha(parsed.mime, parsed.value);
    const cleaned = cleanCaptchaText(solved.text);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Giải Captcha Ảnh",
      ket_qua: cleaned.text,
      ban_tho: cleaned.raw,
      may_doc: solved.engine,
      ghi_chu: wantsLogin
        ? "Đã đọc captcha. API không đăng nhập hộ — tự điền tài khoản/mật khẩu/captcha trên trang chính thức."
        : "Tự điền chuỗi ket_qua vào ô captcha. Không gửi mật khẩu cho API.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  } catch (error) {
    return res.status((error.statusCode || 500)).json({
      trang_thai: "that_bai",
      ma_loi: error.statusCode || 500,
      thong_bao: error.message || "Lỗi giải captcha."
    });
  }
};
