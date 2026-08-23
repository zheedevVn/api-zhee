const dns = require("dns").promises;

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const isCheck = fullUrl.includes("/check") || req.query.action === "check";

  let target = req.query.host || req.query.domain || req.query.url || req.query.ip || req.query[""] || "";

  if (fullUrl.includes("?")) {
    const rawQuery = fullUrl.substring(fullUrl.indexOf("?") + 1);
    target = decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim());
  }

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 1: TRANG TÀI LIỆU CHUYÊN MỤC /web
  // -------------------------------------------------------------
  if (!isCheck && (!target || !fullUrl.includes("?") || fullUrl.endsWith("/web"))) {
    return res.status(200).json({
      chuyen_muc: "Tiện Ích Quản Trị Mạng & Website (/web)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 1,
      danh_sach_tool: {
        check: {
          ten_api: "Tra cứu Toàn Diện Website / DNS / IP / CheckHost",
          duong_dan: "/web/check",
          phuong_thuc: "GET",
          mo_ta: "Kiểm tra tình trạng máy chủ, SSL, tốc độ phản hồi (ms), bản ghi DNS (A, AAAA, MX, NS, TXT) và vị trí địa lý IP/ISP",
          cu_phap: [
            `${baseUrl}/web/check?={ten_mien_hoac_ip}`,
            `${baseUrl}/web/check?url={ten_mien_hoac_ip}`
          ],
          vi_du: [
            `${baseUrl}/web/check?=google.com`,
            `${baseUrl}/web/check?=1.1.1.1`,
            `${baseUrl}/web/check?=vietqr.io`
          ]
        }
      }
    });
  }

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 2: XỬ LÝ TRA CỨU WEBSITE, DNS, IP
  // -------------------------------------------------------------
  let cleanDomain = target
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .trim();

  if (!cleanDomain) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập tên miền (domain) hoặc địa chỉ IP hợp lệ.",
      cu_phap: `${baseUrl}/web/check?={ten_mien_hoac_ip}`
    });
  }

  try {
    let httpStatus = null;
    let responseTimeMs = null;
    let sslValid = false;
    let serverHeader = "Không rõ";

    // 1. Kiểm tra HTTP / SSL / Độ trễ
    try {
      const fetchStart = Date.now();
      const webRes = await fetch(`https://${cleanDomain}`, {
        method: "HEAD",
        headers: { "User-Agent": "Zhee-Web-Scanner/1.0" },
        signal: AbortSignal.timeout(5000)
      }).catch(async () => {
        return await fetch(`http://${cleanDomain}`, {
          method: "HEAD",
          headers: { "User-Agent": "Zhee-Web-Scanner/1.0" },
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

    // 2. Tra cứu DNS Records
    const [aRecords, aaaaRecords, mxRecords, nsRecords, txtRecords] = await Promise.all([
      dns.resolve4(cleanDomain).catch(() => []),
      dns.resolve6(cleanDomain).catch(() => []),
      dns.resolveMx(cleanDomain).catch(() => []),
      dns.resolveNs(cleanDomain).catch(() => []),
      dns.resolveTxt(cleanDomain).catch(() => [])
    ]);

    const primaryIp = aRecords[0] || (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanDomain) ? cleanDomain : null);

    // 3. Tra cứu IP Geolocation & ASN
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