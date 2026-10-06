/**
 * ZheeDevTool — (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Phan mem doc quyen — Cam sao chep / phan phoi lai khi chua duoc cap phep.
 * Xem giay phep day du tai file LICENSE.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zheeProtect = require("../lib/zheeProtect.js");
zheeProtect.verifyStartup();

const DOCS_HTML_PATH = path.join(__dirname, "..", "public", "ui.html");
const VIDEO_HTML_PATH = path.join(__dirname, "..", "public", "video.html");
const FAVICON_PATH = path.join(__dirname, "..", "public", "favicon.png");

function serveFavicon(res) {
  const body = fs.readFileSync(FAVICON_PATH);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.statusCode = 200;
  res.end(body);
}

function servePageHtml(res, filePath) {
  const html = applyHtmlHotfixes(fs.readFileSync(filePath, "utf8"));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.statusCode = 200;
  res.end(html);
}

function isCliClient(req) {
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  return /(?:^|[\s\/])(curl|wget|httpie|aria2|go-http-client|python-requests|python-urllib|node-fetch|axios|postmanruntime|insomnia|okhttp|libwww-perl|powershell|fetch)(?:\/|\s|$)/i.test(ua);
}

const SEO_PAGES = {
  "/": {
    title: "Zhee API — Cổng REST API miễn phí của Hồ Đức Minh",
    description: "Zhee API là cổng REST API của Hồ Đức Minh (Zhee Dev): mail tạm, tài xỉu, mạng xã hội, AI, VietQR và hơn 70 công cụ. Đăng ký nhận secret key, dùng thử 10 ngày, gia hạn 10.000đ."
  },
  "/cong-cu": {
    title: "Công cụ API | Zhee API",
    description: "Danh sách công cụ Zhee API: AI, captcha, check scam, dịch thuật, rút gọn link, QR, IP, NASA và các tiện ích cho lập trình viên."
  },
  "/tai-xiu": {
    title: "Tài xỉu B52, Sunwin, Hitclub, SUKA88 | Zhee API",
    description: "API tài xỉu của Zhee: B52 Club, 789Club, Sunwin, Hitclub và SUKA88 gồm xúc xắc, bài tây, bầu cua, baccarat."
  },
  "/mail": {
    title: "Mail tạm, IMAP và OTP | Zhee API",
    description: "Tạo mail tạm 1secmail hoặc Mail.tm, kiểm tra email rác và đọc hộp thư IMAP trên Zhee API."
  },
  "/dang-nhap": {
    title: "Đăng nhập | Zhee API",
    description: "Đăng nhập Zhee API bằng tên và mật khẩu hoặc Google để nhận secret key và dùng các công cụ."
  },
  "/ho-so": {
    title: "Hồ sơ và secret key | Zhee API",
    description: "Xem số dư, hạn secret key và token đăng nhập của tài khoản Zhee API."
  },
  "/vi": {
    title: "Nạp tiền và gia hạn | Zhee API",
    description: "Nạp tiền MB Bank và gia hạn secret key Zhee API: 10.000đ cho 10 ngày."
  },
  "/lien-he": {
    title: "Liên hệ Hồ Đức Minh | Zhee API",
    description: "Liên hệ Hồ Đức Minh qua Facebook, Zalo, TikTok, Discord và Telegram để được hỗ trợ Zhee API."
  },
  "/admin": {
    title: "Bảng điều khiển | Zhee API",
    description: "Bảng điều khiển quản trị Zhee API."
  }
};

const SEO_ORIGIN = "https://api-zhee.vercel.app";
const SEO_NAV = [
  ["/", "Giới thiệu", "Cổng REST API miễn phí của Hồ Đức Minh: mail tạm, tài xỉu, AI, VietQR và hơn 70 công cụ."],
  ["/cong-cu", "Công cụ", "Danh sách API cho lập trình viên: AI, IP, NASA, QR, dịch và captcha."],
  ["/tai-xiu", "Tài xỉu", "B52 Club, 789Club, Sunwin, Hitclub và SUKA88."],
  ["/mail", "Mail", "Mail tạm, hộp thư IMAP và mã OTP."],
  ["/dang-nhap", "Đăng nhập", "Đăng nhập bằng tên hoặc Google để nhận secret key."],
  ["/ho-so", "Hồ sơ", "Xem số dư, hạn secret key và token đăng nhập."],
  ["/vi", "Nạp tiền", "Nạp MB Bank và gia hạn key 10.000đ cho 10 ngày."],
  ["/lien-he", "Liên hệ", "Facebook, Zalo, TikTok, Discord và Telegram."]
];

function docsPageFor(pathname) {
  if (pathname === "/docs" || pathname === "/ui" || pathname === "/index.html" || pathname === "/gioi-thieu") return SEO_PAGES["/"];
  return SEO_PAGES[pathname] || null;
}

function canonicalPathFor(pathname) {
  if (!SEO_PAGES[pathname]) return "/";
  return pathname;
}

function wantsDocsHtml(req, pathname) {
  if (!docsPageFor(pathname)) return false;
  const url = req.url || "/";
  const search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  if (pathname === "/" && /[?&]format=json(?:&|$)/i.test(url)) return false;
  if (pathname === "/mail" && search) return false;
  if (isCliClient(req)) return false;
  const accept = String(req.headers.accept || "*/*").toLowerCase();
  if (accept.includes("application/json") && !accept.includes("text/html")) return false;
  if (!accept.includes("text/html") && accept !== "*/*") return false;
  if (pathname === "/" && !accept.includes("text/html")) return false;
  return true;
}

function seoHeading(pathname, page) {
  if (canonicalPathFor(pathname) === "/") return "Zhee API của Hồ Đức Minh";
  return String(page.title || "Zhee API").split("|")[0].trim();
}

function seoNavHtml() {
  return SEO_NAV.map(([path, name]) => `<a href="${escapeHtml(path)}">${escapeHtml(name)}</a>`).join("\n");
}

function seoArticleHtml(pathname) {
  const page = docsPageFor(pathname) || SEO_PAGES["/"];
  const canonical = canonicalPathFor(pathname);
  const links = SEO_NAV.filter(([path]) => path !== canonical).map(([path, name, text]) => (
    `<li><a href="${escapeHtml(path)}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(text)}</span></a></li>`
  )).join("");
  return `<section class="home-hero">
        <p class="home-eyebrow">Zhee API Directory</p>
        <h1>${escapeHtml(seoHeading(pathname, page))}</h1>
        <p class="lead">${escapeHtml(page.description)}</p>
        <nav class="jump-row" aria-label="Mục chính">${seoNavHtml()}</nav>
      </section>
      <section aria-label="Các phần của Zhee API">
        <h2>Các phần chính</h2>
        <ul class="seo-links">${links}</ul>
      </section>`;
}

