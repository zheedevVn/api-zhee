module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  let bankCode = req.query.bank || req.query.nganhang || "";
  let accountNo = req.query.account || req.query.stk || req.query[""] || "";

  // Hỗ trợ cú pháp ngắn: /bank/check?=MB-0987654321 hoặc /bank/check?=VCB/1012345678
  if (fullUrl.includes("?")) {
    const rawQuery = fullUrl.substring(fullUrl.indexOf("?") + 1);
    const firstParam = decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim());

    if (firstParam.includes("-") || firstParam.includes("/")) {
      const parts = firstParam.split(/[-\/]/);
      if (parts.length >= 2) {
        bankCode = parts[0];
        accountNo = parts[1];
      }
    }
  }

  if (!bankCode || !accountNo) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Vui lòng nhập Mã Ngân Hàng và Số Tài Khoản.",
      cu_phap: [
        "https://{domain}/api/bank/check?bank={ma_nh}&stk={so_tai_khoan}",
        "https://{domain}/api/bank/check?={ma_nh}-{so_tai_khoan}"
      ],
      vi_du: "https://{domain}/api/bank/check?=MB-0987654321"
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
        thong_bao: `Không tìm thấy ngân hàng: ${cleanBank}. Các mã phổ biến: MB, VCB, TCB, ACB, TPB, VPB, ICB, BIDV...`
      });
    }

    let ownerName = null;
    
    // Cổng 1: Napas / VietQR Engine
    try {
      const lookupRes = await fetch("https://api.vietqr.io/v2/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": "client-id",
          "x-api-key": "api-key"
        },
        body: JSON.stringify({
          bin: targetBank.bin,
          accountNumber: cleanAccount
        })
      });
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        if (lookupData.code === "00" && lookupData.data?.accountName) {
          ownerName = lookupData.data.accountName;
        }
      }
    } catch (e) {}

    // Cổng 2: Fallback
    if (!ownerName) {
      try {
        const fbRes = await fetch(`https://api.sieuthicode.net/api/check-account?bank=${targetBank.shortName}&account=${cleanAccount}`);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (fbData.account_name) ownerName = fbData.account_name;
        }
      } catch (e) {}
    }

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "check_stk_ngan_hang",
      thong_tin: {
        so_tai_khoan: cleanAccount,
        chu_tai_khoan: ownerName || "Không thể xác thực tên (Vui lòng kiểm tra lại STK hoặc thử lại sau)",
        ngan_hang: {
          ten_day_du: targetBank.name,
          ma_ngan_hang: targetBank.shortName,
          ma_bin: targetBank.bin,
          logo: targetBank.logo
        }
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};