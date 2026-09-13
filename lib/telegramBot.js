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

async function reactToMessage(chatId, messageId) {
  if (!chatId || !messageId) return;
  const reactions = ["👍", "❤", "🔥", "🎉", "👏", "🤔", "😍"];
  const emoji = reactions[Math.floor(Math.random() * reactions.length)];
  try {
    await telegram("setMessageReaction", {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: "emoji", emoji }]
    });
  } catch (_) {}
}

async function deleteIncoming(chatId, messageId) {
  await reactToMessage(chatId, messageId);
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
      [
        { text: "🎲 Tài Xỉu", callback_data: "menu:taixiu" },
        { text: "🎮 Game SUKA88", callback_data: "menu:suka88" }
      ],
      [{ text: "🧰 Công Cụ", callback_data: "menu:tools" }],
      [
        { text: "🚀 Mở Mini App", web_app: { url: baseUrl } },
        { text: "💬 Hỗ trợ", url: "https://t.me/zheevipv1" }
      ]
    ]
  };
}

function toolsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🔐 Check API Key AI", callback_data: "tools:checkkeyai" }],
      [{ text: "↩️ Về menu chính", callback_data: "menu:home" }]
    ]
  };
}

function taixiuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🎯 Cầu B52", callback_data: "taixiu:b52" }],
      [{ text: "🎲 Cầu 789Club", callback_data: "taixiu:789club" }],
      [{ text: "🎰 Cầu Sunwin", callback_data: "taixiu:sunwin" }],
      [{ text: "🎯 Cầu Hitclub", callback_data: "taixiu:hitclub" }],
      [{ text: "↩️ Về menu chính", callback_data: "menu:home" }]
    ]
  };
}

function b52InputKeyboard() {
  return { inline_keyboard: [[{ text: "✖️ Hủy nhập hash", callback_data: "menu:taixiu" }]] };
}

function suka88Keyboard() {
  return {
    inline_keyboard: [
      [{ text: "🎲 Tài Xỉu", callback_data: "suka88:roll" }],
      [
        { text: "🃏 Bài Tây", callback_data: "suka88:bai" },
        { text: "🦀 Bầu Cua", callback_data: "suka88:baucua" }
      ],
      [{ text: "🎴 Baccarat", callback_data: "suka88:baccarat" }],
      [{ text: "↩️ Về menu chính", callback_data: "menu:home" }]
    ]
  };
}

function startText(user) {
  const displayName = escapeHtml(user?.first_name || user?.username || "bạn");
  return `<b>✦ ZHEE API</b>\n<i>Trung tâm API và tiện ích dành cho nhà phát triển</i>\n\n👋 Xin chào, <b>${displayName}</b>!\n\n<b>Bot đang được khởi tạo lại</b>\n<i>Mỗi chức năng sẽ được xây dựng và kiểm tra riêng để menu gọn, dễ dùng và ổn định hơn.</i>\n\n🧩 <b>Trạng thái hiện tại</b>\n• ✨ Giao diện menu mới\n• 🛠️ Đang mở lại từng nhóm chức năng\n• 🚫 Không dùng ký tự phân cách rối mắt\n\n<i>Chọn một nhóm chức năng bên dưới để bắt đầu:</i>`;
}

function toolsText() {
  return `<b>🧰 CÔNG CỤ</b>\n<i>Tổng hợp các công cụ tiện ích của Zhee API</i>\n\n🔐 <b>Check API Key AI</b>\nKiểm tra key AI còn hạn, nhà cung cấp, module/model dùng được, rate limit và quota/credit nếu nhà cung cấp công khai.\n\n<i>Chọn công cụ bên dưới để bắt đầu. Các công cụ khác sẽ được bổ sung trong cùng menu này.</i>`;
}

function toolsCheckText() {
  return `<b>🔐 CHECK API KEY AI</b>\n\nGửi API key theo mẫu:\n<code>gemini|AIza...</code>\nhoặc gửi thẳng key để bot tự nhận diện nhà cung cấp.\n\n<i>Key chỉ được dùng để kiểm tra, không lưu lại.</i>`;
}

