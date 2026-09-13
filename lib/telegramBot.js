const {
  getBotMessageId,
  setBotMessageId,
  getAppSetting,
  setAppSetting,
  getCaptchaVerified,
  setCaptchaVerified,
  clearCaptchaVerified,
  getCaptchaChallenge,
  setCaptchaChallenge,
  clearCaptchaChallenge
} = require("./licenseStore");

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

function mainKeyboard(chatId) {
  const { baseUrl } = config();
  return {
    inline_keyboard: [
      [
        { text: "🎲 Tài Xỉu", callback_data: "menu:taixiu" },
        { text: "🎮 Game SUKA88", callback_data: "menu:suka88" }
      ],
      [{ text: "🧰 Công Cụ", callback_data: "menu:tools" }],
      ...(isAdmin(chatId) ? [[{ text: "🛠️ Admin", callback_data: "admin" }]] : []),
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
      [{ text: "🛡️ CheckScam", callback_data: "tools:checkscam" }],
      [{ text: "📞 Check SĐT", callback_data: "tools:checksdt" }],
      [{ text: "📱 Check IMEI / Model Apple", callback_data: "tools:checkimei" }],
      [{ text: "🤖 Chat AI", callback_data: "tools:chat" }],
      [{ text: "🌐 Dịch Đa Ngôn Ngữ", callback_data: "tools:trans" }],
      [{ text: "↩️ Về menu chính", callback_data: "menu:home" }]
    ]
  };
}

function toolResultKeyboard(retryCallback, retryLabel = "🔄 Dùng lại công cụ") {
  return {
    inline_keyboard: [
      [{ text: retryLabel, callback_data: retryCallback }],
      [
        { text: "🧰 Về Công Cụ", callback_data: "menu:tools" },
        { text: "🏠 Về menu chính", callback_data: "menu:home" }
      ]
    ]
  };
}

function suka88GameKeyboard(game) {
  const retry = game === "roll" ? "suka88:roll" : `suka88:${game}`;
  return {
    inline_keyboard: [
      [{ text: "🔄 Chơi lại game này", callback_data: retry }],
      [
        { text: "🎮 Khu SUKA88", callback_data: "menu:suka88" },
        { text: "🏠 Về menu chính", callback_data: "menu:home" }
      ]
    ]
  };
}

function taixiuResultKeyboard(game) {
  const labels = {
    b52: "Phân tích B52",
    "789club": "Phân tích 789Club",
    sunwin: "Phân tích Sunwin",
    hitclub: "Phân tích Hitclub"
  };
  return {
    inline_keyboard: [
      [{ text: `🔄 ${labels[game] || "Dùng lại công cụ"}`, callback_data: `taixiu:${game}` }],
      [
        { text: "🎲 Về Tài Xỉu", callback_data: "menu:taixiu" },
        { text: "🏠 Về menu chính", callback_data: "menu:home" }
      ]
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
  return `<b>🧰 CÔNG CỤ</b>\n<i>Tổng hợp các công cụ tiện ích của Zhee API</i>\n\n🔐 <b>Check API Key AI</b>\nKiểm tra key AI còn hạn, nhà cung cấp, module/model dùng được, rate limit và quota/credit nếu nhà cung cấp công khai.\n\n🛡️ <b>CheckScam</b> · kiểm tra số tài khoản, số điện thoại hoặc từ khóa có dấu hiệu lừa đảo.\n\n📞 <b>Check SĐT</b> · tra cứu định dạng, quốc gia, nhà mạng, loại thuê bao, caller ID và trạng thái SIM nếu có dữ liệu.\n\n📱 <b>Check IMEI / Model Apple</b> · phân tích IMEI, Serial hoặc mã Model/Part Number Apple.\n\n🤖 <b>Chat AI</b> · gửi câu hỏi cho Google Gemini hoặc ChatGPT.\n\n🌐 <b>Dịch Đa Ngôn Ngữ</b> · dịch tự động, chọn ngôn ngữ đích và hỗ trợ voice MP3.\n\n<i>Chọn công cụ bên dưới để bắt đầu.</i>`;
}

function toolsCheckText() {
  return `<b>🔐 CHECK API KEY AI</b>\n\nGửi API key theo mẫu:\n<code>gemini|AIza...</code>\nhoặc gửi thẳng key để bot tự nhận diện nhà cung cấp.\n\n<i>Key chỉ được dùng để kiểm tra, không lưu lại.</i>`;
}

function toolsTransKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🇻🇳 Tiếng Việt", callback_data: "tools:trans:target:vi" },
        { text: "🇬🇧 English", callback_data: "tools:trans:target:en" }
      ],
      [
        { text: "🇯🇵 日本語", callback_data: "tools:trans:target:ja" },
        { text: "🇰🇷 한국어", callback_data: "tools:trans:target:ko" },
        { text: "🇨🇳 中文", callback_data: "tools:trans:target:zh-CN" }
      ],
      [
        { text: "🇫🇷 Français", callback_data: "tools:trans:target:fr" },
        { text: "🇩🇪 Deutsch", callback_data: "tools:trans:target:de" },
        { text: "🇪🇸 Español", callback_data: "tools:trans:target:es" }
      ],
      [
        { text: "🇷🇺 Русский", callback_data: "tools:trans:target:ru" },
        { text: "🌐 Nhập ngôn ngữ khác", callback_data: "tools:trans:custom" }
      ],
      [{ text: "🔊 Dịch + giọng đọc", callback_data: "tools:trans:voice:vi" }],
      [{ text: "↩️ Về Công Cụ", callback_data: "menu:tools" }]
    ]
  };
}