function seoJsonLd(pathname) {
  const page = docsPageFor(pathname) || SEO_PAGES["/"];
  const canonical = canonicalPathFor(pathname);
  const pageUrl = `${SEO_ORIGIN}${canonical === "/" ? "/" : canonical}`;
  const crumbs = canonical === "/"
    ? [{ name: "Zhee API", url: `${SEO_ORIGIN}/` }]
    : [
      { name: "Zhee API", url: `${SEO_ORIGIN}/` },
      { name: seoHeading(pathname, page), url: pageUrl }
    ];
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SEO_ORIGIN}/#organization`,
        name: "Zhee API",
        url: `${SEO_ORIGIN}/`,
        description: SEO_PAGES["/"].description,
        logo: {
          "@type": "ImageObject",
          url: `${SEO_ORIGIN}/favicon.png`,
          width: 512,
          height: 512
        },
        image: `${SEO_ORIGIN}/favicon.png`,
        founder: { "@id": `${SEO_ORIGIN}/#person` },
        sameAs: [
          "https://github.com/zheedevVn",
          "https://t.me/zheevipv1",
          "https://www.tiktok.com/@nv1qda"
        ]
      },
      {
        "@type": "Person",
        "@id": `${SEO_ORIGIN}/#person`,
        name: "Hồ Đức Minh",
        alternateName: "Zhee Dev",
        url: `${SEO_ORIGIN}/`,
        worksFor: { "@id": `${SEO_ORIGIN}/#organization` }
      },
      {
        "@type": "WebSite",
        "@id": `${SEO_ORIGIN}/#website`,
        url: `${SEO_ORIGIN}/`,
        name: "Zhee API",
        alternateName: ["Zhee Dev API", "Cổng REST API của Hồ Đức Minh"],
        description: SEO_PAGES["/"].description,
        inLanguage: "vi-VN",
        image: `${SEO_ORIGIN}/favicon.png`,
        publisher: { "@id": `${SEO_ORIGIN}/#organization` }
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SEO_ORIGIN}/#application`,
        name: "Zhee API",
        url: `${SEO_ORIGIN}/`,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description: SEO_PAGES["/"].description,
        image: `${SEO_ORIGIN}/favicon.png`,
        author: { "@id": `${SEO_ORIGIN}/#person` },
        provider: { "@id": `${SEO_ORIGIN}/#organization` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "VND",
          description: "Dùng thử 10 ngày. Gia hạn 10.000đ cho 10 ngày."
        }
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: page.title,
        description: page.description,
        inLanguage: "vi-VN",
        isPartOf: { "@id": `${SEO_ORIGIN}/#website` },
        about: { "@id": `${SEO_ORIGIN}/#application` },
        primaryImageOfPage: `${SEO_ORIGIN}/favicon.png`
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: crumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.url
        }))
      },
      {
        "@type": "ItemList",
        "@id": `${SEO_ORIGIN}/#sections`,
        name: "Các phần chính của Zhee API",
        itemListElement: SEO_NAV.map(([path, name, text], index) => ({
          "@type": "ListItem",
          position: index + 1,
          name,
          description: text,
          url: `${SEO_ORIGIN}${path === "/" ? "/" : path}`
        }))
      }
    ]
  };
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}

