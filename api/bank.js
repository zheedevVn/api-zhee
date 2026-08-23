module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    chuyen_muc: "Ngân Hàng & Thanh Toán (Banking & VietQR Tools)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    tong_so_tool: 2,
    danh_sach_tool: {
      check: {
        ten_api: "Kiểm tra tên chủ tài khoản ngân hàng",
        duong_dan: "/api/bank/check",
        phuong_thuc: "GET",
        mo_ta: "Tra cứu tên chủ sở hữu STK ngân hàng chuẩn Napas",
        cu_phap: [
          `${baseUrl}/api/bank/check?bank={ma_nh}&stk={so_tai_khoan}`,
          `${baseUrl}/api/bank/check?={ma_nh}-{so_tai_khoan}`
        ],
        vi_du: [
          `${baseUrl}/api/bank/check?=MB-0987654321`,
          `${baseUrl}/api/bank/check?=VCB-1012345678`
        ]
      },
      taoqr: {
        ten_api: "Tạo mã QR thanh toán VietQR",
        duong_dan: "/api/bank/taoqr",
        phuong_thuc: "GET",
        mo_ta: "Tạo mã QR thanh toán Napas 247 kèm số tiền và nội dung chuyển khoản",
        cu_phap: [
          `${baseUrl}/api/bank/taoqr?bank={ma_nh}&stk={stk}&sotien={so_tien}&noidung={loi_nhan}`,
          `${baseUrl}/api/bank/taoqr?={ma_nh}-{stk}-{so_tien}-{loi_nhan}`
        ],
        vi_du: [
          `${baseUrl}/api/bank/taoqr?=MB-0987654321-50000-NapTien`,
          `${baseUrl}/api/bank/taoqr?=TCB-1903000000000-100000-ThanhToanDonHang`
        ]
      }
    }
  });
};