module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
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
        website_chinh: baseUrl,
        facebook: "https://facebook.com/hoducminh.depzai",
        zalo: "0944921186",
        telegram: "https://t.me/zheevipv1"
      }
    },
    he_thong: {
      ten_dich_vu: "Zhee API Service Engine",
      phien_ban: "6.5.0",
      kien_truc: "Vercel Serverless Functions (Single Server Core Routing)",
      trang_thai_may_chu: "Online (Operational)",
      mo_ta: "Nền tảng REST API đa năng phục vụ phát triển ứng dụng, tích hợp thanh toán, quản trị mạng, tự động hóa email và truyền thông số."
    },
    danh_sach_chuyen_muc: {
      mang_xa_hoi: {
        ten: "API Mạng Xã Hội & Game (/mxh)",
        mo_ta: "Tổng hợp 9 tool tra cứu & phân tích: Roblox, GitHub, TikTok, YouTube, Discord, Telegram, Twitter (X), Facebook, Zalo",
        link_huong_dan: `${baseUrl}/mxh`
      },
      ngan_hang: {
        ten: "API Ngân Hàng & VietQR (/bank)",
        mo_ta: "Tra cứu danh tính chủ tài khoản ngân hàng chuẩn Napas (/bank/check) và tạo mã QR thanh toán nhanh kèm số tiền (/bank/taoqr)",
        link_huong_dan: `${baseUrl}/bank`
      },
      email_service: {
        ten: "Dịch Vụ Email & Thông Báo (/mail)",
        mo_ta: "Hệ thống gửi thư tự động qua SMTP với 6 template chuẩn (OTP 5 phút, Reset pass, Hóa đơn, Cảnh báo) bằng giao diện SVG Outline",
        link_huong_dan: `${baseUrl}/mail`
      },
      web_tools: {
        ten: "Tiện Ích Quản Trị Mạng & Website (/web)",
        mo_ta: "Chấm điểm Dashboard Website Audit, kiểm tra SSL/TLS, Security Headers, On-Page SEO, DNS Records, IP Geolocation và Beautify mã nguồn",
        link_huong_dan: `${baseUrl}/web`
      },
      downloads: {
        ten: "Bóc Tách & Tải Đa Phương Tiện (/downloads)",
        mo_ta: "Trích xuất link video phát trực tiếp (HD, SD, HLS M3U8, MP4) và bóc tách toàn bộ ảnh truyện tranh, bài viết đã lọc sạch rác/quảng cáo",
        link_huong_dan: `${baseUrl}/downloads`
      }
    }
  });
};