function applyDocsSeo(html, pathname) {
  const page = docsPageFor(pathname) || SEO_PAGES["/"];
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const canonical = escapeHtml(`${SEO_ORIGIN}${canonicalPathFor(pathname)}`);
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonical}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonical}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${description}">`)
    .replace(/<article id="panel" aria-busy="true">[\s\S]*?<\/article>/, `<article id="panel" aria-busy="true">${seoArticleHtml(pathname)}</article>`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${seoJsonLd(pathname)}</script>`);
}

function serveDocsHtml(res, pathname) {
  const html = applyHtmlHotfixes(applyDocsSeo(fs.readFileSync(DOCS_HTML_PATH, "utf8"), pathname || "/"));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.statusCode = 200;
  res.end(html);
}

/* Mobile hotfix: CSS injected into every served HTML page (ZheeDev).
   Fixes horizontal overflow / broken text on phones without touching ui.html. */
const MOBILE_FIX_CSS = `
html, body { overflow-x: clip; }
@media (max-width: 640px) {
  .developer-hero-top, .wallet-hero-top {
    flex-wrap: wrap; gap: 10px; row-gap: 12px; margin-bottom: 16px;
  }
  .developer-hero-card, .wallet-hero-card { padding: 20px 18px; }
  .wallet-chip-emv { min-width: 0; flex-wrap: wrap; row-gap: 8px; }
  .wallet-brand-tags { flex-wrap: wrap; row-gap: 8px; min-width: 0; }
  .card-security-label { font-size: 9px; letter-spacing: .08em; }
  .dev-brand-tag, .dev-brand-admin, .wallet-brand-vip { font-size: 9.5px !important; }
  img, video { max-width: 100%; height: auto; }
  article { padding: 8px 16px 40px; }
}`;
/* HTML hotfixes applied at serve time (ZheeDev).
   ui.html is too large to push via API, so surgical JS patches live here. */
const HTML_JS_PATCHES = [
  // FIX: region toggle stuck on US — backend echoes region at thong_tin_tai_khoan.khu_vuc_quet
  [
    'let currentRegion = parsedOrState.region || parsedOrState.khu_vuc_quet || "US";',
    'let currentRegion = parsedOrState.region || parsedOrState.khu_vuc_quet || acc.khu_vuc_quet || "US";'
  ],
  // FIX: count quests auto-skipped in batch mode so the user knows why
  [
    'async function runAllQuests() {\n        if (dqcBatchRunning) return;\n        dqcBatchRunning = true;',
    'async function runAllQuests() {\n        if (dqcBatchRunning) return;\n        window.__dqcSkipped = 0;\n        dqcBatchRunning = true;'
  ],
  [
    'if (q.da_hoan_thanh || q.da_nhan_thuong) continue;',
    'if (q.da_hoan_thanh || q.da_nhan_thuong || q.da_het_han) { window.__dqcSkipped = (window.__dqcSkipped || 0) + 1; continue; }'
  ],
  [
    'dqcBatchRunning = false;\n        renderHtml();\n      }\n\n      function bindRegionButtons()',
    'dqcBatchRunning = false;\n        renderHtml();\n        if (window.__dqcSkipped > 0) { try { macAlert({ title: "Ch\u1ea1y h\u00e0ng lo\u1ea1t xong", text: "\u0110\u00e3 b\u1ecf qua " + window.__dqcSkipped + " nhi\u1ec7m v\u1ee5 (\u0111\u00e3 xong / \u0111\u00e3 nh\u1eadn th\u01b0\u1edfng / \u0111\u00e3 h\u1ebft h\u1ea1n).", ok: "\u0110\u00e3 hi\u1ec3u" }); } catch (_) {} window.__dqcSkipped = 0; }\n      }\n\n      function bindRegionButtons()'
  ],
  // FIX: quest hết hạn — hiện badge "Hết hạn", chặn nút chạy
  [
    'da_hoan_thanh: isDone,\n          da_nhan_thuong: isClaimed,',
    'da_hoan_thanh: isDone,\n          da_nhan_thuong: isClaimed,\n          da_het_han: Boolean(q.da_het_han),'
  ],
  [
    'if (!q || q.da_hoan_thanh || q.isRunning) return;',
    'if (!q || q.da_hoan_thanh || q.da_het_han || q.isRunning) return;'
  ],
  [
    '` : (q.isActivity ? `',
    '` : (q.da_het_han ? `<span class="dqc-done-pill" style="opacity:.55">${ico("clock")} Hết hạn</span>` : (q.isActivity ? `'
  ],
  [
    'Chạy ngay</button>\n                `))}\n              </div>',
    'Chạy ngay</button>\n                `)))}\n              </div>'
  ],
  // FIX: surface backend heartbeat failure reason on the quest card instead of silent 99%
  [
    'if (data.ket_qua?.tien_do_phan_tram != null) {\n              q.percent = Number(data.ket_qua.tien_do_phan_tram);\n              q.progressSeconds = Number(data.ket_qua.tien_do_giay) || elapsed;\n            }',
    'if (data.ket_qua?.tien_do_phan_tram != null) {\n              q.percent = Number(data.ket_qua.tien_do_phan_tram);\n              q.progressSeconds = Number(data.ket_qua.tien_do_giay) || elapsed;\n              if (data.ket_qua.ly_do_chua_xong && !data.ket_qua.da_hoan_thanh) { q.trang_thai = String(data.ket_qua.ly_do_chua_xong).slice(0, 90); }\n            }'
  ],
  // FIX: task label hien thi dung thoi gian that thay vi cung "Xem video (30s)"
  [
    'if (t0.muc_tieu_chu || t0.target_chu) taskLabel = t0.muc_tieu_chu || t0.target_chu;',
    'if (t0.muc_tieu_chu || t0.target_chu) taskLabel = t0.muc_tieu_chu || t0.target_chu; else { var __tn={WATCH_VIDEO:"Xem video",WATCH_VIDEO_ON_MOBILE:"Xem video",PLAY_ON_DESKTOP:"Chơi game",PLAY_ON_PLAYSTATION:"Chơi game",PLAY_ON_XBOX:"Chơi game",STREAM_ON_DESKTOP:"Stream",PLAY_ACTIVITY:"Chơi activity"}; var __tl=__tn[t0.ma]||"Nhiệm vụ"; taskLabel = targetSec>=60 ? __tl+" ("+(Math.round(targetSec/6)/10)+" phút)" : __tl+" ("+targetSec+"s)"; }'
  ]
];
function applyHtmlHotfixes(html) {
  if (typeof html !== "string") return html;
  let out = html;
  if (out.indexOf("</head>") !== -1) {
    out = out.replace("</head>", "<style data-zhee-mobile-fix>" + MOBILE_FIX_CSS + "</style>" + zheeProtect.consoleSignatureScript() + "</head>");
  }
  if (out.indexOf("<head>") !== -1) {
    out = out.replace("<head>", "<head>" + zheeProtect.htmlComment());
  }
  for (const [find, replace] of HTML_JS_PATCHES) {
    if (out.indexOf(find) !== -1) out = out.split(find).join(replace);
  }
  return out;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;",
    "'": "&apos;"
  }[char]));
}

function serveRobotsTxt(res) {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/telegram/webhook",
    "Disallow: /api/telegram/auth",
    "Disallow: /api/auth/",
    "Disallow: /api/account",
    "Disallow: /api/admin",
    "Disallow: /api/run",
    `Sitemap: ${SEO_ORIGIN}/sitemap.xml`,
    ""
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(body);
}

function serveSitemapXml(res) {
  const publicPages = ["/", "/cong-cu", "/tai-xiu", "/mail", "/dang-nhap", "/ho-so", "/vi", "/lien-he"];
  const urls = publicPages.map((page) => `  <url><loc>${escapeXml(`${SEO_ORIGIN}${page}`)}</loc></url>`).join("\n");
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    ""
  ].join("\n");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(body);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" }[char]));
}

function serveTaixiuImagePage(req, res, publicUrl) {
  const requestUrl = new URL(publicUrl || req.url || "/", `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host || "api-zhee.vercel.app"}`);
  const imageUrl = `${requestUrl.pathname}${requestUrl.search}`;
  const title = requestUrl.searchParams.get("image") || requestUrl.searchParams.get("img") || "Kết quả xúc xắc";
  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/png" href="/favicon.png"><title>Kết quả Tài Xỉu — ${escapeHtml(title)}</title>
<style> :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,#172554,#020617 70%);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#e2e8f0}.card{width:min(760px,calc(100% - 32px));padding:28px;border:1px solid #334155;border-radius:28px;background:rgba(15,23,42,.9);box-shadow:0 24px 80px rgba(0,0,0,.45);text-align:center}.eyebrow{color:#38bdf8;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.card h1{margin:18px 0 30px;font-size:clamp(22px,5vw,36px);line-height:1.2}.preview{position:relative;display:grid;place-items:center;margin-top:8px;padding:30px 16px 20px;border-radius:20px;background:#020617;border:1px solid #1e40af;overflow:visible}.preview img{display:block;width:min(420px,100%);height:auto;max-height:250px;object-fit:contain}.back{display:inline-block;margin-top:18px;color:#bae6fd;text-decoration:none;font-weight:700}.back:hover{color:#fff}</style></head>
<body><main class="card"><div class="eyebrow">Zhee API · Tài Xỉu</div><h1>Kết quả Tài Xỉu</h1><div class="preview"><img src="${escapeHtml(imageUrl)}" alt="Kết quả xúc xắc ${escapeHtml(title)}"></div><a class="back" href="/">← Về Zhee API</a></main></body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(html);
}

