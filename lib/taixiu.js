module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Trung Tâm API Tài Xỉu & Thuật Toán Xác Suất (/taixiu)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    phien_ban: "2.0.0",
    danh_sach_cong_cu_con: {
      hitclub_engine: {
        ten: "Hitclub Tai Xiu Engine (Soi Cầu & Đối Soát Minh Bạch)",
        duong_dan: `${baseUrl}/api/taixiu/hitclub`,
        mo_ta: "Chuyên mục phân tích chuỗi SHA-256 trước phiên, đối soát chuỗi kết quả sau mở bát và gieo xúc xắc chỉ định riêng cho Hitclub.",
        cu_phap_ho_tro: [
          `${baseUrl}/api/taixiu/hitclub?={chuoi_hash_sha256}`,
          `${baseUrl}/api/taixiu/hitclub?={chuoi_ket_qua_sau_phien}`,
          `${baseUrl}/api/taixiu/hitclub?=roll`,
          `${baseUrl}/api/taixiu/hitclub?set=tai`,
          `${baseUrl}/api/taixiu/hitclub?set=xiu`,
          `${baseUrl}/api/taixiu/hitclub?set=6-6-6`
        ]
      },
      render_xuc_xac_svg: {
        ten: "Native 3D SVG Dice Renderer",
        duong_dan: `${baseUrl}/api/taixiu/hitclub?image={1_den_6}`,
        mo_ta: "Xuất trực tiếp hình ảnh xúc xắc SVG 3D chuẩn màu đỏ trắng theo từng nút từ 1 đến 6 (không phụ thuộc CDN ngoài)."
      }
    },
    vi_du_truy_cap: [
      `${baseUrl}/api/taixiu/hitclub`,
      `${baseUrl}/api/taixiu/hitclub?=roll`,
      `${baseUrl}/api/taixiu/hitclub?set=tai`,
      `${baseUrl}/api/taixiu/hitclub?image=6`
    ]
  });
};