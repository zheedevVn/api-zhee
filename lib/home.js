function tinhHoatDong() {
  const batDau = new Date("2026-08-28T00:00:00+07:00");
  const now = new Date();
  let ms = now.getTime() - batDau.getTime();
  if (ms < 0) ms = 0;
  const tongGio = Math.floor(ms / 3600000);
  const ngay = Math.floor(tongGio / 24);
  const gio = tongGio % 24;
  const phut = Math.floor((ms % 3600000) / 60000);
  const chuoi = `${ngay} ngày ${gio} giờ ${phut} phút`;
  return {
    moc_khai_truong: "28/8/2026",
    da_hoat_dong: chuoi,
    so_ngay: ngay,
    so_gio: gio,
    so_phut: phut,
    ghi_chu: "Tính từ 28/8/2026 (giờ VN). Không phải uptime máy chủ 24/7 — serverless bật khi có request."
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  return res.status(200).json({
    trang_thai: "thanh_cong",
    thoi_gian_hoat_dong: tinhHoatDong(),
    tac_gia: {
      ho_va_ten: "Hồ Đức Minh",
      biet_danh: "Zhee Dev",
      vai_tro: "Full-Stack Developer & Bot/API Automation Specialist",
      tieu_su: "Nhà phát triển chuyên xây dựng các kiến trúc Serverless, hệ thống tự động hóa mạng xã hội, tích hợp cổng thanh toán, AI tools và bóc tách dữ liệu hiệu năng cao.",
      ky_nang_chinh: [
        "Node.js / Express / Fastify",
        "Vercel Serverless Architecture",
        "Web Scraping & Reverse Engineering",
        "Payment & Banking Gateway (VietQR / Napas)",
        "Social Media Graph APIs & Telecom Lookups"
      ],
      lien_he_va_mang_xa_hoi: {
        github: "https://github.com/hoducminh123",
        website_chinh: `${baseUrl}`,
        facebook: "https://facebook.com/hoducminh.depzai",
        zalo: "0899256226",
        telegram: "https://t.me/zheedev"
      }
    },
    he_thong: {
      ten_dich_vu: "Zhee API Service Engine",
      phien_ban: "8.0.0",
      kien_truc: "Vercel Serverless Functions (Single Server Core Registry Routing)",
      trang_thai_may_chu: "Online (Operational)",
      danh_muc_tong_hop: `${baseUrl}/list`,
      mo_ta: "Nền tảng REST API đa năng phục vụ phát triển ứng dụng, AI tools, kiểm tra viễn thông/thiết bị, tiện ích game, xác suất MD5, thanh toán VietQR và video streaming.",
      da_hoat_dong: tinhHoatDong().da_hoat_dong
    },
    danh_sach_chuyen_muc: {
      mang_xa_hoi_va_am_nhac: {
        ten: "API Mạng Xã Hội, Âm Nhạc & Game (/mxh)",
        tong_so_tool: 13,
        cac_nen_tang: [
          "Spotify (Tra cứu bài hát, lyrics, profile nghệ sĩ & top 10 bài hát)",
          "SoundCloud (Tra cứu bài hát, profile user & stream MP3)",
          "Instagram (Avatar HD, followers, bio, tích xanh)",
          "Roblox (User profile, avatar 3D toàn thân)",
          "TikTok (Profile & tải video no watermark)",
          "YouTube (Thông tin kênh & trích xuất stream MP4/MP3)",
          "Shopee (Tra cứu gian hàng: username, shopid, rating, Mall)",
          "Facebook, Twitter (X), Discord, Telegram, GitHub, Zalo"
        ],
        link_huong_dan: `${baseUrl}/api/mxh`
      },
      cong_cu_ai_va_tien_ich: {
        ten: "Công Cụ AI, Quản Trị Key & Tiện Ích Thiết Bị (/tools)",
        tong_so_tool: 9,
        cac_tinh_nang: [
          "Check Locket (Username, tài khoản Gold/UID, bạn bè/moment mã hóa AES-256, gửi/hủy 1 lời mời)",
          "NGL.link (Check username và gửi đúng 1 tin nhắn ẩn danh, không spam)",
          "Check SĐT (Twilio Lookup V2 - Tra cứu nhà mạng, SIM swap, chuyển tiếp cuộc gọi)",
          "Check IMEI (Tra cứu thiết bị Apple iOS, Part Number, bảo mật 100% không lưu log)",
          "AI Chat Assistant (Google Gemini & ChatGPT-4o Mini)",
          "Check API Key AI (còn hạn, module/model dùng được, quota/token còn lại)",
          "ZheeTool Key Manager (Tạo, check lượt, set hạn dùng & mã hóa key HMAC-SHA256)",
          "Free Fire Player Info (Tra cứu Nickname, Region qua UID)",
          "AI Remove.bg Pro (Xóa phông nền ảnh tự động)",
          "AI Image Enhancer (Làm nét & tăng độ phân giải ảnh chuẩn 2K/4K)"
        ],
        link_huong_dan: `${baseUrl}/api/tools`
      },
      xac_suat_va_game_md5: {
        ten: "Phân Tích Xác Suất MD5 & Cổng SUKA88 (/taixiu)",
        tong_so_tool: 8,
        mo_ta: "MD5 các cổng tài xỉu; cổng SUKA88 tự tạo gồm Tài Xỉu, Bài Tây, Bầu Cua, Baccarat",
        link_huong_dan: `${baseUrl}/api/taixiu`
      },
      ngan_hang_va_thanh_toan: {
        ten: "Cổng Thanh Toán & Ngân Hàng (/bank)",
        mo_ta: "Tạo mã VietQR động/tĩnh tự động theo chuẩn Napas 247, tra cứu mã định danh BIN ngân hàng",
        link_huong_dan: `${baseUrl}/api/bank`
      },
      tai_va_boc_tach_media: {
        ten: "Tải & Bóc Tách Đa Phương Tiện (/downloads)",
        mo_ta: "Bóc tách trọn bộ ảnh truyện tranh, bài viết và trích xuất luồng phát video trực tiếp (MP4, HLS M3U8)",
        link_huong_dan: `${baseUrl}/api/downloads`
      },
      dich_vu_mail: {
        ten: "Dịch Vụ Mail: gửi OTP & check hộp thư (/mail)",
        mo_ta: "Tạo mail tạm /mail/taomail; đọc hộp thư IMAP /mail/check; gửi OTP /mail/gmail",
        link_huong_dan: `${baseUrl}/mail`
      },
      quan_tri_web: {
        ten: "Quản Trị Mạng & DNS Website (/web)",
        mo_ta: "Công cụ kiểm tra DNS, Ping IP, Whois domain và SSL cert",
        link_huong_dan: `${baseUrl}/api/web`
      },
      video_streaming: {
        ten: "Hệ Thống Video Streaming VIP (/video)",
        mo_ta: "Kho lưu trữ và phát luồng video bảo mật bằng Key ZheeTool",
        cu_phap_mo_khoa: `${baseUrl}/api/video?key={api_key}`
      }
    }
  });
};