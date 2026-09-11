const AUTHOR = "Hồ Đức Minh (Zhee Dev)";

// Keep the existing deployment configuration untouched while rebuilding the bot
// feature-by-feature from a clean starting point.
function config() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
    admins: String(process.env.TELEGRAM_ADMIN_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
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

async function sendStart(chatId) {
  const adminText = isAdmin(chatId)
    ? "\n\n🔐 Quyền Admin vẫn được giữ nguyên."
    : "";
  return telegram("sendMessage", {
    chat_id: chatId,
    text: `Zhee API Bot đang được xây dựng lại từ đầu.${adminText}\n\nCác chức năng sẽ được thêm lại từng phần sau.`,
    disable_web_page_preview: true
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
      await sendStart(chatId);
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