function toolsResultText(payload) {
  const data = payload?.du_lieu || payload || {};
  const models = data.module_co_the_dung || {};
  const modelCount = data.so_module || 0;
  const provider = data.nha_cung_cap || data.nha_id || "Không xác định";
  const lines = Object.entries(models)
    .filter(([, value]) => Array.isArray(value) && value.length)
    .map(([key, value]) => `${key}: ${value.length} model`)
    .join(" · ");
  return `<b>🔐 KẾT QUẢ CHECK API KEY AI</b>\n\n🏢 <b>Nhà cung cấp:</b> <i>${escapeHtml(provider)}</i>\n✅ <b>Hợp lệ:</b> <i>${escapeHtml(data.hop_le || "Không rõ")}</i>\n⏳ <b>Còn hạn:</b> <i>${escapeHtml(data.con_han || "Không rõ")}</i>\n📦 <b>Module/model dùng được:</b> <i>${escapeHtml(modelCount || "Chưa đọc được")}</i>${lines ? `\n🧩 <b>Phân loại:</b> <i>${escapeHtml(lines)}</i>` : ""}\n\n📝 <i>${escapeHtml(data.tom_tat || data.ly_do || "Đã kiểm tra xong.")}</i>\n\n<i>Key đã được ẩn và không được lưu lại.</i>`;
}

function taixiuText() {
  return `<b>🎲 TÀI XỈU</b>\n<i>Các công cụ phân tích chuỗi hash theo từng sảnh game</i>\n\n<b>🧰 Công cụ hiện có</b>\n\n🎯 <b>Cầu B52</b>\n<i>Phân tích MD5 Standard, dự đoán cửa, tổng điểm và bộ ba nút.</i>\n\n🎲 <b>Cầu 789Club</b>\n<i>Phân tích MD5 Standard, dự đoán Tài/Xỉu, chẵn/lẻ và bộ ba nút.</i>\n\n🎰 <b>Cầu Sunwin</b>\n<i>Phân tích MD5 Standard, dự đoán Tài/Xỉu, chẵn/lẻ và bộ ba nút.</i>\n\n🎯 <b>Cầu Hitclub</b>\n<i>Phân tích MD5 hoặc SHA-256, dự đoán cửa chính, tổng điểm và độ tin cậy.</i>\n\n🔐 B52 / 789Club / Sunwin: MD5 32 ký tự · Hitclub: MD5 32 hoặc SHA-256 64 ký tự hex.`;
}

function suka88Text() {
  return `<b>🎮 KHU GIẢI TRÍ SUKA88</b>\n<i>Nhiều game thương hiệu SUKA88 · chơi thử vui, không đặt cược</i>\n\n🎲 <b>Tài Xỉu</b> · lắc 3 xúc xắc và xem tổng điểm.\n🃏 <b>Bài Tây</b> · rút ngẫu nhiên 1–3 lá.\n🦀 <b>Bầu Cua</b> · lắc 3 mặt Nai, Bầu, Gà, Cá, Cua, Tôm.\n🎴 <b>Baccarat</b> · chia bài Con và Cái theo luật cơ bản.\n\n<i>Chọn một game bên dưới để bắt đầu.</i>`;
}

function b52PromptText() {
  return `<b>🎯 CẦU B52</b>\n<i>B52 Club · Soi cầu phân tích xác suất</i>\n\n🔐 Hãy gửi một chuỗi hash MD5 gồm <b>32 ký tự hex</b>.\n\nVí dụ:\n<code>50e0087bc111acab077a5b3a82f3a612</code>\n\n<i>Bot sẽ lọc kết quả thành dự đoán, tổng điểm, độ tin cậy và chiến thuật.</i>`;
}

function club789PromptText() {
  return `<b>🎲 CẦU 789CLUB</b>\n<i>789Club · Soi cầu Tài Xỉu MD5</i>\n\n🔐 Hãy gửi một chuỗi hash MD5 gồm <b>32 ký tự hex</b>.\n\nVí dụ:\n<code>b87c550e3fb2cde381fa06886b772498</code>\n\n<i>Bot sẽ phân tích cửa chính, chẵn lẻ, tổng điểm và bộ ba nút.</i>`;
}

