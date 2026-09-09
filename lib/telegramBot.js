const { hasRedis, createLicense, activateLicense, verifySession, revokeLicense, listLicenses, getBotMessageId, setBotMessageId, getPendingAction, setPendingAction, clearPendingAction } = require("./licenseStore");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const pending = new Map();
const sentMessages = new Map();
const catalogCache = { expiresAt: 0, items: [] };

async function readPending(chatId) {
  const local = pending.get(String(chatId));
  if (local) return local;
  const stored = await getPendingAction(chatId);
  return stored?.action || "";
}

async function writePending(chatId, action) {
  pending.set(String(chatId), action);
  await setPendingAction(chatId, action);
}

async function clearPending(chatId) {
  pending.delete(String(chatId));
  await clearPendingAction(chatId);
}

function config() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    admins: String(process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((id) => id.trim()).filter(Boolean),
    baseUrl: String(process.env.PUBLIC_BASE_URL || "https://api-zhee.vercel.app").replace(/\/$/, "")
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function isAdmin(chatId) { return config().admins.includes(String(chatId)); }

function stripTelegramHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>(?=\n|$)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

async function telegram(method, body) {
  const { token } = config();
  const request = async (payloadBody) => {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBody),
      signal: AbortSignal.timeout(10000)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      const error = new Error(payload.description || `Telegram HTTP ${response.status}.`);
      error.telegramPayload = payload;
      throw error;
    }
    return payload.result;
  };

  try {
    return await request(body);
  } catch (error) {
    if (method === "sendMessage" && body?.parse_mode === "HTML" && /parse entities|can't parse|unsupported start tag/i.test(error.message)) {
      const fallback = { ...body, text: stripTelegramHtml(body.text) };
      delete fallback.parse_mode;
      return request(fallback);
    }
    throw error;
  }
}

async function deleteMessage(chatId, messageId) {
  if (!messageId) return;
  try { await telegram("deleteMessage", { chat_id: chatId, message_id: messageId }); } catch (_) {}
}

async function removePrevious(chatId) {
  const previous = sentMessages.get(String(chatId)) || await getBotMessageId(chatId);
  for (const messageId of (Array.isArray(previous) ? previous : [previous])) {
    await deleteMessage(chatId, messageId);
  }
}

async function send(chatId, text, keyboard) {
  await removePrevious(chatId);
  const result = await telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
  });
  sentMessages.set(String(chatId), [result.message_id]);
  await setBotMessageId(chatId, [result.message_id]);
  return result;
}

function redactApiUrls(value) {
  return String(value ?? "").replace(/https?:\/\/[^\s<>]+\/(?:api|mxh|tools|downloads|mail|web|bank|taixiu)(?:[^\s<>]*)/gi, "[endpoint đã ẩn]");
}

