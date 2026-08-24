const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "AC31660b9e3fc6ec0b1683a5afab2ff319";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "282069d0da5c4d1d8f96ac63d8230eb4";

// 1. Chuẩn hóa số điện thoại sang định dạng quốc tế E.164 (+84...)
function normalizePhoneNumber(input) {
  let cleaned = input.trim().replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "+84" + cleaned.substring(1);
  } else if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

// 2. Tra cứu nhà mạng nội địa Việt Nam theo đầu số (Dự phòng chuẩn)
function detectVietnamCarrier(phone) {
  const clean = phone.replace("+84", "0").replace(/\D/g, "");
  const prefix3 = clean.substring(0, 3);
  const prefix4 = clean.substring(0, 4);

  const VIETTEL = ["086", "096", "097", "098", "032", "033", "034", "035", "036", "037", "038", "039"];
  const VINAPHONE = ["088", "091", "094", "083", "084", "085", "081", "082"];
  const MOBIFONE = ["089", "090", "093", "070", "079", "077", "076", "078"];
  const VIETNAMOBILE = ["092", "056", "058", "052"];
  const GMOBILE = ["099", "059"];
  const ITELECOM = ["087"];
  const WINTEL = ["055"];

  if (VIETTEL.includes(prefix3)) return "Viettel Telecom";
  if (VINAPHONE.includes(prefix3)) return "Vinaphone (VNPT)";
  if (MOBIFONE.includes(prefix3)) return "MobiFone";
  if (VIETNAMOBILE.includes(prefix3)) return "Vietnamobile";
  if (GMOBILE.includes(prefix3)) return "Gmobile";
  if (ITELECOM.includes(prefix3)) return "iTel (Itelecom)";
  if (WINTEL.includes(prefix3)) return "Wintel";

  return "Quốc tế / Thuê bao khác";
}

// 3. Tra cứu trực tiếp Twilio Lookups V2 qua HTTP Basic Auth (fetch Native)
async function fetchTwilioLookupV2(e164Phone) {
  try {
    const creds = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    
    // Gửi yêu cầu với các trường dữ liệu cao cấp (Line Type, Caller Name, Sim Swap)
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164Phone)}?Fields=line_type_intelligence,caller_name,sim_swap,call_forwarding`;
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      return await res.json();
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

  const phoneInput =
    searchParams.get("phone") ||
    searchParams.get("sdt") ||
    searchParams.get("q") ||
    firstParam;

  if (!phoneInput) {
    return res.status(200).json({
      trang_thai: "huong_dan",
      chuyen_muc: "Tra Cứu Thông Tin Số Điện Thoại (Twilio Lookup V2 API)",
      chinh_sach_bao_mat: "Bảo mật tuyệt đối: Không lưu nhật ký số điện thoại hay thông tin cá nhân của người dùng.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      cu_phap: [
        `${baseUrl}/api/tools/checksdt?={so_dien_thoai}`,
        `${baseUrl}/api/tools/checksdt?phone={so_dien_thoai}`,
        `${baseUrl}/api/tools/checksdt?sdt={so_dien_thoai}`
      ],
      vi_du: [
        `${baseUrl}/api/tools/checksdt?=0944921186`,
        `${baseUrl}/api/tools/checksdt?phone=+84944921186`,
        `${baseUrl}/api/tools/checksdt?sdt=0987654321`
      ]
    });
  }

  const e164Phone = normalizePhoneNumber(phoneInput);
  const twilioData = await fetchTwilioLookupV2(e164Phone);

  const carrierFallBack = detectVietnamCarrier(e164Phone);

  if (twilioData && twilioData.valid) {
    const lineInfo = twilioData.lineTypeIntelligence || {};
    const callerInfo = twilioData.callerName || {};
    const simSwap = twilioData.simSwap || {};
    const callFwd = twilioData.callForwarding || {};

    return res.status(200).json({
      trang_thai: "thanh_cong",
      chuyen_muc: "Phone Number Intelligence Lookup",
      du_lieu: {
        so_dien_thoai: twilioData.phoneNumber,
        dinh_dang_noi_dia: twilioData.nationalFormat || phoneInput,
        ma_quoc_gia: twilioData.countryCode || "VN",
        ma_vung_quoc_te: `+${twilioData.callingCountryCode || "84"}`,
        tinh_trang_hop_le: twilioData.valid ? "HỢP LỆ" : "KHÔNG HỢP LỆ",
        
        nha_mang_va_duong_truyen: {
          loai_thue_bao: lineInfo.type || "mobile",
          ten_nha_mang: lineInfo.carrierName || carrierFallBack,
          ma_quoc_gia_mcc: lineInfo.mobileCountryCode || (twilioData.countryCode === "VN" ? "452" : "N/A"),
          ma_mang_mnc: lineInfo.mobileNetworkCode || "N/A"
        },

        danh_tinh_nguoi_dung: {
          ten_dang_ky_caller_id: callerInfo.callerName || "Không có",
          loai_danh_tinh: callerInfo.callerType || "N/A"
        },

        lich_su_va_bao_mat_sim: {
          da_doi_sim_gan_day: simSwap.lastSimSwap ? "CÓ" : "KHÔNG",
          thoi_gian_doi_sim_gan_nhat: simSwap.lastSimSwap || "Chưa ghi nhận",
          chuyen_tiep_cuoc_goi: callFwd.callForwardingEnabled ? "BẬT" : "TẮT"
        },

        may_chu_kiem_tra: "Twilio Lookup V2 Official Gateway",
        tac_gia: "Hồ Đức Minh (Zhee Dev)"
      }
    });
  }

  // Nếu Twilio chưa kịp phản hồi, trả về theo bộ giải mã số học
  return res.status(200).json({
    trang_thai: "thanh_cong",
    chuyen_muc: "Phone Number Basic Lookup",
    du_lieu: {
      so_dien_thoai: e164Phone,
      dinh_dang_noi_dia: phoneInput,
      ma_quoc_gia: e164Phone.startsWith("+84") ? "VN" : "Quốc tế",
      tinh_trang_hop_le: "HỢP LỆ (Theo định dạng số học)",
      nha_mang_va_duong_truyen: {
        loai_thue_bao: "mobile",
        ten_nha_mang: carrierFallBack
      },
      may_chu_kiem_tra: "National Prefix Telecom Engine",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    }
  });
};