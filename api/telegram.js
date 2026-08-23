module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.user || req.query.username || req.query.token || req.query.bot || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Bot Token, Username bot/người dùng (@name) hoặc link nhóm/kênh Telegram.",
      cu_phap: {
        check_bot_token: "https://{domain}/api/mxh/telegram?={bot_token}",
        check_username: "https://{domain}/api/mxh/telegram?={username_hoac_link}"
      }
    });
  }

  const cleanQuery = query.trim();
  const isBotToken = /^\d{8,12}:[a-zA-Z0-9_-]{35}$/.test(cleanQuery);

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  try {
    // -------------------------------------------------------------
    // TRƯỜNG HỢP 1: KIỂM TRA BOT QUA BOT TOKEN (OFFICIAL TELEGRAM API)
    // -------------------------------------------------------------
    if (isBotToken) {
      const [getMeRes, webhookRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${cleanQuery}/getMe`),
        fetch(`https://api.telegram.org/bot${cleanQuery}/getWebhookInfo`)
      ]);

      const meData = await getMeRes.json();
      const webhookData = webhookRes.ok ? await webhookRes.json() : null;

      if (!meData.ok) {
        return res.status(401).json({
          trang_thai: "that_bai",
          loai: "Telegram_Bot",
          thong_bao: "Bot Token không hợp lệ hoặc đã bị thu hồi/vô hiệu hóa.",
          ma_loi: meData.error_code || 401,
          chi_tiet: meData.description || "Unauthorized"
        });
      }

      const bot = meData.result;
      const webhook = webhookData?.result || {};

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "Telegram_Bot",
        thong_tin_bot: {
          id_bot: bot.id,
          ten_bot: bot.first_name,
          username: `@${bot.username}`,
          la_bot: true,
          link_khoi_chay: `https://t.me/${bot.username}?start=help`,
          link_app: `tg://resolve?domain=${bot.username}`,
          quyen_han_va_tinh_nang: {
            tham_gia_nhom: bot.can_join_groups ?? true,
            doc_toan_bo_tin_nhan_nhom: bot.can_read_all_group_messages ?? false,
            ho_tro_inline_queries: bot.supports_inline_queries ?? false,
            ket_noi_kinh_doanh: bot.can_connect_to_business ?? false
          },
          trang_thai_webhook: {
            dang_dung_webhook: Boolean(webhook.url),
            webhook_url: webhook.url || "Đang dùng chế độ Long Polling (Không cài Webhook)",
            so_tin_nhan_chua_xu_ly: webhook.pending_update_count || 0,
            loi_webhook_gan_nhat: webhook.last_error_message || "Không có lỗi"
          }
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: TRA CỨU QUA USERNAME / LINK T.ME
    // -------------------------------------------------------------
    const cleanUser = cleanQuery
      .replace(/^https?:\/\/t\.me\//, "")
      .replace(/^t\.me\//, "")
      .replace(/^@+/, "")
      .split("/")[0]
      .split("?")[0];

    const targetUrl = `https://t.me/${cleanUser}`;
    const response = await fetch(targetUrl, { headers: browserHeaders });
    const html = await response.text();

    if (html.includes("tgme_page_context_btn") && !html.includes("tgme_page_title")) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy tài khoản, bot hoặc nhóm Telegram: @${cleanUser}`
      });
    }

    // Bóc tách tên hiển thị
    const titleMatch = html.match(/<div class="tgme_page_title"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/) ||
                       html.match(/<div class="tgme_page_title"[^>]*>([\s\S]*?)<\/div>/);
    const tenHienThi = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : cleanUser;

    // Bóc tách ảnh đại diện
    const avatarMatch = html.match(/<img class="tgme_page_photo_image" src="([^"]+)"/);
    const anhDaiDien = avatarMatch ? avatarMatch[1] : null;

    // Bóc tách thông số phụ (members, subscribers, status)
    const extraMatch = html.match(/<div class="tgme_page_extra"[^>]*>([\s\S]*?)<\/div>/);
    const extraText = extraMatch ? extraMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    // Bóc tách tiểu sử
    const descMatch = html.match(/<div class="tgme_page_description"[^>]*>([\s\S]*?)<\/div>/);
    const tieuSu = descMatch ? descMatch[1].replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "").trim() : "Không có mô tả";

    // Phân loại chính xác thực thể
    const isBot = cleanUser.toLowerCase().endsWith("bot") || extraText.toLowerCase().includes("bot");
    let loaiDoiTuong = "Nguoi_Dung (User)";
    let soThanhVien = null;
    let soOnline = null;

    if (isBot) {
      loaiDoiTuong = "Telegram_Bot";
    } else if (extraText.toLowerCase().includes("subscribers") || extraText.toLowerCase().includes("người đăng ký")) {
      loaiDoiTuong = "Kenh (Channel)";
      soThanhVien = extraText;
    } else if (extraText.toLowerCase().includes("members") || extraText.toLowerCase().includes("thành viên")) {
      loaiDoiTuong = "Nhom (Group)";
      const parts = extraText.split(",");
      soThanhVien = parts[0]?.trim() || extraText;
      if (parts[1]) soOnline = parts[1].trim();
    }

    const payload = {
      trang_thai: "thanh_cong",
      loai: loaiDoiTuong,
      thong_tin: {
        username: `@${cleanUser}`,
        ten_hien_thi: tenHienThi,
        anh_dai_dien: anhDaiDien,
        mo_ta_tieu_su: tieuSu,
        link_truy_cap: targetUrl,
        link_app: `tg://resolve?domain=${cleanUser}`
      }
    };

    if (isBot) {
      payload.thong_tin.link_khoi_chay_bot = `https://t.me/${cleanUser}?start=help`;
    }
    if (soThanhVien) {
      payload.thong_tin.tong_thanh_vien = soThanhVien;
    }
    if (soOnline) {
      payload.thong_tin.thanh_vien_online = soOnline;
    }

    return res.status(200).json(payload);

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};