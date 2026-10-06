require("./zheeProtect.js").verifyOrThrow();
const cheerio = require("cheerio");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": "\"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"Windows\"",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "no-cache"
};

// Danh sách từ khóa loại bỏ ảnh rác, loader, assets, logo, quảng cáo
const JUNK_KEYWORDS = [
  "covers", "cover", "thumb", "thumbnail", "related", "recommend", "sidebar",
  "logo", "icon", "favicon", "avatar", "badge", "banner", "ad-", "ads",
  "sponsor", "tracking", "pixel", "counter", "googleads", "doubleclick",
  "loader", "loading", "spinner", "inline-loader", "skin", "assets-cdn", "blank.gif"
];

function isChapterAsset(urlStr, className = "") {
  return /chapter-img|images\/data\/|page-chapter|reader-area|reading-content/i.test(`${urlStr} ${className}`);
}

function isJunkUrl(urlStr, className = "", altText = "") {
  if (isChapterAsset(urlStr, className)) return false;
  const combined = `${urlStr} ${className} ${altText}`.toLowerCase();
  if (urlStr.startsWith("data:image") || urlStr.endsWith(".svg")) return true;
  if (urlStr.includes("1x1") || urlStr.includes("spacer") || urlStr.includes("loader")) return true;
  if (/\/ads\/|\/pets\/|favicon|dcn-gold|logo|\/storage\/images\/default\//i.test(urlStr)) return true;
  for (const kw of JUNK_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  return false;
}

function looksLikeChallenge(html) {
  return /just a moment|cf-browser-verification|attention required|security verification|checking your browser/i.test(String(html || ""));
}

function imgSrcFromElement(elem) {
  const keys = ["data-src", "data-original", "data-lazy-src", "data-url", "data-cfsrc", "data-srcset", "srcset", "src"];
  for (const key of keys) {
    let src = elem.attr(key);
    if (!src || typeof src !== "string") continue;
    src = src.split(",")[0].trim().split(" ")[0];
    if (src.startsWith("data:image")) continue;
    if (src) return src;
  }
  return "";
}

function resolveUrl(relativeUrl, baseDomain) {
  try {
    if (!relativeUrl) return null;
    let clean = relativeUrl.trim();
    if (clean.startsWith("//")) clean = "https:" + clean;
    return new URL(clean, baseDomain).href;
  } catch (e) {
    return null;
  }
}

// Bóc tách luồng video từ HTML và Script Player
function extractVideoStreams(html, originUrl) {
  const results = {
    title: null,
    thumbnail: null,
    qualities: {},
    hls_streams: [],
    direct_mp4: []
  };

  const titleMatch = html.match(/html5player\.setVideoTitle\(['"](.*?)['"]\)/i)
    || html.match(/<meta property=["']og:title["'] content=["'](.*?)["']/i)
    || html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) results.title = titleMatch[1].replace(/\\'/g, "'").trim();

  const thumbMatch = html.match(/html5player\.setThumbUrl\(['"](.*?)['"]\)/i)
    || html.match(/html5player\.setThumbUrl169\(['"](.*?)['"]\)/i)
    || html.match(/<meta property=["']og:image["'] content=["'](.*?)["']/i);
  if (thumbMatch) results.thumbnail = thumbMatch[1];

  const lowMatch = html.match(/html5player\.setVideoUrlLow\(['"](.*?)['"]\)/i)
    || html.match(/setVideoUrlLow\(['"](.*?)['"]\)/i);
  if (lowMatch && lowMatch[1]) results.qualities.sd_360p = lowMatch[1];

  const highMatch = html.match(/html5player\.setVideoUrlHigh\(['"](.*?)['"]\)/i)
    || html.match(/setVideoUrlHigh\(['"](.*?)['"]\)/i);
  if (highMatch && highMatch[1]) results.qualities.hd_720p = highMatch[1];

  const hlsMatch = html.match(/html5player\.setVideoHLS\(['"](.*?)['"]\)/i)
    || html.match(/setVideoHLS\(['"](.*?)['"]\)/i)
    || html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
  if (hlsMatch && hlsMatch[1]) results.hls_streams.push(hlsMatch[1]);

  const $ = cheerio.load(html);
  $("video, source").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src) {
      const fullUrl = resolveUrl(src, originUrl);
      if (fullUrl) {
        if (fullUrl.includes(".m3u8") && !results.hls_streams.includes(fullUrl)) {
          results.hls_streams.push(fullUrl);
        } else if (/\.(mp4|webm|m4v)(\?.*)?$/i.test(fullUrl) && !results.direct_mp4.includes(fullUrl)) {
          results.direct_mp4.push(fullUrl);
        }
      }
    }
  });

  const mp4Regex = /(https?:\/\/[^"'\s]+\.(?:mp4|webm)[^"'\s]*)/gi;
  let mp4Match;
  while ((mp4Match = mp4Regex.exec(html)) !== null) {
    const candidate = mp4Match[1].replace(/\\/g, "");
    if (!results.direct_mp4.includes(candidate) && !candidate.includes("thumb") && !candidate.includes("preview")) {
      results.direct_mp4.push(candidate);
    }
  }

  return results;
}

async function fetchViaGoogleTranslate(targetUrl) {
  const proxy = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(targetUrl)}&client=webapp`;
  const res = await fetch(proxy, {
    headers: {
      "User-Agent": BROWSER_HEADERS["User-Agent"],
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      Referer: "https://translate.google.com/"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
  const html = await res.text().catch(() => "");
  const usable = Boolean(html && html.length > 8000 && !looksLikeChallenge(html) && /<img|chapter-img|images\/data\//i.test(html));
  return { status: usable ? 200 : res.status, html, url: targetUrl, ok: usable };
}

async function fetchHtmlSmart(targetUrl) {
  const origin = new URL(targetUrl).origin;
  const attempts = [
    { ...BROWSER_HEADERS, Referer: `${origin}/` },
    {
      "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9",
      Referer: "https://www.google.com/"
    }
  ];
  let last = { status: 0, html: "", url: targetUrl, ok: false };
  for (const headers of attempts) {
    const res = await fetch(targetUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(20000)
    }).catch(() => null);
    if (!res) continue;
    const html = await res.text().catch(() => "");
    last = { status: res.status, html, url: res.url || targetUrl, ok: res.ok };
    if (res.ok && html && !looksLikeChallenge(html)) return last;
    if (html && /chapter-img|images\/data\//i.test(html) && !looksLikeChallenge(html)) return { ...last, ok: true };
  }
  const translated = await fetchViaGoogleTranslate(targetUrl).catch(() => null);
  if (translated?.ok) return translated;
  return last;
}

function extractImages(html, originUrl) {
  const $ = cheerio.load(html);
  let pageTitle = $("meta[property='og:title']").attr("content")
    || $("h1").first().text().trim()
    || $("title").text().trim()
    || "Không xác định tiêu đề";
  pageTitle = pageTitle.replace(/\s+/g, " ").trim();

  $(".sidebar, .related, .recommend, .suggest, footer, header, nav, .comments, #sidebar").remove();
  let context = $("#chapter-content, #reader-root, .reading-detail, .reader-area, .chapter-content, .reading-content, .page-chapter");
  if (context.length === 0) context = $("body");

  const rawCandidates = [];
  context.find("img").each((_, el) => {
    const elem = $(el);
    const src = imgSrcFromElement(elem);
    if (src) rawCandidates.push({ src, alt: elem.attr("alt") || "", className: elem.attr("class") || "" });
  });

  const imageList = [];
  const seen = new Set();
  const push = (raw, className = "", alt = "") => {
    const full = resolveUrl(raw, originUrl);
    if (!full || seen.has(full) || isJunkUrl(full, className, alt)) return;
    const isImage = isChapterAsset(full, className)
      || /\.(jpg|jpeg|png|webp|avif)(\?.*)?$/i.test(full)
      || full.includes("/dcn/")
      || /\/images\/data\//i.test(full);
    if (!isImage) return;
    seen.add(full);
    imageList.push(full);
  };

  for (const item of rawCandidates) push(item.src, item.className, item.alt);
  const cdn = String(html).match(/https?:\/\/[^"'\\\s]+\/images\/data\/[^"'\\\s]+\.(?:jpg|jpeg|png|webp|avif)/gi) || [];
  for (const url of cdn) push(url, "chapter-img");
  return { pageTitle, imageList };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const pathname = fullUrl.split("?")[0].toLowerCase();
  const rawQuery = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?") + 1) : "";
  const queryObj = req.query && typeof req.query === "object" ? req.query : {};
  let targetUrl = String(queryObj.url || queryObj.link || queryObj[""] || "").trim();
  if (!targetUrl && rawQuery) {
    try {
      const params = new URLSearchParams(rawQuery);
      targetUrl = String(params.get("url") || params.get("link") || "").trim();
    } catch (_) {}
    if (!targetUrl) {
      const first = decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").replace(/^url=/i, "").trim());
      targetUrl = first;
    }
  }

  // -------------------------------------------------------------
  // TRANG TÀI LIỆU CHUYÊN MỤC /downloads (ẨN TOÀN BỘ LINK GỢI Ý NHẠY CẢM)
  // -------------------------------------------------------------
  if (!targetUrl || (!fullUrl.includes("?") && (pathname === "/downloads" || pathname === "/api/downloads"))) {
    return res.status(200).json({
      chuyen_muc: "Dịch Vụ Tải & Bóc Tách Đa Phương Tiện (/downloads)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 2,
      danh_sach_tool: {
        extract_video: {
          ten_api: "Trích Xuất Link Video MP4 / M3U8 (Video Extractor)",
          duong_dan: "/downloads/video",
          phuong_thuc: "GET",
          mo_ta: "Tự động phát hiện và bóc tách luồng phát trực tiếp (HD 720p, SD 360p, HLS .m3u8, direct MP4) từ player trang web",
          cu_phap: [
            `${baseUrl}/downloads/video?={url_video}`,
            `${baseUrl}/downloads?={url_video}`
          ],
          vi_du: [
            `${baseUrl}/downloads/video?=https://example-media.com/watch?v=12345`
          ]
        },
        extract_images: {
          ten_api: "Trích Xuất Hình Ảnh Truyện Tranh / Bài Viết (Image Extractor)",
          duong_dan: "/downloads/image",
          phuong_thuc: "GET",
          mo_ta: "Bóc tách trọn bộ ảnh nội dung chương truyện hoặc bài viết, tự động lọc sạch ảnh bìa đề xuất, loader và banner quảng cáo",
          cu_phap: [
            `${baseUrl}/downloads/image?={url_website}`,
            `${baseUrl}/downloads?={url_website}`
          ],
          vi_du: [
            `${baseUrl}/downloads/image?=https://vi.wikipedia.org/wiki/Hà_Nội`
          ]
        }
      }
    });
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const isRealSocialVideo = /(?:tiktok|douyin|iesdouyin)\.com/i.test(targetUrl) && /\/(?:video|photo)\/\d{10,}/i.test(targetUrl);
    if (isRealSocialVideo && !pathname.includes("/image")) {
      const tiktok = require("./tiktok");
      try {
        const payload = await tiktok.downloadCobaltMedia(targetUrl);
        const images = [payload.anh_bia].filter(Boolean);
        return res.status(200).json({
          ...payload,
          danh_sach_anh: images,
          thong_tin_trang: { tieu_de: payload.tieu_de || "TikTok/Douyin", tong_so_anh: images.length }
        });
      } catch (_) {}
    }

    const page = await fetchHtmlSmart(targetUrl);
    const html = page.html || "";
    const finalOrigin = new URL(page.url || targetUrl).origin;
    const images = extractImages(html, finalOrigin);

    if (images.imageList.length) {
      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "image_downloader_extractor",
        thong_tin_trang: {
          tieu_de: images.pageTitle,
          tong_so_anh: images.imageList.length
        },
        danh_sach_anh: images.imageList
      });
    }

    const videoData = extractVideoStreams(html, finalOrigin);
    const hasVideoStreams = Object.keys(videoData.qualities).length > 0
      || videoData.hls_streams.length > 0
      || videoData.direct_mp4.length > 0;
    if (pathname.includes("/video") || hasVideoStreams) {
      if (!hasVideoStreams) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: "Không tìm thấy luồng phát video (MP4 / M3U8) trên liên kết này."
        });
      }
      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "video_stream_extractor",
        thong_tin_video: {
          tieu_de: videoData.title || "Video Stream",
          anh_thumbnail: videoData.thumbnail
        },
        chat_luong_video: videoData.qualities,
        luong_hls_m3u8: videoData.hls_streams,
        link_mp4_truc_tiep: videoData.direct_mp4
      });
    }

    if (!page.ok || looksLikeChallenge(html)) {
      return res.status(page.status || 403).json({
        trang_thai: "that_bai",
        thong_bao: `Không thể tải trang web (HTTP ${page.status || 403}). Trang đang chặn máy chủ; thử URL chương truyện/bài viết công khai khác.`
      });
    }

    return res.status(404).json({
      trang_thai: "that_bai",
      thong_bao: "Không tìm thấy ảnh nội dung hoặc luồng video trên liên kết này."
    });

  } catch (error) {
    const reason = /fetch failed|AbortError|timeout/i.test(String(error.message || error.name || ""))
      ? "Không tải được HTML trang (bị chặn hoặc hết thời gian). Với TikTok/Douyin hãy dùng /api/mxh/cobalt hoặc /downloads?url=link-tiktok."
      : error.message;
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: `Lỗi bóc tách: ${reason}`
    });
  }
};

module.exports.extractImages = extractImages;
module.exports.fetchHtmlSmart = fetchHtmlSmart;