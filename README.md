<p align="center">
  <img src="https://api-zhee.vercel.app/favicon.png" width="96" height="96" alt="Zhee API Logo">
</p>

<h1 align="center">Zhee API — Cổng REST API Siêu Tốc & Đa Năng</h1>

<p align="center">
  <b>Cổng REST API hiệu năng cao của Hồ Đức Minh (Zhee Dev)</b><br>
  Tài xỉu MD5 & xác suất game, TikTok Session ID & Downloader, Mail tạm & IMAP OTP, Mạng xã hội, Tiện ích lập trình AI, Tra cứu dữ liệu và Thanh toán tự động VietQR MB Bank.
</p>

<p align="center">
  <a href="https://api-zhee.vercel.app/"><img src="https://img.shields.io/badge/Website-api--zhee.vercel.app-0284c7?style=for-the-badge&logo=vercel&logoColor=white" alt="Website"></a>
  <a href="https://api-zhee.vercel.app/list"><img src="https://img.shields.io/badge/Endpoints-71%2B%20APIs-10b981?style=for-the-badge" alt="Endpoints"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://t.me/zheevipv1"><img src="https://img.shields.io/badge/Telegram-@zheevipv1-26a5e4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Uptime-99.98%25-brightgreen?style=flat-square" alt="Uptime">
  <img src="https://img.shields.io/badge/Latency-%3C50ms%20RAM-blue?style=flat-square" alt="Latency">
  <img src="https://img.shields.io/badge/Security-HMAC--SHA256-blueviolet?style=flat-square" alt="Security">
  <img src="https://img.shields.io/badge/Payment-VietQR%20MB%20Bank-orange?style=flat-square" alt="Payment">
  <img src="https://img.shields.io/badge/Author-Hồ%20Đức%20Minh-111827?style=flat-square" alt="Author">
</p>

---

## 📑 Mục lục

