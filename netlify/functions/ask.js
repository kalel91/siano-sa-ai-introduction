// netlify/functions/ask.js
// Runtime: Node 18+
// Endpoint usato dal widget quando l’AI è “online”.
// Hardening: throttle per-IP, retry con jitter su 429/5xx, timeout 5s, cache JSON 60s, mappatura errori 429/503.
// Esteso per HOME: include elenco esercenti (venues.json) in contesto, con categoria dedotta.
// Esteso (GENERALE): fallback deterministico per domande su CATEGORIE/PROFESSIONI (medici ecc.), non solo food.

const TIMEOUT_MS = 5_000;
const RETRIES = 3;
const BACKOFF_MIN = 180;
const BACKOFF_MAX = 420;

/* ---------- Helpers ---------- */
function rid() { return Math.random().toString(36).slice(2, 8); }
const norm = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "").trim();

function projectCtasFromJson(ctasJson) {
  if (!Array.isArray(ctasJson)) return [];
  return ctasJson
    .map((c) =>
      c && typeof c.label === "string" && c.label.trim()
        ? `[${c.label.trim()}]`
        : null
    )
    .filter(Boolean);
}

/* ---- Inferenza di categoria dal nome/tagline (stringhe corte, robuste) ---- */
function inferCategory(name = "", tagline = "") {
  const t = `${name} ${tagline}`.toLowerCase();
  // food & bar
  if (/pizzer/i.test(t)) return "pizzeria";
  if (/ristorant|trattor|osteria/.test(t)) return "ristorante";
  if (/\bbar\b|caf[èe]|caffetteria/.test(t)) return "bar";
  if (/bracer|griglier|brace/.test(t)) return "braceria";
  if (/panific|forn|bakery|pane/.test(t)) return "panificio";
  if (/pasticc|dolci|gelat/.test(t)) return "pasticceria";
  if (/kebab|sushi|burger|panin|panuoz|focacci|tavola\s*calda/.test(t)) return "streetfood";
  // salute & professioni
  if (/studio\s*medic|medic[oi]|dottor|dottoress|ambulator|pediatr|dentist|odontoiatr|oculist|ortoped|fisioterap|veterinar/.test(t)) return "medico";
  if (/farmac/.test(t)) return "farmacia";
  // servizi tecnici/professionali
  if (/elettricist/.test(t)) return "elettricista";
  if (/idraulic/.test(t)) return "idraulico";
  if (/meccanic|officina/.test(t)) return "meccanico";
  if (/fabbro/.test(t)) return "fabbro";
  if (/falegnam/.test(t)) return "falegname";
  if (/murator|edil/.test(t)) return "edile";
  if (/avvocat/.test(t)) return "avvocato";
  if (/commercialist|ragionier/.test(t)) return "commercialista";
  if (/architett|ingegner/.test(t)) return "tecnico";
  // cura persona & retail
  if (/parrucch|barbier/.test(t)) return "parrucchiere";
  if (/estetica|estetist|beauty/.test(t)) return "estetista";
  if (/ferrament/.test(t)) return "ferramenta";
  if (/supermerc|market|alimentar/.test(t)) return "supermercato";
  return "altro";
}

/* ---- Sinonimi → categoria target (per il matching domanda) ---- */
const CATEGORY_SYNONYMS = [
  { cat: "pizzeria", re: /(pizza|pizzer)/i },
  { cat: "ristorante", re: /(ristor|trattor|osteria)/i },
  { cat: "bar", re: /\bbar\b|caffe|caffetteria/i },
  { cat: "braceria", re: /(bracer|griglier|brace)/i },
  { cat: "panificio", re: /(panific|forn|bakery|pane)/i },
  { cat: "pasticceria", re: /(pasticc|pasticceria|dolci|gelat)/i },
  { cat: "streetfood", re: /(kebab|sushi|burger|panin|panuoz|focacci|tavola\s*calda)/i },

  { cat: "medico", re: /(medic|studio\s*medic|dottor|dottoress|pediatr|dentist|odontoiatr|oculist|ortoped|fisioterap|veterinar|dott\.)/i },
  { cat: "farmacia", re: /farmac/i },

  { cat: "elettricista", re: /elettricist/i },
  { cat: "idraulico", re: /idraulic/i },
  { cat: "meccanico", re: /meccanic|officina/i },
  { cat: "fabbro", re: /fabbro/i },
  { cat: "falegname", re: /falegnam/i },
  { cat: "edile", re: /murator|edil/i },
  { cat: "avvocato", re: /avvocat/i },
  { cat: "commercialista", re: /commercialist|ragionier/i },
  { cat: "tecnico", re: /architett|ingegner/i },

  { cat: "parrucchiere", re: /parrucch|barbier/i },
  { cat: "estetista", re: /estetica|estetist|beauty/i },
  { cat: "ferramenta", re: /ferrament/i },
  { cat: "supermercato", re: /supermerc|market|alimentar/i },
];