function toolsTransText() {
  return `<b>🌐 DỊCH ĐA NGÔN NGỮ</b>\n\n<b>Chọn ngôn ngữ đích:</b>\nSau khi chọn, gửi câu cần dịch.\n\n🔊 Có thể chọn <b>Dịch + giọng đọc</b> để nhận thêm link MP3.\n🌐 Với ngôn ngữ khác, bấm <b>Nhập ngôn ngữ khác</b> rồi gửi theo mẫu <code>es|Xin chào</code>.\n\n<i>Tối đa 5000 ký tự dịch, voice tối đa 800 ký tự.</i>`;
}

function toolsTransPrompt(target, voice = false) {
  return `<b>🌐 NHẬP NỘI DUNG CẦN DỊCH</b>\n\n🎯 <b>Ngôn ngữ đích:</b> <code>${escapeHtml(target)}</code>${voice ? "\n🔊 <b>Chế độ:</b> Dịch kèm giọng đọc MP3" : ""}\n\nGửi câu cần dịch ngay trong tin nhắn tiếp theo.`;
}

function toolsTransResultText(payload) {
  const source = payload?.nguon || {};
  const target = payload?.dich_sang || {};
  const voice = payload?.voice || {};
  return `<b>🌐 KẾT QUẢ DỊCH</b>\n\n🔤 <b>Ngôn ngữ nguồn:</b> <i>${escapeHtml(source.ten || source.ma || "Tự nhận diện")}</i>\n🎯 <b>Dịch sang:</b> <i>${escapeHtml(target.ten || target.ma || "Tiếng Việt")}</i>\n\n📥 <b>Văn bản gốc:</b>\n<code>${escapeHtml(payload?.van_ban_goc || "-")}</code>\n\n📤 <b>Bản dịch:</b>\n<i>${escapeHtml(payload?.ban_dich || payload?.van_ban || "-")}</i>${voice.link_nghe ? `\n\n🔊 <a href="${escapeHtml(voice.link_nghe)}">Nghe bản dịch</a>` : ""}\n\n<i>Máy dịch: ${escapeHtml(payload?.may_dich || "-")}</i>`;
}

function toolsScamText() {
  return `<b>🛡️ CHECKSCAM</b>\n\nGửi số tài khoản, số điện thoại hoặc từ khóa cần kiểm tra.\n\nVí dụ:\n<code>1903456789</code>\n\n<i>Bot sẽ trả về mức độ cảnh báo, nguồn báo cáo, số lần báo cáo và thông tin chi tiết nếu có.</i>`;
}

function toolsScamResultText(payload) {
  const info = payload?.thong_tin || {};
  return `<b>🛡️ KẾT QUẢ CHECKSCAM</b>\n\n🔎 <b>Từ khóa:</b> <code>${escapeHtml(payload?.tu_khoa || "-")}</code>\n🚨 <b>Mức độ:</b> <i>${escapeHtml(payload?.muc_do || "CHƯA XÁC ĐỊNH")}</i>\n📣 <b>Đã bị báo cáo:</b> <i>${escapeHtml(payload?.da_bi_bao_cao || "KHÔNG RÕ")}</i>\n💬 <b>Thông báo:</b> <i>${escapeHtml(payload?.thong_bao || "Không có thông báo")}</i>\n🌐 <b>Nguồn:</b> <i>${escapeHtml(payload?.nguon || "-")}</i>\n\n👤 <b>Họ tên:</b> <i>${escapeHtml(info.ho_ten || "-")}</i>\n🏦 <b>Số tài khoản:</b> <code>${escapeHtml(info.so_tai_khoan || "-")}</code>\n🏛️ <b>Ngân hàng:</b> <i>${escapeHtml(info.ngan_hang || "-")}</i>\n📄 <b>Loại thông tin:</b> <i>${escapeHtml(info.loai_thong_tin || "-")}</i>\n📊 <b>Số báo cáo:</b> <i>${escapeHtml(info.so_bao_cao ?? "-")}</i>\n💰 <b>Thiệt hại:</b> <i>${escapeHtml(info.thiet_hai || "-")}</i>${info.link_chi_tiet ? `\n🔗 <a href="${escapeHtml(info.link_chi_tiet)}">Xem chi tiết báo cáo</a>` : ""}\n\n<i>Dữ liệu tham khảo từ hệ thống Checkscam.</i>`;
}

function toolsPhoneText() {
  return `<b>📞 CHECK SĐT</b>\n\nGửi số điện thoại cần tra cứu.\n\nVí dụ:\n<code>0944921186</code>\n<code>+84944921186</code>\n\n<i>Bot sẽ trả về định dạng, quốc gia, nhà mạng, loại thuê bao, caller ID và thông tin SIM nếu endpoint có dữ liệu.</i>`;
}

