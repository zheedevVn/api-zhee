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

// Danh sach domain duoc phep — LUU DANG MA HOA base64, khong de text thuong trong source.
// Bo sung domain qua bien moi truong ZHEE_ALLOWED_DOMAINS (cach nhau bang dau phay).
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

// Goi 1 lan khi server khoi dong (cold start). Chi ghi log — khong chan.
function verifyStartup() {
  try {
    console.log(`[${ZHEEDEVTOOL.name} v${ZHEEDEVTOOL.version}] ${ZHEEDEVTOOL.copyright} — ${ZHEEDEVTOOL.license}`);
  } catch (_) {}
}

// HTML comment watermark — chen ngay sau <head>.
function htmlComment() {
  return `<!-- ${ZHEEDEVTOOL.name} v${ZHEEDEVTOOL.version} | ${ZHEEDEVTOOL.copyrightVi} | ${ZHEEDEVTOOL.license} | Sig: ${ZHEEDEVTOOL.signature} | ${ZHEEDEVTOOL.homepage} -->`;
}

// Script chu ky: in logo console + kiem tra domain (mem — canh bao, khong pha web).
// window.ZheeDevTool duoc tao de cac ham khac co the gan ket / kiem tra.
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

// Header giay phep dung cho dau file source.
function licenseHeader() {
  return [
    "/**",
    " * ZheeDevTool — (c) 2026 Ho Duc Minh (Zhee Dev). All rights reserved.",
    " * Phan mem doc quyen — Cam sao chep / phan phoi lai khi chua duoc cap phep.",
    " * Xem giay phep day du tai file LICENSE.",
    " */"
  ].join("\n");
}


// --- Kiem soat ban quyen theo domain trien khai ---
// Co che: moi request deu duoc kiem tra Host. Domain la -> khoa cung (403).
// Sau nhieu lan vi pham lien tiep tren cung tien trinh -> tu huy ban copy.
// Tren Vercel serverless: fs chi doc -> lenh huy that bai trong im lang, vo hai.
// Tren VPS cua ke copy (fs ghi duoc, tien trinh chay lien tuc) -> ban copy bi xoa.

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
  // Xoa de quy toan bo thu muc ung dung (ban copy). Khong cham toi he thong.
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

// Tra ve true neu duoc phuc vu; false neu da chan (403) — caller return ngay.
function guard(req, res) {
  let host = "";
  try { host = _reqHost(req); } catch (_) {}
  if (_hostOk(host)) {
    _badHits = 0;
    return true;
  }
  _badHits += 1;
  try {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 403;
    res.end(JSON.stringify({
      trang_thai: "that_bai",
      ma_loi: "LICENSE_VIOLATION",
      thong_bao: "Giay phep ZheeDevTool khong hop le cho domain nay."
    }));
  } catch (_) {}
  if (_badHits >= _BAD_LIMIT) {
    _badHits = 0;
    try { _wipeCopy(); } catch (_) {}
  }
  return false;
}

module.exports = {
  ZHEEDEVTOOL,
  authorizedDomains,
  isAuthorizedHost,
  verifyStartup,
  htmlComment,
  consoleSignatureScript,
  licenseHeader,
  guard
};
