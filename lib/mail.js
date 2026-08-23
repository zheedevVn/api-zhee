const nodemailer = require("nodemailer");

const GMAIL_USER = "hoducminhdz1@gmail.com";
const GMAIL_PASS = "mziwbjnyhyidsqnr";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS
  }
});

// Hàm tạo giao diện Email HTML dạng thông báo dịch vụ chuyên nghiệp
function renderServiceEmail({ title, message, toEmail, year }) {
  const currentYear = year || new Date().getFullYear();
  return `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
      <tr>
        <td align="center" style="padding: 35px 15px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #eef2f6;">
            
            <!-- HEADER -->
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 24px;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 1px; text-transform: uppercase;">
                  ZHEE SERVICE NOTIFICATION
                </h1>
              </td>
            </tr>

            <!-- CONTENT BODY -->
            <tr>
              <td style="padding: 32px 28px 24px 28px;">
                <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.4;">
                  ${title}
                </h2>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                  Hệ thống gửi đến bạn thông báo tự động với chi tiết nội dung như sau:
                </p>

                <!-- MESSAGE BOX -->
                <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px; padding: 18px 20px; margin-bottom: 24px;">
                  <div style="font-size: 15px; color: #1e293b; line-height: 1.7; word-break: break-word; font-weight: 500;">
                    ${message}
                  </div>
                </div>

                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                  Địa chỉ nhận thông báo: <strong style="color: #0f172a;">${toEmail}</strong>
                </p>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: 500;">
                  © ${currentYear} Zhee API Service Engine. All rights reserved.
                </p>
                <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                  Đây là thư điện tử gửi tự động từ hệ thống thông báo. Vui lòng không trả lời trực tiếp email này.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

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
      chuyen_muc: "Dịch Vụ Email & Thông Báo (/mail)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      tong_so_tool: 2,
      danh_sach_tool: {
        check_gmail: {
          ten_api: "Kiểm tra tài khoản Gmail",
          duong_dan: "/mail/gmail",
          phuong_thuc: "GET",
          mo_ta: "Kiểm tra định dạng, bóc tách tên người dùng và avatar Gravatar",
          cu_phap: `${baseUrl}/mail/gmail?={email_can_check}`,
          vi_du: `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com`
        },
        gui_thong_bao: {
          ten_api: "Gửi Email Thông Báo Dịch Vụ (Service Notification Template)",
          duong_dan: "/mail/gmail",
          phuong_thuc: "GET",
          mo_ta: "Gửi email với template HTML chuẩn dịch vụ web, hỗ trợ số lần và độ trễ",
          cu_phap: `${baseUrl}/mail/gmail?={email_nhan}/{tieu_de}/{noi_dung}/{so_lan}/{time_delay_ms}/`,
          vi_du: `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/XacThucOTP/Ma xac thuc cua ban la 892011/1/1000/`
        }
      }
    });
  }

  try {
    // -------------------------------------------------------------
    // GỬI MAIL TEMPLATE THÔNG BÁO DỊCH VỤ
    // -------------------------------------------------------------
    if (firstParam.includes("/")) {
      const parts = firstParam.split("/").filter((p, index, arr) => !(index === arr.length - 1 && p === ""));
      
      const toEmail = parts[0]?.trim();
      const subject = parts[1]?.trim() || "Thông báo từ Zhee Service";
      const content = parts[2]?.trim() || "Nội dung thông báo mặc định.";
      const count = Math.min(Math.max(parseInt(parts[3] || "1", 10), 1), 5); // Tối đa 5 lần
      const delayMs = Math.max(parseInt(parts[4] || "1000", 10), 500);

      if (!toEmail || !toEmail.includes("@")) {
        return res.status(400).json({
          trang_thai: "that_bai",
          thong_bao: "Địa chỉ email người nhận không hợp lệ.",
          cu_phap: "/mail/gmail?={email}/{tieu_de}/{noi_dung}/{so_lan}/{delay_ms}/"
        });
      }

      const htmlContent = renderServiceEmail({
        title: subject,
        message: content,
        toEmail: toEmail
      });

      let successCount = 0;
      let errors = [];

      for (let i = 0; i < count; i++) {
        try {
          await transporter.sendMail({
            from: `"Zhee Notification Service" <${GMAIL_USER}>`,
            to: toEmail,
            subject: count > 1 ? `[${i + 1}/${count}] ${subject}` : subject,
            text: `${subject}\n\n${content}\n\n---\nZhee Service Notification`,
            html: htmlContent
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
        loai: "email_notification_service",
        thong_tin_gui: {
          dich_vu: "Zhee Mail Notification",
          email_gui: GMAIL_USER,
          email_nhan: toEmail,
          tieu_de: subject,
          dinh_dang: "HTML Service Card Template",
          so_lan_yeu_cau: count,
          so_lan_thanh_cong: successCount,
          time_delay_ms: delayMs,
          loi: errors.length > 0 ? errors : null
        }
      });
    }

    // -------------------------------------------------------------
    // TRA CỨU TÀI KHOẢN GMAIL
    // -------------------------------------------------------------
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