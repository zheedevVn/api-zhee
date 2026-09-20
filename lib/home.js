function tinhHoatDong() {
  const batDau = new Date("2026-08-28T00:00:00+07:00");
  const now = new Date();
  let ms = now.getTime() - batDau.getTime();
  if (ms < 0) ms = 0;
  const tongGio = Math.floor(ms / 3600000);
  const ngay = Math.floor(tongGio / 24);
  const gio = tongGio % 24;
  const phut = Math.floor((ms % 3600000) / 60000);
  const chuoi = `${ngay} ngày ${gio} giờ ${phut} phút`;
  return {
    moc_khai_truong: "28/8/2026",
    da_hoat_dong: chuoi,
    so_ngay: ngay,
    so_gio: gio,
    so_phut: phut
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;
  const uptime = tinhHoatDong();

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    trang_thai: "thanh_cong",
    website: "hoat_dong",
    trang_thai_may_chu: "OK",
    thoi_gian_hoat_dong: uptime,
    admin: {
      ho_va_ten: "Hồ Đức Minh",
      biet_danh: "Zhee Dev",
      telegram: "https://t.me/zheevipv1",
      zalo: "0899256226",
      github: "https://github.com/hoducminh123"
    },
    website_chinh: baseUrl,
    giao_dien: `${baseUrl}/docs`,
    danh_sach_api: `${baseUrl}/list`
  });
};

module.exports.tinhHoatDong = tinhHoatDong;
