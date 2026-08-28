const tls = require("tls");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const TIMEOUT_MS = 8500;
const PAGE_MAX = 50;
const COOLDOWN_MS = 2000;
const cooldownByIp = new Map();

const HOST_BY_DOMAIN = {
  "gmail.com": "imap.gmail.com",
  "googlemail.com": "imap.gmail.com",
  "outlook.com": "outlook.office365.com",
  "hotmail.com": "outlook.office365.com",
  "live.com": "outlook.office365.com",
  "msn.com": "outlook.office365.com",
  "yahoo.com": "imap.mail.yahoo.com",
  "yahoo.com.vn": "imap.mail.yahoo.com",
  "icloud.com": "imap.mail.me.com",
  "me.com": "imap.mail.me.com",
  "mac.com": "imap.mail.me.com",
  "zoho.com": "imap.zoho.com"
};

const MUC_ORDER = [
  "hopthu", "danhdau", "tre", "dagui", "nhap", "muasam",
  "mangxahoi", "quangcao", "capnhat", "diendan",
  "quantrong", "tatca", "spam", "rac"
];

const MUC_TEN = {
  hopthu: "Hộp thư đến",
  danhdau: "Có gắn dấu sao",
  tre: "Đã tạm ẩn",
  dagui: "Đã gửi",
  nhap: "Thư nháp",
  muasam: "Giao dịch mua",
  mangxahoi: "Mạng xã hội",
  quangcao: "Quảng cáo",
  capnhat: "Cập nhật",
  diendan: "Diễn đàn",
  quantrong: "Quan trọng",
  tatca: "Tất cả thư",
  spam: "Spam",
  rac: "Thùng rác",
  khac: "Nhãn khác"
};

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function compact(value) {
  if (Array.isArray(value)) {
    const list = value.map(compact).filter((item) => item !== undefined && item !== null && item !== "");
    return list.length ? list : undefined;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "" || item === false) continue;
      const next = compact(item);
      if (next === undefined || next === null || next === "") continue;
      if (typeof next === "object" && !Array.isArray(next) && !Object.keys(next).length) continue;
      out[key] = next;
    }
    return out;
  }
  return value;
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function hitCooldown(ip) {
  const now = Date.now();
  const last = cooldownByIp.get(ip);
  if (last && now - last < COOLDOWN_MS) return Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
  cooldownByIp.set(ip, now);
  if (cooldownByIp.size > 400) {
    for (const [key, ts] of cooldownByIp) {
      if (now - ts > 60000) cooldownByIp.delete(key);
    }
  }
  return 0;
}

function quoteImap(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function detectHost(email, override) {
  if (override) return override.replace(/^imap:\/\//i, "").split(":")[0];
  const domain = String(email.split("@")[1] || "").toLowerCase();
  return HOST_BY_DOMAIN[domain] || `imap.${domain}`;
}

function decodeQ(text) {
  const raw = String(text || "").replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return Buffer.from(raw, "latin1");
}

function decodeMimeWord(input) {
  return String(input || "").replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    try {
      const buf = enc.toUpperCase() === "B" ? Buffer.from(text.replace(/\s/g, ""), "base64") : decodeQ(text);
      const cs = String(charset || "utf-8").toLowerCase();
      if (cs === "utf-8" || cs === "utf8" || cs === "us-ascii") return buf.toString("utf8");
      return buf.toString("utf8");
    } catch (_) {
      return text;
    }
  }).replace(/\s+/g, " ").trim();
}

function unfoldHeaders(block) {
  return String(block || "").replace(/\r\n[ \t]+/g, " ");
}

function headerField(block, name) {
  const text = unfoldHeaders(block);
  const re = new RegExp(`^${name}:\\s*(.*)$`, "im");
  const m = text.match(re);
  return m ? decodeMimeWord(m[1]) : "";
}

