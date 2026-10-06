require("./zheeProtect.js").verifyOrThrow();
const dns = require("dns").promises;
const tls = require("tls");
const https = require("https");
const beautify = require("js-beautify");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
};

// Hàm phân tích chứng chỉ SSL/TLS chi tiết
function getCertificateInfo(hostname) {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(443, hostname, { servername: hostname, timeout: 4000 }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || Object.keys(cert).length === 0) {
          return resolve({ co_ssl: false, loi: "Không lấy được chứng chỉ" });
        }
        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((validTo - now) / (1000 * 60 * 60 * 24)));

        resolve({
          co_ssl: true,
          nha_phat_hanh: cert.issuer?.O || cert.issuer?.CN || "Unknown Issuer",
          chu_the_so_huu: cert.subject?.CN || hostname,
          ngay_hieu_luc: cert.valid_from,
          ngay_het_han: cert.valid_to,
          so_ngay_con_lai: `${daysRemaining} ngày`,
          da_het_han: now > validTo,
          giao_thuc: socket.getProtocol ? socket.getProtocol() : "TLS"
        });
      });
      socket.on("error", () => resolve({ co_ssl: false, loi: "Không hỗ trợ kết nối TLS/HTTPS" }));
      socket.on("timeout", () => {
        socket.destroy();
        resolve({ co_ssl: false, loi: "Timeout khi kiểm tra SSL" });
      });
    } catch (e) {
      resolve({ co_ssl: false, loi: e.message });
    }
  });
}

