const crypto = require("crypto");

const SECRET = process.env.ADMIN_SECRET || "minhhocgioi";
const TTL_MS = 5 * 60 * 1000;
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const MIXED = LETTERS + DIGITS;
const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const KIND_MAP = {
  kytu: "kytu", chu: "kytu", text: "kytu", character: "kytu", ky_tu: "kytu",
  so: "so", number: "so", digits: "so", num: "so",
  code: "code", ma: "code", otp: "code",
  toan: "toan", math: "toan", tinh: "toan",
  hinh: "hinh", anh: "hinh", image: "hinh", picture: "hinh", chonhinh: "hinh"
};

const SHAPES = [
  { ma: "tron", ten: "Hình tròn" },
  { ma: "vuong", ten: "Hình vuông" },
  { ma: "tamgiac", ten: "Hình tam giác" },
  { ma: "sao", ten: "Ngôi sao" },
  { ma: "tim", ten: "Trái tim" },
  { ma: "thoi", ten: "Hình thoi" }
];

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function fold(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "");
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

function randFrom(charset, len) {
  let out = "";
  for (let i = 0; i < len; i += 1) out += charset[crypto.randomInt(0, charset.length)];
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

const GLYPHS = {
  "0": "M6 2 Q2 2 2 8 Q2 14 6 14 Q10 14 10 8 Q10 2 6 2",
  "1": "M5 2 L7 2 V14 H5 V2 M4 14 H9",
  "2": "M3 4 Q3 2 6 2 Q9 2 9 5 Q9 8 3 12 V14 H9",
  "3": "M3 3 Q3 2 6 2 Q9 2 9 5 Q9 7 6 8 Q9 8 9 12 Q9 14 6 14 Q3 14 3 12",
  "4": "M8 2 V14 M8 2 L3 10 H10",
  "5": "M9 2 H3 V8 H7 Q10 8 10 12 Q10 14 6 14 Q3 14 3 12",
  "6": "M8 2 L3 8 V12 Q3 14 6 14 Q9 14 9 11 Q9 8 6 8 H3",
  "7": "M3 2 H9 L5 14",
  "8": "M6 2 Q3 2 3 5 Q3 8 6 8 Q9 8 9 5 Q9 2 6 2 M6 8 Q3 8 3 12 Q3 14 6 14 Q9 14 9 12 Q9 8 6 8",
  "9": "M4 14 L9 8 V4 Q9 2 6 2 Q3 2 3 5 Q3 8 6 8 H9",
  A: "M2 16 L6 2 L10 16 M4 10 H8",
  B: "M3 2 V16 M3 2 H7 Q10 2 10 6 Q10 8 7 8 H3 M7 8 Q11 8 11 12 Q11 16 7 16 H3",
  C: "M10 4 Q10 2 6 2 Q2 2 2 8 Q2 16 6 16 Q10 16 10 14",
  D: "M3 2 V16 H7 Q11 16 11 9 Q11 2 7 2 H3",
  E: "M10 2 H3 V16 H10 M3 9 H8",
  F: "M10 2 H3 V16 M3 9 H8",
  G: "M10 4 Q9 2 6 2 Q2 2 2 9 Q2 16 6 16 Q10 16 10 10 H7",
  H: "M3 2 V16 M9 2 V16 M3 9 H9",
  J: "M8 2 V12 Q8 16 4 16 Q2 16 2 13",
  K: "M3 2 V16 M9 2 L3 9 L9 16",
  L: "M3 2 V16 H10",
  M: "M2 16 V2 L6 10 L10 2 V16",
  N: "M3 16 V2 L9 16 V2",
  P: "M3 16 V2 H7 Q10 2 10 6 Q10 10 7 10 H3",
  Q: "M2 8 Q2 2 6 2 Q10 2 10 8 Q10 14 6 14 Q2 14 2 8 M7 11 L10 16",
  R: "M3 16 V2 H7 Q10 2 10 6 Q10 10 7 10 H3 M6 10 L10 16",
  S: "M10 4 Q10 2 6 2 Q2 2 2 6 Q2 8 6 9 Q10 10 10 13 Q10 16 6 16 Q2 16 2 14",
  T: "M2 2 H10 M6 2 V16",
  U: "M3 2 V12 Q3 16 6 16 Q9 16 9 12 V2",
  V: "M2 2 L6 16 L10 2",
  W: "M1 2 L3 16 L6 7 L9 16 L11 2",
  X: "M3 2 L9 16 M9 2 L3 16",
  Y: "M3 2 L6 9 L9 2 M6 9 V16",
  Z: "M3 2 H9 L3 16 H9",
  a: "M9 7 Q9 5 6 5 Q3 5 3 8 Q3 11 6 11 Q9 11 9 8 V16",
  b: "M3 2 V16 Q3 11 6 11 Q9 11 9 14 Q9 16 6 16 Q3 16 3 13",
  c: "M9 7 Q9 5 6 5 Q3 5 3 10 Q3 16 6 16 Q9 16 9 14",
  d: "M9 2 V16 Q9 11 6 11 Q3 11 3 14 Q3 16 6 16 Q9 16 9 13",
  e: "M3 10 H9 Q9 5 6 5 Q3 5 3 10 Q3 16 6 16 Q9 16 9 14",
  f: "M8 2 H5 Q3 2 3 5 V16 M2 8 H6",
  g: "M9 7 Q9 5 6 5 Q3 5 3 8 Q3 11 6 11 Q9 11 9 7 V14 Q8 18 5 18 Q3 18 3 16",
  h: "M3 2 V16 M3 9 Q6 8 8 9 V16",
  j: "M7 5 V14 Q7 18 4 18 Q2 18 2 16 M7 2 V3",
  k: "M3 2 V16 M8 8 L3 11 M4 11 L8 16",
  m: "M3 16 V8 H5 L7 12 L9 8 H11 V16",
  n: "M3 16 V8 H5 Q8 8 8 11 V16",
  p: "M3 8 V20 M3 8 Q3 5 6 5 Q9 5 9 8 Q9 11 6 11 H3",
  q: "M9 8 V20 M9 8 Q9 5 6 5 Q3 5 3 8 Q3 11 6 11 H9",
  r: "M3 16 V8 H5 Q8 8 8 10",
  s: "M8 6 Q8 5 6 5 Q4 5 4 7 Q4 8 6 9 Q8 10 8 12 Q8 14 6 14 Q4 14 4 13",
  t: "M6 3 V14 Q6 16 8 16 M4 7 H8",
  u: "M3 8 V13 Q3 16 6 16 Q9 16 9 13 V8 M9 8 V16",
  v: "M3 8 L6 16 L9 8",
  w: "M2 8 L4 16 L6 10 L8 16 L10 8",
  x: "M4 8 L8 16 M8 8 L4 16",
  y: "M3 8 L6 14 L9 8 M6 14 L5 19",
  z: "M4 8 H8 L4 16 H8",
  "+": "M6 4 V12 M2 8 H10",
  "-": "M2 8 H10",
  "×": "M3 5 L9 11 M9 5 L3 11",
  "=": "M2 6 H10 M2 10 H10",
  "?": "M3 4 Q3 2 6 2 Q9 2 9 5 Q9 8 6 9 V11 M6 14 V16",
  " ": ""
};

function drawGlyph(ch, x, y, scale, rot, skew, color) {
  const d = GLYPHS[ch];
  if (!d) return "";
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) skewX(${Number(skew).toFixed(1)}) scale(${scale.toFixed(2)})" fill="none" stroke="${color}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;
}

