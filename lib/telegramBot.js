const { hasRedis, createLicense, activateLicense, verifySession, revokeLicense, listLicenses, getBotMessageId, setBotMessageId } = require("./licenseStore");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const pending = new Map();
const sentMessages = new Map();
const catalogCache = { expiresAt: 0, items: [] };

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

async function telegram(method, body) {
  const { token } = config();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram HTTP ${response.status}.`);
  return payload.result;
}

async function deleteMessage(chatId, messageId) {
  if (!messageId) return;
  try { await telegram("deleteMessage", { chat_id: chatId, message_id: messageId }); } catch (_) {}
}

async function removePrevious(chatId) {
  const previous = sentMessages.get(String(chatId)) || await getBotMessageId(chatId);
  if (previous) await deleteMessage(chatId, previous);
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
  sentMessages.set(String(chatId), result.message_id);
  await setBotMessageId(chatId, result.message_id);
  return result;
}

async function sendJsonFile(chatId, filename, payload, caption, keyboard) {
  await removePrevious(chatId);
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption.slice(0, 1024));
  form.append("parse_mode", "HTML");
  form.append("document", new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), filename);
  if (keyboard) form.append("reply_markup", JSON.stringify({ inline_keyboard: keyboard }));
  const { token } = config();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form, signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram HTTP ${response.status}.`);
  sentMessages.set(String(chatId), result.result.message_id);
  await setBotMessageId(chatId, result.result.message_id);
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

function mainKeyboard(admin) {
  const rows = [
    [{ text: "KÍCH HOẠT LICENSE", callback_data: "license:help" }],
    [{ text: "MẠNG XÃ HỘI", callback_data: "group:mxh:0" }, { text: "TOOLS", callback_data: "group:tools:0" }],
    [{ text: "TÀI XỈU", callback_data: "group:taixiu:0" }, { text: "NGÂN HÀNG", callback_data: "group:bank:0" }],
    [{ text: "DOWNLOADS", callback_data: "group:downloads:0" }, { text: "MAIL", callback_data: "group:mail:0" }],
    [{ text: "WEB", callback_data: "group:web:0" }, { text: "HƯỚNG DẪN", callback_data: "help" }]
  ];
  if (admin) rows.push([{ text: "ADMIN", callback_data: "admin:menu" }, { text: "VIDEO VIP", callback_data: "admin:video" }]);
  return rows;
}

async function requireSession(chatId) {
  const result = await verifySession(chatId);
  if (!result.valid) {
    await send(chatId, `<b>LICENSE CẦN ĐƯỢC KÍCH HOẠT</b>\n\n${escapeHtml(result.reason)}\n\nNhấn nút bên dưới rồi dán key.`, [[{ text: "DÁN LICENSE KEY", callback_data: "license:help" }]]);
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
  const rows = selected.map((item, index) => [{ text: `${current * size + index + 1}  ${String(item.ten_api || item.duong_dan).slice(0, 42)}`, callback_data: `api:detail:${group}:${current * size + index}` }]);
  rows.push([
    ...(current ? [{ text: "TRƯỚC", callback_data: `group:${group}:${current - 1}` }] : []),
    { text: `${current + 1}/${pages}`, callback_data: "noop" },
    ...(current < pages - 1 ? [{ text: "SAU", callback_data: `group:${group}:${current + 1}` }] : [])
  ]);
  rows.push([{ text: "MENU CHÍNH", callback_data: "home" }]);
  await send(chatId, `<b>${info.title}</b>\n${info.description}\n\nChọn một chức năng để xem dữ liệu.\nTrang <b>${current + 1}/${pages}</b> · ${items.length} mục`, rows);
}

function itemAt(items, group, index) {
  return items.filter((item) => groupFor(item) === group)[Number(index)];
}

function hasPlaceholder(item) { return /\{[^}]+\}/.test(String(item?.link_vi_du || "")); }

function makeInputPath(item, value) {
  const example = String(item.link_vi_du || "");
  if (/\/nasa/i.test(item.duong_dan) && /^(?:action|type)=/i.test(String(value).trim())) {
    return `${item.duong_dan}?${String(value).trim().replace(/^\?/, "")}`;
  }
  if (example.includes("{")) return example.replace(/\{[^}]+\}/, encodeURIComponent(value));
  return `${item.duong_dan}?=${encodeURIComponent(value)}`;
}

