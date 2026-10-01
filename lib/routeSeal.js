const crypto = require("crypto");

const SEAL_SECRET = process.env.ZHEE_ROUTE_SEAL || "ZheeDev.RouteSeal.v1.HoDucMinh.AIzaSy.8c4e1b7a9d2f6e0c5a3b8d7e1f4a6c9b";

function tokenFor(canonicalPath) {
  let block = Buffer.from(`zhee-seal-v1\n${canonicalPath}`, "utf8");
  let out = "AIzaSy";
  for (let i = 0; i < 6; i += 1) {
    block = crypto.createHmac("sha512", SEAL_SECRET).update(block).update(String(i)).update(canonicalPath).digest();
    out += block.toString("base64url");
  }
  return out;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSealMap(routes) {
  const byToken = new Map();
  const byPrefix = new Map();
  const prefixes = [];
  for (const route of routes) {
    const canonical = route.prefix[0];
    const publicPath = `/g/${tokenFor(canonical)}`;
    byToken.set(tokenFor(canonical), canonical);
    for (const prefix of route.prefix) {
      byPrefix.set(prefix, publicPath);
      prefixes.push(prefix);
    }
  }
  prefixes.sort((a, b) => b.length - a.length);
  return { byToken, byPrefix, prefixes };
}

function resolveToken(token, map) {
  return map.byToken.get(String(token || "")) || null;
}

function matchesRegistered(pathname, map) {
  return map.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function sealString(value, map) {
  if (typeof value !== "string" || !value.includes("/")) return value;
  let out = value;
  for (const prefix of map.prefixes) {
    if (!out.includes(prefix)) continue;
    const replacement = map.byPrefix.get(prefix);
    const re = new RegExp(`${escapeRegExp(prefix)}(?=$|[/?#"'\\s<)])`, "g");
    out = out.replace(re, replacement);
  }
  return out;
}

function sealBody(value, map) {
  if (typeof value === "string") return sealString(value, map);
  if (Array.isArray(value)) return value.map((item) => sealBody(item, map));
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value)) out[key] = sealBody(value[key], map);
    return out;
  }
  return value;
}

function publicPathFor(canonicalPath, map) {
  return map.byPrefix.get(canonicalPath) || canonicalPath;
}

module.exports = {
  tokenFor,
  buildSealMap,
  resolveToken,
  matchesRegistered,
  sealBody,
  publicPathFor
};
