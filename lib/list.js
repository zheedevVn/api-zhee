module.exports = (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  return res.status(200).json({
    trang_thai: "thanh_cong",
    he_thong: "Zhee Dev - Central API Directory",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    phien_ban: "2.0.0",
    tong_chuyen_muc: 17,
    danh_sach_api: {
      // 1. TRANG CHỦ & ĐIỀU HƯỚNG TỔNG
      home: {
        ten: "Trang Chủ API Gateway",
        duong_dan: "/",
        phuong_thuc: "GET",
        mo_ta: "Tổng quan trạng thái server, giới thiệu dịch vụ và thông số vận hành.",
        vi_du: `${baseUrl}/`
      },

      // 2. TOOLS & TIỆN ÍCH AI
      tools: {
        ten: "Công Cụ, Key Manager & Trợ Lý AI",
        duong_dan: "/tools",
        phuong_thuc: "GET/POST",
        mo_ta: "Quản trị Key ZheeTool, tra cứu UID game Free Fire, tách phông nền AI, làm nét ảnh HD và AI Chat (Gemini / ChatGPT).",
        cac_sub_endpoint: {
          ngl_lookup: `${baseUrl}/tools/ngl?=hoducminh`,
          ngl_send: `${baseUrl}/tools/ngl?action=send&username=hoducminh&question=hello`,
          locket_lookup: `${baseUrl}/tools/locket?=minh`,
          locket_account: `${baseUrl}/tools/locket?action=me&token={id_token}`,
          locket_friends: `${baseUrl}/tools/locket?action=friends&token={id_token}`,
          locket_moments: `${baseUrl}/tools/locket?action=moments&token={id_token}`,
          locket_add_friend: `${baseUrl}/tools/locket?action=add&token={id_token}&username=minh`,
          ai_chat: `${baseUrl}/tools/chat?q=bạn hãy làm thơ&model=gemini`,
          quan_ly_key: `${baseUrl}/tools/key?action=check&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI`,
          tao_key: `${baseUrl}/tools/key?action=create&uses=15&hours=72&secret=Zhee_secret@2026`,
          list_key: `${baseUrl}/tools/key?action=list&secret=m...gioi`,
          freefire_lookup: `${baseUrl}/tools/freefire?uid=86744126`,
          ai_remove_bg: `${baseUrl}/tools/removebg?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg`,
          ai_enhance: `${baseUrl}/tools/enhance?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg`
        }
      },

      // 3. TẢI ĐA PHƯƠNG TIỆN
      downloads: {
        ten: "Tải Video & Âm Thanh Đa Nền Tảng",
        duong_dan: "/downloads",
        phuong_thuc: "GET",
        mo_ta: "Bóc tách link video không logo, audio chất lượng cao từ nhiều nguồn.",
        vi_du: `${baseUrl}/downloads?url=https://www.tiktok.com/@example/video/123456789`
      },

      // 4. VIDEO GATED
      video: {
        ten: "Video Gated (Nội Dung Yêu Cầu Key)",
        duong_dan: "/video",
        phuong_thuc: "GET",
        mo_ta: "Truy cập tài nguyên media VIP bảo vệ bằng Key xác thực.",
        vi_du: `${baseUrl}/video?id=vip_video_01&key=zhee_vip`
      },

      // 5. TIỆN ÍCH WEB & NETWORK
      web: {
        ten: "Quản Trị Mạng & Công Cụ Website",
        duong_dan: "/web",
        phuong_thuc: "GET",
        mo_ta: "Kiểm tra DNS, Ping IP, Whois domain và SSL cert.",
        vi_du: `${baseUrl}/web?domain=google.com`
      },

      // 6. DỊCH VỤ EMAIL
      mail: {
        ten: "Dịch Vụ Temp Mail & Xác Thực Email",
        duong_dan: "/mail",
        phuong_thuc: "GET/POST",
        mo_ta: "Tạo hộp thư tạm thời nhận OTP hoặc xác thực định dạng email.",
        vi_du: `${baseUrl}/mail?action=create`
      },

      // 7. NGÂN HÀNG
      bank: {
        ten: "Tra Cứu & Tạo Mã VietQR Ngân Hàng",
        duong_dan: "/bank",
        phuong_thuc: "GET",
        mo_ta: "Tạo QR thanh toán tự động theo chuẩn Napas 247 và tra cứu BIN ngân hàng.",
        vi_du: `${baseUrl}/bank?bank=MBBank&acc=0987654321&amount=50000&memo=ZheePayment`
      },

      // 8. TỔNG HỢP MẠNG XÃ HỘI
      mxh: {
        ten: "Tổng Hợp Tiện Ích Mạng Xã Hội",
        duong_dan: "/mxh",
        phuong_thuc: "GET",
        mo_ta: "Trang danh mục các công cụ hỗ trợ mạng xã hội.",
        vi_du: `${baseUrl}/mxh`
      },

      // 9. ROBLOX
      roblox: {
        ten: "Tra Cứu Thông Tin Người Dùng Roblox",
        duong_dan: "/roblox",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu avatar, user ID, bạn bè và thông số game Roblox.",
        vi_du: `${baseUrl}/roblox?username=Roblox`
      },

      // 10. GITHUB
      github: {
        ten: "Tra Cứu Thông Tin Profile & Repo GitHub",
        duong_dan: "/github",
        phuong_thuc: "GET",
        mo_ta: "Lấy thông số repository, commit, avatar và bio của lập trình viên.",
        vi_du: `${baseUrl}/github?user=zheedevVn`
      },

      // 11. TIKTOK
      tiktok: {
        ten: "Tiện Ích & Bóc Tách Dữ Liệu TikTok",
        duong_dan: "/tiktok",
        phuong_thuc: "GET",
        mo_ta: "Lấy thông tin profile creator, tải video no watermark.",
        vi_du: `${baseUrl}/tiktok?user=tiktok`
      },

      // 12. YOUTUBE
      youtube: {
        ten: "Tra Cứu Dữ Liệu Kênh & Video YouTube",
        duong_dan: "/youtube",
        phuong_thuc: "GET",
        mo_ta: "Lấy thông tin thumbnail HD, tiêu đề, view count của video.",
        vi_du: `${baseUrl}/youtube?v=dQw4w9WgXcQ`
      },

      // 13. DISCORD
      discord: {
        ten: "Tra Cứu User & Server Discord",
        duong_dan: "/discord",
        phuong_thuc: "GET",
        mo_ta: "Lấy banner, avatar decoration và status user qua Discord ID.",
        vi_du: `${baseUrl}/discord?id=123456789012345678`
      },

      // 14. TELEGRAM
      telegram: {
        ten: "Tiện Ích Bot & User Telegram",
        duong_dan: "/telegram",
        phuong_thuc: "GET",
        mo_ta: "Kiểm tra thông tin tài khoản hoặc gửi thông báo qua Bot Telegram.",
        vi_du: `${baseUrl}/telegram?action=lookup&username=durov`
      },

      // 15. TWITTER (X)
      twitter: {
        ten: "Tra Cứu Người Dùng & Bài Đăng X (Twitter)",
        duong_dan: "/twitter",
        phuong_thuc: "GET",
        mo_ta: "Lấy avatar, bio, follower count và status từ nền tảng X.",
        vi_du: `${baseUrl}/twitter?user=elonmusk`
      },

      // 16. FACEBOOK
      facebook: {
        ten: "Tra Cứu UID & Profile Facebook",
        duong_dan: "/facebook",
        phuong_thuc: "GET",
        mo_ta: "Chuyển đổi URL trang cá nhân sang UID và kiểm tra avatar công khai.",
        vi_du: `${baseUrl}/facebook?url=https://facebook.com/zuck`
      },

      // 17. ZALO
      zalo: {
        ten: "Tiện Ích & Tra Cứu Zalo",
        duong_dan: "/zalo",
        phuong_thuc: "GET",
        mo_ta: "Kiểm tra số điện thoại đăng ký Zalo và hỗ trợ tạo link nhắn tin nhanh.",
        vi_du: `${baseUrl}/zalo?phone=0987654321`
      }
    }
  });
};