function toolsPhoneResultText(payload) {
  const data = payload?.du_lieu || {};
  const carrier = data.nha_mang_va_duong_truyen || {};
  const identity = data.danh_tinh_nguoi_dung || {};
  const security = data.lich_su_va_bao_mat_sim || {};
  return `<b>📞 KẾT QUẢ CHECK SĐT</b>\n\n📱 <b>Số điện thoại:</b> <code>${escapeHtml(data.so_dien_thoai || data.dinh_dang_noi_dia || "-")}</code>\n📝 <b>Dạng nội địa:</b> <code>${escapeHtml(data.dinh_dang_noi_dia || "-")}</code>\n🌍 <b>Quốc gia:</b> <i>${escapeHtml(data.ma_quoc_gia || "-")}</i> · <code>${escapeHtml(data.ma_vung_quoc_te || "-")}</code>\n✅ <b>Tình trạng:</b> <i>${escapeHtml(data.tinh_trang_hop_le || "-")}</i>\n\n📡 <b>NHÀ MẠNG & ĐƯỜNG TRUYỀN</b>\n• Loại thuê bao: <i>${escapeHtml(carrier.loai_thue_bao || "-")}</i>\n• Nhà mạng: <i>${escapeHtml(carrier.ten_nha_mang || "-")}</i>\n• MCC/MNC: <code>${escapeHtml(carrier.ma_quoc_gia_mcc || "-")} / ${escapeHtml(carrier.ma_mang_mnc || "-")}</code>\n\n👤 <b>DANH TÍNH</b>\n• Caller ID: <i>${escapeHtml(identity.ten_dang_ky_caller_id || payload.ten_hien_thi_caller_id || "Không có")}</i>\n• Loại danh tính: <i>${escapeHtml(identity.loai_danh_tinh || "-")}</i>\n\n🛡️ <b>LỊCH SỬ & BẢO MẬT SIM</b>\n• Đổi SIM gần đây: <i>${escapeHtml(security.da_doi_sim_gan_day || "-")}</i>\n• Lần đổi gần nhất: <i>${escapeHtml(security.thoi_gian_doi_sim_gan_nhat || "-")}</i>\n• Chuyển tiếp cuộc gọi: <i>${escapeHtml(security.chuyen_tiep_cuoc_goi || "-")}</i>\n\n🛰️ <b>Máy chủ:</b> <i>${escapeHtml(data.may_chu_kiem_tra || "-")}</i>\n\n<i>${escapeHtml(payload.chuyen_muc || "Phone Number Intelligence Lookup")}</i>`;
}

function toolsImeiText() {
  return `<b>📱 CHECK IMEI / MODEL APPLE</b>\n\nGửi một trong các loại mã sau:\n• IMEI 15 chữ số\n• Serial thiết bị\n• Model / Part Number, ví dụ <code>MLXJ3VN/A</code>\n\n<i>Hệ thống chỉ phân tích thông tin phần cứng công khai và không lưu IMEI, Serial hay lịch sử thiết bị.</i>`;
}

function toolsImeiResultText(payload) {
  const data = payload?.du_lieu || {};
  return `<b>📱 KẾT QUẢ CHECK IMEI / MODEL APPLE</b>\n\n🔎 <b>Mã tra cứu:</b> <code>${escapeHtml(data.ma_tra_cuu || "-")}</code>\n🧾 <b>Loại dữ liệu:</b> <i>${escapeHtml(data.loai_du_lieu || "-")}</i>\n📱 <b>Tên thiết bị:</b> <i>${escapeHtml(data.ten_thiet_bi || "-")}</i>\n🔢 <b>Mã model:</b> <code>${escapeHtml(data.ma_model || "-")}</code>\n🏷️ <b>Loại máy:</b> <i>${escapeHtml(data.loai_may || "-")}</i>\n🌍 <b>Thị trường:</b> <i>${escapeHtml(data.thi_truong || "-")}</i>\n🛰️ <b>Nguồn giải mã:</b> <i>${escapeHtml(data.nguon_giai_ma || "-")}</i>\n\n🔒 <i>${escapeHtml(payload.thong_bao_bao_mat || "Không lưu trữ thông tin thiết bị.")}</i>`;
}

function toolsChatText() {
  return `<b>🤖 CHAT AI</b>\n\nGửi câu hỏi hoặc yêu cầu cho trợ lý AI.\n\nMặc định sử dụng <code>gemini</code>. Bạn cũng có thể chọn model theo mẫu:\n<code>gemini|Xin chào bạn</code>\n<code>chatgpt|Viết giúp tôi một đoạn văn</code>\n\n<i>Hãy gửi nội dung cần hỏi trong tin nhắn tiếp theo.</i>`;
}

