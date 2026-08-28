const tls = require("tls");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const TIMEOUT_MS = 9000;
const PAGE_MAX = 50;
const COOLDOWN_MS = 400;
const TZ = "Asia/Ho_Chi_Minh";
const GMAIL_CAT = {
  chinh: { ten: "Chính", raw: "category:primary" },
  quangcao: { ten: "Quảng cáo", raw: "category:promotions" },
  mangxahoi: { ten: "Mạng xã hội", raw: "category:social" },
  capnhat: { ten: "Cập nhật", raw: "category:updates" },
  muasam: { ten: "Giao dịch mua", raw: "category:purchases" },
  diendan: { ten: "Diễn đàn", raw: "category:forums" }
};
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
  "hopthu", "chinh", "danhdau", "tre", "dagui", "nhap", "muasam",
  "mangxahoi", "quangcao", "capnhat", "diendan",
  "quantrong", "tatca", "spam", "rac"
];

const MUC_TEN = {
  hopthu: "Hộp thư đến",
  chinh: "Chính",
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
  let s = String(input || "");
  s = s.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=\s*/g, (_, charset, enc, text) => {
    try {
      const buf = enc.toUpperCase() === "B" ? Buffer.from(text.replace(/\s/g, ""), "base64") : decodeQ(text);
      return buf.toString("utf8");
    } catch (_) {
      return text;
    }
  });
  return s.replace(/\s+/g, " ").trim();
}

function decodeUtf7Imap(s) {
  return String(s || "").replace(/&([^-]*)-/g, (_, p) => {
    if (!p) return "&";
    try {
      let b64 = p.replace(/,/g, "/");
      while (b64.length % 4) b64 += "=";
      const be = Buffer.from(b64, "base64");
      const le = Buffer.alloc(be.length);
      for (let i = 0; i + 1 < be.length; i += 2) {
        le[i] = be[i + 1];
        le[i + 1] = be[i];
      }
      return le.toString("utf16le");
    } catch (_) {
      return `&${p}-`;
    }
  });
}

function parseSexp(s, i = 0) {
  const skip = () => { while (i < s.length && /[ \t\r\n]/.test(s[i])) i += 1; };
  skip();
  if (i >= s.length) return [null, i];
  if (s[i] === "(") {
    i += 1;
    const arr = [];
    while (true) {
      skip();
      if (i >= s.length) break;
      if (s[i] === ")") { i += 1; break; }
      const [v, ni] = parseSexp(s, i);
      arr.push(v);
      i = ni;
    }
    return [arr, i];
  }
  if (s.slice(i, i + 3).toUpperCase() === "NIL" && (i + 3 >= s.length || /[\s()]/.test(s[i + 3]))) {
    return [null, i + 3];
  }
  if (s[i] === '"') {
    i += 1;
    let out = "";
    while (i < s.length && s[i] !== '"') {
      if (s[i] === "\\") { out += s[i + 1] || ""; i += 2; continue; }
      out += s[i];
      i += 1;
    }
    return [out, i + 1];
  }
  let j = i;
  while (j < s.length && !/[\s()]/.test(s[j])) j += 1;
  return [s.slice(i, j), j];
}

function addressFromSexp(list) {
  if (!Array.isArray(list) || !list.length || !Array.isArray(list[0])) return { ten: undefined, email_gui: undefined };
  const first = list[0];
  const mailbox = first[2] ? String(first[2]) : "";
  const host = first[3] ? String(first[3]) : "";
  const email_gui = mailbox && host ? `${mailbox}@${host}` : undefined;
  const ten = decodeMimeWord(first[0] || "") || (mailbox || undefined);
  return { ten, email_gui };
}

