# Zhee API — Cổng REST API công khai

> **Zhee API** là bộ API công khai đa chức năng được phát triển bởi **Hồ Đức Minh (Zhee Dev)**: AI, mạng xã hội, media downloader, tra cứu IP, NASA, Free Fire, web utilities, mail và nhiều tiện ích khác.

[![API](https://img.shields.io/badge/API-REST-2563eb?style=flat-square)](https://api-zhee.vercel.app/list) [![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/) [![Author](https://img.shields.io/badge/Author-Hồ%20Đức%20Minh-111827?style=flat-square)](https://api-zhee.vercel.app/)

**Từ khóa SEO:** Zhee API, REST API Việt Nam, API miễn phí, API tra cứu IP, NASA API, Free Fire UID, TikTok downloader, GitHub lookup, mạng xã hội, AI API, Hồ Đức Minh.

## Mục lục

- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Quy tắc sử dụng](#quy-tắc-sử-dụng)
- [Các endpoint nổi bật](#các-endpoint-nổi-bật)
- [Danh mục đầy đủ từng API](#danh-mục-đầy-đủ-từng-api)
- [Tác giả](#tác-giả)

## Bắt đầu nhanh

Base URL:

```text
https://api-zhee.vercel.app
```

Ví dụ gọi API bằng `curl`:

```bash
curl "https://api-zhee.vercel.app/ipcheck?ip=8.8.8.8"
```

Danh sách API dạng JSON:

```text
GET https://api-zhee.vercel.app/list
GET https://api-zhee.vercel.app/tools
GET https://api-zhee.vercel.app/mxh
```

## Cài đặt và chạy trên máy cá nhân

### Yêu cầu hệ thống

- Git
- Node.js **22.x** hoặc mới hơn
- npm đi kèm Node.js

### Clone repository

```bash
git clone https://github.com/zheedevVn/api-zhee.git
cd api-zhee
```

### Cài dependencies

```bash
npm install
```

### Cấu hình biến môi trường

Tạo file `.env` ở thư mục gốc project. Không commit file này lên GitHub.

```env
# IPStack — bắt buộc nếu dùng /ipcheck
IPSTACK_API_KEY=your_ipstack_api_key

# NASA — bắt buộc nếu dùng /nasa
NASA_API_KEY=your_nasa_api_key

# YouTube Data API v3 — bắt buộc cho /api/yt/trending-vn và /api/yt/channel-stats
YOUTUBE_API_KEY=your_google_cloud_youtube_data_api_key

# Twitch — tùy chọn
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# Twilio — tùy chọn cho phone lookup
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Bitly — tùy chọn; dùng khi gọi URL Shortener với provider=bitly
BITLY_ACCESS_TOKEN=your_bitly_access_token

# Telegram API Bot — bắt buộc nếu dùng bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_IDS=123456789
PUBLIC_BASE_URL=https://api-zhee.vercel.app

# Upstash Redis — khuyến nghị để lưu license bền vững trên Vercel
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

Các biến không cần dùng có thể bỏ trống. Không đưa API key thật vào source code, README hoặc commit Git.

### Chạy API gateway

```bash
npm start
```

Server mặc định chạy tại:

```text
http://localhost:3000
```

Thử nhanh sau khi chạy:

```bash
curl "http://localhost:3000/ipcheck?ip=8.8.8.8"
curl "http://localhost:3000/list"
curl "http://localhost:3000/tools"
```

### Chạy giao diện tĩnh riêng

Nếu chỉ muốn xem giao diện tài liệu:

```bash
python3 -m http.server 4173 --directory public
```

Mở trình duyệt tại:

```text
http://localhost:4173/index.html
```

### Chạy bằng Docker hoặc deploy Vercel

Project dùng entrypoint `api/server.js` và đã có `vercel.json`. Có thể import repository trực tiếp vào Vercel, sau đó thêm các Environment Variables giống phần trên trước khi deploy Production.

## Quy tắc sử dụng

- Sử dụng HTTPS và encode các giá trị có dấu cách hoặc ký tự đặc biệt bằng `encodeURIComponent`.
- Không gửi API key, mật khẩu, cookie, token hoặc secret của người dùng vào nơi công khai.
- API có thể giới hạn tốc độ hoặc phụ thuộc vào trạng thái của dịch vụ upstream.
- Các endpoint trả JSON UTF-8; hãy kiểm tra HTTP status trước khi parse dữ liệu.
- Tác giả không đảm bảo dữ liệu upstream luôn sẵn sàng hoặc chính xác tuyệt đối.

Mỗi endpoint công khai chỉ gọi được qua cổng `/g/` với một chuỗi khóa rất dài, bắt đầu bằng `AIzaSy`. Đường dẫn ngắn như `/tools/freefire` trả về 404. Chuỗi khóa của từng công cụ là cố định; copy nguyên URL trên trang chủ để gọi.

## Các endpoint nổi bật

| Chức năng | Cách gọi |
|---|---|
| Tra cứu IP IPv4/IPv6 | `GET /ipcheck?ip=8.8.8.8` |
| NASA APOD | `GET /nasa?action=apod` |
| NASA NEO | `GET /nasa?action=neo&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` |
| Free Fire UID | `GET /tools/freefire?uid=86744126` |
| GitHub profile | `GET /github?=hoducminh123` |
| Twitch channel | `GET /twitch?=shroud` |
| TikTok | `GET /tiktok?=tiktok` |
| YouTube | `GET /youtube?v=dQw4w9WgXcQ` |
| Check phone | `GET /tools/checksdt?=0944921186` |

### Ví dụ response thành công

```json
{
  "trang_thai": "thanh_cong",
  "loai": "...",
  "tac_gia": "Hồ Đức Minh (Zhee Dev)"
}
```

## Mạng xã hội & nền tảng

Các nền tảng dưới đây được hiển thị bằng icon thương hiệu và có endpoint riêng trong Zhee API.

<table>
  <tr>
    <td align="center"><a href="https://api-zhee.vercel.app/spotify"><img src="https://cdn.simpleicons.org/spotify/1DB954" width="32" alt="Spotify"><br><sub><b>Spotify</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/soundcloud"><img src="https://cdn.simpleicons.org/soundcloud/FF5500" width="32" alt="SoundCloud"><br><sub><b>SoundCloud</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/instagram"><img src="https://cdn.simpleicons.org/instagram/E4405F" width="32" alt="Instagram"><br><sub><b>Instagram</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/tiktok"><img src="https://cdn.simpleicons.org/tiktok/FFFFFF" width="32" alt="TikTok"><br><sub><b>TikTok</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/twitch"><img src="https://cdn.simpleicons.org/twitch/9146FF" width="32" alt="Twitch"><br><sub><b>Twitch</b></sub></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://api-zhee.vercel.app/youtube"><img src="https://cdn.simpleicons.org/youtube/FF0000" width="32" alt="YouTube"><br><sub><b>YouTube</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/discord"><img src="https://cdn.simpleicons.org/discord/5865F2" width="32" alt="Discord"><br><sub><b>Discord</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/telegram"><img src="https://cdn.simpleicons.org/telegram/26A5E4" width="32" alt="Telegram"><br><sub><b>Telegram</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/twitter"><img src="https://cdn.simpleicons.org/x/FFFFFF" width="32" alt="X"><br><sub><b>X / Twitter</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/facebook"><img src="https://cdn.simpleicons.org/facebook/1877F2" width="32" alt="Facebook"><br><sub><b>Facebook</b></sub></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://api-zhee.vercel.app/github"><img src="https://cdn.simpleicons.org/github/F0F6FC" width="32" alt="GitHub"><br><sub><b>GitHub</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/roblox"><img src="https://cdn.simpleicons.org/roblox/FFFFFF" width="32" alt="Roblox"><br><sub><b>Roblox</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/zalo"><img src="https://cdn.simpleicons.org/zalo/0068FF" width="32" alt="Zalo"><br><sub><b>Zalo</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/shopee"><img src="https://cdn.simpleicons.org/shopee/EE4D2D" width="32" alt="Shopee"><br><sub><b>Shopee</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/pinterest"><img src="https://cdn.simpleicons.org/pinterest/BD081C" width="32" alt="Pinterest"><br><sub><b>Pinterest</b></sub></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://api-zhee.vercel.app/mega"><img src="https://cdn.simpleicons.org/mega/FF333A" width="32" alt="MEGA"><br><sub><b>MEGA</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/lazada"><img src="https://www.lazada.vn/favicon.ico" width="32" alt="Lazada"><br><sub><b>Lazada</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/tiki"><img src="https://www.google.com/s2/favicons?domain=tiki.vn&sz=64" width="32" alt="Tiki"><br><sub><b>Tiki</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/locket"><img src="https://locket.camera/favicon.ico" width="32" alt="Locket"><br><sub><b>Locket</b></sub></a></td>
    <td align="center"><a href="https://api-zhee.vercel.app/ngl"><img src="https://www.google.com/s2/favicons?domain=ngl.link&sz=64" width="32" alt="NGL"><br><sub><b>NGL</b></sub></a></td>
  </tr>
</table>

## Liên hệ hỗ trợ

<table>
  <tr>
    <td width="70"><img src="https://cdn.simpleicons.org/telegram/26A5E4" width="42" alt="Telegram"></td>
    <td><strong>Hỗ trợ tích hợp API</strong><br>Gửi câu hỏi, báo lỗi endpoint hoặc yêu cầu hỗ trợ kỹ thuật trực tiếp cho Hồ Đức Minh.</td>
    <td align="right"><a href="https://t.me/zheevipv1"><strong>Liên hệ Telegram</strong></a></td>
  </tr>
</table>

## Danh mục đầy đủ từng API

Tổng cộng **52 route tài liệu** đang được đăng ký trong gateway.

### Cloud Storage

<details>
<summary><strong>MEGA Public File & Folder Inspector</strong> — <code>/api/mxh/mega</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Kiểm tra metadata file/folder MEGA được chia sẻ công khai; không tra cứu danh tính user hay nhận mật khẩu/cookie.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/mega?url=https://mega.nz/file/{id}#{key})
- **Alias hỗ trợ:** `/api/mxh/mega`, `/mxh/mega`, `/mega`

</details>

### Download

<details>
<summary><strong>Media Downloader Đa Nền Tảng</strong> — <code>/downloads</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Bóc tách link video không logo, audio chất lượng cao.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/downloads?url=https://www.tiktok.com/@example/video/123456789)
- **Alias hỗ trợ:** `/downloads`, `/api/downloads`

</details>

### Fintech

<details>
<summary><strong>Tra Cứu & Tạo Mã VietQR Ngân Hàng</strong> — <code>/bank</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tạo QR thanh toán tự động theo chuẩn Napas 247 và tra cứu BIN.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/bank?bank=MBBank&acc=0987654321&amount=50000&memo=ZheePayment)
- **Alias hỗ trợ:** `/bank`, `/api/bank`

</details>

### Gaming

<details>
<summary><strong>Roblox User Lookup</strong> — <code>/api/mxh/roblox</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu thông tin hồ sơ Roblox (tiểu sử, avatar 3D toàn thân).
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/roblox?=Roblox)
- **Alias hỗ trợ:** `/api/mxh/roblox`, `/mxh/roblox`, `/roblox`

</details>

### Gaming & Probability

<details>
<summary><strong>789Club Tai Xiu & Sicbo MD5 Engine</strong> — <code>/api/taixiu/789club</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Chuyên mục soi cầu và đối soát chuỗi MD5 bàn Tài Xỉu / Sicbo Las Vegas cổng game 789Club.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu/789club?=b87c550e3fb2cde381fa06886b772498)
- **Alias hỗ trợ:** `/api/taixiu/789club`, `/taixiu/789club`, `/789club`, `/api/789club`

</details>

<details>
<summary><strong>B52 Club Volta & Tai Xiu MD5 Engine</strong> — <code>/api/taixiu/b52club</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Chuyên mục soi cầu và đối soát chuỗi MD5 bàn bóng đá Volta & Tài Xỉu cổng game B52 Club.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu/b52club?=50e0087bc111acab077a5b3a82f3a612)
- **Alias hỗ trợ:** `/api/taixiu/b52club`, `/taixiu/b52club`, `/b52club`, `/api/b52club`, `/b52`

</details>

<details>
<summary><strong>Hitclub Tai Xiu & Sicbo Engine</strong> — <code>/api/taixiu/hitclub</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Chuyên mục soi cầu và đối soát chuỗi SHA-256 / MD5 đa sảnh game Hitclub.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu/hitclub?=6882d5f4f6d1b78c2cd3e226384ca20c2c0aa118c6ca2556098dcb142d1e4f1f)
- **Alias hỗ trợ:** `/api/taixiu/hitclub`, `/taixiu/hitclub`, `/hitclub`, `/api/hitclub`

</details>

<details>
<summary><strong>SUKA88 — Baccarat (BCR)</strong> — <code>/api/taixiu/suka88/bcr</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Sảnh Baccarat cổng SUKA88: chia bài Con/Cái, chỉ định, luật điểm.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu/suka88/bcr?action=random&key=minhhocgioi)
- **Alias hỗ trợ:** `/api/taixiu/suka88/bcr`, `/taixiu/suka88/bcr`, `/suka88/bcr`, `/api/suka88/bcr`, `/api/taixiu/suka88/baccarat`, `/taixiu/suka88/baccarat`, `/suka88/baccarat`, `/api/suka88/baccarat`, `/api/taixiu/bcr`, `/taixiu/bcr`, `/bcr`, `/api/bcr`, `/taixiu/baccarat`, `/baccarat`, `/api/baccarat`

</details>

<details>
<summary><strong>SUKA88 — Bài Tây 52 Lá</strong> — <code>/api/taixiu/suka88/bai</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Sảnh bài Tây cổng SUKA88: random 1/2/3 lá, chỉ định, thông tin từng lá.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu/suka88/bai?so=3&key=minhhocgioi)
- **Alias hỗ trợ:** `/api/taixiu/suka88/bai`, `/taixiu/suka88/bai`, `/suka88/bai`, `/api/suka88/bai`, `/api/taixiu/bai`, `/taixiu/bai`, `/bai`, `/api/bai`, `/api/tools/bai`, `/tools/bai`, `/api/tools/cards`, `/tools/cards`, `/cards`

</details>

<details>
<summary><strong>SUKA88 — Bầu Cua Tôm Cá</strong> — <code>/api/taixiu/suka88/baucua</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Sảnh Bầu Cua cổng SUKA88: lắc 3 viên Nai/Bầu/Gà/Cá/Cua/Tôm.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu/suka88/baucua?so=3&key=minhhocgioi)
- **Alias hỗ trợ:** `/api/taixiu/suka88/baucua`, `/taixiu/suka88/baucua`, `/suka88/baucua`, `/api/suka88/baucua`, `/api/taixiu/baucua`, `/taixiu/baucua`, `/baucua`, `/api/baucua`, `/taixiu/bct`, `/bct`, `/suka88/bct`

</details>

<details>
<summary><strong>SUKA88 Game Engine & Provably Fair Simulator</strong> — <code>/api/taixiu/suka88</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Cổng SUKA88: Tài Xỉu, Bài Tây, Bầu Cua, Baccarat. Tự tạo, cần API key khi chơi.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu/suka88?=roll&key=minhhocgioi)
- **Alias hỗ trợ:** `/api/taixiu/suka88`, `/taixiu/suka88`, `/suka88`, `/api/suka88`

</details>

<details>
<summary><strong>Sunwin Tai Xiu & Sicbo MD5 Engine</strong> — <code>/api/taixiu/sunwin</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Chuyên mục soi cầu và đối soát chuỗi MD5 bàn Tài Xỉu / Sicbo Hoàng Gia cổng game Sunwin.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu/sunwin?=d8cf242b85bed14f7816102c765fa711)
- **Alias hỗ trợ:** `/api/taixiu/sunwin`, `/taixiu/sunwin`, `/sunwin`, `/api/sunwin`

</details>

<details>
<summary><strong>Trung Tâm API Tài Xỉu & Xác Suất</strong> — <code>/api/taixiu</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Danh mục: B52, 789Club, Sunwin, Hitclub và cổng SUKA88 (Tài Xỉu, Bài, Bầu Cua, Baccarat).
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/taixiu)
- **Alias hỗ trợ:** `/api/taixiu`, `/taixiu`

</details>

### Mail Service

<details>
<summary><strong>Check hộp thư IMAP (/mail/check)</strong> — <code>/mail/check</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Đọc trang hộp thư đang hiện + tổng thư nhận. Các mục: hộp thư đến, sao, đã gửi, nháp...
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/mail/check?email={gmail}&mk={mat_khau_ung_dung})
- **Alias hỗ trợ:** `/mail/check`, `/api/mail/check`, `/mail/hopthu`, `/api/mail/hopthu`, `/mail/inbox`, `/api/mail/inbox`, `/api/tools/checkmail`, `/tools/checkmail`, `/checkmail`

</details>

<details>
<summary><strong>Dịch Vụ Mail: gửi OTP & check hộp thư</strong> — <code>/mail</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Gửi OTP/hóa đơn; check hộp thư IMAP tại /mail/check (email + mật khẩu ứng dụng).
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/mail)
- **Alias hỗ trợ:** `/mail`, `/api/mail`

</details>

<details>
<summary><strong>Tạo mail tạm (1secmail / Mail.tm)</strong> — <code>/mail/taomail</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tạo hộp thư tạm thật: kieu=ngan (1secmail), kieu=dai (Mail.tm). Không copy bot Telegram.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/mail/taomail?kieu=dai)
- **Alias hỗ trợ:** `/mail/taomail`, `/api/mail/taomail`, `/taomail`, `/api/taomail`

</details>

### Mạng Xã Hội

<details>
<summary><strong>Discord Lookup & Checker</strong> — <code>/api/mxh/discord</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu thông tin tài khoản qua Token, User ID hoặc server link mời.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/discord?=156114103282368512)
- **Alias hỗ trợ:** `/api/mxh/discord`, `/mxh/discord`, `/discord`

</details>

<details>
<summary><strong>Facebook Profile & Downloader</strong> — <code>/api/mxh/facebook</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tìm UID, lấy Avatar HD hoặc tải video MP4.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/facebook?=https://facebook.com/zuck)
- **Alias hỗ trợ:** `/api/mxh/facebook`, `/mxh/facebook`, `/facebook`

</details>

<details>
<summary><strong>GitHub Info & Repos</strong> — <code>/api/mxh/github</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Lấy thông tin cá nhân và danh sách kho lưu trữ GitHub.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/github?=hoducminh123)
- **Alias hỗ trợ:** `/api/mxh/github`, `/mxh/github`, `/github`

</details>

<details>
<summary><strong>Instagram Profile Lookup</strong> — <code>/api/mxh/instagram</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu avatar HD, bio, người theo dõi, số bài viết và tích xanh Instagram.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/instagram?username=cristiano)
- **Alias hỗ trợ:** `/api/mxh/instagram`, `/mxh/instagram`, `/instagram`, `/ig`

</details>

<details>
<summary><strong>Lazada Shop & Product Lookup</strong> — <code>/api/mxh/lazada</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu dữ liệu Lazada công khai theo shop slug, seller ID hoặc link sản phẩm; không nhận mật khẩu/cookie/session.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/lazada?=https://www.lazada.vn/shop/{slug}/)
- **Alias hỗ trợ:** `/api/mxh/lazada`, `/mxh/lazada`, `/lazada`

</details>

<details>
<summary><strong>Locket Username Lookup & Account Tools</strong> — <code>/api/tools/locket</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Check username Locket công khai; đăng nhập token/email/SĐT để lấy thông tin tài khoản, bạn bè, moment, gửi/hủy 1 lời mời, tạo 1 tài khoản / 5 phút.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/locket?=minh)
- **Alias hỗ trợ:** `/api/tools/locket`, `/tools/locket`, `/locket`, `/api/locket`

</details>

<details>
<summary><strong>Mạng Xã Hội & Game Platforms</strong> — <code>/mxh</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Trang tài liệu tổng hợp danh mục các công cụ mạng xã hội & game.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/mxh)
- **Alias hỗ trợ:** `/mxh`, `/api/mxh`

</details>

<details>
<summary><strong>NGL Username Lookup & One-shot Anonymous Message</strong> — <code>/api/tools/ngl</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Check username NGL.link và gửi đúng 1 tin nhắn ẩn danh mỗi lần. Không hỗ trợ spam / multi-thread.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/ngl?=hoducminh)
- **Alias hỗ trợ:** `/api/tools/ngl`, `/tools/ngl`, `/ngl`, `/api/ngl`

</details>

<details>
<summary><strong>Pinterest Profile, Pin & Board Lookup</strong> — <code>/api/mxh/pinterest</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu hồ sơ Pinterest (followers, pins, boards, avatar, bio), chi tiết Pin và bảng ghim.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/pinterest?=pinterest)
- **Alias hỗ trợ:** `/api/mxh/pinterest`, `/mxh/pinterest`, `/pinterest`

</details>

<details>
<summary><strong>Shopee Shop & Account Lookup</strong> — <code>/api/mxh/shopee</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu gian hàng Shopee theo username, shopid hoặc link shop (tên, followers, rating, Mall).
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/shopee?=apple_flagship_store)
- **Alias hỗ trợ:** `/api/mxh/shopee`, `/mxh/shopee`, `/shopee`

</details>

<details>
<summary><strong>SoundCloud Music & User Profile Lookup</strong> — <code>/api/mxh/soundcloud</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu bài hát, profile tác giả kèm 10 track mới nhất, ảnh bìa HD và link stream audio từ SoundCloud.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/soundcloud?q=Cat Doi Noi Sau)
- **Alias hỗ trợ:** `/api/mxh/soundcloud`, `/mxh/soundcloud`, `/soundcloud`

</details>

<details>
<summary><strong>Spotify Track, Lyrics & Artist Profile Lookup</strong> — <code>/api/mxh/spotify</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu bài hát, ca sĩ, profile nghệ sĩ kèm Top 10 track nổi bật, lyrics và link stream từ Spotify.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/spotify?q=Son Tung M-TP)
- **Alias hỗ trợ:** `/api/mxh/spotify`, `/mxh/spotify`, `/spotify`

</details>

<details>
<summary><strong>Telegram Lookup</strong> — <code>/api/mxh/telegram</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu thông tin tài khoản, bot qua Token, nhóm/kênh Telegram.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/telegram?=durov)
- **Alias hỗ trợ:** `/api/mxh/telegram`, `/mxh/telegram`, `/telegram`

</details>

<details>
<summary><strong>Tiki Account, Shop & Product Lookup</strong> — <code>/api/mxh/tiki</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu dữ liệu Tiki công khai theo product ID, link sản phẩm, shop hoặc slug; không nhận mật khẩu/cookie/session.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/tiki?=198944761)
- **Alias hỗ trợ:** `/api/mxh/tiki`, `/mxh/tiki`, `/tiki`

</details>

<details>
<summary><strong>TikTok Profile & Downloader</strong> — <code>/api/mxh/tiktok</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Lấy thông tin profile hoặc tải video TikTok không watermark.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/tiktok?=tiktok)
- **Alias hỗ trợ:** `/api/mxh/tiktok`, `/mxh/tiktok`, `/tiktok`

</details>

<details>
<summary><strong>Twitch Channel, Live Stream, VOD & Clips Lookup</strong> — <code>/api/mxh/twitch</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu thông tin công khai của kênh Twitch gồm profile, trạng thái livestream, danh mục, VOD và clips gần đây.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/twitch?=shroud)
- **Alias hỗ trợ:** `/api/mxh/twitch`, `/mxh/twitch`, `/twitch`

</details>

<details>
<summary><strong>Twitter (X) Profile & Video Downloader</strong> — <code>/api/mxh/twitter</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu profile hoặc tải video Tweet nền tảng X.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/twitter?=elonmusk)
- **Alias hỗ trợ:** `/api/mxh/twitter`, `/mxh/twitter`, `/twitter`, `/x`

</details>

<details>
<summary><strong>Zalo Account & Session Checker</strong> — <code>/api/mxh/zalo</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu nhóm Zalo, chuẩn hóa SĐT hoặc check tài khoản qua Cookie/IMEI.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/zalo?=0912345678)
- **Alias hỗ trợ:** `/api/mxh/zalo`, `/mxh/zalo`, `/zalo`

</details>

### Media

<details>
<summary><strong>YouTube Channel & Video Stream</strong> — <code>/api/mxh/youtube</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Lấy thông tin kênh hoặc link stream video MP4/MP3.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/mxh/youtube?=@SonTungMTP)
- **Alias hỗ trợ:** `/api/mxh/youtube`, `/mxh/youtube`, `/youtube`

</details>

### Tools & AI

<details>
<summary><strong>AI Background Remover</strong> — <code>/tools/removebg</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Xóa nền ảnh tự động bằng engine Remove.bg Pro.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/tools/removebg?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg)
- **Alias hỗ trợ:** `/tools/removebg`, `/api/tools/removebg`

</details>

<details>
<summary><strong>AI Chat Assistant (Gemini & ChatGPT)</strong> — <code>/tools/chat</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Hỏi đáp AI đàm thoại hỗ trợ Google Gemini và OpenAI ChatGPT.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/tools/chat?q=xin chào bạn&model=gemini)
- **Alias hỗ trợ:** `/tools/chat`, `/api/tools/chat`

</details>

<details>
<summary><strong>AI Image Enhancer (HD 2K/4K)</strong> — <code>/tools/enhance</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Làm nét, khử mờ và tăng độ phân giải hình ảnh.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/tools/enhance?url=https://photo360.com/uploads/worigin/2018/08/16/logo-avatar-game-lien-quan-mobile5b7543dc6943f_485f7a07eaecddff272fdbdbb5ef5c20.jpg)
- **Alias hỗ trợ:** `/tools/enhance`, `/api/tools/enhance`

</details>

<details>
<summary><strong>Công Cụ & Tiện Ích Đa Năng AI</strong> — <code>/tools</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tài liệu danh mục các công cụ tiện ích AI.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/tools)
- **Alias hỗ trợ:** `/tools`, `/api/tools`

</details>

<details>
<summary><strong>Free Fire Player Info</strong> — <code>/tools/freefire</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu thông tin tài khoản Free Fire (Nickname, Region, UID).
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/tools/freefire?uid=86744126)
- **Alias hỗ trợ:** `/tools/freefire`, `/api/tools/freefire`

</details>

<details>
<summary><strong>IP Address Intelligence (IPStack)</strong> — <code>/api/tools/ipcheck</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu vị trí, quốc gia, múi giờ, nhà mạng, ASN và các tín hiệu proxy/Tor/crawler của IPv4 hoặc IPv6 qua IPStack.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/ipcheck?ip=113.175.232.110)
- **Alias hỗ trợ:** `/api/tools/ipcheck`, `/tools/ipcheck`, `/ipcheck`

</details>

<details>
<summary><strong>NASA Space Data & Astronomy Lookup</strong> — <code>/api/tools/nasa</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu APOD, vật thể gần Trái Đất, EPIC và DONKI từ NASA Open APIs. NASA đã lưu trữ Mars Rover Photos API.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/nasa?action=apod)
- **Alias hỗ trợ:** `/api/tools/nasa`, `/tools/nasa`, `/nasa`

</details>

<details>
<summary><strong>ZheeTool Key Manager</strong> — <code>/tools/key</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tạo, check hạn dùng, lượt dùng key qua HMAC-SHA256 & Session IP.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/tools/key?action=check&key=ZheeTool-UQ6KS-A324-ZVUSV-6B3P-6Z91-UXI)
- **Alias hỗ trợ:** `/tools/key`, `/api/tools/key`

</details>

### Tools & Utilities

<details>
<summary><strong>Check API Key AI</strong> — <code>/api/tools/checkkeyai</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Check key AI còn hạn, module/model dùng được, quota/token/credit còn lại.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/checkkeyai?key={api_key})
- **Alias hỗ trợ:** `/api/tools/checkkeyai`, `/tools/checkkeyai`, `/checkkeyai`, `/api/checkkeyai`, `/api/tools/aikey`, `/tools/aikey`, `/aikey`, `/api/tools/apikey`, `/tools/apikey`, `/apikey`, `/api/tools/checkkey`, `/tools/checkkey`

</details>

<details>
<summary><strong>Check IMEI & iOS Apple Device Inspector</strong> — <code>/api/tools/checkimei</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu thông tin thiết bị Apple iOS qua IMEI, Serial, Model Number.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/checkimei?=MLXJ3VN/A)
- **Alias hỗ trợ:** `/api/tools/checkimei`, `/tools/checkimei`, `/checkimei`, `/api/checkimei`

</details>

<details>
<summary><strong>Check Phone Number Intelligence (Twilio Lookups V2)</strong> — <code>/api/tools/checksdt</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu thông tin nhà mạng, loại thuê bao, quốc gia, SIM Swap và chuyển tiếp cuộc gọi.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/checksdt?=0944921186)
- **Alias hỗ trợ:** `/api/tools/checksdt`, `/tools/checksdt`, `/checksdt`, `/api/checksdt`

</details>

<details>
<summary><strong>Checkscam — Thông tin bị báo cáo</strong> — <code>/api/tools/checkscam</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Tra cứu STK, SĐT, họ tên đã bị tố cáo/báo cáo lừa đảo.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/checkscam?=1903456789)
- **Alias hỗ trợ:** `/api/tools/checkscam`, `/tools/checkscam`, `/checkscam`, `/api/checkscam`, `/api/tools/gdv`, `/tools/gdv`, `/gdv`

</details>

<details>
<summary><strong>Dịch Thuật Đa Ngôn Ngữ</strong> — <code>/api/tools/trans</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Dịch văn bản mọi ngôn ngữ (tự nhận diện nguồn, mặc định sang tiếng Việt). Có voice: văn bản sang giọng nói MP3.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/trans?=Hello, how are you?)
- **Alias hỗ trợ:** `/api/tools/trans`, `/tools/trans`, `/trans`, `/api/trans`, `/api/tools/translate`, `/tools/translate`

</details>

<details>
<summary><strong>Tạo Captcha Ảnh</strong> — <code>/api/tools/captcha</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Sinh captcha méo chữ kèm token đối chiếu. Không giải captcha website khác.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/api/tools/captcha)
- **Alias hỗ trợ:** `/api/tools/captcha`, `/tools/captcha`, `/captcha`, `/api/captcha`

</details>

### Web Utilities

<details>
<summary><strong>Check Endpoint / API của Website</strong> — <code>/web/endpoint</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Quét HTML/JS để liệt kê URL API mà trang khai báo. Không bắt live request như DevTools.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/web/endpoint?=https://vietqr.io)
- **Alias hỗ trợ:** `/web/endpoint`, `/api/web/endpoint`, `/web/api`, `/api/web/api`

</details>

<details>
<summary><strong>Check Tên Miền Tồn Tại</strong> — <code>/web/domain</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Kiểm tra tên miền đã đăng ký hay còn trống (DNS + RDAP).
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/web/domain?=google.com)
- **Alias hỗ trợ:** `/web/domain`, `/api/web/domain`, `/domain`, `/api/domain`

</details>

<details>
<summary><strong>Quản Trị Mạng & Công Cụ Website</strong> — <code>/web</code></summary>

- **Phương thức:** `GET`
- **Mô tả:** Kiểm tra DNS, Ping IP, Whois domain và SSL cert.
- **Ví dụ:** [Mở endpoint](https://api-zhee.vercel.app/web?domain=google.com)
- **Alias hỗ trợ:** `/web`, `/api/web`

</details>

## Tác giả

**Hồ Đức Minh (Zhee Dev)**

- Website: https://api-zhee.vercel.app/
- Telegram: https://t.me/zheevipv1
- API directory: https://api-zhee.vercel.app/list

---

> Nếu sử dụng lại, vui lòng ghi credit **Hồ Đức Minh (Zhee Dev)**.