async function showDetail(chatId, group, index) {
  if (!await requireSession(chatId)) return;
  const items = await getCatalog();
  const item = itemAt(items, group, index);
  if (!item) return send(chatId, "Không tìm thấy chức năng.", [[{ text: "MENU CHÍNH", callback_data: "home" }]]);
  const buttons = [[{ text: "NHẬP DỮ LIỆU", callback_data: `api:input:${group}:${index}` }]];
  if (item.link_vi_du && !hasPlaceholder(item)) buttons.push([{ text: "LẤY DỮ LIỆU MẪU", callback_data: `api:run:${group}:${index}` }]);
  buttons.push([{ text: "QUAY LẠI", callback_data: `group:${group}:0` }]);
  await send(chatId, `<b>${escapeHtml(item.ten_api)}</b>\n\n${escapeHtml(item.mo_ta || "Tra cứu dữ liệu từ Zhee API.")}\n\nChọn thao tác bên dưới. Bạn có thể dán tham số để tra cứu hoặc lấy dữ liệu mẫu. Kết quả sẽ được gửi thành file JSON.`, buttons);
}

function summary(item, payload, status) {
  const title = String(item.ten_api || "Kết quả API");
  if (status >= 400 || payload?.trang_thai === "that_bai") return `<b>${escapeHtml(title)}</b>\n\n<b>Trạng thái:</b> thất bại\n<b>Lý do:</b> ${escapeHtml(payload?.thong_bao || `HTTP ${status}`)}`;
  const rows = [];
  if (payload?.ip) rows.push(`<b>IP:</b> <code>${escapeHtml(payload.ip)}</code>`);
  if (payload?.Nickname) rows.push(`<b>Nickname:</b> ${escapeHtml(payload.Nickname)}`);
  if (payload?.Region) rows.push(`<b>Region:</b> ${escapeHtml(payload.Region)}`);
  if (payload?.country_name) rows.push(`<b>Quốc gia:</b> ${escapeHtml(payload.country_name)}`);
  if (payload?.city) rows.push(`<b>Thành phố:</b> ${escapeHtml(payload.city)}`);
  if (payload?.action) rows.push(`<b>Action:</b> ${escapeHtml(payload.action)}`);
  rows.push(`<b>Trạng thái:</b> thành công`, `<b>HTTP:</b> ${status}`);
  return `<b>${escapeHtml(title)}</b>\n\n${rows.join("\n")}\n\nFile JSON đầy đủ được đính kèm bên dưới.`;
}

async function executeItem(chatId, item, input) {
  const { baseUrl } = config();
  const rawPath = input === undefined ? item.link_vi_du : makeInputPath(item, input);
  if (!rawPath || /\{[^}]+\}/.test(rawPath)) return send(chatId, "Chức năng này cần tham số riêng. Hãy dán giá trị cần tra cứu.", [[{ text: "QUAY LẠI", callback_data: "home" }]]);
  const url = new URL(rawPath, `${baseUrl}/`);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : { ket_qua: text }; } catch (_) { payload = { ket_qua: text }; }
  const safeName = String(item.duong_dan || "api").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "api";
  await sendJsonFile(chatId, `${safeName}_result.json`, payload, summary(item, payload, response.status), [[{ text: "QUAY LẠI DANH MỤC", callback_data: `group:${groupFor(item)}:0` }, { text: "MENU CHÍNH", callback_data: "home" }]]);
}

async function adminMenu(chatId) {
  if (!isAdmin(chatId)) return send(chatId, "Bạn không có quyền Admin.");
  await send(chatId, `<b>KHU VỰC ADMIN</b>\n\nRedis: ${hasRedis() ? "đã cấu hình" : "chưa cấu hình"}\nChọn thao tác:`, [
    [{ text: "TẠO KEY 1 GIỜ", callback_data: "admin:create:1" }, { text: "TẠO KEY 6 GIỜ", callback_data: "admin:create:6" }],
    [{ text: "TẠO KEY 24 GIỜ", callback_data: "admin:create:24" }, { text: "TẠO KEY 7 NGÀY", callback_data: "admin:create:168" }],
    [{ text: "DANH SÁCH KEY", callback_data: "admin:list" }, { text: "THU HỒI KEY", callback_data: "admin:revoke" }],
    [{ text: "VIDEO VIP", callback_data: "admin:video" }, { text: "MENU CHÍNH", callback_data: "home" }]
  ]);
}