function extractEnvelope(body) {
  const idx = body.search(/ENVELOPE\s*\(/i);
  if (idx < 0) return null;
  const start = body.indexOf("(", idx);
  const [env] = parseSexp(body, start);
  if (!Array.isArray(env) || env.length < 2) return null;
  const from = addressFromSexp(env[2]);
  return {
    date: env[0],
    subject: decodeMimeWord(env[1] || "") || "(Không có tiêu đề)",
    ten: from.ten,
    email_gui: from.email_gui
  };
}

function extractBodySection(body, name) {
  const re = new RegExp(`BODY\\[${name}\\](?:<[^\\]]*>)?\\s*`, "i");
  const m = body.match(re);
  if (!m) return "";
  const [val] = parseSexp(body, m.index + m[0].length);
  return typeof val === "string" ? val : "";
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTextBody(raw) {
  const s = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!s) return {};
  if (/<html|<\s*div|<\s*p[\s>]|<\s*br/i.test(s)) {
    return compact({
      noi_dung: htmlToText(s).slice(0, 20000),
      dinh_dang: "html"
    });
  }
  return compact({
    noi_dung: s.slice(0, 20000),
    dinh_dang: "text"
  });
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
  if (!date || Number.isNaN(+date)) return undefined;
  const fmt = (d) => new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);
  const get = (parts, type) => (parts.find((p) => p.type === type) || {}).value;
  const p = fmt(date);
  const n = fmt(new Date());
  const hh = String(get(p, "hour") || "").padStart(2, "0");
  const mm = String(get(p, "minute") || "").padStart(2, "0");
  if (get(p, "day") === get(n, "day") && get(p, "month") === get(n, "month") && get(p, "year") === get(n, "year")) {
    return `${hh}:${mm}`;
  }
  const day = Number(get(p, "day"));
  const month = Number(get(p, "month"));
  if (get(p, "year") === get(n, "year")) return `${day} thg ${month}`;
  return `${day} thg ${month}, ${get(p, "year")}`;
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
  name = decodeUtf7Imap(name.replace(/^"+|"+$/g, ""));
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
  const env = extractEnvelope(body);
  const fromHdr = parseFrom(headerField(body, "From"));
  const subject = (env && env.subject) || headerField(body, "Subject") || "(Không có tiêu đề)";
  const dateHdr = headerField(body, "Date");
  const ngayDate = parseInternalDate(internal) || (env && env.date ? new Date(env.date) : null) || (dateHdr ? new Date(dateHdr) : null);
  const chuaDoc = flags.includes("\\seen") ? "KHÔNG" : "CÓ";
  const danhDau = flags.includes("\\flagged") ? "CÓ" : "KHÔNG";
  const ten = (env && env.ten) || fromHdr.ten;
  const emailGui = (env && env.email_gui) || fromHdr.email_gui;
  const textRaw = extractBodySection(body, "TEXT") || extractBodySection(body, "1") || extractBodySection(body, "");
  const noiDung = textRaw ? extractTextBody(textRaw) : undefined;
  return compact({
    uid: uid ? Number(uid) : Number(seq),
    tu: ten,
    email_gui: emailGui,
    tieu_de: subject,
    ngay: formatNgay(ngayDate),
    chua_doc: chuaDoc,
    danh_dau: danhDau,
    dung_luong: size || undefined,
    noi_dung: noiDung && noiDung.noi_dung,
    dinh_dang: noiDung && noiDung.dinh_dang
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
      collected += `"${data.toString("utf8").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
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

function parseSearch(lines) {
  const ids = [];
  for (const line of lines) {
    const m = line.match(/^\* SEARCH\s*(.*)$/i);
    if (!m) continue;
    for (const part of m[1].trim().split(/\s+/)) {
      if (/^\d+$/.test(part)) ids.push(Number(part));
    }
  }
  return ids;
}

function gmailTab(muc, isGmail) {
  if (!isGmail) return "";
  const key = String(muc || "hopthu").toLowerCase().replace(/\s+/g, "");
  const map = {
    hopthu: "chinh", inbox: "chinh", chinh: "chinh", primary: "chinh",
    quangcao: "quangcao", promo: "quangcao", promotions: "quangcao",
    mangxahoi: "mangxahoi", social: "mangxahoi",
    capnhat: "capnhat", updates: "capnhat",
    muasam: "muasam", purchases: "muasam",
    diendan: "diendan", forums: "diendan",
    toanbo: "", allinbox: "", full: ""
  };
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  return "";
}

function resolveFolder(folders, muc) {
  const key = String(muc || "hopthu").toLowerCase().replace(/\s+/g, "");
  const alias = {
    inbox: "hopthu", hopthu: "hopthu", chinh: "hopthu", primary: "hopthu",
    star: "danhdau", starred: "danhdau", danhdau: "danhdau", sao: "danhdau",
    snooze: "tre", tre: "tre", taman: "tre",
    sent: "dagui", dagui: "dagui",
    draft: "nhap", drafts: "nhap", nhap: "nhap",
    purchases: "muasam", muasam: "muasam", mua: "muasam",
    spam: "spam", junk: "spam",
    trash: "rac", rac: "rac",
    all: "tatca", tatca: "tatca", toanbo: "hopthu",
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
    mo_ta: "Đăng nhập IMAP bằng email + mật khẩu ứng dụng. Trang 50 thư mới nhất (tab Chính Gmail), tổng thư, đọc nội dung theo uid. Không lưu mật khẩu, không đánh dấu đã đọc.",
    cu_phap: [
      `${baseUrl}/api/tools/checkmail?email={gmail}&mk={mat_khau_ung_dung}`,
      `${baseUrl}/api/tools/checkmail?email={gmail}&mk={mk}&muc=chinh`,
      `${baseUrl}/api/tools/checkmail?email={gmail}&mk={mk}&action=doc&uid={uid}`,
      `${baseUrl}/api/tools/checkmail?email={gmail}&mk={mk}&action=folders`,
      "POST /api/tools/checkmail { \"email\": \"...\", \"mk\": \"...\", \"action\": \"doc\", \"uid\": 800 }"
    ],
    muc: "chinh | quangcao | mangxahoi | capnhat | hopthu | danhdau | dagui | nhap | muasam | spam | rac | toanbo",
    luu_y: [
      "Gmail mặc định tab Chính (như giao diện). muc=toanbo nếu muốn cả Quảng cáo/Mạng xã hội.",
      "Đọc nội dung: action=doc&uid={uid} (uid lấy từ danh sách).",
      "Nên POST — GET gắn mật khẩu trên URL."
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

  const isDoc = action === "doc" || action === "xem" || action === "read" || action === "noidung";
  if (!isDoc) {
    const wait = hitCooldown(clientIp(req));
    if (wait) {
      return res.status(429).json({
        trang_thai: "that_bai",
        ma_loi: 429,
        thong_bao: `Đợi ${wait}s rồi load lại — giống Gmail, không kéo liên tục.`,
        tac_gia: AUTHOR
      });
    }
  }

  try {
    const server = detectHost(email, imapHost);
    const isGmail = server === "imap.gmail.com";
    const uidDoc = pick(params, body, "uid", "id", "msgid");
    const data = await withImap(server, email, mk, async (cmd) => {
      const listed = await cmd('LIST "" "*"');
      if (!listed.ok) throw new Error("Không lấy được danh sách mục hộp thư.");
      const folders = mapFolders(listed.lines);
      const gmailTabs = isGmail ? Object.entries(GMAIL_CAT).map(([ma, v]) => ({ ma, ten: v.ten, loai: ma })) : [];
      const sidebar = [...gmailTabs.filter((t) => !folders.some((f) => f.ma === t.ma)), ...folders];

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
        return { kieu: "folders", folders: [...gmailTabs.map((t) => compact({ ma: t.ma, ten: t.ten })), ...withCount], imap_host: server };
      }

      const folder = resolveFolder(folders, muc);
      if (!folder) throw new Error("Không tìm thấy mục hộp thư.");
      const selected = await cmd(`SELECT ${quoteImap(folder.imap)}`);
      if (!selected.ok) throw new Error(`Không mở được mục ${folder.ten}.`);

      if (isDoc) {
        const uid = Number(uidDoc);
        if (!Number.isFinite(uid) || uid <= 0) {
          const err = new Error("Thiếu uid. Lấy uid từ danh sách rồi gọi action=doc&uid={uid}.");
          err.statusCode = 400;
          throw err;
        }
        const fetched = await cmd(`UID FETCH ${uid} (UID FLAGS INTERNALDATE RFC822.SIZE ENVELOPE BODY.PEEK[TEXT]<0.80000> BODY.PEEK[1]<0.80000>)`);
        const item = parseFetches(fetched.lines)[0];
        if (!item) {
          const err = new Error(`Không tìm thấy thư uid=${uid} trong ${folder.ten}.`);
          err.statusCode = 404;
          throw err;
        }
        return { kieu: "doc", folder, item, imap_host: server };
      }

      const tab = gmailTab(muc, isGmail);
      let tongThu = 0;
      let chuaDoc = 0;
      let thu = [];
      let maMuc = folder.ma;
      let tenMuc = folder.ten;

      if (tab && GMAIL_CAT[tab]) {
        tenMuc = GMAIL_CAT[tab].ten;
        maMuc = tab;
        const all = await cmd(`UID SEARCH X-GM-RAW ${quoteImap(GMAIL_CAT[tab].raw)}`);
        const unseen = await cmd(`UID SEARCH X-GM-RAW ${quoteImap(`${GMAIL_CAT[tab].raw} is:unread`)}`);
        const uids = parseSearch(all.lines);
        chuaDoc = parseSearch(unseen.lines).length;
        tongThu = uids.length;
        const soTrang = Math.max(1, Math.ceil(tongThu / so) || 1);
        const page = Math.min(trang, soTrang);
        const end = uids.length - (page - 1) * so;
        const start = Math.max(0, end - so);
        const pageUids = uids.slice(start, end);
        if (pageUids.length) {
          const fetched = await cmd(`UID FETCH ${pageUids.join(",")} (UID FLAGS INTERNALDATE RFC822.SIZE ENVELOPE)`);
          thu = parseFetches(fetched.lines).sort((a, b) => (b.uid || 0) - (a.uid || 0));
        }
        thu = (thu || []).map((item, idx) => compact({ stt: idx + 1, ...item, xem: `action=doc&uid=${item.uid}` }));
        return { kieu: "list", folder: { ...folder, ma: maMuc, ten: tenMuc }, folders: sidebar, tongThu, chuaDoc, so, page, soTrang, thu, imap_host: server };
      }

      const existsLine = selected.lines.find((l) => /^\* \d+ EXISTS/i.test(l));
      const tong = existsLine ? Number((existsLine.match(/^\* (\d+) EXISTS/i) || [])[1]) : 0;
      const st = await cmd(`STATUS ${quoteImap(folder.imap)} (MESSAGES UNSEEN)`);
      const cnt = parseStatus(st.lines, folder.imap);
      tongThu = cnt.tong || tong;
      chuaDoc = cnt.chua_doc;
      const soTrang = Math.max(1, Math.ceil(tongThu / so) || 1);
      const page = Math.min(trang, soTrang);
      const end = tongThu - (page - 1) * so;
      const start = Math.max(1, end - so + 1);
      if (tongThu > 0 && end >= 1) {
        const fetched = await cmd(`FETCH ${start}:${end} (UID FLAGS INTERNALDATE RFC822.SIZE ENVELOPE)`);
        thu = parseFetches(fetched.lines).reverse();
      }
      thu = (thu || []).map((item, idx) => compact({ stt: idx + 1, ...item, xem: item.uid ? `action=doc&uid=${item.uid}` : undefined }));
      return { kieu: "list", folder, folders: sidebar, tongThu, chuaDoc, so, page, soTrang, thu, imap_host: server };
    });

    if (data.kieu === "folders") {
      return res.status(200).json(compact({
        trang_thai: "thanh_cong",
        chuyen_muc: "Check hộp thư",
        email,
        may_chu_imap: data.imap_host,
        so_muc: (data.folders || []).length,
        cac_muc: data.folders,
        ghi_chu: "Tab Gmail: muc=chinh|quangcao|mangxahoi|capnhat. Mục khác: danhdau|dagui|nhap|spam|rac|toanbo.",
        tac_gia: AUTHOR
      }));
    }

    if (data.kieu === "doc") {
      return res.status(200).json(compact({
        trang_thai: "thanh_cong",
        chuyen_muc: "Check hộp thư — Nội dung",
        email,
        muc_hien_tai: data.folder.ten,
        thu: data.item,
        ghi_chu: "BODY.PEEK — không đánh dấu đã đọc. Giờ theo múi giờ Việt Nam.",
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
      ghi_chu: "Mặc định tab Chính Gmail (50 thư mới nhất, giờ VN). Đọc thư: action=doc&uid={uid}. muc=toanbo = cả hộp IMAP.",
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
