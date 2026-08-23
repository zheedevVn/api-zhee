exports.handler = async (event, context) => {
  const protocol = event.headers["x-forwarded-proto"] || "https";
  const host = event.headers.host;
  const baseUrl = `${protocol}://${host}`;

  const homeData = {
    trang_thai: "thanh_cong",
    tac_gia: {
      ten: "Hồ Đức Minh (Zhee Dev)",
      github: "https://github.com/zheedevVn",
      website: baseUrl
    },
    he_thong: {
      ten_dich_vu: "Zhee API Service Engine",
      phien_ban: "2.0.0",
      mo_ta: "Hệ thống REST API phân chia theo từng nhóm chuyên mục."
    },
    danh_sach_chuyen_muc: {
      mang_xa_hoi: {
        ten: "API Mạng Xã Hội",
        mo_ta: "Tổng hợp các tool bóc tách dữ liệu GitHub, TikTok, YouTube, Discord...",
        link_huong_dan: `${baseUrl}/mxh`
      }
    }
  };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(homeData, null, 2)
  };
};