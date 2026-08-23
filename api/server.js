const homeHandler = require("../lib/home");
const mxhHandler = require("../lib/mxh");
const bankHandler = require("../lib/bank");
const mailHandler = require("../lib/mail");
const webHandler = require("../lib/web");
const downloadsHandler = require("../lib/downloads");
const toolsHandler = require("../lib/tools");
const robloxHandler = require("../lib/roblox");
const githubHandler = require("../lib/github");
const tiktokHandler = require("../lib/tiktok");
const youtubeHandler = require("../lib/youtube");
const discordHandler = require("../lib/discord");
const telegramHandler = require("../lib/telegram");
const twitterHandler = require("../lib/twitter");
const facebookHandler = require("../lib/facebook");
const zaloHandler = require("../lib/zalo");

module.exports = async (req, res) => {
  const url = req.url || "/";
  const pathname = url.split("?")[0].toLowerCase();

  // 1. Chuyên mục Công cụ & Utilities
  if (pathname === "/tools" || pathname.startsWith("/tools/") || pathname.startsWith("/api/tools")) {
    return toolsHandler(req, res);
  }

  // 2. Chuyên mục Tải & Bóc tách đa phương tiện
  if (pathname === "/downloads" || pathname.startsWith("/downloads/") || pathname.startsWith("/api/downloads")) {
    return downloadsHandler(req, res);
  }

  // 3. Chuyên mục Quản trị Mạng & Website
  if (pathname === "/web" || pathname.startsWith("/web/") || pathname.startsWith("/api/web")) {
    return webHandler(req, res);
  }

  // 4. Chuyên mục Dịch vụ Email
  if (pathname === "/mail" || pathname.startsWith("/mail/") || pathname.startsWith("/api/mail")) {
    return mailHandler(req, res);
  }

  // 5. Chuyên mục Ngân Hàng
  if (pathname === "/bank" || pathname.startsWith("/bank/") || pathname.startsWith("/api/bank")) {
    return bankHandler(req, res);
  }

  // 6. Chuyên mục Mạng Xã Hội & Game
  if (pathname === "/mxh" || pathname === "/api/mxh") return mxhHandler(req, res);
  if (pathname.includes("/roblox")) return robloxHandler(req, res);
  if (pathname.includes("/github")) return githubHandler(req, res);
  if (pathname.includes("/tiktok")) return tiktokHandler(req, res);
  if (pathname.includes("/youtube")) return youtubeHandler(req, res);
  if (pathname.includes("/discord")) return discordHandler(req, res);
  if (pathname.includes("/telegram")) return telegramHandler(req, res);
  if (pathname.includes("/twitter") || pathname.includes("/x")) return twitterHandler(req, res);
  if (pathname.includes("/facebook")) return facebookHandler(req, res);
  if (pathname.includes("/zalo")) return zaloHandler(req, res);

  // 7. Trang chủ tổng hợp
  return homeHandler(req, res);
};