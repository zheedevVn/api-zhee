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
    phien_ban: "3.0.0",
    danh_sach_cong_cu_con: {
      hitclub_engine: {
        ten: "Hitclub Tai Xiu Engine (Soi Cầu & Đối Soát)",
        duong_dan: `${baseUrl}/api/taixiu/hitclub`,
        mo_ta: "Chuyên mục soi cầu chuỗi SHA-256 trước phiên & đối soát kết quả sau mở bát dành riêng cho cổng game Hitclub.",
        cu_phap: [
          `${baseUrl}/api/taixiu/hitclub?={chuoi_hash_sha256}`,
          `${baseUrl}/api/taixiu/hitclub?={chuoi_ket_qua_sau_mo_bat}`
        ]
      },
      suka88_engine: {
        ten: "Cổng Game Tài Xỉu SUKA88 (Demo & Custom Dice)",
        duong_dan: `${baseUrl}/api/taixiu/suka88`,
        mo_ta: "Cổng game độc quyền SUKA88: Giả lập lắc xúc xắc ngẫu nhiên, chỉ định kết quả (?set=tai, ?set=xiu, ?set=6-6-6) kèm mã Hash Provably Fair.",
        cu_phap: [
          `${baseUrl}/api/taixiu/suka88?=roll`,
          `${baseUrl}/api/taixiu/suka88?set=tai`,
          `${baseUrl}/api/taixiu/suka88?set=xiu`,
          `${baseUrl}/api/taixiu/suka88?set=6-6-6`
        ]
      },
      render_xuc_xac_svg: {
        ten: "Native 3D SVG Dice Renderer",
        duong_dan: `${baseUrl}/api/taixiu/hitclub?image={1_den_6}`,
        mo_ta: "Render hình ảnh xúc xắc SVG 3D siêu nét từ 1 đến 6 nút không phụ thuộc CDN."
      }
    },
    vi_du_truy_cap: [
      `${baseUrl}/api/taixiu/hitclub`,
      `${baseUrl}/api/taixiu/suka88?=roll`,
      `${baseUrl}/api/taixiu/suka88?set=tai`,
      `${baseUrl}/api/taixiu/hitclub?image=6`
    ]
  });
};