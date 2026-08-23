module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  let bankCode = req.query.bank || req.query.nganhang || "";
  let accountNo = req.query.account || req.query.stk || req.query[""] || "";
  let amount = req.query.amount || req.query.sotien || 0;
  let memo = req.query.memo || req.query.noidung || "Thanh toan VietQR";
  let template = req.query.template || "compact2";

  // Hỗ trợ cú pháp ngắn: /bank/taoqr?=MB-0987654321-50000-noidung
  if (fullUrl.includes("?")) {
    const rawQuery = fullUrl.substring(fullUrl.indexOf("?") + 1);
    const firstParam = decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim());

    if (firstParam.includes("-") || firstParam.includes("/")) {
      const parts = firstParam.split(/[-\/]/);
      if (parts.length >= 2) {
        bankCode = parts[0];
        accountNo = parts[1];
        if (parts[2] && !isNaN(parts[2])) amount = parts[2];
        if (parts[3]) memo = parts.slice(3).join(" ");
      }
    }
  }

  if (!bankCode || !accountNo) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Mã Ngân Hàng và Số Tài Khoản để tạo mã QR.",
      cu_phap: [
        "https://{domain}/api/bank/taoqr?bank={ma_nh}&stk={stk}&sotien={so_tien}&noidung={loi_nhan}",
        "https://{domain}/api/bank/taoqr?={ma_nh}-{stk}-{so_tien}-{loi_nhan}"
      ],
      vi_du: "https://{domain}/api/bank/taoqr?=MB-0987654321-50000-NapTien"
    });
  }

  const cleanBank = bankCode.trim().toUpperCase();
  const cleanAccount = accountNo.trim().replace(/\s+/g, "");

  try {
    const bankListRes = await fetch("https://api.vietqr.io/v2/banks");
    const bankListData = await bankListRes.json();
    const banks = bankListData.data || [];

    const targetBank = banks.find(b => 
      b.shortName.toUpperCase() === cleanBank || 
      b.code.toUpperCase() === cleanBank || 
      b.bin === cleanBank
    );

    if (!targetBank) {
      return res.status(404).json({
        trang_thai: "that_bai",
        thong_bao: `Không tìm thấy mã ngân hàng: ${cleanBank}`
      });
    }

    const qrImageUrl = `https://img.vietqr.io/image/${targetBank.bin}-${cleanAccount}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}`;

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "vietqr_code",
      thong_tin_thanh_toan: {
        ngan_hang: targetBank.name,
        ma_ngan_hang: targetBank.shortName,
        so_tai_khoan: cleanAccount,
        so_tien: Number(amount) > 0 ? Number(amount).toLocaleString("vi-VN") + " VNĐ" : "Nhập tay khi quét",
        noi_dung: memo,
        logo_ngan_hang: targetBank.logo
      },
      ma_qr: {
        link_anh_qr: qrImageUrl,
        mau_giao_dien: template
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};