const cheerio = require("cheerio");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
};

// Danh sách từ khóa nhận diện quảng cáo, logo, icon, banner để lọc bỏ
const JUNK_KEYWORDS = [
  "logo", "icon", "favicon", "avatar", "badge",
  "banner-ad", "ad-banner", "ads", "advert", "sponsor",
  "tracking", "pixel", "counter", "analytics", "stat",
  "googleads", "doubleclick", "admicro", "eclick", "adflex",
  "fb-share", "button", "widget", "placeholder", "blank.gif"
];

function isJunkUrl(urlStr, className = "", altText = "") {
  const combined = `${urlStr} ${className} ${altText}`.toLowerCase();
  
  // Bỏ định dạng SVG/Data URI quá ngắn/Tracking
  if (urlStr.startsWith("data:image/svg") || urlStr.endsWith(".svg")) return true;
  if (urlStr.includes("1x1") || urlStr.includes("spacer")) return true;

  // Kiểm tra từ khóa rác
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

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 1: TÀI LIỆU CHUYÊN MỤC /downloads
  // -------------------------------------------------------------
  if (!targetUrl || (!fullUrl.includes("?") && (fullUrl === "/downloads" || fullUrl === "/api/downloads"))) {
    return res.status(200).json({
      chuyen_muc: "Dịch Vụ Tải & Bóc Tách Đa Phương Tiện (/downloads)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 1,
      danh_sach_tool: {
        extract_images: {
          ten_api: "Trích Xuất Hình Ảnh & Tiêu Đề Bài Viết / Truyện Tranh (Image Extractor)",
          duong_dan: "/downloads/image",
          phuong_thuc: "GET",
          mo_ta: "Tự động phân tích trang web (truyện tranh, báo chí, blog), lấy tiêu đề chính và toàn bộ link ảnh chất lượng cao (JPG, PNG, WEBP), tự động lọc bỏ logo, favicon và banner quảng cáo.",
          cu_phap: [
            `${baseUrl}/downloads?={url_website}`,
            `${baseUrl}/downloads/image?={url_website}`,
            `${baseUrl}/downloads?url={url_website}`
          ],
          vi_du: [
            `${baseUrl}/downloads?=https://truyentranh.../chap-1`,
            `${baseUrl}/downloads/image?=https://vnexpress.net/...`
          ]
        }
      }
    });
  }

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 2: BÓC TÁCH TIÊU ĐỀ VÀ HÌNH ẢNH
  // -------------------------------------------------------------
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
        thong_bao: `Không thể kết nối đến trang web. Mã phản hồi: ${response.status}`
      });
    }

    const html = await response.text();
    const finalOrigin = new URL(response.url).origin;
    const $ = cheerio.load(html);

    // 1. Lấy Tiêu Đề Trang / Tiêu Đề Truyện / Bài Viết
    let pageTitle = $("meta[property='og:title']").attr("content")
      || $("h1").first().text().trim()
      || $("title").text().trim()
      || "Không xác định tiêu đề";

    pageTitle = pageTitle.replace(/\s+/g, " ").trim();

    // 2. Thu thập ảnh qua nhiều phương thức
    const rawImageCandidates = [];

    // Cách A: Quét tất cả thẻ <img> (xử lý mọi kiểu lazy load phổ biến)
    $("img").each((_, el) => {
      const elem = $(el);
      const src = elem.attr("data-src")
        || elem.attr("data-original")
        || elem.attr("data-lazy-src")
        || elem.attr("data-url")
        || elem.attr("src")
        || elem.attr("data-srcset");
      const alt = elem.attr("alt") || "";
      const className = elem.attr("class") || "";

      if (src) {
        rawImageCandidates.push({ src, alt, className });
      }
    });

    // Cách B: Quét thẻ <picture> và <source>
    $("picture source").each((_, el) => {
      const srcset = $(el).attr("srcset") || $(el).attr("data-srcset");
      if (srcset) {
        const firstSrc = srcset.split(",")[0].trim().split(" ")[0];
        rawImageCandidates.push({ src: firstSrc, alt: "", className: "" });
      }
    });

    // Cách C: Quét ảnh nền CSS Inline (background-image)
    $("[style*='background']").each((_, el) => {
      const style = $(el).attr("style") || "";
      const bgMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/i);
      if (bgMatch && bgMatch[1]) {
        rawImageCandidates.push({ src: bgMatch[1], alt: "", className: $(el).attr("class") || "" });
      }
    });

    // 3. Chuẩn hóa URL, Lọc rác / Banner / Logo và Loại bỏ trùng lặp
    const imageList = [];
    const seenUrls = new Set();

    for (const item of rawImageCandidates) {
      const fullImageUrl = resolveUrl(item.src, finalOrigin);
      if (!fullImageUrl) continue;

      // Bỏ qua nếu là file rác/banner/logo
      if (isJunkUrl(fullImageUrl, item.className, item.alt)) continue;

      // Chỉ nhận các định dạng ảnh phổ biến hoặc URL có hình ảnh hợp lệ
      const isImageExtension = /\.(jpg|jpeg|png|webp|gif|avif|bmp)(\?.*)?$/i.test(fullImageUrl);
      const isDynamicImage = fullImageUrl.includes("image") || fullImageUrl.includes("photo") || fullImageUrl.includes("picture") || fullImageUrl.includes("cdn");

      if ((isImageExtension || isDynamicImage) && !seenUrls.has(fullImageUrl)) {
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
        tong_so_anh_lay_duoc: imageList.length
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