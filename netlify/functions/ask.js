// netlify/functions/ask.js
// Runtime: Node 18+
// Endpoint usato dal widget quando l’AI è “online”.
// Hardening: throttle per-IP, retry con jitter su 429/5xx, timeout 5s, cache JSON 60s, mappatura errori 429/503.
// HOME: include elenco esercenti (venues.json) in contesto, con categoria dedotta.
// Strategia 2025: HYBRID
// 1) Fast-path deterministico SOLO per richieste di elenco.
// 2) Altrimenti AI con guardrail e history sanificata.

const TIMEOUT_MS = 20_000;
const RETRIES = 3;
const BACKOFF_MIN = 180;
const BACKOFF_MAX = 420;

/* ---------- Helpers ---------- */
function rid() { return Math.random().toString(36).slice(2, 8); }
const norm = (s) => String(s).toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "").trim();

function projectCtasFromJson(ctasJson) {
  if (!Array.isArray(ctasJson)) return [];
  return ctasJson
    .map((c) => c && typeof c.label === "string" && c.label.trim() ? `[${c.label.trim()}]` : null)
    .filter(Boolean);
}

/* ---- Inferenza di categoria dal nome/tagline (fallback) ---- */
function inferCategory(name = "", tagline = "") {
  const t = `${name} ${tagline}`.toLowerCase();
  if (/pizzer/i.test(t)) return "pizzeria";
  if (/ristorant|trattor|osteria/.test(t)) return "ristorante";
  if (/\bbar\b|caf[èe]|caffetteria/.test(t)) return "bar";
  if (/bracer|griglier|brace/.test(t)) return "braceria";
  if (/panific|forn|bakery|pane/.test(t)) return "panificio";
  if (/pasticc|dolci|gelat/.test(t)) return "pasticceria";
  if (/kebab|sushi|burger|panin|panuoz|focacci|tavola\s*calda/.test(t)) return "streetfood";
  if (/studio\s*medic|medic[oi]|dottor|dottoress|ambulator|pediatr|dentist|odontoiatr|oculist|ortoped|fisioterap|veterinar/.test(t)) return "medico";
  if (/farmac/.test(t)) return "farmacia";
  if (/elettricist/.test(t)) return "elettricista";
  if (/idraulic/.test(t)) return "idraulico";
  if (/meccanic|officina/.test(t)) return "meccanico";
  if (/fabbro/.test(t)) return "fabbro";
  if (/falegnam/.test(t)) return "falegname";
  if (/murator|edil/.test(t)) return "edile";
  if (/avvocat/.test(t)) return "avvocato";
  if (/commercialist|ragionier/.test(t)) return "commercialista";
  if (/architett|ingegner/.test(t)) return "tecnico";
  if (/parrucch|barbier/.test(t)) return "parrucchiere";
  if (/estetica|estetist|beauty/.test(t)) return "estetista";
  if (/ferrament/.test(t)) return "ferramenta";
  if (/tabac/i.test(t)) return "tabacchi";
  if (/supermerc|market|alimentar/.test(t)) return "supermercato";
  return "altro";
}

/* ---- Normalizzazione categoria dichiarata in venues.json ---- */
function normalizeCategory(cat = "") {
  const t = String(cat).toLowerCase().trim();
  if (/pizzer/.test(t)) return "pizzeria";
  if (/ristor|trattor|osteria/.test(t)) return "ristorante";
  if (/\bbar\b|caff[eè]|caffetteri/.test(t)) return "bar";
  if (/bracer|griglier|brace/.test(t)) return "braceria";
  if (/panific|forn|bakery|pane/.test(t)) return "panificio";
  if (/pasticc|dolci|gelat/.test(t)) return "pasticceria";
  if (/kebab|sushi|burger|panin|panuoz|focacci|tavola\s*calda|street/.test(t)) return "streetfood";
  if (/medic|studio\s*medic|dottor|dottoress|pediatr|dentist|odontoiatr|oculist|ortoped|fisioterap|veterinar/.test(t)) return "medico";
  if (/farmac/.test(t)) return "farmacia";
  if (/elettricist/.test(t)) return "elettricista";
  if (/idraulic/.test(t)) return "idraulico";
  if (/meccanic|officina/.test(t)) return "meccanico";
  if (/fabbro/.test(t)) return "fabbro";
  if (/falegnam/.test(t)) return "falegname";
  if (/murator|edil/.test(t)) return "edile";
  if (/avvocat/.test(t)) return "avvocato";
  if (/commercialist|ragionier/.test(t)) return "commercialista";
  if (/architett|ingegner/.test(t)) return "tecnico";
  if (/parrucch|barbier/.test(t)) return "parrucchiere";
  if (/estetica|estetist|beauty/.test(t)) return "estetista";
  if (/ferrament/.test(t)) return "ferramenta";
  if (/tabac/.test(t)) return "tabacchi";
  if (/supermerc|market|alimentar/.test(t)) return "supermercato";
  return "";
}

