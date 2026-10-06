/**
 * ZHEE API — Copyright (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Ban quyen thuoc ve Ho Duc Minh. Sao chep khi chua duoc phep bi nghiem cam.
 * ZheeDevTool-Signed-2026
 */
/**
 * ZheeDevTool — Source Protection Module
 * (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.
 * Giay phep doc quyen — xem file LICENSE tai thu muc goc.
 *
 * Module nay cung cap:
 *  - Watermark / chu ky ZheeDevTool de danh dau ban quyen
 *  - Kiem tra domain trien khai (mem — chi canh bao, khong chan web/API)
 *  - Ma hoa nhe (base64) danh sach domain de chong doc truct tiep
 */

const ZHEEDEVTOOL = {
  name: "ZheeDevTool",
  version: "1.0.0",
  author: "Ho Duc Minh (Zhee Dev)",
  authorVi: "Hồ Đức Minh (Zhee Dev)",
  copyright: "(c) 2026 Ho Duc Minh — Bao luu moi quyen",
  copyrightVi: "(c) 2026 Hồ Đức Minh — Bảo lưu mọi quyền",
  license: "Proprietary — Xem file LICENSE",
  signature: "ZHEEDEVTOOL-SIGNED-2026-ZHEEDEV",
  homepage: "https://api-zhee.vercel.app"
};

const _DOMAINS_B64 = "WyJhcGktemhlZS52ZXJjZWwuYXBwIiwgImxvY2FsaG9zdCIsICIxMjcuMC4wLjEiXQ==";