function sunwinPromptText() {
  return `<b>🎰 CẦU SUNWIN</b>\n<i>Sunwin · Soi cầu Tài Xỉu MD5 Hoàng Gia</i>\n\n🔐 Hãy gửi một chuỗi hash MD5 gồm <b>32 ký tự hex</b>.\n\nVí dụ:\n<code>d8cf242b85bed14f7816102c765fa711</code>\n\n<i>Bot sẽ phân tích cửa chính, chẵn lẻ, tổng điểm, độ tin cậy và bộ ba nút.</i>`;
}

function hitclubPromptText() {
  return `<b>🎯 CẦU HITCLUB</b>\n<i>Hitclub · Soi cầu Tài Xỉu MD5 / SHA-256</i>\n\n🔐 Hãy gửi chuỗi MD5 <b>32 ký tự</b> hoặc SHA-256 <b>64 ký tự hex</b>.\n\nVí dụ:\n<code>6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f</code>\n\n<i>Bot sẽ phân tích cửa chính, tổng điểm, bộ ba nút và độ tin cậy.</i>`;
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
  const baseText = `<b>🎯 KẾT QUẢ CẦU B52</b>\n<i>${escapeHtml(data.sanh_game || "B52 Club")}</i>\n\n🔐 <b>Hash:</b> <code>${escapeHtml(hash)}</code>\n🧮 <b>Chuẩn:</b> ${escapeHtml(data.chuan_ma_bam || "MD5 Standard")}\n\n<b>📊 KẾT QUẢ DỰ ĐOÁN</b>\n🎲 <b>Cửa chính:</b> <i>${escapeHtml(result.cua_du_doan_chinh || "Chưa có dữ liệu")}</i>\n⚖️ <b>Chẵn lẻ:</b> <i>${escapeHtml(result.cua_chan_le || "Chưa có dữ liệu")}</i>\n🔢 <b>Tổng điểm:</b> <i>${escapeHtml(result.tong_diem_du_kien || "Chưa có dữ liệu")}</i>\n🎯 <b>Bộ ba nút:</b> <i>${escapeHtml(result.bo_ba_nut_uoc_tinh || diceValue || "Chưa có dữ liệu")}</i>\n📈 <b>Độ tin cậy:</b> <b>${escapeHtml(result.do_tin_cay_thuat_toan || "Chưa có dữ liệu")}</b>\n\n🧠 <b>Thế cầu:</b> <i>${escapeHtml(strategy.the_cau || "Chưa có dữ liệu")}</i>\n💡 <b>Khuyến nghị:</b> <i>${escapeHtml(strategy.khuyen_nghi || "Chưa có dữ liệu")}</i>\n\n🖼️ <i>Ảnh gộp 3 xúc xắc đã được đính kèm bên trên.</i>`;
  return baseText;
}

function club789ResultText(payload, hash) {
  const data = payload?.du_lieu || {};
  const result = data.ket_qua_cuoi || {};
  const dice = data.chi_tiet_3_xuc_xac_uoc_tinh || data.chi_tiet_3_xuc_xac || {};
  const diceValue = [dice.xuc_xac_1, dice.xuc_xac_2, dice.xuc_xac_3]
    .map((item) => item?.nut)
    .filter((value) => value !== undefined)
    .join(" • ");
  return `<b>🎲 KẾT QUẢ CẦU 789CLUB</b>\n<i>${escapeHtml(data.cong_game || "789Club")}</i>\n\n🔐 <b>Hash:</b> <code>${escapeHtml(hash)}</code>\n🧮 <b>Chế độ:</b> ${escapeHtml(data.che_do || "Soi cầu MD5") }\n\n<b>📊 KẾT QUẢ DỰ ĐOÁN</b>\n🎲 <b>Cửa chính:</b> <i>${escapeHtml(result.cua_du_doan_chinh || result.cua_thang_chinh || "Chưa có dữ liệu")}</i>\n⚖️ <b>Chẵn lẻ:</b> <i>${escapeHtml(result.cua_chan_le || "Chưa có dữ liệu")}</i>\n🔢 <b>Tổng điểm:</b> <i>${escapeHtml(result.tong_diem_du_kien || result.tong_diem || "Chưa có dữ liệu")}</i>\n🎯 <b>Bộ ba nút:</b> <i>${escapeHtml(result.bo_ba_nut_uoc_tinh || result.bo_ba_nut || diceValue || "Chưa có dữ liệu")}</i>\n📈 <b>Độ tin cậy:</b> <b>${escapeHtml(result.do_tin_cay_thuat_toan || "Đã đối soát")}</b>\n\n🖼️ <i>Ảnh gộp 3 xúc xắc đã được đính kèm bên trên.</i>`;
}