/* Intent generico “categoria/professione cercata?” */
function matchCategoryFromQuestion(q) {
  const t = norm(q);
  for (const { cat, re } of CATEGORY_SYNONYMS) {
    if (re.test(t)) return cat;
  }
  // pattern generico “elenca tutti gli esercenti”
  if (/\b(tutt[oi]|elenc|lista|tutti gli esercenti)\b/i.test(t)) return "__all__";
  return null;
}

const FOLLOWUP_RE =
  /^(si|s[iì]|ok|va bene|quali|quale|altri|altre|altro|ancora|poi|dimmi|cos'?altro|solo\??)\b/i;

/* utilities per selezione nomi */
function filterVenuesByCategory(raw, targetCat) {
  const inArr = Array.isArray(raw) ? raw : [];
  if (targetCat === "__all__") {
    return inArr.map(v => ({ n: v?.n || v?.name, c: v?.c || v?.category })).filter(x => x.n);
  }
  return inArr
    .map(v => ({
      n: String(v?.n || v?.name || "").trim(),
      c: String(v?.c || v?.category || inferCategory(v?.name, v?.tagline)),
    }))
    .filter(x => x.n && x.c === targetCat);
}
function pickNames(list, many) {
  const max = many ? 8 : 4;
  return list.slice(0, max).map(x => x.n).join(" • ");
}

/* ---------- Utils HTTP / throttle / retry / cache ---------- */
function res(status, bodyObj, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
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
  if (add > 0) {
    s.tokens = Math.min(RATE.capacity, s.tokens + add);
    s.last = now;
  }
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
  const requestId = rid();
  const started = Date.now();

  try {
    if (event.httpMethod !== "POST") return res(405, { error: "Method Not Allowed" });

    const ip =
      event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      event.headers?.["client-ip"] || "anon";
    if (!allow(ip)) return res(429, { error: "Too Many Requests" }, { "Retry-After": "2" });

    const payload = JSON.parse(event.body || "{}");
    const question = String(payload.question || "").trim();
    const model = String(payload.model || "deepseek-ai/DeepSeek-V3.1");
    const history = Array.isArray(payload.history) ? payload.history.slice(-6) : []; // opzionale, no-regression
    if (!question) return res(400, { error: "Bad request: missing question" });

    const HF_KEY = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";
    if (!HF_KEY) return res(503, { error: "AI not configured (HF_TOKEN missing)" });

    const host = event.headers?.host || "";
    const proto = (event.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
    const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || (host ? `${proto}://${host}` : "");

    let data = payload.data;
    let slugUsed = null;

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

    let context = {};
    let ctas = [];

    if (isMunicipality) {
      context = {
        cityName: data.cityName,
        about: data?.about?.text,
        pilot: {
          title: data?.pilot?.title,
          intro: data?.pilot?.intro,
          goals: data?.pilot?.goals,
          governance: data?.pilot?.governance,
        },
        festivities: Array.isArray(data?.festivities)
          ? data.festivities.map((f) => ({ name: f?.name, month: f?.month, description: f?.description }))
          : [],
        openData: data?.openData?.jsonUrl || data?.openData?.csvUrl || null,
        social: data?.social || null,
      };

      try {
        const venues = await fetchJsonCached(`${origin}/data/venues.json`);
        if (Array.isArray(venues) && venues.length) {
          const vlist = venues.map((v) => ({
            n: String(v?.name || "").trim(),
            c: inferCategory(String(v?.name || ""), String(v?.tagline || "")),
          })).filter(x => x.n);
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
          items: (Array.isArray(c?.items) ? c.items : []).map((i) => ({
            name: i?.name, desc: i?.desc, price: i?.price, tags: i?.tags, fav: i?.fav,
          })),
        })),
      };
      if (data?.config?.phone) ctas.push("[Chiama]");
      if (data?.config?.whatsapp) ctas.push("[WhatsApp]");
      if (data?.config?.address || data?.config?.mapUrl) ctas.push("[Indicazioni]");
      const rootCtas = Array.isArray(data?.chat?.ctas) ? projectCtasFromJson(data.chat.ctas) : [];
      const nestedCtas = Array.isArray(data?.config?.chat?.ctas) ? projectCtasFromJson(data.config.chat.ctas) : [];
      if (rootCtas.length || nestedCtas.length) ctas = [...new Set([...ctas, ...rootCtas, ...nestedCtas])];
    }

    /* ======= FALLBACK deterministico per HOME: qualsiasi CATEGORIA/professione ======= */
    if (isMunicipality && Array.isArray(context.venues) && context.venues.length) {
      const cat = matchCategoryFromQuestion(question);
      const wantsMore = FOLLOWUP_RE.test(norm(question));
      if (cat) {
        const list = filterVenuesByCategory(context.venues, cat);
        if (list.length) {
          const names = pickNames(list, wantsMore);
          const tail = wantsMore
            ? " Per l’elenco completo apri “Esercenti aderenti”."
            : " Per altri, apri “Esercenti aderenti”.";
          return res(200, { answer: `${names}.${tail}` });
        }
      }
    }

    /* ========== PROMPT ========== */
    const commonHdr =
      `Sei "${assistantTitle}". Rispondi nella lingua dell'utente, max 90 parole, tono cortese e sintetico. ` +
      `Usa SOLO le informazioni nei DATI. Se qualcosa manca, rispondi "Non disponibile". ` +
      `Non inventare link o contatti.`;

    const municipalGuide = context.venues
      ? `Se l'utente chiede un'attività/professione o un luogo (es. pizzeria, medico, farmacia, elettricista, parrucchiere, ecc.)
- seleziona dai VENUES fino a 5 nomi con categoria pertinente;
- elenca solo i nomi (separati da " • ");
- chiudi con "Per altri apri Esercenti aderenti."`
      : ``;

    const system = isMunicipality
      ? [
          commonHdr,
          `Contesto: assistente istituzionale del ${brand}.`,
          `Tratta storia locale, progetto/pilot, attività aderenti, festività/eventi e link utili.`,
          `NON parlare di piatti/menu/prezzi.`,
          `Per saluti o convenevoli (es. “ciao”, “come va”, “grazie”), rispondi brevemente e in modo cordiale anche se non è nei DATI.`,
          municipalGuide,
          `Se utile, chiudi con: ${ctas.length ? ctas.join(" ") : "—"}`,
          `DATI: ${JSON.stringify({
            cityName: context.cityName,
            about: context.about,
            pilot: context.pilot,
            festivities: context.festivities,
            openData: context.openData,
            social: context.social,
            venues: context.venues || []
          })}`,
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
      ...history,                                  // opzionale (no-regression)
      { role: "user", content: String(question) },
    ];

    const body = { model, messages, max_tokens: 220, temperature: 0.2, provider: { order: ["Fireworks"] } };

    /* ========== Chiamata a Hugging Face con retry/timeout ========== */
    const hfUrl = "https://router.huggingface.co/v1/chat/completions";

    const r = await withRetry(
      async (attempt) => {
        const resp = await fetchWithTimeout(
          hfUrl,
          { method: "POST", headers: { Authorization: `Bearer ${HF_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
          TIMEOUT_MS
        );
        if (resp.status === 429 || resp.status === 502 || resp.status === 503) {
          const e = new Error(`upstream ${resp.status}`); e.code = resp.status; throw e;
        }
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