function frame(width, height, inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <style>svg{user-select:none;-webkit-user-select:none}</style>
  </defs>
  <rect width="${width}" height="${height}" rx="12" fill="url(#bg)" stroke="#94a3b8" stroke-width="2"/>
  ${inner}
</svg>`;
}

function noiseLayer(rand, width, height, heavy) {
  const grid = [];
  for (let x = 8; x < width; x += 10) grid.push(`<line x1="${x}" y1="6" x2="${x}" y2="${height - 6}" stroke="#d4d4d8" stroke-width="0.7"/>`);
  for (let y = 8; y < height; y += 9) grid.push(`<line x1="8" y1="${y}" x2="${width - 8}" y2="${y}" stroke="#d4d4d8" stroke-width="0.7"/>`);
  const arcs = Array.from({ length: heavy ? 4 : 2 }, () => {
    const x1 = 12 + rand() * (width - 24);
    const y1 = 12 + rand() * (height - 24);
    const x2 = 12 + rand() * (width - 24);
    const y2 = 12 + rand() * (height - 24);
    const c1 = 20 + rand() * (width - 40);
    const c2 = 10 + rand() * (height - 20);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q ${c1.toFixed(1)} ${c2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="#64748b" stroke-width="${(1 + rand()).toFixed(1)}" opacity="0.5"/>`;
  }).join("");
  const dots = Array.from({ length: heavy ? 50 : 24 }, () => {
    const x = 8 + rand() * (width - 16);
    const y = 8 + rand() * (height - 16);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.4 + rand() * 1.3).toFixed(1)}" fill="#0f172a" opacity="${(0.12 + rand() * 0.4).toFixed(2)}"/>`;
  }).join("");
  return `<g opacity="0.9">${grid.join("")}</g>${arcs}${dots}`;
}

