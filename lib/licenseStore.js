const crypto = require("crypto");

const LOCAL_STORE = new Map();
const STORE_PREFIX = "zhee:license:";
const SESSION_PREFIX = "zhee:telegram:session:";
const INDEX_KEY = "zhee:license:index";
const BOT_MESSAGE_PREFIX = "zhee:telegram:last-message:";
const PENDING_PREFIX = "zhee:telegram:pending:";

function redisConfig() {
  return {
    url: String(process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, ""),
    token: String(process.env.UPSTASH_REDIS_REST_TOKEN || "")
  };
}

function hasRedis() {
  const config = redisConfig();
  return Boolean(config.url && config.token);
}

function hashLicense(key) {
  return crypto.createHash("sha256").update(String(key).trim()).digest("hex");
}

function randomChunk(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function generateLicenseKey() {
  return `LICESEN-${randomChunk(3)}-${randomChunk(4)}-${randomChunk(4)}-${randomChunk(3)}-${randomChunk(8)}`;
}

async function redisCommand(command) {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error(`Upstash Redis HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function getValue(key) {
  if (hasRedis()) return redisCommand(["GET", key]);
  const item = LOCAL_STORE.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    LOCAL_STORE.delete(key);
    return null;
  }
  return item.value;
}

async function setValue(key, value, ttlSeconds) {
  if (hasRedis()) return redisCommand(["SET", key, JSON.stringify(value), "EX", Math.max(1, ttlSeconds)]);
  LOCAL_STORE.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  return "OK";
}

async function deleteValue(key) {
  if (hasRedis()) return redisCommand(["DEL", key]);
  LOCAL_STORE.delete(key);
  return 1;
}

async function getIndex() {
  const raw = await getValue(INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (_) { return []; }
}

async function saveIndex(index) {
  await setValue(INDEX_KEY, index.slice(-500), 60 * 60 * 24 * 365);
}

async function createLicense(hours = 1, note = "Telegram user") {
  if (process.env.NODE_ENV === "production" && !hasRedis()) {
    const error = new Error("License production yêu cầu UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN.");
    error.code = "LICENSE_STORE_NOT_CONFIGURED";
    throw error;
  }
  const safeHours = Math.min(8760, Math.max(1, Number(hours) || 1));
  const key = generateLicenseKey();
  const now = Date.now();
  const record = {
    hash: hashLicense(key),
    hours: safeHours,
    note: String(note || "Telegram user").slice(0, 120),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + safeHours * 60 * 60 * 1000).toISOString(),
    status: "active"
  };
  await setValue(`${STORE_PREFIX}${record.hash}`, record, safeHours * 60 * 60 + 86400);
  const index = await getIndex();
  index.push({ hash: record.hash, key, masked: `${key.slice(0, 11)}...${key.slice(-6)}`, ...record });
  await saveIndex(index);
  return { key, ...record };
}

async function verifyLicense(key) {
  const normalized = String(key || "").trim().toUpperCase();
  if (!/^LICESEN-[A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{8}$/.test(normalized)) {
    return { valid: false, reason: "Sai định dạng license key." };
  }
  const record = await getValue(`${STORE_PREFIX}${hashLicense(normalized)}`);
  if (!record) return { valid: false, reason: "License không tồn tại hoặc đã bị thu hồi." };
  const parsed = typeof record === "string" ? JSON.parse(record) : record;
  if (parsed.status !== "active" || Date.now() >= Date.parse(parsed.expires_at)) {
    return { valid: false, reason: "License đã hết hạn hoặc bị khóa." };
  }
  return { valid: true, record: parsed, hash: parsed.hash };
}

async function activateLicense(chatId, key) {
  const result = await verifyLicense(key);
  if (!result.valid) return result;
  const remaining = Math.max(1, Math.ceil((Date.parse(result.record.expires_at) - Date.now()) / 1000));
  await setValue(`${SESSION_PREFIX}${chatId}`, { license_hash: result.hash, activated_at: new Date().toISOString(), expires_at: result.record.expires_at }, Math.min(3600, remaining));
  return { ...result, session_expires_at: new Date(Date.now() + Math.min(3600, remaining) * 1000).toISOString() };
}

async function verifySession(chatId) {
  const raw = await getValue(`${SESSION_PREFIX}${chatId}`);
  if (!raw) return { valid: false, reason: "Phiên đã hết hạn. Hãy nhập lại license." };
  const session = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (Date.now() >= Date.parse(session.expires_at)) {
    await deleteValue(`${SESSION_PREFIX}${chatId}`);
    return { valid: false, reason: "Phiên đã hết hạn. Hãy nhập lại license." };
  }
  const license = await getValue(`${STORE_PREFIX}${session.license_hash}`);
  if (!license) return { valid: false, reason: "License không còn hiệu lực." };
  return { valid: true, session, license: typeof license === "string" ? JSON.parse(license) : license };
}

async function revokeLicense(key) {
  const hash = hashLicense(String(key || "").trim().toUpperCase());
  const result = await deleteValue(`${STORE_PREFIX}${hash}`);
  const index = await getIndex();
  await saveIndex(index.filter((item) => item.hash !== hash));
  return result;
}

async function listLicenses() {
  const now = Date.now();
  const index = await getIndex();
  const active = index.filter((item) => item.status === "active" && Date.parse(item.expires_at) > now);
  if (active.length !== index.length) await saveIndex(active);
  return active.slice(-50).reverse();
}

async function getBotMessageId(chatId) {
  const raw = await getValue(`${BOT_MESSAGE_PREFIX}${chatId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.message_ids) ? parsed.message_ids : (parsed.message_id ? [parsed.message_id] : []);
  } catch (_) { return []; }
}

async function setBotMessageId(chatId, messageIds) {
  const ids = Array.isArray(messageIds) ? messageIds.filter(Boolean) : [messageIds].filter(Boolean);
  return setValue(`${BOT_MESSAGE_PREFIX}${chatId}`, { message_ids: ids }, 86400);
}

async function getPendingAction(chatId) {
  const raw = await getValue(`${PENDING_PREFIX}${chatId}`);
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { return null; }
}

async function setPendingAction(chatId, action) {
  return setValue(`${PENDING_PREFIX}${chatId}`, { action: String(action || "") }, 600);
}

async function clearPendingAction(chatId) {
  return deleteValue(`${PENDING_PREFIX}${chatId}`);
}

module.exports = {
  hasRedis,
  generateLicenseKey,
  createLicense,
  verifyLicense,
  activateLicense,
  verifySession,
  revokeLicense,
  listLicenses,
  getBotMessageId,
  setBotMessageId,
  getPendingAction,
  setPendingAction,
  clearPendingAction
};