function toolsChatResultText(payload) {
  return `<b>🤖 KẾT QUẢ CHAT AI</b>\n\n🧠 <b>Mô hình:</b> <i>${escapeHtml(payload?.mo_hinh || "Không xác định")}</i>\n\n❓ <b>Câu hỏi:</b>\n<code>${escapeHtml(payload?.cau_hoi || "-")}</code>\n\n💬 <b>Phản hồi:</b>\n${escapeHtml(payload?.phan_hoi || payload?.answer || payload?.message || "Không có phản hồi.")}\n\n<i>${escapeHtml(payload?.chuyen_muc || "Trợ Lý Trò Chuyện Trí Tuệ Nhân Tạo")}</i>`;
}

function toolsResultText(payload) {
  const data = payload?.du_lieu || payload || {};
  const models = data.module_co_the_dung || {};
  const provider = data.nha_cung_cap || data.nha_id || "Không xác định";
  const modelSections = Object.entries(models)
    .filter(([, value]) => Array.isArray(value) && value.length)
    .map(([key, value]) => `\n<b>${escapeHtml(key.toUpperCase())}</b> (${value.length})\n<code>${escapeHtml(value.join("\n"))}</code>`)
    .join("\n");
  const objectLines = (label, value) => {
    if (!value || typeof value !== "object") return "";
    const text = Object.entries(value)
      .filter(([, item]) => item !== undefined && item !== null && item !== "")
      .map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(", ") : item}`)
      .join(" · ");
    return text ? `\n📌 <b>${label}:</b> <i>${escapeHtml(text)}</i>` : "";
  };
  const body = `<b>🔐 KẾT QUẢ CHECK API KEY AI</b>\n\n🏢 <b>Nhà cung cấp:</b> <i>${escapeHtml(provider)}</i>\n🆔 <b>Mã nhà cung cấp:</b> <code>${escapeHtml(data.nha_id || "-")}</code>\n🔑 <b>Key đã ẩn:</b> <code>${escapeHtml(data.key_an || "-")}</code>\n\n✅ <b>Hợp lệ:</b> <i>${escapeHtml(data.hop_le || "Không rõ")}</i>\n⏳ <b>Còn hạn:</b> <i>${escapeHtml(data.con_han || "Không rõ")}</i>\n💳 <b>Hết quota:</b> <i>${escapeHtml(data.het_quota || "Không rõ")}</i>\n⌛ <b>Hết hạn:</b> <i>${escapeHtml(data.het_han || "Không rõ")}</i>\n📦 <b>Tổng module/model:</b> <i>${escapeHtml(data.so_module || "Chưa đọc được")}</i>${objectLines("Số dư", data.so_du)}${objectLines("Hạn mức tốc độ", data.han_muc_toc_do)}${objectLines("Quyền", data.quyen)}${data.goi_y ? `\n💡 <b>Gợi ý:</b> <i>${escapeHtml(data.goi_y)}</i>` : ""}\n\n📝 <b>Tóm tắt:</b> <i>${escapeHtml(data.tom_tat || data.ly_do || "Đã kiểm tra xong.")}</i>${data.ghi_chu ? `\nℹ️ <i>${escapeHtml(data.ghi_chu)}</i>` : ""}\n\n<b>📚 DANH SÁCH MODULE/MODEL ĐẦY ĐỦ</b>${modelSections}\n\n<i>Key đã được ẩn và không được lưu lại.</i>`;
  return body.length <= 3900 ? body : `${body.slice(0, 3860)}\n\n<i>Danh sách đã được rút gọn do giới hạn độ dài Telegram.</i>`;
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

function adminKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🛡️ Captcha", callback_data: "admin:captcha" }],
      [{ text: "↩️ Về menu chính", callback_data: "menu:home" }]
    ]
  };
}

function adminCaptchaKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🔄 Bật/Tắt Captcha", callback_data: "admin:captcha:toggle" }],
      [
        { text: "🔤 Ký tự", callback_data: "admin:captcha:kind:kytu" },
        { text: "🔢 Số", callback_data: "admin:captcha:kind:so" }
      ],
      [
        { text: "🧩 Mã", callback_data: "admin:captcha:kind:code" },
        { text: "➗ Toán", callback_data: "admin:captcha:kind:toan" },
        { text: "🖼️ Hình", callback_data: "admin:captcha:kind:hinh" }
      ],
      [{ text: "↩️ Về Admin", callback_data: "admin" }]
    ]
  };
}

function adminText() {
  return `<b>🛠️ ADMIN</b>\n\n<i>Chọn nhóm quản trị cần mở.</i>`;
}

async function captchaConfig() {
  const enabled = await getAppSetting("captcha_enabled", true);
  const kind = String(await getAppSetting("captcha_kind", "kytu") || "kytu");
  return { enabled: enabled !== false && enabled !== "false", kind };
}

async function adminCaptchaText() {
  const state = await captchaConfig();
  return `<b>🛠️ ADMIN CAPTCHA</b>\n\n<b>Trạng thái:</b> ${state.enabled ? "🟢 ĐANG BẬT" : "🔴 ĐANG TẮT"}\n<b>Kiểu mặc định:</b> <code>${escapeHtml(state.kind)}</code>\n<b>Thời hạn captcha:</b> <code>5 phút</code>\n<b>Thời hạn xác thực người dùng:</b> <code>1 giờ</code>\n\n<i>Captcha được ép khi người dùng bấm /start hoặc phiên đang dở đã quá 1 giờ.</i>`;
}

async function sendCaptchaChallenge(chatId, reason = "Vui lòng xác thực để tiếp tục.") {
  const { baseUrl } = config();
  const state = await captchaConfig();
  if (!state.enabled || isAdmin(chatId)) {
    await setCaptchaVerified(chatId, 3600);
    return false;
  }
  const response = await fetch(`${baseUrl}/api/tools/captcha?kieu=${encodeURIComponent(state.kind)}&an_dap_an=1`, { signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.trang_thai !== "thanh_cong" || !payload.token) throw new Error(payload.thong_bao || `Captcha HTTP ${response.status}`);
  await setCaptchaChallenge(chatId, { token: payload.token, kind: payload.kieu, created_at: Date.now() }, 300);
  const prompt = `<b>🛡️ XÁC THỰC CAPTCHA</b>\n\n${escapeHtml(reason)}\n\n<b>Câu hỏi:</b> <i>${escapeHtml(payload.cau_hoi || "Nhập đáp án trong ảnh")}</i>\n\n${payload.kieu === "hinh" ? "<i>Với captcha hình, gửi chữ cái A–F tương ứng ô đúng.</i>" : "<i>Nhập chính xác đáp án nhìn thấy trong ảnh.</i>"}`;
  await clearPreviousBotMessages(chatId);
  const captchaFields = { caption: prompt, parse_mode: "HTML" };
  try {
    const result = await telegram("sendPhoto", { chat_id: chatId, photo: payload.anh, ...captchaFields });
    if (result?.message_id) {
      botMessages.set(String(chatId), result.message_id);
      try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
    }
  } catch (_) {
    try {
      const result = await telegramUpload("sendDocument", chatId, captchaFields, "document", "captcha.svg", payload.anh);
      if (result?.message_id) {
        botMessages.set(String(chatId), result.message_id);
        try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
      }
    } catch (_) {
      await sendTracked("sendMessage", chatId, { text: `${prompt}\n\n<a href="${escapeHtml(payload.anh)}">Mở ảnh captcha</a>`, parse_mode: "HTML", disable_web_page_preview: false });
    }
  }
  return true;
}

async function verifyCaptchaAnswer(chatId, answer, messageId) {
  const challenge = await getCaptchaChallenge(chatId);
  if (!challenge?.token) return false;
  const { baseUrl } = config();
  const url = `${baseUrl}/api/tools/captcha?action=verify&token=${encodeURIComponent(challenge.token)}&traloi=${encodeURIComponent(String(answer || "").trim())}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => ({}));
  await deleteIncoming(chatId, messageId);
  if (response.ok && payload.dung === true) {
    await clearCaptchaChallenge(chatId);
    await setCaptchaVerified(chatId, 3600);
    await sendStart(chatId, { first_name: "bạn" });
    return true;
  }
  await sendCaptchaChallenge(chatId, "Captcha chưa đúng hoặc đã hết hạn. Hãy thử lại.");
  return true;
}