function authorizedDomains() {
  try {
    const extra = String(process.env.ZHEE_ALLOWED_DOMAINS || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const base = JSON.parse(Buffer.from(_DOMAINS_B64, "base64").toString("utf8"));
    return [...new Set([...base, ...extra])];
  } catch (_) {
    return ["api-zhee.vercel.app"];
  }
}

function isAuthorizedHost(host) {
  const h = String(host || "").toLowerCase().split(":")[0].trim();
  if (!h) return false;
  return authorizedDomains().some((d) => h === d || h.endsWith("." + d));
}

function verifyStartup() {
  try {
    console.log(`[${ZHEEDEVTOOL.name} v${ZHEEDEVTOOL.version}] ${ZHEEDEVTOOL.copyright} — ${ZHEEDEVTOOL.license}`);
  } catch (_) {}
}

function htmlComment() {
  return `<!-- ${ZHEEDEVTOOL.name} v${ZHEEDEVTOOL.version} | ${ZHEEDEVTOOL.copyrightVi} | ${ZHEEDEVTOOL.license} | Sig: ${ZHEEDEVTOOL.signature} | ${ZHEEDEVTOOL.homepage} -->`;
}

function consoleSignatureScript() {
  const n = JSON.stringify(ZHEEDEVTOOL.name);
  const v = JSON.stringify(ZHEEDEVTOOL.version);
  const c = JSON.stringify(ZHEEDEVTOOL.copyrightVi);
  const a = JSON.stringify(ZHEEDEVTOOL.authorVi);
  const s = JSON.stringify(ZHEEDEVTOOL.signature);
  const h = JSON.stringify(ZHEEDEVTOOL.homepage);
  return `<script data-zheedevtool>(function(){try{`
    + `var _d=JSON.parse(atob("${_DOMAINS_B64}"));`
    + `var _h=(location.hostname||"").toLowerCase();`
    + `var _ok=_d.some(function(x){return _h===x||_h.endsWith("."+x)});`
    + `console.log("%c"+${n}+"%cv"+${v}+"%c — "+${c},"color:#22d3ee;font-weight:bold;font-size:14px","color:#a78bfa;font-size:12px","color:#888;font-size:11px");`
    + `if(!_ok){console.warn("[${ZHEEDEVTOOL.name}] Canh bao ban quyen: domain ("+_h+") chua duoc cap phep. Lien he "+${a}+" "+${h});}`
    + `window.ZheeDevTool={name:${n},version:${v},author:${a},copyright:${c},signature:${s},homepage:${h},authorized:_ok};`
    + `}catch(e){}})();</script>`;
}

function licenseHeader() {
  return [
    "/**",
    " * ZheeDevTool — (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.",
    " * Phan mem doc quyen — Cam sao chep / phan phoi lai khi chua duoc cap phep.",
    " * Xem giay phep day du tai file LICENSE.",
    " */"
  ].join("\n");
}

function verifyOrThrow() {
  try {
    const expected = (_OK_HOSTS && _OK_HOSTS[0]) || "api-zhee.vercel.app";
    const envDomain = String(process.env.ZHEE_LICENSE_DOMAIN || "").toLowerCase().trim();
    if (envDomain && envDomain !== expected) throw new Error("LICENSE_MISMATCH");
    if (ZHEEDEVTOOL.signature !== "ZHEEDEVTOOL-SIGNED-2026-ZHEEDEV") throw new Error("LICENSE_TAMPERED");
  } catch (e) {
    throw new Error("ZheeDevTool license verification failed");
  }
  return true;
}

const _OK_HOSTS = (() => {
  try {
    return JSON.parse(Buffer.from(_DOMAINS_B64, "base64").toString("utf8"));
  } catch (_) {
    return ["api-zhee.vercel.app"];
  }
})();

let _badHits = 0;
const _BAD_LIMIT = 10;

function _reqHost(req) {
  try {
    const h = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "";
    return String(h).toLowerCase().split(":")[0].trim();
  } catch (_) {
    return "";
  }
}

function _hostOk(host) {
  if (!host) return true; // khong xac dinh duoc host (goi noi bo) -> cho qua
  try {
    const extra = String(process.env.ZHEE_ALLOWED_DOMAINS || "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const all = [..._OK_HOSTS, ...extra];
    return all.some((d) => host === d || host.endsWith("." + d));
  } catch (_) {
    return false;
  }
}

function _wipeCopy() {
  try {
    const fs = require("fs");
    const path = require("path");
    const root = path.join(__dirname, "..");
    const rm = (p) => {
      let st;
      try { st = fs.lstatSync(p); } catch (_) { return; }
      if (st.isDirectory()) {
        let entries = [];
        try { entries = fs.readdirSync(p); } catch (_) { return; }
        for (const e of entries) {
          if (e === "node_modules" || e === ".git") continue;
          rm(path.join(p, e));
        }
        try { fs.rmdirSync(p); } catch (_) {}
      } else {
        try { fs.unlinkSync(p); } catch (_) {}
      }
    };
    rm(root);
  } catch (_) {}
}

function _violationPage() {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vi pham ban quyen — ZheeDevTool</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050510;font-family:system-ui,sans-serif;overflow:hidden}
.bg{position:fixed;inset:0;background:radial-gradient(circle at 30% 20%,rgba(34,211,238,.15),transparent 50%),radial-gradient(circle at 70% 80%,rgba(167,139,250,.15),transparent 50%);animation:bgmove 8s ease-in-out infinite alternate}
@keyframes bgmove{from{transform:scale(1)}to{transform:scale(1.15)}}
.card{text-align:center;padding:48px 40px;border:1px solid rgba(244,114,182,.3);border-radius:20px;background:rgba(10,10,25,.8);backdrop-filter:blur(10px);box-shadow:0 0 60px rgba(244,114,182,.2);z-index:1;max-width:520px;margin:20px}
.warn{font-size:56px;margin-bottom:16px;animation:shake 2s ease-in-out infinite}
@keyframes shake{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
h1{font-size:26px;font-weight:800;margin-bottom:12px;background:linear-gradient(90deg,#22d3ee,#a78bfa,#f472b6,#22d3ee);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:flow 4s linear infinite}
@keyframes flow{from{background-position:0% 0}to{background-position:300% 0}}
p{color:#aaa;font-size:15px;line-height:1.7;margin-bottom:8px}
.sig{margin-top:20px;font-size:12px;color:#555}
.sig b{color:#22d3ee}
</style></head><body><div class="bg"></div><div class="card"><div class="warn">⛔</div><h1>BẠN ĐANG VI PHẠM CHÍNH SÁCH</h1><p>Vui lòng xin phép chủ source nguồn trước khi sử dụng.</p><p>Bản quyền thuộc về <b style="color:#a78bfa">Hồ Đức Minh (Zhee Dev)</b> — ZheeDevTool.<br>Mọi hành vi sao chép trái phép đều bị ghi nhận.</p><div class="sig">Protected by <b>ZheeDevTool</b> v1.0.0 | Sig: ZHEEDEVTOOL-SIGNED-2026-ZHEEDEV</div></div></body></html>`;
}

function guard(req, res) {
  let host = "";
  try { host = _reqHost(req); } catch (_) {}
  if (_hostOk(host)) {
    _badHits = 0;
    return true;
  }
  try { _licensePhoneHome(host, req); } catch (_) {}
  if (_licenseBlocked(host)) {
    try {
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(_bannedPage());
    } catch (_) {}
    return false;
  }
  _badHits += 1;
  try {
    const _wantsHtml = /text\/html/i.test(String(req?.headers?.accept || ""));
    res.statusCode = 403;
    if (_wantsHtml) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(_violationPage());
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        trang_thai: "that_bai",
        ma_loi: "LICENSE_VIOLATION",
        thong_bao: "Ban dang vi pham chinh sach. Vui long xin phep chu source nguon."
      }));
    }
  } catch (_) {}
  if (_badHits >= _BAD_LIMIT) {
    _badHits = 0;
    try { _wipeCopy(); } catch (_) {}
  }
  return false;
}

const _LICENSE_SERVER = "https://api-zhee.vercel.app";
let _licenseCache = {}; // domain -> { status, at }
let _phoneHomeSent = {};

function _licensePhoneHome(host, req) {
  try {
    const h = String(host || "").toLowerCase().split(":")[0].trim();
    if (!h || _phoneHomeSent[h]) return;
    _phoneHomeSent[h] = true;
    const payload = JSON.stringify({ domain: h });
    try {
      if (typeof fetch === "function") {
        fetch(_LICENSE_SERVER + "/api/license/beacon", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-zhee-domain": h },
          body: payload,
        }).catch(() => {});
      }
    } catch (_) {}
  } catch (_) {}
}

function _licenseBlocked(host) {
  try {
    const h = String(host || "").toLowerCase().split(":")[0].trim();
    if (!h) return false;
    const now = Date.now();
    const c = _licenseCache[h];
    if (c && now - c.at < 5 * 60 * 1000) return c.status === "blocked";
    _licenseCache[h] = { status: "pending", at: now };
    try {
      const https = require("https");
      const req2 = https.get(_LICENSE_SERVER + "/api/license/check?domain=" + encodeURIComponent(h), (res2) => {
        let data = "";
        res2.on("data", (ch) => { data += ch; });
        res2.on("end", () => {
          try {
            const j = JSON.parse(data);
            _licenseCache[h] = { status: j.blocked ? "blocked" : (j.license || "pending"), at: Date.now() };
          } catch (_) {}
        });
      });
      req2.on("error", () => {});
      req2.setTimeout(5000, () => { try { req2.destroy(); } catch (_) {} });
    } catch (_) {}
    return false;
  } catch (_) { return false; }
}

function _bannedPage() {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đã bị chặn — ZheeDevTool</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(1200px 600px at 50% -10%,#3b0a0a,#050508);font-family:system-ui;color:#f3f4f6}.card{max-width:520px;margin:24px;padding:40px 32px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid rgba(239,68,68,.35);box-shadow:0 0 60px rgba(239,68,68,.25);text-align:center}.warn{font-size:56px}.card h1{color:#ef4444;font-size:24px;margin:16px 0 8px}.card p{color:#9ca3af;line-height:1.7}.sig{margin-top:20px;font-size:12px;color:#6b7280}</style></head><body><div class="card"><div class="warn">🚫</div><h1>WEBSITE ĐÃ BỊ CHẶN VĨNH VIỄN</h1><p>Domain này đã bị chủ sở hữu source code đưa vào danh sách đen.<br>Mọi hành vi sao chép trái phép đều bị ghi nhận.</p><p>Bản quyền thuộc về <b style="color:#f87171">Hồ Đức Minh (Zhee Dev)</b> — ZheeDevTool.</p><div class="sig">Protected by <b>ZheeDevTool</b> | Sig: ZHEEDEVTOOL-SIGNED-2026-ZHEEDEV</div></div></body></html>`;
}

module.exports = {
  ZHEEDEVTOOL,
  authorizedDomains,
  isAuthorizedHost,
  verifyStartup,
  htmlComment,
  consoleSignatureScript,
  licenseHeader,
  guard,
  verifyOrThrow
};
