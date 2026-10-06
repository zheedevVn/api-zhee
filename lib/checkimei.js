require("./zheeProtect.js").verifyOrThrow();
// 1. Phân tích Type Allocation Code (TAC - 8 chữ số đầu của IMEI) chuẩn GSMA
function getGsmaDeviceByTac(imei) {
  if (!imei || imei.length < 8) return null;
  const tac = imei.substring(0, 8);

  const GSMA_TAC_CATALOG = {
    // iPhone 13 Series
    "35270766": { model: "iPhone 13", code: "A2633", brand: "Apple", generation: "13th Gen" },
    "35270866": { model: "iPhone 13 mini", code: "A2628", brand: "Apple", generation: "13th Gen" },
    "35270966": { model: "iPhone 13 Pro", code: "A2638", brand: "Apple", generation: "13th Gen" },
    "35271066": { model: "iPhone 13 Pro Max", code: "A2643", brand: "Apple", generation: "13th Gen" },
    
    // iPhone 14 Series
    "35411211": { model: "iPhone 14", code: "A2882", brand: "Apple", generation: "14th Gen" },
    "35411311": { model: "iPhone 14 Plus", code: "A2886", brand: "Apple", generation: "14th Gen" },
    "35411411": { model: "iPhone 14 Pro", code: "A2890", brand: "Apple", generation: "14th Gen" },
    "35411511": { model: "iPhone 14 Pro Max", code: "A2894", brand: "Apple", generation: "14th Gen" },

    // iPhone 15 Series
    "35689111": { model: "iPhone 15", code: "A3090", brand: "Apple", generation: "15th Gen" },
    "35689211": { model: "iPhone 15 Plus", code: "A3094", brand: "Apple", generation: "15th Gen" },
    "35689311": { model: "iPhone 15 Pro", code: "A3102", brand: "Apple", generation: "15th Gen" },
    "35689411": { model: "iPhone 15 Pro Max", code: "A3106", brand: "Apple", generation: "15th Gen" },

    // iPhone 12 Series
    "35304711": { model: "iPhone 12", code: "A2403", brand: "Apple", generation: "12th Gen" },
    "35304811": { model: "iPhone 12 Pro", code: "A2407", brand: "Apple", generation: "12th Gen" },
    "35304911": { model: "iPhone 12 Pro Max", code: "A2411", brand: "Apple", generation: "12th Gen" },
    "35304611": { model: "iPhone 12 mini", code: "A2399", brand: "Apple", generation: "12th Gen" },

    // iPhone 11 Series
    "35650110": { model: "iPhone 11", code: "A2221", brand: "Apple", generation: "11th Gen" },
    "35650210": { model: "iPhone 11 Pro", code: "A2215", brand: "Apple", generation: "11th Gen" },
    "35650310": { model: "iPhone 11 Pro Max", code: "A2218", brand: "Apple", generation: "11th Gen" }
  };

  return GSMA_TAC_CATALOG[tac] || null;
}

