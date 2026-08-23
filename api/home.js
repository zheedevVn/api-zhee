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
      phien_ban: "2.0.0",
      nen_tang: "Vercel Serverless Functions",
      mo_ta: "Hệ thống REST API phân chia theo từng nhóm chuyên mục."
    },
    danh_sach_chuyen_muc: {
      mang_xa_hoi: {
        ten: "API Mạng Xã Hội",
        mo_ta: "Tổng hợp các tool bóc tách dữ liệu GitHub, TikTok, YouTube, Discord...",
        link_huong_dan: `${baseUrl}/mxh`
      }
    }
  });
};