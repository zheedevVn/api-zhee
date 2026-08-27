// 1. IMPORT TOÀN BỘ MODULE HANDLERS (../lib/)
const homeHandler = require("../lib/home");
const mxhHandler = require("../lib/mxh");
const spotifyHandler = require("../lib/spotify");
const soundcloudHandler = require("../lib/soundcloud");
const instagramHandler = require("../lib/instagram");
const bankHandler = require("../lib/bank");
const mailHandler = require("../lib/mail");
const webHandler = require("../lib/web");
const downloadsHandler = require("../lib/downloads");
const toolsHandler = require("../lib/tools");
const videoHandler = require("../lib/video");
const robloxHandler = require("../lib/roblox");
const githubHandler = require("../lib/github");
const tiktokHandler = require("../lib/tiktok");
const youtubeHandler = require("../lib/youtube");
const discordHandler = require("../lib/discord");
const telegramHandler = require("../lib/telegram");
const twitterHandler = require("../lib/twitter");
const facebookHandler = require("../lib/facebook");
const zaloHandler = require("../lib/zalo");
const shopeeHandler = require("../lib/shopee");
const checkimeiHandler = require("../lib/checkimei");
const checksdtHandler = require("../lib/checksdt");
const locketHandler = require("../lib/locket");
const nglHandler = require("../lib/ngl");
const transHandler = require("../lib/trans");
const baiHandler = require("../lib/bai");
const baucuaHandler = require("../lib/baucua");
const baccaratHandler = require("../lib/baccarat");
const taixiuHandler = require("../lib/taixiu");
const hitclubHandler = require("../lib/hitclub");
const suka88Handler = require("../lib/suka88");
const sunwinHandler = require("../lib/sunwin");
const club789Handler = require("../lib/789club");
const b52clubHandler = require("../lib/b52club");

