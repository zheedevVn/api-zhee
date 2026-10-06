/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
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
          mo_ta: "Tra cứu tên chủ sở hữu STK ngân hàng chuẩn Napas",
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

  // Bóc tách tham số
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
    // TRƯỜNG HỢP 2: XỬ LÝ /bank/check (TRA CỨU TÊN CHỦ TÀI KHOẢN)
    // -------------------------------------------------------------
    if (isCheck) {
      let ownerName = null;

      // Cổng 1: VietQR Web Gateway
      try {
        const vqrRes = await fetch("https://vietqr.co/api/generate-qr-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          },
          body: JSON.stringify({
            bank: targetBank.bin,
            accountNo: cleanAccount
          })
        });

        if (vqrRes.ok) {
          const vqrData = await vqrRes.json();
          if (vqrData?.data?.accountName) {
            ownerName = vqrData.data.accountName;
          }
        }
      } catch (e) {}

      // Cổng 2: VietQR Pro Gateway Fallback
      if (!ownerName) {
        try {
          const pRes = await fetch("https://api.vietqr.io/v2/lookup", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-client-id": "47c5615d-a214-4d7d-ac22-1d1a969375b9",
              "x-api-key": "7be1d7de-0eae-4d3a-a594-1a6d1cf78576"
            },
            body: JSON.stringify({
              bin: targetBank.bin,
              accountNumber: cleanAccount
            })
          });
          const pData = await pRes.json();
          if (pData.code === "00" && pData.data?.accountName) {
            ownerName = pData.data.accountName;
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
          chu_tai_khoan: ownerName.toUpperCase(),
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