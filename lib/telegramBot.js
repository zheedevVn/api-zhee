const { getBotMessageId, setBotMessageId } = require("./licenseStore");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const pendingActions = new Map();
const botMessages = new Map();

function config() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    admins: String(process.env.TELEGRAM_ADMIN_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    baseUrl: String(process.env.PUBLIC_BASE_URL || "https://api-zhee.vercel.app").replace(/\/$/, "")
  };
}

function isAdmin(chatId) {
  return config().admins.includes(String(chatId));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[char]));
}

async function telegram(method, body) {
  const { token } = config();
  if (!token) throw new Error("Thiếu TELEGRAM_BOT_TOKEN.");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram HTTP ${response.status}.`);
  return payload.result;
}

async function deleteMessage(chatId, messageId) {
  if (!chatId || !messageId) return;
  try { await telegram("deleteMessage", { chat_id: chatId, message_id: messageId }); } catch (_) {}
}

async function deleteIncoming(chatId, messageId) {
  await deleteMessage(chatId, messageId);
}

async function clearPreviousBotMessages(chatId) {
  const ids = new Set();
  const local = botMessages.get(String(chatId));
  if (local) (Array.isArray(local) ? local : [local]).forEach((id) => ids.add(id));
  try {
    const stored = await getBotMessageId(chatId);
    (Array.isArray(stored) ? stored : [stored]).forEach((id) => ids.add(id));
  } catch (_) {}
  for (const id of ids) await deleteMessage(chatId, id);
  botMessages.delete(String(chatId));
  try { await setBotMessageId(chatId, []); } catch (_) {}
}

async function sendTracked(method, chatId, body) {
  await clearPreviousBotMessages(chatId);
  const result = await telegram(method, { ...body, chat_id: chatId });
  if (result?.message_id) {
    botMessages.set(String(chatId), result.message_id);
    try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
  }
  return result;
}

async function telegramUpload(method, chatId, fields, fileField, fileName, fileUrl) {
  const { token } = config();
  if (!token) throw new Error("Thiếu TELEGRAM_BOT_TOKEN.");
  const source = await fetch(fileUrl, { signal: AbortSignal.timeout(15000) });
  if (!source.ok) throw new Error(`Không tải được ảnh B52: HTTP ${source.status}`);
  const bytes = await source.arrayBuffer();
  const form = new FormData();
  Object.entries({ ...fields, chat_id: String(chatId) }).forEach(([key, value]) => {
    form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  });
  form.append(fileField, new Blob([bytes], { type: source.headers.get("content-type") || "image/svg+xml" }), fileName);
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram HTTP ${response.status}.`);
  return payload.result;
}

function mainKeyboard() {
  const { baseUrl } = config();
  return {
    inline_keyboard: [
      [{ text: "🎲 Tài Xỉu", callback_data: "menu:taixiu" }],
      [
        { text: "🌐 Mở Zhee API", url: baseUrl },
        { text: "📚 Danh sách API", url: `${baseUrl}/list` }
      ],
      [{ text: "💬 Hỗ trợ", url: "https://t.me/zheevipv1" }]
    ]
  };
}

function taixiuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🎯 Cầu B52", callback_data: "taixiu:b52" }],
      [{ text: "↩️ Về menu chính", callback_data: "menu:home" }]
    ]
  };
}

function b52InputKeyboard() {
  return { inline_keyboard: [[{ text: "✖️ Hủy nhập hash", callback_data: "menu:taixiu" }]] };
}

function startText(user) {
  const displayName = escapeHtml(user?.first_name || user?.username || "bạn");
  return `<b>✦ ZHEE API</b>\n<i>Trung tâm API và tiện ích dành cho nhà phát triển</i>\n\n👋 Xin chào, <b>${displayName}</b>!\n\n<b>Bot đang được khởi tạo lại</b>\n<i>Mỗi chức năng sẽ được xây dựng và kiểm tra riêng để menu gọn, dễ dùng và ổn định hơn.</i>\n\n🧩 <b>Trạng thái hiện tại</b>\n• ✨ Giao diện menu mới\n• 🛠️ Đang mở lại từng nhóm chức năng\n• 🚫 Không dùng ký tự phân cách rối mắt\n\n<i>Chọn một nhóm chức năng bên dưới để bắt đầu:</i>`;
}

