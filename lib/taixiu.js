module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  return res.status(200).json({
    trang_thai: "thanh_cong",
    he_thong: "Zhee Dev Gaming Probability & Multi-Platform Portal",
    chuyen_muc: "Trung Tâm API Tài Xỉu & Thuật Toán Xác Suất (/taixiu)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    phien_ban: "4.1.0",
    danh_sach_phan_he_cong_game: {
      hitclub_official: {
        ten_cong_game: "Cổng Game Hitclub (Soi Cầu & Đối Soát Minh Bạch)",
        endpoint_chinh: `${baseUrl}/api/taixiu/hitclub`,
        mo_ta: "Phân tích chuỗi SHA-256 trước phiên & đối soát chuỗi kết quả sau mở bát chuẩn 100% của Hitclub.",
        cu_phap: [
          `${baseUrl}/api/taixiu/hitclub?={chuoi_hash_sha256}`,
          `${baseUrl}/api/taixiu/hitclub?={chuoi_ket_qua_sau_mo_bat}`
        ]
      },
      suka88_exclusive: {
        ten_cong_game: "Cổng Game SUKA88 (Thương Hiệu Độc Quyền - Yêu Cầu Key)",
        endpoint_chinh: `${baseUrl}/api/taixiu/suka88`,
        mo_ta: "Hệ thống độc quyền: Lắc xúc xắc ngẫu nhiên, can thiệp kết quả (?set=tai/xiu/6-6-6), giải mã chuỗi đối soát & xuất ảnh gộp 3 viên (Yêu cầu Admin Key xác thực).",
        cu_phap: [
          `${baseUrl}/api/taixiu/suka88?=roll&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?set=tai&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?set=6-6-6&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?decode={chuoi_ket_qua}&key=m....gioi`,
          `${baseUrl}/api/taixiu/suka88?image=6-6-6`
        ]
      },
      sunwin_official: {
        ten_cong_game: "Cổng Game Sunwin (Đang tích hợp module mở rộng)",
        trang_thai: "Sắp ra mắt"
      },
      go88_official: {
        ten_cong_game: "Cổng Game Go88 (Đang tích hợp module mở rộng)",
        trang_thai: "Sắp ra mắt"
      }
    },
    bo_render_anh_xuc_xac_svg: {
      anh_gop_3_vien: `${baseUrl}/api/taixiu/suka88?image={d1}-{d2}-{d3} (Ví dụ: ?image=6-6-6)`,
      anh_don_1_vien: `${baseUrl}/api/taixiu/suka88?image={1_den_6} (Ví dụ: ?image=6)`
    },
    vi_du_truy_cap: [
      `${baseUrl}/api/taixiu/hitclub`,
      `${baseUrl}/api/taixiu/suka88`,
      `${baseUrl}/api/taixiu/suka88?image=6-6-6`
    ]
  });
};