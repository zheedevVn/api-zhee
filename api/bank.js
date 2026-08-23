module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const isCheck = fullUrl.includes("/check") || req.query.action === "check";
  const isTaoQr = fullUrl.includes("/taoqr") || req.query.action === "taoqr";

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 1: TRANG TÀI LIỆU CHUYÊN MỤC /bank
  // -------------------------------------------------------------
  if (!isCheck && !isTaoQr && (!fullUrl.includes("?") || fullUrl.endsWith("/bank"))) {
    return res.status(200).json({
      chuyen_muc: "Ngân Hàng & Thanh Toán (Banking & VietQR Tools)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 2,
      danh_sach_tool: {
        check: {
          ten_api: "Kiểm tra tên chủ tài khoản ngân hàng",
          duong_dan: "/bank/check",
          phuong_thuc: "GET",
          mo_ta: "Tra cứu tên chủ sở hữu STK ngân hàng thời gian thực",
          cu_phap: [
            `${baseUrl}/bank/check?bank={ma_nh}&stk={so_tai_khoan}`,
            `${baseUrl}/bank/check?={ma_nh}-{so_tai_khoan}`
          ],
          vi_du: [
            `${baseUrl}/bank/check?=MB-16022009444333`,
            `${baseUrl}/bank/check?=VCB-1012345678`
          ]
        },
        taoqr: {
          ten_api: "Tạo mã QR thanh toán VietQR",
          duong_dan: "/bank/taoqr",
          phuong_thuc: "GET",
          mo_ta: "Tạo mã QR thanh toán Napas 247 kèm số tiền và nội dung chuyển khoản",
          cu_phap: [
            `${baseUrl}/bank/taoqr?bank={ma_nh}&stk={stk}&sotien={so_tien}&noidung={loi_nhan}`,
            `${baseUrl}/bank/taoqr?={ma_nh}-{stk}-{so_tien}-{loi_nhan}`
          ],
          vi_du: [
            `${baseUrl}/bank/taoqr?=MB-16022009444333-50000-NapTien`,
            `${baseUrl}/bank/taoqr?=TCB-1903000000000-100000-ThanhToanDonHang`
          ]
        }
      }
    });
  }

  // Bóc tách tham số đầu vào
  let bankCode = req.query.bank || req.query.nganhang || "";
  let accountNo = req.query.account || req.query.stk || req.query[""] || "";
  let amount = req.query.amount || req.query.sotien || 0;
  let memo = req.query.memo || req.query.noidung || "Thanh toan VietQR";
  let template = req.query.template || "compact2";

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
      thong_bao: "Vui lòng nhập Mã Ngân Hàng và Số Tài Khoản.",
      cu_phap: isCheck 
        ? `${baseUrl}/bank/check?={ma_nh}-{so_tai_khoan}` 
        : `${baseUrl}/bank/taoqr?={ma_nh}-{stk}-{so_tien}-{loi_nhan}`
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
        thong_bao: `Không tìm thấy mã ngân hàng: ${cleanBank}. Các mã hợp lệ: MB, VCB, TCB, ACB, TPB, VPB, BIDV, CTG...`
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 2: XỬ LÝ /bank/check (TRA CỨU TÊN CHỦ TÀI KHOẢN MIỄN PHÍ)
    // -------------------------------------------------------------
    if (isCheck) {
      let ownerName = null;

      // Danh sách các cổng Gateway ngân hàng trực tiếp không bị chặn bản quyền Free
      const openGateways = [
        // Cổng 1: Napas Web2M Core
        async () => {
          const r = await fetch(`https://api.web2m.com/api/check-account?bank=${targetBank.shortName}&account=${cleanAccount}`);
          const d = await r.json();
          return d.account_name || d.name || (d.data ? d.data.accountName : null);
        },
        // Cổng 2: Sieuthicode Napas Hub
        async () => {
          const r = await fetch(`https://api.sieuthicode.net/api/check-account?bank=${targetBank.shortName}&account=${cleanAccount}`);
          const d = await r.json();
          return d.account_name || d.name || null;
        },
        // Cổng 3: TheSieuRe Banking Check
        async () => {
          const r = await fetch("https://thesieure.com/api/bank/check", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `bank_code=${targetBank.shortName}&account_number=${cleanAccount}`
          });
          const d = await r.json();
          return d.account_name || d.name || null;
        }
      ];

      for (const gateway of openGateways) {
        try {
          const nameFound = await gateway();
          if (nameFound && typeof nameFound === "string" && nameFound.trim().length > 2) {
            ownerName = nameFound.trim().toUpperCase();
            break;
          }
        } catch (e) {}
      }

      if (!ownerName) {
        return res.status(404).json({
          trang_thai: "that_bai",
          thong_bao: "Không tìm thấy tên tài khoản hoặc STK không tồn tại tại ngân hàng đã chọn.",
          thong_tin_nhap: {
            ngan_hang: targetBank.shortName,
            so_tai_khoan: cleanAccount
          }
        });
      }

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: "check_stk_ngan_hang",
        thong_tin: {
          so_tai_khoan: cleanAccount,
          chu_tai_khoan: ownerName,
          ngan_hang: {
            ten_day_du: targetBank.name,
            ma_ngan_hang: targetBank.shortName,
            ma_bin: targetBank.bin,
            logo: targetBank.logo
          }
        }
      });
    }

    // -------------------------------------------------------------
    // TRƯỜNG HỢP 3: XỬ LÝ /bank/taoqr (TẠO MÃ QR THANH TOÁN)
    // -------------------------------------------------------------
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