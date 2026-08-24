module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    chuyen_muc: "Mạng Xã Hội & Game (Social & Gaming Platforms)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tong_so_tool: 11,
    danh_sach_tool: {
      spotify: {
        ten_api: "Spotify Music Search & Track Lookup",
        duong_dan: "/api/mxh/spotify",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu bài hát, ca sĩ, link nghe thử preview MP3, ảnh bìa album và link bài hát chính thức trên Spotify",
        cu_phap: [
          `${baseUrl}/api/mxh/spotify?={ten_bai_hat_hoac_link}`,
          `${baseUrl}/api/mxh/spotify?q={ten_bai_hat}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/spotify?=Chung Ta Cua Tuong Lai`,
          `${baseUrl}/api/mxh/spotify?=https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`
        ]
      },
      instagram: {
        ten_api: "Instagram Profile & Avatar HD Lookup",
        duong_dan: "/api/mxh/instagram",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu thông tin hồ sơ Instagram qua Username (họ tên, tiểu sử, số bài viết, followers, following, avatar HD, tích xanh, trạng thái riêng tư)",
        cu_phap: [
          `${baseUrl}/api/mxh/instagram?={username}`,
          `${baseUrl}/api/mxh/instagram?username={username}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/instagram?=cristiano`,
          `${baseUrl}/api/mxh/instagram?username=leomessi`
        ]
      },
      roblox: {
        ten_api: "Roblox User Profile & 3D Avatar Lookup",
        duong_dan: "/api/mxh/roblox",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu thông tin hồ sơ Roblox qua Username hoặc User ID (tiểu sử, ngày tạo, friends, followers, avatar 3D toàn thân)",
        cu_phap: [
          `${baseUrl}/api/mxh/roblox?={username}`,
          `${baseUrl}/api/mxh/roblox?={user_id}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/roblox?=Roblox`,
          `${baseUrl}/api/mxh/roblox?=1`
        ]
      },
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
        mo_ta: "Lấy thông tin tài khoản hoặc tải video không watermark",
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
        mo_ta: "Lấy thông tin kênh hoặc link stream video MP4/MP3",
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
        ten_api: "Discord Lookup & Token Account Checker",
        duong_dan: "/api/mxh/discord",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu thông tin tài khoản qua User Token (email, sđt, nitro, guilds), User ID hoặc máy chủ qua link mời",
        cu_phap: [
          `${baseUrl}/api/mxh/discord?={discord_token}`,
          `${baseUrl}/api/mxh/discord?={user_id}`,
          `${baseUrl}/api/mxh/discord?={invite_code_hoac_link}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/discord?=OTg4OTg2ODgx...`,
          `${baseUrl}/api/mxh/discord?=156114103282368512`,
          `${baseUrl}/api/mxh/discord?=https://discord.gg/discord-developers`
        ]
      },
      telegram: {
        ten_api: "Telegram Lookup (User, Bot, Group, Channel)",
        duong_dan: "/api/mxh/telegram",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu thông tin tài khoản cá nhân, bot qua Token, nhóm/kênh",
        cu_phap: [
          `${baseUrl}/api/mxh/telegram?={username}`,
          `${baseUrl}/api/mxh/telegram?={bot_token}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/telegram?=durov`,
          `${baseUrl}/api/mxh/telegram?=BotFather`
        ]
      },
      twitter: {
        ten_api: "Twitter (X) User & Video Downloader",
        duong_dan: "/api/mxh/twitter",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu profile (kèm top 10 following) hoặc tải video Tweet",
        cu_phap: [
          `${baseUrl}/api/mxh/twitter?={username}`,
          `${baseUrl}/api/mxh/twitter?={link_tweet}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/twitter?=elonmusk`,
          `${baseUrl}/api/mxh/twitter?=https://x.com/NASA/status/1800000000000000000`
        ]
      },
      facebook: {
        ten_api: "Facebook Profile & Video/Reels Downloader",
        duong_dan: "/api/mxh/facebook",
        phuong_thuc: "GET",
        mo_ta: "Tìm UID, lấy Avatar Full HD hoặc tải video MP4 (hỗ trợ kèm Access Token)",
        cu_phap: [
          `${baseUrl}/api/mxh/facebook?={username_hoac_uid}`,
          `${baseUrl}/api/mxh/facebook?={username_hoac_uid}&code={access_token}`,
          `${baseUrl}/api/mxh/facebook?={link_video}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/facebook?=hoducminh.depzai&code=EAAGNO4...`,
          `${baseUrl}/api/mxh/facebook?=https://www.facebook.com/watch/?v=1813358456318928`
        ]
      },
      zalo: {
        ten_api: "Zalo Lookup & Account Session Checker",
        duong_dan: "/api/mxh/zalo",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu nhóm Zalo, chuẩn hóa SĐT hoặc check full thông tin tài khoản qua Cookie / IMEI",
        cu_phap: [
          `${baseUrl}/api/mxh/zalo?={sdt_hoac_link_nhom}`,
          `${baseUrl}/api/mxh/zalo?cookie={zalo_cookie_chuoi_hoac_json}`,
          `${baseUrl}/api/mxh/zalo?imei={zalo_imei}`,
          `${baseUrl}/api/mxh/zalo?cookie={zalo_cookie}&imei={zalo_imei}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/zalo?=0912345678`,
          `${baseUrl}/api/mxh/zalo?=https://zalo.me/g/abcdef123`,
          `${baseUrl}/api/mxh/zalo?cookie=zpw_sek=fT0L.410649910...;_zlang=vn&imei=a8fe8c2a-4ddc-4fc0-9ace-8cc51b089057-8e253f85246590342756399a57054cb8`
        ]
      }
    }
  });
};