module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  return res.status(200).json({
    trang_thai: "thanh_cong",
    tac_gia: {
      ho_va_ten: "Hồ Đức Minh",
      biet_danh: "Zhee Dev",
      vai_tro: "Full-Stack Developer & Bot/API Automation Specialist",
      tieu_su: "Nhà phát triển chuyên xây dựng các kiến trúc Serverless, hệ thống tự động hóa mạng xã hội, tích hợp cổng thanh toán và bóc tách dữ liệu hiệu năng cao.",
      ky_nang_chinh: [
        "Node.js / Express / Fastify",
        "Vercel Serverless Architecture",
        "Web Scraping & Reverse Engineering",
        "Payment & Banking Gateway (VietQR / Napas)",
        "Social Media Graph APIs & Bot Automation"
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
      phien_ban: "7.1.0",
      kien_truc: "Vercel Serverless Functions (Single Server Core Routing)",
      trang_thai_may_chu: "Online (Operational)",
      mo_ta: "Nền tảng REST API đa năng phục vụ phát triển ứng dụng, AI tools, game utilities, thanh toán, quản trị mạng và video streaming."
    },
    danh_sach_chuyen_muc: {
      mang_xa_hoi: {
        ten: "API Mạng Xã Hội & Game (/mxh)",
        mo_ta: "Tổng hợp 9 tool tra cứu & phân tích: Roblox, GitHub, TikTok, YouTube, Discord, Telegram, Twitter, Facebook, Zalo",
        link_huong_dan: `${baseUrl}/mxh`
      },
      cong_cu_tien_ich: {
        ten: "Công Cụ AI & Game Utilities (/tools)",
        mo_ta: "Tra cứu UID Free Fire, AI Xóa phông nền ảnh (Remove.bg), AI Làm nét & Phục chế ảnh HD",
        link_huong_dan: `${baseUrl}/tools`
      },
      tai_va_boc_tach: {
        ten: "Tải & Bóc Tách Đa Phương Tiện (/downloads)",
        mo_ta: "Bóc tách trọn bộ ảnh truyện tranh, bài viết và trích xuất luồng phát video trực tiếp (MP4, HLS M3U8)",
        link_huong_dan: `${baseUrl}/downloads`
      },
      video_streaming: {
        ten: "Hệ Thống Video Streaming Độc Quyền (/video)",
        mo_ta: "Kho lưu trữ và phát luồng video riêng tư không trùng lặp (Yêu cầu API Key để truy cập)",
        cu_phap_mo_khoa: `${baseUrl}/video?key={api_key}`
      },
      quan_tri_web: {
        ten: "Quản Trị Mạng & DNS Website (/web)",
        mo_ta: "Công cụ kiểm tra DNS, Ping, Whois và phân tích trạng thái máy chủ website",
        link_huong_dan: `${baseUrl}/web`
      },
      dich_vu_mail: {
        ten: "Dịch Vụ Email Tạm Thời & Xác Thực (/mail)",
        mo_ta: "Hệ thống tạo email ảo nhận mã OTP và kiểm tra định dạng email",
        link_huong_dan: `${baseUrl}/mail`
      },
      ngan_hang: {
        ten: "Cổng Thanh Toán & Ngân Hàng (/bank)",
        mo_ta: "Tạo mã VietQR tự động, tra cứu danh sách ngân hàng Napas và định tuyến thanh toán",
        link_huong_dan: `${baseUrl}/bank`
      }
    }
  });
};