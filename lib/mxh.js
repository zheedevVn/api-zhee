module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    chuyen_muc: "Mạng Xã Hội & Game (Social & Gaming Platforms)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tong_so_tool: 19,
    danh_sach_tool: {
      spotify: {
        ten_api: "Spotify Music, Lyrics & Artist Profile Lookup",
        duong_dan: "/api/mxh/spotify",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu bài hát (lấy MP3, lời bài hát lyrics, ảnh bìa HD) hoặc tra cứu hồ sơ tác giả/nghệ sĩ (lấy bio, followers, avatar HD, top 10 bài hát nổi bật nhất)",
        cu_phap: [
          `${baseUrl}/api/mxh/spotify?={ten_bai_hat_hoac_link_track}`,
          `${baseUrl}/api/mxh/spotify?={link_nghe_si_spotify}`,
          `${baseUrl}/api/mxh/spotify?artist={artist_id}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/spotify?=Chung Ta Cua Tuong Lai`,
          `${baseUrl}/api/mxh/spotify?=https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`,
          `${baseUrl}/api/mxh/spotify?=https://open.spotify.com/artist/6NF9Oa4ThQWCj6mogFSrVD`,
          `${baseUrl}/api/mxh/spotify?artist=5dfZ5uSmzR7VBeYG0Fa12Y`
        ]
      },
      soundcloud: {
        ten_api: "SoundCloud Music, User Profile & Direct Audio Downloader",
        duong_dan: "/api/mxh/soundcloud",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu bài hát (lấy MP3 direct stream, ảnh bìa 500x500 HD) hoặc tra cứu hồ sơ User (lấy followers, bio, avatar HD và 10 tracks mới nhất)",
        cu_phap: [
          `${baseUrl}/api/mxh/soundcloud?={ten_bai_hat_hoac_link_track}`,
          `${baseUrl}/api/mxh/soundcloud?={link_profile_user_soundcloud}`,
          `${baseUrl}/api/mxh/soundcloud?stream=true&url={link_track_soundcloud}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/soundcloud?=Cat Doi Noi Sau`,
          `${baseUrl}/api/mxh/soundcloud?=https://soundcloud.com/user-424125285`,
          `${baseUrl}/api/mxh/soundcloud?=https://soundcloud.com/user-723528254/sontungmtp-chungtacuatuonglai`
        ]
      },
      pinterest: {
        ten_api: "Pinterest Profile, Pin & Board Lookup",
        duong_dan: "/api/mxh/pinterest",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu hồ sơ Pinterest đầy đủ (followers, following, số pin, boards, avatar, bio, xác minh) kèm pin gần đây; xem chi tiết Pin hoặc bảng ghim qua link.",
        cu_phap: [
          `${baseUrl}/api/mxh/pinterest?={username}`,
          `${baseUrl}/api/mxh/pinterest?={link_profile}`,
          `${baseUrl}/api/mxh/pinterest?={link_pin}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/pinterest?=pinterest`,
          `${baseUrl}/api/mxh/pinterest?=ohjoy`,
          `${baseUrl}/api/mxh/pinterest?=https://www.pinterest.com/pin/424605071145711021/`
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
      linkedln: {
        ten_api: "LinkedIn Public Profile Lookup",
        duong_dan: "/api/mxh/linkedln",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu thông tin công khai của hồ sơ LinkedIn từ username hoặc link linkedin.com/in/. Không truy cập email, số điện thoại, cookie hoặc dữ liệu riêng tư.",
        cu_phap: [
          `${baseUrl}/api/mxh/linkedln?={username}`,
          `${baseUrl}/api/mxh/linkedln?url={link_profile_linkedin}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/linkedln?=satyanadella`,
          `${baseUrl}/api/mxh/linkedln?=https://www.linkedin.com/in/username/`
        ]
      },
      twitch: {
        ten_api: "Twitch Channel, Live Stream, VOD & Clips Lookup",
        duong_dan: "/api/mxh/twitch",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu thông tin công khai đầy đủ của kênh Twitch gồm profile, trạng thái livestream, danh mục đang phát, VOD gần đây và clips gần đây.",
        cu_phap: [
          `${baseUrl}/api/mxh/twitch?={username_hoac_link_twitch}`,
          `${baseUrl}/api/mxh/twitch?username={username}`,
          `${baseUrl}/api/mxh/twitch?id={channel_id}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/twitch?=shroud`,
          `${baseUrl}/api/mxh/twitch?=https://www.twitch.tv/riotgames`,
          `${baseUrl}/api/mxh/twitch?username=ibai`
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
      mega: {
        ten_api: "MEGA Public File & Folder Inspector",
        duong_dan: "/api/mxh/mega",
        phuong_thuc: "GET",
        mo_ta: "Kiểm tra đầy đủ metadata file/folder MEGA public (tên, loại, dung lượng, ngày tạo, danh sách mục). MEGA không công khai owner/user và API không nhận mật khẩu hoặc cookie.",
        cu_phap: [
          `${baseUrl}/api/mxh/mega?url={link_mega_public}`,
          `${baseUrl}/api/mxh/mega?={link_mega_public}`,
          `${baseUrl}/api/mxh/mega?action=user&username={username}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/mega?url=https://mega.nz/file/{id}#{key}`,
          `${baseUrl}/api/mxh/mega?action=user&username={username}`
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
      lazada: {
        ten_api: "Lazada Shop & Product Lookup",
        duong_dan: "/api/mxh/lazada",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu dữ liệu Lazada công khai theo link shop, slug/seller ID hoặc link sản phẩm. Chỉ trả field đọc được từ public page; không nhận mật khẩu, cookie, session hay token.",
        cu_phap: [
          `${baseUrl}/api/mxh/lazada?={shop_slug_hoac_seller_id}`,
          `${baseUrl}/api/mxh/lazada?url={link_shop_lazada}`,
          `${baseUrl}/api/mxh/lazada?url={link_san_pham_lazada}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/lazada?=https://www.lazada.vn/shop/{slug}/`,
          `${baseUrl}/api/mxh/lazada?=https://www.lazada.vn/products/{slug}-i{product_id}.html`
        ]
      },
      tiki: {
        ten_api: "Tiki Account, Shop & Product Lookup",
        duong_dan: "/api/mxh/tiki",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu dữ liệu Tiki công khai theo product ID, link sản phẩm, link shop hoặc slug. Không nhận mật khẩu, cookie, session hay token; Tiki không có public lookup tài khoản cá nhân theo username/email.",
        cu_phap: [
          `${baseUrl}/api/mxh/tiki?={product_url_hoac_product_id}`,
          `${baseUrl}/api/mxh/tiki?product={product_id}`,
          `${baseUrl}/api/mxh/tiki?url={link_shop_tiki}`,
          `${baseUrl}/api/mxh/tiki?username={shop_slug}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/tiki?=198944761`,
          `${baseUrl}/api/mxh/tiki?=https://tiki.vn/noi-com-dien-tu-tefal-rk818a68-1-8l-thuong-hieu-phap-hang-chinh-hang-p198944761.html`,
          `${baseUrl}/api/mxh/tiki?url=https://tiki.vn/cua-hang/{slug}`
        ]
      },
      shopee: {
        ten_api: "Shopee Shop & Account Lookup",
        duong_dan: "/api/mxh/shopee",
        phuong_thuc: "GET/POST",
        mo_ta: "Tra cứu shop/tài khoản Shopee. Mở /api/mxh/shopee để xem hướng dẫn cookie và script dán Console lấy cookie.",
        cu_phap: [
          `${baseUrl}/api/mxh/shopee?={username}`,
          `${baseUrl}/api/mxh/shopee?username={username}`,
          `${baseUrl}/api/mxh/shopee?shopid={shop_id}`,
          `${baseUrl}/api/mxh/shopee?username={username}&cookie={SPC_EC;SPC_U;SPC_SI;SPC_F;csrftoken}`
        ],
        vi_du: [
          `${baseUrl}/api/mxh/shopee?=hoducminh2k9`,
          `${baseUrl}/api/mxh/shopee?=apple_flagship_store`,
          `${baseUrl}/api/mxh/shopee?shopid=88201679`
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