async function handleAdmin(chatId, action) {
  if (!isAdmin(chatId)) return send(chatId, "Bạn không có quyền Admin.");
  if (action.startsWith("create:")) {
    const hours = Number(action.split(":")[1]);
    const license = await createLicense(hours, `Telegram admin ${chatId}`);
    return send(chatId, `<b>KEY ĐÃ ĐƯỢC TẠO</b>\n\n<code>${license.key}</code>\nThời hạn: <b>${hours} giờ</b>\nHết hạn: <code>${escapeHtml(license.expires_at)}</code>`, [[{ text: "QUAY LẠI ADMIN", callback_data: "admin:menu" }]]);
  }
  if (action === "list") {
    const items = await listLicenses();
    const text = items.length ? items.slice(0, 20).map((item, i) => `${i + 1}. <code>${escapeHtml(item.masked)}</code> · ${escapeHtml(item.status)} · ${escapeHtml(item.expires_at)}`).join("\n") : "Chưa có license.";
    return send(chatId, `<b>DANH SÁCH KEY GẦN ĐÂY</b>\n\n${text}`, [[{ text: "QUAY LẠI ADMIN", callback_data: "admin:menu" }]]);
  }
  if (action === "revoke") {
    pending.set(String(chatId), "revoke");
    return send(chatId, "<b>THU HỒI LICENSE</b>\n\nDán license cần thu hồi vào tin nhắn tiếp theo.", [[{ text: "HỦY", callback_data: "admin:menu" }]]);
  }
  if (action === "video") return send(chatId, "<b>VIDEO VIP</b>\n\nKhu vực Video VIP chỉ dành cho Admin.", [[{ text: "MỞ VIDEO VIP", url: `${config().baseUrl}/video.html` }], [{ text: "QUAY LẠI ADMIN", callback_data: "admin:menu" }]]);
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  const text = String(message.text || "").trim();
  await deleteMessage(chatId, message.message_id);
  if (text === "/start" || text === "/menu") return send(chatId, `<b>ZHEE API BOT</b>\n\nTruy cập toàn bộ API bằng giao diện button.\nPhiên license có hiệu lực 1 giờ.`, mainKeyboard(isAdmin(chatId)));
  if (text === "/admin") return adminMenu(chatId);
  if (pending.get(String(chatId))?.startsWith("api:")) {
    const [, group, index] = pending.get(String(chatId)).split(":");
    pending.delete(String(chatId));
    const item = itemAt(await getCatalog(), group, index);
    if (item) return executeItem(chatId, item, text);
  }
  if (pending.get(String(chatId)) === "revoke") {
    pending.delete(String(chatId));
    await revokeLicense(text);
    return send(chatId, "Đã xử lý yêu cầu thu hồi license.", [[{ text: "QUAY LẠI ADMIN", callback_data: "admin:menu" }]]);
  }
  if (/^LICESEN-/i.test(text) || pending.get(String(chatId)) === "activate") {
    pending.delete(String(chatId));
    const result = await activateLicense(chatId, text);
    return send(chatId, result.valid ? `<b>KÍCH HOẠT THÀNH CÔNG</b>\n\nPhiên sử dụng có hiệu lực đến:\n<code>${escapeHtml(result.session_expires_at)}</code>` : `<b>KÍCH HOẠT THẤT BẠI</b>\n\n${escapeHtml(result.reason)}`, mainKeyboard(isAdmin(chatId)));
  }
  return send(chatId, "Chọn chức năng từ menu.", mainKeyboard(isAdmin(chatId)));
}

async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const data = String(callback.data || "");
  await answerCallback(callback.id);
  if (!chatId) return;
  if (callback.message?.message_id) await deleteMessage(chatId, callback.message.message_id);
  if (data === "noop") return;
  if (data === "home") return send(chatId, `<b>ZHEE API BOT</b>\n\nChọn chức năng bên dưới.`, mainKeyboard(isAdmin(chatId)));
  if (data === "license:help") {
    pending.set(String(chatId), "activate");
    return send(chatId, `<b>KÍCH HOẠT LICENSE</b>\n\nDán license key vào tin nhắn tiếp theo. Không cần nhập lệnh.\n\nDạng key:\n<code>LICESEN-XXX-XXXX-XXXX-XXX-XXXXXXXX</code>`);
  }
  if (data === "help") return send(chatId, `<b>HƯỚNG DẪN</b>\n\n1. Nhấn nút kích hoạt.\n2. Dán license key được cấp.\n3. Chọn một nhóm API.\n4. Chọn endpoint và lấy kết quả.\n5. Kết quả được gửi thành file JSON.\n6. Mỗi phiên có hiệu lực 1 giờ.`, mainKeyboard(isAdmin(chatId)));
  if (data.startsWith("group:")) { const [, group, page] = data.split(":"); return showGroup(chatId, group, page); }
  if (data.startsWith("api:detail:")) { const [, , group, index] = data.split(":"); return showDetail(chatId, group, index); }
  if (data.startsWith("api:input:")) {
    const [, , group, index] = data.split(":");
    pending.set(String(chatId), `api:${group}:${index}`);
    return send(chatId, "<b>NHẬP DỮ LIỆU</b>\n\nDán giá trị cần tra cứu vào tin nhắn tiếp theo.", [[{ text: "HỦY", callback_data: `group:${group}:0` }]]);
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
