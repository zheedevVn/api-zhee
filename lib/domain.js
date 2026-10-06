require("./zheeProtect.js").verifyOrThrow();
const dns = require("dns").promises;
const { domainToASCII } = require("url");

function pick(params, body, ...keys) {
  for (const key of keys) {
    if (params[key] != null && String(params[key]).trim()) return String(params[key]).trim();
    if (body && body[key] != null && String(body[key]).trim()) return String(body[key]).trim();
  }
  return "";
}

function extractFirstParam(params) {
  return String(params[""] || "").trim();
}

function normalizeDomain(raw) {
  let value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  try { value = decodeURIComponent(value); } catch (_) {}
  value = value.replace(/^https?:\/\//i, "").replace(/^\/+/, "");
  value = value.split("/")[0].split("?")[0].split("#")[0];
  value = value.replace(/:\d+$/, "").replace(/\.$/, "");
  if (value.startsWith("www.")) value = value.slice(4);
  return value;
}

function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;
  if (!domain.includes(".")) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

function toAscii(domain) {
  try {
    const ascii = domainToASCII(domain);
    return ascii && ascii !== "0" ? ascii : domain;
  } catch (_) {
    return domain;
  }
}

async function lookupDns(host) {
  const safe = async (fn) => {
    try { return await fn(); } catch (error) {
      return { error: error.code || error.message };
    }
  };
  const [a, aaaa, ns, mx, soa] = await Promise.all([
    safe(() => dns.resolve4(host)),
    safe(() => dns.resolve6(host)),
    safe(() => dns.resolveNs(host)),
    safe(() => dns.resolveMx(host)),
    safe(() => dns.resolveSoa(host))
  ]);
  const pickList = (result) => Array.isArray(result) ? result : null;
  const dnsOk = [a, aaaa, ns, mx].some((item) => Array.isArray(item) && item.length);
  return {
    co_dns: dnsOk,
    a: pickList(a),
    aaaa: pickList(aaaa),
    ns: pickList(ns),
    mx: Array.isArray(mx) ? mx.map((item) => item.exchange || item) : null,
    soa: soa && !soa.error ? soa : null
  };
}

function vcardFn(entity) {
  const vcard = entity && entity.vcardArray && entity.vcardArray[1];
  if (!Array.isArray(vcard)) return null;
  const fn = vcard.find((row) => row && row[0] === "fn");
  return fn && fn[3] ? String(fn[3]) : null;
}

function parseRdap(json) {
  if (!json || typeof json !== "object") return null;
  const events = Array.isArray(json.events) ? json.events : [];
  const findEvent = (name) => {
    const hit = events.find((item) => String(item.eventAction || "").toLowerCase() === name);
    return hit && hit.eventDate ? hit.eventDate : null;
  };
  const registrar = (json.entities || []).find((item) => (item.roles || []).includes("registrar"));
  const nameservers = Array.isArray(json.nameservers)
    ? json.nameservers.map((item) => item.ldhName || item.unicodeName).filter(Boolean)
    : null;
  return {
    ten_ascii: json.ldhName || null,
    trang_thai_rdap: Array.isArray(json.status) && json.status.length ? json.status : null,
    nha_dang_ky: vcardFn(registrar) || (registrar && registrar.handle) || null,
    ngay_dang_ky: findEvent("registration"),
    ngay_het_han: findEvent("expiration"),
    cap_nhat_gan_nhat: findEvent("last changed") || findEvent("last update of rdap database"),
    nameserver: nameservers
  };
}

async function lookupRdap(host) {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(host)}`, {
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (res.status === 404) return { co_rdap: false, dang_ky: false };
    if (!res.ok) return { co_rdap: false, dang_ky: null };
    const json = await res.json();
    return { co_rdap: true, dang_ky: true, chi_tiet: parseRdap(json) };
  } catch (_) {
    return { co_rdap: false, dang_ky: null };
  }
}

function cleanObj(obj) {
  if (!obj || typeof obj !== "object") return null;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value) && !value.length) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

function buildGuide(baseUrl) {
  return {
    trang_thai: "huong_dan",
    chuyen_muc: "Check Tên Miền (/web/domain)",
    tac_gia: "Hồ Đức Minh (Zhee Dev)",
    mo_ta: "Kiểm tra tên miền đã đăng ký / còn trống qua DNS và RDAP.",
    cu_phap: [
      `${baseUrl}/web/domain?={ten_mien}`,
      `${baseUrl}/api/web/domain?domain={ten_mien}`
    ],
    vi_du: [
      `${baseUrl}/web/domain?=google.com`,
      `${baseUrl}/web/domain?=tenmienkhongtontai123xyz.com`
    ]
  };
}

module.exports = async (req, res) => {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "api-zhee.vercel.app";
  const baseUrl = `${protocol}://${host}`;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();

  const requestUrl = new URL(req.url || "", baseUrl);
  const params = {};
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (!key && value) params[""] = value;
    else if (key && !value) params[""] = key.replace(/^=/, "");
    else params[key] = value;
  }
  const body = (req.body && typeof req.body === "object" && !Array.isArray(req.body)) ? req.body : {};
  const raw = pick(params, body, "domain", "tenmien", "host", "q") || extractFirstParam(params);

  if (!raw) return res.status(200).json(buildGuide(baseUrl));

  const domain = normalizeDomain(raw);
  const ascii = toAscii(domain);
  if (!isValidDomain(ascii)) {
    return res.status(400).json({
      trang_thai: "that_bai",
      thong_bao: "Tên miền không hợp lệ. Ví dụ: google.com, vietqr.io",
      dau_vao: raw
    });
  }
  try {
    const [dnsInfo, rdapInfo] = await Promise.all([lookupDns(ascii), lookupRdap(ascii)]);
    const exists = Boolean(dnsInfo.co_dns || rdapInfo.dang_ky);
    const tinhTrang = exists
      ? (rdapInfo.dang_ky ? "ĐÃ ĐĂNG KÝ" : "ĐANG CÓ DNS (có thể đã đăng ký)")
      : "KHÔNG TỒN TẠI / CÓ THỂ CÒN TRỐNG";

    const out = {
      trang_thai: "thanh_cong",
      chuyen_muc: "Check Tên Miền",
      ten_mien: domain,
      ten_ascii: ascii !== domain ? ascii : undefined,
      co_ton_tai: exists,
      tinh_trang: tinhTrang,
      dns: cleanObj({
        co_ban_ghi: dnsInfo.co_dns ? "CÓ" : "KHÔNG",
        a: dnsInfo.a,
        aaaa: dnsInfo.aaaa,
        ns: dnsInfo.ns,
        mx: dnsInfo.mx
      }),
      dang_ky: rdapInfo.dang_ky == null
        ? { rdap: "Không kiểm tra được WHOIS/RDAP cho TLD này" }
        : rdapInfo.dang_ky
          ? cleanObj(rdapInfo.chi_tiet)
          : { rdap: "Không thấy hồ sơ đăng ký" },
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    };
    if (!out.ten_ascii) delete out.ten_ascii;
    return res.status(200).json(out);
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message || "Không kiểm tra được tên miền.",
      tac_gia: "Hồ Đức Minh (Zhee Dev)"
    });
  }
};
