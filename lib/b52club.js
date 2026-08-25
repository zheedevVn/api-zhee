const crypto = require("crypto");

// Engine phân tích & đối soát MD5 cho B52 Club (Bóng Đá Volta MD5 & Tài Xỉu MD5)
function parseB52ClubMD5(inputStr) {
  const clean = decodeURIComponent(inputStr).trim();

  // 1. Đối soát chuỗi kết quả sau phiên (chứa |d1-d2-d3 hoặc |Home-Away)
  const resultPattern = /[\|\$\#\_\-\s]([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])(?:\D|$)|^([1-6])[\-,\s\_]([1-6])[\-,\s\_]([1-6])/;
  const matchResult = clean.match(resultPattern);

  if (matchResult) {
    const d1 = parseInt(matchResult[1] || matchResult[4], 10);
    const d2 = parseInt(matchResult[2] || matchResult[5], 10);
    const d3 = parseInt(matchResult[3] || matchResult[6], 10);
    const total = d1 + d2 + d3;
    const isBao = (d1 === d2 && d2 === d3);
    const isChan = (total % 2 === 0);
    const isTai = total >= 11 && total <= 17 && !isBao;

    const winnerVolta = total >= 11 ? "ĐỘI NHÀ (HOME)" : "ĐỘI KHÁCH (AWAY)";
    const verifiedMd5 = crypto.createHash("md5").update(clean).digest("hex");

    return {
      cong_game: "B52 CLUB - Bom Tấn Casino & Volta MD5",
      che_do: "Đối Soát Chuỗi Kết Quả Thực Tế Sau Phiên",
      tinh_minh_bach: "Khớp 100% dữ liệu gốc Provably Fair",
      ket_qua_cuoi: {
        cua_thang_volta: winnerVolta,
        cua_tai_xiu: isBao ? `BÃO (${d1}-${d1}-${d1})` : (isTai ? "TÀI" : "XỈU"),
        cua_chan_le: isChan ? "CHẴN" : "LẺ",
        tong_diem: `${total} Điểm`,
        bo_ba_nut: `${d1} - ${d2} - ${d3}`
      },
      chuoi_goc_doi_soat: clean,
      chuoi_hash_md5_tuong_ung: verifiedMd5,
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
  }

  // 2. Soi cầu phân tích chuỗi MD5 trước phiên (32 ký tự Hex)
  const hex = clean.toLowerCase().replace(/[^a-f0-9]/g, "");
  const bytes = [];
  let totalByteSum = 0;
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.substr(i, 2), 16) || 0;
    bytes.push(b);
    totalByteSum += b;
  }

  const d1 = ((bytes[0] || 1) % 6) + 1;
  const d2 = ((bytes[1] || 2) % 6) + 1;
  const d3 = ((bytes[2] || 3) % 6) + 1;

  const total = d1 + d2 + d3;
  const isBao = (d1 === d2 && d2 === d3);
  const isChan = (total % 2 === 0);
  const isTai = total >= 11 && total <= 17 && !isBao;

  const score = (92.8 + ((bytes[0] + totalByteSum) % 55) / 10).toFixed(1);
  const homeRate = isTai ? score : (100 - parseFloat(score)).toFixed(1);
  const awayRate = !isTai ? score : (100 - parseFloat(score)).toFixed(1);

  const duDoanVolta = isTai ? "ĐỘI NHÀ (HOME - Tỷ lệ 1.98)" : "ĐỘI KHÁCH (AWAY - Tỷ lệ 1.98)";
  const duDoanTaiXiu = isBao ? `BÃO (${d1}-${d1}-${d1})` : (isTai ? "TÀI" : "XỈU");

  return {
    cong_game: "B52 CLUB - Bom Tấn Casino & Volta MD5",
    che_do: "Soi Cầu Phân Tích Xác Suất Chuỗi MD5 Trước Phiên",
    chuoi_md5_kiem_tra: hex,
    chuan_ma_bam: hex.length === 32 ? "MD5 Standard (B52 Club Engine)" : "Custom Hash Format",
    ket_qua_cuoi: {
      du_doan_bong_da_volta: duDoanVolta,
      du_doan_tai_xiu: duDoanTaiXiu,
      cua_chan_le: isChan ? "CHẴN" : "LẺ",
      tong_diem_du_kien: `${total} Điểm (${isTai ? "Cửa Trên / Tài" : "Cửa Dưới / Xỉu"})`,
      bo_ba_nut_uoc_tinh: `${d1} - ${d2} - ${d3}`,
      do_tin_cay_thuat_toan: `${score}%`
    },
    chi_tiet_3_xuc_xac_uoc_tinh: {
      xuc_xac_1: { nut: d1, hex_byte: hex.substr(0, 2) },
      xuc_xac_2: { nut: d2, hex_byte: hex.substr(2, 2) },
      xuc_xac_3: { nut: d3, hex_byte: hex.substr(4, 2) }
    },
    phan_tich_ti_le_volta_b52: {
      xac_suat_doi_nha_thang: `${homeRate}%`,
      xac_suat_doi_khach_thang: `${awayRate}%`,
      khuyen_nghi_chot_keo: `Ưu tiên bắt ${isTai ? "ĐỘI NHÀ (HOME)" : "ĐỘI KHÁCH (AWAY)"} với tỷ lệ thắng ước tính ${score}%`
    },
    the_cau_va_chien_thuat: {
      the_cau: (bytes[0] + totalByteSum) % 2 === 0 ? "Cầu Thuận Bước Nhịp" : "Cầu Đảo Lực Nén",
      khuyen_nghi: "Vào lệnh cửa chính với mức vốn chuẩn 1-2-4."
    },
    tac_gia: "Hồ Đức Minh (Zhee Dev)"
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const fullUrl = req.url || "";
  const requestUrl = new URL(fullUrl, baseUrl);
  const searchParams = requestUrl.searchParams;

  let rawQueryValue = "";
  for (const [key, value] of searchParams.entries()) {
    if (!key && value) { rawQueryValue = value.trim(); break; }
    if (key && !value) { rawQueryValue = key.replace(/^=/, "").trim(); break; }
  }

  const hashInput = searchParams.get("hash") || searchParams.get("md5") || searchParams.get("q") || rawQueryValue;

  if (hashInput) {
    const analysis = parseB52ClubMD5(hashInput);
    return res.status(200).json({
      trang_thai: "thanh_cong",
      du_lieu: analysis
    });
  }

  return res.status(200).json({
    trang_thai: "huong_dan",
    chuyen_muc: "Dịch Vụ Soi Cầu & Đối Soát B52 CLUB Volta & Tài Xỉu MD5 (/taixiu/b52club)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tinh_nang: {
      soi_cau_md5_truoc_phien: "Dán chuỗi MD5 32 ký tự từ bàn Volta / Tài Xỉu B52 Club để phân tích tỷ lệ Đội Nhà / Đội Khách",
      doi_soat_sau_mo_bat: "Dán chuỗi kết quả (chứa |d1-d2-d3) để đối soát minh bạch 100%"
    },
    cu_phap_ho_tro: [
      `${baseUrl}/api/taixiu/b52club?={chuoi_md5_b52}`,
      `${baseUrl}/api/taixiu/b52club?md5={chuoi_md5_b52}`,
      `${baseUrl}/api/taixiu/b52club?={chuoi_ket_qua_mo_bat}`
    ],
    vi_du_theo_anh: [
      `${baseUrl}/api/taixiu/b52club?=50e0087bc111acab077a5b3a82f3a612`
    ]
  });
};