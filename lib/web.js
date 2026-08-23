const dns = require("dns").promises;
const beautify = require("js-beautify");

// Cấu hình Header giả lập trình duyệt Chrome mới nhất để bypass các bộ chặn bot/DevTools
const REAL_BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
};

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const pathname = fullUrl.split("?")[0].toLowerCase();
  const rawQuery = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?") + 1) : "";
  let target = rawQuery ? decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim()) : "";

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 1: TRANG TÀI LIỆU CHUYÊN MỤC /web
  // -------------------------------------------------------------
  if (!target || (!fullUrl.includes("?") && (pathname === "/web" || pathname === "/api/web"))) {
    return res.status(200).json({
      chuyen_muc: "Tiện Ích Quản Trị Mạng & Website (/web)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 2,
      danh_sach_tool: {
        view_source_beautify: {
          ten_api: "Bóc Tách & Làm Đẹp Mã Nguồn (HTML / CSS / JS Source Viewer)",
          duong_dan: "/web/source",
          phuong_thuc: "GET",
          mo_ta: "Trích xuất toàn bộ mã nguồn HTML, danh sách file CSS, file JS kèm nội dung đã được Beautify/Format chuẩn đẹp mắt",
          cu_phap: [
            `${baseUrl}/web/source?={url_website}`,
            `${baseUrl}/web/source?url={url_website}`
          ],
          vi_du: [
            `${baseUrl}/web/source?=https://vietqr.io`,
            `${baseUrl}/web/source?=google.com`
          ]
        },
        check_host_dns_ip: {
          ten_api: "Tra Cứu Host / DNS / SSL / IP Geolocation",
          duong_dan: "/web/check",
          phuong_thuc: "GET",
          mo_ta: "Kiểm tra tình trạng máy chủ, SSL, tốc độ phản hồi (ms), DNS Records (A, AAAA, MX, NS, TXT) và vị trí địa lý IP/ISP",
          cu_phap: [
            `${baseUrl}/web/check?={domain_hoac_ip}`,
            `${baseUrl}/web?={domain_hoac_ip}`
          ],
          vi_du: [
            `${baseUrl}/web/check?=google.com`,
            `${baseUrl}/web/check?=1.1.1.1`
          ]
        }
      }
    });
  }

  // =============================================================
  // TOOL 1: BÓC TÁCH & BEAUTIFY HTML / CSS / JS (/web/source)
  // =============================================================
  if (pathname.includes("/source")) {
    let targetUrl = target.startsWith("http://") || target.startsWith("https://") ? target : `https://${target}`;

    try {
      const response = await fetch(targetUrl, {
        headers: REAL_BROWSER_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return res.status(response.status).json({
          trang_thai: "that_bai",
          thong_bao: `Không thể tải trang web. Mã lỗi HTTP: ${response.status}`
        });
      }

      const rawHtml = await response.text();
      const originUrl = new URL(response.url);

      // Làm đẹp toàn bộ mã HTML kèm CSS/JS inline bên trong
      const beautifiedHtml = beautify.html(rawHtml, {
        indent_size: 2,
        space_in_empty_paren: true,
        extra_liners: [],
        end_with_newline: true
      });

      // Bóc tách danh sách file CSS ngoài
      const cssLinks = [];
      const cssRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi;
      let cssMatch;
      while ((cssMatch = cssRegex.exec(rawHtml)) !== null) {
        try {
          const absoluteCss = new URL(cssMatch[1], originUrl.origin).href;
          if (!cssLinks.includes(absoluteCss)) cssLinks.push(absoluteCss);
        } catch (e) {}
      }

      // Bóc tách danh sách file Script JS ngoài
      const jsScripts = [];
      const jsRegex = /<script[^>]+src=["']([^"']+)["']/gi;
      let jsMatch;
      while ((jsMatch = jsRegex.exec(rawHtml)) !== null) {
        try {
          const absoluteJs = new URL(jsMatch[1], originUrl.origin).href;
          if (!jsScripts.includes(absoluteJs)) jsScripts.push(absoluteJs);
        } catch (e) {}
      }

      // Bóc tách các đoạn JS Inline
      const inlineScripts = [];
      const inlineJsRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
      let inlineMatch;
      while ((inlineMatch = inlineJsRegex.exec(rawHtml)) !== null) {
        const scriptBody = inlineMatch[1].trim();
        if (scriptBody.length > 0) {
          inlineScripts.push(beautify.js(scriptBody, { indent_size: 2 }));
        }
      }

      // Bóc tách các đoạn CSS Inline
      const inlineStyles = [];
      const inlineCssRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
      let styleMatch;
      while ((styleMatch = inlineCssRegex.exec(rawHtml)) !== null) {
        const styleBody = styleMatch[1].trim();
        if (styleBody.length > 0) {
          inlineStyles.push(beautify.css(styleBody, { indent_size: 2 }));
        }
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "web_source_beautifier",
        website_goc: targetUrl,
        url_chuyen_huong_thuc_te: response.url,
        thong_ke: {
          kich_thuoc_html_goc: `${(rawHtml.length / 1024).toFixed(2)} KB`,
          so_file_css_ngoai: cssLinks.length,
          so_file_js_ngoai: jsScripts.length,
          so_doan_inline_js: inlineScripts.length,
          so_doan_inline_css: inlineStyles.length
        },
        tai_nguyen_lien_ket: {
          danh_sach_css: cssLinks,
          danh_sach_js: jsScripts
        },
        ma_nguon_html_da_lam_dep: beautifiedHtml,
        ma_nguon_inline_js: inlineScripts,
        ma_nguon_inline_css: inlineStyles
      });

    } catch (err) {
      return res.status(500).json({
        trang_thai: "that_bai",
        thong_bao: `Lỗi phân tích mã nguồn website: ${err.message}`
      });
    }
  }

  // =============================================================
  // TOOL 2: CHECK WEBSITE, HOST, SSL, DNS & IP GEOLOCATION
  // =============================================================
  let cleanDomain = target
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .trim();

  if (!cleanDomain) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập tên miền hoặc địa chỉ IP hợp lệ.",
      cu_phap: `${baseUrl}/web/check?={ten_mien_hoac_ip}`
    });
  }

  try {
    let httpStatus = null;
    let responseTimeMs = null;
    let sslValid = false;
    let serverHeader = "Không rõ";

    try {
      const fetchStart = Date.now();
      const webRes = await fetch(`https://${cleanDomain}`, {
        method: "HEAD",
        headers: REAL_BROWSER_HEADERS,
        signal: AbortSignal.timeout(5000)
      }).catch(async () => {
        return await fetch(`http://${cleanDomain}`, {
          method: "HEAD",
          headers: REAL_BROWSER_HEADERS,
          signal: AbortSignal.timeout(5000)
        });
      });

      responseTimeMs = `${Date.now() - fetchStart} ms`;
      if (webRes) {
        httpStatus = webRes.status;
        serverHeader = webRes.headers.get("server") || "Ẩn (Hidden/Cloudflare)";
        sslValid = webRes.url.startsWith("https://");
      }
    } catch (e) {
      httpStatus = "Không thể kết nối (Offline hoặc Chặn Ping)";
    }

    const [aRecords, aaaaRecords, mxRecords, nsRecords, txtRecords] = await Promise.all([
      dns.resolve4(cleanDomain).catch(() => []),
      dns.resolve6(cleanDomain).catch(() => []),
      dns.resolveMx(cleanDomain).catch(() => []),
      dns.resolveNs(cleanDomain).catch(() => []),
      dns.resolveTxt(cleanDomain).catch(() => [])
    ]);

    const primaryIp = aRecords[0] || (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanDomain) ? cleanDomain : null);

    let ipInfo = null;
    if (primaryIp) {
      try {
        const ipRes = await fetch(`http://ip-api.com/json/${primaryIp}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.status === "success") {
            ipInfo = {
              ip_chinh: ipData.query,
              quoc_gia: `${ipData.country} (${ipData.countryCode})`,
              khu_vuc: `${ipData.city}, ${ipData.regionName}`,
              toa_do: `${ipData.lat}, ${ipData.lon}`,
              mui_gio: ipData.timezone,
              nha_cung_cap_isp: ipData.isp,
              to_chuc: ipData.org,
              ma_asn: ipData.as
            };
          }
        }
      } catch (e) {}
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "check_website_dns_ip",
      thoi_gian_kiem_tra: new Date().toLocaleString("vi-VN"),
      thong_tin_website: {
        ten_mien: cleanDomain,
        ma_trang_thai_http: httpStatus,
        hoat_dong: typeof httpStatus === "number" && httpStatus >= 200 && httpStatus < 400 ? "Online" : "Cảnh báo / Gián đoạn",
        chung_chi_ssl: sslValid ? "Có (HTTPS Enabled)" : "Không có (HTTP)",
        may_chu_server: serverHeader,
        toc_do_phan_hoi: responseTimeMs || "Timeout"
      },
      thong_tin_may_chu_ip: ipInfo || {
        ip_chinh: primaryIp || "Không xác định",
        thong_bao: "Không tìm thấy dữ liệu vị trí máy chủ"
      },
      ban_ghi_dns: {
        a_ipv4: aRecords,
        aaaa_ipv6: aaaaRecords,
        mx_mail: mxRecords.map(m => `${m.exchange} (Priority: ${m.priority})`),
        ns_nameservers: nsRecords,
        txt: txtRecords.flat()
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};