1. [Điểm nổi bật](#-điểm-nổi-bật)
2. [Bắt đầu nhanh (Quickstart)](#-bắt-đầu-nhanh-quickstart)
3. [Cơ chế xác thực & Secret Key](#-cơ-chế-xác-thực--secret-key)
4. [Hệ thống nạp tiền & Ví Napas 247 MB Bank](#-hệ-thống-nạp-tiền--ví-napas-247-mb-bank)
5. [Danh mục toàn diện 71+ API Routes](#-danh-mục-toàn-diện-71-api-routes)
   - [1. 🎲 Gaming & Xác Suất Tài Xỉu](#1--gaming--xác-suất-tài-xỉu)
   - [2. 📱 Mạng Xã Hội & Tra Cứu Tài Khoản](#2--mạng-xã-hội--tra-cứu-tài-khoản)
   - [3. 📧 Mail Tạm & Đọc Hộp Thư IMAP / OTP](#3--mail-tạm--đọc-hộp-thư-imap--otp)
   - [4. 🤖 AI & Tiện Ích Lập Trình](#4--ai--tiện-ích-lập-trình)
   - [5. 🛡️ Tra Cứu Bảo Mật, IP & Thiết Bị](#5-️-tra-cứu-bảo-mật-ip--thiết-bị)
   - [6. 🇻🇳 Tiện Ích Đời Sống Việt Nam](#6--tiện-ích-đời-sống-việt-nam)
   - [7. 🌐 Web Utilities & Mạng](#7--web-utilities--mạng)
   - [8. 💳 Fintech & Ngân Hàng VietQR](#8--fintech--ngân-hàng-vietqr)
6. [Code mẫu tích hợp (SDK Examples)](#-code-mẫu-tích-hợp-sdk-examples)
7. [Cài đặt & Tự chạy trên máy cá nhân](#-cài-đặt--tự-chạy-trên-máy-cá-nhân)
8. [Tác giả & Hỗ trợ kỹ thuật](#-tác-giả--hỗ-trợ-kỹ-thuật)

---

## ⚡ Điểm nổi bật

- 🚀 **Tốc độ phản hồi cực nhanh:** Xử lý trực tiếp trên RAM Cache LRU, response trung bình dưới 50ms, tối ưu hóa băng thông bằng nén HTTP và stream dữ liệu.
- 🔒 **Bảo mật tối đa:** Kiến trúc bảo vệ đa lớp với thuật toán mã hóa `HMAC-SHA256`, cơ chế Sliding-Window IP Rate Limiting và chống tấn công dò quét brute-force.
- 📱 **Kiểm tra TikTok chuyên sâu:** Hỗ trợ kiểm tra tài khoản bằng **Session ID** (soi sâu email ẩn, số điện thoại, mật khẩu, nền tảng liên kết, ngày tạo tài khoản) lẫn cào công khai (follower, following, tim, video, avatar HD) và tải video không watermark qua Cobalt / TikWM.
- 🎲 **Trung tâm Tài Xỉu & Thuật toán xác suất:** Tích hợp bộ giải thuật soi cầu và giải mã MD5 / Sicbo của các cổng game lớn: B52 Club, 789Club, Sunwin, Hitclub, cùng cổng SUKA88 (Bài Tây 52 lá, Bầu Cua Tôm Cá, Baccarat Con/Cái).
- ✉️ **Hệ thống Mail tạm & IMAP:** Tạo mail tạm nhận thư tức thì (1secmail & Mail.tm), kiểm tra phân tích email rác và đọc hộp thư IMAP để lấy mã OTP tự động.
- 💳 **Ví số & Nạp tiền tự động 24/7:** Giao diện thẻ thanh toán kỹ thuật số phong cách Fintech, sinh mã **VietQR Napas 247 MB Bank** theo từng giao dịch, tự động cộng tiền trong 30 giây.
- 🖥️ **Giao diện Web SPA Mac-Style:** Không reload trang khi chuyển tab (`pushState` navigation), tích hợp bộ Lucide morphing icons, Dark/Light Mode và tương thích 100% trên điện thoại di động.

---

## 🚀 Bắt đầu nhanh (Quickstart)

**Base URL:**
```text
https://api-zhee.vercel.app
```

### 1. Gọi trực tiếp bằng cURL

```bash
# Tra cứu vị trí và nhà mạng IP
curl -s "https://api-zhee.vercel.app/api/tools/ipcheck?ip=8.8.8.8"

# Soi cầu Tài Xỉu MD5 Sunwin
curl -s "https://api-zhee.vercel.app/api/taixiu/sunwin?=d8cf242b85bed14f7816102c765fa711"

# Check tài khoản TikTok bằng Session ID hoặc Username
curl -s "https://api-zhee.vercel.app/api/mxh/tiktok?=tiktok"
```

### 2. Danh sách catalog đầy đủ dạng JSON

```text
GET https://api-zhee.vercel.app/list
```

---

## 🔑 Cơ chế xác thực & Secret Key

Mỗi tài khoản đăng ký trên Zhee API được cấp **01 Secret Key dùng thử miễn phí 10 ngày** không giới hạn tính năng. Sau khi hết hạn, bạn có thể nạp tiền MB Bank tự động (10.000đ) để gia hạn thêm 10 ngày.

Hệ thống hỗ trợ **3 cách truyền Secret Key**:

| Cách truyền | Vị trí | Ví dụ | Mức độ khuyến nghị |
|---|---|---|---|
| **Header `x-zhee-key`** | HTTP Headers | `x-zhee-key: zt_live_9a8b7c6d...` | ⭐⭐⭐ Khuyến nghị cho Backend / Server |
| **Header `Authorization`** | HTTP Headers | `Authorization: Bearer zt_live_9a8b7c6d...` | ⭐⭐⭐ Chuẩn REST API quốc tế |
| **Query Parameter** | URL Params | `?key=zt_live_9a8b7c6d...` | ⭐ Dành cho test nhanh trên trình duyệt |

---

## 💳 Hệ thống nạp tiền & Ví Napas 247 MB Bank

Truy cập trực tiếp trang Ví tại: **[https://api-zhee.vercel.app/vi](https://api-zhee.vercel.app/vi)**

- **Ngân hàng thụ hưởng:** Ngân hàng TMCP Quân Đội (**MB BANK**)
- **Số tài khoản:** `0899256226`
- **Chủ tài khoản:** `HO DUC MINH`
- **Cơ chế nạp:**
  1. Nhập số tiền muốn nạp (tối thiểu 10.000đ) hoặc bấm chọn chip gợi ý (`10k`, `20k`, `50k`, `100k`, `200k`, `500k`).
  2. Bấm **"Lấy mã QR & Nội dung chuyển khoản"** để nhận VietQR độc quyền.
  3. Quét mã QR bằng ứng dụng ngân hàng bất kỳ (MB, Vietcombank, Techcombank, VPBank, Momo, VNPay...).
  4. Hệ thống nhận diện nội dung chuyển khoản và **cộng số dư tự động sau 30 giây**.
  5. Bấm **"Gia hạn 10 ngày"** (chi phí 10.000đ / 10 ngày) để kích hoạt Secret Key.

---

## 📚 Danh mục toàn diện 71+ API Routes

### 1. 🎲 Gaming & Xác Suất Tài Xỉu

| Tên Endpoint | Đường dẫn API | Phương thức | Mô tả chức năng |
|---|---|:---:|---|
| **Sunwin Tai Xiu & Sicbo MD5** | `/api/taixiu/sunwin` | `GET` | Đối soát chuỗi MD5 bàn Tài Xỉu / Sicbo Hoàng Gia cổng game Sunwin. |
| **B52 Club Volta & Tai Xiu MD5** | `/api/taixiu/b52club` | `GET` | Đối soát chuỗi MD5 bàn bóng đá Volta & Tài Xỉu cổng game B52 Club. |
| **789Club Tai Xiu & Sicbo MD5** | `/api/taixiu/789club` | `GET` | Giải mã và soi cầu chuỗi MD5 Sicbo Las Vegas cổng game 789Club. |
| **Hitclub Tai Xiu & Sicbo Engine** | `/api/taixiu/hitclub` | `GET` | Phân tích chuỗi SHA-256 / MD5 đa sảnh game Hitclub. |
| **SUKA88 — Bài Tây 52 Lá** | `/api/taixiu/suka88/bai` | `GET` | Chia bài Tây ngẫu nhiên 1/2/3 lá, thông tin từng chất bài, tính điểm. |
| **SUKA88 — Bầu Cua Tôm Cá** | `/api/taixiu/suka88/baucua` | `GET` | Lắc 3 viên xí ngầu Bầu Cua (Nai, Bầu, Gà, Cá, Cua, Tôm) chuẩn xác. |
| **SUKA88 — Baccarat (BCR)** | `/api/taixiu/suka88/bcr` | `GET` | Sảnh Baccarat: chia bài Player / Banker, rút bài lá thứ 3 theo luật quốc tế. |
| **SUKA88 Game Simulator** | `/api/taixiu/suka88` | `GET` | Simulator Provably Fair kiểm chứng tính minh bạch xác suất game. |
| **Trung Tâm API Tài Xỉu** | `/api/taixiu` | `GET` | Mục lục điều hướng tổng hợp toàn bộ các cổng game xác suất. |

---

### 2. 📱 Mạng Xã Hội & Tra Cứu Tài Khoản

| Tên Endpoint | Đường dẫn API | Phương thức | Mô tả chức năng |
|---|---|:---:|---|
| **TikTok Full Data & Downloader** | `/api/mxh/tiktok` | `GET` | Tra cứu profile, tải video/ảnh không logo; **check bảo mật tầng sâu qua Session ID** (email, SĐT, ngày tạo, liên kết). |
| **Locket Account & Tools** | `/api/tools/locket` | `GET` | Tra cứu username Locket, tải moment, check danh sách bạn bè, gửi lời mời. |
| **Zalo Checker & Session** | `/api/mxh/zalo` | `GET` | Tra cứu nhóm Zalo, chuẩn hóa số điện thoại, check phiên cookie/IMEI. |
| **NGL Anonymous Messenger** | `/api/tools/ngl` | `GET` | Kiểm tra tài khoản NGL.link và gửi tin nhắn ẩn danh 1-shot an toàn. |
| **Instagram Profile Lookup** | `/api/mxh/instagram` | `GET` | Lấy avatar gốc HD, tiểu sử, số follower, số bài đăng và tích xanh. |
| **Facebook Profile & Downloader** | `/api/mxh/facebook` | `GET` | Tìm UID người dùng, lấy avatar HD và tải video bài viết Facebook. |
| **YouTube Hub** | `/api/youtube` | `GET` | Lấy thông tin kênh, video thịnh hành VN và bóc tách stream MP4/MP3. |
| **Spotify Track & Artist** | `/api/mxh/spotify` | `GET` | Tra cứu bài hát, nghệ sĩ, Top 10 tracks, lời bài hát (lyrics) và audio. |
| **SoundCloud Music Hub** | `/api/mxh/soundcloud` | `GET` | Tìm kiếm bài hát, profile tác giả, ảnh bìa HD và link stream chất lượng cao. |
| **GitHub User & Repos** | `/api/mxh/github` | `GET` | Tra cứu chi tiết tài khoản GitHub, số repositories, star và followers. |
| **Twitch Channel & Stream** | `/api/mxh/twitch` | `GET` | Kiểm tra trạng thái livestream trực tiếp, VOD và clip nổi bật. |
| **Discord Lookup** | `/api/mxh/discord` | `GET` | Tra cứu user Discord qua ID, check link mời server và tình trạng bot. |
| **Telegram Intelligence** | `/api/mxh/telegram` | `GET` | Kiểm tra username, thông tin kênh/nhóm công khai và xác thực bot token. |
| **Twitter / X Downloader** | `/api/mxh/twitter` | `GET` | Lấy thông tin hồ sơ X và tải video Tweet MP4 chất lượng cao. |
| **Pinterest Pin & Board** | `/api/mxh/pinterest` | `GET` | Tra cứu chi tiết ghim (pin), bộ sưu tập (board) và ảnh độ phân giải gốc. |
| **Roblox Profile Lookup** | `/api/mxh/roblox` | `GET` | Tra cứu tài khoản Roblox, avatar 3D toàn thân và ngày tham gia. |
| **Shopee Shop & Mall** | `/api/mxh/shopee` | `GET` | Tra cứu gian hàng Shopee, đánh giá rating, sản phẩm và trạng thái Mall. |
| **Lazada Shop Intelligence** | `/api/mxh/lazada` | `GET` | Tra cứu gian hàng Lazada, seller rating và danh mục sản phẩm. |
| **Tiki Product & Shop** | `/api/mxh/tiki` | `GET` | Tra cứu chi tiết sản phẩm Tiki, giá bán, kho hàng và shop bán buôn. |
| **Cobalt Multi-Downloader** | `/api/mxh/cobalt` | `GET` | Bóc tách media đa nền tảng (TikTok, Douyin, X, SoundCloud) qua Cobalt. |
| **Media Downloader** | `/downloads` | `GET` | Tải video MP4 và luồng M3U8 từ các trang báo và mạng xã hội. |
| **MEGA Storage Inspector** | `/api/mxh/mega` | `GET` | Kiểm tra metadata file/folder MEGA công khai mà không cần tài khoản. |

---

### 3. 📧 Mail Tạm & Đọc Hộp Thư IMAP / OTP

| Tên Endpoint | Đường dẫn API | Phương thức | Mô tả chức năng |
|---|---|:---:|---|
| **Tạo Mail Tạm Thời** | `/mail/taomail` | `GET` | Khởi tạo hộp thư tạm thật qua 1secmail (`kieu=ngan`) hoặc Mail.tm (`kieu=dai`). |
| **Đọc Hộp Thư IMAP & OTP** | `/mail/check` | `GET` | Đăng nhập giao thức IMAP an toàn, tự động quét thư mới nhất và bóc tách mã OTP. |
| **Temporary Email Filter** | `/api/mail/temp-check` | `GET` | Phân tích tên miền email để xác định có phải mail rác / mail tạm hay không. |
| **Dịch Vụ Mail Tổng Hợp** | `/mail` | `GET` | Trang tài liệu và cổng điều hướng dịch vụ email. |

---

### 4. 🤖 AI & Tiện Ích Lập Trình

| Tên Endpoint | Đường dẫn API | Phương thức | Mô tả chức năng |
|---|---|:---:|---|
| **AI Chat (Gemini & GPT)** | `/tools/chat` | `GET` | Chatbot thông minh hỗ trợ chuyển đổi giữa Google Gemini và OpenAI ChatGPT. |
| **AI Remove Background** | `/tools/removebg` | `GET` | Tách nền ảnh tự động bằng trí tuệ nhân tạo, trả về ảnh PNG trong suốt. |
| **AI Image Enhancer** | `/tools/enhance` | `GET` | Nâng cấp độ phân giải hình ảnh lên 2K / 4K, khử nhiễu và làm nét khuôn mặt. |
| **Check AI API Key Quota** | `/api/tools/checkkeyai` | `GET` | Kiểm tra tính hợp lệ và hạn mức còn lại của API key OpenAI, Gemini, Claude. |
| **Tạo Captcha Ảnh** | `/api/tools/captcha` | `GET` | Sinh ảnh captcha chống bot tự động kèm token đối soát an toàn. |
| **Dịch Thuật Đa Ngôn Ngữ** | `/api/tools/trans` | `GET` | Dịch văn bản thông minh (tự nhận diện ngôn ngữ) kèm giọng đọc MP3. |
| **URL Shortener** | `/api/tools/shortener` | `GET` | Rút gọn link nhanh qua TinyURL hoặc Bitly. |
| **QR Code Generator** | `/api/tools/qr` | `GET` | Tạo mã QR Code tùy biến kích thước và sửa lỗi ECC. |
| **Dynamic SVG Badge** | `/api/badge` | `GET` | Sinh huy hiệu SVG hiển thị trên GitHub README tương tự Shields.io. |
| **Avatar Initial Generator** | `/api/avatar` | `GET` | Sinh ảnh đại diện dạng chữ cái viết tắt theo tên người dùng. |
| **Open Graph Metadata Scraper** | `/api/metadata` | `GET` | Bóc tách title, description, thumbnail ảnh đại diện từ URL website bất kỳ. |
| **User-Agent Parser** | `/api/tools/ua-parser` | `GET` | Phân tích chuỗi User-Agent: hệ điều hành, trình duyệt, thiết bị di động/máy tính. |
| **Key Manager (HMAC-SHA256)** | `/tools/key` | `GET` | Tạo và quản lý mã bản quyền API với chữ ký số HMAC-SHA256. |

---

### 5. 🛡️ Tra Cứu Bảo Mật, IP & Thiết Bị

| Tên Endpoint | Đường dẫn API | Phương thức | Mô tả chức năng |
|---|---|:---:|---|
| **IP Address Intelligence** | `/api/tools/ipcheck` | `GET` | Tra cứu định vị IP, quốc gia, thành phố, ISP, ASN, tín hiệu VPN/Proxy/Tor. |
| **Phone Number Intelligence** | `/api/tools/checksdt` | `GET` | Tra cứu nhà mạng di động Việt Nam, định dạng E.164, quốc gia và loại thuê bao. |
| **Apple Device & IMEI** | `/api/tools/checkimei` | `GET` | Tra cứu thông số thiết bị iPhone/iPad qua IMEI, Serial, Model máy. |
| **Checkscam Database** | `/api/tools/checkscam` | `GET` | Tra cứu số tài khoản ngân hàng, số điện thoại bị tố cáo lừa đảo trên mạng. |
| **NASA Astronomy & Space** | `/api/tools/nasa` | `GET` | Lấy ảnh thiên văn học trong ngày (APOD) và danh sách tiểu hành tinh gần Trái Đất. |
| **Free Fire Player Info** | `/tools/freefire` | `GET` | Tra cứu tên nhân vật, cấp độ, khu vực và điểm rank qua UID game Free Fire. |
| **Anime HD Image Collector** | `/api/anime` | `GET` | Lấy ảnh Anime chất lượng cao theo danh mục và thẻ từ Waifu.im. |

---

### 6. 🇻🇳 Tiện Ích Đời Sống Việt Nam

| Tên Endpoint | Đường dẫn API | Phương thức | Mô tả chức năng |
|---|---|:---:|---|
| **Lịch Âm Dương Việt Nam** | `/api/vn/lunar` | `GET` | Chuyển đổi ngày dương sang ngày âm lịch, can chi, giờ hoàng đạo. |
| **Tra Cứu Biển Số Xe** | `/api/vn/plate` | `GET` | Nhập mã số biển xe (ví dụ `29`, `51`) để tra cứu tỉnh thành và khu vực. |
| **Giá Xăng Dầu Petrolimex** | `/api/vn/fuel` | `GET` | Bảng giá xăng RON 95, E5 RON 92, dầu DO mới nhất theo kỳ điều hành. |
| **Lịch Nghỉ Lễ Việt Nam** | `/api/vn/holidays` | `GET` | Danh sách các ngày nghỉ lễ chính thức theo luật lao động Việt Nam. |
| **Từ Điển Đồng Nghĩa & Trái Nghĩa** | `/api/vn/thesaurus` | `GET` | Tra cứu từ đồng nghĩa, trái nghĩa và giải thích từ vựng tiếng Việt. |
| **Xử Lý Văn Bản Tiếng Việt** | `/api/vn/text` | `GET` | Bỏ dấu tiếng Việt, tạo URL slug, đếm từ và chuẩn hóa chính tả. |
| **Chuyển Số Thành Chữ** | `/api/vn/number-to-words` | `GET` | Chuyển số tiền lớn thành chữ tiếng Việt chuẩn xác (tiền tệ Việt Nam Đồng). |
| **Đố Vui Trắc Nghiệm** | `/api/quiz` | `GET` | Ngân hàng câu hỏi trắc nghiệm đa lĩnh vực có đáp án đối chiếu. |
| **Danh Ngôn Mỗi Ngày** | `/api/quote/daily` | `GET` | Lời khuyên và câu nói truyền cảm hứng ngẫu nhiên mỗi ngày. |

---

### 7. 🌐 Web Utilities & Mạng

| Tên Endpoint | Đường dẫn API | Phương thức | Mô tả chức năng |
|---|---|:---:|---|
| **Website API Scanner** | `/web/endpoint` | `GET` | Quét mã nguồn HTML/JS của website để phát hiện các URL endpoint công khai. |
| **Kiểm Tra Tên Miền Tồn Tại** | `/web/domain` | `GET` | Tra cứu trạng thái tên miền qua DNS và giao thức RDAP quốc tế. |
| **Quản Trị Mạng & Domain** | `/web` | `GET` | Kiểm tra Ping IP, DNS Records, Whois domain và chứng chỉ bảo mật SSL/TLS. |

---

### 8. 💳 Fintech & Ngân Hàng VietQR

| Tên Endpoint | Đường dẫn API | Phương thức | Mô tả chức năng |
|---|---|:---:|---|
| **VietQR Generator** | `/bank` | `GET` | Tạo mã QR chuyển khoản ngân hàng chuẩn Napas 247 kèm mã BIN ngân hàng. |
| **Tạo Lệnh Nạp Ví** | `/api/account/topup` | `POST` | Tạo lệnh nạp tiền vào ví kèm mã VietQR MB Bank tự động cộng tiền. |
| **Lịch Sử Giao Dịch** | `/api/account/topups` | `GET` | Tra cứu danh sách các lệnh nạp tiền và trạng thái giao dịch. |
| **Gia Hạn Bản Quyền Key** | `/api/account/renew` | `POST` | Dùng số dư trong ví để gia hạn Secret Key thêm 10 ngày (10.000đ). |

---

## 💻 Code mẫu tích hợp (SDK Examples)

### JavaScript / Node.js (Axios & Fetch)

```javascript
// Sử dụng Fetch API (Node.js 18+ hoặc Trình duyệt)
async function checkTikTok(identifier) {
  const apiKey = "YOUR_SECRET_KEY";
  const url = `https://api-zhee.vercel.app/api/mxh/tiktok?=${encodeURIComponent(identifier)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "x-zhee-key": apiKey
    }
  });

  const data = await response.json();
  console.log("Kết quả:", data);
  return data;
}

// Gọi bằng username hoặc Session ID
checkTikTok("@tiktok");
```

### Python (Requests)

```python
import requests

API_KEY = "YOUR_SECRET_KEY"
BASE_URL = "https://api-zhee.vercel.app"

def tra_cuu_ip(ip_address):
    url = f"{BASE_URL}/api/tools/ipcheck"
    params = {"ip": ip_address}
    headers = {
        "Accept": "application/json",
        "x-zhee-key": API_KEY
    }
    
    response = requests.get(url, params=params, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Lỗi HTTP {response.status_code}: {response.text}")
        return None

# Thực thi
thong_tin = tra_cuu_ip("1.1.1.1")
print(thong_tin)
```

---

## 🛠️ Cài đặt & Tự chạy trên máy cá nhân

### Yêu cầu hệ thống
- **Node.js:** phiên bản `22.x` hoặc mới hơn
- **Git** & **npm**

### 1. Clone repository
```bash
git clone https://github.com/zheedevVn/api-zhee.git
cd api-zhee
```

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Thiết lập biến môi trường (`.env`)
Tạo file `.env` ở thư mục gốc (không đẩy file này lên GitHub):
```env
# Upstash Redis (Khuyến nghị để lưu session & tài khoản bền vững trên Vercel)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Google OAuth (Tùy chọn)
GOOGLE_CLIENT_ID=your_google_client_id

# Quản trị viên
ADMIN_SECRET=your_admin_secret_password

# API bên thứ 3 (Tùy chọn cho các tool chuyên biệt)
IPSTACK_API_KEY=your_ipstack_key
NASA_API_KEY=your_nasa_key
```

### 4. Khởi chạy Gateway
```bash
npm start
```
Cổng API sẽ khởi chạy tại: `http://localhost:3000`

---

## 👨‍💻 Tác giả & Hỗ trợ kỹ thuật

**Hồ Đức Minh (Zhee Dev)**

- 🌐 **Website chính thức:** [https://api-zhee.vercel.app](https://api-zhee.vercel.app)
- ✈️ **Telegram hỗ trợ:** [@zheevipv1](https://t.me/zheevipv1)
- 📘 **Facebook:** [hoducminh.depzai](https://facebook.com/hoducminh.depzai)
- 💬 **Zalo:** [0944921186](https://zalo.me/0944921186)
- 🎵 **TikTok:** [@nv1qda](https://www.tiktok.com/@nv1qda)
- 🎮 **Discord:** `@hoducminh_1602`

---

<p align="center">
  <sub>Phát triển và duy trì bởi <b>Hồ Đức Minh (Zhee Dev)</b>. Bản quyền © 2026. Mọi quyền được bảo lưu.</sub>
</p>
