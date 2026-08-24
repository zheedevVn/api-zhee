// 1. IMPORT TẤT CẢ HANDLER
const homeHandler = require("../lib/home");
const mxhHandler = require("../lib/mxh");
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

// 2. REGISTRY TỰ ĐỘNG - KHI THÊM LỆNH/ENDPOINT MỚI, CHỈ CẦN THÊM VÀO ĐÂY 1 DÒNG DUY NHẤT:
const ROUTES_REGISTRY = [
  {
    prefix: ["/tools", "/api/tools"],
    ten: "Công Cụ, Key Manager & Trợ Lý AI",
    mo_ta: "Quản trị Key, tra cứu Free Fire, tách nền ảnh AI, làm nét ảnh HD và AI Chat (Gemini / ChatGPT).",
    vi_du_params: "/chat?q=xin chào bạn&model=gemini",
    handler: toolsHandler
  },
  {
    prefix: ["/downloads", "/api/downloads"],
    ten: "Tải Video & Âm Thanh Đa Nền Tảng",
    mo_ta: "Bóc tách link video không logo, audio chất lượng cao từ nhiều nguồn.",
    vi_du_params: "?url=https://www.tiktok.com/@example/video/123456789",
    handler: downloadsHandler
  },
  {
    prefix: ["/video", "/api/video"],
    ten: "Video Gated (Nội Dung Riêng Tư Yêu Cầu Key)",
    mo_ta: "Truy cập tài nguyên media VIP bảo vệ bằng mã Key xác thực.",
    vi_du_params: "?id=vip_video_01&key=zhee_vip",
    handler: videoHandler
  },
  {
    prefix: ["/web", "/api/web"],
    ten: "Quản Trị Mạng & Công Cụ Website",
    mo_ta: "Kiểm tra DNS, Ping IP, Whois domain và SSL cert.",
    vi_du_params: "?domain=google.com",
    handler: webHandler
  },
  {
    prefix: ["/mail", "/api/mail"],
    ten: "Dịch Vụ Temp Mail & Xác Thực Email",
    mo_ta: "Tạo hộp thư tạm thời nhận OTP hoặc xác thực định dạng email.",
    vi_du_params: "?action=create",
    handler: mailHandler
  },
  {
    prefix: ["/bank", "/api/bank"],
    ten: "Tra Cứu & Tạo Mã VietQR Ngân Hàng",
    mo_ta: "Tạo QR thanh toán tự động theo chuẩn Napas 247 và tra cứu BIN ngân hàng.",
    vi_du_params: "?bank=MBBank&acc=0987654321&amount=50000&memo=ZheePayment",
    handler: bankHandler
  },
  {
    prefix: ["/mxh", "/api/mxh"],
    ten: "Tổng Hợp Tiện Ích Mạng Xã Hội",
    mo_ta: "Trang danh mục các công cụ hỗ trợ mạng xã hội.",
    vi_du_params: "",
    handler: mxhHandler
  },
  {
    prefix: ["/roblox"],
    ten: "Tra Cứu Thông Tin Roblox",
    mo_ta: "Tra cứu avatar, user ID, bạn bè và thông số game Roblox.",
    vi_du_params: "?username=Roblox",
    handler: robloxHandler
  },
  {
    prefix: ["/github"],
    ten: "Tra Cứu Profile & Repo GitHub",
    mo_ta: "Lấy thông số repository, commit, avatar và bio lập trình viên.",
    vi_du_params: "?user=zheedevVn",
    handler: githubHandler
  },
  {
    prefix: ["/tiktok"],
    ten: "Tiện Ích & Bóc Tách Dữ Liệu TikTok",
    mo_ta: "Lấy thông tin profile creator, tải video no watermark.",
    vi_du_params: "?user=tiktok",
    handler: tiktokHandler
  },
  {
    prefix: ["/youtube"],
    ten: "Tra Cứu Kênh & Video YouTube",
    mo_ta: "Lấy thông tin thumbnail HD, tiêu đề, view count của video.",
    vi_du_params: "?v=dQw4w9WgXcQ",
    handler: youtubeHandler
  },
  {
    prefix: ["/discord"],
    ten: "Tra Cứu User & Server Discord",
    mo_ta: "Lấy banner, avatar decoration và status user qua Discord ID.",
    vi_du_params: "?id=123456789012345678",
    handler: discordHandler
  },
  {
    prefix: ["/telegram"],
    ten: "Tiện Ích Bot & User Telegram",
    mo_ta: "Kiểm tra thông tin tài khoản hoặc gửi thông báo qua Bot Telegram.",
    vi_du_params: "?action=lookup&username=durov",
    handler: telegramHandler
  },
  {
    prefix: ["/twitter", "/x"],
    ten: "Tra Cứu Người Dùng & Bài Đăng X (Twitter)",
    mo_ta: "Lấy avatar, bio, follower count và status từ nền tảng X.",
    vi_du_params: "?user=elonmusk",
    handler: twitterHandler
  },
  {
    prefix: ["/facebook"],
    ten: "Tra Cứu UID & Profile Facebook",
    mo_ta: "Chuyển đổi URL trang cá nhân sang UID và kiểm tra avatar công khai.",
    vi_du_params: "?url=https://facebook.com/zuck",
    handler: facebookHandler
  },
  {
    prefix: ["/zalo"],
    ten: "Tiện Ích & Tra Cứu Zalo",
    mo_ta: "Kiểm tra số điện thoại đăng ký Zalo và hỗ trợ tạo link nhắn tin nhanh.",
    vi_du_params: "?phone=0987654321",
    handler: zaloHandler
  }
];

// 3. MAIN DISPATCHER & TỰ ĐỘNG SINH /list
module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  const url = req.url || "/";
  const pathname = url.split("?")[0].toLowerCase();

  // --- ENDPOINT /list TỰ ĐỘNG TỔNG HỢP ---
  if (pathname === "/list" || pathname === "/api/list") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    const danhSach = {};
    ROUTES_REGISTRY.forEach((route) => {
      const mainPath = route.prefix[0];
      const keyName = mainPath.replace(/^\//, "").replace(/-/g, "_");

      danhSach[keyName] = {
        ten_chuyen_muc: route.ten,
        duong_dan: mainPath,
        mo_ta: route.mo_ta,
        tat_ca_prefix_ho_tro: route.prefix,
        link_vi_du: `${baseUrl}${mainPath}${route.vi_du_params}`
      };
    });

    return res.status(200).json({
      trang_thai: "thanh_cong",
      he_thong: "Zhee Dev - Auto Directory Discovery",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_endpoint: ROUTES_REGISTRY.length,
      danh_sach: danhSach
    });
  }

  // --- TỰ ĐỘNG ĐỊNH TUYẾN DỰA VÀO REGISTRY ---
  for (const route of ROUTES_REGISTRY) {
    const matched = route.prefix.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.includes(p)
    );
    if (matched) {
      return route.handler(req, res);
    }
  }

  // Mặc định trả về trang chủ
  return homeHandler(req, res);
};