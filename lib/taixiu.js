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
    phien_ban: "5.6.0",
    danh_sach_cong_game: {
      b52club: {
        ten_cong_game: "Cổng Game B52 Club (Bóng Đá Volta & Tài Xỉu MD5)",
        endpoint: `${baseUrl}/api/taixiu/b52club`,
        mo_ta: "Phân tích chuỗi MD5 bàn bóng đá Volta (Đội Nhà/Đội Khách 1.98) và Tài Xỉu MD5 cổng B52 Club chuẩn 100%.",
        cu_phap_ho_tro: [
          `${baseUrl}/api/taixiu/b52club?={chuoi_md5_b52}`,
          `${baseUrl}/api/taixiu/b52club?={chuoi_ket_qua_mo_bat}`
        ],
        vi_du_truy_cap: [
          `${baseUrl}/api/taixiu/b52club?=50e0087bc111acab077a5b3a82f3a612`
        ]
      },
      "789club": {
        ten_cong_game: "Cổng Game 789Club (Tài Xỉu / Sicbo MD5 Las Vegas)",
        endpoint: `${baseUrl}/api/taixiu/789club`,
        mo_ta: "Phân tích chuỗi MD5 bàn cược Sicbo 789Club (áp dụng quy tắc hoàn 50% khi Bão) và đối soát chuỗi kết quả mở bát chuẩn 100%.",
        cu_phap_ho_tro: [
          `${baseUrl}/api/taixiu/789club?={chuoi_md5_789club}`,
          `${baseUrl}/api/taixiu/789club?={chuoi_ket_qua_mo_bat}`
        ],
        vi_du_truy_cap: [
          `${baseUrl}/api/taixiu/789club?=b87c550e3fb2cde381fa06886b772498`
        ]
      },
      sunwin: {
        ten_cong_game: "Cổng Game Sunwin (Tài Xỉu / Sicbo MD5 Hoàng Gia)",
        endpoint: `${baseUrl}/api/taixiu/sunwin`,
        mo_ta: "Phân tích chuỗi MD5 bàn cược Sicbo/Tài Xỉu Hoàng Gia Sunwin và đối soát chuỗi kết quả mở bát chuẩn 100%.",
        cu_phap_ho_tro: [
          `${baseUrl}/api/taixiu/sunwin?={chuoi_md5_sunwin}`,
          `${baseUrl}/api/taixiu/sunwin?={chuoi_ket_qua_mo_bat}`
        ],
        vi_du_truy_cap: [
          `${baseUrl}/api/taixiu/sunwin?=d8cf242b85bed14f7816102c765fa711`
        ]
      },
      hitclub: {
        ten_cong_game: "Cổng Game Hitclub (Đa Sảnh Game)",
        endpoint_chinh: `${baseUrl}/api/taixiu/hitclub`,
        cac_sanh_truc_thuoc: {
          sanh_sicbo: {
            ten: "Sảnh Sicbo MD5",
            endpoint: `${baseUrl}/api/taixiu/hitclub/sicbo`,
            cu_phap: `${baseUrl}/api/taixiu/hitclub/sicbo?={ma_md5_sicbo}`,
            vi_du: `${baseUrl}/api/taixiu/hitclub/sicbo?=ceaad1ddefbc8d0ee09af7234c98c45b`
          },
          sanh_taixiu: {
            ten: "Sảnh Tài Xỉu MD5 / SHA-256",
            endpoint: `${baseUrl}/api/taixiu/hitclub/taixiu`,
            cu_phap: `${baseUrl}/api/taixiu/hitclub/taixiu?={chuoi_hash}`,
            vi_du: `${baseUrl}/api/taixiu/hitclub/taixiu?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f`
          }
        }
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