function sunwinResultText(payload, hash) {
  const data = payload?.du_lieu || {};
  const result = data.ket_qua_cuoi || {};
  const strategy = data.the_cau_va_chien_thuat || {};
  const dice = data.chi_tiet_3_xuc_xac_uoc_tinh || {};
  const diceValue = [dice.xuc_xac_1, dice.xuc_xac_2, dice.xuc_xac_3]
    .map((item) => item?.nut)
    .filter((value) => value !== undefined)
    .join(" • ");
  return `<b>🎰 KẾT QUẢ CẦU SUNWIN</b>\n<i>${escapeHtml(data.cong_game || "Sunwin")}</i>\n\n🔐 <b>Hash:</b> <code>${escapeHtml(hash)}</code>\n🧮 <b>Chuẩn:</b> ${escapeHtml(data.chuan_ma_bam || "MD5 Standard")}\n\n<b>📊 KẾT QUẢ DỰ ĐOÁN</b>\n🎲 <b>Cửa chính:</b> <i>${escapeHtml(result.cua_du_doan_chinh || "Chưa có dữ liệu")}</i>\n⚖️ <b>Chẵn lẻ:</b> <i>${escapeHtml(result.cua_chan_le || "Chưa có dữ liệu")}</i>\n🔢 <b>Tổng điểm:</b> <i>${escapeHtml(result.tong_diem_du_kien || "Chưa có dữ liệu")}</i>\n🎯 <b>Bộ ba nút:</b> <i>${escapeHtml(result.bo_ba_nut_uoc_tinh || diceValue || "Chưa có dữ liệu")}</i>\n📈 <b>Độ tin cậy:</b> <b>${escapeHtml(result.do_tin_cay_thuat_toan || "Chưa có dữ liệu")}</b>\n\n🧠 <b>Thế cầu:</b> <i>${escapeHtml(strategy.the_cau || "Chưa có dữ liệu")}</i>\n💡 <b>Khuyến nghị:</b> <i>${escapeHtml(strategy.khuyen_nghi || "Chưa có dữ liệu")}</i>\n\n🖼️ <i>Ảnh gộp 3 xúc xắc đã được đính kèm bên trên.</i>`;
}

function suka88ResultText(payload) {
  const data = payload?.du_lieu || {};
  const proof = data.chung_thuc_minh_bach || {};
  return `<b>🎮 KẾT QUẢ TÀI XỈU SUKA88</b>\n<i>SUKA88 · Game giải trí, không đặt cược</i>\n\n🎲 <b>Kết quả:</b> <i>${escapeHtml(data.ket_qua || "Chưa có dữ liệu")}</i>\n🔢 <b>Tổng điểm:</b> <i>${escapeHtml(data.tong_diem || "Chưa có dữ liệu")}</i>\n🆔 <b>Phiên:</b> <code>${escapeHtml(data.phien_cuoc_id || "-")}</code>\n🔐 <b>Hash xác thực:</b> <code>${escapeHtml(proof.chuoi_hash_sha256_truoc_phien || "-")}</code>\n\n🖼️ <i>Ảnh kết quả đã được đính kèm bên trên.</i>`;
}