async function sendStart(chatId, user) {
  return sendTracked("sendMessage", chatId, {
    text: startText(user),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: mainKeyboard(chatId)
  });
}

async function sendSuka88Photo(chatId, photoUrl, caption, fileName = "suka88-game.png", game = "roll") {
  await clearPreviousBotMessages(chatId);
  const upload = async (method, field, fileName) => {
    const result = await telegramUpload(
      method,
      chatId,
      { caption, parse_mode: "HTML", reply_markup: suka88GameKeyboard(game) },
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
        reply_markup: suka88GameKeyboard(game)
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
    if (imageUrl) return sendSuka88Photo(chatId, imageUrl, caption, gameConfig.imageName, game);
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", reply_markup: suka88GameKeyboard(game) });
  } catch (error) {
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể chơi ${gameConfig.label} SUKA88</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML", reply_markup: suka88GameKeyboard(game)
    });
  }
}

async function handleTranslate(chatId, input, incomingMessageId, preset = "") {
  const { baseUrl } = config();
  const raw = String(input || "").trim();
  let spec = preset ? preset.replace(/\|/g, ",") : "";
  let text = raw;
  const separator = raw.indexOf("|");
  if (!preset && separator > 0) {
    spec = raw.slice(0, separator).trim();
    text = raw.slice(separator + 1).trim();
  }
  let to = "vi";
  let from = "auto";
  let voice = false;
  for (const item of spec.split(",").map((part) => part.trim()).filter(Boolean)) {
    if (item.toLowerCase() === "voice") voice = true;
    else if (/^to=/i.test(item)) to = item.slice(3).trim();
    else if (/^from=/i.test(item)) from = item.slice(5).trim();
    else to = item;
  }
  if (!text || text.length > 5000) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: "⚠️ <b>Nội dung không hợp lệ</b>\n\nVăn bản dịch tối đa 5000 ký tự.", parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:trans", "🔄 Dùng lại Dịch") });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang dịch văn bản...</b>\n\n<i>Vui lòng chờ kết quả.</i>", parse_mode: "HTML" });
    const params = new URLSearchParams({ text, to });
    if (from !== "auto") params.set("from", from);
    if (voice) params.set("action", "voice");
    const response = await fetch(`${baseUrl}/api/tools/trans?${params.toString()}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: toolsTransResultText(payload), parse_mode: "HTML", disable_web_page_preview: false, reply_markup: toolResultKeyboard("tools:trans", "🔄 Dùng lại Dịch") });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: `⚠️ <b>Không thể dịch văn bản</b>\n\n<i>${escapeHtml(error.message)}</i>`, parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:trans", "🔄 Dùng lại Dịch") });
  }
}

async function handleCheckScam(chatId, keyword, incomingMessageId) {
  const { baseUrl } = config();
  const value = String(keyword || "").trim();
  if (!value || value.length < 3) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: "⚠️ <b>Từ khóa chưa hợp lệ</b>\n\nHãy gửi số tài khoản, số điện thoại hoặc từ khóa cần kiểm tra.", parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:checkscam", "🔄 Dùng lại CheckScam") });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang kiểm tra CheckScam...</b>\n\n<i>Vui lòng chờ kết quả.</i>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/tools/checkscam?=${encodeURIComponent(value)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.trang_thai) throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: toolsScamResultText(payload), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: toolResultKeyboard("tools:checkscam", "🔄 Dùng lại CheckScam") });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: `⚠️ <b>Không thể kiểm tra CheckScam</b>\n\n<i>${escapeHtml(error.message)}</i>`, parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:checkscam", "🔄 Dùng lại CheckScam") });
  }
}

async function handleCheckPhone(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const phone = String(input || "").trim();
  if (!phone || !/^(?:\+?\d[\d\s().-]{6,20})$/.test(phone)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Số điện thoại chưa hợp lệ</b>\n\nHãy gửi số điện thoại Việt Nam hoặc số quốc tế. Ví dụ: <code>0944921186</code> hoặc <code>+84944921186</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:checksdt", "🔄 Dùng lại Check SĐT")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang kiểm tra số điện thoại...</b>\n\n<i>Vui lòng chờ kết quả từ Phone Number Intelligence Lookup.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/tools/checksdt?=${encodeURIComponent(phone)}`, { signal: AbortSignal.timeout(20000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsPhoneResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: toolResultKeyboard("tools:checksdt", "🔄 Dùng lại Check SĐT")
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể kiểm tra số điện thoại</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:checksdt", "🔄 Dùng lại Check SĐT")
    });
  }
}

