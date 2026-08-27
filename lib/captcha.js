const crypto = require("crypto");

const SECRET = process.env.ADMIN_SECRET || "minhhocgioi";
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const TTL_MS = 5 * 60 * 1000;

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randomText(len) {
  let out = "";
  for (let i = 0; i < len; i += 1) out += CHARSET[crypto.randomInt(0, CHARSET.length)];
  return out;
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url").slice(0, 22);
  return `${body}.${sig}`;
}

function readToken(token) {
  const raw = String(token || "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot < 8) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expect = crypto.createHmac("sha256", SECRET).update(body).digest("base64url").slice(0, 22);
  if (sig !== expect) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch (_) {
    return null;
  }
}

function generateSvg(text, seed) {
  const rand = mulberry32(seed);
  const width = 260;
  const height = 88;
  const chars = String(text).split("");
  const pad = 22;
  const step = (width - pad * 2) / Math.max(chars.length, 1);

  const grid = [];
  for (let x = 8; x < width; x += 10) {
    grid.push(`<line x1="${x}" y1="6" x2="${x}" y2="${height - 6}" stroke="#d4d4d8" stroke-width="0.7"/>`);
  }
  for (let y = 8; y < height; y += 9) {
    grid.push(`<line x1="8" y1="${y}" x2="${width - 8}" y2="${y}" stroke="#d4d4d8" stroke-width="0.7"/>`);
  }

  const letters = chars.map((ch, i) => {
    const cx = pad + step * i + step * 0.35;
    const cy = 52 + (rand() - 0.5) * 18;
    const rot = (rand() - 0.5) * 42;
    const size = 30 + Math.floor(rand() * 12);
    const skew = ((rand() - 0.5) * 18).toFixed(1);
    const dark = rand() > 0.35 ? "#111827" : "#1e3a8a";
    const weight = rand() > 0.5 ? 800 : 700;
    return `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" fill="${dark}" font-size="${size}" font-weight="${weight}" font-family="Consolas, 'Courier New', monospace" transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}) skewX(${skew})" letter-spacing="-1">${escapeXml(ch)}</text>`;
  }).join("");

  const arcs = Array.from({ length: 4 }, () => {
    const x1 = 12 + rand() * (width - 24);
    const y1 = 12 + rand() * (height - 24);
    const x2 = 12 + rand() * (width - 24);
    const y2 = 12 + rand() * (height - 24);
    const c1 = 20 + rand() * (width - 40);
    const c2 = 10 + rand() * (height - 20);
    const color = rand() > 0.5 ? "#64748b" : "#334155";
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q ${c1.toFixed(1)} ${c2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${(1 + rand() * 1.6).toFixed(1)}" opacity="0.55"/>`;
  }).join("");

  const dots = Array.from({ length: 55 }, () => {
    const x = 8 + rand() * (width - 16);
    const y = 8 + rand() * (height - 16);
    const r = 0.4 + rand() * 1.4;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#0f172a" opacity="${(0.15 + rand() * 0.45).toFixed(2)}"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="captcha">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/>
      <feColorMatrix type="saturate" values="0"/>
      <feBlend in="SourceGraphic" in2="n" mode="multiply"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" rx="10" fill="url(#bg)" stroke="#94a3b8" stroke-width="2"/>
  <g opacity="0.85">${grid.join("")}</g>
  <g filter="url(#grain)" opacity="0.12"><rect width="${width}" height="${height}" fill="#fff"/></g>
  ${arcs}
  ${dots}
  ${letters}
</svg>`;
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sendSvg(res, svg) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (typeof res.send === "function") return res.status(200).send(svg);
  res.statusCode = 200;
  return res.end(svg);
}

function makeCaptcha(len) {
  const text = randomText(len);
  const seed = crypto.randomInt(1, 2 ** 31);
  const exp = Date.now() + TTL_MS;
  const token = signToken({ t: text, s: seed, e: exp });
  return { text, seed, exp, token };
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Tạo Captcha Ảnh (/tools/captcha)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Sinh captcha méo chữ, lưới, nhiễu. Có token HMAC để đối chiếu, hết hạn 5 phút. Không giải captcha website khác.",
    cu_phap: [
      `${baseUrl}/api/tools/captcha`,
      `${baseUrl}/api/tools/captcha?do_dai=6`,
      `${baseUrl}/api/tools/captcha?action=verify&token={token}&traloi={chuoi}`,
      `${baseUrl}/api/tools/captcha?image={token}`
    ],
    vi_du: [
      `${baseUrl}/api/tools/captcha`,
      `${baseUrl}/api/tools/captcha?do_dai=5&an_dap_an=1`
    ]
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

  const requestUrl = new URL(req.url || "", baseUrl);
  const params = {};
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (!key && value) params[""] = value;
    else if (key && !value) params[""] = key.replace(/^=/, "");
    else params[key] = value;
  }
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const action = (pick(params, body, "action", "type") || "").toLowerCase();
  const firstParam = String(params[""] || "").trim();

  const imageToken = pick(params, body, "image", "img");
  if (imageToken && imageToken !== "1" && imageToken !== "true") {
    const payload = readToken(imageToken);
    if (!payload || payload.e < Date.now()) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Token ảnh hết hạn hoặc không hợp lệ. Gọi lại /api/tools/captcha để tạo mới." });
    }
    return sendSvg(res, generateSvg(payload.t, payload.s));
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (action === "huongdan" || action === "guide" || firstParam === "huongdan") {
    return res.status(200).json(buildGuide(baseUrl));
  }

  if (action === "verify" || action === "check" || action === "doi") {
    const token = pick(params, body, "token", "ma");
    const answer = pick(params, body, "traloi", "answer", "code", "captcha", "text");
    const payload = readToken(token);
    if (!payload) {
      return res.status(400).json({ trang_thai: "that_bai", dung: false, thong_bao: "Token không hợp lệ." });
    }
    if (payload.e < Date.now()) {
      return res.status(400).json({ trang_thai: "that_bai", dung: false, thong_bao: "Captcha đã hết hạn (5 phút). Tạo lại." });
    }
    const ok = String(answer).replace(/\s+/g, "") === String(payload.t);
    return res.status(ok ? 200 : 400).json({
      trang_thai: ok ? "thanh_cong" : "that_bai",
      dung: ok,
      thong_bao: ok ? "Captcha đúng." : "Captcha sai.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  let len = Number.parseInt(pick(params, body, "do_dai", "len", "length") || "6", 10);
  if (!Number.isInteger(len)) len = 6;
  len = Math.min(8, Math.max(4, len));

  const forced = pick(params, body, "text", "chuoi");
  let pack;
  if (forced) {
    const clean = forced.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
    if (clean.length < 4) {
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "text tùy chọn phải 4–8 ký tự chữ/số." });
    }
    const seed = crypto.randomInt(1, 2 ** 31);
    const exp = Date.now() + TTL_MS;
    pack = { text: clean, seed, exp, token: signToken({ t: clean, s: seed, e: exp }) };
  } else {
    pack = makeCaptcha(len);
  }

  const hide = ["1", "true", "yes"].includes(pick(params, body, "an_dap_an", "hide").toLowerCase());
  const payload = {
    trang_thai: "thanh_cong",
    chuyen_muc: "Tạo Captcha Ảnh",
    so_ky_tu: pack.text.length,
    token: pack.token,
    het_han_luc: new Date(pack.exp).toLocaleString("vi-VN"),
    het_han_sau_giay: Math.round(TTL_MS / 1000),
    anh: `${baseUrl}/api/tools/captcha?image=${encodeURIComponent(pack.token)}`,
    huong_dan_doi_chieu: `${baseUrl}/api/tools/captcha?action=verify&token={token}&traloi={chuoi}`,
    ghi_chu: "Mở trường anh để xem ảnh captcha. JSON không nhúng file SVG.",
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
  if (!hide) payload.dap_an = pack.text;
  return res.status(200).json(payload);
};