// 2. REGISTRY TỔNG HỢP TOÀN BỘ API GATEWAY
const ROUTES_REGISTRY = [
  // --- CHUYÊN MỤC TÀI XỈU: B52CLUB, 789CLUB, SUNWIN, HITCLUB, SUKA88 ---
  {
    prefix: ["/api/taixiu/b52club", "/taixiu/b52club", "/b52club", "/api/b52club", "/b52"],
    ten: "B52 Club Volta & Tai Xiu MD5 Engine",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Chuyên mục soi cầu và đối soát chuỗi MD5 bàn bóng đá Volta & Tài Xỉu cổng game B52 Club.",
    vi_du_params: "?=50e0087bc111acab077a5b3a82f3a612",
    handler: b52clubHandler
  },
  {
    prefix: ["/api/taixiu/789club", "/taixiu/789club", "/789club", "/api/789club"],
    ten: "789Club Tai Xiu & Sicbo MD5 Engine",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Chuyên mục soi cầu và đối soát chuỗi MD5 bàn Tài Xỉu / Sicbo Las Vegas cổng game 789Club.",
    vi_du_params: "?=b87c550e3fb2cde381fa06886b772498",
    handler: club789Handler
  },
  {
    prefix: ["/api/taixiu/sunwin", "/taixiu/sunwin", "/sunwin", "/api/sunwin"],
    ten: "Sunwin Tai Xiu & Sicbo MD5 Engine",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Chuyên mục soi cầu và đối soát chuỗi MD5 bàn Tài Xỉu / Sicbo Hoàng Gia cổng game Sunwin.",
    vi_du_params: "?=d8cf242b85bed14f7816102c765fa711",
    handler: sunwinHandler
  },
  {
    prefix: ["/api/taixiu/hitclub", "/taixiu/hitclub", "/hitclub", "/api/hitclub"],
    ten: "Hitclub Tai Xiu & Sicbo Engine",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Chuyên mục soi cầu và đối soát chuỗi SHA-256 / MD5 đa sảnh game Hitclub.",
    vi_du_params: "?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f",
    handler: hitclubHandler
  },
  {
    prefix: [
      "/api/taixiu/suka88/bai", "/taixiu/suka88/bai", "/suka88/bai", "/api/suka88/bai",
      "/api/taixiu/bai", "/taixiu/bai", "/bai", "/api/bai", "/api/tools/bai", "/tools/bai", "/api/tools/cards", "/tools/cards", "/cards"
    ],
    ten: "SUKA88 — Bài Tây 52 Lá",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Sảnh bài Tây cổng SUKA88: random 1/2/3 lá, chỉ định, thông tin từng lá.",
    vi_du_params: "?so=3&key=minhhocgioi",
    handler: baiHandler
  },
  {
    prefix: [
      "/api/taixiu/suka88/baucua", "/taixiu/suka88/baucua", "/suka88/baucua", "/api/suka88/baucua",
      "/api/taixiu/baucua", "/taixiu/baucua", "/baucua", "/api/baucua", "/taixiu/bct", "/bct", "/suka88/bct"
    ],
    ten: "SUKA88 — Bầu Cua Tôm Cá",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Sảnh Bầu Cua cổng SUKA88: lắc 3 viên Nai/Bầu/Gà/Cá/Cua/Tôm.",
    vi_du_params: "?so=3&key=minhhocgioi",
    handler: baucuaHandler
  },
  {
    prefix: [
      "/api/taixiu/suka88/bcr", "/taixiu/suka88/bcr", "/suka88/bcr", "/api/suka88/bcr",
      "/api/taixiu/suka88/baccarat", "/taixiu/suka88/baccarat", "/suka88/baccarat", "/api/suka88/baccarat",
      "/api/taixiu/bcr", "/taixiu/bcr", "/bcr", "/api/bcr", "/taixiu/baccarat", "/baccarat", "/api/baccarat"
    ],
    ten: "SUKA88 — Baccarat (BCR)",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Sảnh Baccarat cổng SUKA88: chia bài Con/Cái, chỉ định, luật điểm.",
    vi_du_params: "?action=random&key=minhhocgioi",
    handler: baccaratHandler
  },
  {
    prefix: ["/api/taixiu/suka88", "/taixiu/suka88", "/suka88", "/api/suka88"],
    ten: "SUKA88 Game Engine & Provably Fair Simulator",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Cổng SUKA88: Tài Xỉu, Bài Tây, Bầu Cua, Baccarat. Tự tạo, cần API key khi chơi.",
    vi_du_params: "?=roll&key=minhhocgioi",
    handler: suka88Handler
  },
  {
    prefix: ["/api/taixiu", "/taixiu"],
    ten: "Trung Tâm API Tài Xỉu & Xác Suất",
    chuyen_muc: "Gaming & Probability",
    mo_ta: "Danh mục: B52, 789Club, Sunwin, Hitclub và cổng SUKA88 (Tài Xỉu, Bài, Bầu Cua, Baccarat).",
    vi_du_params: "",
    handler: taixiuHandler
  },

  // --- NHÓM TOOLS & TIỆN ÍCH HỆ THỐNG ---
  {
    prefix: ["/api/tools/trans", "/tools/trans", "/trans", "/api/trans", "/api/tools/translate", "/tools/translate"],
    ten: "Dịch Thuật Đa Ngôn Ngữ",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Dịch văn bản mọi ngôn ngữ (tự nhận diện nguồn, mặc định sang tiếng Việt).",
    vi_du_params: "?=Hello, how are you?",
    handler: transHandler
  },
  {
    prefix: ["/api/tools/ngl", "/tools/ngl", "/ngl", "/api/ngl"],
    ten: "NGL Username Lookup & One-shot Anonymous Message",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Check username NGL.link và gửi đúng 1 tin nhắn ẩn danh mỗi lần. Không hỗ trợ spam / multi-thread.",
    vi_du_params: "?=hoducminh",
    handler: nglHandler
  },
  {
    prefix: ["/api/tools/locket", "/tools/locket", "/locket", "/api/locket"],
    ten: "Locket Username Lookup & Account Tools",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Check username Locket công khai; đăng nhập token/email/SĐT để lấy thông tin tài khoản, bạn bè, moment, gửi/hủy 1 lời mời, tạo 1 tài khoản / 5 phút.",
    vi_du_params: "?=minh",
    handler: locketHandler
  },
  {
    prefix: ["/api/tools/checksdt", "/tools/checksdt", "/checksdt", "/api/checksdt"],
    ten: "Check Phone Number Intelligence (Twilio Lookups V2)",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Tra cứu thông tin nhà mạng, loại thuê bao, quốc gia, SIM Swap và chuyển tiếp cuộc gọi.",
    vi_du_params: "?=0944921186",
    handler: checksdtHandler
  },
  {
    prefix: ["/api/tools/checkimei", "/tools/checkimei", "/checkimei", "/api/checkimei"],
    ten: "Check IMEI & iOS Apple Device Inspector",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Tra cứu thông tin thiết bị Apple iOS qua IMEI, Serial, Model Number.",
    vi_du_params: "?=MLXJ3VN/A",
    handler: checkimeiHandler
  },
  {
    prefix: ["/tools/chat", "/api/tools/chat"],
    ten: "AI Chat Assistant (Gemini & ChatGPT)",
    chuyen_muc: "Tools & AI",
    mo_ta: "Hỏi đáp AI đàm thoại hỗ trợ Google Gemini và OpenAI ChatGPT.",
    vi_du_params: "?q=xin chào bạn&model=gemini",
    handler: toolsHandler
  },
  {
    prefix: ["/tools/key", "/api/tools/key"],
    ten: "ZheeTool Key Manager",
    chuyen_muc: "Tools & AI",
    mo_ta: "Tạo, check hạn dùng, lượt dùng key qua HMAC-SHA256 & Session IP.",
    vi_du_params: "?action=check&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI",
    handler: toolsHandler
  },
  {
    prefix: ["/tools/freefire", "/api/tools/freefire"],
    ten: "Free Fire Player Info",
    chuyen_muc: "Tools & AI",
    mo_ta: "Tra cứu thông tin tài khoản Free Fire (Nickname, Region, UID).",
    vi_du_params: "?uid=86744126",
    handler: toolsHandler
  },
  {
    prefix: ["/tools/removebg", "/api/tools/removebg"],
    ten: "AI Background Remover",
    chuyen_muc: "Tools & AI",
    mo_ta: "Xóa nền ảnh tự động bằng engine Remove.bg Pro.",
    vi_du_params: "?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg",
    handler: toolsHandler
  },
  {
    prefix: ["/tools/enhance", "/api/tools/enhance"],
    ten: "AI Image Enhancer (HD 2K/4K)",
    chuyen_muc: "Tools & AI",
    mo_ta: "Làm nét, khử mờ và tăng độ phân giải hình ảnh.",
    vi_du_params: "?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg",
    handler: toolsHandler
  },
  {
    prefix: ["/tools", "/api/tools"],
    ten: "Công Cụ & Tiện Ích Đa Năng AI",
    chuyen_muc: "Tools & AI",
    mo_ta: "Tài liệu danh mục các công cụ tiện ích AI.",
    vi_du_params: "",
    handler: toolsHandler
  },

  // --- NHÓM MẠNG XÃ HỘI, ÂM NHẠC & GAMING ---
  {
    prefix: ["/api/mxh/spotify", "/mxh/spotify", "/spotify"],
    ten: "Spotify Track, Lyrics & Artist Profile Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu bài hát, ca sĩ, profile nghệ sĩ kèm Top 10 track nổi bật, lyrics và link stream từ Spotify.",
    vi_du_params: "?q=Son Tung M-TP",
    handler: spotifyHandler
  },
  {
    prefix: ["/api/mxh/soundcloud", "/mxh/soundcloud", "/soundcloud"],
    ten: "SoundCloud Music & User Profile Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu bài hát, profile tác giả kèm 10 track mới nhất, ảnh bìa HD và link stream audio từ SoundCloud.",
    vi_du_params: "?q=Cat Doi Noi Sau",
    handler: soundcloudHandler
  },
  {
    prefix: ["/api/mxh/instagram", "/mxh/instagram", "/instagram", "/ig"],
    ten: "Instagram Profile Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu avatar HD, bio, người theo dõi, số bài viết và tích xanh Instagram.",
    vi_du_params: "?username=cristiano",
    handler: instagramHandler
  },
  {
    prefix: ["/api/mxh/roblox", "/mxh/roblox", "/roblox"],
    ten: "Roblox User Lookup",
    chuyen_muc: "Gaming",
    mo_ta: "Tra cứu thông tin hồ sơ Roblox (tiểu sử, avatar 3D toàn thân).",
    vi_du_params: "?=Roblox",
    handler: robloxHandler
  },
  {
    prefix: ["/api/mxh/github", "/mxh/github", "/github"],
    ten: "GitHub Info & Repos",
    chuyen_muc: "Developer",
    mo_ta: "Lấy thông tin cá nhân và danh sách kho lưu trữ GitHub.",
    vi_du_params: "?=hoducminh123",
    handler: githubHandler
  },
  {
    prefix: ["/api/mxh/tiktok", "/mxh/tiktok", "/tiktok"],
    ten: "TikTok Profile & Downloader",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Lấy thông tin profile hoặc tải video TikTok không watermark.",
    vi_du_params: "?=tiktok",
    handler: tiktokHandler
  },
  {
    prefix: ["/api/mxh/youtube", "/mxh/youtube", "/youtube"],
    ten: "YouTube Channel & Video Stream",
    chuyen_muc: "Media",
    mo_ta: "Lấy thông tin kênh hoặc link stream video MP4/MP3.",
    vi_du_params: "?=@SonTungMTP",
    handler: youtubeHandler
  },
  {
    prefix: ["/api/mxh/discord", "/mxh/discord", "/discord"],
    ten: "Discord Lookup & Checker",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu thông tin tài khoản qua Token, User ID hoặc server link mời.",
    vi_du_params: "?=156114103282368512",
    handler: discordHandler
  },
  {
    prefix: ["/api/mxh/telegram", "/mxh/telegram", "/telegram"],
    ten: "Telegram Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu thông tin tài khoản, bot qua Token, nhóm/kênh Telegram.",
    vi_du_params: "?=durov",
    handler: telegramHandler
  },
  {
    prefix: ["/api/mxh/twitter", "/mxh/twitter", "/twitter", "/x"],
    ten: "Twitter (X) Profile & Video Downloader",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu profile hoặc tải video Tweet nền tảng X.",
    vi_du_params: "?=elonmusk",
    handler: twitterHandler
  },
  {
    prefix: ["/api/mxh/facebook", "/mxh/facebook", "/facebook"],
    ten: "Facebook Profile & Downloader",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tìm UID, lấy Avatar HD hoặc tải video MP4.",
    vi_du_params: "?=https://facebook.com/zuck",
    handler: facebookHandler
  },
  {
    prefix: ["/api/mxh/zalo", "/mxh/zalo", "/zalo"],
    ten: "Zalo Account & Session Checker",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu nhóm Zalo, chuẩn hóa SĐT hoặc check tài khoản qua Cookie/IMEI.",
    vi_du_params: "?=0912345678",
    handler: zaloHandler
  },
  {
    prefix: ["/api/mxh/shopee", "/mxh/shopee", "/shopee"],
    ten: "Shopee Shop & Account Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu gian hàng Shopee theo username, shopid hoặc link shop (tên, followers, rating, Mall).",
    vi_du_params: "?=apple_flagship_store",
    handler: shopeeHandler
  },
  {
    prefix: ["/mxh", "/api/mxh"],
    ten: "Mạng Xã Hội & Game Platforms",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Trang tài liệu tổng hợp danh mục các công cụ mạng xã hội & game.",
    vi_du_params: "",
    handler: mxhHandler
  },

  // --- CÁC DỊCH VỤ DOWNLOAD, MEDIA & TIỆN ÍCH KHÁC ---
  {
    prefix: ["/downloads", "/api/downloads"],
    ten: "Media Downloader Đa Nền Tảng",
    chuyen_muc: "Download",
    mo_ta: "Bóc tách link video không logo, audio chất lượng cao.",
    vi_du_params: "?url=https://www.tiktok.com/@example/video/123456789",
    handler: downloadsHandler
  },
  {
    prefix: ["/video", "/api/video"],
    ten: "Video Gated (Nội Dung Yêu Cầu Key)",
    chuyen_muc: "Media VIP",
    mo_ta: "Kho tài nguyên video bảo mật bằng Key ZheeTool.",
    vi_du_params: "?node=node_v1&key=zhee_vip",
    handler: videoHandler
  },
  {
    prefix: ["/web", "/api/web"],
    ten: "Quản Trị Mạng & Công Cụ Website",
    chuyen_muc: "Web Utilities",
    mo_ta: "Kiểm tra DNS, Ping IP, Whois domain và SSL cert.",
    vi_du_params: "?domain=google.com",
    handler: webHandler
  },
  {
    prefix: ["/mail", "/api/mail"],
    ten: "Dịch Vụ Temp Mail & Xác Thực Email",
    chuyen_muc: "Mail Service",
    mo_ta: "Tạo hộp thư tạm thời nhận OTP hoặc xác thực định dạng email.",
    vi_du_params: "?action=create",
    handler: mailHandler
  },
  {
    prefix: ["/bank", "/api/bank"],
    ten: "Tra Cứu & Tạo Mã VietQR Ngân Hàng",
    chuyen_muc: "Fintech",
    mo_ta: "Tạo QR thanh toán tự động theo chuẩn Napas 247 và tra cứu BIN.",
    vi_du_params: "?bank=MBBank&acc=0987654321&amount=50000&memo=ZheePayment",
    handler: bankHandler
  }
];

