const net = require("net");

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
  clearCaptchaChallenge,
  getPendingAction,
  setPendingAction,
  clearPendingAction,
  getTiktokPhotoSession,
  setTiktokPhotoSession,
  clearTiktokPhotoSession,
  getPinterestSearchSession,
  setPinterestSearchSession,
  clearPinterestSearchSession
} = require("./licenseStore");
const { tinhHoatDong } = require("./home");
const pinterestApi = require("./pinterest");
const { createZipBuffer } = require("./zip");

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

const rawFetch = globalThis.fetch.bind(globalThis);
function isOwnApi(target, baseUrl) {
  return target === baseUrl || target.startsWith(`${baseUrl}/`) || target.startsWith(`${baseUrl}?`);
}
function fetch(url, options) {
  const target = typeof url === "string" ? url : "";
  const { baseUrl, token } = config();
  if (token && baseUrl && isOwnApi(target, baseUrl)) {
    const headers = new Headers(options && options.headers);
    headers.set("x-zhee-internal", token);
    return rawFetch(url, Object.assign({}, options, { headers }));
  }
  return rawFetch(url, options);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[char]));
}

function isLikelyImageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return /^https?:$/.test(url.protocol) && (/\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(url.pathname + url.search) || /\/(?:png|jpe?g|webp|gif)(?:$|[/?])/i.test(url.pathname));
  } catch (_) {
    return false;
  }
}

function sanitizeTelegramValue(value) {
  if (typeof value === "string") {
    return Array.from(value, (char) => {
      const codePoint = char.codePointAt(0);
      return codePoint >= 0xD800 && codePoint <= 0xDFFF ? "�" : char;
    }).join("");
  }
  if (Array.isArray(value)) return value.map(sanitizeTelegramValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeTelegramValue(item)]));
  }
  return value;
}

function isHarmlessTelegramError(error) {
  return /message is not modified|message to edit not found|message to delete not found|query is too old|query ID is invalid/i.test(String(error?.message || error || ""));
}

async function telegram(method, body) {
  const { token } = config();
  if (!token) throw new Error("Thiếu TELEGRAM_BOT_TOKEN.");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitizeTelegramValue(body)),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    const description = payload.description || `Telegram HTTP ${response.status}.`;
    if (isHarmlessTelegramError({ message: description })) return payload.result || {};
    throw new Error(description);
  }
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

async function telegramUpload(method, chatId, fields, fileField, fileName, fileUrl, extraHeaders = {}) {
  const { token } = config();
  if (!token) throw new Error("Thiếu TELEGRAM_BOT_TOKEN.");
  const source = await fetch(fileUrl, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      ...extraHeaders
    }
  });
  if (!source.ok) throw new Error(`Không tải được ảnh: HTTP ${source.status}`);
  const bytes = await source.arrayBuffer();
  const mime = source.headers.get("content-type") || "image/jpeg";
  return telegramUploadBytes(method, chatId, fields, fileField, fileName, bytes, mime);
}

async function telegramUploadBytes(method, chatId, fields, fileField, fileName, bytes, mimeType = "application/octet-stream") {
  const { token } = config();
  if (!token) throw new Error("Thiếu TELEGRAM_BOT_TOKEN.");
  const form = new FormData();
  Object.entries({ ...fields, chat_id: String(chatId) }).forEach(([key, value]) => {
    form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  });
  form.append(fileField, new Blob([bytes], { type: mimeType }), fileName);
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram HTTP ${response.status}.`);
  return payload.result;
}

function telegramPinUrl(url) {
  const raw = String(url || "").replace(/[?].*$/, "");
  if (!raw) return "";
  if (!/i\.pinimg\.com/i.test(raw)) return raw;
  return raw
    .replace(/i\.pinimg\.com\/originals\//, "i.pinimg.com/736x/")
    .replace(/i\.pinimg\.com\/\d+x\//, "i.pinimg.com/736x/");
}

async function downloadTelegramPhoto(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://www.pinterest.com/"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const mime = String(res.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("image/")) throw new Error("not image");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length || bytes.length > 9.5 * 1024 * 1024) throw new Error("size");
  const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { bytes, mime: mime === "image/jpg" ? "image/jpeg" : mime, extension };
}

async function telegramUploadMediaGroup(chatId, files, caption) {
  const { token } = config();
  if (!token) throw new Error("Thiếu TELEGRAM_BOT_TOKEN.");
  if (!files.length) throw new Error("Không có ảnh để gửi album.");
  const form = new FormData();
  form.append("chat_id", String(chatId));
  const media = files.map((file, index) => ({
    type: "photo",
    media: `attach://${file.filename}`,
    ...(index === 0 && caption ? { caption, parse_mode: "HTML" } : {})
  }));
  form.append("media", JSON.stringify(sanitizeTelegramValue(media)));
  for (const file of files) {
    form.append(file.filename, new Blob([file.bytes], { type: file.mime || "image/jpeg" }), file.filename);
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.description || `Telegram HTTP ${response.status}.`);
  return payload.result;
}

function parseImageDataUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error("Endpoint không trả về Data URI ảnh hợp lệ.");
  const mimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const bytes = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Ảnh sau xử lý vượt giới hạn 10 MB.");
  return { bytes, mimeType, extension: mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg" };
}

