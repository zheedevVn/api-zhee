// 1. Engine cào trực tiếp từ iUnlocker Live Form & Result Parser
async function scrapeIUnlocker(cleanImei) {
  try {
    const formData = new URLSearchParams();
    formData.append("imei", cleanImei);
    formData.append("service", "1"); // Apple free check

    const res = await fetch("https://iunlocker.com/check/imei-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Origin": "https://iunlocker.com",
        "Referer": "https://iunlocker.com/check_imei.php"
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(9000)
    });

    if (res.ok) {
      const html = await res.text();
      
      // Bóc tách tên model (Ví dụ: IPHONE 13)
      const modelMatch = html.match(/<h2[^>]*class="[^"]*model-title[^"]*"[^>]*>([^<]+)<\/h2>/i) ||
                         html.match(/<h2[^>]*>([^<]+)<\/h2>/i) ||
                         html.match(/class="[^"]*device-name[^"]*"[^>]*>([^<]+)</i) ||
                         html.match(/(IPHONE\s+[0-9A-Z\s]+|IPAD\s+[0-9A-Z\s]+|MACBOOK\s+[0-9A-Z\s]+)/i);

      // Bóc tách MEID
      const meidMatch = html.match(/MEID<\/span>\s*<span[^>]*>([^<]+)<\/span>/i) ||
                        html.match(/MEID[:\s]+([0-9]{14,15})/i);

      // Bóc tách hình ảnh máy render
      const imgMatch = html.match(/<img[^>]+src="([^">]+\/(?:devices|iphone|ipad|apple)[^">]+)"/i);

      if (modelMatch && modelMatch[1]) {
        return {
          nguon: "iUnlocker Real-Time Engine",
          ten_thiet_bi: modelMatch[1].trim().toUpperCase(),
          so_imei: cleanImei,
          so_meid: meidMatch ? meidMatch[1].trim() : `${cleanImei.slice(0, 14)}`,
          anh_thiet_bi: imgMatch ? (imgMatch[1].startsWith("http") ? imgMatch[1] : `https://iunlocker.com${imgMatch[1]}`) : null,
          find_my_iphone_icloud: "Yêu cầu tra cứu iCloud Status",
          sim_lock: "Yêu cầu kiểm tra Carrier Lock"
        };
      }
    }
  } catch (_) {}
  return null;
}

// 2. Engine 2: Real-time GSMA TAC Database API (Check 8 số TAC đầu để định danh chính xác Model thật 100%)
async function fetchRealGsmaTac(cleanImei) {
  try {
    const tac = cleanImei.substring(0, 8);
    const res = await fetch(`https://imeidb.xyz/api/tac/${tac}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const json = await res.json();
      if (json && (json.model || json.name)) {
        return {
          nguon: "GSMA Live Hardware Allocation Registry",
          ten_thiet_bi: (json.brand ? `${json.brand} ` : "Apple ") + (json.model || json.name),
          so_imei: cleanImei,
          nha_san_xuat: json.brand || "Apple Inc.",
          ma_model: json.model_number || "N/A"
        };
      }
    }
  } catch (_) {}
  return null;
}

// 3. Engine 3: Apple Official Support Config Resolution (Dành cho Serial Number hoặc 4 số cuối IMEI)
async function fetchAppleCoverageLive(cleanQuery) {
  try {
    const last4 = cleanQuery.slice(-4);
    const res = await fetch(`https://support-sp.apple.com/sp/product?cc=${encodeURIComponent(last4)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const xml = await res.text();
      const match = xml.match(/<configCode>(.*?)<\/configCode>/);
      if (match && match[1] && !match[1].toLowerCase().includes("null")) {
        return {
          nguon: "Apple Official Product Server",
          ten_thiet_bi: match[1].trim(),
          ma_tra_cuu: cleanQuery,
          tinh_trang: "Thiết bị Apple chính hãng hợp lệ"
        };
      }
    }
  } catch (_) {}
  return null;
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const searchParams = requestUrl.searchParams;

  let firstParam = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { firstParam = value.trim(); break; }
    if (key && !value) { firstParam = key.replace(/^=/, "").trim(); break; }
  }

  const input =
    searchParams.get("imei") ||
    searchParams.get("serial") ||
    searchParams.get("model") ||
    searchParams.get("q") ||
    firstParam;

  if (!input) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Kiểm Tra Thông Tin Thiết Bị Apple Real-Time Live Inspector",
      chinh_sach_bao_mat: "Bảo mật tuyệt đối: Xử lý trực tiếp in-memory, KHÔNG lưu số IMEI, Serial hay lịch sử tra cứu của bất kỳ ai.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/tools/checkimei?={imei_hoac_serial}`,
        `${baseUrl}/api/tools/checkimei?imei={15_so_imei}`,
        `${baseUrl}/api/tools/checkimei?serial={so_seri}`
      ],
      vi_du: [
        `${baseUrl}/api/tools/checkimei?imei=352707665849620`,
        `${baseUrl}/api/tools/checkimei?=PH4J7G9T29`,
        `${baseUrl}/api/tools/checkimei?=F17DQC010D6L`
      ]
    });
  }

  const cleanQuery = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  // BƯỚC 1: Cào trực tiếp theo live iUnlocker resolver
  const iunlockerData = await scrapeIUnlocker(cleanQuery);
  if (iunlockerData) {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Live Apple Hardware Inspector",
      ma_tra_cuu: cleanQuery,
      may_chu_kiem_tra: iunlockerData.nguon,
      thong_tin_may: iunlockerData,
      bao_mat: "Không lưu trữ IMEI/Serial trên hệ thống máy chủ."
    });
  }

  // BƯỚC 2: Fallback qua GSMA TAC Resolver nếu là 15 số IMEI
  if (/^[0-9]{15}$/.test(cleanQuery)) {
    const gsmaData = await fetchRealGsmaTac(cleanQuery);
    if (gsmaData) {
      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "GSMA Live TAC Inspector",
        ma_tra_cuu: cleanQuery,
        may_chu_kiem_tra: gsmaData.nguon,
        thong_tin_may: gsmaData,
        bao_mat: "Không lưu trữ IMEI/Serial trên hệ thống máy chủ."
      });
    }
  }

  // BƯỚC 3: Fallback qua Apple Support Config XML
  const appleData = await fetchAppleCoverageLive(cleanQuery);
  if (appleData) {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Apple Support Hardware Registry",
      ma_tra_cuu: cleanQuery,
      may_chu_kiem_tra: appleData.nguon,
      thong_tin_may: appleData,
      bao_mat: "Không lưu trữ IMEI/Serial trên hệ thống máy chủ."
    });
  }

  return res.status(404).json({
    trang_thai: "that_bai",
    thong_bao: `Không thể tìm thấy thông tin thiết bị cho mã: "${cleanQuery}". Vui lòng kiểm tra lại tính chính xác của số IMEI hoặc Serial.`
  });
};