function compactTelegramText(value, limit = 180) {
  const text = redactApiUrls(value).replace(/[\r\n]+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(20, limit - 24))}…${text.slice(-20)}`;
}

function formatTelegramValue(value, key = "") {
  if (value === null || value === undefined || value === "") return "<i>Không có dữ liệu</i>";
  if (typeof value === "boolean") {
    if (/verified|xac_minh|tich_xanh|is_blue/i.test(key)) return value ? "✅ Đã xác minh" : "❌ Chưa xác minh";
    if (/private|public|active|enabled|available|success|thanh_cong/i.test(key)) return value ? "✅ Có" : "❌ Không";
    return value ? "✅ Có" : "❌ Không";
  }
  const text = String(value);
  if (/^trang_thai$/i.test(key)) {
    if (/thanh_cong|success|ok/i.test(text)) return "✅ Thành công";
    if (/that_bai|failed|error/i.test(text)) return "❌ Thất bại";
  }
  if (/duong_dan|endpoint|api_url|url_api|raw_path|link_vi_du/i.test(key)) return "<i>Thông tin kỹ thuật đã ẩn</i>";
  if (/^(?:https?:\/\/[^/]+)?\/api\//i.test(text) || /\/api\/taixiu\//i.test(text)) return "<i>Liên kết API đã ẩn</i>";
  if (/^https?:\/\//i.test(text)) {
    if (/\/api\//i.test(text) || /api-zhee(?:\.vercel)?\.app/i.test(text)) return "<i>Liên kết API đã ẩn</i>";
    const publicLink = /avatar|anh|image|photo|picture|profile|trang_ca_nhan|repo|website|trang_web|video|download|stream|media/i.test(key);
    if (!publicLink) return "<i>Liên kết kỹ thuật đã ẩn</i>";
    const label = /avatar|anh|image|photo|picture/i.test(key) ? "Xem ảnh" : fieldLabel(key) || "Mở liên kết";
    return `<a href="${escapeHtml(text)}">🔗 ${escapeHtml(label)}</a>`;
  }
  if (/^(id|uid|asn|code)$|(_id|_uid|_code|token)$/i.test(key)) return `<code>${escapeHtml(compactTelegramText(text, 96))}</code>`;
  return escapeHtml(compactTelegramText(text));
}

function isGithubEndpoint(item) {
  return /github/i.test(String(item?.duong_dan || item?.ten_api || ""));
}

function formatDate(value) {
  const text = String(value || "");
  return text ? escapeHtml(text.slice(0, 10)) : "<i>Không có dữ liệu</i>";
}

function githubResultLines(payload) {
  const profile = payload?.thong_tin_ca_nhan || {};
  const repos = Array.isArray(payload?.danh_sach_repo) ? payload.danh_sach_repo : [];
  if (!Object.keys(profile).length && !repos.length) {
    return ["⚠️ <b>KẾT QUẢ MẪU KHÔNG CÓ DỮ LIỆU</b>", "📝 Endpoint mẫu không trả profile/repository. Vui lòng nhập username GitHub thật để tra cứu."];
  }
  const lines = [
    "📌 <b>THÔNG TIN TÀI KHOẢN GITHUB</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    `👤 <b>Họ tên:</b> ${escapeHtml(profile.ho_ten || "Không có")} (<code>${escapeHtml(profile.tai_khoan || "Không có")}</code>)`,
    `🆔 <b>ID:</b> <code>${escapeHtml(profile.id ?? "Không có")}</code>`,
    `📝 <b>Tiểu sử:</b> ${escapeHtml(compactTelegramText(profile.tieu_su || "Không có", 220))}`,
    `🔗 <b>Trang cá nhân:</b> ${profile.link_trang_ca_nhan ? `<a href="${escapeHtml(profile.link_trang_ca_nhan)}">Xem tại đây</a>` : "<i>Không có</i>"}`,
    `📅 <b>Ngày tạo:</b> ${formatDate(profile.ngay_tao_tai_khoan)} | <b>Cập nhật:</b> ${formatDate(profile.ngay_cap_nhat_lan_cuoi)}`,
    "",
    "📊 <b>THỐNG KÊ</b>",
    `• Tổng số Repo: <b>${profile.tong_so_repo ?? 0}</b>`,
    `• Người theo dõi: <b>${profile.nguoi_theo_doi ?? 0}</b> | Đang theo dõi: <b>${profile.dang_theo_doi ?? 0}</b>`,
    "",
    `📦 <b>DANH SÁCH REPOSITORY (${repos.length} Repos)</b>`,
    "━━━━━━━━━━━━━━━━━━━━"
  ];
  repos.forEach((repo, index) => {
    const description = compactTelegramText(repo.mo_ta || "Không có mô tả", 120);
    const repoLink = repo.link_repo ? `<a href="${escapeHtml(repo.link_repo)}">Link Repo</a>` : "<i>Không có link</i>";
    lines.push(`${index + 1}. 📂 <b>${escapeHtml(compactTelegramText(repo.ten_repo || "Không tên", 70))}</b> (${escapeHtml(repo.ngon_ngu || "Không xác định")}) - ⭐ ${repo.so_sao ?? 0} | 🍴 ${repo.luot_fork ?? 0}`);
    lines.push(`   └ 📝 ${escapeHtml(description)} — ${repoLink}`, "");
  });
  lines.push("━━━━━━━━━━━━━━━━━━━━", "✅ <b>Xử lý thành công.</b>");
  return lines;
}

function detailLines(value, depth = 0, state = { length: 0 }, item = null) {
  if (depth === 0 && isGithubEndpoint(item)) return githubResultLines(value);
  return [renderTelegramDetails(value, depth, state)];
}

function quoteDetailLines(lines, maxLength = 2850) {
  const blocks = [];
  let current = [];
  let length = 0;
  lines.forEach((line) => {
    const nextLength = length + String(line).length + 1;
    if (current.length && nextLength > maxLength) {
      blocks.push(`<blockquote>${current.join("\n")}</blockquote>`);
      current = [];
      length = 0;
    }
    current.push(line);
    length += String(line).length + 1;
  });
  if (current.length) blocks.push(`<blockquote>${current.join("\n")}</blockquote>`);
  return blocks;
}

function samplePreviewLines(payload, item) {
  const rendered = detailLines(payload, 0, { length: 0 }, item)
    .flatMap((line) => String(line).split("\n"))
    .filter((line) => line.trim());
  const maxLines = isGithubEndpoint(item) ? 20 : 18;
  const maxChars = 1900;
  const selected = [];
  let length = 0;
  for (const line of rendered) {
    if (selected.length >= maxLines || length + line.length > maxChars) break;
    selected.push(line);
    length += line.length + 1;
  }
  if (selected.length < rendered.length) {
    selected.push("", "… <i>Kết quả mẫu đã được rút gọn để giao diện dễ xem.</i>", "📝 Nhập dữ liệu để nhận toàn bộ thông tin và file JSON đầy đủ.");
  }
  return selected;
}

async function sendJsonFile(chatId, filename, item, payload, status, keyboard) {
  await removePrevious(chatId);
  const successful = status < 400 && payload?.trang_thai !== "that_bai";
  const lines = [
    `━━━━━━━━━━━━━━━━━━━━`,
    `✨ <b>${escapeHtml(item.ten_api || "Kết quả API")}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📝 <b>Chú thích:</b> ${escapeHtml(redactApiUrls(item.mo_ta || "Kết quả xử lý API."))}`,
    "",
    successful ? "✅ <b>Đã xử lý thành công</b>" : "❌ <b>Xử lý thất bại</b>",
    "",
    "📊 <b>THÔNG TIN CHI TIẾT</b>",
    ...quoteDetailLines(detailLines(payload, 0, { length: 0 }, item)),
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "📎 <i>File JSON đầy đủ được gửi kèm bên dưới.</i>"
  ];
  const chunks = [];
  let current = "";
  lines.forEach((line) => {
    if ((current + line + "\n").length > 3500 && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${line}\n`;
  });
  if (current.trim()) chunks.push(current.trim());

  const messageIds = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const suffix = chunks.length > 1 ? `\n\n<i>Phần ${index + 1}/${chunks.length}</i>` : "";
    const result = await telegram("sendMessage", {
      chat_id: chatId,
      text: `${chunks[index]}${suffix}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(index === chunks.length - 1 && keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
    });
    messageIds.push(result.message_id);
  }

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", "File JSON đầy đủ của kết quả API.");
  form.append("parse_mode", "HTML");
  form.append("document", new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), filename);
  const { token } = config();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form, signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram HTTP ${response.status}.`);
  messageIds.push(result.result.message_id);
  sentMessages.set(String(chatId), messageIds);
  await setBotMessageId(chatId, messageIds);
  return result.result;
}