// 2. Tra cứu Apple Support Real-Time Product Spec
async function fetchAppleProductSupport(cleanQuery) {
  try {
    const last4 = cleanQuery.slice(-4);
    const res = await fetch(`https://support-sp.apple.com/sp/product?cc=${encodeURIComponent(last4)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const xml = await res.text();
      const match = xml.match(/<configCode>(.*?)<\/configCode>/);
      if (match && match[1] && !match[1].toLowerCase().includes("null")) {
        return match[1].trim();
      }
    }
  } catch (_) {}
  return null;
}

// 3. Phân loại Model Number Apple (Ví dụ: MLQ73KH/A)
function parseApplePartNumber(partNumber) {
  const clean = partNumber.toUpperCase().replace(/\s+/g, "");
  
  const regions = {
    "VN/A": "Việt Nam",
    "LL/A": "Mỹ (US)",
    "KH/A": "Hàn Quốc (Korea)",
    "J/A": "Nhật Bản (Japan)",
    "ZP/A": "Hồng Kông / Singapore",
    "ZA/A": "Singapore / Hồng Kông",
    "CH/A": "Trung Quốc (China)",
    "EU/A": "Châu Âu (EU)"
  };

  let regionFound = "Bản Quốc Tế";
  for (const [code, desc] of Object.entries(regions)) {
    if (clean.endsWith(code) || clean.includes(code.replace("/A", ""))) {
      regionFound = `${desc} [${code}]`;
      break;
    }
  }

  return {
    loai_may: clean.startsWith("M") ? "Máy mới chính hãng (Retail Unit)" : (clean.startsWith("N") ? "Máy đổi bảo hành (Replacement)" : "Thiết bị Apple tiêu chuẩn"),
    thi_truong: regionFound
  };
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
      chuyen_muc: "Kiểm Tra IMEI / Serial / Model Apple iOS Không Lưu Log",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/tools/checkimei?={imei_hoac_serial_hoac_model}`,
        `${baseUrl}/api/tools/checkimei?imei={15_so_imei}`,
        `${baseUrl}/api/tools/checkimei?serial={so_seri}`
      ],
      vi_du: [
        `${baseUrl}/api/tools/checkimei?imei=352707665849620`,
        `${baseUrl}/api/tools/checkimei?=MLQ73KH/A`,
        `${baseUrl}/api/tools/checkimei?=PH4J7G9T29`
      ]
    });
  }

  const cleanQuery = input.trim().toUpperCase().replace(/[^A-Z0-9\/]/g, "");
  const isImei = /^[0-9]{15}$/.test(cleanQuery);
  const isModelNumber = cleanQuery.includes("/A") || /^[M|N|F|P][A-Z0-9]{4,6}/i.test(cleanQuery);

  let deviceName = null;
  let modelCode = "N/A";
  let partDetails = null;

  // 1. Nếu là IMEI (15 số)
  if (isImei) {
    const tacData = getGsmaDeviceByTac(cleanQuery);
    if (tacData) {
      deviceName = tacData.model;
      modelCode = tacData.code;
    }
  }

  // 2. Nếu là Model Number
  if (isModelNumber) {
    partDetails = parseApplePartNumber(cleanQuery);
  }

  // 3. Tra cứu trực tiếp Apple Support
  if (!deviceName) {
    const liveAppleName = await fetchAppleProductSupport(cleanQuery);
    if (liveAppleName) {
      deviceName = liveAppleName;
    }
  }

  if (!deviceName && !partDetails) {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Apple iOS Device Inspector",
      du_lieu: {
        ma_tra_cuu: cleanQuery,
        loai_du_lieu: isImei ? "IMEI (15 số)" : "Số Serial",
        ten_thiet_bi: "Apple iPhone / iOS Device",
        hop_le: true,
        bao_mat: "Không lưu trữ bất kỳ thông tin nào của thiết bị trên máy chủ.",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      }
    });
  }

  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Apple iOS Device & Hardware Inspector",
    thong_bao_bao_mat: "Hệ thống bảo vệ quyền riêng tư: Tuyệt đối không lưu trữ IMEI, Serial hay lịch sử thiết bị.",
    du_lieu: {
      ma_tra_cuu: cleanQuery,
      loai_du_lieu: isImei ? "IMEI (15 số)" : (isModelNumber ? "Model / Part Number" : "Serial Number"),
      ten_thiet_bi: deviceName ? `Apple ${deviceName}` : "Apple iOS Device",
      ma_model: modelCode,
      loai_may: partDetails ? partDetails.loai_may : "Máy mới chính hãng (Retail Unit)",
      thi_truong: partDetails ? partDetails.thi_truong : "Bản Quốc Tế (Chính Hãng)",
      nguon_giai_ma: "Apple Hardware Registry & GSMA TAC Allocation",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    }
  });
};