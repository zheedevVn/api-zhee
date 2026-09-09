const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
const UserAgent = require("user-agents");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");

const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const MAX_COUNT = 200;
const MAX_PROXY_CANDIDATES = 200;
const DEFAULT_TIMEOUT = 4000;

function setResponse(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function asCount(value) {
  const count = Number.parseInt(value, 10);
  return Math.min(MAX_COUNT, Math.max(1, Number.isFinite(count) ? count : 1));
}

function parseProxy(value) {
  if (!value) return null;
  if (typeof value === "object" && value.host && value.port) {
    const protocol = String(value.protocol || "http").replace(/:$/, "");
    return parseProxy(`${protocol}://${value.username && value.password ? `${encodeURIComponent(value.username)}:${encodeURIComponent(value.password)}@` : ""}${value.host}:${value.port}`);
  }

  let raw = String(value).trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `http://${raw}`;
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.replace(/:$/, "").toLowerCase();
    if (!["http", "https", "socks4", "socks4a", "socks5", "socks5h"].includes(protocol)) return null;
    if (!parsed.hostname || !parsed.port) return null;
    return {
      protocol,
      host: parsed.hostname,
      port: Number(parsed.port),
      username: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
      url: parsed.toString()
    };
  } catch (_) {
    return null;
  }
}

function proxyInput(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const query = req.query || {};
  const supplied = body.proxies ?? query.proxies ?? body.proxy ?? query.proxy;
  if (Array.isArray(supplied)) return supplied;
  if (supplied) {
    const text = String(supplied).trim();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return text.split(/[\r\n,;]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

async function loadProxyCandidates(req) {
  const supplied = proxyInput(req);
  let values = supplied;
  if (!values.length) {
    const filePath = process.env.REG_PROXY_FILE || path.join(__dirname, "..", "proxies.txt");
    try {
      const text = await fs.readFile(filePath, "utf8");
      values = text.split(/[\r\n]+/).map((item) => item.trim()).filter((item) => item && !item.startsWith("#"));
    } catch (_) {
      values = [];
    }
  }
  const unique = new Map();
  values.slice(0, MAX_PROXY_CANDIDATES).forEach((value) => {
    const parsed = parseProxy(value);
    if (parsed) unique.set(parsed.url, parsed);
  });
  return [...unique.values()];
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function createAgent(proxy) {
  if (/^socks/i.test(proxy.protocol)) return new SocksProxyAgent(proxy.url);
  return new HttpsProxyAgent(proxy.url);
}

async function checkProxy(proxy) {
  try {
    const agent = createAgent(proxy);
    const response = await axios.get("https://api.ipify.org?format=json", {
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
      timeout: DEFAULT_TIMEOUT,
      validateStatus: (status) => status === 200
    });
    return {
      live: true,
      proxy: proxy.url,
      exit_ip: response.data?.ip || null,
      latency_ms: null
    };
  } catch (_) {
    return { live: false, proxy: proxy.url };
  }
}

async function findLiveProxy(proxies) {
  const checked = [];
  for (const proxy of shuffle(proxies)) {
    const started = Date.now();
    const result = await checkProxy(proxy);
    result.latency_ms = Date.now() - started;
    checked.push(result);
    if (result.live) return { result, checked };
  }
  return { result: null, checked };
}

function generateUserAgents(count) {
  const issued = new Set();
  let attempts = 0;
  while (issued.size < count && attempts < count * 50) {
    issued.add(new UserAgent().toString());
    attempts += 1;
  }
  return [...issued];
}

module.exports = async function regHandler(req, res) {
  setResponse(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const count = asCount(body.count ?? req.query?.count);
    const userAgents = generateUserAgents(count);
    const proxies = await loadProxyCandidates(req);
    const shouldCheckProxy = proxies.length > 0 || body.check_proxy === true || req.query?.check_proxy === "true";
    const proxyCheck = shouldCheckProxy ? await findLiveProxy(proxies) : { result: null, checked: [] };

    return res.status(200).json({
      trang_thai: "thanh_cong",
      type: "reg_internal",
      synthetic: true,
      count: userAgents.length,
      user_agents: userAgents,
      proxy: proxyCheck.result,
      proxy_status: shouldCheckProxy
        ? (proxyCheck.result ? "LIVE" : "NO_LIVE_PROXY_FOUND")
        : "NOT_REQUESTED",
      proxies_checked: proxyCheck.checked.length,
      checked_at: new Date().toISOString(),
      tac_gia: AUTHOR,
      ghi_chu: "Proxy chỉ được đọc từ proxies.txt hoặc danh sách proxy do người dùng cung cấp; không tải proxy công khai."
    });
  } catch (error) {
    return res.status(500).json({
      trang_thai: "that_bai",
      thong_bao: error.message,
      tac_gia: AUTHOR
    });
  }
};

module.exports.parseProxy = parseProxy;
module.exports.generateUserAgents = generateUserAgents;
module.exports.findLiveProxy = findLiveProxy;