async function answerCallback(id) { try { await telegram("answerCallbackQuery", { callback_query_id: id }); } catch (_) {} }

async function getCatalog() {
  if (catalogCache.expiresAt > Date.now()) return catalogCache.items;
  const { baseUrl } = config();
  const response = await fetch(`${baseUrl}/list`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Gateway HTTP ${response.status}.`);
  const payload = await response.json();
  catalogCache.items = Object.values(payload.danh_sach || {});
  catalogCache.expiresAt = Date.now() + 60000;
  return catalogCache.items;
}

function groupFor(item) {
  const path = String(item.duong_dan || "").toLowerCase();
  if (path.includes("/taixiu")) return "taixiu";
  if (path.includes("/bank")) return "bank";
  if (path.includes("/downloads")) return "downloads";
  if (path.includes("/mail")) return "mail";
  if (path.includes("/web")) return "web";
  if (path.includes("/mxh") || /github|roblox|tiktok|youtube|discord|telegram|twitter|facebook|zalo|spotify|soundcloud|instagram|twitch|pinterest|shopee|tiki|lazada|mega/i.test(path)) return "mxh";
  return "tools";
}

const GROUPS = {
  mxh: { title: "MẠNG XÃ HỘI", description: "Profile, media, cộng đồng và nền tảng số." },
  tools: { title: "TOOLS", description: "AI, lookup, key manager và tiện ích dữ liệu." },
  taixiu: { title: "TÀI XỈU", description: "Các module gaming và công cụ xác suất." },
  bank: { title: "NGÂN HÀNG", description: "VietQR và tiện ích thanh toán." },
  downloads: { title: "DOWNLOADS", description: "Tải media và bóc tách dữ liệu." },
  mail: { title: "MAIL", description: "Mail tạm, IMAP và OTP." },
  web: { title: "WEB", description: "Domain, endpoint, DNS và website utilities." }
};

function panel(icon, title, body = "") {
  return ["━━━━━━━━━━━━━━━━━━━━", `${icon} <b>${escapeHtml(title)}</b>`, "━━━━━━━━━━━━━━━━━━━━", body, "━━━━━━━━━━━━━━━━━━━━"].join("\n");
}

function mainKeyboard(admin) {
  const rows = [
    [{ text: "🔑 KÍCH HOẠT LICENSE", callback_data: "license:help" }],
    [{ text: "👥 MẠNG XÃ HỘI", callback_data: "group:mxh:0" }, { text: "🧰 TOOLS", callback_data: "group:tools:0" }],
    [{ text: "🎲 TÀI XỈU", callback_data: "group:taixiu:0" }, { text: "🏦 NGÂN HÀNG", callback_data: "group:bank:0" }],
    [{ text: "⬇️ DOWNLOADS", callback_data: "group:downloads:0" }, { text: "✉️ MAIL", callback_data: "group:mail:0" }],
    [{ text: "🌐 WEB", callback_data: "group:web:0" }, { text: "❔ HƯỚNG DẪN", callback_data: "help" }]
  ];
  if (admin) rows.push([{ text: "🛡️ ADMIN", callback_data: "admin:menu" }, { text: "🎬 VIDEO VIP", callback_data: "admin:video" }]);
  return rows;
}

async function requireSession(chatId) {
  const result = await verifySession(chatId);
  if (!result.valid) {
    await send(chatId, panel("🔐", "LICENSE CẦN ĐƯỢC KÍCH HOẠT", `⚠️ ${escapeHtml(result.reason)}\n\n📝 Nhấn nút bên dưới rồi dán license key trực tiếp vào tin nhắn.`), [[{ text: "🔑 DÁN LICENSE KEY", callback_data: "license:help" }]]);
    return false;
  }
  return true;
}

async function showGroup(chatId, group, page = 0) {
  if (!await requireSession(chatId)) return;
  const items = (await getCatalog()).filter((item) => groupFor(item) === group);
  const info = GROUPS[group];
  const size = 7;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(pages - 1, Math.max(0, Number(page) || 0));
  const selected = items.slice(current * size, current * size + size);
  const rows = selected.map((item, index) => [{ text: `🔹 ${current * size + index + 1} · ${String(item.ten_api || "Endpoint").slice(0, 40)}`, callback_data: `api:detail:${group}:${current * size + index}` }]);
  rows.push([
    ...(current ? [{ text: "⬅️ TRƯỚC", callback_data: `group:${group}:${current - 1}` }] : []),
    { text: `📄 ${current + 1}/${pages}`, callback_data: "noop" },
    ...(current < pages - 1 ? [{ text: "SAU ➡️", callback_data: `group:${group}:${current + 1}` }] : [])
  ]);
  rows.push([{ text: "🏠 MENU CHÍNH", callback_data: "home" }]);
  await send(chatId, panel("📚", info.title, `📝 ${escapeHtml(info.description)}\n\n👇 Chọn endpoint để xem hướng dẫn và thao tác.\n📄 Trang <b>${current + 1}/${pages}</b> · ${items.length} endpoint`), rows);
}

function itemAt(items, group, index) {
  return items.filter((item) => groupFor(item) === group)[Number(index)];
}

function hasPlaceholder(item) { return /\{[^}]+\}/.test(String(item?.link_vi_du || "")); }

function parseMultiInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return new URLSearchParams(Object.entries(parsed).filter(([, item]) => item !== null && item !== undefined).map(([key, item]) => [key, String(item)])).toString();
    }
  } catch (_) {}
  if (/^[^=\n]+=[^\n]+(?:[&;]\s*[^=\n]+=[^\n]+)*$/.test(raw)) {
    return raw.split(";").map((part) => part.trim()).join("&");
  }
  return "";
}

function makeInputPath(item, value) {
  const example = String(item.link_vi_du || "");
  const raw = String(value ?? "").trim();
  const query = parseMultiInput(raw);
  if (query) return `${item.duong_dan}?${query}`;
  if (/\/nasa/i.test(item.duong_dan) && /^(?:action|type)=/i.test(raw)) {
    return `${item.duong_dan}?${raw.replace(/^\?/, "")}`;
  }
  if (example.includes("{")) return example.replace(/\{[^}]+\}/, encodeURIComponent(raw));
  return `${item.duong_dan}?=${encodeURIComponent(raw)}`;
}

function inputHint(item) {
  const raw = String(item?.link_vi_du || "");
  try {
    const parsed = new URL(raw, "https://example.invalid");
    const keys = [...new Set([...parsed.searchParams.keys()].filter(Boolean))];
    if (keys.length) return `🔑 Từ khóa hỗ trợ: <code>${escapeHtml(keys.join(", "))}</code>`;
  } catch (_) {}
  return "🔑 Có thể nhập một giá trị hoặc nhiều cặp <code>key=value</code>.";
}

function quoteExample(value) {
  return `"${String(value ?? "").replace(/[\\"\r\n]+/g, " ").trim()}"`;
}