function parseFrom(raw) {
  const s = decodeMimeWord(raw);
  const m = s.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>/);
  if (m) return { ten: (m[1] || "").trim() || m[2].split("@")[0], email_gui: m[2].trim() };
  const angle = s.match(/<([^>]+)>/);
  if (angle) return { ten: s.replace(/<[^>]+>/, "").trim() || angle[1].split("@")[0], email_gui: angle[1].trim() };
  if (s.includes("@")) return { ten: s.split("@")[0], email_gui: s };
  return { ten: s || "Không rõ" };
}

function parseInternalDate(raw) {
  const m = String(raw || "").match(/(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month !== undefined) {
      const tz = m[7];
      const sign = tz[0] === "-" ? -1 : 1;
      const offMin = sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5)));
      const utc = Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])) - offMin * 60000;
      return new Date(utc);
    }
  }
  const d = new Date(raw);
  return Number.isNaN(+d) ? null : d;
}

function formatNgay(date) {
  if (!date) return undefined;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = date.getDate();
  const month = date.getMonth() + 1;
  if (date.getFullYear() === now.getFullYear()) return `${day} thg ${month}`;
  return `${day} thg ${month}, ${date.getFullYear()}`;
}

function classifyMailbox(name, attrs) {
  const n = String(name || "");
  const low = n.toLowerCase();
  const a = attrs.map((x) => x.toLowerCase());
  if (n.toUpperCase() === "INBOX") return "hopthu";
  if (a.includes("\\flagged") || /starred|dấu sao|danh dau/.test(low)) return "danhdau";
  if (a.includes("\\sent") || /(^|\/)sent( mail)?$/.test(low) || /đã gửi|da gui/.test(low)) return "dagui";
  if (a.includes("\\drafts") || /draft/.test(low) || /thư nháp|nhap/.test(low)) return "nhap";
  if (a.includes("\\junk") || /spam|junk/.test(low)) return "spam";
  if (a.includes("\\trash") || /trash|bin|thùng rác|rac/.test(low)) return "rac";
  if (a.includes("\\all") || /all mail|tất cả/.test(low)) return "tatca";
  if (/snooze|tạm ẩn|tam an/.test(low)) return "tre";
  if (/purchase|mua sắm|giao dịch mua|muasam/.test(low)) return "muasam";
  if (/social|mạng xã hội|mang xa hoi/.test(low)) return "mangxahoi";
  if (/promo|quảng cáo|quang cao/.test(low)) return "quangcao";
  if (/update|cập nhật|cap nhat/.test(low)) return "capnhat";
  if (/forum|diễn đàn/.test(low)) return "diendan";
  if (/important|quan trọng|quan trong/.test(low)) return "quantrong";
  if (a.includes("\\noselect")) return "";
  return "khac";
}

function parseListLine(line) {
  if (!/^\* LIST /i.test(line)) return null;
  const attrMatch = line.match(/^\* LIST \(([^)]*)\)\s+/i);
  if (!attrMatch) return null;
  const attrs = attrMatch[1].split(/\s+/).filter(Boolean);
  let rest = line.slice(attrMatch[0].length).trim();
  let delim = "/";
  if (/^NIL/i.test(rest)) {
    delim = "";
    rest = rest.slice(3).trim();
  } else if (rest.startsWith('"')) {
    const q = rest.match(/^"((?:\\.|[^"\\])*)"/);
    if (!q) return null;
    delim = q[1];
    rest = rest.slice(q[0].length).trim();
  }
  let name = rest;
  if (name.startsWith('"')) {
    const q = name.match(/^"((?:\\.|[^"\\])*)"/);
    name = q ? q[1].replace(/\\"/g, '"') : name;
  }
  name = name.replace(/^"+|"+$/g, "");
  return { attrs, delim, name };
}

