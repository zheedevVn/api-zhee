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
    phien_ban: "4.2.0",
    danh_sach_cong_game: {
      hitclub: {
        ten_cong_game: "Cổng Game Hitclub (Soi Cầu & Đối Soát Minh Bạch)",
        endpoint: `${baseUrl}/api/taixiu/hitclub`,
        mo_ta: "Phân tích chuỗi SHA-256 trước phiên và đối soát chuỗi kết quả sau mở bát chuẩn 100% của cổng Hitclub.",
        cu_phap_ho_tro: [
          `${baseUrl}/api/taixiu/hitclub?={chuoi_hash_sha256}`,
          `${baseUrl}/api/taixiu/hitclub?={chuoi_ket_qua_sau_mo_bat}`,
          `${baseUrl}/api/taixiu/hitclub?image={1_den_6}`
        ],
        vi_du_truy_cap: [
          `${baseUrl}/api/taixiu/hitclub?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f`,
          `${baseUrl}/api/taixiu/hitclub?image=6`
        ]
      },
      suka88: {
        ten_cong_game: "Cổng Game SUKA88 (Thương Hiệu Độc Quyền - Cần Key)",
        endpoint: `${baseUrl}/api/taixiu/suka88`,
        mo_ta: "Hệ thống độc quyền: Lắc xúc xắc ngẫu nhiên, can thiệp kết quả theo ý muốn, giải mã chuỗi đối soát và xuất ảnh gộp 3 viên trên đĩa (Yêu cầu xác thực Admin Key).",
        cu_phap_ho_tro: [
          `${baseUrl}/api/taixiu/suka88?=roll&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?set=tai&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?set=xiu&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?set=6-6-6&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?decode={chuoi_ket_qua_suka88}&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?image={d1}-{d2}-{d3}`
        ],
        vi_du_truy_cap: [
          `${baseUrl}/api/taixiu/suka88?=roll&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?set=6-6-6&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?image=6-6-6`
        ]
      }
    }
  });
};