module.exports = async (req, res) => {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "api-zhee.vercel.app";
    const baseUrl = `${protocol}://${host}`;

    const url = req.url || "/";
    const pathname = url.split("?")[0].toLowerCase();

    // Route /list
    if (pathname === "/list" || pathname === "/api/list") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Content-Type", "application/json; charset=utf-8");

      const danhSach = {};
      ROUTES_REGISTRY.forEach((route) => {
        const mainPath = route.prefix[0];
        const keyName = mainPath.replace(/^\//, "").replace(/\//g, "_").replace(/-/g, "_");

        danhSach[keyName] = {
          ten_api: route.ten,
          chuyen_muc: route.chuyen_muc,
          duong_dan: mainPath,
          mo_ta: route.mo_ta,
          tat_ca_prefix_ho_tro: route.prefix,
          link_vi_du: `${baseUrl}${mainPath}${route.vi_du_params}`
        };
      });

      return res.status(200).json({
        trang_thai: "thanh_cong",
        he_thong: "Zhee Dev - Central API Directory",
        tac_gia: "Hồ Đức Minh (Zhee Dev)",
        phien_ban: "5.6.0",
        tong_so_api_da_dang_ky: ROUTES_REGISTRY.length,
        danh_sach: danhSach
      });
    }

    for (const route of ROUTES_REGISTRY) {
      const matched = route.prefix.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname === `${p}`
      );
      if (matched && typeof route.handler === "function") {
        return await route.handler(req, res);
      }
    }

    if (typeof homeHandler === "function") {
      return await homeHandler(req, res);
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      thong_bao: "Zhee API Gateway is running!"
    });
  } catch (error) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(500).json({
      trang_thai: "that_bai",
      ma_loi: 500,
      thong_bao: "Lỗi xử lý máy chủ: " + error.message
    });
  }
};