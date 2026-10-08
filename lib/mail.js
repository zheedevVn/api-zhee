/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
require("./zheeProtect.js").verifyOrThrow();
const nodemailer = require("nodemailer");
const checkmailHandler = require("./checkmail");

const GMAIL_USER = "hoducminhdz1@gmail.com";
const GMAIL_PASS = "mziwbjnyhyidsqnr";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS
  }
});

// BỘ VECTOR OUTLINE SVG THUẦN (100% KHÔNG DÙNG EMOJI)
const SVG_ICONS = {
  shield: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
  key: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-1.5 1.5L16 7l-1.5-1.5L13 7l-1.5-1.5L10 7l-1.5-1.5L7 7l-1.5-1.5L4 7l-2 2 5 5 2-2 5 5 2-2 5 5 2-2 5 5 2-2-2-2"></path><circle cx="7.5" cy="7.5" r="3.5"></circle></svg>`,
  lockReset: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path><circle cx="12" cy="16" r="1"></circle></svg>`,
  bell: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>`,
  invoice: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"></path><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 6v12"></path></svg>`,
  alert: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  clockOutline: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
};

// 1. Template OTP Xác thực / Khôi phục
function renderOtpTemplate({ otpCode, type, toEmail }) {
  const isRecover = type.includes("khoi") || type.includes("phuc") || type.includes("recover") || type.includes("reset");
  const title = isRecover ? "Khôi Phục Mật Khẩu" : "Xác Thực Bảo Mật";


  const desc = isRecover 
    ? "Hệ thống nhận được yêu cầu thiết lập lại mật khẩu tài khoản. Nhập mã OTP xác minh bên dưới để tiếp tục:"
    : "Vui lòng sử dụng mã bảo mật dưới đây để hoàn tất quy trình xác minh tài khoản của bạn:";

  return `
  <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin: 0; padding: 0; background-color: #eef0f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 32px 12px;">
      <tr><td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(20,20,60,0.10);">
          <tr>
            <td style="background: linear-gradient(120deg, #141432 0%, #2b2b6b 55%, #3b2a7a 100%); padding: 38px 32px 32px 32px; text-align: center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 18px auto;">
                <tr><td style="width: 64px; height: 64px; background: rgba(255,255,255,0.12); border: 1.5px solid rgba(255,255,255,0.30); border-radius: 50%; text-align: center; vertical-align: middle;">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
                </td></tr>
              </table>
              <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">${title}</h1>
              <p style="margin: 0; font-size: 13.5px; color: rgba(255,255,255,0.75); line-height: 1.7; max-width: 360px; margin: 0 auto;">${desc}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 8px 32px; text-align: center;">
              <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 700; color: #8a8fa3; text-transform: uppercase; letter-spacing: 2.5px;">M\u00E3 x\u00E1c th\u1EF1c c\u1EE7a b\u1EA1n</p>
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 26px auto;">
                <tr>${otpCode.split("").map(function(ch){ return '<td style="width: 52px; height: 62px; background: #f6f7fb; border: 1.5px solid #e2e5ef; border-radius: 12px; text-align: center; vertical-align: middle; font-size: 30px; font-weight: 800; color: #1b1b3a; font-family: \'SF Mono\', \'Courier New\', monospace;">' + ch + '</td><td style="width: 8px;"></td>'; }).join("")}</tr>
              </table>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="background: #fff8ed; border-radius: 12px; padding: 13px 16px; border: 1px solid #f5e0b8; text-align: left;">
                    <p style="margin: 0; font-size: 12.5px; color: #9a6b1e; line-height: 1.6;">
                      <strong>M\u00E3 c\u00F3 hi\u1EC7u l\u1EF1c trong 5 ph\u00FAt.</strong> Kh\u00F4ng chia s\u1EBB m\u00E3 n\u00E0y v\u1EDBi b\u1EA5t k\u1EF3 ai, k\u1EC3 c\u1EA3 nh\u00E2n vi\u00EAn h\u1ED7 tr\u1EE3.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 4px 0; font-size: 11.5px; color: #9aa0b4;">G\u1EEDi \u0111\u1EBFn</p>
              <p style="margin: 0 0 10px 0; font-size: 13.5px; font-weight: 600; color: #3c3f52;">${toEmail}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 26px 32px; text-align: center; border-top: 1px solid #f0f1f5;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: #2b2b6b;">ZHEE API</p>
              <p style="margin: 0; font-size: 11px; color: #9aa0b4; line-height: 1.6;">\u00A9 2026 H\u1ED3 \u0110\u1EE9c Minh (Zhee Dev) \u2014 H\u1EC7 th\u1ED1ng b\u1EA3o m\u1EADt t\u1EF1 \u0111\u1ED9ng.<br>Email t\u1EF1 \u0111\u1ED9ng, vui l\u00F2ng kh\u00F4ng tr\u1EA3 l\u1EDDi.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

// 2. Template Link Đặt Lại Mật Khẩu
function renderResetLinkTemplate({ resetUrl, toEmail }) {
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 15px;">
      <tr><td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 35px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 35px 30px 20px 30px; text-align: center;">
              <div style="margin-bottom: 16px;">${SVG_ICONS.lockReset}</div>
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Đặt Lại Mật Khẩu</h1>
              <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                Bạn vừa yêu cầu tạo mật khẩu mới cho tài khoản <strong>${toEmail}</strong>. Nhấn vào nút bên dưới để tiến hành đổi mật khẩu:
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 30px 30px 30px; text-align: center;">
              <div style="margin: 20px 0 30px 0;">
                <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: #ffffff; text-decoration: none; padding: 14px 34px; font-size: 15px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
                  ĐẶT LẠI MẬT KHẨU
                </a>
              </div>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-align: left;">Hoặc copy đường liên kết trực tiếp:</p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; word-break: break-all; font-size: 11px; color: #4f46e5; text-align: left;">
                ${resetUrl}
              </div>
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2026 Zhee API Service Engine. Link có hiệu lực trong 15 phút.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

// 3. Template Hóa Đơn / Biến Động Số Dư
function renderInvoiceTemplate({ title, amount, content, toEmail }) {
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 15px;">
      <tr><td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 35px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 35px 30px 20px 30px; text-align: center;">
              <div style="margin-bottom: 16px;">${SVG_ICONS.invoice}</div>
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a;">${title}</h1>
              <div style="font-size: 28px; font-weight: 800; color: #16a34a; margin: 15px 0;">+${amount}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background: #f8fafc; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
                <table width="100%" style="font-size: 13px; color: #475569; line-height: 1.8;">
                  <tr><td>Chi tiết:</td><td align="right" style="color: #0f172a; font-weight: 600;">${content}</td></tr>
                  <tr><td>Thời gian:</td><td align="right" style="color: #0f172a;">${new Date().toLocaleString("vi-VN")}</td></tr>
                  <tr><td>Trạng thái:</td><td align="right" style="color: #16a34a; font-weight: 700;">Thành Công</td></tr>
                </table>
              </div>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">Hóa đơn gửi tới: <strong style="color: #334155;">${toEmail}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2026 Zhee Payment System.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

// 4. Template Cảnh Báo Bảo Mật
function renderAlertTemplate({ title, content, toEmail }) {
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 15px;">
      <tr><td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 35px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 35px 30px 20px 30px; text-align: center;">
              <div style="margin-bottom: 16px;">${SVG_ICONS.alert}</div>
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #dc2626;">${title}</h1>
              <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">Cảnh báo phát hiện hoạt động bất thường từ tài khoản <strong>${toEmail}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 6px; padding: 18px; margin-bottom: 20px;">
                <div style="font-size: 14px; color: #991b1b; line-height: 1.6;">${content}</div>
              </div>
              <p style="margin: 0; font-size: 13px; color: #64748b;">Nếu đây không phải là bạn, hãy đổi mật khẩu ngay lập tức.</p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2026 Zhee Security Protection.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

// 5. Template Thông Báo Dịch Vụ Mặc Định
function renderGeneralNotifyTemplate({ title, message, toEmail }) {
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 15px;">
      <tr><td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 35px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 35px 30px 20px 30px; text-align: center;">
              <div style="margin-bottom: 16px;">${SVG_ICONS.bell}</div>
              <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 6px; padding: 18px; margin-bottom: 20px;">
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
      </td></tr>
    </table>
  </body></html>`;
}

function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
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
  try {
    const q = new URL(fullUrl, "https://placeholder.local").searchParams;
    const mk = String(q.get("mk") || q.get("matkhau") || q.get("password") || q.get("pass") || q.get("app_password") || "").replace(/\s+/g, "");
    const inboxEmail = q.get("email") || q.get("mail") || "";
    const inboxAct = String(q.get("action") || "").toLowerCase();
    if ((inboxEmail && mk) || inboxAct === "doc" || inboxAct === "folders") {
      return checkmailHandler(req, res);
    }
  } catch (_) {}

  if (/\/temp(?:orary)?-email|\/mail\/temp-check|\/temp-mail-check/i.test(fullUrl)) {
    const email = String(new URL(fullUrl, "https://placeholder.local").searchParams.get("email") || firstParam || "").trim();
    const domain = String(email).split("@")[1]?.toLowerCase() || "";
    const disposableDomains = new Set(["10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "guerrillamail.com", "mailinator.com", "yopmail.com", "getnada.com", "sharklasers.com", "throwawaymail.com", "emailondeck.com"]);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ trang_thai: "that_bai", thong_bao: "Email chưa hợp lệ. Hãy gửi đầy đủ dạng user@domain.com, ví dụ user@10minutemail.com.", vi_du: "?email=user@10minutemail.com", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
    return res.status(200).json({ trang_thai: "thanh_cong", loai: "kiem_tra_email_rac", email, ten_mien: domain, co_phai_domain_mail_tam: disposableDomains.has(domain), ket_luan: disposableDomains.has(domain) ? "Nên chặn domain email tạm/rác này." : "Chưa nằm trong danh sách domain email tạm phổ biến; cần thêm kiểm tra xác minh email.", nguon: "Danh sách domain cục bộ", tac_gia: "Hồ Đức Minh (Zhee Dev)" });
  }

  // -------------------------------------------------------------
  // TRANG TÀI LIỆU CHUYÊN MỤC /mail (ĐẦY ĐỦ TIẾNG VIỆT CÓ DẤU)
  // -------------------------------------------------------------
  if (!firstParam || fullUrl.endsWith("/mail")) {
    return res.status(200).json({
      chuyen_muc: "Dịch Vụ Email & Thông Báo (/mail)",
      tac_gia: "Hồ Đức Minh (Zhee Dev)",
      giao_dien: "Pure SVG Vector Outline UI (No Emojis)",
      tong_so_dinh_dang: 8,
      danh_sach_cu_phap: {
        tao_mail_tam: {
          ten: "Tạo mail tạm (/mail/taomail)",
          mo_ta: "1secmail (ngắn, không mk) hoặc Mail.tm (dài, có mk). API thật như bot.php, không random domain giả.",
          cu_phap: `${baseUrl}/mail/taomail?kieu=ngan|dai`,
          vi_du: [
            `${baseUrl}/mail/taomail?kieu=ngan`,
            `${baseUrl}/mail/taomail?kieu=dai`,
            `${baseUrl}/mail/taomail?kieu=dai&so=3`,
            `${baseUrl}/mail/taomail?kieu=dai&ten=tenban&mk=Pass123`
          ]
        },
        check_hop_thu: {
          ten: "0. Check hộp thư IMAP (email + mật khẩu ứng dụng)",
          mo_ta: "Đọc tab Chính Gmail, tổng thư, nội dung theo uid. Không lưu mật khẩu.",
          cu_phap: `${baseUrl}/mail/check?email={gmail}&mk={mat_khau_ung_dung}`,
          vi_du: [
            `${baseUrl}/mail/check?email=ban@gmail.com&mk=xxxx xxxx xxxx xxxx`,
            `${baseUrl}/mail/check?email=ban@gmail.com&mk={mk}&action=doc&uid={uid}`,
            `${baseUrl}/mail?email=ban@gmail.com&mk={mk}`
          ]
        },
        gui_otp_5_phut: {
          ten: "1. Gửi Mã OTP Xác Thực / Khôi Phục (5 Phút)",
          mo_ta: "Gửi mã OTP bảo mật kèm đồng hồ đếm ngược 5 phút SVG Outline",
          cu_phap: `${baseUrl}/mail/gmail?={email}/otp/{ma_otp}/{loai: xacthuc | khoiphuc}`,
          vi_du: [
            `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/otp/849201/xacthuc`,
            `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/otp/391028/khoiphuc`
          ]
        },
        gui_link_reset_pass: {
          ten: "2. Gửi Nút Bấm Đặt Lại Mật Khẩu (Reset Password CTA)",
          mo_ta: "Gửi nút bấm chuyển hướng đặt lại mật khẩu với giao diện Gradient Button",
          cu_phap: `${baseUrl}/mail/gmail?={email}/reset/{link_url}`,
          vi_du: [
            `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/reset/https://google.com`
          ]
        },
        gui_hoa_don_thanh_toan: {
          ten: "3. Gửi Hóa Đơn & Biến Động Số Dư (Invoice)",
          mo_ta: "Gửi hóa đơn nạp tiền/thanh toán hiển thị số tiền và thời gian thực",
          cu_phap: `${baseUrl}/mail/gmail?={email}/invoice/{tieu_de}/{so_tien}/{noi_dung}`,
          vi_du: [
            `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/invoice/Nạp Tiền Thành Công/500,000 VNĐ/Thanh toán đơn hàng thành công qua MBBank`
          ]
        },
        gui_canh_bao_bao_mat: {
          ten: "4. Gửi Cảnh Báo Bảo Mật (Security Alert)",
          mo_ta: "Gửi cảnh báo phát hiện đăng nhập bất thường hoặc truy cập lạ",
          cu_phap: `${baseUrl}/mail/gmail?={email}/alert/{tieu_de}/{noi_dung_canh_bao}`,
          vi_du: [
            `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/alert/Cảnh Báo Đăng Nhập Lạ/Phát hiện đăng nhập bất thường từ địa chỉ IP 14.232.11.9 tại Hà Nội`
          ]
        },
        gui_thong_bao_chung: {
          ten: "5. Gửi Thông Báo Dịch Vụ Chung (Notification)",
          mo_ta: "Gửi email thông báo hệ thống với khung viền tin nhắn",
          cu_phap: `${baseUrl}/mail/gmail?={email}/notify/{tieu_de}/{noi_dung}`,
          vi_du: [
            `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com/notify/Bảo Trì Hệ Thống/Hệ thống sẽ bảo trì nâng cấp cụm máy chủ vào 0h đêm nay`
          ]
        },
        check_tai_khoan_gmail: {
          ten: "6. Check Thông Tin Tài Khoản Gmail",
          mo_ta: "Bóc tách tên người dùng, tên miền và lấy ảnh đại diện Gravatar",
          cu_phap: `${baseUrl}/mail/gmail?={email}`,
          vi_du: [
            `${baseUrl}/mail/gmail?=hoducminhdz1@gmail.com`
          ]
        }
      }
    });
  }

  try {
    // -------------------------------------------------------------
    // XỬ LÝ GỬI EMAIL THEO ĐỊNH DẠNG
    // -------------------------------------------------------------
    if (firstParam.includes("/")) {
      const parts = firstParam.split("/").filter((p, index, arr) => !(index === arr.length - 1 && p === ""));
      const toEmail = parts[0]?.trim();
      const rawAction = parts[1] || "";
      const actionType = removeVietnameseTones(rawAction);

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
        const otpType = removeVietnameseTones(parts[3] || "xacthuc");
        emailSubject = (otpType.includes("khoi") || otpType.includes("phuc") || otpType.includes("reset")) 
          ? `[Khôi Phục Mật Khẩu] Mã OTP: ${otpCode}` 
          : `[Xác Thực Tài Khoản] Mã OTP: ${otpCode}`;
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
      // 3. Chế độ Invoice / Hóa đơn
      else if (actionType === "invoice" || actionType === "bill" || actionType.includes("hoadon")) {
        const title = parts[2]?.trim() || "Hóa Đơn Thanh Toán";
        const amount = parts[3]?.trim() || "0 VNĐ";
        const content = parts.slice(4).join("/") || "Giao dịch thanh toán dịch vụ";
        emailSubject = `[Hóa Đơn] ${title} (+${amount})`;
        emailHtml = renderInvoiceTemplate({ title, amount, content, toEmail });
        mode = "invoice_notification";
      }
      // 4. Chế độ Cảnh báo Alert
      else if (actionType === "alert" || actionType === "warning" || actionType.includes("canhbao")) {
        const title = parts[2]?.trim() || "Cảnh Báo Bảo Mật";
        const content = parts.slice(3).join("/") || "Phát hiện hoạt động bất thường từ tài khoản của bạn.";
        emailSubject = `[Cảnh Báo] ${title}`;
        emailHtml = renderAlertTemplate({ title, content, toEmail });
        mode = "security_alert";
      }
      // 5. Chế độ Thông Báo Notify
      else if (actionType === "notify" || actionType.includes("thongbao")) {
        const subject = parts[2]?.trim() || "Thông báo từ hệ thống";
        const message = parts.slice(3).join("/") || "Nội dung thông báo mặc định.";
        emailSubject = subject;
        emailHtml = renderGeneralNotifyTemplate({ title: subject, message, toEmail });
        mode = "general_notification";
      }
      // 6. Chế độ Lặp chu kỳ: {email}/{tieu_de}/{noi_dung}/{so_lan}/{delay_ms}
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

      // Gửi email
      await transporter.sendMail({
        from: `"Zhee System" <${GMAIL_USER}>`,
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
          template_ui: "Zhee Premium Dark Gradient UI"
        }
      });
    }

    // -------------------------------------------------------------
    // CHECK TÀI KHOẢN GMAIL
    // -------------------------------------------------------------
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
        la_gmail_chuan: domainPart.toLowerCase() === "gmail.com",
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