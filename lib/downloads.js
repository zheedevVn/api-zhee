const cheerio = require("cheerio");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
};

const JUNK_KEYWORDS = [
  "covers", "cover", "thumb", "thumbnail", "related", "recommend", "sidebar",
  "logo", "icon", "favicon", "avatar", "badge", "banner", "ad-", "ads",
  "sponsor", "tracking", "pixel", "counter", "googleads", "doubleclick"
];

function isJunkUrl(urlStr, className = "", altText = "") {
  const combined = `${urlStr} ${className} ${altText}`.toLowerCase();
  if (urlStr.startsWith("data:image/svg") || urlStr.endsWith(".svg")) return true;
  if (urlStr.includes("1x1") || urlStr.includes("spacer")) return true;
  for (const kw of JUNK_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  return false;
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

// Hàm phân tích và bóc tách luồng video từ HTML & Javascript Player
function extractVideoStreams(html, originUrl) {
  const results = {
    title: null,
    duration: null,
    thumbnail: null,
    qualities: {},
    hls_streams: [],
    direct_mp4: []
  };

  // 1. Tiêu đề video
  const titleMatch = html.match(/html5player\.setVideoTitle\(['"](.*?)['"]\)/i)
    || html.match(/<meta property=["']og:title["'] content=["'](.*?)["']/i)
    || html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) results.title = titleMatch[1].replace(/\\'/g, "'").trim();

  // 2. Thumbnail video
  const thumbMatch = html.match(/html5player\.setThumbUrl\(['"](.*?)['"]\)/i)
    || html.match(/html5player\.setThumbUrl169\(['"](.*?)['"]\)/i)
    || html.match(/<meta property=["']og:image["'] content=["'](.*?)["']/i);
  if (thumbMatch) results.thumbnail = thumbMatch[1];

  // 3. Luồng chất lượng cao / thấp từ Flash & HTML5 player variables (setVideoUrlLow / High)
  const lowMatch = html.match(/html5player\.setVideoUrlLow\(['"](.*?)['"]\)/i)
    || html.match(/setVideoUrlLow\(['"](.*?)['"]\)/i);
  if (lowMatch && lowMatch[1]) {
    results.qualities.sd_360p = lowMatch[1];
  }

  const highMatch = html.match(/html5player\.setVideoUrlHigh\(['"](.*?)['"]\)/i)
    || html.match(/setVideoUrlHigh\(['"](.*?)['"]\)/i);
  if (highMatch && highMatch[1]) {
    results.qualities.hd_720p = highMatch[1];
  }

  // 4. Luồng HLS M3U8
  const hlsMatch = html.match(/html5player\.setVideoHLS\(['"](.*?)['"]\)/i)
    || html.match(/setVideoHLS\(['"](.*?)['"]\)/i)
    || html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
  if (hlsMatch && hlsMatch[1]) {
    results.hls_streams.push(hlsMatch[1]);
  }

  // 5. Quét qua thẻ <video> và <source>
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

  // 6. Quét các URL MP4 trong mã nguồn script
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

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const pathname = fullUrl.split("?")[0].toLowerCase();
  const rawQuery = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?") + 1) : "";
  let targetUrl = rawQuery ? decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim()) : "";

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 1: TÀI LIỆU CHUYÊN MỤC /downloads
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
          mo_ta: "Bóc tách luồng phát trực tiếp (HD 720p, SD 360p, HLS .m3u8, direct MP4) từ link bài viết hoặc player trang web.",
          cu_phap: [
            `${baseUrl}/downloads/video?={url_video}`,
            `${baseUrl}/downloads/video?url={url_video}`
          ],
          vi_du: [
            `${baseUrl}/downloads/video?=https://www.xvideos.com/video...`,
            `${baseUrl}/downloads/video?=https://example.com/watch-video`
          ]
        },
        extract_images: {
          ten_api: "Trích Xuất Hình Ảnh Truyện Tranh / Bài Viết (Image Extractor)",
          duong_dan: "/downloads/image",
          phuong_thuc: "GET",
          mo_ta: "Bóc tách trọn bộ ảnh nội dung chương truyện, lọc sạch ảnh bìa và banner quảng cáo.",
          cu_phap: [
            `${baseUrl}/downloads/image?={url_website}`,
            `${baseUrl}/downloads?={url_website}`
          ],
          vi_du: [
            `${baseUrl}/downloads/image?=https://truyentranh.../chap-1`
          ]
        }
      }
    });
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return res.status(response.status).json({
        trang_thai: "that_bai",
        thong_bao: `Không thể tải trang web. Mã lỗi HTTP: ${response.status}`
      });
    }

    const html = await response.text();
    const finalOrigin = new URL(response.url).origin;

    // =============================================================
    // CHẾ ĐỘ 1: BÓC TÁCH VIDEO (/downloads/video)
    // =============================================================
    if (pathname.includes("/video")) {
      const videoData = extractVideoStreams(html, finalOrigin);
      const hasStreams = Object.keys(videoData.qualities).length > 0 
        || videoData.hls_streams.length > 0 
        || videoData.direct_mp4.length > 0;

      if (!hasStreams) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: "Không tìm thấy luồng video phát (MP4 / M3U8) trên trang web này.",
          url_goc: targetUrl
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "video_stream_extractor",
        thong_tin_video: {
          url_goc: targetUrl,
          url_chuyen_huong: response.url,
          tieu_de: videoData.title || "Video không có tiêu đề",
          anh_thumbnail: videoData.thumbnail
        },
        chat_luong_video: videoData.qualities,
        luong_hls_m3u8: videoData.hls_streams,
        link_mp4_truc_tiep: videoData.direct_mp4
      });
    }

    // =============================================================
    // CHẾ ĐỘ 2: BÓC TÁCH HÌNH ẢNH (/downloads hoặc /downloads/image)
    // =============================================================
    const $ = cheerio.load(html);
    let pageTitle = $("meta[property='og:title']").attr("content")
      || $("h1").first().text().trim()
      || $("title").text().trim()
      || "Không xác định tiêu đề";
    pageTitle = pageTitle.replace(/\s+/g, " ").trim();

    $(".sidebar, .related, .recommend, .suggest, footer, header, nav, .comments, #sidebar").remove();

    let context = $("#chapter-content, .reading-detail, .reader-area, .chapter-content, .reading-content, .page-chapter");
    if (context.length === 0) {
      context = $("body");
    }

    const rawCandidates = [];
    context.find("img").each((_, el) => {
      const elem = $(el);
      const src = elem.attr("data-src")
        || elem.attr("data-original")
        || elem.attr("data-lazy-src")
        || elem.attr("data-url")
        || elem.attr("src")
        || elem.attr("data-srcset");
      const alt = elem.attr("alt") || "";
      const className = elem.attr("class") || "";
      if (src) rawCandidates.push({ src, alt, className });
    });

    const imageList = [];
    const seenUrls = new Set();

    for (const item of rawCandidates) {
      const fullImageUrl = resolveUrl(item.src, finalOrigin);
      if (!fullImageUrl) continue;
      if (isJunkUrl(fullImageUrl, item.className, item.alt)) continue;

      const isImage = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i.test(fullImageUrl) || fullImageUrl.includes("/dcn/");
      if (isImage && !seenUrls.has(fullImageUrl)) {
        seenUrls.add(fullImageUrl);
        imageList.push(fullImageUrl);
      }
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "image_downloader_extractor",
      thong_tin_trang: {
        url_goc: targetUrl,
        url_thuc_te: response.url,
        tieu_de: pageTitle,
        tong_so_anh: imageList.length
      },
      danh_sach_anh: imageList
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: `Lỗi bóc tách media: ${error.message}`
    });
  }
};