async function sendEnhancePhoto(chatId, imageUrl) {
  const source = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
  const mimeType = String(source.headers.get("content-type") || "").toLowerCase();
  if (!source.ok || !mimeType.startsWith("image/")) throw new Error(`Không tải được ảnh WebP HD (HTTP ${source.status}).`);
  const sourceBytes = Buffer.from(await source.arrayBuffer());
  if (!sourceBytes.length || sourceBytes.length > 10 * 1024 * 1024) throw new Error("Ảnh HD vượt giới hạn 10 MB.");
  let pngBytes = sourceBytes;
  try {
    pngBytes = await require("sharp")(sourceBytes).png().toBuffer();
  } catch (_) {}
  const caption = "<b>✨ LÀM NÉT ẢNH AI THÀNH CÔNG</b>\n\nẢnh đã được tải về, chuyển sang PNG và gửi trực tiếp qua Telegram.";
  await clearPreviousBotMessages(chatId);
  const fields = { caption, parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:enhance", "🔄 Dùng lại Làm Nét Ảnh AI") };
  const upload = async (method, fileField) => {
    const result = await telegramUploadBytes(method, chatId, fields, fileField, "enhanced-hd.png", pngBytes, "image/png");
    if (result?.message_id) {
      botMessages.set(String(chatId), result.message_id);
      try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
    }
    return result;
  };
  try {
    return await upload("sendPhoto", "photo");
  } catch (photoError) {
    try {
      return await upload("sendDocument", "document");
    } catch (documentError) {
      return sendTracked("sendMessage", chatId, {
        text: `${caption}\n\n⚠️ <i>Không thể gửi ảnh HD: ${escapeHtml(documentError.message || photoError.message)}</i>`,
        parse_mode: "HTML",
        reply_markup: toolResultKeyboard("tools:enhance", "🔄 Dùng lại Làm Nét Ảnh AI")
      });
    }
  }
}

async function sendRemoveBgPhoto(chatId, dataUrl) {
  const image = parseImageDataUrl(dataUrl);
  const caption = "<b>🖼️ XÓA NỀN AI THÀNH CÔNG</b>\n\nẢnh đã được giải mã từ Data URI và gửi trực tiếp dưới dạng ảnh.";
  await clearPreviousBotMessages(chatId);
  const fields = { caption, parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:removebg", "🔄 Dùng lại Xóa nền AI") };
  const upload = async (method, fileField) => {
    const result = await telegramUploadBytes(method, chatId, fields, fileField, `remove-bg.${image.extension}`, image.bytes, image.mimeType);
    if (result?.message_id) {
      botMessages.set(String(chatId), result.message_id);
      try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
    }
    return result;
  };
  try {
    return await upload("sendPhoto", "photo");
  } catch (photoError) {
    try {
      return await upload("sendDocument", "document");
    } catch (documentError) {
      return sendTracked("sendMessage", chatId, {
        text: `${caption}\n\n⚠️ <i>Không thể gửi ảnh đã xóa nền: ${escapeHtml(documentError.message || photoError.message)}</i>`,
        parse_mode: "HTML",
        reply_markup: toolResultKeyboard("tools:removebg", "🔄 Dùng lại Xóa nền AI")
      });
    }
  }
}

function mainKeyboard(chatId) {
  const { baseUrl } = config();
  return {
    inline_keyboard: [
      [
        { text: "🎲 Tài Xỉu", callback_data: "menu:taixiu" },
        { text: "🎮 Game SUKA88", callback_data: "menu:suka88" }
      ],
      [
        { text: "🎉 Giải trí", callback_data: "menu:giaitri" },
        { text: "📬 Mail", callback_data: "menu:mail" }
      ],
      [
        { text: "🧰 Công Cụ", callback_data: "menu:tools" },
        { text: "📥 Tải media", callback_data: "menu:media" }
      ],
      [
        { text: "🌐 Mạng Xã Hội", callback_data: "menu:social" },
        { text: "ℹ️ Trạng thái API", callback_data: "menu:status" }
      ],
      [
        { text: "💬 Hỗ trợ", url: "https://t.me/zheevipv1" },
        { text: "🚀 Mở Mini App", web_app: { url: baseUrl } }
      ],
      ...(isAdmin(chatId) ? [[{ text: "🛠️ Admin", callback_data: "admin" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]] : [])
    ]
  };
}

function entertainmentText() {
  return `<b>🎉 GIẢI TRÍ</b>\n<i>Nhóm tiện ích giải trí và tra cứu Việt Nam, giống giao diện web</i>\n\n<blockquote>🧠 <b>Đố vui</b> · phòng trắc nghiệm 5 câu, 4 đáp án.\n💬 <b>Danh ngôn</b> · câu nói / lời khuyên hôm nay.\n📅 <b>Lịch âm</b> · dương → âm, can chi, giờ tốt.\n🚗 <b>Biển số</b> · mã tỉnh/thành từ 2 số đầu.\n⛽ <b>Giá xăng</b> · RON 95, E5, Diesel Petrolimex.\n🎉 <b>Ngày lễ</b> · ngày nghỉ và kỳ nghỉ sắp tới.\n📖 <b>Từ điển</b> · đồng nghĩa / trái nghĩa tiếng Việt.\n✍️ <b>Văn bản</b> · bỏ dấu và tạo slug URL.\n🔢 <b>Số thành chữ</b> · đổi số tiền thành chữ hóa đơn.</blockquote>\n\n<i>Chọn một chức năng bên dưới để bắt đầu.</i>`;
}

function entertainmentKeyboard() {
  return { inline_keyboard: [
    [
      { text: "🧠 Đố vui", callback_data: "giaitri:quiz" },
      { text: "💬 Danh ngôn", callback_data: "giaitri:quote" }
    ],
    [
      { text: "📅 Lịch âm", callback_data: "giaitri:lunar" },
      { text: "🚗 Biển số", callback_data: "giaitri:plate" }
    ],
    [
      { text: "⛽ Giá xăng", callback_data: "giaitri:fuel" },
      { text: "🎉 Ngày lễ", callback_data: "giaitri:holidays" }
    ],
    [
      { text: "📖 Từ điển", callback_data: "giaitri:thesaurus" },
      { text: "✍️ Văn bản", callback_data: "giaitri:text" }
    ],
    [
      { text: "🔢 Số thành chữ", callback_data: "giaitri:number" },
      { text: "🏠 Menu chính", callback_data: "menu:home" }
    ]
  ] };
}

function entertainmentResultKeyboard(retryCallback, retryLabel = "🔄 Dùng lại") {
  return { inline_keyboard: [
    [
      { text: retryLabel, callback_data: retryCallback },
      { text: "🎉 Về Giải trí", callback_data: "menu:giaitri" }
    ]
  ] };
}

function entertainmentDateKeyboard(action) {
  return { inline_keyboard: [
    [
      { text: "📅 Dùng ngày hôm nay", callback_data: `${action}:today` },
      { text: "🎉 Về Giải trí", callback_data: "menu:giaitri" }
    ]
  ] };
}

function entertainmentQuizText() {
  return `<b>🧠 PHÒNG ĐỐ VUI</b>\n\nGửi chủ đề hoặc bấm lấy 5 câu ngay.\n\nVí dụ:\n<code>history</code>\n<code>science</code>\n<code>anime</code>\n<code>general 5</code>\n\nChủ đề: general, history, science, games, anime, sports, geography, film, music.\n\nVí dụ API:\n<code>/api/quiz?category=history&amount=5</code>`;
}

function entertainmentQuizKeyboard() {
  return { inline_keyboard: [
    [
      { text: "▶️ Lấy 5 câu", callback_data: "giaitri:quiz:go" },
      { text: "📜 Lịch sử", callback_data: "giaitri:quiz:history" }
    ],
    [
      { text: "🔬 Khoa học", callback_data: "giaitri:quiz:science" },
      { text: "🎮 Game", callback_data: "giaitri:quiz:games" }
    ],
    [
      { text: "🌸 Anime", callback_data: "giaitri:quiz:anime" },
      { text: "🎉 Về Giải trí", callback_data: "menu:giaitri" }
    ]
  ] };
}

function entertainmentLunarText() {
  return `<b>📅 LỊCH ÂM VIỆT NAM</b>\n\nGửi ngày dương <code>YYYY-MM-DD</code> hoặc <code>DD/MM/YYYY</code>.\nBấm <b>Dùng ngày hôm nay</b> nếu không nhập.\n\nVí dụ:\n<code>2026-09-10</code>\n<code>20/09/2026</code>\n\nVí dụ API:\n<code>/api/vn/lunar?date=2026-09-10</code>`;
}

function entertainmentPlateText() {
  return `<b>🚗 TRA CỨU BIỂN SỐ XE</b>\n\nGửi 2 số đầu biển số, ví dụ:\n<code>29</code>\n<code>51A-123.45</code>\n<code>30</code>\n\nVí dụ API:\n<code>/api/vn/plate?code=29</code>`;
}

function entertainmentHolidaysText() {
  return `<b>🎉 NGÀY LỄ VIỆT NAM</b>\n\nGửi ngày dương <code>DD/MM/YYYY</code> hoặc <code>YYYY-MM-DD</code>.\nBấm <b>Dùng ngày hôm nay</b> nếu không nhập.\n\nVí dụ:\n<code>20/09/2026</code>\n<code>2026-09-20</code>\n\nVí dụ API:\n<code>/api/vn/holidays?date=2026-09-20</code>`;
}

function entertainmentThesaurusText() {
  return `<b>📖 TỪ ĐIỂN ĐỒNG NGHĨA</b>\n\nGửi một từ tiếng Việt, ví dụ:\n<code>đẹp</code>\n<code>nhanh</code>\n<code>vui</code>\n<code>thông minh</code>\n\nVí dụ API:\n<code>/api/vn/thesaurus?word=đẹp</code>`;
}

function entertainmentTextToolText() {
  return `<b>✍️ XỬ LÝ VĂN BẢN</b>\n\nGửi câu cần bỏ dấu / tạo slug, ví dụ:\n<code>Học Lập Trình</code>\n<code>Zhee API giải trí</code>\n\nVí dụ API:\n<code>/api/vn/text?text=Học Lập Trình&action=slug</code>`;
}

function entertainmentNumberText() {
  return `<b>🔢 SỐ THÀNH CHỮ</b>\n\nGửi số tiền, ví dụ:\n<code>1500000</code>\n<code>25000000</code>\n\nVí dụ API:\n<code>/api/vn/number-to-words?number=1500000</code>`;
}

function mediaText() {
  return `<b>📥 TẢI MEDIA</b>\n<i>Bóc tách link tải video, audio và ảnh từ URL công khai</i>\n\n<blockquote>🔗 <b>Cobalt</b> · TikTok, Douyin, Facebook, SoundCloud, X. Ưu tiên Cobalt, TikTok/Douyin có TikWM dự phòng.\n🌐 <b>Bóc tách trang</b> · lấy MP4/M3U8 hoặc danh sách ảnh từ URL website.</blockquote>\n\nVí dụ API:\n<code>/api/mxh/cobalt?url=https://www.tiktok.com/@user/video/123</code>\n<code>/downloads?url=https://www.tiktok.com/@user/video/123</code>`;
}

function mediaKeyboard() {
  return { inline_keyboard: [
    [
      { text: "🔗 Cobalt", callback_data: "media:cobalt" },
      { text: "🌐 Bóc tách trang", callback_data: "media:downloads" }
    ],
    [
      { text: "🏠 Menu chính", callback_data: "menu:home" },
      { text: "🌐 Mạng Xã Hội", callback_data: "menu:social" }
    ]
  ] };
}

function mediaResultKeyboard(retryCallback) {
  return { inline_keyboard: [
    [
      { text: "🔄 Link khác", callback_data: retryCallback },
      { text: "📥 Về Tải media", callback_data: "menu:media" }
    ]
  ] };
}

function mediaCobaltText() {
  return `<b>🔗 COBALT</b>\n\nGửi link video, slideshow ảnh hoặc audio.\nBot gửi <b>video và audio</b> nếu có, slideshow thì gửi ảnh + nhạc.\n\nVí dụ:\n<code>https://www.tiktok.com/@user/video/123456789</code>\n<code>https://www.tiktok.com/@user/photo/123456789</code>\n<code>https://x.com/user/status/123</code>`;
}

function mediaDownloadsText() {
  return `<b>🌐 BÓC TÁCH TRANG</b>\n\nGửi URL bài viết hoặc trang có ảnh.\nBot nén ảnh thành file ZIP và gửi lại.\n\nVí dụ:\n<code>https://vi.wikipedia.org/wiki/Hà_Nội</code>`;
}

function mediaKind(url) {
  const value = String(url || "");
  if (!value) return "";
  if (/\.(mp3|m4a|aac)(?:[?#]|$)/i.test(value) || /ies-music|audio_mpeg|\/audio/i.test(value)) return "audio";
  if (/\.(mp4|webm|mov)(?:[?#]|$)/i.test(value) || /video_mp4|\/video\/tos\//i.test(value)) return "video";
  return "file";
}

function mediaCobaltResultText(payload) {
  const video = typeof payload?.link_tai === "string" && mediaKind(payload.link_tai) !== "audio" ? payload.link_tai : "";
  const audio = payload?.link_audio || (mediaKind(payload?.link_tai) === "audio" ? payload.link_tai : "");
  const photos = Array.isArray(payload?.danh_sach_anh) ? payload.danh_sach_anh.length : 0;
  return `<b>📥 KẾT QUẢ TẢI MEDIA</b>\n\n🎬 <b>Nguồn:</b> <i>${escapeHtml(payload?.nguon_tai || "Cobalt")}</i>\n🏷️ <b>Tiêu đề:</b> ${escapeHtml(String(payload?.tieu_de || "-").slice(0, 180))}\n${photos ? `🖼️ <b>Ảnh:</b> <code>${photos}</code>` : ""}\n${video ? `⬇️ <a href="${escapeHtml(video)}">Mở video</a>` : ""}${audio ? `\n🎵 <a href="${escapeHtml(audio)}">Mở audio</a>` : ""}${!video && !audio && !photos ? "\n⚠️ Không có file media." : ""}${payload?.canh_bao ? `\n\n<i>${escapeHtml(payload.canh_bao)}</i>` : ""}`;
}

function mediaDownloadsResultText(payload) {
  if (payload?.loai === "video_stream_extractor") {
    const info = payload.thong_tin_video || {};
    return `<b>🎬 BÓC TÁCH VIDEO</b>\n\n🏷️ <b>Tiêu đề:</b> ${escapeHtml(info.tieu_de || "-")}`;
  }
  const info = payload?.thong_tin_trang || {};
  const images = Array.isArray(payload?.danh_sach_anh) ? payload.danh_sach_anh : [];
  const title = info.tieu_de || payload?.tieu_de || "-";
  const count = info.tong_so_anh ?? images.length;
  return `<b>🖼️ BÓC TÁCH ẢNH</b>\n\n🏷️ <b>${escapeHtml(String(title).slice(0, 180))}</b>\n📦 <code>${escapeHtml(count)}</code> ảnh · đã nén ZIP`;
}

function todayVN() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function normalizeVnDate(input) {
  const raw = String(input || "").trim();
  if (!raw) return todayVN();
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  return "";
}

function entertainmentQuizResultText(payload) {
  const questions = Array.isArray(payload?.cau_hoi) ? payload.cau_hoi.slice(0, 5) : [];
  const rows = questions.map((item, index) => {
    const answers = Array.isArray(item.dap_an) ? item.dap_an : [];
    const options = answers.map((ans, i) => `${String.fromCharCode(65 + i)}. ${escapeHtml(ans)}`).join("\n");
    return `<b>${index + 1}. ${escapeHtml(item.cau_hoi || "-")}</b>\n${options}\n✅ <span class="tg-spoiler">${escapeHtml(item.dap_an_dung || "-")}</span>`;
  }).join("\n\n");
  return `<b>🧠 ĐỐ VUI</b>\n\n📚 <b>Chủ đề:</b> <code>${escapeHtml(payload?.tham_so?.category || "general")}</code>\n📊 <b>Số câu:</b> <code>${escapeHtml(payload?.so_cau_hoi || questions.length)}</code>\n🌐 <b>Nguồn:</b> <i>${escapeHtml(payload?.nguon || "-")}</i>\n\n${rows || "<i>Không có câu hỏi.</i>"}\n\n<i>Chạm vào đáp án ẩn để xem. Bấm lấy câu khác để chơi tiếp.</i>`;
}

function entertainmentQuoteResultText(payload) {
  return `<b>💬 DANH NGÔN HÔM NAY</b>\n\n<blockquote>${escapeHtml(payload?.loi_khuyen_tieng_viet || payload?.quote || "-")}</blockquote>\n\n👤 <b>Tác giả:</b> <i>${escapeHtml(payload?.tac_gia_quote || "Ẩn danh")}</i>\n🌐 <b>Nguồn:</b> <i>${escapeHtml(payload?.nguon || "-")}</i>${payload?.cau_goc ? `\n🇬🇧 <b>Gốc:</b> <i>${escapeHtml(payload.cau_goc)}</i>` : ""}`;
}

function entertainmentLunarResultText(payload) {
  const lunar = payload?.am_lich || {};
  const canChi = payload?.can_chi || {};
  const hours = Array.isArray(payload?.gio_tot) ? payload.gio_tot.join(", ") : "-";
  return `<b>📅 LỊCH ÂM</b>\n\n☀️ <b>Dương lịch:</b> <code>${escapeHtml(payload?.duong_lich || "-")}</code>\n🌙 <b>Âm lịch:</b> <code>${escapeHtml(`${lunar.day || "-"}/${lunar.month || "-"}/${lunar.year || "-"}`)}</code>${lunar.leap ? " · nhuận" : ""}\n🐉 <b>Can chi năm:</b> <i>${escapeHtml(canChi.nam || "-")}</i>\n📌 <b>Can chi ngày:</b> <i>${escapeHtml(canChi.ngay || "-")}</i>\n⏰ <b>Giờ tốt:</b> <i>${escapeHtml(hours)}</i>`;
}

function entertainmentPlateResultText(payload) {
  return `<b>🚗 BIỂN SỐ XE</b>\n\n🔢 <b>Mã:</b> <code>${escapeHtml(payload?.ma_bien_so || "-")}</code>\n📍 <b>Tỉnh/thành:</b> <b>${escapeHtml(payload?.tinh_thanh || "-")}</b>\n${payload?.co_trong_danh_muc ? "✅ Có trong danh mục." : "⚠️ Chưa có trong danh mục."}`;
}

function entertainmentFuelResultText(payload) {
  const gia = payload?.gia_xang_dau || {};
  return `<b>⛽ GIÁ XĂNG DẦU</b>\n\n⛽ <b>RON 95:</b> <code>${escapeHtml(gia.xang_ron_95 || "-")}</code>\n🌱 <b>E5:</b> <code>${escapeHtml(gia.xang_e5 || "-")}</code>\n🚛 <b>Diesel:</b> <code>${escapeHtml(gia.dau_diesel || "-")}</code>\n🌐 <b>Nguồn:</b> <i>${escapeHtml(payload?.nguon_du_lieu || "Petrolimex")}</i>`;
}

function entertainmentHolidaysResultText(payload) {
  const list = Array.isArray(payload?.cac_ngay_le) ? payload.cac_ngay_le : [];
  const rows = list.map((item) => `• <b>${escapeHtml(item.ten || "-")}</b> · <code>${escapeHtml(item.date || "-")}</code>`).join("\n");
  const next = payload?.ky_nghi_sap_toi;
  const delta = Number(payload?.con_bao_nhieu_ngay);
  const holidayLine = payload?.la_ngay_le
    ? `✅ <b>Đây là ngày lễ:</b> ${escapeHtml(payload.ten_ngay_le || "Ngày lễ")}`
    : "ℹ️ Không phải ngày lễ.";
  let waitLine = "";
  if (Number.isFinite(delta)) {
    if (delta === 0) waitLine = "⏳ <b>Bộ đếm:</b> hôm nay chính là ngày này.";
    else if (delta > 0) waitLine = `⏳ <b>Bộ đếm:</b> còn <code>${delta}</code> ngày nữa <i>(từ hôm nay ${escapeHtml(payload.hom_nay || "")})</i>`;
    else waitLine = `⏳ <b>Bộ đếm:</b> đã qua <code>${Math.abs(delta)}</code> ngày.`;
  }
  const nextLine = next
    ? `\n\n⏭️ <b>Kỳ nghỉ tới từ hôm nay:</b> ${escapeHtml(next.ten)} · <code>${escapeHtml(next.date)}</code> · còn <code>${escapeHtml(next.ngay_con_lai)}</code> ngày`
    : "";
  return `<b>🎉 NGÀY LỄ VIỆT NAM</b>\n\n📅 <b>Ngày kiểm tra:</b> <code>${escapeHtml(payload?.ngay_kiem_tra || "-")}</code>\n📆 <b>Hôm nay:</b> <code>${escapeHtml(payload?.hom_nay || "-")}</code>\n${waitLine}\n${holidayLine}\n\n${rows || "<i>Không có dữ liệu.</i>"}${nextLine}`;
}

function entertainmentThesaurusResultText(payload) {
  const result = payload?.ket_qua || {};
  const dong = Array.isArray(result.dong_nghia) && result.dong_nghia.length ? result.dong_nghia.map((item) => escapeHtml(item)).join(", ") : "Chưa có";
  const trai = Array.isArray(result.trai_nghia) && result.trai_nghia.length ? result.trai_nghia.map((item) => escapeHtml(item)).join(", ") : "Chưa có";
  return `<b>📖 TỪ ĐIỂN</b>\n\n🔎 <b>Từ:</b> <code>${escapeHtml(payload?.tu_khoa || "-")}</code>\n🟢 <b>Đồng nghĩa:</b> ${dong}\n🔴 <b>Trái nghĩa:</b> ${trai}${payload?.ghi_chu ? `\n\n<i>${escapeHtml(payload.ghi_chu)}</i>` : ""}`;
}

function entertainmentTextResultText(payload) {
  return `<b>✍️ VĂN BẢN</b>\n\n📝 <b>Gốc:</b> ${escapeHtml(payload?.van_ban || "-")}\n🔤 <b>Không dấu:</b> <code>${escapeHtml(payload?.khong_dau || "-")}</code>\n🔗 <b>Slug:</b> <code>${escapeHtml(payload?.slug || "-")}</code>`;
}

function entertainmentNumberResultText(payload) {
  return `<b>🔢 SỐ THÀNH CHỮ</b>\n\n🔢 <b>Số:</b> <code>${escapeHtml(payload?.so || "-")}</code>\n✍️ <b>Chữ:</b> <b>${escapeHtml(payload?.chu || "-")}</b>`;
}

function socialText() {
  return `<b>🌐 MẠNG XÃ HỘI</b>\n<i>Chọn đúng thương hiệu để mở các chức năng bên trong</i>\n\n<blockquote>💬 <b>NGL</b> · kiểm tra username và gửi tin ẩn danh.\n🔐 <b>Locket</b> · tra cứu profile, UID, avatar và link mời bạn bè.\n🎮 <b>Roblox</b> · tra cứu tài khoản, avatar 3D và chỉ số bạn bè.\n🐙 <b>GitHub</b> · tra cứu profile và danh sách repository công khai.\n🎵 <b>TikTok</b> · lấy thông tin video, video không logo và nhạc MP3.\n▶️ <b>YouTube</b> · lấy thumbnail video trực tiếp.\n𝕏 <b>Twitter</b> · tra cứu profile, bài đăng và media X.\n🛒 <b>Shopee</b> · tra cứu shop, followers, rating, Mall và sản phẩm.\n🛍️ <b>Tiki</b> · tra cứu sản phẩm, giá, shop Tiki.\n🏪 <b>Lazada</b> · tra cứu shop/sản phẩm Lazada công khai.\n📌 <b>Pinterest</b> · tra cứu profile, pin và board.\n\n⚠️ Mỗi công cụ chỉ xử lý đúng chức năng được chọn, không spam hay gửi hàng loạt.</blockquote>\n\n<i>Chọn thương hiệu bên dưới để bắt đầu.</i>`;
}

function socialKeyboard() {
  return { inline_keyboard: [
    [
      { text: "💬 NGL", callback_data: "social:ngl" },
      { text: "🔐 Locket", callback_data: "social:locket" }
    ],
    [
      { text: "🎵 Spotify", callback_data: "social:spotify" },
      { text: "☁️ SoundCloud", callback_data: "social:soundcloud" }
    ],
    [
      { text: "🎮 Roblox", callback_data: "social:roblox" },
      { text: "🐙 GitHub", callback_data: "social:github" }
    ],
    [
      { text: "🎵 TikTok", callback_data: "social:tiktok" },
      { text: "▶️ YouTube", callback_data: "social:youtube" }
    ],
    [
      { text: "💬 Discord", callback_data: "social:discord" },
      { text: "✈️ Telegram", callback_data: "social:telegram" }
    ],
    [
      { text: "𝕏 Twitter", callback_data: "social:twitter" },
      { text: "🛒 Shopee", callback_data: "social:shopee" }
    ],
    [
      { text: "🛍️ Tiki", callback_data: "social:tiki" },
      { text: "🏪 Lazada", callback_data: "social:lazada" }
    ],
    [
      { text: "📌 Pinterest", callback_data: "social:pinterest" },
      { text: "🏠 Menu chính", callback_data: "menu:home" }
    ]
  ] };
}

function soundcloudText() {
  return `<b>☁️ SOUNDCLOUD</b>\n<i>Tra cứu bài hát và phát audio trực tiếp</i>\n\nGửi một trong các dạng sau:\n<code>Cắt Đôi Nỗi Sầu</code>\n<code>Cat Doi Noi Sau</code>\n<code>https://soundcloud.com/...</code>\n\n<i>Bot sẽ trả về ảnh bìa, tác giả, lượt nghe, link SoundCloud và gửi audio MP3 nếu link còn hiệu lực.</i>`;
}

function soundcloudResultText(payload) {
  const data = payload?.du_lieu?.ket_qua_chinh || {};
  const seconds = Number(data.thoi_luong_giay || 0);
  const duration = seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "-";
  return `<b>☁️ SOUNDCLOUD TRACK</b>\n\n🎼 <b>Bài hát</b>\n<i>${escapeHtml(data.tieu_de || "-")}</i>\n\n🎤 <b>Tác giả:</b> ${escapeHtml(data.tac_gia || "-")}\n🎚️ <b>Thể loại:</b> ${escapeHtml(data.the_loai || "-")}\n⏱️ <b>Thời lượng:</b> <code>${duration}</code>\n👂 <b>Lượt nghe:</b> <code>${escapeHtml(data.luot_nghe || "-")}</code>\n❤️ <b>Lượt thích:</b> <code>${escapeHtml(data.luot_thich || "-")}</code>\n\n🔗 <a href="${escapeHtml(data.soundcloud_url || "#")}">Mở trên SoundCloud</a>`;
}

function soundcloudRelatedText(payload) {
  const related = Array.isArray(payload?.du_lieu?.danh_sach_lien_quan)
    ? payload.du_lieu.danh_sach_lien_quan.slice(0, 10)
    : [];
  if (!related.length) return "";
  const rows = related.map((item, index) => {
    const title = escapeHtml(item.tieu_de || "Không có tiêu đề");
    const author = escapeHtml(item.tac_gia || "Không rõ");
    const link = item.soundcloud_url ? `<a href="${escapeHtml(item.soundcloud_url)}">Mở</a>` : "";
    return `${index + 1}. <b>${title}</b>\n   🎤 ${author}${link ? ` · ${link}` : ""}`;
  }).join("\n\n");
  return `<b>☁️ KẾT QUẢ SOUNDCLOUD LIÊN QUAN</b>\n\n${rows}`;
}

function soundcloudResultKeyboard(payload) {
  const data = payload?.du_lieu?.ket_qua_chinh || {};
  const rows = [];
  if (data.link_audio_mp3) rows.push([{ text: "▶️ Phát / tải audio MP3", url: data.link_audio_mp3 }]);
  if (data.link_stream_truc_tiep_tai_api) rows.push([{ text: "🔗 Stream qua API", url: data.link_stream_truc_tiep_tai_api }]);
  rows.push([{ text: "🔄 Tra cứu bài khác", callback_data: "social:soundcloud" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function spotifyText() {
  return `<b>🎵 SPOTIFY</b>\n<i>Tra cứu bài hát, nghệ sĩ và lời bài hát</i>\n\nGửi một trong các dạng sau:\n<code>Sơn Tùng M-TP Âm Thầm Bên Em</code>\n<code>https://open.spotify.com/track/...</code>\n<code>2wZAvkgiOE5tyrnqhB69KA</code>\n\n<i>Bot sẽ trả về ảnh bìa, ca sĩ, album, link Spotify, link tải/stream và lời bài hát nếu có.</i>`;
}

function spotifyResultText(payload) {
  const data = payload?.du_lieu || {};
  const seconds = Number(data.thoi_luong_giay || 0);
  const duration = seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "-";
  return `<b>🎵 SPOTIFY TRACK</b>\n\n🎼 <b>Bài hát</b>\n<i>${escapeHtml(data.ten_bai_hat || "-")}</i>\n\n🎤 <b>Ca sĩ:</b> ${escapeHtml(data.ca_si || "-")}\n💿 <b>Album:</b> ${escapeHtml(data.album || "-")}\n📅 <b>Phát hành:</b> <code>${escapeHtml(data.ngay_phat_hanh || "-")}</code>\n⏱️ <b>Thời lượng:</b> <code>${duration}</code>\n🔥 <b>Độ phổ biến:</b> <code>${escapeHtml(data.do_pho_bien || "-")}</code>\n\n🔗 <a href="${escapeHtml(data.spotify_url || "#")}">Mở trên Spotify</a>`;
}

function spotifyResultKeyboard(payload) {
  const data = payload?.du_lieu || {};
  const rows = [];
  if (data.link_tai_mp3) rows.push([{ text: "⬇️ Tải MP3", url: data.link_tai_mp3 }]);
  if (data.link_stream_truc_tiep) rows.push([{ text: "▶️ Stream trực tiếp", url: data.link_stream_truc_tiep }]);
  rows.push([{ text: "🔄 Tra cứu bài khác", callback_data: "social:spotify" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function spotifyErrorKeyboard() {
  return { inline_keyboard: [
    [{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }],
    [{ text: "🔄 Tra cứu lại Spotify", callback_data: "social:spotify" }],
    [{ text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function locketCheckText() {
  return `<b>🔐 CHECK LOCKET USERNAME</b>\n\nGửi username hoặc link profile, ví dụ:\n<code>minh</code>\n<code>https://locket.cam/minh</code>\n\nVí dụ API:\n<code>/api/tools/locket?username=minh</code>`;
}

function locketResultText(payload) {
  const data = payload?.du_lieu || {};
  const status = String(data.tinh_trang || payload?.thong_bao || "Đã xử lý");
  const statusIcon = /đã đăng ký|thành công/i.test(status) ? "✅" : /còn trống/i.test(status) ? "🟢" : "📌";
  const details = [
    `👤 <b>Username</b>\n<code>@${escapeHtml(data.username || "-")}</code>`,
    `${statusIcon} <b>Trạng thái</b>\n${escapeHtml(status)}`,
    data.uid ? `🆔 <b>UID</b>\n<code>${escapeHtml(data.uid)}</code>` : "",
    data.tai_khoan_noi_tieng ? `⭐ <b>Tài khoản nổi tiếng</b>\n<code>${escapeHtml(data.tai_khoan_noi_tieng)}</code>` : "",
    data.may_chu_kiem_tra ? `🛰️ <b>Nguồn kiểm tra</b>\n${escapeHtml(data.may_chu_kiem_tra)}` : ""
  ].filter(Boolean).join("\n\n");
  return `<b>🔐 LOCKET USERNAME LOOKUP</b>\n\n<blockquote>${details}</blockquote>`;
}

function locketResultKeyboard(payload) {
  const data = payload?.du_lieu || {};
  const rows = [];
  if (data.link_profile) rows.push([{ text: "👤 Mở Locket Profile", url: data.link_profile }]);
  if (data.link_moi_ban_be) rows.push([{ text: "🤝 Mở link mời bạn bè", url: data.link_moi_ban_be }]);
  rows.push([{ text: "🔄 Check Locket khác", callback_data: "social:locket" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function tiktokText() {
  return `<b>🎵 TIKTOK</b>\n<i>Chọn đúng loại thao tác trước khi nhập dữ liệu</i>\n\n🎬 <b>Tải video</b> · link video TikTok, không logo.\n🖼️ <b>Tải ảnh</b> · link TikTok Photo Mode.\n🔎 <b>Check username</b> · username hoặc link trang cá nhân.`;
}

function tiktokModeKeyboard() {
  return { inline_keyboard: [
    [{ text: "🎬 Tải video", callback_data: "social:tiktok:video" }, { text: "🖼️ Tải ảnh", callback_data: "social:tiktok:photo" }],
    [{ text: "🔎 Check username", callback_data: "social:tiktok:profile" }],
    [{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function tiktokModeText(mode) {
  if (mode === "profile") return `<b>🔎 CHECK TIKTOK USERNAME</b>\n\nGửi username hoặc link trang cá nhân:\n<code>pitochk</code>\n<code>https://www.tiktok.com/@pitochk</code>`;
  if (mode === "photo") return `<b>🖼️ TẢI ẢNH TIKTOK</b>\n\nGửi link Photo Mode:\n<code>https://www.tiktok.com/@user/photo/123456789</code>`;
  return `<b>🎬 TẢI VIDEO TIKTOK</b>\n\nGửi link video TikTok từ web hoặc app:\n<code>https://www.tiktok.com/@user/video/123456789</code>\n<code>https://vm.tiktok.com/...</code>`;
}

function tiktokProfileText(payload) {
  const data = payload?.thong_tin_ca_nhan || {};
  return `<b>🎵 TIKTOK PROFILE</b>\n\n👤 <b>Username:</b> <code>@${escapeHtml(data.tai_khoan || "-")}</code>\n🏷️ <b>Tên hiển thị:</b> ${escapeHtml(data.ho_ten || "-")}\n📝 <b>Tiểu sử:</b> ${escapeHtml(data.tieu_su || "-")}\n✅ <b>Tích xanh:</b> ${data.tich_xanh ? "Có" : "Không"}\n🔒 <b>Tài khoản riêng tư:</b> ${data.tai_khoan_rieng_tu ? "Có" : "Không"}\n\n👥 <b>Followers:</b> <code>${escapeHtml(data.nguoi_theo_doi ?? "-")}</code>\n➕ <b>Following:</b> <code>${escapeHtml(data.dang_theo_doi ?? "-")}</code>\n❤️ <b>Tổng lượt thích:</b> <code>${escapeHtml(data.tong_luot_thich ?? "-")}</code>\n🎬 <b>Tổng video:</b> <code>${escapeHtml(data.tong_so_video ?? "-")}</code>`;
}

function tiktokProfileKeyboard(payload) {
  const data = payload?.thong_tin_ca_nhan || {};
  return { inline_keyboard: [
    ...(data.link_trang_ca_nhan ? [[{ text: "👤 Mở TikTok Profile", url: data.link_trang_ca_nhan }]] : []),
    [{ text: "🔄 Check TikTok khác", callback_data: "social:tiktok" }],
    [{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function tiktokPhotoText(payload) {
  const author = payload?.tac_gia || {};
  return `<b>🎵 TIKTOK PHOTO</b>\n\n📝 <b>Nội dung:</b>\n<i>${escapeHtml(String(payload?.tieu_de || "Không có tiêu đề").slice(0, 700))}</i>\n\n👤 <b>Tác giả:</b> ${escapeHtml(author.ten_hien_thi || author.username || "-")}\n🔗 <a href="${escapeHtml(author.link_trang_ca_nhan || "#")}">Mở trang cá nhân</a>`;
}

function tiktokResultText(payload) {
  const author = payload?.tac_gia || {};
  return `<b>🎵 TIKTOK VIDEO</b>\n\n📝 <b>Tiêu đề:</b>\n<i>${escapeHtml(String(payload?.tieu_de || "Không có tiêu đề").slice(0, 700))}</i>\n\n👤 <b>Tác giả:</b> ${escapeHtml(author.ten_hien_thi || author.username || "-")}\n🔗 <a href="${escapeHtml(author.link_trang_ca_nhan || "#")}">Mở trang cá nhân</a>\n\n📥 <b>Video:</b> không logo\n🎵 <b>Audio:</b> MP3 nếu link còn hiệu lực.`;
}

function tiktokResultKeyboard(payload) {
  const author = payload?.tac_gia || {};
  const links = payload?.link_tai || {};
  const rows = [];
  if (Array.isArray(links.anh) && links.anh[0]) rows.push([{ text: "🖼️ Mở ảnh TikTok", url: links.anh[0] }]);
  if (links.video_khong_logo) rows.push([{ text: "⬇️ Mở video không logo", url: links.video_khong_logo }]);
  if (links.nhac_mp3) rows.push([{ text: "🎵 Mở nhạc MP3", url: links.nhac_mp3 }]);
  if (author.link_trang_ca_nhan) rows.push([{ text: "👤 Mở TikTok Profile", url: author.link_trang_ca_nhan }]);
  rows.push([{ text: "🔄 Tải TikTok khác", callback_data: "social:tiktok" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function tiktokPhotoPageKeyboard(payload, page, totalPages) {
  const author = payload?.tac_gia || {};
  const links = payload?.link_tai || {};
  const rows = [];
  const navigation = [];
  if (page > 1) navigation.push({ text: "⬅️ Trang trước", callback_data: `social:tiktok:photo:page:${page - 1}` });
  if (page < totalPages) navigation.push({ text: "Trang sau ➡️", callback_data: `social:tiktok:photo:page:${page + 1}` });
  if (navigation.length) rows.push(navigation);
  if (Array.isArray(links.anh) && links.anh[0]) rows.push([{ text: "🖼️ Mở ảnh hiện tại", url: links.anh[(page - 1) * 10] || links.anh[0] }]);
  if (links.nhac_mp3) rows.push([{ text: "🎵 Mở nhạc MP3", url: links.nhac_mp3 }]);
  if (author.link_trang_ca_nhan) rows.push([{ text: "👤 Mở TikTok Profile", url: author.link_trang_ca_nhan }]);
  rows.push([{ text: "🔄 Tải TikTok khác", callback_data: "social:tiktok" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

async function sendTiktokPhotoPage(chatId, session, requestedPage = 1) {
  const payload = session?.payload || {};
  const links = Array.isArray(payload?.link_tai?.anh) ? payload.link_tai.anh.filter(Boolean) : [];
  const totalPages = Math.max(1, Math.ceil(links.length / 10));
  const page = Math.min(totalPages, Math.max(1, Number(requestedPage) || 1));
  const pageLinks = links.slice((page - 1) * 10, page * 10);
  const keyboard = tiktokPhotoPageKeyboard(payload, page, totalPages);
  const caption = `${tiktokPhotoText(payload)}\n\n🖼️ <b>Trang ${page}/${totalPages}</b>`;

  await clearPreviousBotMessages(chatId);
  const ids = [];
  if (pageLinks.length > 1) {
    const media = pageLinks.map((photo, index) => ({
      type: "photo",
      media: photo,
      ...(index === 0 ? { caption, parse_mode: "HTML" } : {})
    }));
    try {
      const group = await telegram("sendMediaGroup", { chat_id: chatId, media });
      if (Array.isArray(group)) group.forEach((item) => item?.message_id && ids.push(item.message_id));
    } catch (_) {
      // Some TikTok CDN image URLs are rejected as a group by Telegram.
      // Retry each image separately so the gallery is not reduced to image 1.
      for (const [index, photo] of pageLinks.entries()) {
        try {
          const result = await telegram("sendPhoto", {
            chat_id: chatId,
            photo,
            ...(index === 0 ? { caption, parse_mode: "HTML" } : {})
          });
          if (result?.message_id) ids.push(result.message_id);
        } catch (_) {}
      }
    }
  } else if (pageLinks[0]) {
    try {
      const result = await telegram("sendPhoto", {
        chat_id: chatId,
        photo: pageLinks[0],
        caption,
        parse_mode: "HTML",
        reply_markup: keyboard
      });
      if (result?.message_id) ids.push(result.message_id);
    } catch (_) {}
  }

  if (pageLinks.length > 1 || !pageLinks.length) {
    const result = await telegram("sendMessage", {
      chat_id: chatId,
      text: pageLinks.length ? `🖼️ <b>TikTok Photo · Trang ${page}/${totalPages}</b>` : `${tiktokPhotoText(payload)}\n\n⚠️ Không tìm thấy ảnh trong bài đăng.`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: keyboard
    });
    if (result?.message_id) ids.push(result.message_id);
  }
  botMessages.set(String(chatId), ids);
  try { await setBotMessageId(chatId, ids); } catch (_) {}
  return ids;
}

function youtubeText() {
  return `<b>▶️ YOUTUBE THUMBNAIL</b>\n\nGửi link video YouTube hoặc video ID, ví dụ:\n<code>https://youtu.be/dQw4w9WgXcQ</code>\n<code>dQw4w9WgXcQ</code>\n\nBot sẽ gửi ảnh thumbnail chất lượng cao trực tiếp.`;
}

function youtubeResultKeyboard(payload) {
  const thumbnails = payload?.thumbnails || {};
  const rows = [];
  if (thumbnails.maxresdefault) rows.push([{ text: "🖼️ Mở ảnh MaxRes", url: thumbnails.maxresdefault }]);
  if (thumbnails.hqdefault) rows.push([{ text: "🖼️ Mở ảnh HQ", url: thumbnails.hqdefault }]);
  if (thumbnails.sddefault) rows.push([{ text: "🖼️ Mở ảnh SD", url: thumbnails.sddefault }]);
  if (payload?.id_video) rows.push([{ text: "▶️ Mở video YouTube", url: `https://www.youtube.com/watch?v=${encodeURIComponent(payload.id_video)}` }]);
  rows.push([{ text: "🔄 Lấy thumbnail khác", callback_data: "social:youtube" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

async function handleYoutubeThumbnail(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const value = String(input || "").trim();
  const validInput = value.length <= 2048 && (
    /^[a-zA-Z0-9_-]{11}$/.test(value) ||
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}(?:[?&#].*)?$/i.test(value)
  );
  if (!validInput) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Link YouTube chưa hợp lệ</b>\n\nGửi link YouTube hoặc video ID gồm 11 ký tự.",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:youtube")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang lấy thumbnail YouTube...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/youtube?action=thumbnail&url=${encodeURIComponent(value)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `YouTube API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const photo = payload.thumbnails?.maxresdefault || payload.thumbnails?.hqdefault || payload.thumbnails?.sddefault;
    if (!photo) throw new Error("YouTube không trả về thumbnail.");
    const caption = `<b>▶️ YOUTUBE THUMBNAIL</b>\n\n🆔 <b>Video ID:</b> <code>${escapeHtml(payload.id_video || "-")}</code>\n\n🖼️ Thumbnail đã được gửi trực tiếp.`;
    return sendTracked("sendPhoto", chatId, { photo, caption, parse_mode: "HTML", reply_markup: youtubeResultKeyboard(payload) });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:youtube" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể lấy thumbnail YouTube</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:youtube")
    });
  }
}

function telegramLookupText() {
  return `<b>✈️ TELEGRAM LOOKUP</b>\n\nGửi username hoặc link Telegram:\n<code>@durov</code>\n<code>https://t.me/durov</code>\n\nBot sẽ trả về tên hiển thị, avatar, mô tả, loại tài khoản và số người đăng ký/thành viên.`;
}

function telegramLookupResultText(payload) {
  const info = payload?.thong_tin || {};
  const details = [
    `👤 <b>Username:</b> <code>${escapeHtml(info.username || "-")}</code>`,
    `🏷️ <b>Tên hiển thị:</b> ${escapeHtml(info.ten_hien_thi || "-")}`,
    `📂 <b>Loại:</b> ${escapeHtml(payload?.loai || "-")}`,
    `📝 <b>Mô tả:</b> ${escapeHtml(info.mo_ta_tieu_su || "Không có mô tả")}`,
    info.anh_dai_dien ? `🖼️ <a href="${escapeHtml(info.anh_dai_dien)}">Mở ảnh đại diện</a>` : "",
    info.tong_thanh_vien ? `👥 <b>Thành viên:</b> ${escapeHtml(info.tong_thanh_vien)}` : "",
    info.thanh_vien_online ? `🟢 <b>Đang online:</b> ${escapeHtml(info.thanh_vien_online)}` : ""
  ].filter(Boolean).join("\n");
  return `<b>✈️ TELEGRAM LOOKUP</b>\n\n<blockquote>${details}</blockquote>`;
}

function telegramLookupKeyboard(payload) {
  const info = payload?.thong_tin || {};
  const rows = [];
  if (info.anh_dai_dien) rows.push([{ text: "🖼️ Mở ảnh đại diện", url: info.anh_dai_dien }]);
  if (info.link_truy_cap) rows.push([{ text: "🔗 Mở Telegram", url: info.link_truy_cap }]);
  if (info.link_app) rows.push([{ text: "📱 Mở trong Telegram", url: info.link_app }]);
  if (info.link_khoi_chay_bot) rows.push([{ text: "▶️ Start Bot", url: info.link_khoi_chay_bot }]);
  rows.push([{ text: "🔄 Tra cứu Telegram khác", callback_data: "social:telegram" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

async function handleTelegramLookup(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const query = String(input || "").trim();
  if (!query || query.length > 2048) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Username Telegram chưa hợp lệ</b>\n\nGửi dạng <code>@durov</code> hoặc <code>https://t.me/durov</code>.",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:telegram")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tra cứu Telegram...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/mxh/telegram?username=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Telegram API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const info = payload.thong_tin || {};
    const caption = telegramLookupResultText(payload);
    const keyboard = telegramLookupKeyboard(payload);
    if (info.anh_dai_dien) {
      try {
        // Telegram sometimes cannot fetch telesco.pe CDN URLs directly.
        // Download the image on the server and upload the bytes instead.
        await clearPreviousBotMessages(chatId);
        const result = await telegramUpload(
          "sendPhoto",
          chatId,
          { caption, parse_mode: "HTML", reply_markup: keyboard },
          "photo",
          "telegram-avatar.jpg",
          info.anh_dai_dien
        );
        if (result?.message_id) {
          botMessages.set(String(chatId), result.message_id);
          try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
        }
        return result;
      } catch (_) {}
    }
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:telegram" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu Telegram</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:telegram")
    });
  }
}

function twitterText() {
  return `<b>𝕏 TWITTER / X</b>\n\nGửi username hoặc link profile/bài đăng:\n<code>elonmusk</code>\n<code>https://x.com/i/web/status/2091794831005589513</code>\n\nBot sẽ trả về thông tin profile hoặc gửi video/ảnh trong bài đăng trực tiếp.`;
}

function twitterResultKeyboard(payload) {
  const profile = payload?.thong_tin_ca_nhan || {};
  const tweet = payload?.thong_tin_tweet || {};
  const author = tweet.tac_gia || {};
  const data = Object.keys(profile).length ? profile : author;
  const rows = [];
  if (data.anh_dai_dien) rows.push([{ text: "🖼️ Mở ảnh đại diện", url: data.anh_dai_dien }]);
  if (profile.anh_banner) rows.push([{ text: "🎨 Mở banner X", url: profile.anh_banner }]);
  if (profile.link_trang_ca_nhan || author.link_trang_ca_nhan) rows.push([{ text: "𝕏 Mở trang X", url: profile.link_trang_ca_nhan || author.link_trang_ca_nhan }]);
  const tweetThumbnail = payload?.media?.danh_sach_video_mp4?.[0]?.anh_thumbnail || payload?.media?.danh_sach_anh?.[0]?.url;
  if (tweetThumbnail) rows.push([{ text: "🖼️ Mở thumbnail/ảnh", url: tweetThumbnail }]);
  if (tweet.link_goc) rows.push([{ text: "🔗 Mở bài đăng", url: tweet.link_goc }]);
  rows.push([{ text: "🔄 Tra cứu Twitter khác", callback_data: "social:twitter" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function twitterProfileText(payload) {
  const profile = payload?.thong_tin_ca_nhan || {};
  const stats = profile.thong_ke || {};
  const details = [
    `👤 <b>Tài khoản:</b> <code>${escapeHtml(profile.tai_khoan || "-")}</code>`,
    `🏷️ <b>Họ tên:</b> ${escapeHtml(profile.ho_ten || "-")}`,
    `📝 <b>Tiểu sử:</b> ${escapeHtml(profile.tieu_su || "Không có")}`,
    `📍 <b>Địa chỉ:</b> ${escapeHtml(profile.dia_chi || "Không có")}`,
    `👥 <b>Followers:</b> <code>${escapeHtml(stats.nguoi_theo_doi ?? 0)}</code>`,
    `➕ <b>Following:</b> <code>${escapeHtml(stats.dang_theo_doi ?? 0)}</code>`,
    `📝 <b>Tổng Tweet:</b> <code>${escapeHtml(stats.tong_so_tweet ?? 0)}</code>`,
    `❤️ <b>Lượt thích:</b> <code>${escapeHtml(stats.luot_thich ?? 0)}</code>`
  ].join("\n");
  return `<b>𝕏 TWITTER PROFILE</b>\n\n<blockquote>${details}</blockquote>`;
}

function twitterTweetText(payload) {
  const tweet = payload?.thong_tin_tweet || {};
  const author = tweet.tac_gia || {};
  const stats = tweet.thong_ke || {};
  const details = [
    `🆔 <b>Tweet ID:</b> <code>${escapeHtml(tweet.id_tweet || "-")}</code>`,
    `👤 <b>Tác giả:</b> ${escapeHtml(author.ten_hien_thi || "-")} <code>${escapeHtml(author.username || "")}</code>`,
    `📝 <b>Nội dung:</b>\n${escapeHtml(String(tweet.noi_dung || "Không có nội dung").slice(0, 900))}`,
    `📅 <b>Ngày đăng:</b> ${escapeHtml(tweet.ngay_dang || "-")} · 🌐 <b>Ngôn ngữ:</b> <code>${escapeHtml(tweet.ngon_ngu || "-")}</code>`,
    `❤️ ${escapeHtml(stats.luot_thich ?? 0)} · 🔁 ${escapeHtml(stats.luot_retweet ?? 0)} · 💬 ${escapeHtml(stats.luot_phan_hoi ?? 0)} · 👁️ ${escapeHtml(stats.luot_xem ?? 0)}`,
    tweet.link_goc ? `🔗 <a href="${escapeHtml(tweet.link_goc)}">Mở bài đăng gốc</a>` : ""
  ].filter(Boolean).join("\n\n");
  return `<b>𝕏 TWEET</b>\n\n<blockquote>${details}</blockquote>`;
}

async function sendTwitterVideoUpload(chatId, video, caption, keyboard) {
  const source = await fetch(video, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "video/mp4,video/*" },
    signal: AbortSignal.timeout(30000)
  });
  if (!source.ok) throw new Error(`Twitter video HTTP ${source.status}`);
  const bytes = await source.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 50 * 1024 * 1024) {
    throw new Error("Twitter video vượt giới hạn upload Telegram 50 MB.");
  }
  return telegramUploadBytes(
    "sendVideo",
    chatId,
    { caption, parse_mode: "HTML", supports_streaming: "true", reply_markup: keyboard },
    "video",
    "twitter-video.mp4",
    bytes,
    "video/mp4"
  );
}

async function handleTwitter(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const query = String(input || "").trim();
  if (!query || query.length > 2048) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Username/link Twitter chưa hợp lệ</b>\n\nGửi <code>elonmusk</code> hoặc link bài đăng X.",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:twitter")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tra cứu Twitter/X...</b>", parse_mode: "HTML" });
    const isTweet = /\/status(?:es)?\/\d+/i.test(query);
    const key = isTweet ? "url" : "username";
    let response;
    let payload = {};
    for (let attempt = 0; attempt < (isTweet ? 2 : 1); attempt += 1) {
      response = await fetch(`${baseUrl}/api/mxh/twitter?${key}=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(45000) });
      payload = await response.json().catch(() => ({}));
      if (response.ok && payload.trang_thai === "thanh_cong") break;
      if (attempt === 0 && isTweet) await new Promise((resolve) => setTimeout(resolve, 900));
    }
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Twitter API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const keyboard = twitterResultKeyboard(payload);
    if (payload.loai === "twitter_user") {
      const profile = payload.thong_tin_ca_nhan || {};
      const caption = twitterProfileText(payload);
      if (profile.anh_dai_dien) {
        try { return await sendTracked("sendPhoto", chatId, { photo: profile.anh_dai_dien, caption, parse_mode: "HTML", reply_markup: keyboard }); } catch (_) {}
      }
      return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
    }
    if (payload.loai === "tweet") {
      const caption = twitterTweetText(payload);
      const videos = Array.isArray(payload.media?.danh_sach_video_mp4) ? payload.media.danh_sach_video_mp4 : [];
      const photos = Array.isArray(payload.media?.danh_sach_anh) ? payload.media.danh_sach_anh : [];
      const video = videos[0]?.file_mp4_truc_tiep;
      const thumbnail = videos[0]?.anh_thumbnail || photos[0]?.url;

      if (video) {
        try {
          await clearPreviousBotMessages(chatId);
          const result = await sendTwitterVideoUpload(chatId, video, caption, keyboard);
          if (result?.message_id) {
            botMessages.set(String(chatId), result.message_id);
            try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
          }
          return result;
        } catch (_) {
          const linkKeyboard = {
            inline_keyboard: [
              [{ text: "🔗 Mở link video MP4", url: video }],
              ...keyboard.inline_keyboard
            ]
          };
          return sendTracked("sendMessage", chatId, {
            text: `${caption}\n\n⚠️ <b>Telegram không tải trực tiếp được video.</b>\n🔗 <a href="${escapeHtml(video)}">Mở link video MP4</a>`,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: linkKeyboard
          });
        }
      }
      if (thumbnail) {
        try { return await sendTracked("sendPhoto", chatId, { photo: thumbnail, caption, parse_mode: "HTML", reply_markup: keyboard }); } catch (_) {}
      }
      return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
    }
    throw new Error("Twitter API chưa trả về dữ liệu được hỗ trợ.");
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:twitter" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu Twitter/X</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:twitter")
    });
  }
}

function discordText() {
  return `<b>💬 DISCORD</b>\n\nGửi một trong các dạng sau để tra cứu:\n<code>https://discord.gg/4CJ2cWu2W</code>\n<code>4CJ2cWu2W</code>\n<code>1193464466034135170</code>\n\nBot sẽ nhận diện server invite, Server ID, User ID hoặc Discord token.`;
}

function discordResultKeyboard(payload) {
  const server = payload?.thong_tin_may_chu || {};
  const rows = [];
  if (server.link_moi) rows.push([{ text: "🔗 Mở link mời Server", url: server.link_moi }]);
  if (server.anh_banner) rows.push([{ text: "🖼️ Mở banner Server", url: server.anh_banner }]);
  rows.push([{ text: "🔄 Tra cứu Discord khác", callback_data: "social:discord" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function discordServerText(payload) {
  const server = payload?.thong_tin_may_chu || {};
  const stats = server.thong_ke || {};
  return `<b>💬 DISCORD SERVER</b>\n\n🏷️ <b>Tên server:</b> ${escapeHtml(server.ten_server || "-")}\n🆔 <b>Server ID:</b> <code>${escapeHtml(server.id || "-")}</code>\n📝 <b>Mô tả:</b> ${escapeHtml(server.mo_ta || "Không có mô tả")}\n\n🟢 <b>Đang online:</b> <code>${escapeHtml(stats.thanh_vien_online ?? "-")}</code>\n👥 <b>Tổng thành viên:</b> <code>${escapeHtml(stats.tong_thanh_vien ?? "-")}</code>`;
}

function discordAccountText(payload) {
  const account = payload?.thong_tin_tai_khoan || {};
  const activity = payload?.thong_ke_hoat_dong || {};
  const details = [
    `👤 <b>Tài khoản:</b> <code>${escapeHtml(account.tai_khoan || "-")}</code>`,
    `🏷️ <b>Tên hiển thị:</b> ${escapeHtml(account.ten_hien_thi || "-")}`,
    `🆔 <b>User ID:</b> <code>${escapeHtml(account.id || "-")}</code>`,
    `🏷️ <b>Tag:</b> ${escapeHtml(account.tag || "-")}`,
    `🚀 <b>Nitro:</b> ${escapeHtml(account.tinh_trang_nitro || "Không có")}`,
    `✉️ <b>Email:</b> <code>${escapeHtml(account.email || "Chưa liên kết")}</code>${account.da_xac_minh_email ? " ✅" : ""}`,
    `📱 <b>Số điện thoại:</b> ${account.so_dien_thoai && !/chưa thêm|không/i.test(String(account.so_dien_thoai)) ? "Đã thêm" : "Chưa thêm"}`,
    `🔐 <b>2FA:</b> ${account.xac_thuc_2fa ? "Đã bật" : "Chưa bật"}`,
    `🌐 <b>Ngôn ngữ:</b> <code>${escapeHtml(account.ngon_ngu || "-")}</code>`,
    `🔞 <b>Nội dung NSFW:</b> ${account.che_do_nsfw ? "Được phép" : "Không"} · 🏅 <b>Huy hiệu:</b> <code>${escapeHtml(account.huy_hieu_badges ?? 0)}</code>`,
    `🏠 <b>Máy chủ:</b> <code>${escapeHtml(activity.tong_so_may_chu ?? 0)}</code> · 🔗 <b>Liên kết:</b> <code>${escapeHtml(activity.tong_so_ket_noi ?? 0)}</code>`
  ].join("\n");
  return `<b>💬 DISCORD ACCOUNT</b>\n\n<blockquote>${details}</blockquote>`;
}

function discordAccountServersText(payload) {
  const servers = payload?.thong_ke_hoat_dong?.danh_sach_may_chu || [];
  if (!servers.length) return "<b>🏠 MÁY CHỦ DISCORD</b>\n\n<blockquote><i>Không có danh sách máy chủ công khai.</i></blockquote>";
  const rows = servers.map((server) => {
    const role = server.la_chu_phong ? " · 👑 Chủ phòng" : server.quyen_admin ? " · 🛡️ Admin" : "";
    const icon = server.icon ? ` · <a href="${escapeHtml(server.icon)}">🖼️ Icon</a>` : "";
    return `${server.stt || "-"}. <b>${escapeHtml(server.ten_server || "Không tên")}</b>${icon}\n<code>${escapeHtml(server.id_server || "-")}</code> · 👥 ${escapeHtml(server.so_thanh_vien_uoc_tinh ?? "-")}${role}`;
  }).join("\n\n");
  return `<b>🏠 MÁY CHỦ DISCORD · ${servers.length}</b>\n\n<blockquote>${rows}</blockquote>`;
}

function discordAccountConnectionsText(payload) {
  const connections = payload?.thong_ke_hoat_dong?.cac_tai_khoan_lien_ket || [];
  if (!connections.length) return "<b>🔗 TÀI KHOẢN LIÊN KẾT</b>\n\n<blockquote><i>Không có tài khoản liên kết.</i></blockquote>";
  const rows = connections.map((item) => `${item.stt || "-"}. <b>${escapeHtml(item.nen_tang || "-")}</b> · ${escapeHtml(item.ten_tai_khoan || "-")} ${item.da_xac_minh ? "✅" : "❌"}`).join("\n");
  return `<b>🔗 TÀI KHOẢN LIÊN KẾT · ${connections.length}</b>\n\n<blockquote>${rows}</blockquote>`;
}

function discordAccountKeyboard(payload) {
  const account = payload?.thong_tin_tai_khoan || {};
  const rows = [];
  if (account.anh_dai_dien) rows.push([{ text: "🖼️ Mở avatar Discord", url: account.anh_dai_dien }]);
  if (account.anh_banner) rows.push([{ text: "🎨 Mở banner Discord", url: account.anh_banner }]);
  rows.push([{ text: "🔄 Tra cứu Discord khác", callback_data: "social:discord" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

async function handleDiscord(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const query = String(input || "").trim();
  if (!query || query.length > 2048) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Dữ liệu Discord chưa hợp lệ</b>\n\nGửi link/mã mời Server, User ID hoặc Discord token.",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:discord")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tra cứu Discord...</b>", parse_mode: "HTML" });
    const isTokenInput = query.includes(".") && query.length > 50 && !/discord\.gg|discord\.com\/invite/i.test(query);
    const queryKey = isTokenInput ? "token" : "username";
    const response = await fetch(`${baseUrl}/api/mxh/discord?${queryKey}=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Discord API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    if (payload.loai_du_lieu === "may_chu_discord" && payload.thong_tin_may_chu) {
      const caption = discordServerText(payload);
      const keyboard = discordResultKeyboard(payload);
      const icon = payload.thong_tin_may_chu.anh_icon;
      if (icon) {
        try { return await sendTracked("sendPhoto", chatId, { photo: icon, caption, parse_mode: "HTML", reply_markup: keyboard }); } catch (_) {}
      }
      return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
    }
    if ((payload.loai === "discord_token_account" || payload.loai_du_lieu === "discord_token_account") && payload.thong_tin_tai_khoan) {
      const caption = discordAccountText(payload);
      const keyboard = discordAccountKeyboard(payload);
      const avatar = payload.thong_tin_tai_khoan.anh_dai_dien;
      const banner = payload.thong_tin_tai_khoan.anh_banner;
      let primary;
      let ids = [];
      let bannerSent = false;
      const avatarIsGif = /\.gif(?:[?#]|$)/i.test(String(avatar || ""));
      const bannerIsGif = /\.gif(?:[?#]|$)/i.test(String(banner || ""));

      // Telegram media groups cannot contain animations, so GIF pairs are
      // sent as one document group; regular images use one photo group.
      if (avatar && banner && avatarIsGif === bannerIsGif) {
        try {
          const mediaType = avatarIsGif ? "document" : "photo";
          const group = await telegram("sendMediaGroup", {
            chat_id: chatId,
            media: [
              { type: mediaType, media: avatar, caption, parse_mode: "HTML" },
              { type: mediaType, media: banner, caption: "🎨 <b>Discord Banner</b>", parse_mode: "HTML" }
            ]
          });
          if (Array.isArray(group)) {
            ids = group.map((item) => item?.message_id).filter(Boolean);
            primary = group[0];
            bannerSent = ids.length >= 2;
          }
        } catch (_) {}
      }

      if (!primary && avatar) {
        try {
          primary = avatarIsGif
            ? await sendTracked("sendAnimation", chatId, { animation: avatar, caption, parse_mode: "HTML", reply_markup: keyboard })
            : await sendTracked("sendPhoto", chatId, { photo: avatar, caption, parse_mode: "HTML", reply_markup: keyboard });
          if (primary?.message_id) ids = [primary.message_id];
        } catch (_) {}
      }
      if (!primary) {
        primary = await sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
        if (primary?.message_id) ids = [primary.message_id];
      }

      if (banner && !bannerSent) {
        try {
          const bannerResult = bannerIsGif
            ? await telegram("sendAnimation", { chat_id: chatId, animation: banner, caption: "🎨 <b>Discord Banner</b>", parse_mode: "HTML", reply_markup: keyboard })
            : await telegram("sendPhoto", { chat_id: chatId, photo: banner, caption: "🎨 <b>Discord Banner</b>", parse_mode: "HTML", reply_markup: keyboard });
          if (bannerResult?.message_id) {
            ids.push(bannerResult.message_id);
            bannerSent = true;
          }
        } catch (_) {}
      }
      const serverText = `${discordAccountServersText(payload)}\n\n${discordAccountConnectionsText(payload)}`;
      for (const chunk of splitTelegramText(serverText, 3500)) {
        const result = await telegram("sendMessage", {
          chat_id: chatId,
          text: sanitizeTelegramUtf8(chunk),
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: keyboard
        });
        if (result?.message_id) ids.push(result.message_id);
      }
      botMessages.set(String(chatId), ids);
      try { await setBotMessageId(chatId, ids); } catch (_) {}
      return primary;
    }
    throw new Error("Discord API chưa trả về dữ liệu được hỗ trợ.");
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:discord" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu Discord</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:discord")
    });
  }
}

function githubText() {
  return `<b>🐙 GITHUB</b>\n<i>Tra cứu profile và repository công khai</i>\n\nGửi username GitHub, ví dụ:\n<code>hoducminh123</code>\n<code>octocat</code>\n\nVí dụ API:\n<code>/api/mxh/github?=hoducminh123</code>`;
}

function githubResultText(payload) {
  const data = payload?.thong_tin_ca_nhan || {};
  return `<b>🐙 GITHUB PROFILE</b>\n\n👤 <b>Tài khoản:</b> <code>${escapeHtml(data.tai_khoan || "-")}</code>\n🏷️ <b>Họ tên:</b> ${escapeHtml(data.ho_ten || "-")}\n📝 <b>Tiểu sử:</b> ${escapeHtml(data.tieu_su || "-")}\n📦 <b>Repository:</b> <code>${escapeHtml(data.tong_so_repo ?? payload?.tong_so_repo_hien_tai ?? "-")}</code>\n👥 <b>Followers:</b> <code>${escapeHtml(data.nguoi_theo_doi ?? "-")}</code>\n➕ <b>Following:</b> <code>${escapeHtml(data.dang_theo_doi ?? "-")}</code>\n📅 <b>Tạo tài khoản:</b> <code>${escapeHtml(data.ngay_tao_tai_khoan || "-")}</code>`;
}

function githubReposText(payload) {
  const repos = Array.isArray(payload?.danh_sach_repo) ? payload.danh_sach_repo : [];
  if (!repos.length) return "<b>📦 REPOSITORY</b>\n\n<i>Tài khoản chưa có repository công khai.</i>";
  const rows = repos.map((repo, index) => `${index + 1}. <a href="${escapeHtml(repo.link_repo || "#")}"><b>${escapeHtml(repo.ten_repo || "Không tên")}</b></a>\n   ${escapeHtml(repo.ngon_ngu || "-")} · ⭐ ${escapeHtml(repo.so_sao ?? 0)} · 🍴 ${escapeHtml(repo.luot_fork ?? 0)}\n   <i>${escapeHtml(repo.mo_ta || "Không có mô tả")}</i>`).join("\n\n");
  return `<b>📦 REPOSITORY CÔNG KHAI</b>\n<i>Tổng: ${repos.length}</i>\n\n${rows}`;
}

function githubResultKeyboard(payload) {
  const data = payload?.thong_tin_ca_nhan || {};
  return { inline_keyboard: [
    ...(data.link_trang_ca_nhan ? [[{ text: "👤 Mở GitHub Profile", url: data.link_trang_ca_nhan }]] : []),
    [{ text: "🔄 Check GitHub khác", callback_data: "social:github" }],
    [{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function robloxText() {
  return `<b>🎮 ROBLOX</b>\n<i>Tra cứu tài khoản và avatar Roblox</i>\n\nGửi username hoặc User ID, ví dụ:\n<code>OsbornLauren5</code>\n<code>7559629944</code>\n\nVí dụ API:\n<code>/api/mxh/roblox?=OsbornLauren5</code>`;
}

function robloxResultText(payload) {
  const account = payload?.thong_tin_tai_khoan || {};
  const stats = payload?.chi_so_tuong_tac || {};
  const verified = account.da_xac_minh ? "✅ Có" : "❌ Không";
  return `<b>🎮 ROBLOX USER LOOKUP</b>\n\n👤 <b>Tài khoản:</b> <code>${escapeHtml(account.ten_tai_khoan || "-")}</code>\n🏷️ <b>Tên hiển thị:</b> ${escapeHtml(account.ten_hien_thi || "-")}\n🆔 <b>User ID:</b> <code>${escapeHtml(account.id || "-")}</code>\n📌 <b>Trạng thái:</b> ${escapeHtml(account.trang_thai_khoa || "-")}\n✅ <b>Đã xác minh:</b> ${verified}\n📝 <b>Tiểu sử:</b> ${escapeHtml(account.tieu_su || "-")}\n\n👥 <b>Bạn bè:</b> <code>${escapeHtml(stats.ban_be ?? "-")}</code>\n👁️ <b>Người theo dõi:</b> <code>${escapeHtml(stats.nguoi_theo_doi ?? "-")}</code>\n➕ <b>Đang theo dõi:</b> <code>${escapeHtml(stats.dang_theo_doi ?? "-")}</code>`;
}

function robloxResultKeyboard(payload) {
  const account = payload?.thong_tin_tai_khoan || {};
  const avatar = payload?.hinh_anh_avatar || {};
  const rows = [];
  if (account.lien_ket_trang_ca_nhan) rows.push([{ text: "👤 Mở Roblox Profile", url: account.lien_ket_trang_ca_nhan }]);
  if (avatar.avatar_toan_than_3d) rows.push([{ text: "🧍 Mở avatar 3D", url: avatar.avatar_toan_than_3d }]);
  rows.push([{ text: "🔄 Check Roblox khác", callback_data: "social:roblox" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "-");
  return n.toLocaleString("vi-VN");
}

function shopeeText() {
  return `<b>🛒 SHOPEE</b>\n<i>Tra cứu shop và tài khoản Shopee công khai</i>\n\nGửi username, Shop ID hoặc link shop, ví dụ:\n<code>apple_flagship_store</code>\n<code>88201679</code>\n<code>https://shopee.vn/apple_flagship_store</code>\n\nVí dụ API:\n<code>/api/mxh/shopee?=apple_flagship_store</code>`;
}

function shopeeResultText(payload) {
  const data = payload?.du_lieu || {};
  const rating = data.danh_gia || {};
  const labels = data.nhan || {};
  const status = data.trang_thai || {};
  const description = String(data.mo_ta || "Chưa có mô tả").slice(0, 160);
  return `<b>🛒 SHOPEE SHOP LOOKUP</b>\n\n👤 <b>Username:</b> <code>${escapeHtml(data.username || "-")}</code>\n🏷️ <b>Tên shop:</b> ${escapeHtml(data.ten_shop || data.ten_hien_thi || "-")}\n🆔 <b>Shop ID:</b> <code>${escapeHtml(data.shopid ?? "-")}</code>\n🆔 <b>User ID:</b> <code>${escapeHtml(data.userid ?? "-")}</code>\n📝 <b>Mô tả:</b> ${escapeHtml(description)}\n📍 <b>Địa điểm:</b> ${escapeHtml(data.dia_diem || "-")}\n\n👥 <b>Followers:</b> <code>${escapeHtml(formatCount(data.so_nguoi_theo_doi))}</code>\n➕ <b>Đang theo dõi:</b> <code>${escapeHtml(formatCount(data.so_dang_theo))}</code>\n📦 <b>Sản phẩm:</b> <code>${escapeHtml(formatCount(data.so_san_pham))}</code>\n⭐ <b>Điểm:</b> <code>${escapeHtml(data.diem_danh_gia ?? "-")}</code>\n👍 <b>Đánh giá:</b> tốt ${escapeHtml(formatCount(rating.tot))} · TB ${escapeHtml(formatCount(rating.trung_binh))} · tệ ${escapeHtml(formatCount(rating.te))}\n💬 <b>Phản hồi:</b> ${escapeHtml(data.ty_le_phan_hoi || "-")} · ${escapeHtml(data.thoi_gian_phan_hoi || "-")}\n\n🏬 <b>Mall:</b> ${escapeHtml(labels.mall_chinh_hang || "KHÔNG")}\n✅ <b>Verified:</b> ${escapeHtml(labels.shopee_verified || "KHÔNG")}\n📌 <b>Nghỉ bán:</b> ${escapeHtml(status.dang_nghi_ban || "KHÔNG")}\n📅 <b>Ngày tạo:</b> <code>${escapeHtml(data.ngay_tao || "-")}</code>\n🕐 <b>Hoạt động:</b> <code>${escapeHtml(data.hoat_dong_gan_nhat || "-")}</code>`;
}

function shopeeResultKeyboard(payload) {
  const data = payload?.du_lieu || {};
  const rows = [];
  if (data.link_trang) rows.push([{ text: "🛒 Mở shop Shopee", url: data.link_trang }]);
  if (data.avatar) rows.push([{ text: "🖼️ Mở avatar", url: data.avatar }]);
  if (data.anh_bia) rows.push([{ text: "🖼️ Mở ảnh bìa", url: data.anh_bia }]);
  rows.push([{ text: "🔄 Check Shopee khác", callback_data: "social:shopee" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function tikiText() {
  return `<b>🛍️ TIKI</b>\n<i>Tra cứu sản phẩm và shop Tiki công khai</i>\n\nGửi product ID hoặc link sản phẩm/shop, ví dụ:\n<code>198944761</code>\n<code>https://tiki.vn/noi-com-dien-tu-tefal-rk818a68-1-8l-thuong-hieu-phap-hang-chinh-hang-p198944761.html</code>\n\nVí dụ API:\n<code>/api/mxh/tiki?=198944761</code>`;
}

function tikiResultText(payload) {
  const gia = payload?.gia || {};
  const rating = payload?.danh_gia || {};
  const seller = payload?.nguoi_ban || {};
  const brand = payload?.thuong_hieu || {};
  const price = gia.gia != null ? Number(gia.gia).toLocaleString("vi-VN") + " " + (gia.tien_te || "VND") : "-";
  return `<b>🛍️ TIKI LOOKUP</b>\n\n🏷️ <b>Tên:</b> ${escapeHtml(payload?.ten_san_pham || payload?.ten_hien_thi || "-")}\n🆔 <b>Product ID:</b> <code>${escapeHtml(payload?.product_id ?? "-")}</code>\n📦 <b>SKU:</b> <code>${escapeHtml(payload?.sku || "-")}</code>\n💰 <b>Giá:</b> <code>${escapeHtml(price)}</code>\n⭐ <b>Đánh giá:</b> <code>${escapeHtml(rating.diem ?? "-")}</code> · ${escapeHtml(rating.so_luot ?? 0)} lượt\n📌 <b>Tình trạng:</b> ${escapeHtml(payload?.tinh_trang || "-")}\n🏭 <b>Thương hiệu:</b> ${escapeHtml(brand.ten || "-")}\n🛒 <b>Người bán:</b> ${escapeHtml(seller.name || "-")}`;
}

function tikiResultKeyboard(payload) {
  const seller = payload?.nguoi_ban || {};
  const rows = [];
  if (payload?.link_cong_khai) rows.push([{ text: "🛍️ Mở trên Tiki", url: payload.link_cong_khai }]);
  if (seller.link) rows.push([{ text: "🏪 Mở shop người bán", url: seller.link }]);
  rows.push([{ text: "🔄 Check Tiki khác", callback_data: "social:tiki" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function lazadaText() {
  return `<b>🏪 LAZADA</b>\n<i>Tra cứu shop hoặc sản phẩm Lazada công khai</i>\n\nGửi slug shop, seller ID hoặc link, ví dụ:\n<code>https://www.lazada.vn/shop/sony-official/</code>\n<code>https://www.lazada.vn/products/item-i123.html</code>\n\nVí dụ API:\n<code>/api/mxh/lazada?=https://www.lazada.vn/shop/{slug}/</code>`;
}

function plainPreview(value, max = 180) {
  let s = String(value || "");
  s = s.replace(/&nbsp;/gi, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"");
  s = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!s || /^(html|head|body|script)/i.test(s)) return "-";
  return s.slice(0, max);
}

function lazadaResultText(payload) {
  const gia = payload?.gia;
  const price = gia && gia.gia != null ? `${gia.gia} ${gia.tien_te || "VND"}` : "-";
  const rating = payload?.danh_gia;
  return `<b>🏪 LAZADA LOOKUP</b>\n\n🏷️ <b>Tên:</b> ${escapeHtml(payload?.ten_hien_thi || "-")}\n🛒 <b>Shop:</b> ${escapeHtml(payload?.ten_shop_nguoi_ban || payload?.username_hoac_slug || "-")}\n🆔 <b>Seller ID:</b> <code>${escapeHtml(payload?.seller_id || "-")}</code>\n🆔 <b>Product ID:</b> <code>${escapeHtml(payload?.product_id || "-")}</code>\n💰 <b>Giá:</b> <code>${escapeHtml(price)}</code>\n⭐ <b>Đánh giá:</b> <code>${escapeHtml(rating?.diem ?? "-")}</code>\n📝 <b>Mô tả:</b> ${escapeHtml(plainPreview(payload?.mo_ta))}\n📌 <b>Loại:</b> ${escapeHtml(payload?.loai_tra_cuu || "-")}`;
}

function lazadaResultKeyboard(payload) {
  const rows = [];
  if (payload?.link_cong_khai) rows.push([{ text: "🏪 Mở trên Lazada", url: payload.link_cong_khai }]);
  if (payload?.anh_dai_dien_san_pham) rows.push([{ text: "🖼️ Mở ảnh", url: payload.anh_dai_dien_san_pham }]);
  rows.push([{ text: "🔄 Check Lazada khác", callback_data: "social:lazada" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function pinterestText() {
  return `<b>📌 PINTEREST</b>\n<i>Chọn đúng chức năng cần dùng</i>\n\n<blockquote>👤 <b>Check username</b> · tra hồ sơ công khai.\n🖼️ <b>Tìm ảnh</b> · 10 ảnh/trang theo từ khóa hoặc website, có phân trang.</blockquote>`;
}

function pinterestKeyboard() {
  return { inline_keyboard: [
    [
      { text: "👤 Check username", callback_data: "social:pinterest:user" },
      { text: "🖼️ Tìm ảnh", callback_data: "social:pinterest:search" }
    ],
    [
      { text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" },
      { text: "🏠 Menu chính", callback_data: "menu:home" }
    ]
  ] };
}

function pinterestUserText() {
  return `<b>👤 CHECK USERNAME PINTEREST</b>\n\nGửi username, link profile hoặc link pin, ví dụ:\n<code>pinterest</code>\n<code>https://www.pinterest.com/pinterest/</code>\n\nVí dụ API:\n<code>/api/mxh/pinterest?=pinterest</code>\n<code>/api/mxh/pinterest?username=pinterest</code>`;
}

function pinterestSearchText() {
  return `<b>🖼️ TÌM ẢNH PINTEREST</b>\n\nGửi từ khóa hoặc website, ví dụ:\n<code>cat</code>\n<code>nytimes.com</code>\n<code>https://www.nytimes.com</code>\n\nBot gửi 10 ảnh đầu và có nút sang trang.\n\nVí dụ API:\n<code>/api/mxh/pinterest?q=cat&page=1</code>\n<code>/api/mxh/pinterest?site=nytimes.com&page=1</code>`;
}

function pinterestSearchPageKeyboard(page, totalPages) {
  const last = Math.max(1, Number(totalPages) || 1);
  const nav = [];
  if (page > 1) nav.push({ text: "⬅️ Trang trước", callback_data: `social:pinterest:search:page:${page - 1}` });
  if (page < last) nav.push({ text: "Trang sau ➡️", callback_data: `social:pinterest:search:page:${page + 1}` });
  if (nav.length === 1) nav.push({ text: `📄 ${page}/${last}`, callback_data: `social:pinterest:search:page:${page}` });
  const rows = [];
  if (nav.length) rows.push(nav);
  rows.push([
    { text: "🔄 Tìm ảnh khác", callback_data: "social:pinterest:search" },
    { text: "📌 Về Pinterest", callback_data: "social:pinterest" }
  ]);
  rows.push([
    { text: "🌐 Về MXH", callback_data: "menu:social" },
    { text: "🏠 Menu chính", callback_data: "menu:home" }
  ]);
  return { inline_keyboard: rows };
}

function pinterestResultText(payload) {
  const data = payload?.du_lieu || payload || {};
  if (payload?.loai === "anh_tu_khoa" || payload?.loai === "anh_website") {
    const title = data.website || data.tu_khoa || "Pinterest";
    return `<b>🖼️ ${escapeHtml(title)}</b>\n📄 ${escapeHtml(data.page || 1)}/${escapeHtml(data.so_trang || 1)} · ${escapeHtml(data.so_anh || 0)}/${escapeHtml(data.tong_anh || data.so_anh || 0)} ảnh`;
  }
  if (payload?.loai === "pin") {
    return `<b>📌 PINTEREST PIN</b>\n\n🏷️ <b>Tiêu đề:</b> ${escapeHtml(data.tieu_de || data.alt || "-")}\n👤 <b>Người đăng:</b> ${escapeHtml(data.nguoi_dang?.ten || data.nguoi_dang?.username || "-")}\n📂 <b>Board:</b> ${escapeHtml(data.bang?.ten || "-")}\n❤️ <b>Lượt lưu:</b> <code>${escapeHtml(formatCount(data.luot_luu))}</code>`;
  }
  const pins = Array.isArray(data.pins_gan_day) ? data.pins_gan_day.length : 0;
  const boards = Array.isArray(data.bang) ? data.bang.length : Array.isArray(data.danh_sach_bang) ? data.danh_sach_bang.length : 0;
  return `<b>📌 PINTEREST PROFILE</b>\n\n👤 <b>Username:</b> <code>${escapeHtml(data.username || "-")}</code>\n🏷️ <b>Tên:</b> ${escapeHtml(data.ten_hien_thi || "-")}\n📝 <b>Bio:</b> ${escapeHtml(String(data.gioi_thieu || "-").slice(0, 160))}\n👥 <b>Followers:</b> <code>${escapeHtml(formatCount(data.followers))}</code>\n➕ <b>Following:</b> <code>${escapeHtml(formatCount(data.following))}</code>\n📌 <b>Pins:</b> <code>${escapeHtml(formatCount(data.so_pin))}</code>\n📂 <b>Boards:</b> <code>${escapeHtml(formatCount(data.so_bang || boards))}</code>\n✅ <b>Xác minh:</b> ${data.xac_minh ? "Có" : "Không"}`;
}

function pinterestResultKeyboard(payload) {
  const data = payload?.du_lieu || payload || {};
  const rows = [];
  const link = data.link || data.link_pin || data.bang?.url;
  if (link) rows.push([{ text: "📌 Mở Pinterest", url: link }]);
  if (data.website) rows.push([{ text: "🔗 Mở website", url: data.website }]);
  rows.push([{ text: "🔄 Check Pinterest khác", callback_data: "social:pinterest" }]);
  rows.push([{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function nglKeyboard() {
  return { inline_keyboard: [
    [
      { text: "🔎 Check Username", callback_data: "social:ngl:check" },
      { text: "📨 Gửi tin ẩn danh", callback_data: "social:ngl:send" }
    ],
    [
      { text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" },
      { text: "🏠 Menu chính", callback_data: "menu:home" }
    ]
  ] };
}

function nglCheckText() {
  return `<b>🔎 CHECK NGL USERNAME</b>\n\nGửi username hoặc link NGL, ví dụ:\n<code>hoducminh</code>\n<code>https://ngl.link/hoducminh</code>\n\nVí dụ API:\n<code>/api/tools/ngl?username=hoducminh</code>`;
}

function nglSendText() {
  return `<b>📨 GỬI TIN NGL ẨN DANH</b>\n\nGửi 2 dòng:\n<code>username NGL\nNội dung tin nhắn</code>\n\nVí dụ:\n<code>hoducminh\nxin chào bạn</code>\n\n⚠️ Mỗi lần chỉ gửi đúng 1 tin. Hãy dùng nội dung lịch sự; NGL có bộ lọc tự động.`;
}

function nglResultText(payload) {
  const data = payload?.du_lieu || {};
  const isSend = payload?.chuyen_muc === "NGL Send Message";
  const status = String(data.tinh_trang || payload?.thong_bao || "Đã xử lý");
  const statusIcon = /đã đăng ký|thành công|đã gửi/i.test(status) ? "✅" : /còn trống/i.test(status) ? "🟢" : "📌";
  const details = [
    `👤 <b>Username</b>\n<code>@${escapeHtml(data.username || "-")}</code>`,
    `${statusIcon} <b>Trạng thái</b>\n${escapeHtml(status)}`,
    data.instagram ? `📷 <b>Instagram</b>\n<code>${escapeHtml(data.instagram)}</code>` : "",
    data.khu_vuc ? `🌍 <b>Khu vực</b>\n<code>${escapeHtml(data.khu_vuc)}</code>` : "",
    data.loi_nhan ? `💬 <b>Lời nhắn trên trang</b>\n<i>${escapeHtml(data.loi_nhan)}</i>` : "",
    data.noi_dung ? `📝 <b>Nội dung đã gửi</b>\n<i>${escapeHtml(data.noi_dung)}</i>` : "",
    data.co_the_bi_loc ? `🛡️ <b>Bộ lọc NGL</b>\n<code>${escapeHtml(data.co_the_bi_loc)}</code>` : ""
  ].filter(Boolean).join("\n\n");
  const profile = data.link_profile ? `\n\n🔗 <a href="${escapeHtml(data.link_profile)}">Mở trang NGL</a>` : "";
  const note = payload?.thong_bao ? `\n\n<i>ℹ️ ${escapeHtml(payload.thong_bao)}</i>` : "";
  return `<b>${isSend ? "📨 GỬI TIN NGL THÀNH CÔNG" : "🔎 NGL USERNAME LOOKUP"}</b>\n\n<blockquote>${details}</blockquote>${profile}${note}`;
}

function socialResultKeyboard(action) {
  return { inline_keyboard: [
    [{ text: "🔄 Dùng lại", callback_data: action }],
    [{ text: "🌐 Về Mạng Xã Hội", callback_data: "menu:social" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function toolsKeyboard(page = 1) {
  const tools = [
    ["🔐 Check API Key AI", "tools:checkkeyai"],
    ["🛡️ CheckScam", "tools:checkscam"],
    ["📞 Check SĐT", "tools:checksdt"],
    ["📱 Check IMEI / Model Apple", "tools:checkimei"],
    ["🤖 Chat AI", "tools:chat"],
    ["🔑 Quản lý Key", "tools:key"],
    ["🖼️ Xóa nền AI", "tools:removebg"],
    ["✨ Làm Nét Ảnh AI", "tools:enhance"],
    ["🚀 NASA Vũ Trụ", "tools:nasa"],
    ["🌐 Dịch Đa Ngôn Ngữ", "tools:trans"],
    ["🌍 Check IP", "tools:checkip"],
    ["🌸 Anime Images", "tools:anime"],
    ["🧭 Check User-Agent", "tools:ua"],
    ["🏷️ SVG Badge", "tools:badge"],
    ["🧑 Dynamic Avatar", "tools:avatar"],
    ["📱 QR Code", "tools:qr"],
    ["🔗 Rút gọn URL", "tools:shortener"],
    ["🔎 Link Metadata", "tools:metadata"]
  ];
  const safePage = Math.min(2, Math.max(1, Number(page) || 1));
  const start = (safePage - 1) * 10;
  const pageTools = tools.slice(start, start + 10);
  const rows = [];
  for (let index = 0; index < pageTools.length; index += 2) {
    rows.push(pageTools.slice(index, index + 2).map(([text, callback_data]) => ({ text, callback_data })));
  }
  const navigation = [];
  if (safePage > 1) navigation.push({ text: "◀️ Trang trước", callback_data: `tools:page:${safePage - 1}` });
  if (safePage < Math.ceil(tools.length / 10)) navigation.push({ text: "Trang sau ▶️", callback_data: `tools:page:${safePage + 1}` });
  if (navigation.length) rows.push(navigation);
  rows.push([{ text: "↩️ Về menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
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

function keyManagerKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "➕ Tạo Key", callback_data: "tools:key:create" }],
      [{ text: "✅ Check & trừ lượt", callback_data: "tools:key:check" }],
      [{ text: "🔒 Check mã hóa chống dump", callback_data: "tools:key:encrypt" }],
      [{ text: "👁️ Check không trừ lượt", callback_data: "tools:key:peek" }],
      [{ text: "🗑️ Xóa Key", callback_data: "tools:key:delete" }],
      [{ text: "📋 Danh sách Key", callback_data: "tools:key:list" }],
      [{ text: "🧰 Về Công Cụ", callback_data: "menu:tools" }, { text: "🏠 Về menu chính", callback_data: "menu:home" }]
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
  return `<b>✦ ZHEE API</b>\n<i>Trung tâm API và tiện ích dành cho nhà phát triển</i>\n\n👋 Xin chào, <b>${displayName}</b>!\n\n${statusBlock()}\n\n<blockquote><b>✨ Trung tâm tiện ích Zhee API</b>\n\n🎉 Giải trí · đố vui, lịch âm, biển số, giá xăng\n📥 Tải media · Cobalt, bóc tách video/ảnh\n🧰 Công cụ · AI · tra cứu\n🎲 Phân tích Tài Xỉu\n🎮 Game giải trí SUKA88\n\n<i>Chọn một danh mục để khám phá các chức năng bên dưới.</i></blockquote>\n\n<b>💡 Gợi ý:</b> Chọn <b>🎉 Giải trí</b> hoặc <b>🧰 Công Cụ</b> để bắt đầu.`;
}

function statusBlock() {
  const uptime = typeof tinhHoatDong === "function"
    ? tinhHoatDong()
    : { da_hoat_dong: "Không rõ", moc_khai_truong: "28/8/2026" };
  return `<blockquote>🟢 <b>Website:</b> hoạt động OK\n⏱ <b>Uptime:</b> ${escapeHtml(uptime.da_hoat_dong)}\n📅 <b>Khai trương:</b> ${escapeHtml(uptime.moc_khai_truong)}\n👤 <b>Admin:</b> Hồ Đức Minh (Zhee Dev)\n💬 <b>Hỗ trợ:</b> @zheevipv1</blockquote>`;
}

function statusText() {
  return `<b>ℹ️ TRẠNG THÁI API</b>\n\n${statusBlock()}`;
}

function statusKeyboard() {
  return { inline_keyboard: [
    [
      { text: "🌐 Mở website", url: "https://api-zhee.vercel.app/docs" },
      { text: "💬 Hỗ trợ admin", url: "https://t.me/zheevipv1" }
    ],
    [
      { text: "📋 Danh sách API", url: "https://api-zhee.vercel.app/list" },
      { text: "🏠 Menu chính", callback_data: "menu:home" }
    ]
  ] };
}

function mailParentText() {
  return `<b>📬 MAIL</b>\n<i>Nhóm toàn bộ công cụ email, chia theo từng chức năng.</i>\n\n<blockquote>📬 <b>Check Gmail IMAP</b> · đăng nhập bằng App Password, xem 10 thư/trang.\n🧪 <b>Check Email tạm</b> · nhận diện domain email tạm/rác phổ biến.\n✉️ <b>Tạo mail tạm</b> · chọn mail ngắn hạn, Mail.tm dài hạn hoặc Guerrilla Mail.\n\n🔐 Gmail không lưu mật khẩu · không đánh dấu thư đã đọc.\n📂 Các mục Gmail chỉ hiện sau khi kiểm tra đăng nhập thành công.</blockquote>\n\n<i>Chọn một chức năng bên dưới để bắt đầu.</i>`;
}

function mailParentKeyboard() {
  return { inline_keyboard: [
    [
      { text: "📬 Check Gmail IMAP", callback_data: "mail:check" },
      { text: "🧪 Check Email tạm", callback_data: "mail:temp" }
    ],
    [
      { text: "✉️ Tạo mail tạm", callback_data: "mail:create" },
      { text: "🏠 Menu chính", callback_data: "menu:home" }
    ]
  ] };
}

function createTempMailText() {
  return `<b>✉️ TẠO MAIL TẠM</b>\n<i>Chọn loại mail hoặc xem cú pháp mẫu</i>\n\n<blockquote>⚡ <b>Ngắn hạn</b> · 1secmail, không mật khẩu, nhận OTP nhanh.\n🔐 <b>Dài hạn</b> · Mail.tm, có email và mật khẩu để xem thư.\n🛡️ <b>Guerrilla</b> · mail dự phòng, khoảng 60 phút.</blockquote>\n\n<b>Ví dụ API:</b>\n<code>/mail/taomail?kieu=ngan</code>\n<code>/mail/taomail?kieu=dai</code>\n<code>/mail/taomail?kieu=guerrilla</code>\n<code>/mail/taomail?kieu=mix</code>`;
}

function createTempMailKeyboard() {
  return { inline_keyboard: [
    [{ text: "⚡ Tạo ngắn hạn · kieu=ngan", callback_data: "mail:create:ngan" }],
    [{ text: "🔐 Tạo dài hạn · kieu=dai", callback_data: "mail:create:dai" }],
    [{ text: "🛡️ Guerrilla · kieu=guerrilla", callback_data: "mail:create:guerrilla" }],
    [{ text: "🔀 Mix ngắn + dài · kieu=mix", callback_data: "mail:create:mix" }],
    [{ text: "📬 Về Mail", callback_data: "menu:mail" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function createTempMailResultText(payload) {
  const items = Array.isArray(payload?.hop_thu) ? payload.hop_thu : [];
  const rows = items.map((item, index) => {
    const password = item.mat_khau ? `\n🔑 <b>Mật khẩu:</b> <code>${escapeHtml(item.mat_khau)}</code>` : "";
    const inbox = item.xem_thu ? `\n📨 <a href="${escapeHtml(item.xem_thu)}">Mở hộp thư</a>` : "";
    return `<b>${index + 1}. ${escapeHtml(item.nha || item.kieu || "Mail tạm")}</b>\n📧 <code>${escapeHtml(item.email || "-")}</code>${password}\n⏳ ${escapeHtml(item.han || "Tạm thời")}${inbox}`;
  }).join("\n\n");
  return `<b>✉️ TẠO MAIL TẠM THÀNH CÔNG</b>\n\n📌 <b>Loại:</b> ${escapeHtml(payload?.kieu || "Mail tạm")}\n📦 <b>Số lượng:</b> <code>${escapeHtml(payload?.so_luong || items.length || 0)}</code>\n\n${rows || "<i>Không tạo được hộp thư.</i>"}\n\n⚠️ <i>Hãy lưu email/mật khẩu ngay. Server không lưu thông tin này.</i>`;
}

function createTempMailResultKeyboard(kind, canRead = false) {
  return { inline_keyboard: [
    ...(canRead ? [[{ text: "📨 Đọc hộp thư", callback_data: "mail:inbox" }]] : []),
    [{ text: "🔄 Tạo lại", callback_data: `mail:create:${kind}` }],
    [{ text: "🧪 Check Email tạm", callback_data: "mail:temp" }],
    [{ text: "📬 Về Mail", callback_data: "menu:mail" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function tempInboxResultText(payload) {
  const items = Array.isArray(payload?.thu) ? payload.thu.slice(0, 10) : [];
  const rows = items.map((item, index) => `<b>${index + 1}. ${escapeHtml(item.tieu_de || "(Không có tiêu đề)")}</b>\n👤 ${escapeHtml(item.tu || "Không rõ")}\n🕒 ${escapeHtml(item.ngay || "-")}`).join("\n\n");
  return `<b>📨 HỘP THƯ MAIL TẠM</b>\n\n📧 <b>Email:</b> <code>${escapeHtml(payload?.email || "-")}</code>\n📊 <b>Số thư:</b> <code>${escapeHtml(payload?.so_thu ?? items.length)}</code>\n\n${rows || "<i>Chưa có thư mới.</i>"}\n\n<i>Bấm Đọc hộp thư để tải lại danh sách.</i>`;
}

function tempInboxKeyboard() {
  return { inline_keyboard: [
    [{ text: "🔄 Đọc lại hộp thư", callback_data: "mail:inbox" }],
    [{ text: "✉️ Tạo mail khác", callback_data: "mail:create" }],
    [{ text: "📬 Về Mail", callback_data: "menu:mail" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function mailFoldersText(page = 1) {
  return `<b>📂 MỤC GMAIL</b>\n<i>Trang ${page}/2 · Chọn mục thư cần xem</i>\n\nSau khi chọn mục, gửi lại email và mật khẩu ứng dụng Gmail. Mật khẩu không được lưu.`;
}

function mailFoldersKeyboard(page = 1) {
  const folders = [
    ["📥 Chính", "chinh"], ["📣 Quảng cáo", "quangcao"],
    ["💬 Mạng xã hội", "mangxahoi"], ["📰 Cập nhật", "capnhat"],
    ["📂 Hộp thư", "hopthu"], ["⭐ Đánh dấu", "danhdau"],
    ["📤 Đã gửi", "dagui"], ["📝 Nháp", "nhap"],
    ["🛒 Mua sắm", "muasam"], ["🚫 Spam", "spam"],
    ["🗑️ Rác", "rac"], ["📦 Toàn bộ", "toanbo"]
  ];
  const safePage = page === 2 ? 2 : 1;
  const pageFolders = folders.slice((safePage - 1) * 6, safePage * 6);
  const rows = [];
  for (let index = 0; index < pageFolders.length; index += 2) {
    rows.push(pageFolders.slice(index, index + 2).map(([text, folder]) => ({ text, callback_data: `mail:folder:${folder}` })));
  }
  rows.push([
    ...(safePage > 1 ? [{ text: "⬅️ Trang trước", callback_data: "mail:folders:page:1" }] : []),
    ...(safePage < 2 ? [{ text: "Trang sau ➡️", callback_data: "mail:folders:page:2" }] : [])
  ]);
  rows.push([{ text: "📬 Về Mail", callback_data: "menu:mail" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function toolsText() {
  return `<b>🧰 CÔNG CỤ</b>\n<i>Tổng hợp các công cụ tiện ích của Zhee API</i>\n\n<blockquote>🔐 <b>Check API Key AI</b> · kiểm tra key, model, quota và rate limit.\n🛡️ <b>CheckScam</b> · tra cứu tài khoản, số điện thoại hoặc từ khóa đáng ngờ.\n📞 <b>Check SĐT</b> · kiểm tra định dạng, quốc gia, nhà mạng và caller ID.\n📱 <b>Check IMEI / Model Apple</b> · phân tích IMEI, Serial và mã model Apple.\n🤖 <b>Chat AI</b> · hỏi Google Gemini hoặc ChatGPT.\n🔑 <b>Quản lý Key</b> · tạo, kiểm tra, mã hóa, xóa và xem key.\n🖼️ <b>Xóa nền AI</b> · gửi ảnh đã xóa nền trực tiếp qua Telegram.\n✨ <b>Làm Nét Ảnh AI</b> · tăng độ phân giải và làm nét ảnh.\n🚀 <b>NASA Vũ Trụ</b> · tìm ảnh thiên văn, xem APOD và nhận media trực tiếp.\n🌐 <b>Dịch Đa Ngôn Ngữ</b> · dịch văn bản và hỗ trợ voice MP3.\n🌍 <b>Check IP</b> · tra cứu vị trí, quốc gia, nhà mạng và thông tin kết nối.\n🌸 <b>Anime Images</b> · lấy ảnh anime phân trang từ Waifu.im.\n🧭 <b>Check User-Agent</b> · phân tích thiết bị, hệ điều hành và trình duyệt.\n🏷️ <b>SVG Badge</b> · tạo badge Build/Passing, Status/Online và nhiều mẫu có sẵn.\n🧑 <b>Dynamic Avatar</b> · tạo avatar chữ cái từ tên và gửi ảnh trực tiếp.\n📱 <b>QR Code</b> · tạo mã QR từ URL hoặc nội dung và gửi ảnh trực tiếp.\n🔗 <b>Rút gọn URL</b> · rút gọn link bằng TinyURL hoặc Bitly.\n🔎 <b>Link Metadata</b> · bóc tách tiêu đề, mô tả, ảnh và thông tin Open Graph.\n📬 <b>Mail</b> · kiểm tra hộp thư Gmail bằng mật khẩu ứng dụng, không lưu thông tin đăng nhập.</blockquote>\n\n<i>Chọn công cụ bên dưới để bắt đầu.</i>`;
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
  return `<b>🤖 KẾT QUẢ CHAT AI</b>\n\n🧠 <b>Mô hình:</b> <i>${escapeHtml(payload?.mo_hinh || "Không xác định")}</i>\n\n❓ <b>Câu hỏi:</b>\n<code>${escapeHtml(payload?.cau_hoi || "-")}</code>\n\n💬 <b>Phản hồi:</b>\n${escapeHtml(payload?.phan_hoi || payload?.answer || payload?.message || "Không có phản hồi.")}`;
}

function toolsRemoveBgText() {
  return `<b>🖼️ XÓA NỀN AI</b>\n\nGửi URL ảnh công khai cần xóa nền.\n\nVí dụ:\n<code>https://example.com/avatar.jpg</code>\n\n<i>Bot sẽ gọi endpoint xóa nền, giải mã Data URI PNG và gửi ảnh đã xử lý trực tiếp qua Telegram.</i>`;
}

function toolsEnhanceText() {
  return `<b>✨ LÀM NÉT ẢNH AI</b>\n\nGửi URL ảnh công khai cần làm nét và tăng độ phân giải.\n\nVí dụ:\n<code>https://placehold.co/1200x800/png?text=Zhee%20API</code>\n\n<i>Bot sẽ kiểm tra proxy ảnh, rồi gửi link WebP HD sau khi xử lý.</i>`;
}

function toolsIpText() {
  return `<b>🌍 CHECK IP</b>\n<i>Tra cứu thông tin địa chỉ IPv4 hoặc IPv6</i>\n\nGửi địa chỉ IP cần kiểm tra.\n\nVí dụ:\n<code>113.175.232.110</code>\n<code>8.8.8.8</code>\n\n<i>Bot sẽ hiển thị quốc gia, thành phố, nhà mạng, loại kết nối, tọa độ và thông tin định tuyến.</i>`;
}

function toolsIpResultText(payload) {
  const location = payload?.location || {};
  const flag = location.country_flag_emoji || "🌐";
  const coordinates = payload?.latitude != null && payload?.longitude != null
    ? `${payload.latitude}, ${payload.longitude}`
    : "-";
  const language = Array.isArray(location.languages) && location.languages.length
    ? location.languages.map((item) => item.native || item.name || item.code).join(", ")
    : "-";
  const optional = [
    payload?.msa ? `\n🏙️ <b>MSA:</b> <code>${escapeHtml(payload.msa)}</code>` : "",
    payload?.dma ? `\n📺 <b>DMA:</b> <code>${escapeHtml(payload.dma)}</code>` : ""
  ].join("");
  const updatedAt = payload?.cap_nhat?.thoi_gian_utc || "-";
  const cache = payload?.cache_hit === true ? "Có · cache 5 phút" : "Không";
  return `<b>🌍 KẾT QUẢ CHECK IP</b>\n\n<blockquote>🔎 <b>Địa chỉ:</b> <code>${escapeHtml(payload?.ip || "-")}</code>\n📡 <b>Loại:</b> <i>${escapeHtml(payload?.type || "-")}</i>\n🧭 <b>Châu lục:</b> <i>${escapeHtml(payload?.continent_name || "-")}</i> · <code>${escapeHtml(payload?.continent_code || "-")}</code>\n\n${flag} <b>Quốc gia:</b> <i>${escapeHtml(payload?.country_name || "-")}</i> · <code>${escapeHtml(payload?.country_code || "-")}</code>\n📍 <b>Khu vực:</b> <i>${escapeHtml([payload?.region_name, payload?.city].filter(Boolean).join(" · ") || "-")}</i>\n🏷️ <b>Mã bưu chính:</b> <code>${escapeHtml(payload?.zip || "-")}</code>\n🗺️ <b>Tọa độ:</b> <code>${escapeHtml(coordinates)}</code>\n📏 <b>Bán kính:</b> <code>${escapeHtml(payload?.radius || "-")}</code>\n\n📶 <b>Kết nối:</b> <i>${escapeHtml(payload?.connection_type || "-")}</i>\n🛣️ <b>Định tuyến:</b> <i>${escapeHtml(payload?.ip_routing_type || "-")}</i>\n☎️ <b>Mã gọi quốc tế:</b> <code>+${escapeHtml(location.calling_code || "-")}</code>\n🏛️ <b>Thủ đô:</b> <i>${escapeHtml(location.capital || "-")}</i>\n🗣️ <b>Ngôn ngữ:</b> <i>${escapeHtml(language)}</i>\n🆔 <b>GeoName ID:</b> <code>${escapeHtml(location.geoname_id || "-")}</code>${optional}</blockquote>\n\n🕒 <b>Cập nhật UTC:</b> <code>${escapeHtml(updatedAt)}</code>\n💾 <b>Cache:</b> <i>${escapeHtml(cache)}</i>\n\n<i>📚 Nguồn: IPStack · Dữ liệu vị trí mang tính tham khảo.</i>`;
}

function toolsAnimeText() {
  return `<b>🌸 ANIME IMAGES</b>\n<i>Ảnh anime từ Waifu.im · hỗ trợ phân trang</i>\n\nNhập nhanh theo mẫu:\n<code>PageSize Page</code>\n\nMặc định:\n<code>10 1</code>\n\nVí dụ:\n<code>10 1</code> · 10 ảnh, trang 1\n<code>20 3</code> · 20 ảnh, trang 3\n\n📌 <b>PageSize:</b> từ 1 đến 20\n📌 <b>Page:</b> từ 1 trở lên\n\n<i>Bạn cũng có thể gửi dạng URL params: <code>PageSize=10&amp;Page=2</code>.</i>`;
}

function parseAnimeInput(input) {
  const raw = String(input || "").trim();
  let pageSize = 10;
  let page = 1;
  const params = new URLSearchParams(raw.replace(/^[?&]/, ""));
  if (params.has("PageSize") || params.has("Page")) {
    pageSize = Number.parseInt(params.get("PageSize") || "10", 10);
    page = Number.parseInt(params.get("Page") || "1", 10);
  } else {
    const parts = raw.split(/[|,\s]+/).filter(Boolean);
    if (parts[0]) pageSize = Number.parseInt(parts[0], 10);
    if (parts[1]) page = Number.parseInt(parts[1], 10);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20 || !Number.isInteger(page) || page < 1) return null;
  return { pageSize, page };
}

function toolsAnimeResultText(payload, pageSize, page) {
  const data = payload?.du_lieu || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const rows = items.map((item, index) => {
    const tags = Array.isArray(item.tags) ? item.tags.slice(0, 2).map((tag) => tag.name).filter(Boolean).join(", ") : "";
    const dimensions = item.width && item.height ? `${item.width}×${item.height}` : "-";
    const artist = item.artists?.[0]?.name || "Không rõ";
    return `${index + 1}. <b>#${escapeHtml(item.id ?? "-")}</b> · <i>${escapeHtml(dimensions)}</i> · 👤 ${escapeHtml(artist)}${tags ? ` · 🏷️ ${escapeHtml(tags)}` : ""}`;
  }).join("\n");
  return `<b>🌸 KẾT QUẢ ANIME IMAGES</b>\n\n📄 <b>Trang:</b> <code>${page}</code> · <b>Số ảnh:</b> <code>${items.length}/${pageSize}</code>\n📚 <b>Tổng:</b> <code>${escapeHtml(data.totalCount ?? "-")}</code> · <b>Tổng trang:</b> <code>${escapeHtml(data.totalPages ?? "-")}</code>\n\n<blockquote>${rows || "<i>Không có ảnh trong trang này.</i>"}</blockquote>\n\n${data.hasNextPage ? "➡️ Có thể bấm <b>Trang sau</b> để xem tiếp." : "✅ Đây là trang cuối."}${data.cache_hit ? "\n💾 Dữ liệu lấy từ cache." : ""}`;
}

function animeResultKeyboard(pageSize, page, hasPrevious, hasNext) {
  const navigation = [];
  if (hasPrevious) navigation.push({ text: "⬅️ Trang trước", callback_data: `tools:anime:page:${pageSize}:${page - 1}` });
  if (hasNext) navigation.push({ text: "Trang sau ➡️", callback_data: `tools:anime:page:${pageSize}:${page + 1}` });
  const rows = navigation.length ? [navigation] : [];
  rows.push([{ text: "🔄 Đổi PageSize / Page", callback_data: "tools:anime" }]);
  rows.push([{ text: "🧰 Về Công Cụ", callback_data: "menu:tools" }, { text: "🏠 Về menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

function toolsBadgeText() {
  return `<b>🏷️ SVG BADGE GENERATOR</b>\n<i>Tạo badge SVG trực tiếp từ Telegram</i>\n\nGửi theo mẫu:\n<code>label | status | color</code>\n\nVí dụ có sẵn:\n<code>Build | Passing | green</code>\n<code>Status | Online | blue</code>\n<code>Version | v1.0.0 | purple</code>\n<code>License | MIT | orange</code>\n\n🎨 Màu gợi ý: <code>green</code>, <code>blue</code>, <code>purple</code>, <code>orange</code>, <code>red</code>, <code>crimson</code>, <code>indigo</code>.\n\n<i>Bot sẽ tạo và gửi ảnh SVG badge trực tiếp, kèm link ảnh.</i>`;
}

function parseBadgeInput(input) {
  const parts = String(input || "").split("|").map((item) => item.trim());
  if (parts.length < 2 || !parts[0] || !parts[1] || parts.some((item) => item.length > 120)) return null;
  return { label: parts[0], status: parts[1], color: parts[2] || "green" };
}

function toolsBadgeResultText(data) {
  return `<b>🏷️ SVG BADGE ĐÃ TẠO</b>\n\n🏷️ <b>Nhãn:</b> <code>${escapeHtml(data.label)}</code>\n📌 <b>Trạng thái:</b> <code>${escapeHtml(data.status)}</code>\n🎨 <b>Màu:</b> <code>${escapeHtml(data.color)}</code>\n\n🔗 <a href="${escapeHtml(data.url)}">Mở hoặc tải ảnh badge</a>`;
}

function toolsTempMailText() {
  return `<b>🧪 CHECK EMAIL TẠM</b>\n<i>Kiểm tra domain email tạm/rác phổ biến</i>\n\nGửi một địa chỉ email đầy đủ, ví dụ:\n<code>user@10minutemail.com</code>\n\n⚠️ Chỉ kiểm tra domain trong danh sách cục bộ, không đăng nhập và không lưu email.`;
}

function toolsTempMailResultText(payload) {
  const isTemp = Boolean(payload?.co_phai_domain_mail_tam);
  return `<b>🧪 KẾT QUẢ CHECK EMAIL TẠM</b>\n\n📧 <b>Email:</b> <code>${escapeHtml(payload?.email || "-")}</code>\n🌐 <b>Domain:</b> <code>${escapeHtml(payload?.ten_mien || "-")}</code>\n📌 <b>Kết luận:</b> ${isTemp ? "⚠️ Đây là domain email tạm/rác phổ biến." : "✅ Chưa nằm trong danh sách domain email tạm phổ biến."}\n\n<i>${escapeHtml(payload?.ket_luan || "")}</i>`;
}

function mailToolKeyboard(retryCallback, retryLabel) {
  return { inline_keyboard: [
    [{ text: retryLabel, callback_data: retryCallback }],
    [{ text: "📬 Về Mail", callback_data: "menu:mail" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]
  ] };
}

function toolsMailText() {
  return `<b>📬 CHECK MAIL</b>\n<i>Kiểm tra hộp thư Gmail qua IMAP</i>\n\nGửi email và mật khẩu ứng dụng theo 2 dòng:\n<code>email@gmail.com\nmatkhauungdung</code>\n\nHoặc gửi một dòng:\n<code>email@gmail.com matkhauungdung</code>\n\n📂 Mặc định: tab Chính, thư mới nhất\n🔐 Không lưu mật khẩu và không đánh dấu thư đã đọc.\n⚠️ Chỉ dùng mật khẩu ứng dụng Gmail, không dùng mật khẩu tài khoản chính.\n\n<i>Thông tin đăng nhập chỉ được gửi nội bộ qua HTTPS để kiểm tra.</i>`;
}

function parseMailInput(input) {
  const raw = String(input || "").trim();
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = lines[0] || "";
  const password = lines.length > 1 ? lines.slice(1).join("") : raw.slice(email.length).trim().replace(/\s+/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 100) return null;
  return { email, password: password.replace(/\s+/g, "") };
}

function toolsMailResultText(payload) {
  const items = Array.isArray(payload?.thu) ? payload.thu.slice(0, 10) : [];
  const page = Number(payload?.trang || 1);
  const totalPages = Number(payload?.so_trang || 1);
  const rows = items.map((item, index) => {
    const subject = String(item.tieu_de || item.subject || "(Không có tiêu đề)").slice(0, 180);
    const sender = String(item.ten || item.email_gui || "Không rõ").slice(0, 100);
    return `${index + 1}. <b>${escapeHtml(subject)}</b>\n   👤 ${escapeHtml(sender)} · 🆔 <code>${escapeHtml(item.uid || "-")}</code> · 🕒 ${escapeHtml(item.ngay || item.date || "-")}`;
  }).join("\n\n");
  return `<b>📬 KẾT QUẢ CHECK MAIL</b>\n\n📧 <b>Hộp thư:</b> <code>${escapeHtml(payload?.email || "-")}</code>\n📂 <b>Mục:</b> <i>${escapeHtml(payload?.muc_hien_tai || "Chính")}</i>\n📊 <b>Tổng thư:</b> <code>${escapeHtml(payload?.tong_thu ?? "-")}</code> · <b>Chưa đọc:</b> <code>${escapeHtml(payload?.chua_doc ?? "-")}</code>\n📄 <b>Trang:</b> <code>${page}/${totalPages}</code> · <b>Hiển thị:</b> <code>${items.length}</code>\n\n<blockquote>${rows || "<i>Không có thư trong trang này.</i>"}</blockquote>\n\n<i>Không đánh dấu thư đã đọc. Mật khẩu ứng dụng không được lưu hoặc hiển thị.</i>`;
}

function mailResultKeyboard(payload) {
  const page = Number(payload?.trang || 1);
  const totalPages = Number(payload?.so_trang || 1);
  const folder = String(payload?.ma_muc || "chinh");
  const rows = [];
  if (page > 1) rows.push({ text: "⬅️ Trang trước", callback_data: `tools:mail:folder:${folder}:page:${page - 1}` });
  if (page < totalPages) rows.push({ text: "Trang sau ➡️", callback_data: `tools:mail:folder:${folder}:page:${page + 1}` });
  const keyboard = rows.length ? [rows] : [];
  keyboard.push([{ text: "📂 Đổi mục Gmail", callback_data: "mail:folders" }]);
  keyboard.push([{ text: "🔄 Đăng nhập Mail khác", callback_data: "tools:mail" }]);
  keyboard.push([{ text: "📬 Về Mail", callback_data: "menu:mail" }, { text: "🏠 Menu chính", callback_data: "menu:home" }]);
  return { inline_keyboard: keyboard };
}

function toolsMailPageText(page, folder = "chinh") {
  const labels = { chinh: "Chính", quangcao: "Quảng cáo", mangxahoi: "Mạng xã hội", capnhat: "Cập nhật", hopthu: "Hộp thư", danhdau: "Đánh dấu", dagui: "Đã gửi", nhap: "Nháp", muasam: "Mua sắm", spam: "Spam", rac: "Rác", toanbo: "Toàn bộ" };
  return `<b>📬 ${escapeHtml(labels[folder] || folder.toUpperCase())} · TRANG ${page}</b>\n\nGửi lại email và mật khẩu ứng dụng để xem đúng mục <b>${escapeHtml(labels[folder] || folder)}</b>, trang <b>${page}</b>.\n\n<code>email@gmail.com\nmật_khẩu_ứng_dụng</code>\n\n<i>Thông tin chỉ dùng cho lần kiểm tra này, không được lưu.</i>`;
}

function splitTelegramText(text, limit = 3500) {
  const chunks = [];
  let current = "";
  for (const line of String(text || "").split("\n")) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= limit) current = next;
    else {
      if (current) chunks.push(current);
      if (line.length <= limit) current = line;
      else for (let i = 0; i < line.length; i += limit) chunks.push(line.slice(i, i + limit));
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [""];
}

function sanitizeTelegramUtf8(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("utf8");
}

function stripTelegramHtml(value) {
  return sanitizeTelegramUtf8(String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'"));
}

async function notifyAdminError(error, context = {}) {
  const admins = config().admins;
  if (!admins.length) return;
  const lines = sanitizeTelegramUtf8([
    "🚨 <b>BOT ERROR LOG</b>",
    `🕒 <code>${escapeHtml(new Date().toISOString())}</code>`,
    context.chatId ? `👤 Chat: <code>${escapeHtml(context.chatId)}</code>` : "",
    context.action ? `🧩 Action: <code>${escapeHtml(context.action)}</code>` : "",
    `❌ <b>${escapeHtml(error?.message || error || "Lỗi không xác định")}</b>`
  ].filter(Boolean).join("\n"));
  for (const adminId of admins) {
    try { await telegram("sendMessage", { chat_id: adminId, text: lines, parse_mode: "HTML", disable_web_page_preview: true }); } catch (_) {}
  }
}

async function sendTelegramTextChunks(chatId, text, replyMarkup) {
  await clearPreviousBotMessages(chatId);
  const ids = [];
  const chunks = splitTelegramText(text);
  for (const chunk of chunks) {
    let result;
    try {
      result = await telegram("sendMessage", { chat_id: chatId, text: sanitizeTelegramUtf8(chunk), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: replyMarkup });
    } catch (htmlError) {
      try {
        result = await telegram("sendMessage", { chat_id: chatId, text: stripTelegramHtml(chunk), disable_web_page_preview: true, reply_markup: replyMarkup });
      } catch (plainError) {
        await notifyAdminError(plainError, { chatId, action: "sendTelegramTextChunks", htmlError: htmlError.message });
        throw plainError;
      }
    }
    if (result?.message_id) ids.push(result.message_id);
  }
  botMessages.set(String(chatId), ids);
  try { await setBotMessageId(chatId, ids); } catch (_) {}
  return ids;
}

function toolsMetadataText() {
  return `<b>🔎 LINK METADATA</b>\n<i>Bóc tách tiêu đề, mô tả và thông tin Open Graph</i>\n\nGửi một URL công khai cần kiểm tra.\n\nVí dụ:\n<code>https://example.com</code>\n\n<i>Bot sẽ trả về publisher, title, ngôn ngữ, ảnh, logo, tác giả, ngày xuất bản và mô tả nếu trang cung cấp.</i>`;
}

function toolsMetadataResultText(payload) {
  const data = payload?.du_lieu || {};
  const media = data.image || data.logo;
  return `<b>🔎 KẾT QUẢ LINK METADATA</b>\n\n🌐 <b>Publisher:</b> <i>${escapeHtml(data.publisher || "-")}</i>\n📝 <b>Tiêu đề:</b> <i>${escapeHtml(data.title || "-")}</i>\n🌍 <b>Ngôn ngữ:</b> <code>${escapeHtml(data.lang || "-")}</code>\n👤 <b>Tác giả:</b> <i>${escapeHtml(data.author || "-")}</i>\n📅 <b>Ngày xuất bản:</b> <i>${escapeHtml(data.date || "-")}</i>\n\n📄 <b>Mô tả:</b>\n<i>${escapeHtml(data.description || "Không có mô tả.")}</i>\n\n🔗 <a href="${escapeHtml(data.url || payload?.url || "#")}">Mở trang gốc</a>${media ? `\n🖼️ <a href="${escapeHtml(media)}">Mở ảnh/logo</a>` : ""}`;
}

function toolsShortenerText() {
  return `<b>🔗 RÚT GỌN URL</b>\n<i>Rút gọn liên kết nhanh bằng TinyURL hoặc Bitly</i>\n\nGửi theo mẫu:\n<code>URL provider</code>\n\nVí dụ:\n<code>https://example.com tinyurl</code>\n<code>https://example.com bitly</code>\n<code>https://example.com</code> · mặc định TinyURL\n\n<i>Bitly cần cấu hình token trên server. Nếu chưa có, hãy dùng <code>tinyurl</code>.</i>`;
}

function parseShortenerInput(input) {
  const parts = String(input || "").trim().split(/\s+/);
  const provider = /^(tinyurl|bitly)$/i.test(parts[parts.length - 1] || "") ? parts.pop().toLowerCase() : "tinyurl";
  const url = parts.join(" ").trim();
  if (!url || url.length > 2048 || !/^https?:\/\//i.test(url)) return null;
  return { url, provider };
}

function toolsShortenerResultText(data) {
  return `<b>🔗 URL ĐÃ ĐƯỢC RÚT GỌN</b>\n\n🏷️ <b>Nhà cung cấp:</b> <i>${escapeHtml(data.nha_cung_cap || "TinyURL")}</i>\n\n📥 <b>Link gốc:</b>\n<code>${escapeHtml(data.link_goc || "-")}</code>\n\n📤 <b>Link ngắn:</b>\n<a href="${escapeHtml(data.link_ngan || "#")}"><code>${escapeHtml(data.link_ngan || "-")}</code></a>\n\n<i>Bấm vào link ngắn để mở.</i>`;
}

function toolsQrText() {
  return `<b>📱 QR CODE GENERATOR</b>\n<i>Tạo mã QR và nhận ảnh trực tiếp</i>\n\nGửi nhanh theo mẫu:\n<code>Nội dung hoặc URL kích_thước</code>\n\nVí dụ:\n<code>https://example.com 300</code>\n<code>Zhee API 500</code>\n<code>Zhee API</code> · mặc định 300×300\n\n📐 Kích thước hỗ trợ: <code>100</code> đến <code>1000</code>\n\n<i>Bot sẽ đọc số ở cuối tin nhắn làm kích thước ảnh. Phần còn lại là nội dung QR.</i>`;
}

function parseQrInput(input) {
  const raw = String(input || "").trim();
  const match = raw.match(/^(.*?)\s+(\d{3,4})$/);
  const text = (match ? match[1] : raw).trim();
  const size = match ? Number.parseInt(match[2], 10) : 300;
  if (!text || text.length > 4096 || !Number.isInteger(size) || size < 100 || size > 1000) return null;
  return { text, size };
}

function toolsQrResultText(data, qrUrl) {
  return `<b>📱 QR CODE ĐÃ TẠO</b>\n\n📝 <b>Nội dung:</b>\n<code>${escapeHtml(data.text)}</code>\n📐 <b>Kích thước:</b> <code>${data.size}×${data.size}</code>\n\n🔗 <a href="${escapeHtml(qrUrl)}">Mở hoặc tải ảnh QR</a>`;
}

function toolsAvatarText() {
  return `<b>🧑 DYNAMIC AVATAR</b>\n<i>Tạo avatar chữ cái từ tên</i>\n\nGửi tên cần tạo avatar.\n\nVí dụ có sẵn:\n<code>Nguyen Van A</code>\n<code>Zhee Dev</code>\n<code>Api Public Server</code>\n<code>Minh Hoang</code>\n\n<i>Bot sẽ lấy chữ cái đầu, tạo ảnh avatar SVG/PNG và gửi trực tiếp qua Telegram.</i>`;
}

function toolsAvatarResultText(name, url) {
  return `<b>🧑 AVATAR ĐÃ TẠO</b>\n\n👤 <b>Tên:</b> <code>${escapeHtml(name)}</code>\n🔤 <b>Chữ cái:</b> <code>${escapeHtml(name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U")}</code>\n\n🔗 <a href="${escapeHtml(url)}">Mở hoặc tải ảnh avatar</a>`;
}

function toolsUaText() {
  return `<b>🧭 CHECK USER-AGENT</b>\n<i>Phân tích thiết bị, hệ điều hành và trình duyệt</i>\n\nGửi chuỗi User-Agent cần kiểm tra.\n\nVí dụ iPhone:\n<code>Mozilla/5.0 (iPhone)</code>\n\nVí dụ Chrome:\n<code>Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36</code>\n\n<i>Bot sẽ nhận diện thiết bị, hệ điều hành và trình duyệt từ chuỗi bạn gửi.</i>`;
}

function toolsUaResultText(payload) {
  return `<b>🧭 KẾT QUẢ USER-AGENT</b>\n\n<blockquote>📱 <b>Thiết bị:</b> <i>${escapeHtml(payload?.thiet_bi || "-")}</i>\n💻 <b>Hệ điều hành:</b> <i>${escapeHtml(payload?.he_dieu_hanh || "-")}</i>\n🌐 <b>Trình duyệt:</b> <i>${escapeHtml(payload?.trinh_duyet || "-")}</i></blockquote>\n\n🔎 <b>User-Agent:</b>\n<code>${escapeHtml(payload?.user_agent || "-")}</code>\n\n<i>Phân tích từ User-Agent · không lưu chuỗi tra cứu.</i>`;
}

function toolsNasaText() {
  return `<b>🚀 NASA VŨ TRỤ</b>\n<i>Khám phá ảnh thiên văn từ kho dữ liệu NASA</i>\n\nGửi một từ khóa tiếng Anh để tìm hình ảnh NASA.\n\n<b>🔎 Từ khóa gợi ý thường trả về ảnh:</b>\n<code>galaxy</code> · <code>nebula</code> · <code>earth</code>\n<code>mars</code> · <code>moon</code> · <code>aurora</code>\n<code>comet</code> · <code>planet</code> · <code>black hole</code>\n<code>james webb</code> · <code>space</code>\n\n<i>Bot ưu tiên kết quả hình ảnh, hiển thị tiêu đề, ngày chụp, mô tả, copyright và nguồn NASA. Gửi <code>apod</code> để xem ảnh thiên văn trong ngày.</i>`;
}

function nasaCaption(data, keyword) {
  const title = data?.title || keyword || "NASA Image";
  const date = data?.date || "Không rõ";
  const media = data?.media_type === "video" ? "VIDEO" : "HÌNH ẢNH";
  const description = String(data?.explanation || "Không có mô tả.").replace(/\s+/g, " ").trim();
  const shortDescription = description.length > 360 ? `${description.slice(0, 357)}...` : description;
  const source = data?.url || data?.source || "https://images.nasa.gov/";
  return `<b>🚀 NASA • ${escapeHtml(media)}</b>\n\n🌌 <b>${escapeHtml(title)}</b>\n📅 <b>Ngày:</b> <code>${escapeHtml(date)}</code>\n👤 <b>Copyright:</b> <i>${escapeHtml(data?.copyright || "NASA / Không công bố")}</i>\n\n📝 ${escapeHtml(shortDescription)}\n\n🔗 <a href="${escapeHtml(source)}">Mở nội dung gốc</a>\n<i>Nguồn dữ liệu: NASA</i>`;
}

function nasaResultKeyboard() {
  return toolResultKeyboard("tools:nasa", "🔄 Tìm ảnh NASA khác");
}

function toolsKeyMenuText() {
  return `<b>🔑 QUẢN LÝ KEY ZheeTool</b>\n\nChọn đúng thao tác với ZheeTool key:\n\n➕ Tạo key mới\n✅ Check key và trừ lượt\n🔒 Check mã hóa chống dump\n👁️ Check key không trừ lượt\n🗑️ Xóa key\n📋 Xem danh sách key\n\n<i>Các thao tác sẽ hiển thị đúng keyboard của thao tác đang dùng.</i>`;
}

function toolsKeyCreateText() {
  return `<b>🔑 TẠO KEY ZheeTool</b>\n\nGửi theo mẫu:\n<code>số_lượt|số_giờ|ghi_chú</code>\n\nVí dụ:\n<code>20|48|KhachVIP</code>\n\n<i>Mặc định: 10 lượt, 24 giờ, ghi chú User VIP.</i>`;
}

function toolsKeyActionText(action) {
  const messages = {
    check: "<b>✅ CHECK KEY & TRỪ LƯỢT</b>\n\nGửi ZheeTool key cần kiểm tra. Mỗi lần check hợp lệ sẽ trừ một lượt.",
    encrypt: "<b>🔒 CHECK MÃ HÓA CHỐNG DUMP</b>\n\nGửi ZheeTool key để kiểm tra và nhận dữ liệu mã hóa chống dump.",
    peek: "<b>👁️ CHECK KEY KHÔNG TRỪ LƯỢT</b>\n\nGửi ZheeTool key để kiểm tra trạng thái mà không trừ lượt.",
    delete: "<b>🗑️ XÓA KEY</b>\n\nGửi ZheeTool key cần xóa vĩnh viễn. Thao tác này không thể hoàn tác."
  };
  return `${messages[action] || "<b>🔑 QUẢN LÝ KEY</b>"}\n\n<i>Key được xử lý trực tiếp và không hiển thị trong menu tool khác.</i>`;
}

function toolsKeyResultText(payload) {
  const data = payload?.du_lieu || {};
  return `<b>🔑 TẠO KEY THÀNH CÔNG</b>\n\n🔐 <b>Key:</b>\n<code>${escapeHtml(data.key || "-")}</code>\n\n🔢 <b>Số lượt tối đa:</b> <i>${escapeHtml(data.so_luot_toi_da ?? "-")}</i>\n📊 <b>Số lượt còn lại:</b> <i>${escapeHtml(data.so_luot_con_lai ?? "-")}</i>\n⏰ <b>Hết hạn:</b> <i>${escapeHtml(data.thoi_gian_het_han || "-")}</i>\n📝 <b>Ghi chú:</b> <i>${escapeHtml(data.ghi_chu || "-")}</i>\n🟢 <b>Trạng thái:</b> <i>${escapeHtml(data.trang_thai || "hoat_dong")}</i>\n\n<i>Hãy sao chép key và gửi cho người dùng cần cấp quyền.</i>`;
}

function toolsKeyOperationResultText(action, payload) {
  if (action === "list") {
    const items = Array.isArray(payload?.danh_sach) ? payload.danh_sach : [];
    const rows = items.map((item, index) => {
      const key = item?.key || item?.key_an || "-";
      return `${index + 1}. <code>${escapeHtml(key)}</code> · còn ${escapeHtml(item?.so_luot_con_lai ?? "-")} lượt · ${escapeHtml(item?.trang_thai || "-")}`;
    }).join("\n");
    return `<b>📋 DANH SÁCH ZheeTool KEY</b>\n\n📦 <b>Tổng số:</b> <i>${escapeHtml(payload?.tong_so_key ?? items.length)}</i>\n\n${rows || "<i>Chưa có key nào.</i>"}`;
  }
  if (action === "delete") {
    return `<b>🗑️ XÓA KEY THÀNH CÔNG</b>\n\n✅ ${escapeHtml(payload?.thong_bao || "Đã xóa key.")}`;
  }
  if (action === "encrypt") {
    return `<b>🔒 CHECK KEY MÃ HÓA CHỐNG DUMP</b>\n\n✅ <b>Hợp lệ:</b> <i>${escapeHtml(payload?.hop_le ?? "Không rõ")}</i>\n🧾 <b>Lý do:</b> <i>${escapeHtml(payload?.ly_do || "Đã kiểm tra")}</i>\n🆔 <b>Nonce:</b> <code>${escapeHtml(payload?.nonce || "-")}</code>${payload?.iv ? `\n🔐 <b>IV:</b> <code>${escapeHtml(payload.iv)}</code>` : ""}${payload?.encrypted_data ? `\n📦 <b>Dữ liệu mã hóa:</b>\n<code>${escapeHtml(payload.encrypted_data)}</code>` : ""}`;
  }
  return `<b>✅ CHECK ZheeTool KEY</b>\n\n✅ <b>Hợp lệ:</b> <i>${escapeHtml(payload?.hop_le ?? "Không rõ")}</i>\n🧾 <b>Trạng thái:</b> <i>${escapeHtml(payload?.ly_do || "Đã kiểm tra")}</i>\n🔢 <b>Lượt còn lại:</b> <i>${escapeHtml(payload?.so_luot_con_lai ?? "-")}</i>\n⏰ <b>Hết hạn:</b> <i>${escapeHtml(payload?.thoi_gian_het_han || "-")}</i>\n🛡️ <b>Nonce:</b> <code>${escapeHtml(payload?.nonce || "-")}</code>`;
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
  return `<b>🎲 TÀI XỈU</b>\n<i>Các công cụ phân tích chuỗi hash theo từng sảnh game</i>\n\n<blockquote>🔵 🎯 <b>Cầu B52</b> · MD5 Standard, dự đoán cửa, tổng điểm và bộ ba nút.\n🟣 🎲 <b>Cầu 789Club</b> · MD5 Standard, dự đoán Tài/Xỉu, chẵn/lẻ và bộ ba nút.\n🟠 🎰 <b>Cầu Sunwin</b> · MD5 Standard, dự đoán Tài/Xỉu, chẵn/lẻ và bộ ba nút.\n🔴 🎯 <b>Cầu Hitclub</b> · hỗ trợ MD5 hoặc SHA-256, dự đoán cửa và độ tin cậy.\n\n🔐 MD5: <code>32 ký tự</code> · SHA-256 Hitclub: <code>64 ký tự hex</code></blockquote>`;
}

function suka88Text() {
  return `<b>🎮 KHU GIẢI TRÍ SUKA88</b>\n<i>Nhiều game thương hiệu SUKA88 · chơi thử vui, không đặt cược</i>\n\n<blockquote>🔵 🎲 <b>Tài Xỉu</b> · lắc 3 xúc xắc và xem tổng điểm.\n🟣 🃏 <b>Bài Tây</b> · rút ngẫu nhiên 1–3 lá.\n🟠 🦀 <b>Bầu Cua</b> · lắc 3 mặt Nai, Bầu, Gà, Cá, Cua, Tôm.\n🔴 🎴 <b>Baccarat</b> · chia bài Con và Cái theo luật cơ bản.</blockquote>\n\n<i>Chọn một game bên dưới để bắt đầu.</i>`;
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
  return `<b>🛠️ ADMIN</b>\n\n<blockquote>🟢 <b>Khu vực quản trị</b>\n🔐 Cấu hình captcha và các thiết lập bảo vệ bot.\n🟡 Chỉ tài khoản quản trị được phép truy cập.</blockquote>\n\n<i>Chọn nhóm quản trị cần mở.</i>`;
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

async function handleRemoveBg(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const imageUrl = String(input || "").trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch (_) {
    parsedUrl = null;
  }
  if (!parsedUrl || !/^https?:$/.test(parsedUrl.protocol)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>URL ảnh chưa hợp lệ</b>\n\nHãy gửi URL ảnh công khai bắt đầu bằng <code>https://</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:removebg", "🔄 Dùng lại Xóa nền AI")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang xóa nền ảnh...</b>\n\n<i>Bot đang xử lý ảnh và chuẩn bị gửi PNG trực tiếp.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/tools/removebg?url=${encodeURIComponent(imageUrl)}`, { signal: AbortSignal.timeout(60000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    if (!payload.du_lieu_data_url) throw new Error("Endpoint không trả về ảnh Data URI.");
    pendingActions.delete(String(chatId));
    await clearPendingAction(chatId);
    const result = await sendRemoveBgPhoto(chatId, payload.du_lieu_data_url);
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể xóa nền ảnh</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:removebg", "🔄 Dùng lại Xóa nền AI")
    });
  }
}

async function sendAnimeMediaGroup(chatId, items, summary, replyMarkup) {
  await clearPreviousBotMessages(chatId);
  const media = items.slice(0, 6).map((item, index) => ({
    type: "photo",
    media: item.url,
    ...(index === 0 ? { caption: "🌸 Anime Images · Ảnh trong trang hiện tại", parse_mode: "HTML" } : {})
  }));
  const group = await telegram("sendMediaGroup", { chat_id: chatId, media });
  const ids = Array.isArray(group) ? group.map((item) => item?.message_id).filter(Boolean) : [];
  const result = await telegram("sendMessage", {
    chat_id: chatId,
    text: summary,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  });
  if (result?.message_id) ids.push(result.message_id);
  botMessages.set(String(chatId), ids);
  try { await setBotMessageId(chatId, ids); } catch (_) {}
  return result;
}

async function handleAnime(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const parsed = parseAnimeInput(input);
  if (!parsed) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Tham số Anime chưa hợp lệ</b>\n\nDùng mẫu <code>PageSize Page</code>, ví dụ <code>10 2</code>.\nPageSize từ 1 đến 20, Page từ 1 trở lên.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:anime", "🔄 Dùng lại Anime Images")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: `⏳ <b>Đang lấy ảnh Anime...</b>\n\n📄 PageSize: <code>${parsed.pageSize}</code> · Page: <code>${parsed.page}</code>`,
      parse_mode: "HTML"
    });
    const params = new URLSearchParams({ PageSize: String(parsed.pageSize), Page: String(parsed.page) });
    const response = await fetch(`${baseUrl}/api/anime/images?${params.toString()}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const data = payload.du_lieu || {};
    const resultText = toolsAnimeResultText(payload, parsed.pageSize, parsed.page);
    const resultKeyboard = animeResultKeyboard(parsed.pageSize, parsed.page, Boolean(data.hasPreviousPage), Boolean(data.hasNextPage));
    try {
      return await sendAnimeMediaGroup(chatId, data.items || [], resultText, resultKeyboard);
    } catch (_) {
      return sendTracked("sendMessage", chatId, {
        text: `${resultText}\n\n⚠️ <i>Telegram không thể gửi album ảnh này, bạn có thể dùng link ảnh trong API.</i>`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: resultKeyboard
      });
    }
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể lấy ảnh Anime</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:anime", "🔄 Dùng lại Anime Images")
    });
  }
}

async function sendBadgePhoto(chatId, badgeUrl, caption) {
  const response = await fetch(badgeUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Không tải được ảnh badge: HTTP ${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  let png = source;
  try { png = await require("sharp")(source).png().toBuffer(); } catch (_) {}
  const fields = { caption, parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:badge", "🔄 Tạo badge khác") };
  try {
    const result = await telegramUploadBytes("sendPhoto", chatId, fields, "photo", "zhee-badge.png", png, "image/png");
    if (result?.message_id) {
      botMessages.set(String(chatId), result.message_id);
      try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
    }
    return result;
  } catch (_) {
    const result = await telegramUploadBytes("sendDocument", chatId, fields, "document", "zhee-badge.png", png, "image/png");
    if (result?.message_id) {
      botMessages.set(String(chatId), result.message_id);
      try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
    }
    return result;
  }
}

async function handleBadge(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const parsed = parseBadgeInput(input);
  if (!parsed) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Thông tin badge chưa hợp lệ</b>\n\nDùng mẫu <code>label | status | color</code>, ví dụ <code>Build | Passing | green</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:badge", "🔄 Tạo badge khác")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tạo ảnh SVG badge...</b>", parse_mode: "HTML" });
    const params = new URLSearchParams(parsed);
    const badgeUrl = `${baseUrl}/api/badge?${params.toString()}`;
    const response = await fetch(badgeUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !String(response.headers.get("content-type") || "").includes("image/svg")) throw new Error(`Badge API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = `${toolsBadgeResultText({ ...parsed, url: badgeUrl })}\n\n<i>Ảnh badge đã được gửi trực tiếp.</i>`;
    return await sendBadgePhoto(chatId, badgeUrl, caption);
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tạo SVG badge</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:badge", "🔄 Tạo badge khác")
    });
  }
}

function parseNglSendInput(input) {
  const lines = String(input || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const username = lines[0];
  const question = lines.slice(1).join(" ").trim();
  if (!username || !question || question.length > 300) return null;
  return { username, question };
}

async function handleSoundcloud(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const query = String(input || "").trim();
  if (!query || query.length > 300) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Từ khóa SoundCloud chưa hợp lệ</b>\n\nVí dụ:\n<code>Cắt Đôi Nỗi Sầu</code>\n<code>Cat Doi Noi Sau</code>\n<code>https://soundcloud.com/...</code>",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:soundcloud")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tra cứu SoundCloud...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/mxh/soundcloud?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `SoundCloud API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = soundcloudResultText(payload);
    const keyboard = soundcloudResultKeyboard(payload);
    const data = payload?.du_lieu?.ket_qua_chinh || {};
    let primaryResult = null;
    if (data.link_audio_mp3) {
      try {
        primaryResult = await sendTracked("sendAudio", chatId, {
          audio: data.link_audio_mp3,
          title: data.tieu_de || "SoundCloud track",
          performer: data.tac_gia || "SoundCloud",
          caption,
          parse_mode: "HTML",
          reply_markup: keyboard
        });
      } catch (_) {}
    }
    if (!primaryResult && data.anh_bia_hd) {
      try { primaryResult = await sendTracked("sendPhoto", chatId, { photo: data.anh_bia_hd, caption, parse_mode: "HTML", reply_markup: keyboard }); } catch (_) {}
    }
    if (!primaryResult) {
      primaryResult = await sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
    }
    const ids = primaryResult?.message_id ? [primaryResult.message_id] : [];
    const relatedText = soundcloudRelatedText(payload);
    if (relatedText) {
      const relatedResult = await telegram("sendMessage", {
        chat_id: chatId,
        text: relatedText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: keyboard
      });
      if (relatedResult?.message_id) ids.push(relatedResult.message_id);
    }
    botMessages.set(String(chatId), ids);
    try { await setBotMessageId(chatId, ids); } catch (_) {}
    return primaryResult;
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:soundcloud" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu SoundCloud</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:soundcloud")
    });
  }
}

async function handleSpotify(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const query = String(input || "").trim();
  if (!query || query.length > 300) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Từ khóa Spotify chưa hợp lệ</b>\n\nVí dụ:\n<code>Sơn Tùng M-TP Âm Thầm Bên Em</code>\n<code>https://open.spotify.com/track/...</code>",
      parse_mode: "HTML",
      reply_markup: spotifyErrorKeyboard()
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tra cứu Spotify...</b>\n\n<i>Đang thử cả tên có dấu và không dấu.</i>", parse_mode: "HTML" });
    const withoutMarks = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
    const queries = [...new Set([query, withoutMarks])];
    let payload = null;
    let lastError = "Không tìm thấy bài hát hoặc nghệ sĩ trên Spotify.";
    for (const candidate of queries) {
      const response = await fetch(`${baseUrl}/api/mxh/spotify?q=${encodeURIComponent(candidate)}`, { signal: AbortSignal.timeout(30000) });
      const current = await response.json().catch(() => ({}));
      if (response.ok && current.trang_thai === "thanh_cong") {
        payload = current;
        break;
      }
      lastError = current.thong_bao || lastError;
    }
    if (!payload) throw new Error(lastError);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = spotifyResultText(payload);
    const keyboard = spotifyResultKeyboard(payload);
    const ids = [];
    const album = payload?.du_lieu?.anh_bia_hd;
    if (album) {
      try {
        const photo = await telegram("sendPhoto", { chat_id: chatId, photo: album, caption, parse_mode: "HTML", reply_markup: keyboard });
        if (photo?.message_id) ids.push(photo.message_id);
      } catch (_) {}
    }
    if (!ids.length) {
      const result = await telegram("sendMessage", { chat_id: chatId, text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
      if (result?.message_id) ids.push(result.message_id);
    }
    const lyrics = String(payload?.du_lieu?.loi_bai_hat || "").trim();
    if (lyrics) {
      const chunks = splitTelegramText(`<b>📜 LỜI BÀI HÁT</b>\n\n${escapeHtml(lyrics)}`, 3500);
      for (const chunk of chunks) {
        const result = await telegram("sendMessage", { chat_id: chatId, text: sanitizeTelegramUtf8(chunk), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
        if (result?.message_id) ids.push(result.message_id);
      }
    }
    botMessages.set(String(chatId), ids);
    try { await setBotMessageId(chatId, ids); } catch (_) {}
    return ids;
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:spotify" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu Spotify</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: spotifyErrorKeyboard()
    });
  }
}

async function handleTiktok(chatId, input, mode, incomingMessageId) {
  const { baseUrl } = config();
  const url = String(input || "").trim();
  const isProfileMode = mode === "profile";
  const validInput = isProfileMode
    ? (url.length <= 120 && ( /^[a-zA-Z0-9._-]+$/.test(url) || /^https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+(?:[/?#].*)?$/i.test(url) ))
    : (/^https?:\/\/(?:(?:www|vm|vt|m)\.)?tiktok\.com\//i.test(url) && url.length <= 2048);
  if (!validInput) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: isProfileMode
        ? "⚠️ <b>Username/link TikTok chưa hợp lệ</b>\n\nVí dụ: <code>pitochk</code> hoặc <code>https://www.tiktok.com/@pitochk</code>."
        : mode === "photo"
          ? "⚠️ <b>Link Photo Mode chưa hợp lệ</b>\n\nGửi link dạng <code>https://www.tiktok.com/@user/photo/123456789</code>."
          : "⚠️ <b>Link video TikTok chưa hợp lệ</b>\n\nGửi link dạng <code>https://www.tiktok.com/@user/video/123456789</code>.",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:tiktok")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang lấy video TikTok...</b>", parse_mode: "HTML" });
    const apiUrl = isProfileMode
      ? `${baseUrl}/api/mxh/tiktok?=${encodeURIComponent(url)}`
      : `${baseUrl}/api/mxh/tiktok?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(45000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `TikTok API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    if (mode === "photo" && payload.loai !== "tiktok_photo") throw new Error("Link này không phải Photo Mode hoặc TikTok không trả được ảnh.");
    if (payload.loai === "tiktok_photo") {
      try { await setTiktokPhotoSession(chatId, { payload }); } catch (_) {}
      return sendTiktokPhotoPage(chatId, { payload }, 1);
    }
    if (payload.thong_tin_ca_nhan) {
      const profileCaption = tiktokProfileText(payload);
      const profileKeyboard = tiktokProfileKeyboard(payload);
      const avatar = payload.thong_tin_ca_nhan.anh_dai_dien;
      if (avatar) {
        try { return await sendTracked("sendPhoto", chatId, { photo: avatar, caption: profileCaption, parse_mode: "HTML", reply_markup: profileKeyboard }); } catch (_) {}
      }
      return sendTracked("sendMessage", chatId, { text: profileCaption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: profileKeyboard });
    }
    const caption = tiktokResultText(payload);
    const keyboard = tiktokResultKeyboard(payload);
    const video = payload?.link_tai?.video_khong_logo || payload?.link_tai?.video_hd;
    if (video) {
      try { return await sendTracked("sendVideo", chatId, { video, caption, parse_mode: "HTML", supports_streaming: true, reply_markup: keyboard }); } catch (_) {}
    }
    const cover = payload?.anh_bia;
    if (cover) {
      try { return await sendTracked("sendPhoto", chatId, { photo: cover, caption, parse_mode: "HTML", reply_markup: keyboard }); } catch (_) {}
    }
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:tiktok" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể lấy video TikTok</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:tiktok")
    });
  }
}

async function handleGithub(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const username = String(input || "").trim().replace(/^@+/, "");
  if (!username || username.length > 100) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>GitHub username chưa hợp lệ</b>\n\nVí dụ:\n<code>hoducminh123</code>",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:github")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tra cứu GitHub...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/mxh/github?=${encodeURIComponent(username)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `GitHub API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const keyboard = githubResultKeyboard(payload);
    const ids = [];
    const avatar = payload?.thong_tin_ca_nhan?.anh_dai_dien;
    if (avatar) {
      try {
        const photo = await telegram("sendPhoto", { chat_id: chatId, photo: avatar, caption: githubResultText(payload), parse_mode: "HTML", reply_markup: keyboard });
        if (photo?.message_id) ids.push(photo.message_id);
      } catch (_) {}
    }
    if (!ids.length) {
      const result = await telegram("sendMessage", { chat_id: chatId, text: githubResultText(payload), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
      if (result?.message_id) ids.push(result.message_id);
    }
    const repos = githubReposText(payload);
    for (const chunk of splitTelegramText(repos, 3500)) {
      const result = await telegram("sendMessage", { chat_id: chatId, text: sanitizeTelegramUtf8(chunk), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
      if (result?.message_id) ids.push(result.message_id);
    }
    botMessages.set(String(chatId), ids);
    try { await setBotMessageId(chatId, ids); } catch (_) {}
    return ids;
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:github" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu GitHub</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:github")
    });
  }
}

async function handleRoblox(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const query = String(input || "").trim();
  if (!query || query.length > 120) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Roblox username/ID chưa hợp lệ</b>\n\nVí dụ:\n<code>OsbornLauren5</code>\n<code>7559629944</code>",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:roblox")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang kiểm tra Roblox...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/mxh/roblox?=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Roblox API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = robloxResultText(payload);
    const keyboard = robloxResultKeyboard(payload);
    const avatar = payload?.hinh_anh_avatar?.avatar_headshot_chan_dung || payload?.hinh_anh_avatar?.avatar_toan_than_3d;
    if (avatar) {
      try { return await sendTracked("sendPhoto", chatId, { photo: avatar, caption, parse_mode: "HTML", reply_markup: keyboard }); } catch (_) {}
    }
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:roblox" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu Roblox</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:roblox")
    });
  }
}

async function handleShopee(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const query = String(input || "").trim();
  if (!query || query.length > 2048) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Username/Shop ID Shopee chưa hợp lệ</b>\n\nVí dụ:\n<code>apple_flagship_store</code>\n<code>88201679</code>\n<code>https://shopee.vn/apple_flagship_store</code>",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:shopee")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tra cứu Shopee...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/mxh/shopee?=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong" || !payload?.du_lieu?.ton_tai) {
      throw new Error(payload.thong_bao || `Shopee API HTTP ${response.status}`);
    }
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = shopeeResultText(payload);
    const keyboard = shopeeResultKeyboard(payload);
    const photo = payload?.du_lieu?.avatar || payload?.du_lieu?.anh_bia;
    if (photo) {
      try {
        return await sendTracked("sendPhoto", chatId, { photo, caption, parse_mode: "HTML", reply_markup: keyboard });
      } catch (_) {
        try {
          await clearPreviousBotMessages(chatId);
          const result = await telegramUpload(
            "sendPhoto",
            chatId,
            { caption, parse_mode: "HTML", reply_markup: keyboard },
            "photo",
            "shopee-avatar.jpg",
            photo
          );
          if (result?.message_id) {
            botMessages.set(String(chatId), result.message_id);
            try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
          }
          return result;
        } catch (_) {}
      }
    }
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:shopee" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu Shopee</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:shopee")
    });
  }
}

async function handleSocialLookup(chatId, input, incomingMessageId, options) {
  const { baseUrl } = config();
  const query = String(input || "").trim();
  const {
    action,
    apiPath,
    invalidText,
    loadingText,
    errorTitle,
    resultText,
    resultKeyboard,
    photoOf
  } = options;
  if (!query || query.length > 2048) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: invalidText,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard(action)
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: loadingText, parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}${apiPath}${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") {
      throw new Error(payload.thong_bao || `${action} HTTP ${response.status}`);
    }
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = resultText(payload);
    const keyboard = resultKeyboard(payload);
    const photo = photoOf ? photoOf(payload) : "";
    if (photo) {
      try {
        return await sendTracked("sendPhoto", chatId, { photo, caption, parse_mode: "HTML", reply_markup: keyboard });
      } catch (_) {
        try {
          await clearPreviousBotMessages(chatId);
          const result = await telegramUpload(
            "sendPhoto",
            chatId,
            { caption, parse_mode: "HTML", reply_markup: keyboard },
            "photo",
            options.photoName || "preview.jpg",
            photo,
            options.photoHeaders || {}
          );
          if (result?.message_id) {
            botMessages.set(String(chatId), result.message_id);
            try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
          }
          return result;
        } catch (_) {}
      }
    }
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
  } catch (error) {
    if (!/không tìm thấy|không lấy được|không hợp lệ|HTTP 404/i.test(String(error.message || ""))) {
      await notifyAdminError(error, { chatId, action });
    }
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>${errorTitle}</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard(action)
    });
  }
}

async function handleTiki(chatId, input, incomingMessageId) {
  return handleSocialLookup(chatId, input, incomingMessageId, {
    action: "social:tiki",
    apiPath: "/api/mxh/tiki?=",
    invalidText: "⚠️ <b>Link/ID Tiki chưa hợp lệ</b>\n\nVí dụ:\n<code>198944761</code>\n<code>https://tiki.vn/...-p198944761.html</code>",
    loadingText: "⏳ <b>Đang tra cứu Tiki...</b>",
    errorTitle: "Không thể tra cứu Tiki",
    resultText: tikiResultText,
    resultKeyboard: tikiResultKeyboard,
    photoOf: (payload) => payload?.anh_dai_dien || (Array.isArray(payload?.danh_sach_anh) ? payload.danh_sach_anh[0] : ""),
    photoName: "tiki.jpg",
    photoHeaders: { Referer: "https://tiki.vn/" }
  });
}

async function handleLazada(chatId, input, incomingMessageId) {
  return handleSocialLookup(chatId, input, incomingMessageId, {
    action: "social:lazada",
    apiPath: "/api/mxh/lazada?=",
    invalidText: "⚠️ <b>Link shop/sản phẩm Lazada chưa hợp lệ</b>\n\nVí dụ:\n<code>https://www.lazada.vn/shop/sony-official/</code>",
    loadingText: "⏳ <b>Đang tra cứu Lazada...</b>",
    errorTitle: "Không thể tra cứu Lazada",
    resultText: lazadaResultText,
    resultKeyboard: lazadaResultKeyboard,
    photoOf: (payload) => payload?.anh_dai_dien_san_pham || (Array.isArray(payload?.danh_sach_anh) ? payload.danh_sach_anh[0] : ""),
    photoName: "lazada.jpg",
    photoHeaders: { Referer: "https://www.lazada.vn/" }
  });
}

async function handlePinterest(chatId, input, incomingMessageId) {
  const query = String(input || "").trim();
  if (!query || query.length > 2048) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Username/link Pinterest chưa hợp lệ</b>\n\nVí dụ:\n<code>pinterest</code>\n<code>https://www.pinterest.com/pinterest/</code>",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:pinterest")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tra cứu Pinterest...</b>", parse_mode: "HTML" });
    const payload = await pinterestApi.lookupAny(query);
    if (!payload || payload.trang_thai !== "thanh_cong") {
      throw new Error("Không tìm thấy tài khoản Pinterest công khai.");
    }
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = pinterestResultText(payload);
    const keyboard = pinterestResultKeyboard(payload);
    const data = payload.du_lieu || {};
    const photo = data.avatar || data.anh_bia || data.anh?.url || "";
    if (photo) {
      try {
        return await sendTracked("sendPhoto", chatId, { photo, caption, parse_mode: "HTML", reply_markup: keyboard });
      } catch (_) {
        try {
          await clearPreviousBotMessages(chatId);
          const result = await telegramUpload(
            "sendPhoto",
            chatId,
            { caption, parse_mode: "HTML", reply_markup: keyboard },
            "photo",
            "pinterest.jpg",
            photo,
            { Referer: "https://www.pinterest.com/" }
          );
          if (result?.message_id) {
            botMessages.set(String(chatId), result.message_id);
            try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
          }
          return result;
        } catch (_) {}
      }
    }
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
  } catch (error) {
    if (!/không tìm thấy|không lấy được/i.test(String(error.message || ""))) {
      await notifyAdminError(error, { chatId, action: "social:pinterest" });
    }
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tra cứu Pinterest</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:pinterest:user")
    });
  }
}

async function sendPinterestSearchPage(chatId, session, requestedPage = 1) {
  const page = Math.max(1, Number(requestedPage) || 1);
  const payload = await pinterestApi.searchPinterestImages({
    query: session.query,
    site: session.site,
    page
  });
  if (!payload?.du_lieu?.anh?.length) {
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Không tìm thấy ảnh Pinterest</b>\n\nThử từ khóa khác hoặc website khác.",
      parse_mode: "HTML",
      reply_markup: pinterestSearchPageKeyboard(page, 1)
    });
  }
  const data = payload.du_lieu;
  const photos = [...new Set(
    data.anh.map((item) => telegramPinUrl(item?.anh?.url)).filter(Boolean)
  )].slice(0, 10);
  const totalPages = Math.max(1, Number(data.so_trang) || (photos.length >= 10 ? page + 1 : page));
  const caption = pinterestResultText(payload);
  const keyboard = pinterestSearchPageKeyboard(page, totalPages);
  await clearPreviousBotMessages(chatId);
  const ids = [];
  const downloaded = await Promise.all(photos.map(async (url, index) => {
    try {
      const file = await downloadTelegramPhoto(url);
      return { ...file, filename: `pin-${index + 1}.${file.extension}` };
    } catch (_) {
      return null;
    }
  }));
  const files = downloaded.filter(Boolean);
  let albumSent = false;
  if (files.length > 1) {
    try {
      const group = await telegramUploadMediaGroup(chatId, files, caption);
      if (Array.isArray(group)) group.forEach((item) => item?.message_id && ids.push(item.message_id));
      albumSent = ids.length > 1;
    } catch (_) {
      albumSent = false;
    }
  }
  if (!albumSent && files[0]) {
    try {
      const result = await telegramUploadBytes(
        "sendPhoto",
        chatId,
        files.length === 1
          ? { caption, parse_mode: "HTML", reply_markup: keyboard }
          : { caption, parse_mode: "HTML" },
        "photo",
        files[0].filename,
        files[0].bytes,
        files[0].mime
      );
      if (result?.message_id) ids.push(result.message_id);
    } catch (_) {}
  }
  if (files.length !== 1) {
    const result = await telegram("sendMessage", {
      chat_id: chatId,
      text: files.length
        ? `🖼️ <b>Pinterest · Trang ${page}/${totalPages}</b> · ${files.length} ảnh`
        : "⚠️ <b>Không gửi được album ảnh Pinterest.</b>",
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: keyboard
    });
    if (result?.message_id) ids.push(result.message_id);
  }
  botMessages.set(String(chatId), ids);
  try { await setBotMessageId(chatId, ids); } catch (_) {}
  try { await setPinterestSearchSession(chatId, { query: session.query, site: session.site, page }); } catch (_) {}
  return ids;
}

async function handlePinterestSearch(chatId, input, incomingMessageId) {
  const query = String(input || "").trim();
  if (!query || query.length > 200) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Từ khóa/website chưa hợp lệ</b>\n\nVí dụ:\n<code>cat</code>\n<code>nytimes.com</code>",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:pinterest:search")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tìm 10 ảnh Pinterest...</b>", parse_mode: "HTML" });
    const site = pinterestApi.looksLikeWebsite(query) ? query : "";
    const session = { query: site ? "" : query, site, page: 1 };
    try { await setPinterestSearchSession(chatId, session); } catch (_) {}
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    return sendPinterestSearchPage(chatId, session, 1);
  } catch (error) {
    if (!/không tìm thấy/i.test(String(error.message || ""))) {
      await notifyAdminError(error, { chatId, action: "social:pinterest:search" });
    }
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không tìm được ảnh Pinterest</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:pinterest:search")
    });
  }
}

async function handleLocket(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const username = String(input || "").trim();
  if (!username || username.length > 120) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Username Locket chưa hợp lệ</b>\n\nGửi username hoặc link profile, ví dụ:\n<code>minh</code>\n<code>https://locket.cam/minh</code>",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:locket")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang kiểm tra Locket username...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/tools/locket?username=${encodeURIComponent(username)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Locket API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = locketResultText(payload);
    const avatar = payload?.du_lieu?.anh_dai_dien;
    if (avatar) {
      try {
        return await sendTracked("sendPhoto", chatId, { photo: avatar, caption, parse_mode: "HTML", reply_markup: locketResultKeyboard(payload) });
      } catch (_) {}
    }
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: locketResultKeyboard(payload) });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "social:locket" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể kiểm tra Locket</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard("social:locket")
    });
  }
}

async function handleNgl(chatId, input, mode, incomingMessageId) {
  const { baseUrl } = config();
  const raw = String(input || "").trim();
  const sendMode = mode === "send";
  const parsed = sendMode ? parseNglSendInput(raw) : { username: raw };
  if (!parsed?.username || (sendMode && !parsed.question)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: sendMode
        ? "⚠️ <b>Nội dung NGL chưa hợp lệ</b>\n\nGửi 2 dòng:\n<code>username NGL\nNội dung tin nhắn</code>\n\nVí dụ:\n<code>hoducminh\nxin chào bạn</code>"
        : "⚠️ <b>Username NGL chưa hợp lệ</b>\n\nGửi username hoặc link, ví dụ:\n<code>hoducminh</code>\n<code>https://ngl.link/hoducminh</code>",
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard(sendMode ? "social:ngl:send" : "social:ngl:check")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: sendMode ? "⏳ <b>Đang gửi 1 tin NGL ẩn danh...</b>" : "⏳ <b>Đang kiểm tra NGL username...</b>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/tools/ngl`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(sendMode
        ? { action: "send", username: parsed.username, question: parsed.question }
        : { username: parsed.username }),
      signal: AbortSignal.timeout(30000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `NGL API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: nglResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: socialResultKeyboard(sendMode ? "social:ngl:send" : "social:ngl:check")
    });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: `social:ngl:${mode}` });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể xử lý NGL</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: socialResultKeyboard(sendMode ? "social:ngl:send" : "social:ngl:check")
    });
  }
}

async function handleTempMail(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const email = String(input || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Email chưa hợp lệ</b>\n\nHãy gửi địa chỉ đầy đủ, ví dụ:\n<code>user@10minutemail.com</code>",
      parse_mode: "HTML",
      reply_markup: mailToolKeyboard("mail:temp", "🔄 Check email khác")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang kiểm tra domain email...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/mail/temp-check?email=${encodeURIComponent(email)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Email API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsTempMailResultText(payload),
      parse_mode: "HTML",
      reply_markup: mailToolKeyboard("mail:temp", "🔄 Check email khác")
    });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "mail:temp" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể kiểm tra email</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: mailToolKeyboard("mail:temp", "🔄 Thử lại")
    });
  }
}

async function handleCreateTempMail(chatId, kind = "dai") {
  const { baseUrl } = config();
  const allowed = new Set(["ngan", "dai", "guerrilla", "mix"]);
  const safeKind = allowed.has(kind) ? kind : "dai";
  try {
    await sendTracked("sendMessage", chatId, {
      text: `⏳ <b>Đang tạo mail ${escapeHtml(safeKind)}...</b>\n\n<i>Đang gọi dịch vụ mail tạm. Không lưu thông tin trên server.</i>`,
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/mail/taomail?kieu=${encodeURIComponent(safeKind)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Tạo mail HTTP ${response.status}`);
    const firstMailbox = Array.isArray(payload.hop_thu) ? payload.hop_thu[0] : null;
    const mailboxSession = firstMailbox?.email
      ? { email: firstMailbox.email, mk: firstMailbox.mat_khau || "", sid: firstMailbox.sid || "", kind: safeKind }
      : null;
    if (mailboxSession) {
      const encoded = Buffer.from(JSON.stringify(mailboxSession), "utf8").toString("base64url");
      pendingActions.set(String(chatId), `mailbox:${encoded}`);
      try { await setPendingAction(chatId, `mailbox:${encoded}`); } catch (_) {}
    }
    return sendTracked("sendMessage", chatId, {
      text: createTempMailResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: createTempMailResultKeyboard(safeKind, Boolean(mailboxSession))
    });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: `mail:create:${safeKind}` });
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tạo mail tạm</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: createTempMailKeyboard()
    });
  }
}

async function handleTempInbox(chatId) {
  const { baseUrl } = config();
  let action = String(pendingActions.get(String(chatId)) || "");
  if (!action.startsWith("mailbox:")) {
    try {
      const stored = await getPendingAction(chatId);
      action = String(stored?.action || "");
      if (action.startsWith("mailbox:")) pendingActions.set(String(chatId), action);
    } catch (_) {}
  }
  if (!action.startsWith("mailbox:")) {
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Phiên hộp thư đã hết hạn</b>\n\nHãy tạo một mail tạm mới rồi bấm <b>📨 Đọc hộp thư</b>.",
      parse_mode: "HTML",
      reply_markup: createTempMailKeyboard()
    });
  }
  let mailbox;
  try {
    mailbox = JSON.parse(Buffer.from(action.slice("mailbox:".length), "base64url").toString("utf8"));
  } catch (_) {
    mailbox = null;
  }
  if (!mailbox?.email) {
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Thông tin hộp thư không hợp lệ</b>\n\nHãy tạo lại mail tạm.",
      parse_mode: "HTML",
      reply_markup: createTempMailKeyboard()
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang đọc hộp thư...</b>", parse_mode: "HTML" });
    const params = new URLSearchParams({ action: "thu", email: mailbox.email });
    if (mailbox.mk) params.set("mk", mailbox.mk);
    if (mailbox.sid) params.set("sid", mailbox.sid);
    const response = await fetch(`${baseUrl}/mail/taomail?${params.toString()}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Đọc hộp thư HTTP ${response.status}`);
    return sendTracked("sendMessage", chatId, {
      text: tempInboxResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: tempInboxKeyboard()
    });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "mail:inbox" });
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể đọc hộp thư</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: tempInboxKeyboard()
    });
  }
}

async function handleMail(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const pendingAction = String(pendingActions.get(String(chatId)) || "tools:mail");
  const requestedFolder = /^tools:mail:folder:([^:]+)(?::page:(\d+))?$/.exec(pendingAction);
  const folder = requestedFolder ? requestedFolder[1] : "chinh";
  const page = requestedFolder?.[2] ? Math.max(1, Number(requestedFolder[2])) : 1;
  const parsed = parseMailInput(input);
  if (!parsed) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Thông tin Mail chưa hợp lệ</b>\n\nGửi 2 dòng: email ở dòng 1, mật khẩu ứng dụng ở dòng 2.\nVí dụ:\n<code>ban@gmail.com\nxxxx xxxx xxxx xxxx</code>",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:mail", "🔄 Kiểm tra Mail khác")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang kết nối hộp thư...</b>\n\n<i>Đang kiểm tra tab Chính Gmail. Mật khẩu không được lưu.</i>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/mail/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: parsed.email, mk: parsed.password, muc: folder, so: 10, trang: page }),
      signal: AbortSignal.timeout(45000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Mail API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsMailResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: mailResultKeyboard(payload)
    });
  } catch (error) {
    await notifyAdminError(error, { chatId, action: "tools:mail" });
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể kiểm tra hộp thư</b>\n\n<i>${escapeHtml(error.message)}</i>\n\n🔐 <i>Hãy kiểm tra email và mật khẩu ứng dụng Gmail. Không dùng mật khẩu tài khoản chính.</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:mail", "🔄 Kiểm tra Mail khác")
    });
  }
}

async function handleMetadata(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const url = String(input || "").trim();
  if (!url || url.length > 2048 || !/^https?:\/\//i.test(url)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>URL chưa hợp lệ</b>\n\nHãy gửi URL công khai bắt đầu bằng <code>https://</code> hoặc <code>http://</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:metadata", "🔄 Kiểm tra URL khác")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang bóc tách metadata...</b>\n\n<i>Đang đọc title, description và Open Graph.</i>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/metadata?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Metadata API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsMetadataResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: false,
      reply_markup: toolResultKeyboard("tools:metadata", "🔄 Kiểm tra URL khác")
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể bóc tách metadata</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:metadata", "🔄 Kiểm tra URL khác")
    });
  }
}

async function handleShortener(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const parsed = parseShortenerInput(input);
  if (!parsed) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>URL chưa hợp lệ</b>\n\nGửi theo mẫu <code>https://example.com tinyurl</code> hoặc <code>https://example.com bitly</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:shortener", "🔄 Rút gọn URL khác")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang rút gọn URL...</b>\n\n<i>Đang kết nối nhà cung cấp link.</i>", parse_mode: "HTML" });
    const params = new URLSearchParams({ url: parsed.url, provider: parsed.provider });
    const response = await fetch(`${baseUrl}/api/tools/shortener?${params.toString()}`, { signal: AbortSignal.timeout(20000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Shortener API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsShortenerResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: false,
      reply_markup: toolResultKeyboard("tools:shortener", "🔄 Rút gọn URL khác")
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể rút gọn URL</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:shortener", "🔄 Rút gọn URL khác")
    });
  }
}

async function handleQr(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const parsed = parseQrInput(input);
  if (!parsed) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Thông tin QR chưa hợp lệ</b>\n\nDùng mẫu <code>Nội dung hoặc URL kích_thước</code>, ví dụ <code>https://example.com 300</code>.\nKích thước từ 100 đến 1000.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:qr", "🔄 Tạo QR khác")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tạo mã QR...</b>\n\n<i>Đang tạo ảnh QR và chuẩn bị gửi trực tiếp.</i>", parse_mode: "HTML" });
    const params = new URLSearchParams({ url: parsed.text, size: String(parsed.size) });
    const response = await fetch(`${baseUrl}/api/tools/qr?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong" || !payload.link_anh_qr) throw new Error(payload.thong_bao || `QR API HTTP ${response.status}`);
    const imageResponse = await fetch(payload.link_anh_qr, { signal: AbortSignal.timeout(15000) });
    if (!imageResponse.ok) throw new Error(`Không tải được ảnh QR: HTTP ${imageResponse.status}`);
    const source = Buffer.from(await imageResponse.arrayBuffer());
    let png = source;
    try { png = await require("sharp")(source).png().toBuffer(); } catch (_) {}
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = `${toolsQrResultText({ text: parsed.text, size: parsed.size }, payload.link_anh_qr)}\n\n<i>Ảnh QR đã được gửi trực tiếp.</i>`;
    const fields = { caption, parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:qr", "🔄 Tạo QR khác") };
    const upload = async (method, field) => {
      const result = await telegramUploadBytes(method, chatId, fields, field, "zhee-qr.png", png, "image/png");
      if (result?.message_id) {
        botMessages.set(String(chatId), result.message_id);
        try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
      }
      return result;
    };
    try { return await upload("sendPhoto", "photo"); } catch (_) { return upload("sendDocument", "document"); }
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tạo mã QR</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:qr", "🔄 Tạo QR khác")
    });
  }
}

async function handleAvatar(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const name = String(input || "").trim();
  if (!name || name.length > 120) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Tên chưa hợp lệ</b>\n\nHãy gửi tên dài tối đa 120 ký tự để tạo avatar.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:avatar", "🔄 Tạo avatar khác")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tạo avatar...</b>\n\n<i>Đang tạo ảnh chữ cái từ tên của bạn.</i>", parse_mode: "HTML" });
    const avatarUrl = `${baseUrl}/api/avatar?name=${encodeURIComponent(name)}`;
    const response = await fetch(avatarUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !String(response.headers.get("content-type") || "").includes("image/svg")) throw new Error(`Avatar API HTTP ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    let png = source;
    try { png = await require("sharp")(source).png().toBuffer(); } catch (_) {}
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = `${toolsAvatarResultText(name, avatarUrl)}\n\n<i>Ảnh avatar đã được gửi trực tiếp.</i>`;
    const fields = { caption, parse_mode: "HTML", reply_markup: toolResultKeyboard("tools:avatar", "🔄 Tạo avatar khác") };
    const upload = async (method, field) => {
      const result = await telegramUploadBytes(method, chatId, fields, field, "zhee-avatar.png", png, "image/png");
      if (result?.message_id) {
        botMessages.set(String(chatId), result.message_id);
        try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
      }
      return result;
    };
    try { return await upload("sendPhoto", "photo"); } catch (_) { return upload("sendDocument", "document"); }
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tạo avatar</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:avatar", "🔄 Tạo avatar khác")
    });
  }
}

async function handleUserAgent(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const userAgent = String(input || "").trim();
  if (!userAgent || userAgent.length > 1000) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>User-Agent chưa hợp lệ</b>\n\nHãy gửi chuỗi User-Agent dài tối đa 1000 ký tự.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:ua", "🔄 Dùng lại Check User-Agent")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang phân tích User-Agent...</b>\n\n<i>Đang nhận diện thiết bị, hệ điều hành và trình duyệt.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/tools/ua-parser?ua=${encodeURIComponent(userAgent)}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsUaResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: toolResultKeyboard("tools:ua", "🔄 Dùng lại Check User-Agent")
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể phân tích User-Agent</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:ua", "🔄 Dùng lại Check User-Agent")
    });
  }
}

async function handleCheckIp(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const ip = String(input || "").trim();
  if (!ip || ip.length > 45 || net.isIP(ip) === 0) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Địa chỉ IP chưa hợp lệ</b>\n\nHãy gửi IPv4 hoặc IPv6, ví dụ <code>113.175.232.110</code> hoặc <code>8.8.8.8</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:checkip", "🔄 Dùng lại Check IP")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: `⏳ <b>Đang kiểm tra IP...</b>\n\n🔎 Địa chỉ: <code>${escapeHtml(ip)}</code>`,
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/api/tools/ipcheck?ip=${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(20000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsIpResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: toolResultKeyboard("tools:checkip", "🔄 Dùng lại Check IP")
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể kiểm tra IP</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:checkip", "🔄 Dùng lại Check IP")
    });
  }
}

async function fetchGiaitri(path) {
  const { baseUrl } = config();
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(20000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.trang_thai !== "thanh_cong") {
    throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
  }
  return payload;
}

async function sendGiaitriResult(chatId, incomingMessageId, title, runner, retryCallback, retryLabel) {
  try {
    await sendTracked("sendMessage", chatId, { text: `⏳ <b>Đang ${escapeHtml(title)}...</b>`, parse_mode: "HTML" });
    const payload = await runner();
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: payload.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: entertainmentResultKeyboard(retryCallback, retryLabel)
    });
  } catch (error) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể ${escapeHtml(title)}</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: entertainmentResultKeyboard(retryCallback, retryLabel)
    });
  }
}

async function handleEntertainmentQuiz(chatId, input, incomingMessageId) {
  const raw = String(input || "general").trim();
  const parts = raw.split(/\s+/);
  const category = parts[0] && !/^\d+$/.test(parts[0]) ? parts[0].toLowerCase() : "general";
  const amount = Math.min(5, Math.max(1, Number(parts.find((part) => /^\d+$/.test(part)) || 5)));
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "lấy câu đố vui",
    async () => {
      const payload = await fetchGiaitri(`/api/quiz?category=${encodeURIComponent(category)}&amount=${amount}`);
      return { text: entertainmentQuizResultText(payload) };
    },
    "giaitri:quiz",
    "🔄 Lấy câu khác"
  );
}

async function handleEntertainmentQuote(chatId, incomingMessageId) {
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "lấy danh ngôn",
    async () => ({ text: entertainmentQuoteResultText(await fetchGiaitri("/api/quote/daily")) }),
    "giaitri:quote",
    "🔄 Lấy câu khác"
  );
}

async function handleEntertainmentLunar(chatId, input, incomingMessageId) {
  const date = normalizeVnDate(input);
  if (!date) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Ngày chưa hợp lệ</b>\n\nDùng <code>YYYY-MM-DD</code> hoặc <code>DD/MM/YYYY</code>.",
      parse_mode: "HTML",
      reply_markup: entertainmentDateKeyboard("giaitri:lunar")
    });
  }
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "đổi lịch âm",
    async () => ({ text: entertainmentLunarResultText(await fetchGiaitri(`/api/vn/lunar?date=${encodeURIComponent(date)}`)) }),
    "giaitri:lunar",
    "🔄 Đổi ngày khác"
  );
}

async function handleEntertainmentPlate(chatId, input, incomingMessageId) {
  const code = String(input || "").match(/\d{2}/)?.[0];
  if (!code) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Biển số chưa hợp lệ</b>\n\nGửi 2 số đầu, ví dụ <code>29</code> hoặc <code>51A-123.45</code>.",
      parse_mode: "HTML",
      reply_markup: entertainmentResultKeyboard("giaitri:plate", "🔄 Tra biển khác")
    });
  }
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "tra biển số",
    async () => ({ text: entertainmentPlateResultText(await fetchGiaitri(`/api/vn/plate?code=${encodeURIComponent(code)}`)) }),
    "giaitri:plate",
    "🔄 Tra biển khác"
  );
}

async function handleEntertainmentFuel(chatId, incomingMessageId) {
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "lấy giá xăng",
    async () => ({ text: entertainmentFuelResultText(await fetchGiaitri("/api/vn/fuel")) }),
    "giaitri:fuel",
    "🔄 Tải lại giá"
  );
}

async function handleEntertainmentHolidays(chatId, input, incomingMessageId) {
  const date = normalizeVnDate(input);
  if (!date) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Ngày chưa hợp lệ</b>\n\nDùng <code>YYYY-MM-DD</code> hoặc <code>DD/MM/YYYY</code>.",
      parse_mode: "HTML",
      reply_markup: entertainmentDateKeyboard("giaitri:holidays")
    });
  }
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "tra ngày lễ",
    async () => ({ text: entertainmentHolidaysResultText(await fetchGiaitri(`/api/vn/holidays?date=${encodeURIComponent(date)}`)) }),
    "giaitri:holidays:input",
    "🔄 Tra ngày khác"
  );
}

async function handleEntertainmentThesaurus(chatId, input, incomingMessageId) {
  const word = String(input || "").trim();
  if (!word || word.length > 40) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Từ khóa chưa hợp lệ</b>\n\nVí dụ: <code>đẹp</code>, <code>nhanh</code>, <code>vui</code>.",
      parse_mode: "HTML",
      reply_markup: entertainmentResultKeyboard("giaitri:thesaurus", "🔄 Tra từ khác")
    });
  }
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "tra từ điển",
    async () => ({ text: entertainmentThesaurusResultText(await fetchGiaitri(`/api/vn/thesaurus?word=${encodeURIComponent(word)}`)) }),
    "giaitri:thesaurus",
    "🔄 Tra từ khác"
  );
}

async function handleEntertainmentText(chatId, input, incomingMessageId) {
  const text = String(input || "").trim();
  if (!text || text.length > 300) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Văn bản chưa hợp lệ</b>\n\nGửi tối đa 300 ký tự, ví dụ <code>Học Lập Trình</code>.",
      parse_mode: "HTML",
      reply_markup: entertainmentResultKeyboard("giaitri:text", "🔄 Xử lý câu khác")
    });
  }
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "xử lý văn bản",
    async () => ({ text: entertainmentTextResultText(await fetchGiaitri(`/api/vn/text?text=${encodeURIComponent(text)}&action=slug`)) }),
    "giaitri:text",
    "🔄 Xử lý câu khác"
  );
}

async function handleEntertainmentNumber(chatId, input, incomingMessageId) {
  const number = String(input || "").replace(/[^\d]/g, "");
  if (!number || number.length > 18) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Số chưa hợp lệ</b>\n\nVí dụ: <code>1500000</code>.",
      parse_mode: "HTML",
      reply_markup: entertainmentResultKeyboard("giaitri:number", "🔄 Đổi số khác")
    });
  }
  return sendGiaitriResult(
    chatId,
    incomingMessageId,
    "đổi số thành chữ",
    async () => ({ text: entertainmentNumberResultText(await fetchGiaitri(`/api/vn/number-to-words?number=${encodeURIComponent(number)}`)) }),
    "giaitri:number",
    "🔄 Đổi số khác"
  );
}

async function downloadUrlBuffers(urls, referer = "") {
  const list = [...new Set((urls || []).filter(Boolean))].slice(0, 40);
  const files = await Promise.all(list.map(async (url, index) => {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          Referer: referer || url
        }
      });
      if (!res.ok) return null;
      const data = Buffer.from(await res.arrayBuffer());
      if (!data.length || data.length > 8 * 1024 * 1024) return null;
      const ext = (url.match(/\.(webp|jpg|jpeg|png|gif|avif)(?:[?#]|$)/i) || [])[1] || "jpg";
      return { name: `anh-${String(index + 1).padStart(2, "0")}.${ext.toLowerCase()}`, data };
    } catch (_) {
      return null;
    }
  }));
  return files.filter(Boolean);
}

function zipFileNameFromTitle(title) {
  const safe = String(title || "")
    .replace(/<[^>]+>/g, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${safe || "anh"}.zip`;
}

async function sendZipDocument(chatId, files, caption, keyboard, fileName = "anh.zip") {
  const zip = createZipBuffer(files);
  if (zip.length > 48 * 1024 * 1024) throw new Error("ZIP vượt 50MB.");
  return telegramUploadBytes(
    "sendDocument",
    chatId,
    { caption, parse_mode: "HTML", reply_markup: keyboard },
    "document",
    fileName,
    zip,
    "application/zip"
  );
}

async function handleMediaCobalt(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const url = String(input || "").trim();
  if (!/^https?:\/\//i.test(url) || url.length > 2048) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Link chưa hợp lệ</b>\n\nGửi URL bắt đầu bằng <code>https://</code>.",
      parse_mode: "HTML",
      reply_markup: mediaResultKeyboard("media:cobalt")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang bóc tách media qua Cobalt...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/api/mxh/cobalt?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(45000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Cobalt HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    const caption = mediaCobaltResultText(payload);
    const keyboard = mediaResultKeyboard("media:cobalt");
    const photos = Array.isArray(payload.danh_sach_anh) ? payload.danh_sach_anh.filter(Boolean) : [];
    const video = mediaKind(payload.link_tai) === "video" ? payload.link_tai : "";
    const audio = payload.link_audio || (mediaKind(payload.link_tai) === "audio" ? payload.link_tai : "");
    const ids = [];
    if (photos.length > 1) {
      try {
        const group = await telegram("sendMediaGroup", {
          chat_id: chatId,
          media: photos.slice(0, 10).map((photo, index) => ({
            type: "photo",
            media: photo,
            ...(index === 0 ? { caption, parse_mode: "HTML" } : {})
          }))
        });
        if (Array.isArray(group)) group.forEach((item) => item?.message_id && ids.push(item.message_id));
      } catch (_) {}
    } else if (photos[0] || payload.anh_bia) {
      try {
        const result = await sendTracked("sendPhoto", chatId, {
          photo: photos[0] || payload.anh_bia,
          caption,
          parse_mode: "HTML"
        });
        if (result?.message_id) ids.push(result.message_id);
      } catch (_) {}
    }
    if (video) {
      try {
        const result = await telegram("sendVideo", {
          chat_id: chatId,
          video,
          caption: ids.length ? undefined : caption,
          parse_mode: ids.length ? undefined : "HTML",
          supports_streaming: true
        });
        if (result?.message_id) ids.push(result.message_id);
      } catch (_) {}
    }
    if (audio) {
      try {
        const result = await telegram("sendAudio", {
          chat_id: chatId,
          audio,
          caption: ids.length ? "🎵 Audio" : caption,
          parse_mode: "HTML"
        });
        if (result?.message_id) ids.push(result.message_id);
      } catch (_) {
        try {
          const result = await telegram("sendDocument", { chat_id: chatId, document: audio, caption: "🎵 Audio" });
          if (result?.message_id) ids.push(result.message_id);
        } catch (_) {}
      }
    }
    const result = await telegram("sendMessage", {
      chat_id: chatId,
      text: ids.length ? caption : `⚠️ <b>Không gửi được file media.</b>\n\n${caption}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: keyboard
    });
    if (result?.message_id) ids.push(result.message_id);
    botMessages.set(String(chatId), ids);
    try { await setBotMessageId(chatId, ids); } catch (_) {}
    return result;
  } catch (error) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không tải được media</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: mediaResultKeyboard("media:cobalt")
    });
  }
}

async function handleMediaDownloads(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const url = String(input || "").trim();
  if (!/^https?:\/\//i.test(url) || url.length > 2048) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Link chưa hợp lệ</b>\n\nGửi URL bắt đầu bằng <code>https://</code>.",
      parse_mode: "HTML",
      reply_markup: mediaResultKeyboard("media:downloads")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang bóc tách trang...</b>", parse_mode: "HTML" });
    const response = await fetch(`${baseUrl}/downloads?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(45000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `Downloads HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    const caption = mediaDownloadsResultText(payload);
    const keyboard = mediaResultKeyboard("media:downloads");
    const images = Array.isArray(payload.danh_sach_anh) ? payload.danh_sach_anh.filter(Boolean) : [];
    if (images.length) {
      await sendTracked("sendMessage", chatId, { text: `⏳ <b>Đang nén ${images.length} ảnh thành ZIP...</b>`, parse_mode: "HTML" });
      const files = await downloadUrlBuffers(images, payload.link_nguon || url);
      if (files.length) {
        try {
          await clearPreviousBotMessages(chatId);
          const zipName = zipFileNameFromTitle(payload?.thong_tin_trang?.tieu_de || payload?.tieu_de);
          const result = await sendZipDocument(
            chatId,
            files,
            `<b>🖼️ BÓC TÁCH ẢNH</b>\n\n🏷️ <b>${escapeHtml(String(payload?.thong_tin_trang?.tieu_de || payload?.tieu_de || "Ảnh").slice(0, 180))}</b>\n📦 <code>${files.length}</code> ảnh · file ZIP`,
            keyboard,
            zipName
          );
          if (result?.message_id) {
            botMessages.set(String(chatId), [result.message_id]);
            try { await setBotMessageId(chatId, [result.message_id]); } catch (_) {}
          }
          return result;
        } catch (zipError) {
          await sendTracked("sendMessage", chatId, {
            text: `⚠️ Không gửi được ZIP: <i>${escapeHtml(zipError.message)}</i>\nGửi album thay thế.`,
            parse_mode: "HTML"
          });
        }
      }
    }
    const video = mediaKind(payload.link_tai) === "video"
      ? payload.link_tai
      : payload.chat_luong_video?.hd_720p || payload.link_mp4_truc_tiep?.[0];
    if (video) {
      try { return await sendTracked("sendVideo", chatId, { video, caption, parse_mode: "HTML", supports_streaming: true, reply_markup: keyboard }); } catch (_) {}
    }
    return sendTracked("sendMessage", chatId, { text: caption, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: keyboard });
  } catch (error) {
    if (incomingMessageId) await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không bóc tách được trang</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: mediaResultKeyboard("media:downloads")
    });
  }
}

async function handleNasa(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const keyword = String(input || "").trim();
  if (!keyword || keyword.length > 120) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Từ khóa NASA chưa hợp lệ</b>\n\nHãy gửi từ khóa tối đa 120 ký tự, ví dụ <code>galaxy</code> hoặc <code>james webb</code>.",
      parse_mode: "HTML",
      reply_markup: nasaResultKeyboard()
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: `⏳ <b>Đang tìm dữ liệu NASA...</b>\n\n🔎 Từ khóa: <code>${escapeHtml(keyword)}</code>\n<i>Đang ưu tiên kết quả hình ảnh từ NASA Images.</i>`,
      parse_mode: "HTML"
    });
    const action = /^apod$/i.test(keyword) ? "apod" : "keyword";
    const params = new URLSearchParams({ action });
    if (action === "keyword") params.set("keyword", keyword);
    const response = await fetch(`${baseUrl}/api/tools/nasa?${params.toString()}`, { signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    const data = payload.du_lieu || {};
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    await deleteIncoming(chatId, incomingMessageId);
    const caption = nasaCaption(data, keyword);
    const mediaType = String(data.media_type || "").toLowerCase();
    const mediaUrl = data.url || data.thumbnail_url;
    if (mediaUrl && mediaType === "image") {
      try {
        return await sendTracked("sendPhoto", chatId, { photo: mediaUrl, caption, parse_mode: "HTML", reply_markup: nasaResultKeyboard() });
      } catch (_) {}
    }
    if (mediaUrl && mediaType === "video") {
      try {
        return await sendTracked("sendVideo", chatId, { video: mediaUrl, caption, parse_mode: "HTML", supports_streaming: true, reply_markup: nasaResultKeyboard() });
      } catch (_) {}
    }
    return sendTracked("sendMessage", chatId, {
      text: `${caption}\n\n⚠️ <i>Telegram không thể tải trực tiếp media này. Hãy bấm “Mở nội dung gốc”.</i>`,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      reply_markup: nasaResultKeyboard()
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không tìm được dữ liệu NASA</b>\n\n<i>${escapeHtml(error.message)}</i>\n\n💡 Thử các từ khóa: <code>galaxy</code>, <code>nebula</code>, <code>earth</code>, <code>mars</code>, <code>moon</code>.`,
      parse_mode: "HTML",
      reply_markup: nasaResultKeyboard()
    });
  }
}

async function handleEnhance(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const imageUrl = String(input || "").trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch (_) {
    parsedUrl = null;
  }
  if (!parsedUrl || !/^https?:$/.test(parsedUrl.protocol)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>URL ảnh chưa hợp lệ</b>\n\nHãy gửi URL ảnh công khai bắt đầu bằng <code>https://</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:enhance", "🔄 Dùng lại Làm Nét Ảnh AI")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang làm nét ảnh bằng AI...</b>\n\n<i>Bot đang tăng độ phân giải và kiểm tra ảnh WebP HD.</i>",
      parse_mode: "HTML"
    });
    const response = await fetch(`${baseUrl}/tools/enhance?url=${encodeURIComponent(imageUrl)}`, { signal: AbortSignal.timeout(60000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || payload.chi_tiet || `API HTTP ${response.status}`);
    const hdUrl = payload.link_anh_hd;
    if (!hdUrl) throw new Error("Endpoint không trả về link ảnh HD.");
    pendingActions.delete(String(chatId));
    await clearPendingAction(chatId);
    const result = await sendEnhancePhoto(chatId, hdUrl);
    await deleteIncoming(chatId, incomingMessageId);
    return result;
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể làm nét ảnh</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:enhance", "🔄 Dùng lại Làm Nét Ảnh AI")
    });
  }
}

async function handleCreateKey(chatId, input, incomingMessageId) {
  const { baseUrl } = config();
  const parts = String(input || "").split("|").map((part) => part.trim());
  const uses = parts[0] || "10";
  const hours = parts[1] || "24";
  const note = parts.slice(2).join("|") || "User VIP";
  if (!/^\d+$/.test(uses) || !/^\d+$/.test(hours) || Number(uses) < 1 || Number(uses) > 10000 || Number(hours) < 1 || Number(hours) > 8760 || note.length > 100) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>Thông tin tạo key chưa hợp lệ</b>\n\nDùng mẫu <code>số_lượt|số_giờ|ghi_chú</code>.\nVí dụ: <code>20|48|KhachVIP</code>.\n\nSố lượt: 1–10000, thời hạn: 1–8760 giờ.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:key:create", "🔄 Dùng lại Tạo Key")
    });
  }
  try {
    await sendTracked("sendMessage", chatId, {
      text: "⏳ <b>Đang tạo ZheeTool key...</b>\n\n<i>Đang cấp key theo thông tin bạn nhập.</i>",
      parse_mode: "HTML"
    });
    const params = new URLSearchParams({
      action: "create",
      uses,
      hours,
      note,
      secret: String(process.env.KEY_CREATION_SECRET || "Zhee_secret@2026").trim()
    });
    const response = await fetch(`${baseUrl}/api/tools/key?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsKeyResultText(payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: toolResultKeyboard("tools:key:create", "🔄 Dùng lại Tạo Key")
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tạo ZheeTool key</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:key:create", "🔄 Dùng lại Tạo Key")
    });
  }
}

async function handleKeyAction(chatId, input, incomingMessageId, action) {
  const { baseUrl } = config();
  const key = String(input || "").trim();
  if (!key || !/^ZheeTool-[A-Z0-9-]{10,}$/i.test(key)) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: "⚠️ <b>ZheeTool key chưa hợp lệ</b>\n\nHãy gửi đúng key có dạng <code>ZheeTool-xxxxx-xxxx-xxxxx-xxxx-xxxx-xxx</code>.",
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard(`tools:key:${action}`, `🔄 Dùng lại ${action === "delete" ? "Xóa Key" : action === "encrypt" ? "Check mã hóa" : action === "peek" ? "Check không trừ lượt" : "Check Key"}`)
    });
  }
  try {
    await sendTracked("sendMessage", chatId, { text: `⏳ <b>Đang xử lý thao tác ${escapeHtml(action)}...</b>`, parse_mode: "HTML" });
    const params = new URLSearchParams({ action: action === "encrypt" || action === "peek" ? "check" : action === "delete" ? "delete" : "check", key });
    if (action === "encrypt") params.set("encrypt", "true");
    if (action === "peek") params.set("consume", "false");
    if (action === "delete") {
      params.delete("key");
      params.set("target_key", key);
      params.set("secret", String(process.env.KEY_CREATION_SECRET || "Zhee_secret@2026").trim());
    }
    const response = await fetch(`${baseUrl}/api/tools/key?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai === "that_bai") throw new Error(payload.thong_bao || payload.ly_do || `API HTTP ${response.status}`);
    pendingActions.delete(String(chatId));
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: toolsKeyOperationResultText(action, payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: toolResultKeyboard(`tools:key:${action}`, `🔄 Dùng lại ${action === "delete" ? "Xóa Key" : action === "encrypt" ? "Check mã hóa" : action === "peek" ? "Check không trừ lượt" : "Check Key"}`)
    });
  } catch (error) {
    await deleteIncoming(chatId, incomingMessageId);
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể xử lý Key</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard(`tools:key:${action}`, `🔄 Dùng lại ${action === "delete" ? "Xóa Key" : action === "encrypt" ? "Check mã hóa" : action === "peek" ? "Check không trừ lượt" : "Check Key"}`)
    });
  }
}

async function handleListKeys(chatId) {
  const { baseUrl } = config();
  try {
    await sendTracked("sendMessage", chatId, { text: "⏳ <b>Đang tải danh sách Key...</b>", parse_mode: "HTML" });
    const params = new URLSearchParams({ action: "list", secret: String(process.env.KEY_ADMIN_SECRET || process.env.ADMIN_SECRET || "minhhocgioi").trim() });
    const response = await fetch(`${baseUrl}/api/tools/key?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.trang_thai !== "thanh_cong") throw new Error(payload.thong_bao || `API HTTP ${response.status}`);
    return sendTracked("sendMessage", chatId, {
      text: toolsKeyOperationResultText("list", payload),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: toolResultKeyboard("tools:key:list", "🔄 Tải lại danh sách Key")
    });
  } catch (error) {
    return sendTracked("sendMessage", chatId, {
      text: `⚠️ <b>Không thể tải danh sách Key</b>\n\n<i>${escapeHtml(error.message)}</i>`,
      parse_mode: "HTML",
      reply_markup: toolResultKeyboard("tools:key:list", "🔄 Tải lại danh sách Key")
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
    Boolean(
      callback.message?.document ||
      callback.message?.audio ||
      callback.message?.video ||
      callback.message?.voice ||
      callback.message?.animation
    );
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
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(
      chatId,
      messageId,
      startText(callback.from || callback.message.chat),
      mainKeyboard(chatId),
      isMediaMessage
    );
  }
  if (data === "menu:media") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, mediaText(), mediaKeyboard(), isMediaMessage);
  }
  if (data === "media:cobalt") {
    pendingActions.set(String(chatId), "media:cobalt");
    try { await setPendingAction(chatId, "media:cobalt"); } catch (_) {}
    return replaceMenu(chatId, messageId, mediaCobaltText(), mediaResultKeyboard("media:cobalt"), isMediaMessage);
  }
  if (data === "media:downloads") {
    pendingActions.set(String(chatId), "media:downloads");
    try { await setPendingAction(chatId, "media:downloads"); } catch (_) {}
    return replaceMenu(chatId, messageId, mediaDownloadsText(), mediaResultKeyboard("media:downloads"), isMediaMessage);
  }
  if (data === "menu:giaitri") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, entertainmentText(), entertainmentKeyboard(), isMediaMessage);
  }
  if (data === "giaitri:quiz") {
    pendingActions.set(String(chatId), "giaitri:quiz");
    try { await setPendingAction(chatId, "giaitri:quiz"); } catch (_) {}
    return replaceMenu(chatId, messageId, entertainmentQuizText(), entertainmentQuizKeyboard(), isMediaMessage);
  }
  if (data === "giaitri:quiz:go" || data.startsWith("giaitri:quiz:")) {
    const category = data === "giaitri:quiz:go" ? "general" : data.slice("giaitri:quiz:".length);
    return handleEntertainmentQuiz(chatId, category, null);
  }
  if (data === "giaitri:quote") {
    return handleEntertainmentQuote(chatId, null);
  }
  if (data === "giaitri:lunar") {
    pendingActions.set(String(chatId), "giaitri:lunar");
    try { await setPendingAction(chatId, "giaitri:lunar"); } catch (_) {}
    return replaceMenu(chatId, messageId, entertainmentLunarText(), entertainmentDateKeyboard("giaitri:lunar"), isMediaMessage);
  }
  if (data === "giaitri:lunar:today") {
    return handleEntertainmentLunar(chatId, todayVN(), null);
  }
  if (data === "giaitri:plate") {
    pendingActions.set(String(chatId), "giaitri:plate");
    try { await setPendingAction(chatId, "giaitri:plate"); } catch (_) {}
    return replaceMenu(chatId, messageId, entertainmentPlateText(), entertainmentResultKeyboard("giaitri:plate", "🔄 Tra biển khác"), isMediaMessage);
  }
  if (data === "giaitri:fuel") {
    return handleEntertainmentFuel(chatId, null);
  }
  if (data === "giaitri:holidays") {
    return handleEntertainmentHolidays(chatId, todayVN(), null);
  }
  if (data === "giaitri:holidays:input") {
    pendingActions.set(String(chatId), "giaitri:holidays");
    try { await setPendingAction(chatId, "giaitri:holidays"); } catch (_) {}
    return replaceMenu(chatId, messageId, entertainmentHolidaysText(), entertainmentDateKeyboard("giaitri:holidays"), isMediaMessage);
  }
  if (data === "giaitri:holidays:today") {
    return handleEntertainmentHolidays(chatId, todayVN(), null);
  }
  if (data === "giaitri:thesaurus") {
    pendingActions.set(String(chatId), "giaitri:thesaurus");
    try { await setPendingAction(chatId, "giaitri:thesaurus"); } catch (_) {}
    return replaceMenu(chatId, messageId, entertainmentThesaurusText(), entertainmentResultKeyboard("giaitri:thesaurus", "🔄 Tra từ khác"), isMediaMessage);
  }
  if (data === "giaitri:text") {
    pendingActions.set(String(chatId), "giaitri:text");
    try { await setPendingAction(chatId, "giaitri:text"); } catch (_) {}
    return replaceMenu(chatId, messageId, entertainmentTextToolText(), entertainmentResultKeyboard("giaitri:text", "🔄 Xử lý câu khác"), isMediaMessage);
  }
  if (data === "giaitri:number") {
    pendingActions.set(String(chatId), "giaitri:number");
    try { await setPendingAction(chatId, "giaitri:number"); } catch (_) {}
    return replaceMenu(chatId, messageId, entertainmentNumberText(), entertainmentResultKeyboard("giaitri:number", "🔄 Đổi số khác"), isMediaMessage);
  }
  if (data === "menu:mail") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, mailParentText(), mailParentKeyboard(), isMediaMessage);
  }
  if (data.startsWith("mail:folder:")) {
    const folder = data.slice("mail:folder:".length);
    const allowed = ["chinh", "quangcao", "mangxahoi", "capnhat", "hopthu", "danhdau", "dagui", "nhap", "muasam", "spam", "rac", "toanbo"];
    if (allowed.includes(folder)) {
      const action = `tools:mail:folder:${folder}`;
      pendingActions.set(String(chatId), action);
      try { await setPendingAction(chatId, action); } catch (_) {}
      return replaceMenu(chatId, messageId, toolsMailPageText(1, folder), toolResultKeyboard(action, "🔄 Tải lại mục thư"), isMediaMessage);
    }
  }
  if (data === "mail:folders" || data === "mail:folders:page:1" || data === "mail:folders:page:2") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    const page = data.endsWith(":2") ? 2 : 1;
    return replaceMenu(chatId, messageId, mailFoldersText(page), mailFoldersKeyboard(page), isMediaMessage);
  }
  if (data === "mail:inbox") {
    return handleTempInbox(chatId);
  }
  if (data === "mail:create") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, createTempMailText(), createTempMailKeyboard(), isMediaMessage);
  }
  if (data.startsWith("mail:create:")) {
    const kind = data.slice("mail:create:".length);
    if (["ngan", "dai", "guerrilla", "mix"].includes(kind)) {
      pendingActions.delete(String(chatId));
      try { await clearPendingAction(chatId); } catch (_) {}
      return handleCreateTempMail(chatId, kind);
    }
  }
  if (data === "mail:temp" || data === "tools:mail:temp") {
    pendingActions.set(String(chatId), "tools:mail:temp");
    try { await setPendingAction(chatId, "tools:mail:temp"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsTempMailText(), mailToolKeyboard("mail:temp", "🔄 Check email khác"), isMediaMessage);
  }
  if (data === "mail:check") {
    pendingActions.set(String(chatId), "tools:mail");
    try { await setPendingAction(chatId, "tools:mail"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsMailText(), toolResultKeyboard("mail:check", "🔄 Kiểm tra Mail khác"), isMediaMessage);
  }
  if (data === "menu:social") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, socialText(), socialKeyboard(), isMediaMessage);
  }
  if (data === "social:ngl") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, `<b>💬 NGL</b>\n\n<i>Chọn chức năng NGL cần dùng.</i>`, nglKeyboard(), isMediaMessage);
  }
  if (data === "social:soundcloud") {
    pendingActions.set(String(chatId), "social:soundcloud");
    try { await setPendingAction(chatId, "social:soundcloud"); } catch (_) {}
    return replaceMenu(chatId, messageId, soundcloudText(), socialResultKeyboard("social:soundcloud"), isMediaMessage);
  }
  if (data === "social:spotify") {
    pendingActions.set(String(chatId), "social:spotify");
    try { await setPendingAction(chatId, "social:spotify"); } catch (_) {}
    return replaceMenu(chatId, messageId, spotifyText(), socialResultKeyboard("social:spotify"), isMediaMessage);
  }
  if (data.startsWith("social:tiktok:photo:page:")) {
    const page = Number(data.slice("social:tiktok:photo:page:".length));
    const session = await getTiktokPhotoSession(chatId);
    if (!session?.payload) {
      return replaceMenu(chatId, messageId, tiktokText(), tiktokModeKeyboard(), isMediaMessage);
    }
    return sendTiktokPhotoPage(chatId, session, page);
  }
  if (data === "social:youtube") {
    pendingActions.set(String(chatId), "social:youtube");
    try { await setPendingAction(chatId, "social:youtube"); } catch (_) {}
    return replaceMenu(chatId, messageId, youtubeText(), socialResultKeyboard("social:youtube"), isMediaMessage);
  }
  if (data === "social:discord") {
    pendingActions.set(String(chatId), "social:discord");
    try { await setPendingAction(chatId, "social:discord"); } catch (_) {}
    return replaceMenu(chatId, messageId, discordText(), socialResultKeyboard("social:discord"), isMediaMessage);
  }
  if (data === "social:telegram") {
    pendingActions.set(String(chatId), "social:telegram");
    try { await setPendingAction(chatId, "social:telegram"); } catch (_) {}
    return replaceMenu(chatId, messageId, telegramLookupText(), socialResultKeyboard("social:telegram"), isMediaMessage);
  }
  if (data === "social:twitter") {
    pendingActions.set(String(chatId), "social:twitter");
    try { await setPendingAction(chatId, "social:twitter"); } catch (_) {}
    return replaceMenu(chatId, messageId, twitterText(), socialResultKeyboard("social:twitter"), isMediaMessage);
  }
  if (data === "social:tiktok") {
    try { await clearTiktokPhotoSession(chatId); } catch (_) {}
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, tiktokText(), tiktokModeKeyboard(), isMediaMessage);
  }
  if (data === "social:tiktok:video" || data === "social:tiktok:photo" || data === "social:tiktok:profile") {
    const mode = data.split(":").pop();
    const action = `social:tiktok:${mode}`;
    pendingActions.set(String(chatId), action);
    try { await setPendingAction(chatId, action); } catch (_) {}
    return replaceMenu(chatId, messageId, tiktokModeText(mode), socialResultKeyboard(action), isMediaMessage);
  }
  if (data === "social:github") {
    pendingActions.set(String(chatId), "social:github");
    try { await setPendingAction(chatId, "social:github"); } catch (_) {}
    return replaceMenu(chatId, messageId, githubText(), socialResultKeyboard("social:github"), isMediaMessage);
  }
  if (data === "social:roblox") {
    pendingActions.set(String(chatId), "social:roblox");
    try { await setPendingAction(chatId, "social:roblox"); } catch (_) {}
    return replaceMenu(chatId, messageId, robloxText(), socialResultKeyboard("social:roblox"), isMediaMessage);
  }
  if (data === "social:shopee") {
    pendingActions.set(String(chatId), "social:shopee");
    try { await setPendingAction(chatId, "social:shopee"); } catch (_) {}
    return replaceMenu(chatId, messageId, shopeeText(), socialResultKeyboard("social:shopee"), isMediaMessage);
  }
  if (data === "social:tiki") {
    pendingActions.set(String(chatId), "social:tiki");
    try { await setPendingAction(chatId, "social:tiki"); } catch (_) {}
    return replaceMenu(chatId, messageId, tikiText(), socialResultKeyboard("social:tiki"), isMediaMessage);
  }
  if (data === "social:lazada") {
    pendingActions.set(String(chatId), "social:lazada");
    try { await setPendingAction(chatId, "social:lazada"); } catch (_) {}
    return replaceMenu(chatId, messageId, lazadaText(), socialResultKeyboard("social:lazada"), isMediaMessage);
  }
  if (data === "social:pinterest") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    try { await clearPinterestSearchSession(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, pinterestText(), pinterestKeyboard(), isMediaMessage);
  }
  if (data === "social:pinterest:user") {
    pendingActions.set(String(chatId), "social:pinterest:user");
    try { await setPendingAction(chatId, "social:pinterest:user"); } catch (_) {}
    return replaceMenu(chatId, messageId, pinterestUserText(), socialResultKeyboard("social:pinterest:user"), isMediaMessage);
  }
  if (data === "social:pinterest:search") {
    pendingActions.set(String(chatId), "social:pinterest:search");
    try { await setPendingAction(chatId, "social:pinterest:search"); } catch (_) {}
    return replaceMenu(chatId, messageId, pinterestSearchText(), socialResultKeyboard("social:pinterest:search"), isMediaMessage);
  }
  if (data.startsWith("social:pinterest:search:page:")) {
    const page = Number(data.slice("social:pinterest:search:page:".length));
    const session = await getPinterestSearchSession(chatId);
    if (!session) {
      return replaceMenu(chatId, messageId, pinterestSearchText(), socialResultKeyboard("social:pinterest:search"), isMediaMessage);
    }
    return sendPinterestSearchPage(chatId, session, page);
  }
  if (data === "menu:status") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, statusText(), statusKeyboard(), isMediaMessage);
  }
  if (data === "social:locket") {
    pendingActions.set(String(chatId), "social:locket");
    try { await setPendingAction(chatId, "social:locket"); } catch (_) {}
    return replaceMenu(chatId, messageId, locketCheckText(), socialResultKeyboard("social:locket"), isMediaMessage);
  }
  if (data === "social:ngl:check" || data === "social:ngl:send") {
    const mode = data.endsWith(":send") ? "send" : "check";
    const action = `social:ngl:${mode}`;
    pendingActions.set(String(chatId), action);
    try { await setPendingAction(chatId, action); } catch (_) {}
    return replaceMenu(chatId, messageId, mode === "send" ? nglSendText() : nglCheckText(), socialResultKeyboard(data), isMediaMessage);
  }
  if (data === "menu:tools") {
    pendingActions.delete(String(chatId));
    try { await clearPendingAction(chatId); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsText(), toolsKeyboard(), isMediaMessage);
  }
  if (data.startsWith("tools:page:")) {
    const page = Number(data.slice("tools:page:".length));
    return replaceMenu(chatId, messageId, toolsText(), toolsKeyboard(page), isMediaMessage);
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
  if (data === "tools:removebg") {
    pendingActions.set(String(chatId), "tools:removebg");
    try { await setPendingAction(chatId, "tools:removebg"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsRemoveBgText(), toolResultKeyboard("tools:removebg", "🔄 Dùng lại Xóa nền AI"), isMediaMessage);
  }
  if (data === "tools:enhance") {
    pendingActions.set(String(chatId), "tools:enhance");
    try { await setPendingAction(chatId, "tools:enhance"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsEnhanceText(), toolResultKeyboard("tools:enhance", "🔄 Dùng lại Làm Nét Ảnh AI"), isMediaMessage);
  }
  if (data === "tools:nasa") {
    pendingActions.set(String(chatId), "tools:nasa");
    try { await setPendingAction(chatId, "tools:nasa"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsNasaText(), nasaResultKeyboard(), isMediaMessage);
  }
  if (data === "tools:checkip") {
    pendingActions.set(String(chatId), "tools:checkip");
    try { await setPendingAction(chatId, "tools:checkip"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsIpText(), toolResultKeyboard("tools:checkip", "🔄 Dùng lại Check IP"), isMediaMessage);
  }
  if (data.startsWith("tools:anime:page:")) {
    const parts = data.split(":");
    const pageSize = Number(parts[3]);
    const page = Number(parts[4]);
    if (Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 20 && Number.isInteger(page) && page >= 1) {
      return handleAnime(chatId, `${pageSize} ${page}`, null);
    }
  }
  if (data === "tools:anime") {
    pendingActions.set(String(chatId), "tools:anime");
    try { await setPendingAction(chatId, "tools:anime"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsAnimeText(), toolResultKeyboard("tools:anime", "🔄 Đổi PageSize / Page"), isMediaMessage);
  }
  if (data === "tools:ua") {
    pendingActions.set(String(chatId), "tools:ua");
    try { await setPendingAction(chatId, "tools:ua"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsUaText(), toolResultKeyboard("tools:ua", "🔄 Dùng lại Check User-Agent"), isMediaMessage);
  }
  if (data === "tools:badge") {
    pendingActions.set(String(chatId), "tools:badge");
    try { await setPendingAction(chatId, "tools:badge"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsBadgeText(), toolResultKeyboard("tools:badge", "🔄 Tạo badge khác"), isMediaMessage);
  }
  if (data === "tools:avatar") {
    pendingActions.set(String(chatId), "tools:avatar");
    try { await setPendingAction(chatId, "tools:avatar"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsAvatarText(), toolResultKeyboard("tools:avatar", "🔄 Tạo avatar khác"), isMediaMessage);
  }
  if (data === "tools:qr") {
    pendingActions.set(String(chatId), "tools:qr");
    try { await setPendingAction(chatId, "tools:qr"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsQrText(), toolResultKeyboard("tools:qr", "🔄 Tạo QR khác"), isMediaMessage);
  }
  if (data === "tools:shortener") {
    pendingActions.set(String(chatId), "tools:shortener");
    try { await setPendingAction(chatId, "tools:shortener"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsShortenerText(), toolResultKeyboard("tools:shortener", "🔄 Rút gọn URL khác"), isMediaMessage);
  }
  if (data === "tools:metadata") {
    pendingActions.set(String(chatId), "tools:metadata");
    try { await setPendingAction(chatId, "tools:metadata"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsMetadataText(), toolResultKeyboard("tools:metadata", "🔄 Kiểm tra URL khác"), isMediaMessage);
  }
  if (data.startsWith("tools:mail:folder:") && data.includes(":page:")) {
    const match = /^tools:mail:folder:([^:]+):page:(\d+)$/.exec(data);
    if (match) {
      const folder = match[1];
      const page = Number(match[2]);
      const action = `tools:mail:folder:${folder}:page:${page}`;
      pendingActions.set(String(chatId), action);
      try { await setPendingAction(chatId, action); } catch (_) {}
      return replaceMenu(chatId, messageId, toolsMailPageText(page, folder), toolResultKeyboard(action, `🔄 Tải lại trang ${page}`), isMediaMessage);
    }
  }
  if (data.startsWith("tools:mail:page:")) {
    const page = Number(data.slice("tools:mail:page:".length));
    if (Number.isInteger(page) && page >= 1) {
      const action = `tools:mail:folder:chinh:page:${page}`;
      pendingActions.set(String(chatId), action);
      try { await setPendingAction(chatId, action); } catch (_) {}
      return replaceMenu(chatId, messageId, toolsMailPageText(page, "chinh"), toolResultKeyboard(action, `🔄 Tải lại trang ${page}`), isMediaMessage);
    }
  }
  if (data === "tools:mail:temp") {
    pendingActions.set(String(chatId), "tools:mail:temp");
    try { await setPendingAction(chatId, "tools:mail:temp"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsTempMailText(), mailToolKeyboard("mail:temp", "🔄 Check email khác"), isMediaMessage);
  }
  if (data === "tools:mail") {
    pendingActions.set(String(chatId), "tools:mail");
    try { await setPendingAction(chatId, "tools:mail"); } catch (_) {}
    return replaceMenu(chatId, messageId, toolsMailText(), toolResultKeyboard("tools:mail", "🔄 Kiểm tra Mail khác"), isMediaMessage);
  }
  if (data === "tools:key") {
    pendingActions.delete(String(chatId));
    return replaceMenu(chatId, messageId, toolsKeyMenuText(), keyManagerKeyboard(), isMediaMessage);
  }
  if (data === "tools:key:create") {
    pendingActions.set(String(chatId), "tools:key:create");
    return replaceMenu(chatId, messageId, toolsKeyCreateText(), toolResultKeyboard("tools:key:create", "🔄 Dùng lại Tạo Key"), isMediaMessage);
  }
  if (data === "tools:key:check" || data === "tools:key:encrypt" || data === "tools:key:peek" || data === "tools:key:delete") {
    const action = data.split(":").pop();
    pendingActions.set(String(chatId), data);
    const labels = { check: "🔄 Dùng lại Check Key", encrypt: "🔄 Dùng lại Check mã hóa", peek: "🔄 Dùng lại Check không trừ lượt", delete: "🔄 Dùng lại Xóa Key" };
    return replaceMenu(chatId, messageId, toolsKeyActionText(action), toolResultKeyboard(data, labels[action]), isMediaMessage);
  }
  if (data === "tools:key:list") {
    pendingActions.delete(String(chatId));
    return handleListKeys(chatId);
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
      if (chatId && text && !pendingActions.get(String(chatId))) {
        try {
          const persisted = await getPendingAction(chatId);
          if (persisted?.action) pendingActions.set(String(chatId), persisted.action);
        } catch (_) {}
      }
      if (chatId && /^\/status(?:@[^\s]+)?$/i.test(text)) {
        pendingActions.delete(String(chatId));
        try { await clearPendingAction(chatId); } catch (_) {}
        await deleteIncoming(chatId, message.message_id);
        await sendTracked("sendMessage", chatId, {
          text: statusText(),
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: statusKeyboard()
        });
      } else if (chatId && /^\/start(?:@[^\s]+)?$/i.test(text)) {
        pendingActions.delete(String(chatId));
        try { await clearPendingAction(chatId); } catch (_) {}
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
      } else if (chatId && text && pendingActions.get(String(chatId)) === "media:cobalt") {
        await handleMediaCobalt(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "media:downloads") {
        await handleMediaDownloads(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "giaitri:quiz") {
        await handleEntertainmentQuiz(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "giaitri:lunar") {
        await handleEntertainmentLunar(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "giaitri:plate") {
        await handleEntertainmentPlate(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "giaitri:holidays") {
        await handleEntertainmentHolidays(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "giaitri:thesaurus") {
        await handleEntertainmentThesaurus(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "giaitri:text") {
        await handleEntertainmentText(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "giaitri:number") {
        await handleEntertainmentNumber(chatId, text, message.message_id);
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
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:removebg") {
        await handleRemoveBg(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:enhance") {
        await handleEnhance(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:nasa") {
        await handleNasa(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:checkip") {
        await handleCheckIp(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:anime") {
        await handleAnime(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:ua") {
        await handleUserAgent(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:badge") {
        await handleBadge(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:avatar") {
        await handleAvatar(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:qr") {
        await handleQr(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:shortener") {
        await handleShortener(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:metadata") {
        await handleMetadata(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:soundcloud") {
        await handleSoundcloud(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:spotify") {
        await handleSpotify(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:youtube") {
        await handleYoutubeThumbnail(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:discord") {
        await handleDiscord(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:telegram") {
        await handleTelegramLookup(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:twitter") {
        await handleTwitter(chatId, text, message.message_id);
      } else if (chatId && text && /^social:tiktok:(?:video|photo|profile)$/.test(String(pendingActions.get(String(chatId)) || ""))) {
        const mode = String(pendingActions.get(String(chatId))).split(":").pop();
        await handleTiktok(chatId, text, mode, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:github") {
        await handleGithub(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:roblox") {
        await handleRoblox(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:shopee") {
        await handleShopee(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:tiki") {
        await handleTiki(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:lazada") {
        await handleLazada(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:pinterest:user") {
        await handlePinterest(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:pinterest:search") {
        await handlePinterestSearch(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:pinterest") {
        await handlePinterest(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:locket") {
        await handleLocket(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:ngl:check") {
        await handleNgl(chatId, text, "check", message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "social:ngl:send") {
        await handleNgl(chatId, text, "send", message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:mail:temp") {
        await handleTempMail(chatId, text, message.message_id);
      } else if (chatId && text && (pendingActions.get(String(chatId)) === "tools:mail" || /^tools:mail:(?:page:\d+|folder:[^:]+(?::page:\d+)?)$/.test(String(pendingActions.get(String(chatId)) || "")))) {
        await handleMail(chatId, text, message.message_id);
      } else if (chatId && text && !pendingActions.get(String(chatId)) && isLikelyImageUrl(text)) {
        // Vercel invocations are stateless. If the button session is lost,
        // recognize a direct image URL and run the background remover anyway.
        await handleRemoveBg(chatId, text, message.message_id);
      } else if (chatId && text && pendingActions.get(String(chatId)) === "tools:key:create") {
        await handleCreateKey(chatId, text, message.message_id);
      } else if (chatId && text && /^tools:key:(?:check|encrypt|peek|delete)$/.test(String(pendingActions.get(String(chatId)) || ""))) {
        await handleKeyAction(chatId, text, message.message_id, String(pendingActions.get(String(chatId))).split(":").pop());
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
    if (!isHarmlessTelegramError(error)) await notifyAdminError(error, { action: "telegram:webhook" });
    return res.status(200).json({ trang_thai: "that_bai", thong_bao: error.message, tac_gia: AUTHOR });
  }
};

module.exports.config = config;
module.exports.isAdmin = isAdmin;