function exampleInput(item) {
  const raw = String(item?.link_vi_du || "").trim();
  if (!raw) return quoteExample("Dữ liệu mẫu có sẵn");
  const placeholders = [...raw.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  if (placeholders.length) return placeholders.map((name) => quoteExample(`${name}_mẫu`)).join(" ");
  try {
    const parsed = new URL(raw, "https://example.invalid");
    const values = [...parsed.searchParams.values()].filter(Boolean);
    if (values.length) return values.slice(0, 3).map(quoteExample).join(" | ");
  } catch (_) {}
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return quoteExample("Dữ liệu mẫu có sẵn");
  return quoteExample(compactTelegramText(raw, 120));
}

function sampleRequestPath(item) {
  const raw = String(item?.link_vi_du || "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw, `${config().baseUrl}/`);
    const query = parsed.search ? parsed.search : "";
    return `${item.duong_dan || parsed.pathname}${query}`;
  } catch (_) {
    return raw;
  }
}

async function requestItem(item, input, sample = false) {
  const { baseUrl } = config();
  const rawPath = sample ? sampleRequestPath(item) : (input === undefined ? item.link_vi_du : makeInputPath(item, input));
  if (!rawPath || /\{[^}]+\}/.test(rawPath)) throw new Error("Endpoint này cần tham số riêng.");
  const url = new URL(rawPath, `${baseUrl}/`);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : { ket_qua: text }; } catch (_) { payload = { ket_qua: text }; }
  return { payload, status: response.status };
}

