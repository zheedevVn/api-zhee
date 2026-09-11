const AUTHOR = "Hồ Đức Minh (Zhee Dev)";
const TZ = 7;

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function query(req) {
  const url = new URL(req.url || "/", `https://${req.headers?.host || "api-zhee.vercel.app"}`);
  const first = [...url.searchParams.entries()].find(([key, value]) => (!key && value) || (key && !value));
  return { url, params: url.searchParams, first: first ? (first[1] || first[0]).trim() : "" };
}

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json({ ...body, tac_gia: AUTHOR });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(12000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${response.status}: ${body?.error || body?.message || "Upstream error"}`);
  return body;
}

const QUIZ_CATEGORIES = {
  general: 9, books: 10, film: 11, music: 12, television: 14, games: 15,
  science: 17, computers: 18, math: 19, mythology: 20, sports: 21,
  geography: 22, history: 23, politics: 24, art: 25, celebrities: 26,
  animals: 27, vehicles: 28, comics: 29, gadgets: 30, anime: 31, cartoons: 32
};
const QUIZ_CACHE = new Map();
let quizTokenPromise;

async function getQuizToken() {
  if (!quizTokenPromise) {
    quizTokenPromise = fetchJson("https://opentdb.com/api_token.php?command=request")
      .then((payload) => payload.response_code === 0 ? payload.token : "")
      .catch(() => "");
  }
  return quizTokenPromise;
}

function fallbackQuizQuestions(categoryRaw, amount) {
  const bank = [
    { cau_hoi: "Thủ đô của Việt Nam là thành phố nào?", dap_an_dung: "Hà Nội", dap_an: ["Hà Nội", "Huế", "Đà Nẵng", "Hải Phòng"] },
    { cau_hoi: "Chiến thắng Điện Biên Phủ diễn ra vào năm nào?", dap_an_dung: "1954", dap_an: ["1945", "1954", "1968", "1975"] },
    { cau_hoi: "Ai là người đọc Tuyên ngôn Độc lập ngày 2/9/1945?", dap_an_dung: "Chủ tịch Hồ Chí Minh", dap_an: ["Chủ tịch Hồ Chí Minh", "Võ Nguyên Giáp", "Phan Bội Châu", "Trần Hưng Đạo"] },
    { cau_hoi: "Việt Nam có bao nhiêu vùng kinh tế - xã hội?", dap_an_dung: "6", dap_an: ["4", "5", "6", "7"] },
    { cau_hoi: "Vịnh Hạ Long thuộc tỉnh/thành phố nào?", dap_an_dung: "Quảng Ninh", dap_an: ["Quảng Ninh", "Thanh Hóa", "Nghệ An", "Khánh Hòa"] }
  ];
  return bank.slice(0, Math.min(amount, bank.length)).map((item, index) => ({ stt: index + 1, ...item, danh_muc: categoryRaw, do_kho: "fallback", loai: "multiple" }));
}

async function quiz(req, res, params) {
  const categoryRaw = params.get("category") || "general";
  const category = QUIZ_CATEGORIES[String(categoryRaw).toLowerCase()] || (/^\d+$/.test(categoryRaw) ? categoryRaw : 9);
  const amount = Math.min(50, Math.max(1, Number(params.get("amount") || 5)));
  const difficulty = params.get("difficulty");
  const type = params.get("type") || "multiple";
  const cacheKey = `${category}|${amount}|${difficulty || ""}|${type}`;
  const cached = QUIZ_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return send(res, 200, { ...cached.body, cache_hit: true });
  const api = new URL("https://opentdb.com/api.php");
  api.searchParams.set("amount", String(amount)); api.searchParams.set("category", String(category)); api.searchParams.set("type", type === "boolean" ? "boolean" : "multiple");
  if (["easy", "medium", "hard"].includes(difficulty)) api.searchParams.set("difficulty", difficulty);
  const token = await getQuizToken(); if (token) api.searchParams.set("token", token);
  let questions = []; let fallback = false;
  try {
    const payload = await fetchJson(api);
    if (payload.response_code !== 0) throw new Error(`Open Trivia DB response_code=${payload.response_code}`);
    questions = (payload.results || []).map((item, index) => ({ stt: index + 1, cau_hoi: decodeHtml(item.question), danh_muc: decodeHtml(item.category), do_kho: item.difficulty, loai: item.type, dap_an: [item.correct_answer, ...(item.incorrect_answers || [])].map(decodeHtml).sort(() => Math.random() - 0.5), dap_an_dung: decodeHtml(item.correct_answer) }));
  } catch (_) {
    fallback = true;
    questions = fallbackQuizQuestions(categoryRaw, amount);
  }
  const body = { trang_thai: "thanh_cong", loai: "quiz_room", nguon: fallback ? "Zhee API - Bộ câu hỏi dự phòng" : "Open Trivia DB", tham_so: { category: categoryRaw, amount, difficulty: difficulty || null, type }, so_cau_hoi: questions.length, cau_hoi: questions, canh_bao: fallback ? "Open Trivia DB đang giới hạn truy cập (429); hệ thống đã dùng bộ câu hỏi dự phòng tiếng Việt." : null };
  QUIZ_CACHE.set(cacheKey, { expiresAt: Date.now() + 60000, body });
  return send(res, 200, { ...body, cache_hit: false });
}

async function translateToVietnamese(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", "vi");
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", raw);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const payload = await response.json();
    const translated = Array.isArray(payload?.[0]) ? payload[0].map((part) => part?.[0] || "").join("").trim() : "";
    return translated || raw;
  } catch (_) {
    return raw;
  }
}

async function quoteDaily(req, res) {
  try {
    const zen = await fetchJson("https://zenquotes.io/api/today");
    const item = Array.isArray(zen) ? zen[0] : zen;
    if (item?.q) {
      const quoteVietnamese = await translateToVietnamese(item.q);
      return send(res, 200, { trang_thai: "thanh_cong", loai: "quote_daily", nguon: "ZenQuotes", ngon_ngu: "vi", quote: quoteVietnamese, loi_khuyen_tieng_viet: quoteVietnamese, cau_goc: item.q, tac_gia_quote: item.a, ngay: new Date().toISOString().slice(0, 10) });
    }
  } catch (_) {}
  const advice = await fetchJson("https://api.adviceslip.com/advice");
  const original = advice.slip?.advice || "Hãy kiên trì với mục tiêu của bạn.";
  return send(res, 200, { trang_thai: "thanh_cong", loai: "advice_daily", nguon: "Advice Slip", ngon_ngu: "vi", loi_khuyen_tieng_viet: await translateToVietnamese(original), cau_goc: original, id: advice.slip?.id || null, ngay: new Date().toISOString().slice(0, 10) });
}

function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12); const y = yy + 4800 - a; const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  return jd;
}
function getNewMoonDay(k, timeZone) { const T = k / 1236.85; const T2 = T*T; const T3 = T2*T; const dr = Math.PI / 180; let jd1 = 2415020.75933 + 29.53058868*k + 0.0001178*T2 - 0.000000155*T3; jd1 += 0.00033 * Math.sin((166.56 + 132.87*T - 0.009173*T2)*dr); const M = 359.2242 + 29.1053567*k - 0.0000333*T2 - 0.00000347*T3; const Mpr = 306.0253 + 385.81691806*k + 0.0107306*T2 + 0.00001236*T3; const F = 21.2964 + 390.67050646*k - 0.0016528*T2 - 0.00000239*T3; let C1 = (0.1734 - 0.000393*T)*Math.sin(M*dr) + 0.0021*Math.sin(2*dr*M) - 0.4068*Math.sin(Mpr*dr) + 0.0161*Math.sin(dr*2*Mpr) - 0.0004*Math.sin(dr*3*Mpr) + 0.0104*Math.sin(dr*2*F) - 0.0051*Math.sin(dr*(M+Mpr)) - 0.0074*Math.sin(dr*(M-Mpr)) + 0.0004*Math.sin(dr*(2*F+M)) - 0.0004*Math.sin(dr*(2*F-M)) - 0.0006*Math.sin(dr*(2*F+Mpr)) + 0.0010*Math.sin(dr*(2*F-Mpr)) + 0.0005*Math.sin(dr*(2*Mpr+M)); const deltaT = T < -11 ? 0.001 + 0.000839*T + 0.0002261*T2 - 0.00000845*T3 - 0.000000081*T*T3 : -0.000278 + 0.000265*T + 0.000262*T2; const time = jd1 + C1 - deltaT; return Math.floor(time + 0.5 + timeZone/24); }
function getSunLongitude(jdn) { const T = (jdn - 2451545.5) / 36525; const T2 = T*T; const dr = Math.PI/180; const M = 357.52910 + 35999.05030*T - 0.0001559*T2 - 0.00000048*T*T2; const L0 = 280.46645 + 36000.76983*T + 0.0003032*T2; const DL = (1.914600 - 0.004817*T - 0.000014*T2)*Math.sin(dr*M) + (0.019993 - 0.000101*T)*Math.sin(2*dr*M) + 0.000290*Math.sin(3*dr*M); return Math.floor((L0 + DL) / 30 * 6) % 12; }
function getLunarMonth11(yy, timeZone) { const off = jdFromDate(31, 12, yy) - 2415021; const k = Math.floor(off / 29.530588853); const nm = getNewMoonDay(k, timeZone); return getSunLongitude(nm) >= 9 ? getNewMoonDay(k - 1, timeZone) : nm; }
function getLeapMonthOffset(a11, timeZone) { const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853); let last = 0; let i = 1; let arc = getSunLongitude(getNewMoonDay(k + i, timeZone)); do { last = arc; i++; arc = getSunLongitude(getNewMoonDay(k + i, timeZone)); } while (arc !== last && i < 15); return i - 1; }
function convertSolar2Lunar(dd, mm, yy, timeZone) { const dayNumber = jdFromDate(dd, mm, yy); const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853); let monthStart = getNewMoonDay(k + 1, timeZone); if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone); let a11 = getLunarMonth11(yy, timeZone); let b11 = a11; let lunarYear; if (a11 >= monthStart) { lunarYear = yy; a11 = getLunarMonth11(yy - 1, timeZone); } else { lunarYear = yy + 1; b11 = getLunarMonth11(yy + 1, timeZone); } const lunarDay = dayNumber - monthStart + 1; const diff = Math.floor((monthStart - a11) / 29); let lunarLeap = 0; let lunarMonth = diff + 11; if (b11 - a11 > 365) { const leapMonthDiff = getLeapMonthOffset(a11, timeZone); if (diff >= leapMonthDiff) { lunarMonth = diff + 10; if (diff === leapMonthDiff) lunarLeap = 1; } } if (lunarMonth > 12) lunarMonth -= 12; if (lunarMonth >= 11 && diff < 4) lunarYear--; return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap }; }
function canChiYear(year) { return ["Canh","Tân","Nhâm","Quý","Giáp","Ất","Bính","Đinh","Mậu","Kỷ"][(year+6)%10] + " " + ["Thân","Dậu","Tuất","Hợi","Tý","Sửu","Dần","Mão","Thìn","Tỵ","Ngọ","Mùi"][(year+8)%12]; }
function canChiDay(jd) { return ["Giáp Tý","Ất Sửu","Bính Dần","Đinh Mão","Mậu Thìn","Kỷ Tỵ","Canh Ngọ","Tân Mùi","Nhâm Thân","Quý Dậu","Giáp Tuất","Ất Hợi","Bính Tý","Đinh Sửu","Mậu Dần","Kỷ Mão","Canh Thìn","Tân Tỵ","Nhâm Ngọ","Quý Mùi","Canh Thân","Tân Dậu","Nhâm Tuất","Quý Hợi"][(jd + 9) % 60] || "Không rõ"; }
function numberToVietnamese(value) { const n = String(value).replace(/\D/g, ""); if (!n) return "Không hợp lệ"; if (BigInt(n) === 0n) return "Không đồng"; const units = [""," nghìn"," triệu"," tỷ"]; const digit = ["không","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"]; function block(x, full) { const a = Math.floor(x/100), b = Math.floor((x%100)/10), c=x%10; let s=""; if(a||full)s+=digit[a]+" trăm"; if(b>1)s+=(s?" ":"")+digit[b]+" mươi"; else if(b===1)s+=(s?" ":"")+"mười"; else if(c&&a)s+=(s?" ":"")+"lẻ"; if(c){let d=digit[c]; if(b>1&&c===1)d="mốt"; if(b>0&&c===5)d="lăm"; s+=(s?" ":"")+d;} return s;} let x=BigInt(n), groups=[]; while(x>0n){groups.push(Number(x%1000n));x/=1000n;} return groups.map((v,i)=>v?(block(v,i===groups.length-1)+units[i]):"").filter(Boolean).reverse().join(" ")+" đồng chẵn"; }

const PLATES = { 11:"Cao Bằng",12:"Lạng Sơn",14:"Quảng Ninh",15:"Hải Phòng",16:"Hải Phòng",17:"Thái Bình",18:"Nam Định",19:"Phú Thọ",20:"Thái Nguyên",21:"Yên Bái",22:"Tuyên Quang",23:"Hà Giang",24:"Lào Cai",25:"Lai Châu",26:"Sơn La",27:"Điện Biên",28:"Hòa Bình",29:"Hà Nội",30:"Hà Nội",31:"Hà Nội",32:"Hà Nội",33:"Hà Nội",34:"Hải Dương",35:"Ninh Bình",36:"Thanh Hóa",37:"Nghệ An",38:"Hà Tĩnh",40:"Nghệ An",43:"Đà Nẵng",47:"Đắk Lắk",48:"Đắk Nông",49:"Lâm Đồng",50:"TP. Hồ Chí Minh",51:"TP. Hồ Chí Minh",52:"TP. Hồ Chí Minh",53:"TP. Hồ Chí Minh",54:"TP. Hồ Chí Minh",55:"TP. Hồ Chí Minh",56:"TP. Hồ Chí Minh",57:"TP. Hồ Chí Minh",58:"TP. Hồ Chí Minh",59:"TP. Hồ Chí Minh",60:"Đồng Nai",61:"Bình Dương",62:"Long An",63:"Tiền Giang",64:"Vĩnh Long",65:"Cần Thơ",66:"Đồng Tháp",67:"An Giang",68:"Kiên Giang",69:"Cà Mau",70:"Tây Ninh",71:"Bến Tre",72:"Bà Rịa - Vũng Tàu",73:"Quảng Bình",74:"Quảng Trị",75:"Thừa Thiên Huế",76:"Quảng Ngãi",77:"Bình Định",78:"Phú Yên",79:"Khánh Hòa",80:"Cục CSGT",81:"Gia Lai",82:"Kon Tum",83:"Sóc Trăng",84:"Trà Vinh",85:"Ninh Thuận",86:"Bình Thuận",88:"Vĩnh Phúc",89:"Hưng Yên",90:"Hà Nam",92:"Quảng Nam",93:"Bắc Kạn",94:"Bắc Giang",95:"Bạc Liêu",97:"Bắc Kạn",98:"Bắc Giang",99:"Bắc Ninh" };

module.exports = async (req, res) => {
  const { url, params, first } = query(req);
  const path = url.pathname.toLowerCase();
  try {
    if (path === "/giaitri" || path === "/api/giaitri") return send(res, 200, { trang_thai: "thanh_cong", chuyen_muc: "Giải trí & Tiện ích Việt Nam", danh_sach: ["/api/quiz", "/api/quote/daily", "/api/vn/lunar", "/api/vn/plate", "/api/vn/fuel", "/api/vn/text", "/api/vn/number-to-words"] });
    if (path === "/quiz" || path === "/api/quiz") return quiz(req, res, params);
    if (path === "/quote/daily" || path === "/api/quote/daily") return quoteDaily(req, res);
    if (path === "/vn/lunar" || path === "/api/vn/lunar") { const raw = params.get("date") || first || new Date().toISOString().slice(0,10); const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return send(res,400,{trang_thai:"that_bai",thong_bao:"date phải có dạng YYYY-MM-DD"}); const [y,mo,d]=m.slice(1).map(Number); const lunar=convertSolar2Lunar(d,mo,y,TZ); const jd=jdFromDate(d,mo,y); return send(res,200,{trang_thai:"thanh_cong",duong_lich:raw,am_lich:lunar,can_chi:{nam:canChiYear(lunar.year),ngay:canChiDay(jd)},gio_tot:["Tý (23:00-01:00)","Dần (03:00-05:00)","Mão (05:00-07:00)","Ngọ (11:00-13:00)","Thân (15:00-17:00)","Dậu (17:00-19:00)"],nguon:"Thuật toán Hồ Ngọc Đức"}); }
    if (path === "/vn/plate" || path === "/api/vn/plate") { const code=String(params.get("code")||params.get("ma")||first).match(/\d{2}/)?.[0]; if(!code) return send(res,400,{trang_thai:"that_bai",thong_bao:"Nhập mã biển số, ví dụ 29, 30 hoặc 51."}); return send(res,200,{trang_thai:"thanh_cong",ma_bien_so:Number(code),tinh_thanh:PLATES[Number(code)]||"Chưa có trong danh mục",co_trong_danh_muc:Boolean(PLATES[Number(code)])}); }
    if (path === "/vn/holidays" || path === "/api/vn/holidays") { const dateRaw=params.get("date")||new Date().toISOString().slice(0,10); const holidays=[{date:`${dateRaw.slice(0,4)}-01-01`,ten:"Tết Dương lịch"},{date:`${dateRaw.slice(0,4)}-04-30`,ten:"Ngày Giải phóng miền Nam"},{date:`${dateRaw.slice(0,4)}-05-01`,ten:"Ngày Quốc tế Lao động"},{date:`${dateRaw.slice(0,4)}-09-02`,ten:"Ngày Quốc khánh"}]; const target=new Date(`${dateRaw}T00:00:00+07:00`); const upcoming=holidays.map((item)=>({...item,ngay_con_lai:Math.ceil((new Date(`${item.date}T00:00:00+07:00`)-target)/86400000)})).filter((item)=>item.ngay_con_lai>=0).sort((a,b)=>a.ngay_con_lai-b.ngay_con_lai)[0]||null; return send(res,200,{trang_thai:"thanh_cong",ngay_kiem_tra:dateRaw,la_ngay_le:holidays.some((item)=>item.date===dateRaw),cac_ngay_le:holidays,ky_nghi_sap_toi:upcoming,ghi_chu:"Lịch nghỉ Tết Âm lịch cần cập nhật theo từng năm và nghị định chính thức."}); }
    if (path === "/vn/thesaurus" || path === "/api/vn/thesaurus") { const word=String(params.get("word")||params.get("q")||first||"").trim().toLowerCase(); const dict={"đẹp":{dong_nghia:["xinh","đẹp đẽ","mỹ lệ"],trai_nghia:["xấu","thô kệch"]},"nhanh":{dong_nghia:["mau","nhanh chóng","thoăn thoắt"],trai_nghia:["chậm","ì ạch"]},"vui":{dong_nghia:["hân hoan","phấn khởi","mừng"],trai_nghia:["buồn","u sầu"]},"thông minh":{dong_nghia:["sáng dạ","trí tuệ","sáng suốt"],trai_nghia:["ngu dốt","kém hiểu biết"]}}; return send(res,200,{trang_thai:"thanh_cong",tu_khoa:word,ket_qua:dict[word]||{dong_nghia:[],trai_nghia:[]},ghi_chu:dict[word]?"Dữ liệu từ điển cục bộ":"Chưa có dữ liệu cho từ này; có thể bổ sung vào kho từ."}); }
    if (path === "/vn/fuel" || path === "/api/vn/fuel") { const response=await fetch("https://www.petrolimex.com.vn/nd/gia-xang-dau.html",{signal:AbortSignal.timeout(12000)}); const html=await response.text(); const giaXangDau={}; for(const [key,pattern] of Object.entries({xang_ron_95:/RON\s*95[^\d]{0,100}(\d{1,3}[.,]\d{3})/i,xang_e5:/E5[^\d]{0,100}(\d{1,3}[.,]\d{3})/i,dau_diesel:/(?:Diesel|DO)\s*[^\d]{0,100}(\d{1,3}[.,]\d{3})/i})){giaXangDau[key]=html.match(pattern)?.[1]?.replace(",",".")||null;} return send(res,200,{trang_thai:"thanh_cong",nguon_du_lieu:"Petrolimex",thoi_diem_cap_nhat:new Date().toISOString(),gia_xang_dau:giaXangDau,ghi_chu:"Giá phụ thuộc kỳ điều hành và HTML nguồn Petrolimex."}); }
    if (path === "/vn/text" || path === "/api/vn/text") { const text=params.get("text")||params.get("q")||first||""; const action=params.get("action")||"slug"; if(!text)return send(res,400,{trang_thai:"that_bai",thong_bao:"Nhập text qua ?text=..."}); const noAccent=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d"); const slug=noAccent.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); return send(res,200,{trang_thai:"thanh_cong",van_ban:text,action,khong_dau:noAccent,slug}); }
    if (path === "/vn/number-to-words" || path === "/api/vn/number-to-words") { const number=params.get("number")||params.get("so")||first||""; return send(res,200,{trang_thai:"thanh_cong",so:number,chu:numberToVietnamese(number)}); }
    return send(res,404,{trang_thai:"that_bai",thong_bao:"Không tìm thấy endpoint Giải trí."});
  } catch (error) { return send(res,502,{trang_thai:"that_bai",ma_loi:"GIAITRI_UPSTREAM_ERROR",thong_bao:error.message}); }
};
