module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    trang_thai: "thanh_cong",
    tac_gia: {
      ten: "Hồ Đức Minh (Zhee Dev)",
      github: "https://github.com/zheedevVn",
      website: baseUrl
    },
    he_thong: {
      ten_dich_vu: "Zhee API Service Engine",
      phien_ban: "6.0.0",
      nen_tang: "Vercel Serverless Functions",
      mo_ta: "Hệ thống REST API đa nền tảng phân chia theo từng nhóm chuyên mục."
    },
    danh_sach_chuyen_muc: {
      mang_xa_hoi: {
        ten: "API Mạng Xã Hội & Game (/mxh)",
        mo_ta: "Tổng hợp 9 tool: Roblox, GitHub, TikTok, YouTube, Discord, Telegram, Twitter, Facebook, Zalo",
        link_huong_dan: `${baseUrl}/mxh`
      },
      ngan_hang: {
        ten: "API Ngân Hàng & VietQR (/bank)",
        mo_ta: "Tra cứu chủ tài khoản ngân hàng chuẩn Napas và tạo mã QR thanh toán nhanh",
        link_huong_dan: `${baseUrl}/bank`
      },
      email_service: {
        ten: "Dịch Vụ Email & Thông Báo (/mail)",
        mo_ta: "Gửi OTP 5 phút, Reset pass, Hóa đơn, Cảnh báo bảo mật qua SMTP với giao diện SVG Outline",
        link_huong_dan: `${baseUrl}/mail`
      },
      web_tools: {
        ten: "Tiện Ích Quản Trị Mạng & Website (/web)",
        mo_ta: "Kiểm tra tình trạng máy chủ, SSL, tốc độ phản hồi (ms), DNS Records và định vị IP/ISP",
        link_huong_dan: `${baseUrl}/web`
      },
      downloads: {
        ten: "Bóc Tách & Tải Đa Phương Tiện (/downloads)",
        mo_ta: "Trích xuất trọn bộ ảnh truyện tranh, bài viết chất lượng cao và tự động lọc bỏ ảnh bìa rác, banner quảng cáo",
        link_huong_dan: `${baseUrl}/downloads`
      }
    }
  });
};