async function sendHtmlChunks(chatId, lines, keyboard) {
  await removePrevious(chatId);
  const chunks = [];
  let current = "";
  lines.forEach((line) => {
    if (current && (current + line + "\n").length > 3500) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${line}\n`;
  });
  if (current.trim()) chunks.push(current.trim());
  const messageIds = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const suffix = chunks.length > 1 ? `\n\n<i>Phần ${index + 1}/${chunks.length}</i>` : "";
    const result = await telegram("sendMessage", {
      chat_id: chatId,
      text: `${chunks[index]}${suffix}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(index === chunks.length - 1 && keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
    });
    messageIds.push(result.message_id);
  }
  sentMessages.set(String(chatId), messageIds);
  await setBotMessageId(chatId, messageIds);
}

async function showDetail(chatId, group, index) {
  if (!await requireSession(chatId)) return;
  const items = await getCatalog();
  const item = itemAt(items, group, index);
  if (!item) return send(chatId, panel("⚠️", "KHÔNG TÌM THẤY ENDPOINT", "Endpoint này không còn trong danh sách hiện tại."), [[{ text: "🏠 MENU CHÍNH", callback_data: "home" }]]);
  const buttons = [[{ text: "✏️ NHẬP DỮ LIỆU", callback_data: `api:input:${group}:${index}` }], [{ text: "↩️ QUAY LẠI", callback_data: `group:${group}:0` }]];
  const sample = exampleInput(item);
  const lines = [
    "━━━━━━━━━━━━━━━━━━━━",
    `✨ <b>${escapeHtml(item.ten_api || "Endpoint")}</b>`,
    "━━━━━━━━━━━━━━━━━━━━",
    `📝 <b>Chú thích</b>\n${escapeHtml(redactApiUrls(item.mo_ta || "Tra cứu dữ liệu từ Zhee API."))}`,
    "",
    `🧪 <b>DỮ LIỆU MẪU</b>`,
    `<blockquote>🟢 <code>${escapeHtml(sample)}</code>\n🟢 Kết quả mẫu được hiển thị ngay bên dưới.</blockquote>`,
    "",
    "⚙️ <b>CÁCH DÙNG</b>",
    "1️⃣ Nhấn <b>Nhập dữ liệu</b> để dùng giá trị riêng.",
    "2️⃣ Dán UID, username, URL hoặc tham số cần tra cứu.",
    "3️⃣ Bot trả kết quả đã định dạng và file JSON đầy đủ.",
    "",
    "📊 <b>KẾT QUẢ MẪU</b>"
  ];
  if (item.link_vi_du && !hasPlaceholder(item)) {
    try {
      const result = await requestItem(item, undefined, true);
      lines.push(...quoteDetailLines(samplePreviewLines(result.payload, item), 2300));
    } catch (error) {
      lines.push(`<blockquote>⚠️ ${escapeHtml(redactApiUrls(error.message || "Không thể tải kết quả mẫu."))}</blockquote>`);
    }
  } else {
    lines.push("<blockquote>📝 Endpoint này cần dữ liệu riêng nên chưa có kết quả mẫu cố định.</blockquote>");
  }
  lines.push("", "━━━━━━━━━━━━━━━━━━━━");
  await sendHtmlChunks(chatId, lines, buttons);
}

const FIELD_LABELS = {
  trang_thai: "Trạng thái",
  thong_tin_ca_nhan: "Thông tin cá nhân",
  thong_tin: "Thông tin",
  id: "ID",
  tai_khoan: "Tài khoản",
  username: "Tên tài khoản",
  ho_ten: "Họ tên",
  ten_hien_thi: "Tên hiển thị",
  anh_dai_dien: "Ảnh đại diện",
  link_trang_ca_nhan: "Trang cá nhân",
  tieu_su: "Tiểu sử",
  cong_ty: "Công ty",
  trang_web: "Trang web",
  dia_chi: "Địa chỉ",
  email: "Email",
  tong_so_repo: "Tổng số repository",
  nguoi_theo_doi: "Người theo dõi",
  dang_theo_doi: "Đang theo dõi",
  tong_luot_thich: "Tổng lượt thích",
  tong_luot_xem: "Tổng lượt xem",
  so_video: "Tổng số video",
  tich_xanh: "Tích xanh",
  tai_khoan_rieng_tu: "Tài khoản riêng tư",
  ngay_tao_tai_khoan: "Ngày tạo tài khoản",
  ngay_cap_nhat_lan_cuoi: "Cập nhật lần cuối",
  Nickname: "Nickname",
  Region: "Khu vực",
  Uid: "UID",
  ip: "Địa chỉ IP",
  type: "Loại IP",
  country_name: "Quốc gia",
  region_name: "Tỉnh / khu vực",
  city: "Thành phố",
  latitude: "Vĩ độ",
  longitude: "Kinh độ",
  continent_name: "Châu lục",
  current_time: "Thời gian hiện tại",
  isp: "Nhà cung cấp mạng",
  asn: "ASN",
  action: "Tác vụ",
  cap_nhat: "Cập nhật dữ liệu",
  thoi_gian_utc: "Thời gian UTC",
  ngay_utc: "Ngày UTC",
  cache_hit: "Cache hit",
  nguon: "Nguồn dữ liệu",
  tac_gia: "Tác giả"
};

function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return String(key).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (char) => char.toUpperCase());
}

