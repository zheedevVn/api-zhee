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
    phien_ban: "5.1.0",
    danh_sach_cong_game: {
      hitclub: {
        ten_cong_game: "Cổng Game Hitclub (Tài Xỉu & Sicbo MD5 / SHA-256)",
        endpoint: `${baseUrl}/api/taixiu/hitclub`,
        mo_ta: "Phân tích chuỗi MD5 bàn Sicbo, chuỗi SHA-256 trước phiên và đối soát chuỗi kết quả sau mở bát chuẩn 100% của cổng Hitclub.",
        cu_phap_ho_tro: [
          `${baseUrl}/api/taixiu/hitclub?={ma_md5_sicbo_hoac_sha256}`,
          `${baseUrl}/api/taixiu/hitclub?={chuoi_ket_qua_sau_mo_bat}`,
          `${baseUrl}/api/taixiu/hitclub?image={1_den_6}`
        ],
        vi_du_truy_cap: [
          `${baseUrl}/api/taixiu/hitclub?=ceaad1ddefbc8d0ee09af7234c98c45b`,
          `${baseUrl}/api/taixiu/hitclub?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f`,
          `${baseUrl}/api/taixiu/hitclub?image=6`
        ]
      },
      suka88: {
        ten_cong_game: "Cổng Game SUKA88 (Thương Hiệu Độc Quyền - Cần Key)",
        endpoint: `${baseUrl}/api/taixiu/suka88`,
        mo_ta: "Nền tảng máy chủ Tài Xỉu uy tín chuẩn quốc tế. Vận hành theo thuật toán Provably Fair mã hóa SHA-256/MD5 cao cấp, cam kết xanh chín, minh bạch và bảo mật an toàn tuyệt đối.",
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