// 1. IMPORT TOÀN BỘ MODULE HANDLERS (../lib/)
const { buildSealMap, resolveToken, sealBody } = require("../lib/routeSeal");
const homeHandler = require("../lib/home");
const mxhHandler = require("../lib/mxh");
const spotifyHandler = require("../lib/spotify");
const soundcloudHandler = require("../lib/soundcloud");
const instagramHandler = require("../lib/instagram");
const bankHandler = require("../lib/bank");
const mailHandler = require("../lib/mail");
const webHandler = require("../lib/web");
const domainHandler = require("../lib/domain");
const endpointHandler = require("../lib/endpoint");
const downloadsHandler = require("../lib/downloads");
const toolsHandler = require("../lib/tools");
const giaitriHandler = require("../lib/giaitri");
const animeHandler = require("../lib/anime");
const nasaHandler = require("../lib/nasa");
const ipCheckHandler = require("../lib/ipcheck");
const telegramBotHandler = require("../lib/telegramBot");
const telegramAuthHandler = require("../lib/telegramAuth");
const googleAuthHandler = require("../lib/googleAuth");
const accountsHandler = require("../lib/accounts");
const videoHandler = require("../lib/video");
const robloxHandler = require("../lib/roblox");
const githubHandler = require("../lib/github");
const tiktokHandler = require("../lib/tiktok");
const twitchHandler = require("../lib/twitch");
const youtubeHandler = require("../lib/youtube");
const megaHandler = require("../lib/mega");
const discordHandler = require("../lib/discord");
const telegramHandler = require("../lib/telegram");
const twitterHandler = require("../lib/twitter");
const facebookHandler = require("../lib/facebook");
const zaloHandler = require("../lib/zalo");
const shopeeHandler = require("../lib/shopee");
const lazadaHandler = require("../lib/lazada");
const tikiHandler = require("../lib/tiki");
const pinterestHandler = require("../lib/pinterest");
const checkimeiHandler = require("../lib/checkimei");
const checksdtHandler = require("../lib/checksdt");
const locketHandler = require("../lib/locket");
const nglHandler = require("../lib/ngl");
const transHandler = require("../lib/trans");
const captchaHandler = require("../lib/captcha");
const checkscamHandler = require("../lib/checkscam");
const aikeyHandler = require("../lib/aikey");
const checkmailHandler = require("../lib/checkmail");
const taomailHandler = require("../lib/taomail");
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
// Giao diện / (docs) đọc /list — thêm/sửa route ở đây là sidebar tự cập nhật. Không public /video.
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
    prefix: [
      "/api/tools/checkkeyai", "/tools/checkkeyai", "/checkkeyai", "/api/checkkeyai",
      "/api/tools/aikey", "/tools/aikey", "/aikey",
      "/api/tools/apikey", "/tools/apikey", "/apikey",
      "/api/tools/checkkey", "/tools/checkkey"
    ],
    ten: "Check API Key AI",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Check key AI còn hạn, module/model dùng được, quota/token/credit còn lại.",
    vi_du_params: "?key={api_key}",
    handler: aikeyHandler
  },
  {
    prefix: [
      "/mail/check", "/api/mail/check",
      "/mail/hopthu", "/api/mail/hopthu",
      "/mail/inbox", "/api/mail/inbox",
      "/api/tools/checkmail", "/tools/checkmail", "/checkmail"
    ],
    ten: "Check hộp thư IMAP (/mail/check)",
    chuyen_muc: "Mail Service",
    mo_ta: "Đọc trang hộp thư đang hiện + tổng thư nhận. Các mục: hộp thư đến, sao, đã gửi, nháp...",
    vi_du_params: "?email={gmail}&mk={mat_khau_ung_dung}",
    handler: checkmailHandler
  },
  {
    prefix: ["/api/mail/temp-check", "/mail/temp-check", "/temp-email-check", "/temporary-email-check"],
    ten: "Temporary Email Checker",
    chuyen_muc: "Mail Service",
    mo_ta: "Kiểm tra domain email tạm/rác phổ biến để hạn chế spam đăng ký.",
    vi_du_params: "?email=user@10minutemail.com",
    handler: mailHandler
  },
  {
    prefix: ["/mail/taomail", "/api/mail/taomail", "/taomail", "/api/taomail"],
    ten: "Tạo mail tạm (1secmail / Mail.tm)",
    chuyen_muc: "Mail Service",
    mo_ta: "Tạo hộp thư tạm thật: kieu=ngan (1secmail), kieu=dai (Mail.tm). Không copy bot Telegram.",
    vi_du_params: "?kieu=dai",
    handler: taomailHandler
  },
  {
    prefix: ["/api/tools/checkscam", "/tools/checkscam", "/checkscam", "/api/checkscam", "/api/tools/gdv", "/tools/gdv", "/gdv"],
    ten: "Checkscam — Thông tin bị báo cáo",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Tra cứu STK, SĐT, họ tên đã bị tố cáo/báo cáo lừa đảo.",
    vi_du_params: "?=1903456789",
    handler: checkscamHandler
  },
  {
    prefix: ["/api/tools/captcha", "/tools/captcha", "/captcha", "/api/captcha"],
    ten: "Tạo Captcha Ảnh",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Sinh captcha méo chữ kèm token đối chiếu. Không giải captcha website khác.",
    vi_du_params: "",
    handler: captchaHandler
  },
  {
    prefix: ["/api/tools/trans", "/tools/trans", "/trans", "/api/trans", "/api/tools/translate", "/tools/translate"],
    ten: "Dịch Thuật Đa Ngôn Ngữ",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Dịch văn bản mọi ngôn ngữ (tự nhận diện nguồn, mặc định sang tiếng Việt). Có voice: văn bản sang giọng nói MP3.",
    vi_du_params: "?=Hello, how are you?",
    handler: transHandler
  },
  {
    prefix: ["/api/tools/ngl", "/tools/ngl", "/ngl", "/api/ngl"],
    ten: "NGL Username Lookup & One-shot Anonymous Message",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Check username NGL.link và gửi đúng 1 tin nhắn ẩn danh mỗi lần. Không hỗ trợ spam / multi-thread.",
    vi_du_params: "?=hoducminh",
    handler: nglHandler
  },
  {
    prefix: ["/api/tools/locket", "/tools/locket", "/locket", "/api/locket"],
    ten: "Locket Username Lookup & Account Tools",
    chuyen_muc: "Mạng Xã Hội",
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
    vi_du_params: "?url=https://placehold.co/1200x800/png?text=Zhee%20API",
    handler: toolsHandler
  },
  {
    prefix: ["/tools/enhance", "/api/tools/enhance"],
    ten: "AI Image Enhancer (HD 2K/4K)",
    chuyen_muc: "Tools & AI",
    mo_ta: "Làm nét, khử mờ và tăng độ phân giải hình ảnh.",
    vi_du_params: "?url=https://placehold.co/1200x800/png?text=Zhee%20API",
    handler: toolsHandler
  },
  {
    prefix: ["/api/tools/nasa", "/tools/nasa", "/nasa"],
    ten: "NASA Space Data & Astronomy Lookup",
    chuyen_muc: "Tools & AI",
    mo_ta: "Tra cứu APOD, vật thể gần Trái Đất, EPIC và DONKI từ NASA Open APIs. NASA đã lưu trữ Mars Rover Photos API.",
    vi_du_params: "?action=apod",
    handler: nasaHandler
  },
  {
    prefix: ["/api/tools/ipcheck", "/tools/ipcheck", "/ipcheck"],
    ten: "IP Address Intelligence (IPStack)",
    chuyen_muc: "Tools & AI",
    mo_ta: "Tra cứu vị trí, quốc gia, múi giờ, nhà mạng, ASN và các tín hiệu proxy/Tor/crawler của IPv4 hoặc IPv6 qua IPStack.",
    vi_du_params: "?ip=113.175.232.110",
    handler: ipCheckHandler
  },
  {
    prefix: ["/api/anime", "/anime", "/api/anime/images", "/anime/images", "/api/anime/tags", "/anime/tags"],
    ten: "Anime Images & Tags (Waifu.im)",
    chuyen_muc: "Tools & AI",
    mo_ta: "Lấy ảnh anime phân trang, lọc tag và xem danh sách tag từ Waifu.im; PageSize tối đa 20.",
    vi_du_params: "/images?PageSize=10&Page=1",
    handler: animeHandler
  },
  {
    prefix: ["/api/tools/ua-parser", "/tools/ua-parser", "/ua-parser", "/user-agent-parser"],
    ten: "User-Agent Parser",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Phân tích thiết bị, hệ điều hành và trình duyệt từ chuỗi User-Agent.",
    vi_du_params: "?ua=Mozilla%2F5.0%20(iPhone)",
    handler: toolsHandler
  },
  {
    prefix: ["/api/badge", "/badge", "/api/tools/badge", "/tools/badge"],
    ten: "Dynamic SVG Badge Generator",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Tạo badge SVG động để nhúng vào README hoặc Markdown.",
    vi_du_params: "?label=Build&status=Passing&color=green",
    handler: toolsHandler
  },
  {
    prefix: ["/api/avatar", "/avatar", "/api/tools/avatar", "/tools/avatar"],
    ten: "Dynamic Avatar Initial Generator",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Tạo avatar SVG tròn với chữ cái đầu và màu nền theo hash tên.",
    vi_du_params: "?name=Nguyen%20Van%20A",
    handler: toolsHandler
  },
  {
    prefix: ["/api/tools/qr", "/tools/qr", "/qr"],
    ten: "QR Code Generator (goQR.me)",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Tạo nhanh mã QR từ URL hoặc chuỗi văn bản bằng link ảnh goQR.me.",
    vi_du_params: "?text=https%3A%2F%2Fexample.com&size=300",
    handler: toolsHandler
  },
  {
    prefix: ["/api/tools/shortener", "/tools/shortener", "/shortener", "/api/tools/shorten", "/tools/shorten", "/tinyurl", "/bitly"],
    ten: "URL Shortener (TinyURL / Bitly)",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Rút gọn link dài bằng TinyURL hoặc Bitly; Bitly cần BITLY_ACCESS_TOKEN.",
    vi_du_params: "?url=https%3A%2F%2Fexample.com&provider=tinyurl",
    handler: toolsHandler
  },
  {
    prefix: ["/api/metadata", "/metadata", "/api/tools/metadata", "/tools/metadata"],
    ten: "Bóc Tách Metadata & Open Graph (Microlink)",
    chuyen_muc: "Tools & Utilities",
    mo_ta: "Bóc tách title, description, ảnh preview và Open Graph metadata từ URL.",
    vi_du_params: "?url=https%3A%2F%2Fexample.com",
    handler: toolsHandler
  },
  {
    prefix: ["/api/quiz", "/quiz", "/api/giaitri/quiz"],
    ten: "Phòng Đố Vui Trắc Nghiệm (Open Trivia DB)",
    chuyen_muc: "Giải trí",
    mo_ta: "Tạo phòng đố vui trắc nghiệm với câu hỏi và 4 đáp án từ Open Trivia DB.",
    vi_du_params: "?category=history&amount=5",
    handler: giaitriHandler
  },
  {
    prefix: ["/api/quote/daily", "/quote/daily", "/api/giaitri/quote"],
    ten: "Danh Ngôn & Lời Khuyên Hàng Ngày",
    chuyen_muc: "Giải trí",
    mo_ta: "Lấy câu nói truyền cảm hứng từ ZenQuotes hoặc lời khuyên từ Advice Slip.",
    vi_du_params: "",
    handler: giaitriHandler
  },
  {
    prefix: ["/api/vn/lunar", "/vn/lunar", "/api/giaitri/lunar"],
    ten: "Lịch Âm Việt Nam",
    chuyen_muc: "Giải trí",
    mo_ta: "Đổi ngày dương sang âm, can chi và giờ tốt theo thuật toán Hồ Ngọc Đức.",
    vi_du_params: "?date=2026-09-10",
    handler: giaitriHandler
  },
  {
    prefix: ["/api/vn/plate", "/vn/plate", "/api/giaitri/plate"],
    ten: "Tra Cứu Biển Số Xe Việt Nam",
    chuyen_muc: "Giải trí",
    mo_ta: "Tra cứu mã biển số xe theo tỉnh/thành phố Việt Nam.",
    vi_du_params: "?code=29",
    handler: giaitriHandler
  },
  {
    prefix: ["/api/vn/fuel", "/vn/fuel", "/api/giaitri/fuel"],
    ten: "Giá Xăng Dầu Petrolimex",
    chuyen_muc: "Giải trí",
    mo_ta: "Lấy dữ liệu giá xăng dầu Petrolimex và trạng thái kỳ điều hành.",
    vi_du_params: "",
    handler: giaitriHandler
  },
  {
    prefix: ["/api/vn/holidays", "/vn/holidays", "/api/giaitri/holidays"],
    ten: "Ngày Lễ & Ngày Nghỉ Việt Nam",
    chuyen_muc: "Giải trí",
    mo_ta: "Tra cứu ngày lễ, ngày nghỉ chính thức và kỳ nghỉ tiếp theo tại Việt Nam.",
    vi_du_params: "?date=2026-09-02",
    handler: giaitriHandler
  },
  {
    prefix: ["/api/vn/thesaurus", "/vn/thesaurus", "/api/giaitri/thesaurus"],
    ten: "Từ Điển Đồng Nghĩa & Trái Nghĩa Tiếng Việt",
    chuyen_muc: "Giải trí",
    mo_ta: "Tra cứu từ đồng nghĩa, trái nghĩa, từ láy và thành ngữ phổ biến.",
    vi_du_params: "?word=đẹp",
    handler: giaitriHandler
  },
  {
    prefix: ["/api/vn/text", "/vn/text", "/api/giaitri/text"],
    ten: "Công Cụ Xử Lý Văn Bản Tiếng Việt",
    chuyen_muc: "Giải trí",
    mo_ta: "Bỏ dấu tiếng Việt và tạo slug URL từ văn bản.",
    vi_du_params: "?text=Học Lập Trình&action=slug",
    handler: giaitriHandler
  },
  {
    prefix: ["/api/vn/number-to-words", "/vn/number-to-words", "/api/giaitri/number-to-words"],
    ten: "Chuyển Số Thành Chữ Tiếng Việt",
    chuyen_muc: "Giải trí",
    mo_ta: "Đổi số tiền thành chữ tiếng Việt dùng cho hóa đơn.",
    vi_du_params: "?number=1500000",
    handler: giaitriHandler
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
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Lấy thông tin cá nhân và danh sách kho lưu trữ GitHub.",
    vi_du_params: "?=hoducminh123",
    handler: githubHandler
  },
  {
    prefix: ["/api/mxh/tiktok", "/mxh/tiktok", "/tiktok", "/douyin", "/api/douyin"],
    ten: "TikTok / Douyin Profile & Downloader",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu profile TikTok, tải video/ảnh không logo qua TikWM/Cobalt, hoặc check account tầng sâu bằng Session ID (email, phone, connects, bảo mật).",
    vi_du_params: "?user=tiktok",
    handler: tiktokHandler
  },
  {
    prefix: ["/api/mxh/cobalt", "/mxh/cobalt", "/cobalt"],
    ten: "Cobalt Multi-platform Media Downloader",
    chuyen_muc: "Tải media",
    mo_ta: "Lấy link tải/stream media từ TikTok, Douyin, Facebook, SoundCloud và Twitter/X qua Cobalt.",
    vi_du_params: "?url=https://www.tiktok.com/@user/video/123456789",
    handler: tiktokHandler
  },
  {
    prefix: ["/api/mxh/twitch", "/mxh/twitch", "/twitch"],
    ten: "Twitch Channel, Live Stream, VOD & Clips Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu thông tin công khai của kênh Twitch gồm profile, trạng thái livestream, danh mục, VOD và clips gần đây.",
    vi_du_params: "?=shroud",
    handler: twitchHandler
  },
  {
    prefix: [
      "/api/youtube", "/youtube", "/api/mxh/youtube", "/mxh/youtube",
      "/api/yt/trending-vn", "/yt/trending-vn",
      "/api/yt/thumbnail", "/yt/thumbnail",
      "/api/yt/transcript", "/yt/transcript",
      "/api/yt/channel-stats", "/yt/channel-stats"
    ],
    ten: "YouTube API Hub",
    chuyen_muc: "Media",
    mo_ta: "Một endpoint YouTube dùng action để lấy video/kênh, thumbnail, transcript, trending Việt Nam và thống kê channel.",
    vi_du_params: "?action=thumbnail&url=https://youtu.be/dQw4w9WgXcQ",
    handler: youtubeHandler
  },
  {
    prefix: ["/api/mxh/mega", "/mxh/mega", "/mega"],
    ten: "MEGA Public File & Folder Inspector",
    chuyen_muc: "Cloud Storage",
    mo_ta: "Kiểm tra metadata file/folder MEGA được chia sẻ công khai; không tra cứu danh tính user hay nhận mật khẩu/cookie.",
    vi_du_params: "?url=https://mega.nz/file/{id}#{key}",
    handler: megaHandler
  },
  {
    prefix: ["/api/mxh/discord", "/mxh/discord", "/discord"],
    ten: "Discord Lookup & Quest Completer",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Kiểm tra tài khoản bằng token (Nitro, Orbs, nhiệm vụ), tự động chạy nhiệm vụ video quảng cáo Orbs bằng mã định danh (báo DONE để tự nhận thưởng), tra cứu User ID và link mời.",
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
    prefix: ["/api/mxh/tiki", "/mxh/tiki", "/tiki"],
    ten: "Tiki Account, Shop & Product Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu dữ liệu Tiki công khai theo product ID, link sản phẩm, shop hoặc slug; không nhận mật khẩu/cookie/session.",
    vi_du_params: "?=198944761",
    handler: tikiHandler
  },
  {
    prefix: ["/api/mxh/lazada", "/mxh/lazada", "/lazada"],
    ten: "Lazada Shop & Product Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu dữ liệu Lazada công khai theo shop slug, seller ID hoặc link sản phẩm; không nhận mật khẩu/cookie/session.",
    vi_du_params: "?=https://www.lazada.vn/shop/{slug}/",
    handler: lazadaHandler
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
    prefix: ["/api/mxh/pinterest", "/mxh/pinterest", "/pinterest"],
    ten: "Pinterest Profile, Pin & Board Lookup",
    chuyen_muc: "Mạng Xã Hội",
    mo_ta: "Tra cứu hồ sơ Pinterest (followers, pins, boards, avatar, bio), chi tiết Pin và bảng ghim.",
    vi_du_params: "?=pinterest",
    handler: pinterestHandler
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
    mo_ta: "Bóc tách ảnh chương truyện/bài viết và luồng video MP4/M3U8 từ URL trang công khai.",
    vi_du_params: "?url=https://vi.wikipedia.org/wiki/H%C3%A0_N%E1%BB%99i",
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
    prefix: ["/web/endpoint", "/api/web/endpoint", "/web/api", "/api/web/api"],
    ten: "Check Endpoint / API của Website",
    chuyen_muc: "Web Utilities",
    mo_ta: "Quét HTML/JS để liệt kê URL API mà trang khai báo. Không bắt live request như DevTools.",
    vi_du_params: "?=https://vietqr.io",
    handler: endpointHandler
  },
  {
    prefix: ["/web/domain", "/api/web/domain", "/domain", "/api/domain"],
    ten: "Check Tên Miền Tồn Tại",
    chuyen_muc: "Web Utilities",
    mo_ta: "Kiểm tra tên miền đã đăng ký hay còn trống (DNS + RDAP).",
    vi_du_params: "?=google.com",
    handler: domainHandler
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
    ten: "Dịch Vụ Mail: gửi OTP & check hộp thư",
    chuyen_muc: "Mail Service",
    mo_ta: "Gửi OTP/hóa đơn; check hộp thư IMAP tại /mail/check (email + mật khẩu ứng dụng).",
    vi_du_params: "",
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

const ROUTE_SEAL = buildSealMap(ROUTES_REGISTRY);

function isInternalBot(req) {
  const header = String((req.headers && req.headers["x-zhee-internal"]) || "");
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!header || !token || header.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(token));
}

