const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const TIMEOUT_MS = 8000;
const MAX_SO = 5;
const SECMAIL_BASES = [
  "https://www.1secmail.com/api/v1/",
  "https://www.1secmail.org/api/v1/",
  "https://www.1secmail.net/api/v1/"
];

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function extractFirstParam(params) {
  return String(params[""] || "").trim();
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

function randomString(len, chars = "abcdefghijklmnopqrstuvwxyz0123456789") {
  let s = "";
  for (let i = 0; i < len; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: { Accept: "application/json", "User-Agent": "ZheeAPI/1.0", ...(options.headers || {}) },
    body: options.body,
    signal: AbortSignal.timeout(options.timeout || TIMEOUT_MS)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 400) };
}

async function mailtm(method, endpoint, data, token) {
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return httpJson(`https://api.mail.tm${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  });
}

async function getMailTmDomain() {
  const res = await mailtm("GET", "/domains");
  const data = res.json;
  if (Array.isArray(data) && data[0]?.domain) return data[0].domain;
  if (data?.["hydra:member"]?.[0]?.domain) return data["hydra:member"][0].domain;
  if (data?.member?.[0]?.domain) return data.member[0].domain;
  return "";
}

async function createMailTm(username, password) {
  const domain = await getMailTmDomain();
  if (!domain) throw new Error("Không lấy được domain Mail.tm.");
  const uname = (username || randomString(8)).toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const pwd = password || randomString(10, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  if (uname.length < 3) throw new Error("Tên hộp thư tối thiểu 3 ký tự (chữ thường, số).");
  const addr = `${uname}@${domain}`;
  const res = await mailtm("POST", "/accounts", { address: addr, password: pwd });
  if (!(res.status === 201 || res.json?.id)) {
    const msg = res.json?.detail || res.json?.message || `HTTP ${res.status}`;
    throw new Error(`Mail.tm không tạo được: ${msg}`);
  }
  return compact({
    email: addr,
    mat_khau: pwd,
    nha: "Mail.tm",
    kieu: "dai",
    han: "Khoảng 2 ngày nếu không dùng",
    id: res.json.id,
    xem_thu: `action=thu&email=${encodeURIComponent(addr)}&mk=${encodeURIComponent(pwd)}`
  });
}

async function secmail(action, extra = "") {
  let lastErr = "1secmail không trả lời.";
  for (const base of SECMAIL_BASES) {
    try {
      const url = `${base}?action=${encodeURIComponent(action)}${extra}`;
      const res = await httpJson(url, { timeout: 6000 });
      if (res.ok && res.json != null) return res.json;
      lastErr = `1secmail HTTP ${res.status}`;
    } catch (error) {
      lastErr = error.message || lastErr;
    }
  }
  throw new Error(lastErr);
}

async function createSecmail(username) {
  if (username) {
    const uname = username.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (uname.length < 3) throw new Error("Tên hộp thư tối thiểu 3 ký tự (chữ thường, số).");
    const domains = await secmail("getDomainList");
    const domain = Array.isArray(domains) && domains[0] ? domains[0] : "1secmail.com";
    const addr = `${uname}@${domain}`;
    return compact({
      email: addr,
      nha: "1secmail",
      kieu: "ngan",
      han: "Thư đến trong vài giờ, không cần mật khẩu",
      xem_thu: `action=thu&email=${encodeURIComponent(addr)}`
    });
  }
  const list = await secmail("genRandomMailbox", "&count=1");
  const addr = Array.isArray(list) ? list[0] : list;
  if (!addr || !String(addr).includes("@")) throw new Error("1secmail không trả địa chỉ.");
  return compact({
    email: String(addr),
    nha: "1secmail",
    kieu: "ngan",
    han: "Thư đến trong vài giờ, không cần mật khẩu",
    xem_thu: `action=thu&email=${encodeURIComponent(String(addr))}`
  });
}

async function createGuerrilla() {
  const res = await httpJson("https://api.guerrillamail.com/ajax.php?f=get_email_address&ip=127.0.0.1&agent=ZheeAPI", { timeout: 6000 });
  const addr = res.json?.email_addr || res.json?.email;
  const sid = res.json?.sid_token;
  if (!addr) throw new Error("Guerrilla Mail không tạo được hộp thư.");
  return compact({
    email: addr,
    nha: "Guerrilla Mail",
    kieu: "ngan",
    han: "Khoảng 60 phút",
    sid: sid,
    xem_thu: sid ? `action=thu&email=${encodeURIComponent(addr)}&sid=${encodeURIComponent(sid)}` : undefined
  });
}

async function createOne(kieu, ten, mk) {
  if (kieu === "dai" || kieu === "mailtm") return createMailTm(ten, mk);
  if (kieu === "guerrilla") return createGuerrilla();
  try {
    return await createSecmail(ten);
  } catch (error) {
    try {
      const g = await createGuerrilla();
      g.ghi_chu = `1secmail lỗi (${error.message}), đã dùng Guerrilla.`;
      return g;
    } catch (_) {
      throw error;
    }
  }
}

function mapKieu(raw) {
  const s = String(raw || "").toLowerCase().replace(/\s+/g, "");
  if (["dai", "daihan", "long", "mailtm", "mail.tm", "2"].includes(s)) return "dai";
  if (["ngan", "nganhan", "short", "1secmail", "secmail", "1"].includes(s)) return "ngan";
  if (["guerrilla", "10phut", "guerrillamail"].includes(s)) return "guerrilla";
  if (["mix", "nhanh", "3"].includes(s)) return "mix";
  return "";
}

async function listThu(email, mk, sid) {
  const addr = String(email || "").trim().toLowerCase();
  if (!addr.includes("@")) throw new Error("Thiếu email đã tạo.");
  const [login, domain] = addr.split("@");

  if (mk) {
    const tokenRes = await mailtm("POST", "/token", { address: addr, password: mk });
    const token = tokenRes.json?.token;
    if (!token) throw new Error("Mail.tm đăng nhập thất bại. Sai email/mật khẩu hoặc mail đã hết hạn.");
    const msgs = await mailtm("GET", "/messages", null, token);
    const list = msgs.json?.["hydra:member"] || msgs.json?.member || (Array.isArray(msgs.json) ? msgs.json : []);
    return (list || []).slice(0, 20).map((m, i) => compact({
      stt: i + 1,
      id: m.id,
      tu: m.from?.address || m.from || undefined,
      tieu_de: m.subject || "(Không có tiêu đề)",
      ngay: m.createdAt || m.date,
      xem: `action=doc&email=${encodeURIComponent(addr)}&mk=${encodeURIComponent(mk)}&id=${encodeURIComponent(m.id)}`
    }));
  }

  if (sid) {
    const res = await httpJson(`https://api.guerrillamail.com/ajax.php?f=check_email&sid_token=${encodeURIComponent(sid)}&seq=0`);
    const list = res.json?.list || [];
    return list.slice(0, 20).map((m, i) => compact({
      stt: i + 1,
      id: m.mail_id,
      tu: m.mail_from,
      tieu_de: m.mail_subject || "(Không có tiêu đề)",
      ngay: m.mail_date
    }));
  }

  const msgs = await secmail("getMessages", `&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`);
  const list = Array.isArray(msgs) ? msgs : [];
  return list.slice(0, 20).map((m, i) => compact({
    stt: i + 1,
    id: m.id,
    tu: m.from,
    tieu_de: m.subject || "(Không có tiêu đề)",
    ngay: m.date,
    xem: `action=doc&email=${encodeURIComponent(addr)}&id=${encodeURIComponent(m.id)}`
  }));
}

