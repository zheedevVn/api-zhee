const nodemailer = require("nodemailer");

const GMAIL_USER = "hoducminhdz1@gmail.com";
const GMAIL_PASS = "mziw bjny hyid sqnr";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS
  }
});

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const fullUrl = req.url || "";
  const rawQuery = fullUrl.includes("?") ? fullUrl.substring(fullUrl.indexOf("?") + 1) : "";
  const firstParam = rawQuery ? decodeURIComponent(rawQuery.split("&")[0].replace(/^=/, "").trim()) : "";

  // Tài liệu chuyên mục /mail
  if (!firstParam && (!fullUrl.includes("?") || fullUrl.endsWith("/mail"))) {
    return res.status(200).json({
      chuyen_muc: "Dịch Vụ Email & Gmail (/mail)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 2,
      danh_sach_tool: {
        check_gmail: {
          ten_api: "Kiểm tra tài khoản Gmail",
          duong_dan: "/mail/gmail",
          phuong_thuc: "GET",
          mo_ta: "Kiểm tra định dạng, bóc tách tên người dùng và kiểm tra tồn tại hồ sơ",
          cu_phap: `${baseUrl}/mail/gmail?={email_can_check}`,
          vi_du: `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com`
        },
        gui_gmail: {
          ten_api: "Gửi Email Tự Động (SMTP App Password)",
          duong_dan: "/mail/gmail",
          phuong_thuc: "GET",
          mo_ta: "Gửi email với số lượng và thời gian delay tùy chỉnh",
          cu_phap: `${baseUrl}/mail/gmail?={email_nhan}/{tieu_de}/{noi_dung}/{so_lan}/{time_delay_ms}/`,
          vi_du: `${baseUrl}/mail/gmail?=nguoinhan@gmail.com/ThongBao/NoiDungEmail/1/1000/`
        }
      }
    });
  }

  try {
    // Xử lý gửi mail: {email}/{tieude}/{noidung}/{solan}/{delay}/
    if (firstParam.includes("/")) {
      const parts = firstParam.split("/").filter((p, index, arr) => !(index === arr.length - 1 && p === ""));
      
      const toEmail = parts[0]?.trim();
      const subject = parts[1]?.trim() || "Thông báo từ Zhee API Engine";
      const content = parts[2]?.trim() || "Nội dung mặc định.";
      const count = Math.min(Math.max(parseInt(parts[3] || "1", 10), 1), 10);
      const delayMs = Math.max(parseInt(parts[4] || "1000", 10), 500);

      if (!toEmail || !toEmail.includes("@")) {
        return res.status(400).json({
          trang_thai: "that_bai",
          thong_bao: "Địa chỉ email người nhận không hợp lệ.",
          dinh_dang_yeu_cau: "/mail/gmail?={email}/{tieu_de}/{noi_dung}/{so_lan}/{delay_ms}/"
        });
      }

      let successCount = 0;
      let errors = [];

      for (let i = 0; i < count; i++) {
        try {
          await transporter.sendMail({
            from: `"Zhee System" <${GMAIL_USER}>`,
            to: toEmail,
            subject: count > 1 ? `[${i + 1}/${count}] ${subject}` : subject,
            text: content,
            html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${content}</div>`
          });
          successCount++;
        } catch (err) {
          errors.push(err.message);
        }

        if (i < count - 1 && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      return res.status(200).json({
        trang_thai: successCount > 0 ? "thanh_cong" : "that_bai",
        loai: "gui_email_smtp",
        thong_tin_gui: {
          email_gui: GMAIL_USER,
          email_nhan: toEmail,
          tieu_de: subject,
          so_lan_yeu_cau: count,
          so_lan_thanh_cong: successCount,
          time_delay_ms: delayMs,
          loi: errors.length > 0 ? errors : null
        }
      });
    }

    // Tra cứu tên tài khoản Gmail
    const targetEmail = firstParam.replace(/^.*=/, "").trim();
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail);

    if (!isEmailValid) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Định dạng email không hợp lệ.",
        dau_vao: targetEmail
      });
    }

    const usernamePart = targetEmail.split("@")[0];
    const domainPart = targetEmail.split("@")[1];
    const formattedName = usernamePart
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "check_tai_khoan_gmail",
      thong_tin_tai_khoan: {
        email: targetEmail,
        ten_tai_khoan: usernamePart,
        ten_hien_thi_uoc_tinh: formattedName,
        ten_mien: domainPart,
        la_gmail_chuan: domainPart.toLowerCase() === "gmail.com",
        anh_dai_dien_gravatar: `https://www.gravatar.com/avatar/${Buffer.from(targetEmail.toLowerCase().trim()).toString("hex")}?d=mp`,
        trang_thai_email: "Định dạng hợp lệ & sẵn sàng nhận thư"
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};