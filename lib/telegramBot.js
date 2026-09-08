const {
  hasRedis,
  createLicense,
  activateLicense,
  verifySession,
  revokeLicense,
  listLicenses
} = require("./licenseStore");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const pending = new Map();
const sentMessages = new Map();

function config() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    admins: String(process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((id) => id.trim()).filter(Boolean),
    baseUrl: String(process.env.PUBLIC_BASE_URL || "https://api-zhee.vercel.app").replace(/\/$/, "")
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function isAdmin(chatId) {
  return config().admins.includes(String(chatId));
}

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

async function removePreviousBotMessage(chatId) {
  const previousId = sentMessages.get(String(chatId));
  if (previousId) await deleteMessage(chatId, previousId);
}

async function send(chatId, text, keyboard) {
  await removePreviousBotMessage(chatId);
  const result = await telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
  });
  sentMessages.set(String(chatId), result.message_id);
  return result;
}

async function answerCallback(id) {
  try { await telegram("answerCallbackQuery", { callback_query_id: id }); } catch (_) {}
}

async function getCatalog() {
  const { baseUrl } = config();
  const response = await fetch(`${baseUrl}/list`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Gateway HTTP ${response.status}.`);
  const payload = await response.json();
  return Object.values(payload.danh_sach || {});
}

async function callApi(path) {
  const { baseUrl } = config();
  const url = new URL(path, `${baseUrl}/`);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  return { status: response.status, text };
}

function mainKeyboard(admin) {
  const rows = [
    [{ text: "Kích hoạt license", callback_data: "license:help" }],
    [{ text: "Khám phá API", callback_data: "api:0" }, { text: "Hướng dẫn", callback_data: "help" }]
  ];
  if (admin) rows.push([{ text: "Khu vực Admin", callback_data: "admin:menu" }]);
  return rows;
}

async function requireSession(chatId) {
  const result = await verifySession(chatId);
  if (!result.valid) {
    await send(chatId, `<b>Cần kích hoạt license</b>\n\n${escapeHtml(result.reason)}\n\nGửi:\n<code>/activate LICESEN-XXX-XXXX-XXXX-XXX-XXXXXXXX</code>`, [[{ text: "Nhập license", callback_data: "license:help" }]]);
    return false;
  }
  return true;
}

async function showApis(chatId, page = 0) {
  if (!await requireSession(chatId)) return;
  const catalog = await getCatalog();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(catalog.length / pageSize));
  const current = Math.min(totalPages - 1, Math.max(0, Number(page) || 0));
  const items = catalog.slice(current * pageSize, current * pageSize + pageSize);
  const rows = items.map((item, index) => [{ text: `${current * pageSize + index + 1}  ${String(item.ten_api || item.duong_dan).slice(0, 44)}`, callback_data: `api:run:${current * pageSize + index}` }]);
  rows.push([
    ...(current > 0 ? [{ text: "Trang trước", callback_data: `api:${current - 1}` }] : []),
    { text: `${current + 1}/${totalPages}`, callback_data: "noop" },
    ...(current < totalPages - 1 ? [{ text: "Trang sau", callback_data: `api:${current + 1}` }] : [])
  ]);
  rows.push([{ text: "Menu chính", callback_data: "home" }]);
  await send(chatId, `<b>KHÁM PHÁ ZHEE API</b>\n\nChọn một endpoint để xem hướng dẫn và chạy ví dụ.\nTrang <b>${current + 1}/${totalPages}</b> · ${catalog.length} endpoint`, rows);
}

async function showApiDetail(chatId, index) {
  if (!await requireSession(chatId)) return;
  const catalog = await getCatalog();
  const item = catalog[Number(index)];
  if (!item) return send(chatId, "Không tìm thấy endpoint.", mainKeyboard(isAdmin(chatId)));
  const example = item.link_vi_du || `${config().baseUrl}${item.duong_dan}`;
  const buttons = [[{ text: "Chạy ví dụ", callback_data: `api:exec:${index}` }], [{ text: "Quay lại danh sách", callback_data: "api:0" }]];
  await send(chatId, `<b>${escapeHtml(item.ten_api)}</b>\n\n<b>Endpoint:</b> <code>${escapeHtml(item.duong_dan)}</code>\n<b>Mô tả:</b> ${escapeHtml(item.mo_ta)}\n<b>Ví dụ:</b>\n<code>${escapeHtml(example)}</code>`, buttons);
}

async function executeApiExample(chatId, index) {
  if (!await requireSession(chatId)) return;
  const catalog = await getCatalog();
  const item = catalog[Number(index)];
  if (!item) return;
  const example = item.link_vi_du || `${config().baseUrl}${item.duong_dan}`;
  if (/\{[^}]+\}/.test(example)) return send(chatId, "Ví dụ này cần tham số riêng. Hãy mở endpoint trên website để nhập dữ liệu.", [[{ text: "Danh sách API", callback_data: "api:0" }]]);
  const url = new URL(example);
  const result = await callApi(url.pathname + url.search);
  const output = result.text.length > 3500 ? `${result.text.slice(0, 3500)}\n...` : result.text;
  await send(chatId, `<b>HTTP ${result.status}</b>\n<code>${escapeHtml(output)}</code>`, [[{ text: "Danh sách API", callback_data: "api:0" }]]);
}

async function adminMenu(chatId) {
  if (!isAdmin(chatId)) return send(chatId, "Bạn không có quyền Admin.");
  await send(chatId, `<b>KHU VỰC ADMIN</b>\n\nRedis: ${hasRedis() ? "đã cấu hình" : "chưa cấu hình"}\nChọn thao tác bên dưới.`, [
    [{ text: "Tạo key 1 giờ", callback_data: "admin:create:1" }, { text: "Tạo key 6 giờ", callback_data: "admin:create:6" }],
    [{ text: "Tạo key 24 giờ", callback_data: "admin:create:24" }, { text: "Tạo key 7 ngày", callback_data: "admin:create:168" }],
    [{ text: "Danh sách key", callback_data: "admin:list" }, { text: "Thu hồi key", callback_data: "admin:revoke" }],
    [{ text: "Menu chính", callback_data: "home" }]
  ]);
}

async function handleAdmin(chatId, action) {
  if (!isAdmin(chatId)) return send(chatId, "Bạn không có quyền Admin.");
  if (action.startsWith("create:")) {
    const hours = Number(action.split(":")[1]);
    const license = await createLicense(hours, `Telegram admin ${chatId}`);
    return send(chatId, `<b>Đã tạo license</b>\n\n<code>${license.key}</code>\nThời hạn: ${hours} giờ\nHết hạn: ${escapeHtml(license.expires_at)}\n\nGửi key này cho user cần kích hoạt.`, [[{ text: "Quay lại Admin", callback_data: "admin:menu" }]]);
  }
  if (action === "list") {
    const items = await listLicenses();
    const text = items.length ? items.slice(0, 20).map((item, i) => `${i + 1}. <code>${escapeHtml(item.masked)}</code> — ${escapeHtml(item.status)} — ${escapeHtml(item.expires_at)}`).join("\n") : "Chưa có license.";
    return send(chatId, `<b>License gần đây</b>\n\n${text}`, [[{ text: "Quay lại Admin", callback_data: "admin:menu" }]]);
  }
  if (action === "revoke") {
    pending.set(String(chatId), "revoke");
    return send(chatId, "<b>THU HỒI LICENSE</b>\n\nDán license cần thu hồi vào tin nhắn tiếp theo.", [[{ text: "Hủy", callback_data: "admin:menu" }]]);
  }
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  const text = String(message.text || "").trim();
  await deleteMessage(chatId, message.message_id);
  if (text === "/start" || text === "/menu") return send(chatId, `<b>ZHEE API BOT</b>\n\nTruy cập toàn bộ API bằng giao diện button.\nPhiên license có hiệu lực 1 giờ.`, mainKeyboard(isAdmin(chatId)));
  if (text === "/admin") return adminMenu(chatId);
  if (text.startsWith("/activate ")) {
    const result = await activateLicense(chatId, text.slice(10).trim());
    return send(chatId, result.valid ? `<b>Kích hoạt thành công</b>\nPhiên sử dụng có hiệu lực đến: ${escapeHtml(result.session_expires_at)}` : `<b>Kích hoạt thất bại</b>\n${escapeHtml(result.reason)}`, mainKeyboard(isAdmin(chatId)));
  }
  if (text.startsWith("/revoke ") && isAdmin(chatId)) {
    await revokeLicense(text.slice(8).trim());
    return send(chatId, "Đã xử lý yêu cầu thu hồi license.", [[{ text: "Quay lại Admin", callback_data: "admin:menu" }]]);
  }
  if (/^LICESEN-/i.test(text) || pending.get(String(chatId)) === "activate") {
    pending.delete(String(chatId));
    const result = await activateLicense(chatId, text);
    return send(chatId, result.valid ? `<b>KÍCH HOẠT THÀNH CÔNG</b>\n\nPhiên sử dụng có hiệu lực đến:\n<code>${escapeHtml(result.session_expires_at)}</code>` : `<b>KÍCH HOẠT THẤT BẠI</b>\n\n${escapeHtml(result.reason)}`, mainKeyboard(isAdmin(chatId)));
  }
  if (pending.get(String(chatId)) === "revoke") {
    pending.delete(String(chatId));
    await revokeLicense(text);
    return send(chatId, "Đã xử lý yêu cầu thu hồi license.", [[{ text: "Quay lại Admin", callback_data: "admin:menu" }]]);
  }
  return send(chatId, "Chọn một chức năng từ menu.", mainKeyboard(isAdmin(chatId)));
}

async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const data = String(callback.data || "");
  await answerCallback(callback.id);
  if (!chatId) return;
  if (data === "noop") return;
  if (callback.message?.message_id) await deleteMessage(chatId, callback.message.message_id);
  if (data === "home") return send(chatId, `<b>ZHEE API BOT</b>\n\nChọn chức năng bên dưới.`, mainKeyboard(isAdmin(chatId)));
  if (data === "license:help") {
    pending.set(String(chatId), "activate");
    return send(chatId, `<b>KÍCH HOẠT LICENSE</b>\n\nDán license key vào tin nhắn tiếp theo. Không cần nhập lệnh.\n\nDạng key:\n<code>LICESEN-XXX-XXXX-XXXX-XXX-XXXXXXXX</code>`);
  }
  if (data === "help") return send(chatId, `<b>HƯỚNG DẪN</b>\n\n1. Nhấn nút kích hoạt.\n2. Dán license key được cấp.\n3. Chọn Khám phá API.\n4. Mỗi phiên có hiệu lực 1 giờ.`, mainKeyboard(isAdmin(chatId)));
  if (data.startsWith("api:run:")) return showApiDetail(chatId, data.split(":")[2]);
  if (data.startsWith("api:exec:")) return executeApiExample(chatId, data.split(":")[2]);
  if (data.startsWith("api:")) return showApis(chatId, data.split(":")[1]);
  if (data === "admin:menu") return adminMenu(chatId);
  if (data.startsWith("admin:")) return handleAdmin(chatId, data.slice(6));
}

module.exports = async function telegramHandler(req, res) {
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