function isAdminBot(req) {
  if (!isInternalBot(req)) return false;
  const adminId = String((req.headers && req.headers["x-zhee-admin"]) || "").trim();
  if (!adminId) return false;
  const admins = String(process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
  return admins.includes(adminId);
}

function serveGoogleVerification(res) {
  const file = path.join(__dirname, "..", "public", "google1d1d8cc07ec81095.html");
  const body = fs.readFileSync(file);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.statusCode = 200;
  res.end(body);
}

function installResponseSeal(res, req) {
  if (typeof res.json !== "function" || res.json.__zheeSealed) return;
  const original = res.json.bind(res);
  const host = (req && req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "api-zhee.vercel.app";
  const wrapped = (body) => {
    let out = res.zheeNoSeal ? body : sealBody(body, ROUTE_SEAL);
    if (out && typeof out === "object") {
      try {
        let jsonStr = JSON.stringify(out);
        if (jsonStr.includes("{domain}")) {
          jsonStr = jsonStr.replace(/\{domain\}/g, host);
          out = JSON.parse(jsonStr);
        }
      } catch (_) {}
    }
    return original(out);
  };
  wrapped.__zheeSealed = true;
  res.json = wrapped;
}

// Video VIP and Image Collector call /video directly and are gated by API key.
// They stay off /list, and their media URLs must not be rewritten into /g/<token>.
function isVideoPath(pathname) {
  return pathname === "/video" || pathname.startsWith("/video/")
    || pathname === "/api/video" || pathname.startsWith("/api/video/");
}

// Dice and card pictures are drawn from the query. The result page and chat
// apps request them as images, so they stay on the old short path and do not
// need a secret. Data lookups on the same tools stay gated.
function isGeneratedPicture(req, pathname, url) {
  const method = String((req && req.method) || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  const picturePath = /\/(?:taixiu|bai|baucua|bcr|baccarat|b52club|789club|sunwin|hitclub|suka88|cards)(?:\/|$)/i.test(pathname);
  if (!picturePath) return false;
  return /[?&](?:image|img|combo)=/i.test(String(url || ""));
}

function routeSlug(pathname) {
  return String(pathname || "home").replace(/^\//, "").replace(/\//g, "-") || "home";
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader("X-XSS-Protection", "1; mode=block");
}

const RATE_LIMIT_BUCKET = new Map();
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip, maxRequests = 200) {
  const now = Date.now();
  let record = RATE_LIMIT_BUCKET.get(ip);
  if (!record || now - record.start > RATE_WINDOW_MS) {
    record = { start: now, count: 1 };
    RATE_LIMIT_BUCKET.set(ip, record);
    if (RATE_LIMIT_BUCKET.size > 3000) {
      for (const [k, v] of RATE_LIMIT_BUCKET.entries()) {
        if (now - v.start > RATE_WINDOW_MS) RATE_LIMIT_BUCKET.delete(k);
      }
    }
    return { ok: true };
  }
  record.count += 1;
  if (record.count > maxRequests) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((record.start + RATE_WINDOW_MS - now) / 1000)) };
  }
  return { ok: true };
}

function readJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch (_) { return {}; }
  }
  return req.body;
}

async function runTool(req, res) {
  const access = await accountsHandler.accessForRequest(req);
  if (!access.ok) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(access.status).json({ trang_thai: "that_bai", thong_bao: access.thong_bao });
  }
  const body = readJsonBody(req);
  const ma = String(body.ma || "").trim().toLowerCase();
  const query = String(body.query || "").replace(/^\?/, "").replace(/[\r\n]/g, "").slice(0, 4000);
  const route = ROUTES_REGISTRY.find((item) => {
    const s0 = routeSlug(item.prefix[0]).toLowerCase();
    if (s0 === ma) return true;
    return item.prefix.some((p) => {
      const sp = routeSlug(p).toLowerCase();
      const rawP = p.replace(/^\//, "").toLowerCase();
      return sp === ma || rawP === ma || p.toLowerCase() === "/" + ma;
    });
  });
  if (!route) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({ trang_thai: "that_bai", thong_bao: "Không thấy công cụ." });
  }
  accountsHandler.noteToolHit(route.prefix[0]).catch(() => {});
  req.url = route.prefix[0] + (query ? `?${query}` : "");
  try {
    const u = new URL(req.url, "https://localhost");
    req.query = Object.fromEntries(u.searchParams.entries());
  } catch (_) {
    req.query = {};
  }
  return route.handler(req, res);
}

