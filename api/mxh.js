module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    chuyen_muc: "Mạng Xã Hội (Social Media Tools)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tong_so_tool: 5,
    danh_sach_tool: {
      github: {
        ten_api: "GitHub Info & Repos",
        duong_dan: "/api/mxh/github",
        phuong_thuc: "GET",
        mo_ta: "Lấy thông tin cá nhân và danh sách kho lưu trữ",
        cu_phap: `${baseUrl}/api/mxh/github?={username}`,
        vi_du: `${baseUrl}/api/mxh/github?=hoducminh123`
      },
      tiktok: {
        ten_api: "TikTok Profile & Video Downloader",
        duong_dan: "/api/mxh/tiktok",
        phuong_thuc: "GET",
        mo_ta: "Lấy thông tin tài khoản hoặc tải video không có watermark",
        cu_phap: [
          `${baseUrl}/api/mxh/tiktok?={username}`,
          `${baseUrl}/api/mxh/tiktok?={link_video}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/tiktok?=tiktok`,
          `${baseUrl}/api/mxh/tiktok?=https://vt.tiktok.com/ZSjabcXYZ/`
        ]
      },
      youtube: {
        ten_api: "YouTube Channel & Video Stream",
        duong_dan: "/api/mxh/youtube",
        phuong_thuc: "GET",
        mo_ta: "Lấy thông tin kênh (10 video mới nhất) hoặc link stream video",
        cu_phap: [
          `${baseUrl}/api/mxh/youtube?={handle_kenh}`,
          `${baseUrl}/api/mxh/youtube?={link_video}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/youtube?=@SonTungMTP`,
          `${baseUrl}/api/mxh/youtube?=https://www.youtube.com/watch?v=dQw4w9WgXcQ`
        ]
      },
      discord: {
        ten_api: "Discord User & Server Lookup",
        duong_dan: "/api/mxh/discord",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu thông tin User ID hoặc kiểm tra server qua mã/link mời",
        cu_phap: [
          `${baseUrl}/api/mxh/discord?={user_id}`,
          `${baseUrl}/api/mxh/discord?={invite_code_hoac_link}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/discord?=156114103282368512`,
          `${baseUrl}/api/mxh/discord?=https://discord.gg/discord-developers`
        ]
      },
      telegram: {
        ten_api: "Telegram Lookup (User, Bot, Group, Channel)",
        duong_dan: "/api/mxh/telegram",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu thông tin tài khoản cá nhân, bot, hội nhóm hoặc kênh Telegram",
        cu_phap: [
          `${baseUrl}/api/mxh/telegram?={username}`,
          `${baseUrl}/api/mxh/telegram?={link_t_me}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/telegram?=durov`,
          `${baseUrl}/api/mxh/telegram?=BotFather`,
          `${baseUrl}/api/mxh/telegram?=telegram`
        ]
      }
    }
  });
};