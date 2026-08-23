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
      phien_ban: "4.0.0",
      nen_tang: "Vercel Serverless (Single Server Core Architecture)",
      mo_ta: "Hệ thống REST API phân chia theo từng nhóm chuyên mục."
    },
    danh_sach_chuyen_muc: {
      mang_xa_hoi: {
        ten: "API Mạng Xã Hội (/mxh)",
        mo_ta: "Tổng hợp 8 tool: GitHub, TikTok, YouTube, Discord, Telegram, Twitter (X), Facebook, Zalo",
        link_huong_dan: `${baseUrl}/mxh`
      },
      ngan_hang: {
        ten: "API Ngân Hàng & VietQR (/bank)",
        mo_ta: "Tra cứu thông tin STK ngân hàng chuẩn Napas (/bank/check) và tạo mã QR thanh toán nhanh (/bank/taoqr)",
        link_huong_dan: `${baseUrl}/bank`
      },
      email_service: {
        ten: "Dịch Vụ Email & Gmail (/mail)",
        mo_ta: "Check thông tin Gmail và gửi email tự động theo chu kỳ số lượng/delay qua SMTP",
        link_huong_dan: `${baseUrl}/mail`
      }
    }
  });
};