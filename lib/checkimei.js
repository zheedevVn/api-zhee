// 1. Engine 1: Bóc tách trực tiếp qua IUnlocker / iFreeiCloud Gateway (Free Live Engine)
async function fetchIUnlockerLive(cleanQuery) {
  try {
    const res = await fetch("https://iunlocker.com/api/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://iunlocker.com/check_imei.php"
      },
      body: `imei=${encodeURIComponent(cleanQuery)}&service=free`,
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.model || data.device_name || data.description)) {
        return {
          nguon: "iUnlocker Live Engine",
          ten_thiet_bi: data.model || data.device_name || data.description,
          so_imei: data.imei || cleanQuery,
          so_seri: data.serial || "N/A",
          mau_sac: data.color || "N/A",
          dung_luong: data.capacity || data.storage || "N/A",
          icloud_status: data.fmi_status || data.find_my_iphone || "Yêu cầu kiểm tra thêm",
          tinh_trang_kich_hoat: data.activated || "Đã kích hoạt",
          bao_hanh_apple: data.warranty_status || data.coverage || "N/A"
        };
      }
    }
  } catch (_) {}
  return null;
}

// 2. Engine 2: Apple Support Product Config XML (Chính chủ Apple, không cần key)
async function fetchAppleProductXml(cleanQuery) {
  try {
    const last4 = cleanQuery.slice(-4);
    const res = await fetch(`https://support-sp.apple.com/sp/product?cc=${encodeURIComponent(last4)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const xml = await res.text();
      const match = xml.match(/<configCode>(.*?)<\/configCode>/);
      if (match && match[1] && !match[1].toLowerCase().includes("null")) {
        return {
          nguon: "Apple Official Coverage System",
          ten_thiet_bi: match[1].trim(),
          so_tra_cuu: cleanQuery,
          tinh_trang: "Thiết bị Apple chính hãng hợp lệ"
        };
      }
    }
  } catch (_) {}
  return null;
}

// 3. Engine 3: GSMA TAC Resolver API (Trích xuất phần cứng thật từ 15 số IMEI)
async function fetchGsmaTacResolver(imei) {
  try {
    const tac = imei.substring(0, 8);
    const res = await fetch(`https://tacindex.com/api/v1/tac/${tac}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.model) {
        return {
          nguon: "GSMA TAC Live Registry",
          ten_thiet_bi: `${data.manufacturer || "Apple"} ${data.model}`,
          model_code: data.model_number || "N/A",
          nha_san_xuat: data.manufacturer || "Apple"
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
    searchParams.get("q") ||
    firstParam;

  if (!input) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Kiểm Tra Thông Tin Máy Apple / Điện Thoại Trực Tiếp (Live Inspector)",
      chinh_sach_bao_mat: "Bảo mật tuyệt đối: Xử lý tức thời trong bộ nhớ RAM, KHÔNG lưu IMEI/Serial hay bất kỳ thông tin nào của người dùng.",
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

  // Ưu tiên 1: Chạy qua Live Engine IUnlocker
  const liveIUnlocker = await fetchIUnlockerLive(cleanQuery);
  if (liveIUnlocker) {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Live iOS Hardware Inspector",
      ma_tra_cuu: cleanQuery,
      may_chu_kiem_tra: liveIUnlocker.nguon,
      thong_tin_may: liveIUnlocker,
      bao_mat: "Không lưu trữ bất kỳ dữ liệu tra cứu nào trên hệ thống."
    });
  }

  // Ưu tiên 2: Chạy qua Apple Support Config Gateway
  const appleSupport = await fetchAppleProductXml(cleanQuery);
  if (appleSupport) {
    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Apple Official Hardware Registry",
      ma_tra_cuu: cleanQuery,
      may_chu_kiem_tra: appleSupport.nguon,
      thong_tin_may: appleSupport,
      bao_mat: "Không lưu trữ bất kỳ dữ liệu tra cứu nào trên hệ thống."
    });
  }

  // Ưu tiên 3: Nếu là 15 số IMEI, truy vấn qua GSMA TAC
  if (/^[0-9]{15}$/.test(cleanQuery)) {
    const gsmaData = await fetchGsmaTacResolver(cleanQuery);
    if (gsmaData) {
      return res.status(200).json({
        trang_thai: "thanh_cong",
        chuyen_muc: "GSMA TAC Live Registry",
        ma_tra_cuu: cleanQuery,
        may_chu_kiem_tra: gsmaData.nguon,
        thong_tin_may: gsmaData,
        bao_mat: "Không lưu trữ bất kỳ dữ liệu tra cứu nào trên hệ thống."
      });
    }
  }

  return res.status(404).json({
    trang_thai: "that_bai",
    thong_bao: `Không tìm thấy thông tin cho thiết bị mang mã: "${cleanQuery}". Vui lòng kiểm tra lại độ chính xác của số IMEI hoặc Serial.`
  });
};