function suka88SubgameText(game, payload) {
  const data = payload?.du_lieu || payload || {};
  const label = { bai: "BÀI TÂY", baucua: "BẦU CUA", baccarat: "BACCARAT" }[game] || game.toUpperCase();
  const summary = data.hien_thi || data.ket_qua?.ten || data.ket_qua || data.chuyen_muc || "Đã tạo kết quả";
  const faceNames = { nai: "Nai", bau: "Bầu", ga: "Gà", ca: "Cá", cua: "Cua", tom: "Tôm" };
  const stats = data.thong_ke && typeof data.thong_ke === "object"
    ? Object.entries(data.thong_ke)
      .filter(([, count]) => Number(count) > 0)
      .map(([face, count]) => `${faceNames[face] || face}: ${count} lần`)
      .join(" · ")
    : "";
  const details = stats ? `\n📊 <b>Thống kê:</b> <i>${escapeHtml(stats)}</i>` : "";
  return `<b>🎮 KẾT QUẢ ${label} SUKA88</b>\n<i>SUKA88 · Game giải trí, không đặt cược</i>\n\n📌 <b>Kết quả:</b> <i>${escapeHtml(summary)}</i>${details}\n\n🖼️ <i>Ảnh game đã được đính kèm bên trên.</i>`;
}

function hitclubResultText(payload, hash) {
  const data = payload?.du_lieu || {};
  const dice = data.chi_tiet_3_xuc_xac || {};
  const diceValue = [dice.xuc_xac_1, dice.xuc_xac_2, dice.xuc_xac_3]
    .map((item) => item?.nut)
    .filter((value) => value !== undefined)
    .join(" • ");
  const probability = data.ti_le_xac_suat || {};
  return `<b>🎯 KẾT QUẢ CẦU HITCLUB</b>\n<i>${escapeHtml(data.phong_game || "Hitclub")}</i>\n\n🔐 <b>Hash:</b> <code>${escapeHtml(hash)}</code>\n🧮 <b>Chế độ:</b> ${escapeHtml(data.che_do || "Soi cầu trước phiên")}\n\n<b>📊 KẾT QUẢ DỰ ĐOÁN</b>\n🎲 <b>Cửa chính:</b> <i>${escapeHtml(data.du_doan_cua_chinh || "Chưa có dữ liệu")}</i>\n🔢 <b>Tổng điểm:</b> <i>${escapeHtml(data.tong_diem_du_kien || "Chưa có dữ liệu")}</i>\n🎯 <b>Bộ ba nút:</b> <i>${escapeHtml(diceValue || "Chưa có dữ liệu")}</i>\n📈 <b>Độ tin cậy:</b> <b>${escapeHtml(probability.do_tin_cay || "Chưa có dữ liệu")}</b>\n📊 <b>Xác suất Tài/Xỉu:</b> <i>${escapeHtml(probability.xac_suat_tai || "-")} / ${escapeHtml(probability.xac_suat_xiu || "-")}</i>\n\n🖼️ <i>Ảnh gộp 3 xúc xắc đã được đính kèm bên trên.</i>`;
}

async function sendStart(chatId, user) {
  return sendTracked("sendMessage", chatId, {
    text: startText(user),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: mainKeyboard()
  });
}