const DETAIL_SECTIONS = [
  { title: "👤 THÔNG TIN CƠ BẢN", test: /user|profile|account|tai_khoan|thong_tin_ca_nhan|ho_ten|username|nickname|name|uid|id/i },
  { title: "📊 THỐNG KÊ", test: /count|total|tong|follower|following|like|view|repo|video|stat|number/i },
  { title: "🔐 TRẠNG THÁI", test: /verified|private|public|active|status|trang_thai|xac_minh|tich_xanh|enabled|success/i },
  { title: "🔗 LIÊN KẾT & LIÊN HỆ", test: /url|link|website|email|avatar|image|photo|anh|trang_web|trang_ca_nhan/i },
  { title: "📍 VỊ TRÍ & THỜI GIAN", test: /country|region|city|address|location|latitude|longitude|timezone|time|date|ngay|thoi_gian|dia_chi/i },
  { title: "⚙️ THÔNG TIN KHÁC", test: /.*/ }
];

function sectionForKey(key) {
  const normalized = String(key);
  if (/private|public|active|verified|xac_minh|tich_xanh|trang_thai|enabled|success|tai_khoan_rieng_tu/i.test(normalized)) {
    return DETAIL_SECTIONS.find((section) => section.title.includes("TRẠNG THÁI"));
  }
  if (/ngay|date|time|timezone|thoi_gian|latitude|longitude|country|region|city|address|location|dia_chi/i.test(normalized)) {
    return DETAIL_SECTIONS.find((section) => section.title.includes("VỊ TRÍ"));
  }
  if (/count|total|tong|follower|following|theo_doi|like|luot_thich|view|luot_xem|repo|video|stat|number|so_/i.test(normalized)) {
    return DETAIL_SECTIONS.find((section) => section.title.includes("THỐNG KÊ"));
  }
  return DETAIL_SECTIONS.find((section) => section.test.test(normalized)) || DETAIL_SECTIONS[DETAIL_SECTIONS.length - 1];
}

function renderTelegramDetails(value, depth = 0, state = { length: 0 }, nested = false) {
  if (state.length > 3300) return "<i>Phần dữ liệu còn lại nằm trong file JSON đính kèm.</i>";
  if (value === null || value === undefined || value === "") return "<i>Không có dữ liệu</i>";
  if (typeof value !== "object") return formatTelegramValue(value);
  if (Array.isArray(value)) {
    if (!value.length) return "<i>Danh sách trống</i>";
    const lines = [`<b>Danh sách: ${value.length} mục</b>`];
    value.forEach((item, index) => {
      if (state.length > 3300) return;
      const rendered = typeof item === "object"
        ? renderTelegramDetails(item, depth + 1, state, true)
        : formatTelegramValue(item, String(index));
      lines.push(`<b>${index + 1}.</b> ${rendered}`);
    });
    return lines.join("\n");
  }

  if (nested) {
    return Object.entries(value).map(([key, item]) => {
      const label = escapeHtml(fieldLabel(key));
      const rendered = item && typeof item === "object"
        ? `\n${renderTelegramDetails(item, depth + 1, state, true)}`
        : formatTelegramValue(item, key);
      return `├ <b>${label}:</b> ${rendered}`;
    }).join("\n");
  }

  const buckets = new Map(DETAIL_SECTIONS.map((section) => [section.title, []]));
  Object.entries(value).forEach(([key, item]) => buckets.get(sectionForKey(key).title).push([key, item]));
  const lines = [];
  for (const section of DETAIL_SECTIONS) {
    const fields = buckets.get(section.title);
    if (!fields?.length || state.length > 3300) continue;
    lines.push("", `<b>${section.title}</b>`);
    fields.forEach(([key, item]) => {
      if (state.length > 3300) return;
      const label = escapeHtml(fieldLabel(key));
      const rendered = item && typeof item === "object"
        ? `\n${renderTelegramDetails(item, depth + 1, state, true)}`
        : formatTelegramValue(item, key);
      const line = `├ <b>${label}:</b> ${rendered}`;
      state.length += line.length;
      lines.push(line);
    });
  }
  return lines.join("\n").replace(/^\n+/, "");
}

function summary(item, payload, status) {
  const title = String(item.ten_api || "Kết quả API");
  if (status >= 400 || payload?.trang_thai === "that_bai") {
    return `<b>CHÚ THÍCH: ${escapeHtml(title)}</b>\n\n${escapeHtml(item.mo_ta || "Kết quả xử lý API.")}\n\n<b>Trạng thái:</b> thất bại\n<b>Lý do:</b> ${escapeHtml(payload?.thong_bao || `HTTP ${status}`)}\n\nFile JSON lỗi đầy đủ được đính kèm.`;
  }
  return `<b>CHÚ THÍCH: ${escapeHtml(title)}</b>\n\n${escapeHtml(item.mo_ta || "Kết quả xử lý API.")}\n\n<b>HTTP:</b> ${status}\n<b>THÔNG TIN ĐẦY ĐỦ</b>\n${renderTelegramDetails(payload)}\n\nFile JSON nguyên vẹn được đính kèm bên dưới.`;
}