/* ---- Sinonimi → categoria (per capire la domanda) ---- */
const CATEGORY_SYNONYMS = [
  { cat: "pizzeria",      re: /(pizza|pizzer\w*)/i },
  { cat: "ristorante",    re: /(ristor\w*|trattor\w*|osteria\w*)/i },
  { cat: "bar",           re: /\bbar\b|caff[eè]|caffetteri\w*/i },
  { cat: "braceria",      re: /(bracer\w*|griglier\w*|brace)/i },
  { cat: "panificio",     re: /(panific\w*|forn\w*|bakery|pane)/i },
  { cat: "pasticceria",   re: /(pasticc\w*|pasticceria|dolc\w*|gelat\w*)/i },
  { cat: "streetfood",    re: /(kebab|sushi|burger|panin\w*|panuoz\w*|focacci\w*|tavola\s*calda)/i },
  { cat: "medico",        re: /(medic\w*|studio\s*medic\w*|dottor\w*|dottoress\w*|pediatr\w*|dentist\w*|odontoiatr\w*|oculist\w*|ortoped\w*|fisioterap\w*|veterinar\w*|dott\.)/i },
  { cat: "farmacia",      re: /farmac\w*/i },
  { cat: "elettricista",  re: /elettricist\w*/i },
  { cat: "idraulico",     re: /idraulic\w*/i },
  { cat: "meccanico",     re: /meccanic\w*|officina/i },
  { cat: "fabbro",        re: /fabbro/i },
  { cat: "falegname",     re: /falegnam\w*/i },
  { cat: "edile",         re: /murator\w*|edil\w*/i },
  { cat: "avvocato",      re: /avvocat\w*/i },
  { cat: "commercialista",re: /commercialist\w*|ragionier\w*/i },
  { cat: "tecnico",       re: /architett\w*|ingegner\w*/i },
  { cat: "parrucchiere",  re: /parrucch\w*|barbier\w*/i },
  { cat: "estetista",     re: /estetica|estetist\w*|beauty/i },
  { cat: "ferramenta",    re: /ferrament\w*/i },
  { cat: "tabacchi",      re: /tabac\w*/i },
  { cat: "supermercato",  re: /supermerc\w*|market|alimentar\w*/i },
];