function taixiuText() {
  return `<b>🎲 TÀI XỈU</b>\n<i>Các công cụ phân tích chuỗi hash theo từng sảnh game</i>\n\n<b>🧰 Công cụ hiện có</b>\n\n🎯 <b>Cầu B52</b>\n<i>Phân tích MD5 Standard, dự đoán cửa, tổng điểm và bộ ba nút.</i>\n🔐 Yêu cầu: chuỗi hash MD5 gồm 32 ký tự hex.`;
}

function b52PromptText() {
  return `<b>🎯 CẦU B52</b>\n<i>B52 Club · Soi cầu phân tích xác suất</i>\n\n🔐 Hãy gửi một chuỗi hash MD5 gồm <b>32 ký tự hex</b>.\n\nVí dụ:\n<code>50e0087bc111acab077a5b3a82f3a612</code>\n\n<i>Bot sẽ lọc kết quả thành dự đoán, tổng điểm, độ tin cậy và chiến thuật.</i>`;
}

function b52ResultText(payload, hash) {
  const data = payload?.du_lieu || {};
  const result = data.ket_qua_cuoi || {};
  const strategy = data.the_cau_va_chien_thuat || {};
  const dice = data.chi_tiet_3_xuc_xac_uoc_tinh || {};
  const diceValue = [dice.xuc_xac_1, dice.xuc_xac_2, dice.xuc_xac_3]
    .map((item) => item?.nut)
    .filter((value) => value !== undefined)
    .join(" • ");
  const baseText = `<b>🎯 KẾT QUẢ CẦU B52</b>\n<i>${escapeHtml(data.sanh_game || "B52 Club")}</i>\n\n🔐 <b>Hash:</b> <code>${escapeHtml(hash)}</code>\n🧮 <b>Chuẩn:</b> ${escapeHtml(data.chuan_ma_bam || "MD5 Standard")}\n\n<b>📊 DỰ ĐOÁN</b>\n🎲 <b>Cửa chính:</b> ${escapeHtml(result.cua_du_doan_chinh || "Chưa có dữ liệu")}\n⚖️ <b>Chẵn lẻ:</b> ${escapeHtml(result.cua_chan_le || "Chưa có dữ liệu")}\n🔢 <b>Tổng điểm:</b> ${escapeHtml(result.tong_diem_du_kien || "Chưa có dữ liệu")}\n🎯 <b>Bộ ba nút:</b> ${escapeHtml(result.bo_ba_nut_uoc_tinh || diceValue || "Chưa có dữ liệu")}\n📈 <b>Độ tin cậy:</b> ${escapeHtml(result.do_tin_cay_thuat_toan || "Chưa có dữ liệu")}\n\n🧠 <b>Thế cầu:</b> ${escapeHtml(strategy.the_cau || "Chưa có dữ liệu")}\n💡 <b>Khuyến nghị:</b> <i>${escapeHtml(strategy.khuyen_nghi || "Chưa có dữ liệu")}</i>`;
  const imageLinks = [];
  if (data.anh_gop_3_xuc_xac) imageLinks.push(`<a href="${escapeHtml(data.anh_gop_3_xuc_xac)}">Ảnh gộp 3 xúc xắc</a>`);
  [dice.xuc_xac_1, dice.xuc_xac_2, dice.xuc_xac_3].forEach((item, index) => {
    if (item?.anh_xuc_xac) imageLinks.push(`<a href="${escapeHtml(item.anh_xuc_xac)}">Ảnh xúc xắc ${index + 1}</a>`);
  });
  return `${baseText}${imageLinks.length ? `\n\n🖼️ <b>Hình ảnh:</b> ${imageLinks.join(" · ")}` : ""}`;
}

async function sendStart(chatId, user) {
  return sendTracked("sendMessage", chatId, {
    text: startText(user),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: mainKeyboard()
  });
}

async function editMenu(chatId, messageId, text, replyMarkup) {
  const result = await telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  });
  botMessages.set(String(chatId), messageId);
  try { await setBotMessageId(chatId, [messageId]); } catch (_) {}
  return result;
}

async function answerCallback(callbackQueryId) {
  try { await telegram("answerCallbackQuery", { callback_query_id: callbackQueryId }); } catch (_) {}
}

