# 🤖 HƯỚNG DẪN DÀNH CHO AI TIẾP QUẢN DỰ ÁN (AI HANDOVER CONTEXT)
> **Dự án:** API-Zhee — High Performance Multi-Service API Engine & UI Studio  
> **Cập nhật lần cuối:** 11/11/2026 bởi Zhee Dev & Antigravity AI  
> **Mục đích tài liệu:** Cung cấp 100% bối cảnh kỹ thuật, kiến trúc, 10 lỗi cốt tử đã fix và quy tắc chuẩn để bất kỳ AI nào tiếp quản cũng làm tiếp mượt mà, **KHÔNG BAO GIỜ BỊ LỖI LẶP LẠI**.

---

## 1. TỔNG QUAN DỰ ÁN & DOMAIN

* **Domain Production:** `https://api-zhee.vercel.app`
* **Giao diện người dùng:** `https://api-zhee.vercel.app/` (Giao diện Cyber Luxury Dark 2026 tổng hợp 70+ endpoint dịch vụ).
* **Kiến trúc Serverless:** Vercel Node.js Functions (`api/server.js` qua `vercel.json`).

---

## 2. KHO REPO & QUY TRÌNH DEPLOY VERCEL

* **GitHub:** `https://github.com/zheedevVn/api-zhee.git` (Remote: `origin`, Branch: `main`)
* **GitLab:** `https://gitlab.com/hoducminh4444/api-zhee.git` (Remote: `gitlab`, Branch: `main`, Project ID: `88624283`)
* **Vercel Project:**
  * **Project ID:** `prj_9lSfnqctJao5CHlgMCBlwVA3mt1P`
  * **Team Slug:** `zhee-dev-tool` (Team ID: `team_mT8Iy0CklAr2GxufQKCqiLfD`)
  * **Vercel Token:** `vcp_1JmOH46...` (Lưu trong biến môi trường `VERCEL_TOKEN`)
  * **GitLab Token:** `glpat-TjeofEG...` (Lưu trong biến môi trường `GITLAB_TOKEN`)
* **QUY TẮC BẮT BUỘC KHI PUSH CODE:** Luôn push cả 2 remote để Vercel tự động deploy:
  ```bash
  git push origin main && git push gitlab main
  ```

---

## 3. CÁC LỖI QUAN TRỌNG ĐÃ ĐƯỢC FIX (AI KHÔNG ĐƯỢC PHÉP ĐỔI NGƯỢC LẠI)

### ⚠️ Lỗi 1: Google Search index ra chuỗi "Lỗi tải: Failed to fetch"
* **Nguyên nhân cũ:** Tệp `public/ui.html` trước đây chia nhỏ thành `ui-p1.html`, `ui-p2.html`, `ui-p3.html` và dùng JavaScript `Promise.all` + `document.write` để ghép chuỗi. Bot tìm kiếm của Google khi crawl không chạy fetch relative path được $\rightarrow$ Index lỗi "Lỗi tải: Failed to fetch".
* **Đã sửa:** Tệp `public/ui.html` hiện tại là **standalone HTML hoàn chỉnh**, có đầy đủ thẻ meta SEO:
  ```html
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large">
  <noscript><p>ZHEE API — Nền tảng API đa chức năng...</p></noscript>
  ```
* **Quy tắc:** Tuyệt đối không chia tách nhỏ HTML bằng fetch `ui-p1/2/3` nữa.

### ⚠️ Lỗi 2: `TypeError: Cannot read properties of undefined (reading 'query')`
* **Nguyên nhân:** Trên môi trường Vercel serverless, khi request gửi lên không có query string, `req.query` có thể bị `undefined`.
* **Đã sửa:** Trong `api/server.js` và tất cả các file `lib/bank.js`, `lib/roblox.js`, `lib/github.js`, `lib/telegram.js`, `lib/twitter.js`, `lib/discord.js`:
  ```javascript
  req.query = req.query || {};
  ```

### ⚠️ Lỗi 3: `res.status(...).send is not a function`
* **Nguyên nhân:** Môi trường Node.js gốc `http.ServerResponse` không có method `.send()`.
* **Đã sửa:** Trong `api/server.js` đã polyfill:
  ```javascript
  if (!res.send) {
    res.send = function(body) {
      if (typeof body === "object" && !Buffer.isBuffer(body)) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify(body));
      }
      return res.end(body);
    };
  }
  ```

### ⚠️ Lỗi 4: AI Chat `/tools/chat` crash 500 khi thiếu API Key
* **Đã sửa:** Trong `lib/tools.js`, khi không có key Gemini hoặc OpenAI, tự động fallback sang Pollinations AI engine $\rightarrow$ Endpoint luôn trả về câu trả lời 200 OK.

### ⚠️ Lỗi 5: Check Scam `/checkscam` trả về 502 khi không tìm thấy dữ liệu
* **Đã sửa:** Trong `lib/checkscam.js`, nếu API tra cứu trả về 404 thì fallback về `{ status: "safe", message: "Số tài khoản / SĐT chưa có trong danh sách đen" }` thay vì ném lỗi 502.

---

## 4. DỰ ÁN CHỊ EM & CÔNG CỤ ĐĂNG TRUYỆN TRANH (MANGA CDN)

1. **Công cụ CLI tự động đăng truyện lên Netlify:**  
   Nằm tại `scripts/netlify-manga.js` với token Netlify `nfp_BkhSuHWnWc3JynUg...`.
   ```bash
   # Liệt kê 74 site
   node scripts/netlify-manga.js list

   # Upload bộ truyện lên CDN và tự cài Edge Function chặn 403 toàn bộ internet:
   node scripts/netlify-manga.js upload --folder ./chap-1 --site api-doctruyen210 --domain web-truyen-cua-ban.com
   ```

2. **Dự án `jsonpic` (Website Admin Manga CDN):**  
   * **Domain:** `https://jsonpic.vercel.app`
   * **Admin Panel:** `https://jsonpic.vercel.app/client/admin` (Đăng nhập: `hoducminh` | `minhhocgioi`).
   * **Repo:** `https://github.com/zheedevVn/jsonpic` và `https://gitlab.com/hoducminh4444/jsonpic`.

---

## 5. CẤU TRÚC THƯ MỤC DỰ ÁN

```
api-zhee/
├── api/
│   └── server.js            # Dispatcher chính, polyfill res/req và route tĩnh/động
├── lib/
│   ├── bank.js              # Tạo mã QR ngân hàng VietQR
│   ├── checkscam.js         # Kiểm tra lừa đảo STK/SĐT
│   ├── discord.js           # API Discord tools
│   ├── github.js            # API tra cứu GitHub
│   ├── tools.js             # AI Chat, dịch thuật, tiện ích
│   ├── zip.js               # Bộ nén in-memory zip
│   └── ... (70+ modules)
├── public/
│   └── ui.html              # Giao diện Cyber Luxury Dark 2026
├── scripts/
│   └── netlify-manga.js     # CLI upload manga lên Netlify CDN kèm 403 anti-hotlink
├── vercel.json              # Route rewrites
├── package.json
├── README.md
└── AI_PROJECT_CONTEXT.md    # Tài liệu này
```