async function executeItem(chatId, item, input) {
  try {
    const result = await requestItem(item, input);
    await sendJsonFile(chatId, "zhee_api_result.json", item, result.payload, result.status, [[{ text: "↩️ QUAY LẠI DANH MỤC", callback_data: `group:${groupFor(item)}:0` }, { text: "🏠 MENU CHÍNH", callback_data: "home" }]]);
  } catch (error) {
    await send(chatId, panel("⚠️", "THIẾU DỮ LIỆU", escapeHtml(redactApiUrls(error.message || "Endpoint này cần tham số riêng."))), [[{ text: "↩️ QUAY LẠI", callback_data: "home" }]]);
  }
}

async function adminMenu(chatId) {
  if (!isAdmin(chatId)) return send(chatId, panel("⛔", "KHÔNG CÓ QUYỀN", "Khu vực này chỉ dành cho quản trị viên."));
  await send(chatId, panel("🛡️", "KHU VỰC ADMIN", `💾 Redis: ${hasRedis() ? "✅ Đã cấu hình" : "⚠️ Chưa cấu hình"}\n\n👇 Chọn thao tác quản trị:`), [
    [{ text: "🔑 TẠO KEY 1 GIỜ", callback_data: "admin:create:1" }, { text: "🔑 TẠO KEY 6 GIỜ", callback_data: "admin:create:6" }],
    [{ text: "🔑 TẠO KEY 24 GIỜ", callback_data: "admin:create:24" }, { text: "🔑 TẠO KEY 7 NGÀY", callback_data: "admin:create:168" }],
    [{ text: "📋 DANH SÁCH KEY", callback_data: "admin:list" }, { text: "🗑️ THU HỒI KEY", callback_data: "admin:revoke" }],
    [{ text: "🎬 VIDEO VIP", callback_data: "admin:video" }, { text: "🏠 MENU CHÍNH", callback_data: "home" }]
  ]);
}

async function handleAdmin(chatId, action) {
  if (!isAdmin(chatId)) return send(chatId, "Bạn không có quyền Admin.");
  if (action.startsWith("create:")) {
    const hours = Number(action.split(":")[1]);
    const license = await createLicense(hours, `Telegram admin ${chatId}`);
    return send(chatId, panel("✅", "KEY ĐÃ ĐƯỢC TẠO", `🔑 License:\n<code>${license.key}</code>\n\n⏱️ Thời hạn: <b>${hours} giờ</b>\n📅 Hết hạn: <code>${escapeHtml(license.expires_at)}</code>`), [[{ text: "↩️ QUAY LẠI ADMIN", callback_data: "admin:menu" }]]);
  }
  if (action === "list") {
    const items = await listLicenses();
    const text = items.length ? items.slice(0, 20).map((item, i) => `${i + 1}. 🔑 <code>${escapeHtml(item.key || item.masked)}</code> · ${escapeHtml(item.status)} · ⏱️ ${escapeHtml(item.expires_at)}`).join("\n") : "Chưa có license.";
    return send(chatId, panel("📋", "DANH SÁCH KEY GẦN ĐÂY", text || "<i>Chưa có license.</i>"), [[{ text: "↩️ QUAY LẠI ADMIN", callback_data: "admin:menu" }]]);
  }
  if (action === "revoke") {
    await writePending(chatId, "revoke");
    return send(chatId, panel("🗑️", "THU HỒI LICENSE", "Dán license cần thu hồi vào tin nhắn tiếp theo."), [[{ text: "✖️ HỦY", callback_data: "admin:menu" }]]);
  }
  if (action === "video") return send(chatId, panel("🎬", "VIDEO VIP", "Khu vực Video VIP chỉ dành cho Admin."), [[{ text: "▶️ MỞ VIDEO VIP", url: `${config().baseUrl}/video.html` }], [{ text: "↩️ QUAY LẠI ADMIN", callback_data: "admin:menu" }]]);
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  const text = String(message.text || "").trim();
  await deleteMessage(chatId, message.message_id);
  if (text === "/start" || text === "/menu") return send(chatId, panel("🚀", "ZHEE API BOT", "📡 Truy cập toàn bộ API bằng giao diện button.\n\n🔐 Phiên license có hiệu lực 1 giờ.\n👇 Chọn một nhóm chức năng để bắt đầu."), mainKeyboard(isAdmin(chatId)));
  if (text === "/admin") return adminMenu(chatId);
  const pendingAction = await readPending(chatId);
  if (pendingAction?.startsWith("api:")) {
    const [, group, index] = pendingAction.split(":");
    await clearPending(chatId);
    const item = itemAt(await getCatalog(), group, index);
    if (item) {
      try {
        return await executeItem(chatId, item, text);
      } catch (error) {
        return send(chatId, panel("❌", "KHÔNG THỂ LẤY DỮ LIỆU", `⚠️ ${escapeHtml(redactApiUrls(error.message || "Endpoint đang tạm thời không phản hồi."))}\n\n💡 Vui lòng thử lại sau hoặc kiểm tra dữ liệu đã nhập.`), [[{ text: "↩️ QUAY LẠI ENDPOINT", callback_data: `api:detail:${group}:${index}` }, { text: "🏠 MENU CHÍNH", callback_data: "home" }]]);
      }
    }
  }
  if (pendingAction === "revoke") {
    await clearPending(chatId);
    await revokeLicense(text);
    return send(chatId, panel("✅", "ĐÃ XỬ LÝ", "Yêu cầu thu hồi license đã được tiếp nhận."), [[{ text: "↩️ QUAY LẠI ADMIN", callback_data: "admin:menu" }]]);
  }
  if (/^LICESEN-/i.test(text) || pendingAction === "activate") {
    await clearPending(chatId);
    const result = await activateLicense(chatId, text);
    return send(chatId, result.valid ? panel("✅", "KÍCH HOẠT THÀNH CÔNG", `🔐 Phiên sử dụng có hiệu lực đến:\n<code>${escapeHtml(result.session_expires_at)}</code>`) : panel("❌", "KÍCH HOẠT THẤT BẠI", `⚠️ ${escapeHtml(result.reason)}`), mainKeyboard(isAdmin(chatId)));
  }
  return send(chatId, panel("ℹ️", "CHỌN CHỨC NĂNG", "Vui lòng chọn một mục từ menu bên dưới."), mainKeyboard(isAdmin(chatId)));
}

