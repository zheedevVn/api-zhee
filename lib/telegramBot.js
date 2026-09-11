const AUTHOR = "Hồ Đức Minh (Zhee Dev)";

// Keep the existing deployment configuration untouched while rebuilding the bot
// feature-by-feature from a clean starting point.
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

async function telegram(method, body) {
  const { token } = config();
  if (!token) throw new Error("Thiếu TELEGRAM_BOT_TOKEN.");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || `Telegram HTTP ${response.status}.`);
  }
  return payload.result;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[char]));
}

async function sendStart(chatId, user) {
  const { baseUrl } = config();
  const displayName = escapeHtml(user?.first_name || user?.username || "bạn");
  const adminBlock = isAdmin(chatId)
    ? "\n\n🔐 <b>ADMIN</b> · Quyền quản trị đã được giữ nguyên."
    : "";
  return telegram("sendMessage", {
    chat_id: chatId,
    text: `<b>✦ ZHEE API</b>\n<i>Trung tâm API và tiện ích dành cho nhà phát triển</i>\n\n👋 Xin chào, <b>${displayName}</b>!\n\n<b>Bot đang được khởi tạo lại</b>\nMình đang xây dựng lại từng chức năng từ đầu để menu gọn hơn, dễ dùng hơn và ổn định hơn.${adminBlock}\n\n🧩 <b>Trạng thái hiện tại</b>\n• Giao diện menu mới đang sẵn sàng\n• Các chức năng sẽ được mở lại từng phần\n• Không dùng ký tự phân cách rối mắt\n\nChọn một mục bên dưới để bắt đầu:`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌐 Mở Zhee API", url: baseUrl }],
        [
          { text: "📚 Danh sách API", url: `${baseUrl}/list` },
          { text: "💬 Hỗ trợ", url: "https://t.me/zheevipv1" }
        ]
      ]
    }
  });
}

module.exports = async function telegramBotHandler(req, res) {
  const { token } = config();
  if (!token) {
    return res.status(503).json({
      trang_thai: "that_bai",
      thong_bao: "Thiếu TELEGRAM_BOT_TOKEN.",
      tac_gia: AUTHOR
    });
  }

  if (req.method && req.method !== "POST") {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      thong_bao: "Telegram Bot scaffold đang hoạt động.",
      tac_gia: AUTHOR
    });
  }

  try {
    const update = typeof req.body === "string"
      ? JSON.parse(req.body || "{}")
      : (req.body || {});
    const message = update.message || update.edited_message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || "").trim();

    if (chatId && /^\/start(?:@[^\s]+)?$/i.test(text)) {
      await sendStart(chatId, message.from || message.chat);
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      da_nhan: true,
      tac_gia: AUTHOR
    });
  } catch (error) {
    return res.status(200).json({
      trang_thai: "that_bai",
      thong_bao: error.message,
      tac_gia: AUTHOR
    });
  }
};

module.exports.config = config;
module.exports.isAdmin = isAdmin;
