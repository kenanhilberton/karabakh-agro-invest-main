// KarabakhAgroInvest — AI assistant service.
//
// The assistant tries, in order:
//   1. Any provider whose API key is present in the environment
//      (Groq / OpenAI / OpenRouter / Mistral / Gemini).
//   2. A locally running Ollama server (if reachable).
//   3. Pollinations (free, key-less) — heavily rate limited, so it is
//      guarded by a cooldown and skipped while cooling down.
//   4. A built-in, offline Azerbaijani knowledge engine that answers
//      platform, land/project data and agronomy questions instantly.
//
// It never throws for the caller: `answer()` always resolves with a reply.

import {
  listLands,
  getLand,
  listInvestmentProjects,
  listCompetitions
} from '../db/repository.js';
import { CROPS, CROP_ECONOMICS, DISTRICTS } from '../data/seed.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Fold Azerbaijani/Turkish letters to plain ASCII so keyword matching is
// robust against ş/ç/ğ/ə/ı/ö/ü and capital forms.
export function fold(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[əә]/g, 'e')
    .replace(/[ı]/g, 'i')
    .replace(/[ş]/g, 's')
    .replace(/[ç]/g, 'c')
    .replace(/[ğ]/g, 'g')
    .replace(/[ö]/g, 'o')
    .replace(/[ü]/g, 'u')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const has = (q, ...words) => words.some((w) => q.includes(w));
const anyRe = (q, ...res) => res.some((r) => r.test(q));

/* ------------------------------------------------------------------ */
/* Remote providers                                                    */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = [
  'Sən "KarabakhAgroInvest" rəsmi AI köməkçisisən.',
  'Platforma işğaldan azad edilmiş Qarabağ rayonlarında aqrar biznesə birgə investisiya (co-investment) cəlb edir.',
  'İSTƏNİLƏN suala cavab ver — həm platforma ilə bağlı, həm də ümumi bilik suallarına.',
  'Qaydalar: qısa və konkret ol; standart olaraq Azərbaycan dilində cavab ver (istifadəçi başqa dil istəsə o dildə);',
  'lazım olduqda siyahıdan istifadə et; cavabı 6 cümlədən çox uzatma; uydurma məlumat vermə.',
  'Platformada: torpaq sahələri, müsabiqələr, investor təklifləri, EKTİS təsdiqi, NDVI peyk indeksi və ROI kalkulyatoru mövcuddur.'
].join(' ');

let pollinationsCooldownUntil = 0;
const MAX_FREE_WAIT_MS = 32000;

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

function parseRetryAfterMs(err) {
  const body = String(err?.body || '');
  const m = body.match(/retry after\s+(\d+)\s*s/i);
  if (m) return Number(m[1]) * 1000 + 1500;
  return 30000;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

async function callOpenAICompatible({ url, key, model, messages, extraHeaders = {}, timeoutMs = 20000 }) {
  const t = withTimeout(timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
      signal: t.controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = text;
      throw err;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return text.trim();
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    throw new Error('boş cavab');
  } finally {
    t.done();
  }
}

async function callGemini({ key, model, messages, timeoutMs = 20000 }) {
  const t = withTimeout(timeoutMs);
  try {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = { contents };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: t.controller.signal }
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = JSON.parse(text);
    const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(' ');
    if (content && content.trim()) return content.trim();
    throw new Error('boş cavab');
  } finally {
    t.done();
  }
}

async function callOllama({ baseUrl, model, messages, timeoutMs = 30000 }) {
  const t = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: t.controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = JSON.parse(text);
    const content = data?.message?.content;
    if (content && content.trim()) return content.trim();
    throw new Error('boş cavab');
  } finally {
    t.done();
  }
}

