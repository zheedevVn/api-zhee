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

// 1. Template OTP Xác thực / Khôi phục
function renderOtpTemplate({ otpCode, type, toEmail }) {
  const isRecover = type === "khoiphuc" || type === "recover" || type === "reset";
  const title = isRecover ? "Yêu Cầu Khôi Phục Mật Khẩu" : "Xác Thực Tài Khoản";
  const badgeColor = isRecover ? "#ea580c" : "#2563eb";
  const badgeText = isRecover ? "BẢO MẬT & KHÔI PHỤC" : "XÁC THỰC BẢO MẬT";
  const desc = isRecover 
    ? "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Sử dụng mã xác nhận bên dưới để tiếp tục:"
    : "Cảm ơn bạn đã sử dụng dịch vụ. Vui lòng nhập mã OTP dưới đây để hoàn tất bước xác thực:";

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <tr>
              <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; text-align: center;">
                <div style="display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 5px 14px; font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 1px; margin-bottom: 12px;">
                  ${badgeText}
                </div>
                <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 35px 30px;">
                <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">${desc}</p>
                <div style="background: #f8fafc; border: 2px dashed ${badgeColor}; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: ${badgeColor};">${otpCode}</span>
                </div>
                <div style="background: #fffbeb; border-radius: 8px; padding: 12px 16px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                    ⏱ Mã có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
                  </p>
                </div>
                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  Yêu cầu gửi tới: <strong style="color: #334155;">${toEmail}</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2026 Zhee API Engine. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

// 2. Template Reset Password Button CTA
function renderResetLinkTemplate({ resetUrl, toEmail }) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <tr>
              <td style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 30px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Đặt Lại Mật Khẩu</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 35px 30px; text-align: center;">
                <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6; text-align: left;">
                  Chúng tôi nhận được yêu cầu thiết lập lại mật khẩu cho tài khoản <strong>${toEmail}</strong>. Nhấn vào nút bên dưới để tiến hành tạo mật khẩu mới:
                </p>
                <div style="margin: 30px 0;">
                  <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: #ffffff; text-decoration: none; padding: 14px 34px; font-size: 15px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
                    ĐẶT LẠI MẬT KHẨU
                  </a>
                </div>
                <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b; text-align: left;">Hoặc copy đường liên kết bên dưới dán vào trình duyệt:</p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; word-break: break-all; font-size: 11px; color: #4f46e5; text-align: left;">
                  ${resetUrl}
                </div>
              </td>
            </tr>
            <tr>
              <td style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2026 Zhee API Engine. Link có giá trị sử dụng trong 15 phút.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

// 3. Template Thông Báo Biến Động / Dịch Vụ Chung
function renderGeneralNotifyTemplate({ title, message, toEmail }) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <tr>
              <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 26px 30px;">
                <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">ZHEE SERVICE SYSTEM</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 30px;">
                <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 17px; font-weight: 600;">${title}</h2>
                <div style="background: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
                  <div style="font-size: 14px; color: #0c4a6e; line-height: 1.7; font-weight: 500;">${message}</div>
                </div>
                <p style="margin: 0; font-size: 12px; color: #64748b;">Người nhận: <strong>${toEmail}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2026 Zhee API Service Engine.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
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

  // Menu hướng dẫn /mail
  if (!firstParam && (!fullUrl.includes("?") || fullUrl.endsWith("/mail"))) {
    return res.status(200).json({
      chuyen_muc: "Dịch Vụ Email & Thông Báo (/mail)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      danh_sach_cu_phap: {
        gui_otp: {
          mo_ta: "Gửi mã OTP 5 phút đẹp mắt (xác thực hoặc khôi phục)",
          cu_phap: `${baseUrl}/mail/gmail?={email}/otp/{ma_otp}/{loai_otp: xacthuc | khoiphuc}`,
          vi_du: `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/otp/849201/xacthuc`
        },
        gui_link_reset_pass: {
          mo_ta: "Gửi email kèm nút bấm CTA Đặt lại mật khẩu",
          cu_phap: `${baseUrl}/mail/gmail?={email}/reset/{link_url}`,
          vi_du: `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/reset/https://google.com`
        },
        gui_thong_bao: {
          mo_ta: "Gửi thông báo dịch vụ / thông báo tài khoản",
          cu_phap: `${baseUrl}/mail/gmail?={email}/notify/{tieu_de}/{noi_dung}`,
          vi_du: `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/notify/BienDongSoDu/Nap thanh cong 50.000d`
        },
        check_gmail: {
          mo_ta: "Check thông tin tài khoản Gmail",
          cu_phap: `${baseUrl}/mail/gmail?={email}`,
          vi_du: `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com`
        }
      }
    });
  }

  try {
    // Phân giải cú pháp đa chức năng
    if (firstParam.includes("/")) {
      const parts = firstParam.split("/").filter((p, index, arr) => !(index === arr.length - 1 && p === ""));
      const toEmail = parts[0]?.trim();
      const actionType = parts[1]?.toLowerCase().trim();

      if (!toEmail || !toEmail.includes("@")) {
        return res.status(400).json({
          trang_thai: "that_bai",
          thong_bao: "Địa chỉ email người nhận không hợp lệ."
        });
      }

      let emailSubject = "";
      let emailHtml = "";
      let mode = "";

      // 1. Chế độ OTP
      if (actionType === "otp") {
        const otpCode = parts[2]?.trim() || "123456";
        const otpType = parts[3]?.toLowerCase().trim() || "xacthuc";
        emailSubject = otpType.includes("khoiphuc") ? `[Khôi Phục Mật Khẩu] Mã OTP: ${otpCode}` : `[Xác Thực Tài Khoản] Mã OTP: ${otpCode}`;
        emailHtml = renderOtpTemplate({ otpCode, type: otpType, toEmail });
        mode = "otp_verification";
      }
      // 2. Chế độ Reset Password Link
      else if (actionType === "reset") {
        const resetUrl = parts.slice(2).join("/");
        emailSubject = "[Zhee Security] Yêu cầu đặt lại mật khẩu của bạn";
        emailHtml = renderResetLinkTemplate({ resetUrl, toEmail });
        mode = "reset_password_link";
      }
      // 3. Chế độ Thông Báo Dịch Vụ
      else if (actionType === "notify") {
        const subject = parts[2]?.trim() || "Thông báo từ hệ thống";
        const message = parts.slice(3).join("/") || "Nội dung thông báo mặc định.";
        emailSubject = subject;
        emailHtml = renderGeneralNotifyTemplate({ title: subject, message, toEmail });
        mode = "general_notification";
      }
      // 4. Chế độ Lặp theo chu kỳ: {email}/{tieu_de}/{noi_dung}/{so_lan}/{delay_ms}
      else {
        const subject = parts[1]?.trim() || "Thông báo từ Zhee Service";
        const content = parts[2]?.trim() || "Nội dung mặc định.";
        const count = Math.min(Math.max(parseInt(parts[3] || "1", 10), 1), 5);
        const delayMs = Math.max(parseInt(parts[4] || "1000", 10), 500);

        emailHtml = renderGeneralNotifyTemplate({ title: subject, message: content, toEmail });

        let successCount = 0;
        for (let i = 0; i < count; i++) {
          try {
            await transporter.sendMail({
              from: `"Zhee Notification Service" <${GMAIL_USER}>`,
              to: toEmail,
              subject: count > 1 ? `[${i + 1}/${count}] ${subject}` : subject,
              html: emailHtml
            });
            successCount++;
          } catch (e) {}
          if (i < count - 1 && delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
        }

        return res.status(200).json({
          trang_thai: successCount > 0 ? "thanh_cong" : "that_bai",
          loai: "loop_notification",
          thong_tin_gui: {
            email_gui: GMAIL_USER,
            email_nhan: toEmail,
            so_lan_thanh_cong: successCount,
            tong_yeu_cau: count
          }
        });
      }

      // Gửi mail đơn lẻ cho các chế độ OTP, Reset Link, Notify
      await transporter.sendMail({
        from: `"Zhee Security & Service" <${GMAIL_USER}>`,
        to: toEmail,
        subject: emailSubject,
        html: emailHtml
      });

      return res.status(200).json({
        trang_thai: "thanh_cong",
        loai: mode,
        thong_tin: {
          email_gui: GMAIL_USER,
          email_nhan: toEmail,
          tieu_de: emailSubject,
          template_ui: "Modern Responsive Card"
        }
      });
    }

    // Check tài khoản
    const targetEmail = firstParam.replace(/^.*=/, "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return res.status(400).json({
        trang_thai: "that_bai",
        thong_bao: "Định dạng email không hợp lệ."
      });
    }

    const usernamePart = targetEmail.split("@")[0];
    const domainPart = targetEmail.split("@")[1];

    return res.status(200).json({
      trang_thai: "thanh_cong",
      loai: "check_tai_khoan_gmail",
      thong_tin_tai_khoan: {
        email: targetEmail,
        ten_tai_khoan: usernamePart,
        ten_mien: domainPart,
        anh_dai_dien: `https://www.gravatar.com/avatar/${Buffer.from(targetEmail.toLowerCase().trim()).toString("hex")}?d=mp`
      }
    });

  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message
    });
  }
};