async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  const data = String(callback.data || "");
  await answerCallback(callback.id);
  if (!chatId || !messageId) return;

  if (data === "menu:home") {
    pendingActions.delete(String(chatId));
    return editMenu(chatId, messageId, startText(callback.from || callback.message.chat), mainKeyboard());
  }
  if (data === "menu:taixiu") {
    pendingActions.delete(String(chatId));
    return editMenu(chatId, messageId, taixiuText(), taixiuKeyboard());
  }
  if (data === "taixiu:b52") {
    pendingActions.set(String(chatId), "taixiu:b52");
    return editMenu(chatId, messageId, b52PromptText(), b52InputKeyboard());
  }
}

async function sendB52Photo(chatId, photoUrl, caption) {
  await clearPreviousBotMessages(chatId);
  const upload = async (method, field, fileName) => {
    const result = await telegramUpload(
      method,
      chatId,
      { caption, parse_mode: "HTML", reply_markup: taixiuKeyboard() },
      field,
      fileName,
      photoUrl
    );
    if (result?.message_id) {
      botMessages.set(String(chatId), result.message_id);
      try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
    }
    return result;
  };
  try {
    return await upload("sendPhoto", "photo", "b52-3-xuc-xac.png");
  } catch (photoError) {
    try {
      return await upload("sendDocument", "document", "b52-3-xuc-xac.png");
    } catch (documentError) {
      return sendTracked("sendMessage", chatId, {
        text: `${caption}\n\n⚠️ <i>Không thể đính kèm ảnh PNG: ${escapeHtml(documentError.message || photoError.message)}</i>`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: taixiuKeyboard()
      });
    }
  }
}

async function handleB52Hash(chatId, hash, incomingMessageId) {
  if (!/^[a-f0-9]{32}$/i.test(hash)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Hash chưa hợp lệ</b>\n\n<i>Vui lòng gửi đúng chuỗi MD5 gồm 32 ký tự hex.</i>",
      parse_mode: "HTML",
      reply_markup: b52InputKeyboard()
    });
  }

  const { baseUrl } = config();
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang phân tích hash B52...</b>\n\n<i>Vui lòng chờ kết quả.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/taixiu/b52club?=${encodeURIComponent(hash)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    const data = payload.du_lieu || {};
    const imageUrl = data.anh_gop_3_xuc_xac;
    let result;
    if (imageUrl) {
      result = await sendB52Photo(chatId, imageUrl, b52ResultText(payload, hash));
    } else {
      result = await sendTracked("sendMessage", chatId, {
        text: b52ResultText(payload, hash),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: taixiuKeyboard()
      });
    }
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không lấy được kết quả B52</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: b52InputKeyboard()
    });
  }
}

module.exports = async function telegramBotHandler(req, res) {
  const { token } = config();
  if (!token) {
    return res.status(503).json({ trang_thai: "that_bai", thong_bao: "Thiếu TELEGRAM_BOT_TOKEN.", tac_gia: AUTHOR });
  }
  if (req.method && req.method !== "POST") {
    return res.status(200).json({ trang_thai: "thanh_cong", thong_bao: "Telegram Bot scaffold đang hoạt động.", tac_gia: AUTHOR });
  }

  try {
    const update = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else {
      const message = update.message || update.edited_message;
      const chatId = message?.chat?.id;
      const text = String(message?.text || "").trim();
      if (chatId && /^\/start(?:@[^\s]+)?$/i.test(text)) {
        pendingActions.delete(String(chatId));
        await deleteIncoming(chatId, message.message_id);
        await sendStart(chatId, message.from || message.chat);
      } else if (chatId && text && (pendingActions.get(String(chatId)) === "taixiu:b52" || /^[a-f0-9]{32}$/i.test(text))) {
        // Vercel invocations are stateless, so accept a valid MD5 directly
        // instead of relying only on the in-memory button session.
        await handleB52Hash(chatId, text, message.message_id);
      }
    }
    return res.status(200).json({ trang_thai: "thanh_cong", da_nhan: true, tac_gia: AUTHOR });
  } catch (error) {
    return res.status(200).json({ trang_thai: "that_bai", thong_bao: error.message, tac_gia: AUTHOR });
  }
};

module.exports.config = config;
module.exports.isAdmin = isAdmin;