async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const data = String(callback.data || "");
  await answerCallback(callback.id);
  if (!chatId) return;
  if (callback.message?.message_id) await deleteMessage(chatId, callback.message.message_id);
  if (data === "noop") return;
  if (data === "home") return send(chatId, panel("🚀", "ZHEE API BOT", "👇 Chọn chức năng bên dưới để tiếp tục."), mainKeyboard(isAdmin(chatId)));
  if (data === "license:help") {
    await writePending(chatId, "activate");
    return send(chatId, panel("🔑", "KÍCH HOẠT LICENSE", "📝 Dán license key vào tin nhắn tiếp theo.\n✅ Không cần nhập lệnh.\n\n📌 Dạng key:\n<code>LICESEN-XXX-XXXX-XXXX-XXX-XXXXXXXX</code>"));
  }
  if (data === "help") return send(chatId, panel("❔", "HƯỚNG DẪN SỬ DỤNG", "1️⃣ Nhấn <b>Kích hoạt license</b>.\n2️⃣ Dán license key được cấp.\n3️⃣ Chọn một nhóm API.\n4️⃣ Chọn endpoint cần dùng.\n5️⃣ Nhập dữ liệu hoặc chạy mẫu.\n6️⃣ Nhận kết quả đẹp và file JSON đầy đủ.\n\n⏱️ Mỗi phiên có hiệu lực 1 giờ."), mainKeyboard(isAdmin(chatId)));
  if (data.startsWith("group:")) { const [, group, page] = data.split(":"); return showGroup(chatId, group, page); }
  if (data.startsWith("api:detail:")) { const [, , group, index] = data.split(":"); return showDetail(chatId, group, index); }
  if (data.startsWith("api:input:")) {
    const [, , group, index] = data.split(":");
    const item = itemAt(await getCatalog(), group, index);
    await writePending(chatId, `api:${group}:${index}`);
    return send(chatId, panel("✏️", "NHẬP DỮ LIỆU", `✨ <b>${escapeHtml(item?.ten_api || "Endpoint")}</b>\n\n📝 Dán một giá trị hoặc nhiều tham số vào tin nhắn tiếp theo.\n\n📌 Một giá trị:\n<blockquote><code>86744126</code></blockquote>\n📌 Nhiều giá trị:\n<blockquote><code>action=random&amp;key=YOUR_KEY</code></blockquote>\n📌 Dạng JSON:\n<blockquote><code>{"action":"random","key":"YOUR_KEY"}</code></blockquote>\n\n${inputHint(item)}\n\n💡 Kết quả sẽ được format và gửi kèm file JSON đầy đủ.`), [[{ text: "✖️ HỦY", callback_data: `group:${group}:0` }]]);
  }
  if (data.startsWith("api:run:")) {
    const [, , group, index] = data.split(":");
    const item = itemAt(await getCatalog(), group, index);
    if (item) return executeItem(chatId, item);
  }
  if (data === "admin:menu") return adminMenu(chatId);
  if (data.startsWith("admin:")) return handleAdmin(chatId, data.slice(6));
}

module.exports = async function telegramBotHandler(req, res) {
  const { token } = config();
  if (!token) return res.status(503).json({ trang_thai: "that_bai", thong_bao: "Thiếu TELEGRAM_BOT_TOKEN.", tac_gia: AUTHOR });
  try {
    const update = req.body || (req.rawBody ? JSON.parse(req.rawBody) : null);
    if (update?.callback_query) await handleCallback(update.callback_query);
    else if (update?.message) await handleMessage(update.message);
    return res.status(200).json({ trang_thai: "thanh_cong", da_xu_ly: true, tac_gia: AUTHOR });
  } catch (error) {
    return res.status(500).json({ trang_thai: "that_bai", thong_bao: error.message, tac_gia: AUTHOR });
  }
};