function distortedText(text, seed, opts = {}) {
  const rand = mulberry32(seed);
  const width = opts.width || 280;
  const height = opts.height || 92;
  const rotate = opts.rotate ?? 42;
  const chars = String(text).split("");
  const pad = 18;
  const step = (width - pad * 2) / Math.max(chars.length, 1);
  const letters = chars.map((ch, i) => {
    const scale = (opts.scale || 2.15) + rand() * 0.55;
    const cx = pad + step * i + 2;
    const cy = 14 + (rand() - 0.5) * (opts.jitter ?? 12);
    const rot = (rand() - 0.5) * rotate;
    const skew = (rand() - 0.5) * (opts.skew ?? 14);
    const dark = rand() > 0.3 ? "#111827" : "#1e3a8a";
    return drawGlyph(ch, cx, cy, scale, rot, skew, dark);
  }).join("");
  return frame(width, height, `${noiseLayer(rand, width, height, opts.heavy !== false)}${letters}`);
}

function mathSvg(expr, seed) {
  return distortedText(String(expr).replace(/ /g, ""), seed, {
    heavy: false,
    rotate: 10,
    scale: 2.05,
    jitter: 6,
    width: 300,
    height: 96
  });
}

function shapePath(ma, x, y, s) {
  if (ma === "tron") return `<circle cx="${x}" cy="${y}" r="${s * 0.38}" fill="#2563eb"/>`;
  if (ma === "vuong") return `<rect x="${x - s * 0.34}" y="${y - s * 0.34}" width="${s * 0.68}" height="${s * 0.68}" rx="4" fill="#16a34a"/>`;
  if (ma === "tamgiac") return `<polygon points="${x},${y - s * 0.4} ${x + s * 0.4},${y + s * 0.34} ${x - s * 0.4},${y + s * 0.34}" fill="#d97706"/>`;
  if (ma === "sao") {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? s * 0.4 : s * 0.16;
      pts.push(`${(x + Math.cos(ang) * r).toFixed(1)},${(y + Math.sin(ang) * r).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="#eab308"/>`;
  }
  if (ma === "tim") {
    return `<path d="M${x} ${y + s * 0.32} C${x - s * 0.42} ${y - 2}, ${x - s * 0.18} ${y - s * 0.38}, ${x} ${y - s * 0.12} C${x + s * 0.18} ${y - s * 0.38}, ${x + s * 0.42} ${y - 2}, ${x} ${y + s * 0.32}Z" fill="#e11d48"/>`;
  }
  return `<polygon points="${x},${y - s * 0.38} ${x + s * 0.34},${y} ${x},${y + s * 0.38} ${x - s * 0.34},${y}" fill="#7c3aed"/>`;
}

function imageSvg(question, options, seed, answerLetter) {
  const rand = mulberry32(seed);
  const width = 420;
  const height = 300;
  const cols = 3;
  const cellW = 124;
  const cellH = 96;
  const originX = 24;
  const originY = 86;
  const win = options[answerLetter.charCodeAt(0) - 65];
  const cells = options.map((shape, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = originX + col * (cellW + 10);
    const y = originY + row * (cellH + 10);
    const label = String.fromCharCode(65 + i);
    const jitter = (rand() - 0.5) * 4;
    return `
      <g>
        <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="12" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
        ${shapePath(shape.ma, x + cellW / 2 + jitter, y + 46, 56)}
        ${drawGlyph(label, x + 8, y + 6, 1.05, 0, 0, "#64748b")}
      </g>`;
  }).join("");
  const inner = `
    <circle cx="48" cy="42" r="28" fill="#fff" stroke="#94a3b8" stroke-width="2"/>
    ${win ? shapePath(win.ma, 48, 42, 36) : ""}
    ${cells}`;
  return frame(width, height, inner);
}

function renderCaptcha(payload) {
  const kind = payload.k || "kytu";
  if (kind === "toan") return mathSvg(payload.q, payload.s);
  if (kind === "hinh") {
    const options = (payload.o || []).map((ma) => SHAPES.find((item) => item.ma === ma)).filter(Boolean);
    return imageSvg(payload.q, options, payload.s, payload.t);
  }
  const heavy = kind === "kytu";
  const rotate = kind === "code" ? 10 : kind === "so" ? 18 : 42;
  return distortedText(payload.q || payload.t, payload.s, { heavy, rotate, size: kind === "code" ? 26 : 30 });
}

function makeMath() {
  const op = ["+", "-", "×"][crypto.randomInt(0, 3)];
  let a = crypto.randomInt(2, 13);
  let b = crypto.randomInt(1, 10);
  if (op === "-" && a < b) [a, b] = [b, a];
  const value = op === "+" ? a + b : op === "-" ? a - b : a * b;
  return { q: `${a} ${op} ${b} = ?`, t: String(value) };
}

function makeImageChallenge() {
  const shuffled = SHAPES.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const options = shuffled.slice(0, 6);
  const win = crypto.randomInt(0, options.length);
  const letter = String.fromCharCode(65 + win);
  return {
    q: `Chọn ${options[win].ten}`,
    t: letter,
    o: options.map((item) => item.ma),
    lua_chon: options.map((item, i) => ({
      ma: String.fromCharCode(65 + i),
      hinh: item.ma,
      ten: item.ten
    }))
  };
}

function makePack(kind, len) {
  const seed = crypto.randomInt(1, 2 ** 31);
  const exp = Date.now() + TTL_MS;
  let data = { k: kind, s: seed, e: exp };
  if (kind === "so") {
    const t = randFrom(DIGITS + "01", len);
    data = { ...data, t, q: t };
  } else if (kind === "code") {
    const raw = randFrom(CODE, Math.max(6, len));
    const t = `${raw.slice(0, 3)}-${raw.slice(3, 6)}`;
    data = { ...data, t, q: t };
  } else if (kind === "toan") {
    const math = makeMath();
    data = { ...data, t: math.t, q: math.q };
  } else if (kind === "hinh") {
    const img = makeImageChallenge();
    data = { ...data, t: img.t, q: img.q, o: img.o };
    return { ...data, token: signToken(data), lua_chon: img.lua_chon };
  } else {
    const t = randFrom(MIXED, len);
    data = { ...data, t, q: t };
  }
  return { ...data, token: signToken(data) };
}

function answersMatch(payload, answer) {
  const raw = String(answer || "").trim();
  const kind = payload.k || "kytu";
  if (kind === "toan" || kind === "so") {
    return raw.replace(/\s+/g, "") === String(payload.t);
  }
  if (kind === "code") {
    return raw.replace(/[\s-]/g, "").toUpperCase() === String(payload.t).replace(/-/g, "").toUpperCase();
  }
  if (kind === "hinh") {
    const folded = fold(raw);
    const idx = folded.charCodeAt(0) - 97;
    if (folded.length === 1 && idx >= 0 && idx < 6) {
      return String.fromCharCode(65 + idx) === payload.t;
    }
    const letterIdx = payload.t.charCodeAt(0) - 65;
    const shape = SHAPES.find((item) => item.ma === (payload.o || [])[letterIdx]);
    return folded === fold(payload.t)
      || (shape && (folded === fold(shape.ma) || fold(shape.ten).includes(folded) || folded.includes(fold(shape.ma))));
  }
  return raw === String(payload.t);
}

function sendSvg(res, svg) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (typeof res.send === "function") return res.status(200).send(svg);
  res.statusCode = 200;
  return res.end(svg);
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Tạo Captcha (/tools/captcha)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Nhiều kiểu captcha: ký tự, số, mã, toán, chọn hình. Ảnh xem qua trường anh. Token HMAC 5 phút.",
    kieu: {
      kytu: "Chữ + số méo, lưới, nhiễu (mặc định)",
      so: "Dãy số",
      code: "Mã xác thực dạng ABC-123",
      toan: "Phép tính 7 + 4 = ?",
      hinh: "Chọn đúng hình trong lưới 6 ô"
    },
    cu_phap: [
      `${baseUrl}/api/tools/captcha?kieu=kytu`,
      `${baseUrl}/api/tools/captcha?kieu=so`,
      `${baseUrl}/api/tools/captcha?kieu=code`,
      `${baseUrl}/api/tools/captcha?kieu=toan`,
      `${baseUrl}/api/tools/captcha?kieu=hinh`,
      `${baseUrl}/api/tools/captcha?action=verify&token={token}&traloi={dap_an}`
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
  const action = (pick(params, body, "action") || "").toLowerCase();
  const firstParam = String(params[""] || "").trim();

  const imageToken = pick(params, body, "image", "img");
  if (imageToken && imageToken !== "1" && imageToken !== "true") {
    const payload = readToken(imageToken);
    if (!payload || payload.e < Date.now()) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Token ảnh hết hạn hoặc không hợp lệ." });
    }
    return sendSvg(res, renderCaptcha(payload));
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (action === "huongdan" || action === "guide" || action === "list" || firstParam === "huongdan") {
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
      return res.status(400).json({ trang_thai: "that_bai", dung: false, thong_bao: "Captcha đã hết hạn (5 phút)." });
    }
    const ok = answersMatch(payload, answer);
    return res.status(ok ? 200 : 400).json({
      trang_thai: ok ? "thanh_cong" : "that_bai",
      dung: ok,
      kieu: payload.k || "kytu",
      thong_bao: ok ? "Captcha đúng." : "Captcha sai.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }

  const kind = KIND_MAP[fold(pick(params, body, "kieu", "kind", "style") || firstParam || "kytu")] || "";
  if (!kind) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Kiểu không hợp lệ. Dùng kieu=kytu | so | code | toan | hinh",
      huong_dan: `${baseUrl}/api/tools/captcha?action=list`
    });
  }

  let len = Number.parseInt(pick(params, body, "do_dai", "len", "length") || (kind === "so" ? "5" : "6"), 10);
  if (!Number.isInteger(len)) len = 6;
  len = Math.min(8, Math.max(4, len));

  const pack = makePack(kind, len);
  const hide = ["1", "true", "yes"].includes(pick(params, body, "an_dap_an", "hide").toLowerCase());
  const out = {
    trang_thai: "thanh_cong",
    chuyen_muc: "Tạo Captcha",
    kieu: kind,
    cau_hoi: pack.q,
    token: pack.token,
    het_han_luc: new Date(pack.e).toLocaleString("vi-VN"),
    het_han_sau_giay: Math.round(TTL_MS / 1000),
    anh: `${baseUrl}/api/tools/captcha?image=${encodeURIComponent(pack.token)}`,
    huong_dan_doi_chieu: `${baseUrl}/api/tools/captcha?action=verify&token={token}&traloi={dap_an}`,
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
  if (pack.lua_chon) out.lua_chon = pack.lua_chon;
  if (!hide) out.dap_an = pack.t;
  return res.status(200).json(out);
};