// Bóc tách Metadata & Thẻ SEO từ HTML thô
function parseSeoMetadata(html, baseUrl) {
  if (!html) return null;

  const getMatch = (regex) => {
    const match = regex.exec(html);
    return match ? match[1].trim() : null;
  };

  const title = getMatch(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = getMatch(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || getMatch(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const canonical = getMatch(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const viewport = getMatch(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["']/i);
  const robots = getMatch(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  const ogTitle = getMatch(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const ogDescription = getMatch(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  const ogImage = getMatch(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
  const twitterCard = getMatch(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i);

  // Đếm số lượng thẻ Headings
  const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];
  const h3Matches = html.match(/<h3[^>]*>[\s\S]*?<\/h3>/gi) || [];

  return {
    tieu_de: title || "Chưa thiết lập",
    mo_ta_description: description || "Chưa thiết lập",
    do_dai_tieu_de: title ? title.length : 0,
    do_dai_mo_ta: description ? description.length : 0,
    the_canonical: canonical,
    the_viewport_mobile: viewport ? "Đã cấu hình" : "Thiếu thẻ Viewport",
    robots_meta: robots || "index, follow (Mặc định)",
    opengraph: {
      og_title: ogTitle,
      og_description: ogDescription,
      og_image: ogImage
    },
    twitter_card: twitterCard,
    so_luong_heading: {
      h1: h1Matches.length,
      h2: h2Matches.length,
      h3: h3Matches.length
    }
  };
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
  let target = rawQuery ? decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim()) : "";

  // -------------------------------------------------------------
  // TRANG TÀI LIỆU CHUYÊN MỤC /web
  // -------------------------------------------------------------
  if (!target || (!fullUrl.includes("?") && (pathname === "/web" || pathname === "/api/web"))) {
    return res.status(200).json({
      chuyen_muc: "Tiện Ích Quản Trị Mạng & Website Audit (/web)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 4,
      danh_sach_tool: {
        check_endpoint: {
          ten_api: "Check Endpoint / API Website (quét HTML + JS)",
          duong_dan: "/web/endpoint",
          phuong_thuc: "GET/POST",
          mo_ta: "Tìm URL API trong mã nguồn trang. Không bắt request lúc chạy như F12 Network.",
          cu_phap: [
            `${baseUrl}/web/endpoint?={url_website}`,
            `${baseUrl}/web/endpoint?url={url_website}`
          ],
          vi_du: [
            `${baseUrl}/web/endpoint?=https://vietqr.io`
          ]
        },
        check_ten_mien: {
          ten_api: "Check Tên Miền Tồn Tại (DNS + RDAP)",
          duong_dan: "/web/domain",
          phuong_thuc: "GET/POST",
          mo_ta: "Kiểm tra tên miền đã đăng ký hay còn trống qua DNS và RDAP/WHOIS.",
          cu_phap: [
            `${baseUrl}/web/domain?={ten_mien}`,
            `${baseUrl}/web/domain?domain={ten_mien}`
          ],
          vi_du: [
            `${baseUrl}/web/domain?=google.com`,
            `${baseUrl}/web/domain?=tenmienkhongtontai123xyz.com`
          ]
        },
        deep_website_checker: {
          ten_api: "Deep Website & Network Auditor (Dashboard Full Diagnostics)",
          duong_dan: "/web/check",
          phuong_thuc: "GET",
          mo_ta: "Đánh giá toàn diện website: Chấm điểm Score (Security, SEO, Network, SSL), kiểm tra Security Headers, SSL/TLS, DNS, Robots/Sitemap, Redirects, On-Page SEO và IP Geolocation.",
          cu_phap: [
            `${baseUrl}/web/check?={domain_hoac_url}`,
            `${baseUrl}/web?={domain_hoac_url}`
          ],
          vi_du: [
            `${baseUrl}/web/check?=vietqr.io`,
            `${baseUrl}/web/check?=google.com`
          ]
        },
        source_beautifier: {
          ten_api: "Bóc Tách & Làm Đẹp Mã Nguồn (HTML/CSS/JS Beautifier)",
          duong_dan: "/web/source",
          phuong_thuc: "GET",
          mo_ta: "Trích xuất tài nguyên CSS/JS và làm đẹp mã nguồn HTML",
          cu_phap: `${baseUrl}/web/source?={url_website}`,
          vi_du: `${baseUrl}/web/source?=https://vietqr.io`
        }
      }
    });
  }

  // =============================================================
  // 1. TOOL BEAUTIFY SOURCE CODE (/web/source)
  // =============================================================
  if (pathname.includes("/source")) {
    let targetUrl = target.startsWith("http://") || target.startsWith("https://") ? target : `https://${target}`;
    try {
      const response = await fetch(targetUrl, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(10000) });
      const rawHtml = await response.text();
      const originUrl = new URL(response.url);

      const beautifiedHtml = beautify.html(rawHtml, { indent_size: 2 });
      const cssLinks = [...rawHtml.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)].map(m => new URL(m[1], originUrl.origin).href);
      const jsScripts = [...rawHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => new URL(m[1], originUrl.origin).href);

      return res.status(200).json({
        trang_thai: "thanh_cong",
        website_goc: targetUrl,
        kich_thuoc_html: `${(rawHtml.length / 1024).toFixed(2)} KB`,
        tai_nguyen: { css: [...new Set(cssLinks)], js: [...new Set(jsScripts)] },
        ma_nguon_html_da_lam_dep: beautifiedHtml
      });
    } catch (err) {
      return res.status(500).json({ trang_thai: "that_bai", thong_bao: err.message });
    }
  }

  // =============================================================
  // 2. DEEP WEBSITE & NETWORK AUDITOR (/web/check hoặc /web)
  // =============================================================
  let cleanDomain = target
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .trim();

  if (!cleanDomain) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập tên miền hoặc URL hợp lệ."
    });
  }

  try {
    const targetHttpsUrl = `https://${cleanDomain}`;
    const targetHttpUrl = `http://${cleanDomain}`;

    // 1. Gửi request và đo độ trễ TTFB / Response time
    let fetchStart = Date.now();
    let response = null;
    let redirectChain = [];
    let isHttpsEnforced = false;
    let rawHtml = "";

    try {
      response = await fetch(targetHttpsUrl, {
        headers: BROWSER_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(7000)
      });
      isHttpsEnforced = true;
      rawHtml = await response.text();
    } catch (e) {
      try {
        fetchStart = Date.now();
        response = await fetch(targetHttpUrl, {
          headers: BROWSER_HEADERS,
          redirect: "follow",
          signal: AbortSignal.timeout(7000)
        });
        rawHtml = await response.text();
      } catch (err) {}
    }

    const responseTimeMs = response ? Date.now() - fetchStart : null;
    const finalUrl = response?.url || targetHttpsUrl;
    const headers = response?.headers || new Map();

    // 2. Chạy đồng thời các tác vụ kiểm tra Network, DNS, SSL, Robots/Sitemap
    const [certInfo, dnsRecords, robotsCheck, sitemapCheck] = await Promise.all([
      getCertificateInfo(cleanDomain),
      (async () => {
        const [a, aaaa, mx, ns, txt, cname] = await Promise.all([
          dns.resolve4(cleanDomain).catch(() => []),
          dns.resolve6(cleanDomain).catch(() => []),
          dns.resolveMx(cleanDomain).catch(() => []),
          dns.resolveNs(cleanDomain).catch(() => []),
          dns.resolveTxt(cleanDomain).catch(() => []),
          dns.resolveCname(cleanDomain).catch(() => [])
        ]);
        let ptr = [];
        if (a[0]) {
          ptr = await dns.reverse(a[0]).catch(() => []);
        }
        return { a, aaaa, mx, ns, txt: txt.flat(), cname, ptr };
      })(),
      fetch(`${targetHttpsUrl}/robots.txt`, { method: "HEAD", signal: AbortSignal.timeout(3000) })
        .then(r => r.ok).catch(() => false),
      fetch(`${targetHttpsUrl}/sitemap.xml`, { method: "HEAD", signal: AbortSignal.timeout(3000) })
        .then(r => r.ok).catch(() => false)
    ]);

    // 3. Tra cứu IP Geolocation & ASN
    const primaryIp = dnsRecords.a[0] || (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanDomain) ? cleanDomain : null);
    let ipInfo = null;
    if (primaryIp) {
      try {
        const ipRes = await fetch(`http://ip-api.com/json/${primaryIp}?fields=status,country,countryCode,regionName,city,lat,lon,timezone,isp,org,as,query`);
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.status === "success") {
            ipInfo = {
              ip_chinh: ipData.query,
              quoc_gia: `${ipData.country} (${ipData.countryCode})`,
              thanh_pho: ipData.city,
              toa_do: `${ipData.lat}, ${ipData.lon}`,
              mui_gio: ipData.timezone,
              isp: ipData.isp,
              to_chuc: ipData.org,
              asn: ipData.as
            };
          }
        }
      } catch (e) {}
    }

    // 4. Phân tích Security Headers
    const hsts = headers.get("strict-transport-security");
    const csp = headers.get("content-security-policy");
    const xFrame = headers.get("x-frame-options");
    const xContentType = headers.get("x-content-type-options");
    const referrerPolicy = headers.get("referrer-policy");
    const permissionsPolicy = headers.get("permissions-policy") || headers.get("feature-policy");
    const corsHeader = headers.get("access-control-allow-origin");
    const serverHeader = headers.get("server") || "Hidden / Cloudflare";

    const securityHeaders = {
      hsts: { bat_buoc_https: !!hsts, gia_tri: hsts || "Chưa cấu hình" },
      csp: { chong_xss_injection: !!csp, gia_tri: csp || "Chưa cấu hình" },
      x_frame_options: { chong_clickjacking: !!xFrame, gia_tri: xFrame || "Chưa cấu hình" },
      x_content_type_options: { chong_sniffing: !!xContentType, gia_tri: xContentType || "Chưa cấu hình" },
      referrer_policy: { bao_ve_referrer: !!referrerPolicy, gia_tri: referrerPolicy || "Chưa cấu hình" },
      permissions_policy: { kiem_soat_quyen_api: !!permissionsPolicy, gia_tri: permissionsPolicy || "Chưa cấu hình" },
      cors_access_control: corsHeader || "Mặc định (Same-Origin)"
    };

    // 5. Phân tích SEO On-Page
    const seoData = parseSeoMetadata(rawHtml, cleanDomain);

    // 6. THUẬT TOÁN TÍNH ĐIỂM DASHBOARD (AUDIT SCORING 0 - 100)
    let securityScore = 40;
    if (certInfo.co_ssl && !certInfo.da_het_han) securityScore += 20;
    if (hsts) securityScore += 10;
    if (csp) securityScore += 10;
    if (xFrame) securityScore += 10;
    if (xContentType) securityScore += 10;

    let seoScore = 30;
    if (seoData?.tieu_de && seoData.tieu_de !== "Chưa thiết lập") seoScore += 20;
    if (seoData?.mo_ta_description && seoData.mo_ta_description !== "Chưa thiết lập") seoScore += 20;
    if (robotsCheck) seoScore += 15;
    if (sitemapCheck) seoScore += 15;

    let networkScore = 50;
    if (response?.ok) networkScore += 20;
    if (responseTimeMs && responseTimeMs < 800) networkScore += 20;
    if (dnsRecords.a.length > 0) networkScore += 10;

    const overallScore = Math.round((securityScore + seoScore + networkScore) / 3);

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "deep_website_audit",
      ten_mien: cleanDomain,
      thoi_gian_kiem_tra: new Date().toLocaleString("vi-VN"),
      
      // BẢNG ĐIỂM CHUẨN DASHBOARD
      bang_diem_danh_gia: {
        tong_diem_he_thong: overallScore,
        diem_bao_mat_security: securityScore,
        diem_toi_uu_seo: seoScore,
        diem_mang_hieu_nang: networkScore,
        xep_hang: overallScore >= 85 ? "A+ (Rất Tốt)" : overallScore >= 70 ? "B (Khá)" : "C (Cần Cải Thiện)"
      },

      // 1. TỔNG QUAN WEBSITE & PERFORMANCE
      tong_quan_website: {
        url_kiem_tra: finalUrl,
        ma_trang_thai_http: response ? response.status : "Offline",
        hoat_dong: response?.ok ? "Online" : "Cảnh báo / Offline",
        thoi_gian_phan_hoi_ttfb: responseTimeMs ? `${responseTimeMs} ms` : "Timeout",
        danh_gia_toc_do: responseTimeMs < 400 ? "Siêu Nhanh (<400ms)" : responseTimeMs < 1000 ? "Bình Thường" : "Chậm",
        may_chu_server: serverHeader,
        chuyen_huong_https: isHttpsEnforced ? "Tự động kích hoạt HTTPS" : "Không có"
      },

      // 2. CHỨNG CHỈ BẢO MẬT SSL/TLS
      chung_chi_ssl_tls: certInfo,

      // 3. SECURITY HEADERS & PERMISSIONS
      bao_mat_security_headers: securityHeaders,

      // 4. ON-PAGE SEO & CẤU HÌNH WEB
      toi_uu_seo_onpage: {
        ...seoData,
        file_robots_txt: robotsCheck ? "Đã có (/robots.txt)" : "Chưa cấu hình",
        file_sitemap_xml: sitemapCheck ? "Đã có (/sitemap.xml)" : "Chưa cấu hình"
      },

      // 5. BẢN GHI DNS ĐẦY ĐỦ
      ban_ghi_dns: {
        a_ipv4: dnsRecords.a,
        aaaa_ipv6: dnsRecords.aaaa,
        mx_mail: dnsRecords.mx.map(m => `${m.exchange} (Priority: ${m.priority})`),
        ns_nameservers: dnsRecords.ns,
        txt_records: dnsRecords.txt,
        cname: dnsRecords.cname,
        reverse_dns_ptr: dnsRecords.ptr
      },

      // 6. THÔNG TIN MÁY CHỦ & VỊ TRÍ ĐỊA LÝ IP
      thong_tin_may_chu_ip: ipInfo || { ip: primaryIp || "Không xác định" }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};