async function sendSuka88Photo(chatId, photoUrl, caption, fileName = "suka88-game.png") {
  await clearPreviousBotMessages(chatId);
  const upload = async (method, field, fileName) => {
    const result = await telegramUpload(
      method,
      chatId,
      { caption, parse_mode: "HTML", reply_markup: suka88Keyboard() },
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
    return await upload("sendPhoto", "photo", fileName);
  } catch (photoError) {
    try {
      return await upload("sendDocument", "document", fileName);
    } catch (documentError) {
      return sendTracked("sendMessage", chatId, {
        text: `${caption}\n\n⚠️ <i>Không thể đính kèm ảnh PNG: ${escapeHtml(documentError.message || photoError.message)}</i>`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: suka88Keyboard()
      });
    }
  }
}

async function handleSuka88Subgame(chatId, game) {
  const { baseUrl } = config();
  const gameConfig = {
    bai: { label: "Bài Tây", path: "/api/taixiu/suka88/bai?=3&key=", imageName: "suka88-bai-tay.png" },
    baucua: { label: "Bầu Cua", path: "/api/taixiu/suka88/baucua?=3&key=", imageName: "suka88-bau-cua.png" },
    baccarat: { label: "Baccarat", path: "/api/taixiu/suka88/bcr?action=random&key=", imageName: "suka88-baccarat.png" }
  }[game];
  if (!gameConfig) return null;
  try {
    await sendTracked("sendMessage", chatId, {
      text: `⏳ <b>Đang chơi ${gameConfig.label} SUKA88...</b>\n\n<i>Game giải trí, vui lòng chờ kết quả.</i>`,
      parse_mode: "HTML"
    });
    const gameKey = String(process.env.SUKA88_GAME_KEY || "minhhocgioi").trim();
    const response = await fetch(`${baseUrl}${gameConfig.path}${encodeURIComponent(gameKey)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    const imageUrl = payload.du_lieu?.anh || payload.anh;
    const caption = suka88SubgameText(game, payload);
    if (imageUrl) return sendSuka88Photo(chatId, imageUrl, caption, gameConfig.imageName);
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", reply_markup: suka88Keyboard() });
  } catch (error) {
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể chơi ${gameConfig.label} SUKA88</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML", reply_markup: suka88Keyboard()
    });
  }
}

async function handleCheckKeyAi(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const parts = String(input || "").split("|");
  const provider = parts.length > 1 ? parts.shift().trim() : "";
  const key = parts.join("|").trim();
  if (!key || key.length < 8) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>API key chưa hợp lệ</b>\n\nGửi theo mẫu <code>gemini|AIza...</code> hoặc gửi thẳng API key.",
      parse_mode: "HTML", reply_markup: toolsKeyboard()
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang kiểm tra API key AI...</b>\n\n<i>Key được gửi trực tiếp đến endpoint kiểm tra và không lưu lại.</i>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/tools/checkkeyai`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(provider ? { key, nha: provider } : { key }),
      signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && payload.trang_thai !== "that_bai") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: toolsResultText(payload), parse_mode: "HTML", reply_markup: toolsKeyboard() });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: `⚠️ <b>Không thể kiểm tra API key</b>\n\n<i>${escapeHtml(error.message)}</i>`, parse_mode: "HTML", reply_markup: toolsKeyboard() });
  }
}

