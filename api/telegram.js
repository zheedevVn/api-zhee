module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let rawQuery = req.url.includes("?") ? req.url.split("?")[1] : "";
  let query = req.query.user || req.query.username || req.query.bot || req.query.group || req.query[""] || null;

  if (!query && rawQuery) {
    query = decodeURIComponent(rawQuery.replace(/^=/, "").split("&")[0]).trim();
  }

  if (!query) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập username, link t.me hoặc tên bot/nhóm/kênh Telegram.",
      cu_phap: "https://{domain}/api/mxh/telegram?={username_hoac_link}"
    });
  }

  // Chuẩn hóa username (xóa bỏ @, link t.me/, https://...)
  let cleanUser = query.trim()
    .replace(/^https?:\/\/t\.me\//, "")
    .replace(/^t\.me\//, "")
    .replace(/^@+/, "")
    .split("/")[0]
    .split("?")[0];

  const targetUrl = `https://t.me/${cleanUser}`;
  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
  };

  try {
    const response = await fetch(targetUrl, { headers: browserHeaders });
    const html = await response.text();

    // Kiểm tra tài khoản/nhóm có tồn tại trên Telegram không
    if (html.includes("tgme_page_icon_watermark") || html.includes("If you have <strong>Telegram</strong>, you can contact")) {
      // Tiếp tục phân tích
    } else if (html.includes("tgme_page_context_btn") && !html.includes("tgme_page_title")) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy đối tượng Telegram nào với username: @${cleanUser}`
      });
    }

    // 1. Tên hiển thị
    const titleMatch = html.match(/<div class="tgme_page_title"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/) ||
                       html.match(/<div class="tgme_page_title"[^>]*>([\s\S]*?)<\/div>/);
    const tenHienThi = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : cleanUser;

    // 2. Ảnh đại diện
    const avatarMatch = html.match(/<img class="tgme_page_photo_image" src="([^"]+)"/);
    const anhDaiDien = avatarMatch ? avatarMatch[1] : null;

    // 3. Số lượng thành viên / Người đăng ký (nếu là Group / Channel)
    const extraMatch = html.match(/<div class="tgme_page_extra"[^>]*>([\s\S]*?)<\/div>/);
    const extraText = extraMatch ? extraMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    // 4. Tiểu sử / Mô tả
    const descMatch = html.match(/<div class="tgme_page_description"[^>]*>([\s\S]*?)<\/div>/);
    const tieuSu = descMatch ? descMatch[1].replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "").trim() : "Không có mô tả";

    // 5. Nút hành động và phân loại đối tượng (User / Bot / Group / Channel)
    const actionBtnMatch = html.match(/<a class="tgme_action_button_new[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    const actionText = actionBtnMatch ? actionBtnMatch[1].trim() : "";

    let loaiDoiTuong = "Nguoi_Dung (User)";
    let soThanhVien = null;
    let soOnline = null;

    if (cleanUser.toLowerCase().endsWith("bot") || actionText.includes("Send Message") && extraText.includes("bot")) {
      loaiDoiTuong = "Bot";
    } else if (extraText.toLowerCase().includes("subscribers") || extraText.toLowerCase().includes("người đăng ký")) {
      loaiDoiTuong = "Kenh (Channel)";
      soThanhVien = extraText;
    } else if (extraText.toLowerCase().includes("members") || extraText.toLowerCase().includes("thành viên")) {
      loaiDoiTuong = "Nhom (Group)";
      const parts = extraText.split(",");
      soThanhVien = parts[0]?.trim() || extraText;
      if (parts[1]) soOnline = parts[1].trim();
    } else if (extraText) {
      soThanhVien = extraText;
    }

    const result = {
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

    if (soThanhVien) {
      result.thong_tin.thong_ke_thanh_vien = soThanhVien;
    }
    if (soOnline) {
      result.thong_tin.so_thanh_vien_online = soOnline;
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};