function parseStatus(lines, mailbox) {
  const out = { tong: 0, chua_doc: 0 };
  const needle = mailbox.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\* STATUS (?:${needle}|"${needle}") \\((.+)\\)`, "i");
  for (const line of lines) {
    const m = line.match(re) || line.match(/^\* STATUS .+ \((.+)\)/i);
    if (!m) continue;
    const msg = m[1].match(/MESSAGES\s+(\d+)/i);
    const unseen = m[1].match(/UNSEEN\s+(\d+)/i);
    if (msg) out.tong = Number(msg[1]);
    if (unseen) out.chua_doc = Number(unseen[1]);
  }
  return out;
}

function parseFetchBlock(seq, body) {
  const uid = (body.match(/\bUID\s+(\d+)/i) || [])[1];
  const flagsRaw = (body.match(/FLAGS\s+\(([^)]*)\)/i) || [])[1] || "";
  const flags = flagsRaw.split(/\s+/).map((f) => f.toLowerCase()).filter(Boolean);
  const size = Number((body.match(/RFC822\.SIZE\s+(\d+)/i) || [])[1] || 0);
  const internal = (body.match(/INTERNALDATE\s+"([^"]+)"/i) || [])[1];
  const from = parseFrom(headerField(body, "From"));
  const subject = headerField(body, "Subject") || "(Không có tiêu đề)";
  const dateHdr = headerField(body, "Date");
  const ctype = headerField(body, "Content-Type").toLowerCase();
  const ngayDate = parseInternalDate(internal) || (dateHdr ? new Date(dateHdr) : null);
  const chuaDoc = flags.includes("\\seen") ? "KHÔNG" : "CÓ";
  const danhDau = flags.includes("\\flagged") ? "CÓ" : "KHÔNG";
  const coTep = /multipart\/mixed|multipart\/related/.test(ctype) ? "CÓ" : undefined;
  return compact({
    uid: uid ? Number(uid) : Number(seq),
    tu: from.ten,
    email_gui: from.email_gui,
    tieu_de: subject,
    ngay: formatNgay(ngayDate && !Number.isNaN(+ngayDate) ? ngayDate : null),
    chua_doc: chuaDoc,
    danh_dau: danhDau,
    co_tep: coTep,
    dung_luong: size || undefined
  });
}

function parseFetches(lines) {
  const text = lines.join("\n");
  const chunks = text.split(/^\* (\d+) FETCH /im);
  const items = [];
  for (let i = 1; i < chunks.length; i += 2) {
    const seq = chunks[i];
    const body = chunks[i + 1] || "";
    if (!/^\d+$/.test(seq)) continue;
    items.push(parseFetchBlock(seq, body));
  }
  return items;
}

function createReader(socket) {
  let buf = Buffer.alloc(0);
  let wait = null;

  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    if (wait) {
      const fn = wait;
      wait = null;
      fn();
    }
  });

  function pump() {
    if (wait) {
      const fn = wait;
      wait = null;
      fn();
    }
  }

  socket.on("error", pump);
  socket.on("end", pump);
  socket.on("close", pump);

  function takeLine() {
    const idx = buf.indexOf("\r\n");
    if (idx < 0) return null;
    const line = buf.slice(0, idx).toString("utf8");
    buf = buf.slice(idx + 2);
    return line;
  }

  function takeBytes(n) {
    if (buf.length < n) return null;
    const slice = buf.slice(0, n);
    buf = buf.slice(n);
    return slice;
  }

  async function readLogicalLine() {
    let collected = "";
    while (true) {
      let line = takeLine();
      if (line == null) {
        if (socket.destroyed || socket.readableEnded) throw new Error("Mất kết nối IMAP.");
        await new Promise((resolve) => { wait = resolve; });
        continue;
      }
      const lit = line.match(/\{(\d+)\}$/);
      if (!lit) return collected + line;
      collected += line.replace(/\{\d+\}$/, "");
      const need = Number(lit[1]);
      let data = takeBytes(need);
      while (data == null) {
        if (socket.destroyed) throw new Error("Mất kết nối IMAP.");
        await new Promise((resolve) => { wait = resolve; });
        data = takeBytes(need);
      }
      collected += data.toString("utf8");
    }
  }

  async function readUntilTag(tag) {
    const lines = [];
    while (true) {
      const line = await readLogicalLine();
      lines.push(line);
      if (line.startsWith(`${tag} `)) return lines;
      if (/^\* BYE /i.test(line)) throw new Error(line.replace(/^\* BYE /i, "").trim() || "IMAP đóng kết nối.");
    }
  }

  return { readLogicalLine, readUntilTag };
}

async function withImap(host, user, pass, fn) {
  const { socket, reader } = await new Promise((resolve, reject) => {
    const sock = tls.connect({
      host,
      port: 993,
      servername: host,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true
    });
    const readerInst = createReader(sock);
    const onErr = (err) => reject(err);
    sock.setTimeout(TIMEOUT_MS, () => {
      sock.destroy();
      reject(new Error("IMAP không trả lời kịp (8s)."));
    });
    sock.once("secureConnect", () => {
      sock.removeListener("error", onErr);
      resolve({ socket: sock, reader: readerInst });
    });
    sock.once("error", onErr);
  });
  let tagN = 0;
  const cmd = async (command) => {
    tagN += 1;
    const tag = `A${tagN}`;
    socket.write(`${tag} ${command}\r\n`);
    const lines = await reader.readUntilTag(tag);
    const last = lines[lines.length - 1] || "";
    const ok = last.startsWith(`${tag} OK`);
    const no = last.startsWith(`${tag} NO`) || last.startsWith(`${tag} BAD`);
    return { ok, no, lines, last };
  };

  try {
    const greet = await reader.readLogicalLine();
    if (!/^\* OK /i.test(greet)) throw new Error("Máy chủ IMAP không chào đúng.");
    const login = await cmd(`LOGIN ${quoteImap(user)} ${quoteImap(pass)}`);
    if (!login.ok) {
      const msg = login.last.replace(/^A\d+\s+(NO|BAD)\s+/i, "").trim();
      const err = new Error(/auth|credential|password|login/i.test(msg)
        ? "Đăng nhập thất bại. Dùng mật khẩu ứng dụng 16 ký tự (không phải mật khẩu Gmail thường). Bật IMAP trong cài đặt Gmail."
        : (msg || "LOGIN bị từ chối."));
      err.statusCode = 401;
      throw err;
    }
    const result = await fn(cmd);
    try { await cmd("LOGOUT"); } catch (_) {}
    return result;
  } finally {
    socket.destroy();
  }
}

function mapFolders(listLines) {
  const found = [];
  const seenMa = new Set();
  for (const line of listLines) {
    const parsed = parseListLine(line);
    if (!parsed || !parsed.name) continue;
    if (parsed.attrs.some((a) => a.toLowerCase() === "\\noselect")) continue;
    const ma = classifyMailbox(parsed.name, parsed.attrs);
    if (!ma) continue;
    if (ma !== "khac" && seenMa.has(ma)) continue;
    if (ma !== "khac") seenMa.add(ma);
    found.push({
      ma: ma === "khac" ? `nhan_${found.length}` : ma,
      ten: ma === "khac" ? parsed.name.replace(/^\[Gmail\]\//, "") : MUC_TEN[ma],
      imap: parsed.name,
      loai: ma
    });
  }
  found.sort((a, b) => {
    const ia = MUC_ORDER.indexOf(a.loai);
    const ib = MUC_ORDER.indexOf(b.loai);
    const sa = ia < 0 ? 100 : ia;
    const sb = ib < 0 ? 100 : ib;
    return sa - sb;
  });
  return found;
}

function resolveFolder(folders, muc) {
  const key = String(muc || "hopthu").toLowerCase().replace(/\s+/g, "");
  const alias = {
    inbox: "hopthu", hopthu: "hopthu", "hộp thư đến": "hopthu",
    star: "danhdau", starred: "danhdau", danhdau: "danhdau", sao: "danhdau",
    snooze: "tre", tre: "tre", taman: "tre",
    sent: "dagui", dagui: "dagui",
    draft: "nhap", drafts: "nhap", nhap: "nhap",
    purchases: "muasam", muasam: "muasam", mua: "muasam",
    spam: "spam", junk: "spam",
    trash: "rac", rac: "rac",
    all: "tatca", tatca: "tatca",
    important: "quantrong", quantrong: "quantrong",
    social: "mangxahoi", mangxahoi: "mangxahoi",
    promo: "quangcao", quangcao: "quangcao",
    updates: "capnhat", capnhat: "capnhat"
  }[key] || key;
  return folders.find((f) => f.ma === alias || f.loai === alias || f.imap.toLowerCase() === key) || folders.find((f) => f.loai === "hopthu");
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "POST" && method !== "PUT") return {};
  if (!req.readable || req.readableEnded) return {};
  const chunks = [];
  try {
    await Promise.race([
      (async () => { for await (const chunk of req) chunks.push(chunk); })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("body-timeout")), 2000))
    ]);
  } catch (_) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Check hộp thư (/tools/checkmail)",
    tac_gia: AUTHOR,
    mo_ta: "Đăng nhập IMAP bằng email + mật khẩu ứng dụng. Trả trang thư đang hiện (mặc định 50 thư mới nhất, giống Gmail) kèm tổng số thư nhận. Load lại: thư mới lên đầu, thư cuối trang biến. Không lưu mật khẩu. Không đánh dấu đã đọc.",
    cu_phap: [
      `${baseUrl}/api/tools/checkmail?email={gmail}&mk={mat_khau_ung_dung}`,
      `${baseUrl}/api/tools/checkmail?email={gmail}&mk={mk}&muc=hopthu&so=50&trang=1`,
      `${baseUrl}/api/tools/checkmail?email={gmail}&mk={mk}&action=folders`,
      "POST /api/tools/checkmail { \"email\": \"...\", \"mk\": \"xxxx xxxx xxxx xxxx\", \"muc\": \"dagui\" }"
    ],
    muc: "hopthu | danhdau | tre | dagui | nhap | muasam | spam | rac | tatca | quantrong",
    luu_y: [
      "Gmail không nhận mật khẩu đăng nhập thường. Tạo mật khẩu ứng dụng: Tài khoản Google → Bảo mật → Xác minh 2 bước → Mật khẩu ứng dụng.",
      "Bật IMAP: Gmail → Cài đặt → Xem tất cả cài đặt → Chuyển tiếp và POP/IMAP → Bật IMAP.",
      "Nên POST — GET gắn mật khẩu trên URL.",
      "Mỗi trang tối đa 50 thư (đúng kiểu Gmail tiết kiệm tài nguyên). trang=2 lấy 50 thư cũ hơn."
    ]
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const params = {};
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (!key && value) params[""] = value;
    else if (key && !value) params[""] = key.replace(/^=/, "");
    else params[key] = value;
  }
  const body = await readBody(req);
  const email = pick(params, body, "email", "mail", "thu", "user", "username");
  const mk = pick(params, body, "mk", "matkhau", "mat_khau", "password", "pass", "app_password", "apppass").replace(/\s+/g, "");
  const muc = pick(params, body, "muc", "folder", "label", "nhan") || "hopthu";
  const action = (pick(params, body, "action", "act") || "list").toLowerCase();
  const so = Math.min(PAGE_MAX, Math.max(1, Number(pick(params, body, "so", "limit", "page_size")) || PAGE_MAX));
  const trang = Math.max(1, Number(pick(params, body, "trang", "page")) || 1);
  const imapHost = pick(params, body, "imap", "host", "may_chu");

  if (!email || !mk) return res.status(200).json(buildGuide(baseUrl));

  const wait = hitCooldown(clientIp(req));
  if (wait) {
    return res.status(429).json({
      trang_thai: "that_bai",
      ma_loi: 429,
      thong_bao: `Đợi ${wait}s rồi load lại — giống Gmail, không kéo liên tục.`,
      tac_gia: AUTHOR
    });
  }

  try {
    const server = detectHost(email, imapHost);
    const data = await withImap(server, email, mk, async (cmd) => {
      const listed = await cmd('LIST "" "*"');
      if (!listed.ok) throw new Error("Không lấy được danh sách mục hộp thư.");
      const folders = mapFolders(listed.lines);
      if (action === "folders" || action === "muc" || action === "labels") {
        const withCount = [];
        for (const folder of folders.slice(0, 16)) {
          const st = await cmd(`STATUS ${quoteImap(folder.imap)} (MESSAGES UNSEEN)`);
          const cnt = parseStatus(st.lines, folder.imap);
          withCount.push(compact({
            ma: folder.ma,
            ten: folder.ten,
            tong_thu: cnt.tong,
            chua_doc: Number.isFinite(cnt.chua_doc) ? cnt.chua_doc : undefined
          }));
        }
        return { kieu: "folders", folders: withCount, imap_host: server };
      }

      const folder = resolveFolder(folders, muc);
      if (!folder) throw new Error("Không tìm thấy mục hộp thư.");
      const selected = await cmd(`SELECT ${quoteImap(folder.imap)}`);
      if (!selected.ok) throw new Error(`Không mở được mục ${folder.ten}.`);
      const existsLine = selected.lines.find((l) => /^\* \d+ EXISTS/i.test(l));
      const tong = existsLine ? Number((existsLine.match(/^\* (\d+) EXISTS/i) || [])[1]) : 0;
      const st = await cmd(`STATUS ${quoteImap(folder.imap)} (MESSAGES UNSEEN)`);
      const cnt = parseStatus(st.lines, folder.imap);
      const tongThu = cnt.tong || tong;
      const soTrang = Math.max(1, Math.ceil(tongThu / so));
      const page = Math.min(trang, soTrang);
      const end = tongThu - (page - 1) * so;
      const start = Math.max(1, end - so + 1);
      let thu = [];
      if (tongThu > 0 && end >= 1) {
        const fetched = await cmd(`FETCH ${start}:${end} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE CONTENT-TYPE)])`);
        thu = parseFetches(fetched.lines).reverse();
      }
      thu = (thu || []).map((item, idx) => compact({ stt: idx + 1, ...item }));
      return {
        kieu: "list",
        folder,
        folders,
        tongThu,
        chuaDoc: cnt.chua_doc,
        so,
        page,
        soTrang,
        thu,
        imap_host: server
      };
    });

    if (data.kieu === "folders") {
      return res.status(200).json(compact({
        trang_thai: "thanh_cong",
        chuyen_muc: "Check hộp thư",
        email,
        may_chu_imap: data.imap_host,
        so_muc: (data.folders || []).length,
        cac_muc: data.folders,
        ghi_chu: "Đây là các mục giống cột trái Gmail. Mở một mục: muc=hopthu|danhdau|dagui|nhap|muasam...",
        tac_gia: AUTHOR
      }));
    }

    return res.status(200).json(compact({
      trang_thai: "thanh_cong",
      chuyen_muc: "Check hộp thư",
      email,
      may_chu_imap: data.imap_host,
      muc_hien_tai: data.folder.ten,
      ma_muc: data.folder.ma,
      tong_thu: data.tongThu,
      chua_doc: Number.isFinite(data.chuaDoc) ? data.chuaDoc : undefined,
      so_thu_hien: (data.thu || []).length,
      trang: data.page,
      so_trang: data.soTrang,
      thu: data.thu,
      cac_muc: (data.folders || []).map((f) => compact({ ma: f.ma, ten: f.ten })),
      ghi_chu: "Chỉ trang đang hiện (thư mới nhất). Load lại: thư mới lên đầu, thư cuối trang ẩn đi. BODY.PEEK — không đánh dấu đã đọc.",
      tac_gia: AUTHOR
    }));
  } catch (error) {
    const timeout = /timeout|8s|quá/i.test(String(error.message || ""));
    return res.status(error.statusCode || (timeout ? 504 : 502)).json({
      trang_thai: "that_bai",
      ma_loi: error.statusCode || (timeout ? 504 : 502),
      chuyen_muc: "Check hộp thư",
      thong_bao: error.message || "Không đọc được hộp thư.",
      tac_gia: AUTHOR
    });
  }
};
