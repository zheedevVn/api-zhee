const cheerio = require("cheerio");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
};

// Từ khóa loại bỏ hoàn toàn ảnh bìa truyện khác, sidebar, avatar, quảng cáo
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

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const rawQuery = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?") + 1) : "";
  let targetUrl = rawQuery ? decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim()) : "";

  // 1. Tài liệu chuyên mục /downloads
  if (!targetUrl || (!fullUrl.includes("?") && (fullUrl === "/downloads" || fullUrl === "/api/downloads"))) {
    return res.status(200).json({
      chuyen_muc: "Dịch Vụ Tải & Bóc Tách Đa Phương Tiện (/downloads)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 1,
      danh_sach_tool: {
        extract_images: {
          ten_api: "Trích Xuất Hình Ảnh Truyện Tranh / Bài Viết (Image Extractor)",
          duong_dan: "/downloads/image",
          phuong_thuc: "GET",
          mo_ta: "Bóc tách tiêu đề và trọn bộ ảnh nội dung của chương truyện tranh, lọc sạch ảnh bìa đề xuất và banner quảng cáo.",
          cu_phap: [
            `${baseUrl}/downloads?={url_website}`,
            `${baseUrl}/downloads/image?={url_website}`
          ],
          vi_du: [
            `${baseUrl}/downloads?=https://sayhentai.../chap-1`
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
        thong_bao: `Không thể tải trang web. Mã lỗi: ${response.status}`
      });
    }

    const html = await response.text();
    const finalOrigin = new URL(response.url).origin;
    const $ = cheerio.load(html);

    // Bóc tách tiêu đề
    let pageTitle = $("meta[property='og:title']").attr("content")
      || $("h1").first().text().trim()
      || $("title").text().trim()
      || "Không xác định tiêu đề";
    pageTitle = pageTitle.replace(/\s+/g, " ").trim();

    // Loại bỏ các khối truyện gợi ý, sidebar, footer trước khi quét
    $(".sidebar, .related, .recommend, .suggest, footer, header, nav, .comments, #sidebar").remove();

    // Ưu tiên quét khung đọc truyện (reader container) nếu có
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

    context.find("picture source").each((_, el) => {
      const srcset = $(el).attr("srcset") || $(el).attr("data-srcset");
      if (srcset) {
        const firstSrc = srcset.split(",")[0].trim().split(" ")[0];
        rawCandidates.push({ src: firstSrc, alt: "", className: "" });
      }
    });

    const imageList = [];
    const seenUrls = new Set();

    for (const item of rawCandidates) {
      const fullImageUrl = resolveUrl(item.src, finalOrigin);
      if (!fullImageUrl) continue;

      // Lọc bỏ file rác, bìa truyện khác (/covers/), icon
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
      thong_bao: `Lỗi bóc tách ảnh: ${error.message}`
    });
  }
};