async function handleCheckImei(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const code = String(input || "").trim();
  const normalized = code.toUpperCase().replace(/[\s-]/g, "");
  if (!normalized || !/^[A-Z0-9/]{5,30}$/.test(normalized)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Mã IMEI/Model chưa hợp lệ</b>\n\nGửi IMEI 15 số, Serial hoặc Model/Part Number Apple. Ví dụ: <code>MLXJ3VN/A</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:checkimei", "🔄 Dùng lại Check IMEI")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang kiểm tra IMEI / Model Apple...</b>\n\n<i>Hệ thống đang đối chiếu thông tin phần cứng công khai.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/tools/checkimei?=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(20000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsImeiResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: toolResultKeyboard("tools:checkimei", "🔄 Dùng lại Check IMEI")
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể kiểm tra IMEI / Model Apple</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:checkimei", "🔄 Dùng lại Check IMEI")
    });
  }
}

async function handleChatAi(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const raw = String(input || "").trim();
  let model = "gemini";
  let question = raw;
  const separator = raw.indexOf("|");
  if (separator > 0) {
    const requestedModel = raw.slice(0, separator).trim().replace(/^model=/i, "");
    if (/^(?:gemini|chatgpt|openai)$/i.test(requestedModel)) {
      model = requestedModel.toLowerCase() === "openai" ? "chatgpt" : requestedModel.toLowerCase();
      question = raw.slice(separator + 1).trim();
    }
  }
  if (!question || question.length > 4000) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Câu hỏi chưa hợp lệ</b>\n\nHãy gửi nội dung từ 1 đến 4000 ký tự. Có thể dùng <code>gemini|Nội dung cần hỏi</code> hoặc <code>chatgpt|Nội dung cần hỏi</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:chat", "🔄 Dùng lại Chat AI")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: `⏳ <b>Đang hỏi Chat AI (${escapeHtml(model)})...</b>\n\n<i>Vui lòng chờ phản hồi.</i>`,
      parse_mode: "HTML"
    });
    const params = new URLSearchParams({ q: question, model });
    const response = await fetch(`${baseUrl}/tools/chat?${params.toString()}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsChatResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: toolResultKeyboard("tools:chat", "🔄 Dùng lại Chat AI")
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể hỏi Chat AI</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:chat", "🔄 Dùng lại Chat AI")
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
      parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:checkkeyai", "🔄 Dùng lại Check API Key AI")
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
    return sendTracked("sendMessage", chatId, { text: toolsResultText(payload), parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:checkkeyai", "🔄 Dùng lại Check API Key AI") });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, { text: `⚠️ <b>Không thể kiểm tra API key</b>\n\n<i>${escapeHtml(error.message)}</i>`, parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:checkkeyai", "🔄 Dùng lại Check API Key AI") });
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
    if (imageUrl) return sendSuka88Photo(chatId, imageUrl, caption, "suka88-tai-xiu.png", "roll");
    return sendTracked("sendMessage", chatId, {
      text: caption,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: suka88GameKeyboard("roll")
    });
  } catch (error) {
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể chơi SUKA88</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: suka88GameKeyboard("roll")
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

  if (!isAdmin(callback.from?.id || chatId)) {
    const state = await captchaConfig();
    const verified = await getCaptchaVerified(chatId);
    if (state.enabled && !verified) {
      await sendCaptchaChallenge(chatId, "Hãy xác thực captcha trước khi dùng bot.");
      return;
    }
  }

  if (data === "admin" || data === "admin:captcha" || data.startsWith("admin:captcha:")) {
    if (!isAdmin(callback.from?.id || chatId)) return;
    if (data === "admin") return replaceMenu(chatId, messageId, adminText(), adminKeyboard(), isMediaMessage);
    if (data === "admin:captcha:toggle") {
      const state = await captchaConfig();
      await setAppSetting("captcha_enabled", !state.enabled);
    } else if (data.startsWith("admin:captcha:kind:")) {
      const kind = data.slice("admin:captcha:kind:".length);
      if (["kytu", "so", "code", "toan", "hinh"].includes(kind)) await setAppSetting("captcha_kind", kind);
    }
    return replaceMenu(chatId, messageId, await adminCaptchaText(), adminCaptchaKeyboard(), isMediaMessage);
  }
  if (data === "menu:home") {
    pendingActions.delete(String(chatId));
    return replaceMenu(
      chatId,
      messageId,
      startText(callback.from || callback.message.chat),
      mainKeyboard(chatId),
      isMediaMessage
    );
  }
  if (data === "menu:tools") {
    pendingActions.delete(String(chatId));
    return replaceMenu(chatId, messageId, toolsText(), toolsKeyboard(), isMediaMessage);
  }
  if (data === "tools:checkkeyai") {
    pendingActions.set(String(chatId), "tools:checkkeyai");
    return replaceMenu(chatId, messageId, toolsCheckText(), toolResultKeyboard("tools:checkkeyai", "🔄 Dùng lại Check API Key AI"), isMediaMessage);
  }
  if (data === "tools:checkscam") {
    pendingActions.set(String(chatId), "tools:checkscam");
    return replaceMenu(chatId, messageId, toolsScamText(), toolResultKeyboard("tools:checkscam", "🔄 Dùng lại CheckScam"), isMediaMessage);
  }
  if (data === "tools:checksdt") {
    pendingActions.set(String(chatId), "tools:checksdt");
    return replaceMenu(chatId, messageId, toolsPhoneText(), toolResultKeyboard("tools:checksdt", "🔄 Dùng lại Check SĐT"), isMediaMessage);
  }
  if (data === "tools:checkimei") {
    pendingActions.set(String(chatId), "tools:checkimei");
    return replaceMenu(chatId, messageId, toolsImeiText(), toolResultKeyboard("tools:checkimei", "🔄 Dùng lại Check IMEI"), isMediaMessage);
  }
  if (data === "tools:chat") {
    pendingActions.set(String(chatId), "tools:chat");
    return replaceMenu(chatId, messageId, toolsChatText(), toolResultKeyboard("tools:chat", "🔄 Dùng lại Chat AI"), isMediaMessage);
  }
  if (data === "tools:trans") {
    pendingActions.set(String(chatId), "tools:trans:menu");
    return replaceMenu(chatId, messageId, toolsTransText(), toolsTransKeyboard(), isMediaMessage);
  }
  if (data.startsWith("tools:trans:target:")) {
    const target = data.slice("tools:trans:target:".length);
    pendingActions.set(String(chatId), `tools:trans:to=${target}`);
    return replaceMenu(chatId, messageId, toolsTransPrompt(target), toolsTransKeyboard(), isMediaMessage);
  }
  if (data.startsWith("tools:trans:voice:")) {
    const target = data.slice("tools:trans:voice:".length);
    pendingActions.set(String(chatId), `tools:trans:voice|to=${target}`);
    return replaceMenu(chatId, messageId, toolsTransPrompt(target, true), toolsTransKeyboard(), isMediaMessage);
  }
  if (data === "tools:trans:custom") {
    pendingActions.set(String(chatId), "tools:trans:custom");
    return replaceMenu(chatId, messageId, toolsTransPrompt("Nhập theo mã, ví dụ: es|..."), toolsTransKeyboard(), isMediaMessage);
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

async function sendB52Photo(chatId, photoUrl, caption, game = "b52") {
  await clearPreviousBotMessages(chatId);
  const upload = async (method, field, fileName) => {
    const result = await telegramUpload(
      method,
      chatId,
      { caption, parse_mode: "HTML", reply_markup: taixiuResultKeyboard(game) },
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
        reply_markup: taixiuResultKeyboard(game)
      });
    }
  }
}

async function send789Photo(chatId, photoUrl, caption, game = "789club") {
  await clearPreviousBotMessages(chatId);
  const upload = async (method, field, fileName) => {
    const result = await telegramUpload(
      method,
      chatId,
      { caption, parse_mode: "HTML", reply_markup: taixiuResultKeyboard(game) },
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
        reply_markup: taixiuResultKeyboard(game)
      });
    }
  }
}

async function sendSunwinPhoto(chatId, photoUrl, caption, game = "sunwin") {
  await clearPreviousBotMessages(chatId);
  const upload = async (method, field, fileName) => {
    const result = await telegramUpload(
      method,
      chatId,
      { caption, parse_mode: "HTML", reply_markup: taixiuResultKeyboard(game) },
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
        reply_markup: taixiuResultKeyboard(game)
      });
    }
  }
}

async function sendHitclubPhoto(chatId, photoUrl, caption, game = "hitclub") {
  await clearPreviousBotMessages(chatId);
  const upload = async (method, field, fileName) => {
    const result = await telegramUpload(
      method,
      chatId,
      { caption, parse_mode: "HTML", reply_markup: taixiuResultKeyboard(game) },
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
        reply_markup: taixiuResultKeyboard(game)
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
      reply_markup: taixiuResultKeyboard("hitclub")
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
      ? await sendHitclubPhoto(chatId, imageUrl, caption, "hitclub")
      : await sendTracked("sendMessage", chatId, {
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: taixiuResultKeyboard("hitclub")
        });
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không lấy được kết quả Hitclub</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: taixiuResultKeyboard("hitclub")
    });
  }
}

async function handleSunwinHash(chatId, hash, incomingMessageId) {
  if (!/^[a-f0-9]{32}$/i.test(hash)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Hash chưa hợp lệ</b>\n\n<i>Vui lòng gửi đúng chuỗi MD5 gồm 32 ký tự hex.</i>",
      parse_mode: "HTML",
      reply_markup: taixiuResultKeyboard("sunwin")
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
      ? await sendSunwinPhoto(chatId, imageUrl, caption, "sunwin")
      : await sendTracked("sendMessage", chatId, {
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: taixiuResultKeyboard("sunwin")
        });
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không lấy được kết quả Sunwin</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: taixiuResultKeyboard("sunwin")
    });
  }
}

async function handle789Hash(chatId, hash, incomingMessageId) {
  if (!/^[a-f0-9]{32}$/i.test(hash)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Hash chưa hợp lệ</b>\n\n<i>Vui lòng gửi đúng chuỗi MD5 gồm 32 ký tự hex.</i>",
      parse_mode: "HTML",
      reply_markup: taixiuResultKeyboard("789club")
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
      ? await send789Photo(chatId, imageUrl, caption, "789club")
      : await sendTracked("sendMessage", chatId, {
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: taixiuResultKeyboard("789club")
        });
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không lấy được kết quả 789Club</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: taixiuResultKeyboard("789club")
    });
  }
}

async function handleB52Hash(chatId, hash, incomingMessageId) {
  if (!/^[a-f0-9]{32}$/i.test(hash)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Hash chưa hợp lệ</b>\n\n<i>Vui lòng gửi đúng chuỗi MD5 gồm 32 ký tự hex.</i>",
      parse_mode: "HTML",
      reply_markup: taixiuResultKeyboard("b52")
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
      result = await sendB52Photo(chatId, imageUrl, b52ResultText(payload, hash), "b52");
    } else {
      result = await sendTracked("sendMessage", chatId, {
        text: b52ResultText(payload, hash),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: taixiuResultKeyboard("b52")
      });
    }
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không lấy được kết quả B52</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: taixiuResultKeyboard("b52")
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
        if (isAdmin(message.from?.id || chatId) || !(await captchaConfig()).enabled) {
          await setCaptchaVerified(chatId, 3600);
          await sendStart(chatId, message.from || message.chat);
        } else {
          await clearCaptchaVerified(chatId);
          await sendCaptchaChallenge(chatId, "Hãy xác thực captcha để bắt đầu phiên mới.");
        }
      } else if (chatId && text && !isAdmin(message.from?.id || chatId) && (await captchaConfig()).enabled && !(await getCaptchaVerified(chatId))) {
        if (await getCaptchaChallenge(chatId)) {
          await verifyCaptchaAnswer(chatId, text, message.message_id);
        } else {
          await deleteIncoming(chatId, message.message_id);
          await sendCaptchaChallenge(chatId, "Hãy xác thực captcha trước khi dùng bot.");
        }
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:checkkeyai") {
        await handleCheckKeyAi(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:checkscam") {
        await handleCheckScam(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:checksdt") {
        await handleCheckPhone(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:checkimei") {
        await handleCheckImei(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:chat") {
        await handleChatAi(chatId, text, message.message_id);
      } else if (chatId && text && String(pendingActions.get(String(chatId)) || "").startsWith("tools:trans:")) {
        const action = String(pendingActions.get(String(chatId)) || "");
        const preset = action === "tools:trans:menu" || action === "tools:trans:custom" ? "" : action.slice("tools:trans:".length);
        await handleTranslate(chatId, text, message.message_id, preset);
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