module.exports = async (req, res) => {
  const startTime = Date.now();
  applySecurityHeaders(res);

  if (res && typeof res.writeHead === "function") {
    const origWriteHead = res.writeHead;
    res.writeHead = function(...args) {
      if (!res.headersSent) {
        const elapsed = Date.now() - startTime;
        res.setHeader("X-Response-Time", `${elapsed}ms`);
        res.setHeader("Server-Timing", `total;dur=${elapsed}`);
      }
      return origWriteHead.apply(this, args);
    };
  }

  const clientIp = accountsHandler.clientIp(req);
  const isAuthRoute = Boolean(req.url && /\/api\/auth\//i.test(req.url));
  const rate = checkRateLimit(clientIp, isAuthRoute ? 40 : 250);
  if (!rate.ok) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Retry-After", String(rate.retryAfter));
    return res.status(429).json({
      trang_thai: "that_bai",
      ma_loi: "RATE_LIMITED",
      thong_bao: `Hệ thống bảo vệ: quá nhiều yêu cầu. Vui lòng thử lại sau ${rate.retryAfter} giây.`
    });
  }

  try {
    const url = req.url || "/";
    const queryIndex = url.indexOf("?");
    const rawPath = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
    const search = queryIndex >= 0 ? url.slice(queryIndex) : "";
    let pathname = rawPath.toLowerCase();
    let sealed = false;
    installResponseSeal(res, req);
    // Callers still use the short paths. Keep those paths in JSON instead of
    // rewriting them into the long /g/ token.
    res.zheeNoSeal = true;
    const accept = String(req.headers.accept || "");

    if (pathname.startsWith("/g/")) {
      let token = rawPath.slice(3);
      try { token = decodeURIComponent(token); } catch (_) {}
      const canonical = resolveToken(token, ROUTE_SEAL);
      if (!canonical) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.status(404).json({ trang_thai: "that_bai", thong_bao: "Endpoint không tồn tại." });
      }
      req.url = canonical + search;
      req.zheePublicUrl = rawPath + search;
      pathname = canonical.toLowerCase();
      sealed = true;
    }

    if (pathname === "/favicon.png" || pathname === "/favicon.ico") {
      return serveFavicon(res);
    }

    if (pathname === "/google1d1d8cc07ec81095.html") {
      return serveGoogleVerification(res);
    }

    if (pathname === "/robots.txt") {
      return serveRobotsTxt(res);
    }

    if (pathname === "/sitemap.xml") {
      return serveSitemapXml(res);
    }

    if (pathname === "/api/telegram/webhook") {
      return await telegramBotHandler(req, res);
    }

    if (pathname === "/api/telegram/auth" || pathname === "/telegram/auth") {
      return await telegramAuthHandler(req, res);
    }

    if (
      pathname === "/api/auth/config" ||
      pathname === "/api/auth/session" ||
      pathname === "/api/auth/logout" ||
      pathname === "/api/auth/google"
    ) {
      res.zheeNoSeal = true;
      return await googleAuthHandler(req, res);
    }

    if (
      pathname === "/api/auth/admin" ||
      pathname === "/api/auth/token" ||
      pathname === "/api/auth/verify" ||
      pathname === "/api/account" ||
      pathname.startsWith("/api/account/") ||
      pathname === "/api/admin" ||
      pathname.startsWith("/api/admin/")
    ) {
      res.zheeNoSeal = true;
      return await accountsHandler(req, res);
    }

    if (pathname === "/api/run" && req.method === "POST") {
      res.zheeNoSeal = true;
      return await runTool(req, res);
    }

    if (wantsDocsHtml(req, pathname)) {
      try {
        serveDocsHtml(res, pathname);
        return;
      } catch (_) {}
    }

    // Explicitly serve the protected UI pages because vercel.json rewrites all requests here.
    if (pathname === "/video.html") {
      servePageHtml(res, VIDEO_HTML_PATH);
      return;
    }
    if (/\/api\/taixiu\//i.test(pathname) && /[?&](?:image|img)=/i.test(url) && accept.includes("text/html")) {
      return serveTaixiuImagePage(req, res, req.zheePublicUrl || url);
    }
    // /list names the tools for the interface. It does not publish callable URLs.
    if (pathname === "/list" || pathname === "/api/list") {
      res.zheeNoSeal = true;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Content-Type", "application/json; charset=utf-8");

      const hits = await accountsHandler.toolHits();
      const danhSach = {};
      ROUTES_REGISTRY.filter((route) => !route.prefix.some((p) => p === "/video" || p === "/api/video")).forEach((route) => {
        const mainPath = route.prefix[0];
        const keyName = mainPath.replace(/^\//, "").replace(/\//g, "_").replace(/-/g, "_");

        danhSach[keyName] = {
          ten_api: route.ten,
          chuyen_muc: route.chuyen_muc,
          ma_giao_dien: mainPath,
          mo_ta: route.mo_ta,
          tham_so: route.vi_du_params || "",
          luot: Number(hits[mainPath] || 0)
        };
      });

      return res.status(200).json({
        trang_thai: "thanh_cong",
        he_thong: "Zhee Dev - Central API Directory",
        tac_gia: "Hồ Đức Minh (Zhee Dev)",
        phien_ban: "5.6.0",
        tong_so_api_da_dang_ky: Object.keys(danhSach).length,
        danh_sach: danhSach
      });
    }

    if (isVideoPath(pathname)) res.zheeNoSeal = true;

    const matchedRoute = ROUTES_REGISTRY.find((route) => route.prefix.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ));
    const generatedPicture = isGeneratedPicture(req, pathname, url);
    if (matchedRoute && !generatedPicture && !isAdminBot(req)) {
      const access = await accountsHandler.accessForRequest(req);
      if (!access.ok) {
        res.zheeNoSeal = true;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.status(access.status).json({ trang_thai: "that_bai", thong_bao: access.thong_bao });
      }
      accountsHandler.noteToolHit(matchedRoute.prefix[0]).catch(() => {});
    } else if (matchedRoute && !generatedPicture && isAdminBot(req)) {
      accountsHandler.noteToolHit(matchedRoute.prefix[0]).catch(() => {});
    }

    for (const route of ROUTES_REGISTRY) {
      const matched = route.prefix.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname === `${p}`
      );
      if (matched && typeof route.handler === "function") {
        return await route.handler(req, res);
      }
    }

    if (pathname === "/" && typeof homeHandler === "function") {
      return await homeHandler(req, res);
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: "Endpoint không tồn tại."
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