function buildProviders() {
  const list = [];
  if (process.env.GROQ_API_KEY) {
    list.push({
      name: 'groq',
      run: (m) => callOpenAICompatible({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: m
      })
    });
  }
  if (process.env.OPENAI_API_KEY) {
    list.push({
      name: 'openai',
      run: (m) => callOpenAICompatible({
        url: `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`,
        key: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: m
      })
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    list.push({
      name: 'openrouter',
      run: (m) => callOpenAICompatible({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
        messages: m,
        extraHeaders: { 'HTTP-Referer': 'https://karabakh-agro-invest.az', 'X-Title': 'KarabakhAgroInvest' }
      })
    });
  }
  if (process.env.MISTRAL_API_KEY) {
    list.push({
      name: 'mistral',
      run: (m) => callOpenAICompatible({
        url: 'https://api.mistral.ai/v1/chat/completions',
        key: process.env.MISTRAL_API_KEY,
        model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
        messages: m
      })
    });
  }
  if (process.env.GEMINI_API_KEY) {
    list.push({
      name: 'gemini',
      run: (m) => callGemini({ key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.0-flash', messages: m })
    });
  }
  // Local Ollama (optional).
  if (process.env.OLLAMA_URL || process.env.OLLAMA_MODEL) {
    list.push({
      name: 'ollama',
      run: (m) => callOllama({
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        messages: m
      })
    });
  }
  // Key-less free provider (rate limited -> guarded by cooldown).
  list.push({
    name: 'pollinations',
    free: true,
    run: (m) => callOpenAICompatible({
      url: 'https://text.pollinations.ai/openai',
      model: process.env.POLLINATIONS_MODEL || 'openai',
      messages: m,
      extraHeaders: { Referer: 'https://karabakh-agro-invest.az' },
      timeoutMs: 25000
    })
  });
  return list;
}

function isRateLimit(err) {
  if (!err) return false;
  if (err.status === 429 || err.status === 402) return true;
  const body = String(err.body || err.message || '');
  return /FREE_LIMIT|rate limit|too many requests|limit reached/i.test(body);
}

async function askProviders(messages) {
  for (const provider of buildProviders()) {
    if (provider.free) {
      const wait = pollinationsCooldownUntil - Date.now();
      if (wait > 0) {
        // The free tier allows 1 reply / 30s per IP. Wait it out (bounded) so
        // general questions still get a real answer instead of a fallback.
        if (wait > MAX_FREE_WAIT_MS) continue;
        await sleep(wait + 300);
      }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const reply = await provider.run(messages);
        if (reply) return { reply, source: provider.name };
        break;
      } catch (err) {
        if (provider.free && isRateLimit(err)) {
          pollinationsCooldownUntil = Date.now() + parseRetryAfterMs(err);
          if (attempt === 0) {
            const w = pollinationsCooldownUntil - Date.now();
            if (w <= MAX_FREE_WAIT_MS) {
              await sleep(w);
              continue;
            }
          }
        }
        break; // next provider
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function cacheSet(key, reply, source) {
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(key, { reply, source, at: Date.now() });
}

/* ------------------------------------------------------------------ */
/* Offline knowledge engine                                            */
/* ------------------------------------------------------------------ */

const STATUS_AZ = { available: 'Mövcud', reserved: 'Rezerv', allocated: 'Ayrılıb' };
const RELIEF_AZ = { Düzənlik: 'Düzənlik', Dağlıq: 'Dağlıq', 'Dağ ətəyi': 'Dağ ətəyi' };

async function landsOverview() {
  const lands = await listLands();
  const total = lands.length;
  const available = lands.filter((l) => l.status === 'available').length;
  const reserved = lands.filter((l) => l.status === 'reserved').length;
  const allocated = lands.filter((l) => l.status === 'allocated').length;
  const area = lands.reduce((s, l) => s + (Number(l.areaHa) || 0), 0);
  const byDistrict = {};
  for (const l of lands) byDistrict[l.districtName || l.district] = (byDistrict[l.districtName || l.district] || 0) + 1;
  const districts = Object.entries(byDistrict)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ');
  const byPurpose = {};
  for (const l of lands) {
    const k = l.purposeLabel || l.purpose;
    byPurpose[k] = (byPurpose[k] || 0) + 1;
  }
  const purposes = Object.entries(byPurpose).map(([k, v]) => `${k}: ${v}`).join(' · ');
  return [
    `Platformada cəmi ${total} torpaq sahəsi var — ümumi sahə ≈ ${area.toFixed(0)} ha.`,
    `Statusa görə: ${available} mövcud, ${reserved} rezerv, ${allocated} ayrılmış.`,
    `Rayonlar üzrə: ${districts}.`,
    `İstiqamətlər üzrə: ${purposes}.`,
    'Xəritədə "Xəritə" bölməsindən sahələri filtrləyib araşdıra bilərsiniz.'
  ].join('\n');
}

async function districtLands(nameFolded) {
  const entry = Object.entries(DISTRICTS).find(([key, d]) => fold(d.name) === nameFolded || fold(key) === nameFolded);
  if (!entry) return null;
  const [key, d] = entry;
  const lands = await listLands({ district: key });
  if (!lands.length) return `${d.name} rayonunda qeydə alınmış torpaq sahəsi yoxdur.`;
  const lines = lands.map(
    (l) => `• ${l.code} — ${l.purposeLabel || l.purpose}, ${l.areaHa} ha, ${RELIEF_AZ[l.relief] || l.relief || '—'}, ${STATUS_AZ[l.status] || l.status}`
  );
  return `${d.name} rayonunda ${lands.length} sahə var:\n${lines.join('\n')}`;
}

async function landByCode(code) {
  const land = await getLand(code.toUpperCase());
  if (!land) return null;
  return [
    `${land.code} sahəsi — ${land.districtName || land.district}`,
    `• İstiqamət: ${land.purposeLabel || land.purpose}`,
    `• Sahə: ${land.areaHa} ha`,
    `• Relyef: ${RELIEF_AZ[land.relief] || land.relief || '—'}`,
    `• Status: ${STATUS_AZ[land.status] || land.status}`,
    `• pH: ${land.ph} · Münbitlik: ${land.fertility}/100 · Su mənbəyi: ${land.waterKm} km · Günəşli günlər: ${land.sunDays}`
  ].join('\n');
}

async function projectsOverview() {
  const projects = await listInvestmentProjects();
  const total = projects.length;
  const districts = {};
  for (const p of projects) districts[p.districtName || p.district] = (districts[p.districtName || p.district] || 0) + 1;
  const list = projects.slice(0, 5).map(
    (p) => `• ${p.title || p.code} — ${p.purposeLabel || p.purpose}, ${p.districtName || p.district}`
  );
  return [
    `Hazırda Birgəİnvest bölməsində ${total} investisiya layihəsi var.`,
    districts && Object.keys(districts).length ? `Rayonlar üzrə: ${Object.entries(districts).map(([k, v]) => `${k} (${v})`).join(', ')}.` : '',
    ...list,
    'İnvestor kimi istənilən layihəyə təklif göndərə bilərsiniz.'
  ].filter(Boolean).join('\n');
}

async function competitionsOverview() {
  const comps = await listCompetitions();
  if (!comps.length) return 'Hazırda aktiv müsabiqə yoxdur.';
  const lines = comps.map((c) => `• ${c.title}${c.status ? ` (${c.status})` : ''}${c.totalBudget ? ` — fond: ${c.totalBudget} ${c.currency || 'AZN'}` : ''}`);
  return `Müsabiqələr:\n${lines.join('\n')}`;
}

function cropInfo(key) {
  const c = CROPS[key];
  const e = CROP_ECONOMICS[key];
  if (!c || !e) return null;
  const net = Math.round(e.yieldTonPerHa * e.pricePerTon * 0.65);
  const roi = Math.round(((net * 5 - e.costPerHa) / e.costPerHa) * 100);
  return [
    `${e.icon} ${c.label}`,
    `• İlkin xərc: ~${e.costPerHa} AZN/ha`,
    `• Məhsuldarlıq: ~${e.yieldTonPerHa} ton/ha · Qiymət: ~${e.pricePerTon} AZN/ton`,
    `• Təxmini 5 illik ROI: ~${roi}%`,
    `• Optimal pH: ${e.phMin}–${e.phMax} · Min. münbitlik: ${e.minFertility}`,
    `• Su tələbi: ${e.waterNeed} · Əmək: ${e.labor} · Tam məhsuldarlıq: ${e.maturityYears} il`
  ].join('\n');
}

async function bestCropHint() {
  const lands = await listLands({ status: 'available' });
  const sample = lands.slice(0, 8);
  if (!sample.length) return null;
  const counts = {};
  for (const l of sample) counts[l.purpose] = (counts[l.purpose] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? `Ən çox mövcud sahə istiqaməti: ${CROPS[top[0]]?.label || top[0]} (${top[1]} sahə).` : null;
}

const CAPABILITIES = [
  'Mən KarabakhAgroInvest platformasının AI köməkçisiyəm. Bunları edə bilərəm:',
  '• Platforma: qeydiyyat, müraciət, sənədlər, investisiya, müsabiqə, izləmə kodları.',
  '• Məlumat: torpaq sahələri, rayonlar, relyef, statuslar, investisiya layihələri — canlı bazadan.',
  '• Aqronomiya: məhsul seçimi, suvarma, gübrə, torpaq pH-ı, xəstəliklər, məhsuldarlıq və ROI.',
  '• Ümumi suallar: istənilən mövzuda cavab verə bilərəm.',
  'Sualınızı yazın — Azərbaycan dilində cavablandırım.'
].join('\n');

const PLATFORM = {
  apply: [
    'Müraciət 4 addımdan ibarətdir ("Müraciət et" düyməsi):',
    '1. Profil təsdiqi — EKTİS sistemi ilə VÖEN və fermer məlumatlarınız təsdiqlənir.',
    '2. Sahə seçimi — xəritədən torpaq sahəsi seçirsiniz (relyef, pH, su mənbəyi görünür).',
    '3. Biznes plan — məhsul istiqaməti, sahə, texnologiya, investisiya və gözlənilən təsir göstəriciləri.',
    '4. Təsdiq & QR — şərtləri qəbul edib imzalayırsınız; müraciət kodu və QR əmələ gəlir.',
    'Sonda KAI-2026-XXXXX formatında kod alırsınız və onunla statusu izləyə bilərsiniz.'
  ].join('\n'),
  docs: [
    'Müraciət üçün əsas məlumat və sənədlər:',
    '• VÖEN (10 rəqəm) və profil məlumatları (EKTİS təsdiqi avtomatik yoxlanılır).',
    '• Seçilmiş torpaq sahəsi və məhsul istiqaməti.',
    '• Biznes plan məlumatları: investisiya həcmi, texnologiya, gözlənilən məhsuldarlıq və təsir göstəriciləri.',
    '• Əlavə sənədlər (ixtiyari): fayl yükləmə bölməsindən PDF/şəkillər əlavə edə bilərsiniz.'
  ].join('\n'),
  register: [
    'Qeydiyyat üçün:',
    '1. Sağ üstdəki "Giriş / Qeydiyyat" bölməsinə keçin.',
    '2. VÖEN (10 rəqəm) və şifrə ilə qeydiyyatdan keçin.',
    '3. Rol seçin: Sahibkar/fermer, İnvestor və ya dövlət operatoru.',
    'Dövlət operatoru rolunda layihə yaratmaq mümkündür; digər istifadəçilər müraciət edə və investisiya təklifi göndərə bilər.'
  ].join('\n'),
  invest: [
    'Birgəİnvest — birgə investisiya modeli:',
    '• Dövlət torpaq sahələrini layihə şəklində təqdim edir (üzümçülük, fındıqçılıq, istixana, pambıqçılıq, heyvandarlıq).',
    '• Sahibkar/fermer layihəni icra edir, investor isə maliyyə və ya texnologiya ilə qoşulur.',
    '• Hər layihədə AI risk skoru, EKTİS təsdiqi və NDVI peyk məlumatı var.',
    '• "Birgəİnvest" bölməsində layihəni seçib "Təklif göndər" vasitəsilə iştirak edə bilərsiniz.'
  ].join('\n'),
  roi: [
    'Gəlirliliyi iki yerdə hesablaya bilərsiniz:',
    '• "ROI kalkulyatoru" — xərc, məhsuldarlıq və qiymətə görə illik gəliri hesablayır.',
    '• AI Agro-Advisor — sahəni pH, münbitlik, su və günəşə görə ən uyğun məhsulları sıralayır.',
    'Nümunə: üzümçülükdə ilkin xərc ~12 000 AZN/ha, təxmini 5 illik ROI ~250%.'
  ].join('\n'),
  track: [
    'Müraciətinizi izləmək:',
    '1. "İzlə" bölməsinə keçin.',
    '2. Müraciətdən aldığınız KAI-2026-XXXXX kodunu daxil edin.',
    'Mərhələlər: Qəbul edilib → Baxılır → Əlavə məlumat → Təsdiq/İmtina.'
  ].join('\n')
};

function localAnswerCore(q) {
  // Greeting (only when the whole message is a greeting, so "Salam, necə
  // müraciət edim?" still routes to the apply intent).
  if (/^(salam|salamlar|selam|hello|hi|hey|gunaydin|sabahin xeyir|axsamin xeyir|necesen|necesiz|ne var ne yox|salam necesen)[\s!.,?]*$/.test(q)) {
    return { reply: 'Salam! 👋 Mən KarabakhAgroInvest AI köməkçisiyəm. Platforma, torpaq sahələri, investisiya və ya aqronomiya ilə bağlı sualınızı verin.', confident: true };
  }
  // Thanks
  if (anyRe(q, /\b(sagol|tesekkur|cox sagol|tesekkurler)\b/)) {
    return { reply: 'Buyurun! Başqa sualınız olarsa, məmnuniyyətlə cavablandırım. 🙂', confident: true };
  }
  // Identity / capabilities
  if (anyRe(q, /\b(sen kimsen|kimsen|adin ne|adiviz ne|sen nesən|kimsən|hardansan)\b/) || has(q, 'sen kims')) {
    return { reply: 'Mən KarabakhAgroInvest platformasının süni intellekt köməkçisiyəm. Qarabağda aqrar investisiya, torpaq sahələri və aqronomiya üzrə sizə kömək edirəm.', confident: true };
  }
  if (anyRe(q, /\b(ne ede bilersen|neler ede bilersen|ne bilirsen|neler bilirsen|imkanlarin|komek lazim|komek et|komekci)\b/)) {
    return { reply: CAPABILITIES, confident: true };
  }

  // Land code lookup
  const codeMatch = q.match(/\b([a-z]{3})-?(\d{3,4})\b/);
  if (codeMatch) {
    return { reply: `__LAND_CODE__:${codeMatch[1].toUpperCase()}-${codeMatch[2]}`, confident: true };
  }

  // District lookup
  const districtHit = Object.values(DISTRICTS).find((d) => q.includes(fold(d.name)));
  if (districtHit && anyRe(q, /sah|torpaq|plot|rayon|erazi|ha\b|hektar/)) {
    return { reply: `__DISTRICT__:${fold(districtHit.name)}`, confident: true };
  }

  // Land / data overview
  if (anyRe(q, /(nece|ne qeder|sayi|sayi ne|count).*(sahe|torpaq|plot|hektar|ha)/) || anyRe(q, /\b(saheler|torpaq saheleri|butun saheler|sahe siyahisi|torpaqlar)\b/)) {
    return { reply: '__LANDS__', confident: true };
  }
  if (anyRe(q, /(nece|ne qeder).*(layihe|proyekt|investisiya layihesi)/) || anyRe(q, /\b(layiheler|proyektler|investisiya layiheleri)\b/)) {
    return { reply: '__PROJECTS__', confident: true };
  }
  if (anyRe(q, /\b(musabiqe|musabiqeler|grant|mukafat fondu)\b/)) {
    return { reply: '__COMPETITIONS__', confident: true };
  }
  if (anyRe(q, /\b(nece muraciet|muraciet etmek|muraciet qaydasi|nece elave olunum|nece basvurum|basvuru|e arz)\b/)) {
    return { reply: PLATFORM.apply, confident: true };
  }
  if (anyRe(q, /\b(sened|senedler|document|fayl teleb|hansi senedler)\b/)) {
    return { reply: PLATFORM.docs, confident: true };
  }
  if (anyRe(q, /\b(qeydiyyat|register|hesab acmaq|hesab ac|nece qeydiyyatdan)\b/)) {
    return { reply: PLATFORM.register, confident: true };
  }
  if (anyRe(q, /\b(izle|izlemek|status|veziyyet|muraciet kodu|kodu harada|kai-)\b/)) {
    return { reply: PLATFORM.track, confident: true };
  }
  if (anyRe(q, /\b(ektis)\b/)) {
    return { reply: 'EKTİS — Elektron Kənd Təsərrüfatı İnformasiya Sistemi. Platformada VÖEN və fermer məlumatlarınız EKTİS vasitəsilə avtomatik təsdiqlənir; bu, müraciətin etibarlılığını artırır.', confident: true };
  }
  if (anyRe(q, /\b(ndvi)\b/)) {
    return { reply: 'NDVI — peyk görüntüləri əsasında bitki örtüyünün sağlamlıq indeksi. Xəritədə sahələri NDVI rejimində göstərib məhsul vəziyyətini qiymətləndirə bilərsiniz.', confident: true };
  }
  if (anyRe(q, /\b(investor|investisiya|birgeinvest|birge invest|birge|kofinans|qosulmaq ist|invest et)\b/)) {
    return { reply: PLATFORM.invest, confident: true };
  }
  if (anyRe(q, /\b(roi|gelirlilik|menfeet|gelir hesab|rentabellik|ne qeder qazanc)\b/)) {
    return { reply: PLATFORM.roi, confident: true };
  }
  if (anyRe(q, /\b(rol|roles|operator|admin|sahesi kim|kim yarada bilir)\b/)) {
    return { reply: 'Rollar: Sahibkar/Fermer (müraciət edir), İnvestor (təklif göndərir), Aqrar operator (layihə yaradır), Sistem administratoru (idarəetmə). Layihə yaratmaq yalnız dövlət operatoru və administrator üçün açıqdır.', confident: true };
  }
  if (anyRe(q, /\b(deyer zenciri|emal|ixrac|yigma|saxlama|satis)\b/)) {
    return { reply: 'Dəyər zənciri 4 mərhələdən ibarətdir: Əkin yetişdirmə → Yığım və saxlama → Emal → Satış və ixrac. Müraciətdə hansı mərhələləri əhatə etdiyinizi qeyd edirsiniz.', confident: true };
  }
  if (anyRe(q, /\b(texnologiya|texnologiyalar|dron|agilli suvarma|precision|yasil enerji)\b/)) {
    return { reply: 'Dəstəklənən texnologiyalar: Ağıllı suvarma, Dəqiq əkinçilik və dronlar, Yaşıl enerji mənbələri. Bunları biznes plan mərhələsində seçirsiniz.', confident: true };
  }

  // Agronomy: crop-specific
  const cropMap = [
    ['uzum', /(uzum|uzumculuk|uzumcu|vineyard|vine)/],
    ['pambiq', /(pambiq|pambiqcilik|cotton)/],
    ['findiq', /(findiq|findiqcilik|hazelnut)/],
    ['heyvandarliq', /(heyvandarliq|mal-qara|maldara|inek|qoyun|heyvan|livestock)/],
    ['istixana', /(istixana|sera|greenhouse)/]
  ];
  for (const [key, re] of cropMap) {
    if (re.test(q)) {
      return { reply: `__CROP__:${key}`, confident: true };
    }
  }
  // General agronomy
  if (anyRe(q, /\b(suvarma|sulama|su teleb|su lazim|su menbeyi|irrigasiya)\b/)) {
    return { reply: 'Suvarma tövsiyələri:\n• Su mənbəyinə məsafə kritikdir — 2–3 km-dən uzaq sahələrdə damcı suvarma daha sərfəlidir.\n• Üzüm və fındıq orta su tələb edir; pambıq və istixana yüksək su tələb edir.\n• Torpaq rütubətini dron/sensorlarla izləmək suyu 30%-ə qədər qənaət etdirir.' , confident: true };
  }
  if (anyRe(q, /\b(gubre|gubrel|torpaq munbitliyi|munbitlik|ph)\b/)) {
    return { reply: 'Torpaq və gübrə tövsiyələri:\n• Optimal pH məhsuldan asılıdır (üzüm 6.0–7.5, pambıq 6.5–8.0, fındıq 5.5–7.0).\n• Münbitliyi 70-dən aşağı olan sahələrdə üzvi gübrə və yaşıl gübrələmə məsləhətdir.\n• Torpaq analizini mütəmadi aparın və NPK-nı məhsula uyğun tətbiq edin.' , confident: true };
  }
  if (anyRe(q, /\b(xestelik|zererverici|zerverici|zərərverici|pest|gobelek|xəstəlik)\b/)) {
    return { reply: 'Xəstəlik və zərərvericilərlə mübarizə:\n• İnteqrasiya olunmuş mübarizə (IPM): profilaktika + bioloji üsullar + yalnız zərurət olduqda kimyəvi.\n• Üzümdə külənmə və mildiu, fındıqda bakterioz, pambıqda bit və ağqanadlı üçün erkən monitorinq vacibdir.\n• Düzgün suvarma və havalandırma xəstəlik riskini azaldır.' , confident: true };
  }
  if (anyRe(q, /\b(ekin vaxti|ne vaxt ekim|hansi ay|ekim takvimi|vegetasiya|becerme vaxti)\b/)) {
    return { reply: 'Təxmini əkin təqvimi:\n• Pambıq: aprel–may səpin, sentyabr–oktyabr yığım.\n• Üzüm: ting əkini yazda (mart–aprel), tam məhsuldarlıq 3–4-cü ildə.\n• Fındıq: payız və ya yaz əkini, tam məhsuldarlıq 4–5-ci ildə.\n• İstixana: il boyu, mövsümdən asılı olaraq idarə olunur.' , confident: true };
  }
  if (anyRe(q, /\b(hansi bitki|ne ekmek|ne ekim|hansi mehsul|tovsiye|meslehet|en sərfeli|en sərfəli|en gelirli)\b/)) {
    return { reply: '__BESTCROP__', confident: true };
  }

  return { reply: null, confident: false };
}

async function localAnswer(message) {
  const q = fold(message);
  const core = localAnswerCore(q);
  if (!core.confident) return core;

  if (core.reply === '__LANDS__') return { reply: await landsOverview(), confident: true };
  if (core.reply === '__PROJECTS__') return { reply: await projectsOverview(), confident: true };
  if (core.reply === '__COMPETITIONS__') return { reply: await competitionsOverview(), confident: true };
  if (core.reply === '__BESTCROP__') {
    const hint = await bestCropHint();
    return {
      reply: [
        'Məhsul seçimi sahənin pH-ı, münbitliyi, su mənbəyi və günəşli günlərinə görə edilir.',
        hint || '',
        'Xəritədə sahəni seçib "AI Agro-Advisor" panelindən konkret tövsiyə ala bilərsiniz.',
        'Ümumi olaraq ən yüksək ROI: üzümçülük və fındıqçılıq (çoxillik), ən sürətli dövriyyə: pambıq və istixana.'
      ].filter(Boolean).join('\n'),
      confident: true
    };
  }
  if (core.reply.startsWith('__LAND_CODE__:')) {
    const code = core.reply.slice('__LAND_CODE__:'.length);
    const info = await landByCode(code);
    return { reply: info || `${code} kodlu sahə tapılmadı. Kodu yoxlayın (məsələn FUZ-0500).`, confident: true };
  }
  if (core.reply.startsWith('__DISTRICT__:')) {
    const name = core.reply.slice('__DISTRICT__:'.length);
    const info = await districtLands(name);
    return { reply: info || 'Bu rayon üzrə məlumat tapılmadı.', confident: true };
  }
  if (core.reply.startsWith('__CROP__:')) {
    const key = core.reply.slice('__CROP__:'.length);
    return { reply: cropInfo(key) || 'Bu məhsul üzrə məlumat tapılmadı.', confident: true };
  }
  return core;
}

/* ------------------------------------------------------------------ */
/* Fast deterministic answers (no AI, no rate limit)                   */
/* ------------------------------------------------------------------ */

function tryQuickAnswer(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  // Arithmetic embedded in a sentence, e.g. "2+2 nece edir?", "12 * 5 - 3 = ?"
  const mathMatch = s.match(/(\d+(?:\.\d+)?(?:\s*[-+*/^%]\s*\d+(?:\.\d+)?)+)/);
  if (mathMatch) {
    const expr = mathMatch[1]
      .replace(/\^/g, '**')
      .replace(/%/g, '/100');
    if (/^[\d\s+\-*/().]+$/.test(expr)) {
      try {
        const val = Function(`"use strict";return (${expr})`)();
        if (typeof val === 'number' && Number.isFinite(val)) {
          return `Nəticə: ${Number.isInteger(val) ? val : Number(val.toFixed(6))}`;
        }
      } catch {
        /* not a valid expression */
      }
    }
  }

  const q = fold(s);
  if (anyRe(q, /\b(saat necedir|saat nece|indi saat|vaxt necedir|ne vaxtdir)\b/)) {
    return `İndiki vaxt: ${new Date().toLocaleString('az-AZ')}`;
  }
  if (anyRe(q, /\b(bu gun hansi gun|bu gun ne vaxtdir|tarix necedir|bugun ayin necisi|bugun hansi tarixdir)\b/)) {
    return `Bu gün: ${new Date().toLocaleDateString('az-AZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Orchestrator                                                        */
/* ------------------------------------------------------------------ */

const HISTORY_LIMIT = 8;

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof (m.text || m.content) === 'string')
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: String(m.text || m.content).slice(0, 2000) }));
}

const GENERIC_FALLBACK = [
  'Bu suala dəqiq cavab vermək üçün əlavə məlumat lazımdır. 🙂',
  'Mən platforma (torpaq sahələri, müraciət, investisiya, müsabiqə), aqronomiya (məhsul seçimi, suvarma, gübrə, xəstəliklər) və ümumi suallar üzrə kömək edə bilərəm.',
  'Sualı bir az fərqli və ya daha konkret verə bilərsinizmi?'
].join('\n');

export async function answer({ message, history = [] } = {}) {
  const clean = String(message || '').trim();
  if (!clean) return { reply: 'Zəhmət olmasa sualınızı yazın.', source: 'local' };

  const key = fold(clean).slice(0, 200);
  const cached = cacheGet(key);
  if (cached) return { reply: cached.reply, source: `${cached.source}+cache` };

  const quick = tryQuickAnswer(clean);
  if (quick) {
    cacheSet(key, quick, 'local');
    return { reply: quick, source: 'local' };
  }

  let local = null;
  try {
    local = await localAnswer(clean);
  } catch {
    local = null;
  }

  // High-confidence domain answers are served instantly from the offline engine.
  if (local && local.confident && local.reply) {
    cacheSet(key, local.reply, 'local');
    return { reply: local.reply, source: 'local' };
  }

  // Anything else goes to a real model (with automatic failover).
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...sanitizeHistory(history),
    { role: 'user', content: clean }
  ];
  const ai = await askProviders(messages);
  if (ai) {
    cacheSet(key, ai.reply, ai.source);
    return ai;
  }

  return { reply: (local && local.reply) || GENERIC_FALLBACK, source: 'fallback' };
}

export default { answer, fold };