/* ---- Intents: elenco vs narrativo/valutativo ---- */
const LISTING_RE =
  /\b(elenc|lista|mostra|cerca|trova|quali|quale sono|dove|dov'|indicami|suggerisc|consigli|disponibil|tutti|tutte)\b/i;

const NARRATIVE_RE =
  /\b(stori|raccont|dettagli|informaz|descrizion|parlami|spiega|miglior|migliore|chi fa|recension)\b/i;

function matchCategoryFromQuestion(q) {
  const t = norm(q);
  for (const { cat, re } of CATEGORY_SYNONYMS) if (re.test(t)) return cat;
  return null;
}
function filterVenuesByCategory(raw, targetCat) {
  const inArr = Array.isArray(raw) ? raw : [];
  if (!targetCat) return [];
  return inArr
    .map(v => {
      const name = String(v?.n || v?.name || "").trim();
      const cat = String(v?.c || "") || normalizeCategory(v?.category) || inferCategory(v?.name, v?.tagline);
      return { n: name, c: cat };
    })
    .filter(x => x.n && x.c === targetCat);
}
function pickNames(list, max = 5) {
  return list.slice(0, max).map(x => x.n).join(" • ");
}

/* ---------- Utils HTTP / throttle / retry / cache ---------- */
function res(status, bodyObj, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
    body: typeof bodyObj === "string" ? bodyObj : JSON.stringify(bodyObj),
  };
}
const BUCKET = new Map();
const RATE = { capacity: 3, refillMs: 1500 };
function allow(ip) {
  const now = Date.now();
  const s = BUCKET.get(ip) ?? { tokens: RATE.capacity, last: now };
  const elapsed = now - s.last;
  const add = Math.floor(elapsed / RATE.refillMs);
  if (add > 0) { s.tokens = Math.min(RATE.capacity, s.tokens + add); s.last = now; }
  if (s.tokens <= 0) { BUCKET.set(ip, s); return false; }
  s.tokens -= 1; BUCKET.set(ip, s); return true;
}
async function withRetry(fn, { tries = RETRIES, min = BACKOFF_MIN, max = BACKOFF_MAX } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(i); }
    catch (e) { lastErr = e; if (i === tries - 1) break; const sleep = min + Math.random()*(max-min); await new Promise(r => setTimeout(r, sleep)); }
  }
  throw lastErr;
}
async function fetchWithTimeout(url, opts = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(new Error("timeout")), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
const JSON_CACHE = new Map();
const JSON_TTL = 60_000;
async function fetchJsonCached(url) {
  const now = Date.now(); const hit = JSON_CACHE.get(url);
  if (hit && now - hit.ts < JSON_TTL) return hit.data;
  const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  if (!r.ok) throw new Error(`json ${r.status}`);
  const data = await r.json(); JSON_CACHE.set(url, { ts: now, data }); return data;
}

/* ---------- Handler ---------- */
export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return res(405, { error: "Method Not Allowed" });

    const ip =
      event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      event.headers?.["client-ip"] || "anon";
    if (!allow(ip)) return res(429, { error: "Too Many Requests" }, { "Retry-After": "2" });

    const payload = JSON.parse(event.body || "{}");
    const question = String(payload.question || "").trim();
    const model = String(payload.model || "deepseek-ai/DeepSeek-V3.1");
    if (!question) return res(400, { error: "Bad request: missing question" });

    // History hardening
    const rawHist = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
    const history = rawHist
      .map((m) => {
        const role = m?.role === "assistant" ? "assistant" : (m?.role === "user" ? "user" : null);
        const text = typeof m?.text === "string" ? m.text : "";
        if (!role || !text) return null;
        return { role, content: String(text).slice(0, 600) };
      })
      .filter(Boolean);

    const HF_KEY = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";
    if (!HF_KEY) return res(503, { error: "AI not configured (HF_TOKEN missing)" });

    const host = event.headers?.host || "";
    const proto = (event.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
    const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || (host ? `${proto}://${host}` : "");

    // Carica dati: inline oppure via slug
    let data = payload.data; let slugUsed = null;
    if (!data) {
      const slug = String(payload.slug || "").trim();
      if (!slug) return res(400, { error: "Bad request: missing data or slug" });
      slugUsed = slug;
      const jsonUrl = `${origin}/data/${slug}.json`;
      try { data = await fetchJsonCached(jsonUrl); }
      catch { return res(404, { error: `JSON not found for slug '${slug}'` }); }
    }

    const isMunicipality = !!data?.cityName && !data?.menu;
    const brand = isMunicipality ? `Comune di ${data.cityName}` : data?.config?.name || "Il locale";
    const assistantTitle = isMunicipality
      ? data?.assistant?.panelTitle || `Assistente digitale del ${brand}`
      : `Assistente di ${brand}`;

    let context = {}; let ctas = [];

    if (isMunicipality) {
      context = {
        cityName: data.cityName,
        about: data?.about?.text,
        pilot: { title: data?.pilot?.title, intro: data?.pilot?.intro, goals: data?.pilot?.goals, governance: data?.pilot?.governance },
        festivities: Array.isArray(data?.festivities) ? data.festivities.map((f) => ({ name: f?.name, month: f?.month, description: f?.description })) : [],
        openData: data?.openData?.jsonUrl || data?.openData?.csvUrl || null,
        social: data?.social || null,
      };

      // venues compatti (nome + categoria normalizzata o dedotta)
      try {
        const venues = await fetchJsonCached(`${origin}/data/venues.json`);
        if (Array.isArray(venues) && venues.length) {
          const vlist = venues.map((v) => {
            const name = String(v?.name || "").trim();
            const catFromFile = normalizeCategory(v?.category);
            const cat = catFromFile || inferCategory(String(v?.name || ""), String(v?.tagline || ""));
            return { n: name, c: cat };
          }).filter(x => x.n && x.c);
          context.venues = vlist;
        }
      } catch {}

      if (data?.social?.website) ctas.push("[Sito]");
      if (data?.openData?.jsonUrl || data?.openData?.csvUrl) ctas.push("[Open Data]");
      if (Array.isArray(data?.chat?.ctas)) ctas = [...new Set([...ctas, ...projectCtasFromJson(data.chat.ctas)])];
    } else {
      context = {
        brand,
        hours: data?.config?.hours,
        address: data?.config?.address,
        phone: data?.config?.phone,
        whatsapp: data?.config?.whatsapp,
        specials: data?.menu?.specials || [],
        categories: (Array.isArray(data?.menu?.categories) ? data.menu.categories : []).map((c) => ({
          name: c?.name,
          items: (Array.isArray(c?.items) ? c.items : []).map((i) => ({ name: i?.name, desc: i?.desc, price: i?.price, tags: i?.tags, fav: i?.fav })),
        })),
      };
      if (data?.config?.phone) ctas.push("[Chiama]");
      if (data?.config?.whatsapp) ctas.push("[WhatsApp]");
      if (data?.config?.address || data?.config?.mapUrl) ctas.push("[Indicazioni]");
      const rootCtas = Array.isArray(data?.chat?.ctas) ? projectCtasFromJson(data.chat.ctas) : [];
      const nestedCtas = Array.isArray(data?.config?.chat?.ctas) ? projectCtasFromJson(data.config.chat.ctas) : [];
      if (rootCtas.length || nestedCtas.length) ctas = [...new Set([...ctas, ...rootCtas, ...nestedCtas])];
    }

    /* ========= FAST-PATH DETERMINISTICO (solo HOME, SOLO richieste elenco) ========= */
    if (isMunicipality && Array.isArray(context.venues) && context.venues.length) {
      const cat = matchCategoryFromQuestion(question);
      const wantsList = LISTING_RE.test(question);
      const isNarr = NARRATIVE_RE.test(question);
      if (cat && wantsList && !isNarr) {
        const matches = filterVenuesByCategory(context.venues, cat);
        if (matches.length) {
          const names = pickNames(matches, 5);
          return res(200, { answer: `${names}. Per altri apri “Esercenti aderenti”.` });
        }
        // zero match → passa all’AI
      }
    }

    /* ========== PROMPT (AI) ========== */
    const commonHdr =
      `Sei "${assistantTitle}". Rispondi nella lingua dell'utente, max 90 parole, tono cortese e sintetico. ` +
      `Usa SOLO le informazioni nei DATI. Se qualcosa manca, rispondi "Non disponibile". ` +
      `Non inventare link o contatti.`;

    const municipalGuide = context.venues
      ? `Se l'utente chiede un'attività/professione o un luogo (es. pizzeria, medico, farmacia, elettricista, parrucchiere, tabacchi, ecc.):
- seleziona dai VENUES fino a 5 nomi con categoria pertinente;
- elenca solo i nomi (separati da " • ");
- chiudi con "Per altri apri Esercenti aderenti."
Se l'utente chiede storie, confronti o qualità e i DATI non includono tali informazioni, rispondi "Non disponibile" e suggerisci di aprire "Esercenti aderenti" per i dettagli.` : ``;

    const system = isMunicipality
      ? [
          commonHdr,
          `Contesto: assistente istituzionale del ${brand}.`,
          `Tratta storia locale, progetto/pilot, attività aderenti, festività/eventi e link utili.`,
          `NON parlare di piatti/menu/prezzi.`,
          `Per saluti o convenevoli (es. “ciao”, “come va”, “grazie”), rispondi brevemente e in modo cordiale anche se non è nei DATI.`,
          municipalGuide,
          `Se utile, chiudi con: ${ctas.length ? ctas.join(" ") : "—"}`,
          `DATI: ${JSON.stringify({ cityName: context.cityName, about: context.about, pilot: context.pilot, festivities: context.festivities, openData: context.openData, social: context.social, venues: context.venues || [] })}`,
        ].join("\n")
      : [
          commonHdr,
          `Contesto: assistente dell'attività "${brand}".`,
          `Puoi citare orari, indirizzo, telefono/WhatsApp. Se utile, suggerisci 1–2 voci di catalogo/servizi (o piatti, se ristorante) con prezzo se presente.`,
          `Per saluti o convenevoli (es. “ciao”, “come va”, “grazie”), rispondi brevemente e in modo cordiale anche se non è nei DATI.`,
          ctas.length ? `Chiudi con: ${ctas.join(" ")}` : `Evita CTA finali se non pertinenti.`,
          `DATI: ${JSON.stringify(context)}`,
        ].join("\n");

    const messages = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: String(question) },
    ];

    const body = { model, messages, max_tokens: 220, temperature: 0.2, provider: { order: ["Fireworks"] } };

    /* ========== Chiamata a Hugging Face con retry/timeout ========== */
    const hfUrl = "https://router.huggingface.co/v1/chat/completions";
    const r = await withRetry(
      async () => {
        const resp = await fetchWithTimeout(
          hfUrl,
          { method: "POST", headers: { Authorization: `Bearer ${HF_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
          TIMEOUT_MS
        );
        if (resp.status === 429 || resp.status === 502 || resp.status === 503) { const e = new Error(`upstream ${resp.status}`); e.code = resp.status; throw e; }
        return resp;
      },
      { tries: RETRIES, min: BACKOFF_MIN, max: BACKOFF_MAX }
    );

    const text = await r.text();
    if (!r.ok) {
      if (r.status === 429) return res(429, { error: "Rate limited by AI" }, { "Retry-After": "2" });
      return res(503, { error: "AI temporarily unavailable", detail: text });
    }

    let answer = "Non disponibile al momento.";
    try {
      const j = JSON.parse(text);
      const raw = j?.choices?.[0]?.message?.content;
      if (typeof raw === "string") answer = (raw || "").replace(/\s+$/, "").trim() || answer;
    } catch {}

    return res(200, { answer });
  } catch (e) {
    if (e?.name === "AbortError" || e?.message === "timeout") return res(503, { error: "AI timeout" });
    return res(503, { error: "Service temporarily unavailable" });
  }
}
