const homeHandler = require("../lib/home");
const mxhHandler = require("../lib/mxh");
const githubHandler = require("../lib/github");
const tiktokHandler = require("../lib/tiktok");
const youtubeHandler = require("../lib/youtube");
const discordHandler = require("../lib/discord");
const telegramHandler = require("../lib/telegram");
const twitterHandler = require("../lib/twitter");
const facebookHandler = require("../lib/facebook");
const zaloHandler = require("../lib/zalo");
const bankHandler = require("../lib/bank");

module.exports = async (req, res) => {
  const url = req.url || "/";
  const pathname = url.split("?")[0].toLowerCase();

  if (pathname === "/" || pathname === "/home" || pathname === "/api" || pathname === "/api/home") return homeHandler(req, res);
  if (pathname === "/mxh" || pathname === "/api/mxh") return mxhHandler(req, res);
  if (pathname.includes("/bank") || pathname.includes("/check") || pathname.includes("/taoqr")) return bankHandler(req, res);

  if (pathname.includes("/github")) return githubHandler(req, res);
  if (pathname.includes("/tiktok")) return tiktokHandler(req, res);
  if (pathname.includes("/youtube")) return youtubeHandler(req, res);
  if (pathname.includes("/discord")) return discordHandler(req, res);
  if (pathname.includes("/telegram")) return telegramHandler(req, res);
  if (pathname.includes("/twitter") || pathname.includes("/x")) return twitterHandler(req, res);
  if (pathname.includes("/facebook")) return facebookHandler(req, res);
  if (pathname.includes("/zalo")) return zaloHandler(req, res);

  return homeHandler(req, res);
};