async function handleSuka88Roll(chatId) {
  const { baseUrl } = config();
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang lắc xúc xắc SUKA88...</b>\n\n<i>Game giải trí, vui lòng chờ kết quả.</i>",
      parse_mode: "HTML"
    });
    const gameKey = String(process.env.SUKA88_GAME_KEY || "minhhocgioi").trim();
    const response = await fetch(`${baseUrl}/api/taixiu/suka88?=roll&key=${encodeURIComponent(gameKey)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    const imageUrl = payload.du_lieu?.anh_gop_3_xuc_xac;
    const caption = suka88ResultText(payload);
    if (imageUrl) return sendSuka88Photo(chatId, imageUrl, caption);
    return sendTracked("sendMessage", chatId, {
      text: caption,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: suka88Keyboard()
    });
  } catch (error) {
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể chơi SUKA88</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: suka88Keyboard()
    });
  }
}

async function editMenu(chatId, messageId, text, replyMarkup, isMedia = false) {
  const method = isMedia ? "editMessageCaption" : "editMessageText";
  const body = isMedia
    ? {
        chat_id: chatId,
        message_id: messageId,
        caption: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      }
    : {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      };
  const result = await telegram(method, body);
  botMessages.set(String(chatId), messageId);
  try { await setBotMessageId(chatId, [messageId]); } catch (_) {}
  return result;
}

async function answerCallback(callbackQueryId) {
  try { await telegram("answerCallbackQuery", { callback_query_id: callbackQueryId }); } catch (_) {}
}

async function replaceMenu(chatId, messageId, text, replyMarkup, isMedia) {
  if (isMedia) {
    // Telegram cannot turn a photo/document message into a text message.
    // Remove the old result first so the new menu does not keep the image.
    await deleteMessage(chatId, messageId);
    return sendTracked("sendMessage", chatId, {
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup
    });
  }
  return editMenu(chatId, messageId, text, replyMarkup);
}

async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  const data = String(callback.data || "");
  const isMediaMessage =
    Array.isArray(callback.message?.photo) ||
    Boolean(callback.message?.document);
  await answerCallback(callback.id);
  if (!chatId || !messageId) return;

  if (data === "menu:home") {
    pendingActions.delete(String(chatId));
    return replaceMenu(
      chatId,
      messageId,
      startText(callback.from || callback.message.chat),
      mainKeyboard(),
      isMediaMessage
    );
  }
  if (data === "menu:tools") {
    pendingActions.delete(String(chatId));
    return replaceMenu(chatId, messageId, toolsText(), toolsKeyboard(), isMediaMessage);
  }
  if (data === "tools:checkkeyai") {
    pendingActions.set(String(chatId), "tools:checkkeyai");
    return replaceMenu(chatId, messageId, toolsCheckText(), toolsKeyboard(), isMediaMessage);
  }
  if (data === "menu:suka88") {
    pendingActions.delete(String(chatId));
    return replaceMenu(
      chatId,
      messageId,
      suka88Text(),
      suka88Keyboard(),
      isMediaMessage
    );
  }
  if (data === "suka88:roll") {
    return handleSuka88Roll(chatId);
  }
  if (data === "suka88:bai" || data === "suka88:baucua" || data === "suka88:baccarat") {
    return handleSuka88Subgame(chatId, data.slice("suka88:".length));
  }
  if (data === "menu:taixiu") {
    pendingActions.delete(String(chatId));
    return replaceMenu(
      chatId,
      messageId,
      taixiuText(),
      taixiuKeyboard(),
      isMediaMessage
    );
  }
  if (data === "taixiu:hitclub") {
    pendingActions.set(String(chatId), "taixiu:hitclub");
    return replaceMenu(
      chatId,
      messageId,
      hitclubPromptText(),
      b52InputKeyboard(),
      isMediaMessage
    );
  }
  if (data === "taixiu:sunwin") {
    pendingActions.set(String(chatId), "taixiu:sunwin");
    return replaceMenu(
      chatId,
      messageId,
      sunwinPromptText(),
      b52InputKeyboard(),
      isMediaMessage
    );
  }
  if (data === "taixiu:b52") {
    pendingActions.set(String(chatId), "taixiu:b52");
    return replaceMenu(
      chatId,
      messageId,
      b52PromptText(),
      b52InputKeyboard(),
      isMediaMessage
    );
  }
  if (data === "taixiu:789club") {
    pendingActions.set(String(chatId), "taixiu:789club");
    return replaceMenu(
      chatId,
      messageId,
      club789PromptText(),
      b52InputKeyboard(),
      isMediaMessage
    );
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

async function send789Photo(chatId, photoUrl, caption) {
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
    return await upload("sendPhoto", "photo", "789club-3-xuc-xac.png");
  } catch (photoError) {
    try {
      return await upload("sendDocument", "document", "789club-3-xuc-xac.png");
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

async function sendSunwinPhoto(chatId, photoUrl, caption) {
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
    return await upload("sendPhoto", "photo", "sunwin-3-xuc-xac.png");
  } catch (photoError) {
    try {
      return await upload("sendDocument", "document", "sunwin-3-xuc-xac.png");
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

async function sendHitclubPhoto(chatId, photoUrl, caption) {
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
    return await upload("sendPhoto", "photo", "hitclub-3-xuc-xac.png");
  } catch (photoError) {
    try {
      return await upload("sendDocument", "document", "hitclub-3-xuc-xac.png");
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

async function handleHitclubHash(chatId, hash, incomingMessageId) {
  if (!/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i.test(hash)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Hash chưa hợp lệ</b>\n\n<i>Vui lòng gửi MD5 32 ký tự hoặc SHA-256 64 ký tự hex.</i>",
      parse_mode: "HTML",
      reply_markup: b52InputKeyboard()
    });
  }

  const { baseUrl } = config();
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang phân tích hash Hitclub...</b>\n\n<i>Vui lòng chờ kết quả.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/taixiu/hitclub?=${encodeURIComponent(hash)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    const dice = payload.du_lieu?.chi_tiet_3_xuc_xac || {};
    const values = [dice.xuc_xac_1, dice.xuc_xac_2, dice.xuc_xac_3]
      .map((item) => item?.nut)
      .filter((value) => value !== undefined);
    const imageUrl = values.length === 3
      ? `${baseUrl}/api/taixiu/hitclub?image=${values.join("-")}`
      : null;
    const caption = hitclubResultText(payload, hash);
    const result = imageUrl
      ? await sendHitclubPhoto(chatId, imageUrl, caption)
      : await sendTracked("sendMessage", chatId, {
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: taixiuKeyboard()
        });
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không lấy được kết quả Hitclub</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: b52InputKeyboard()
    });
  }
}

async function handleSunwinHash(chatId, hash, incomingMessageId) {
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
      text: "⏳ <b>Đang phân tích hash Sunwin...</b>\n\n<i>Vui lòng chờ kết quả.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/taixiu/sunwin?=${encodeURIComponent(hash)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    const imageUrl = payload.du_lieu?.anh_gop_3_xuc_xac;
    const caption = sunwinResultText(payload, hash);
    const result = imageUrl
      ? await sendSunwinPhoto(chatId, imageUrl, caption)
      : await sendTracked("sendMessage", chatId, {
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: taixiuKeyboard()
        });
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không lấy được kết quả Sunwin</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: b52InputKeyboard()
    });
  }
}

async function handle789Hash(chatId, hash, incomingMessageId) {
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
      text: "⏳ <b>Đang phân tích hash 789Club...</b>\n\n<i>Vui lòng chờ kết quả.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/taixiu/789club?=${encodeURIComponent(hash)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    const imageUrl = payload.du_lieu?.anh_gop_3_xuc_xac;
    const caption = club789ResultText(payload, hash);
    const result = imageUrl
      ? await send789Photo(chatId, imageUrl, caption)
      : await sendTracked("sendMessage", chatId, {
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: taixiuKeyboard()
        });
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không lấy được kết quả 789Club</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: b52InputKeyboard()
    });
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
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:checkkeyai") {
        await handleCheckKeyAi(chatId, text, message.message_id);
      } else if (chatId && text && (pendingActions.get(String(chatId)) === "taixiu:hitclub" || pendingActions.get(String(chatId)) === "taixiu:sunwin" || pendingActions.get(String(chatId)) === "taixiu:789club" || pendingActions.get(String(chatId)) === "taixiu:b52" || /^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i.test(text))) {
        // Vercel invocations are stateless, so accept a valid MD5 directly
        // instead of relying only on the in-memory button session.
        if (pendingActions.get(String(chatId)) === "taixiu:hitclub") {
          await handleHitclubHash(chatId, text, message.message_id);
        } else if (pendingActions.get(String(chatId)) === "taixiu:sunwin") {
          await handleSunwinHash(chatId, text, message.message_id);
        } else if (pendingActions.get(String(chatId)) === "taixiu:789club") {
          await handle789Hash(chatId, text, message.message_id);
        } else if (/^[a-f0-9]{64}$/i.test(text)) {
          await handleHitclubHash(chatId, text, message.message_id);
        } else {
          await handleB52Hash(chatId, text, message.message_id);
        }
      }
    }
    return res.status(200).json({ trang_thai: "thanh_cong", da_nhan: true, tac_gia: AUTHOR });
  } catch (error) {
    return res.status(200).json({ trang_thai: "that_bai", thong_bao: error.message, tac_gia: AUTHOR });
  }
};

module.exports.config = config;
module.exports.isAdmin = isAdmin;