async function readThu(email, mk, id) {
  const addr = String(email || "").trim().toLowerCase();
  const [login, domain] = addr.split("@");
  if (mk) {
    const tokenRes = await mailtm("POST", "/token", { address: addr, password: mk });
    const token = tokenRes.json?.token;
    if (!token) throw new Error("Mail.tm đăng nhập thất bại.");
    const msg = await mailtm("GET", `/messages/${encodeURIComponent(id)}`, null, token);
    const d = msg.json || {};
    return compact({
      id: d.id,
      tu: d.from?.address || d.from,
      tieu_de: d.subject,
      ngay: d.createdAt,
      noi_dung: (d.text || "").slice(0, 20000) || undefined,
      html: d.html ? "CÓ" : undefined
    });
  }
  const mail = await secmail("readMessage", `&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`);
  return compact({
    id: mail?.id,
    tu: mail?.from,
    tieu_de: mail?.subject,
    ngay: mail?.date,
    noi_dung: String(mail?.textBody || mail?.body || "").slice(0, 20000) || undefined
  });
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Tạo mail tạm (/mail/taomail)",
    tac_gia: AUTHOR,
    mo_ta: "Tạo hộp thư tạm thật qua 1secmail (ngắn, không mật khẩu) và Mail.tm (dài, có mật khẩu) — cùng API với bot.php. Không lưu mail trên server.",
    cu_phap: [
      `${baseUrl}/mail/taomail?kieu=ngan`,
      `${baseUrl}/mail/taomail?kieu=dai`,
      `${baseUrl}/mail/taomail?kieu=dai&so=3`,
      `${baseUrl}/mail/taomail?kieu=ngan&ten=tenban`,
      `${baseUrl}/mail/taomail?kieu=dai&ten=tenban&mk=Pass123`,
      `${baseUrl}/mail/taomail?action=thu&email={email}`,
      `${baseUrl}/mail/taomail?action=thu&email={email}&mk={mat_khau}`
    ],
    kieu: {
      ngan: "1secmail — nhận OTP nhanh, không mật khẩu",
      dai: "Mail.tm — có mật khẩu, giữ lâu hơn",
      guerrilla: "Guerrilla Mail — dự phòng nếu 1secmail lỗi"
    },
    luu_y: [
      "Không phải random @domain giả. Gọi API 1secmail / Mail.tm như bot.php.",
      "Serverless không nhớ danh sách mail đã tạo — giữ email (và mk) client trả về.",
      "so tối đa 5 / lần (giới hạn 10s Vercel)."
    ]
  };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
  const first = extractFirstParam(params);
  const action = (pick(params, body, "action", "act") || "").toLowerCase();
  const email = pick(params, body, "email", "mail", "thu");
  const mk = pick(params, body, "mk", "matkhau", "password", "pass");
  const sid = pick(params, body, "sid", "sid_token");
  const id = pick(params, body, "id", "msgid");
  let kieu = mapKieu(pick(params, body, "kieu", "loai", "nha", "type") || first);
  const ten = pick(params, body, "ten", "user", "username");
  let so = Number(pick(params, body, "so", "count", "n") || (/^\d+$/.test(first) ? first : 1));
  if (!Number.isFinite(so) || so < 1) so = 1;
  so = Math.min(MAX_SO, so);

  const noCreateHint = !kieu && !action && !email && !ten && !first;
  if (noCreateHint) return res.status(200).json(buildGuide(baseUrl));

  try {
    if (action === "thu" || action === "inbox" || action === "hopthu") {
      const ds = await listThu(email, mk, sid);
      return res.status(200).json(compact({
        trang_thai: "thanh_cong",
        chuyen_muc: "Tạo mail tạm — Hộp thư",
        email,
        so_thu: ds.length,
        thu: ds,
        ghi_chu: ds.length ? undefined : "Chưa có thư đến.",
        tac_gia: AUTHOR
      }));
    }
    if (action === "doc" || action === "xem" || action === "read") {
      if (!id) {
        return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Thiếu id thư.", tac_gia: AUTHOR });
      }
      const thu = await readThu(email, mk, id);
      return res.status(200).json(compact({
        trang_thai: "thanh_cong",
        chuyen_muc: "Tạo mail tạm — Nội dung",
        email,
        thu,
        tac_gia: AUTHOR
      }));
    }

    if (!kieu) kieu = "dai";
    const hopThu = [];
    if (kieu === "mix") {
      hopThu.push(await createOne("ngan", ten, mk));
      hopThu.push(await createOne("dai", ten, mk));
    } else {
      for (let i = 0; i < so; i += 1) {
        hopThu.push(await createOne(kieu, ten && so === 1 ? ten : (ten ? `${ten}${i + 1}` : ""), so === 1 ? mk : ""));
      }
    }

    const withLink = hopThu.map((item, idx) => compact({
      stt: idx + 1,
      ...item,
      xem_thu: item.xem_thu ? `${baseUrl}/mail/taomail?${item.xem_thu}` : undefined
    }));

    return res.status(200).json(compact({
      trang_thai: "thanh_cong",
      chuyen_muc: "Tạo mail tạm",
      kieu: kieu === "dai" ? "Mail.tm (dài hạn)" : kieu === "mix" ? "Mix ngắn + dài" : "Ngắn hạn",
      so_luong: withLink.length,
      hop_thu: withLink,
      ghi_chu: "Giữ email/mật khẩu client. Server không lưu. Xem thư: action=thu.",
      tac_gia: AUTHOR
    }));
  } catch (error) {
    return res.status(502).json({
      trang_thai: "that_bai",
      ma_loi: 502,
      chuyen_muc: "Tạo mail tạm",
      thong_bao: error.message || "Không tạo được mail tạm.",
      tac_gia: AUTHOR
    });
  }
};
