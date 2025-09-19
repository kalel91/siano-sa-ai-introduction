// netlify/functions/ask.js
// Runtime: Node 18+
// Endpoint usato dal widget quando l’AI è “online”.
// Hardening: throttle per-IP, retry con jitter su 429/5xx, timeout 5s, cache JSON 60s, mappatura errori 429/503.
// Esteso per HOME: include elenco esercenti (venues.json) in contesto, con categoria dedotta.

const TIMEOUT_MS = 5_000;        // timeout endpoint AI
const RETRIES = 3;               // tentativi totali (incluso il primo)
const BACKOFF_MIN = 180;         // jitter min (ms)
const BACKOFF_MAX = 420;         // jitter max (ms)

/* ---------- Helpers ---------- */
function rid() { return Math.random().toString(36).slice(2, 8); }

function projectCtasFromJson(ctasJson) {
  if (!Array.isArray(ctasJson)) return [];
  // Trasforma in etichette [Label] usate come hint testuale nella risposta AI
  return ctasJson
    .map((c) =>
      c && typeof c.label === "string" && c.label.trim()
        ? `[${c.label.trim()}]`
        : null
    )
    .filter(Boolean);
}

/* Categoria molto compatta per venue (serve al solo instradamento nel prompt) */
function inferCategory(name = "", tagline = "") {
  const t = `${name} ${tagline}`.toLowerCase();
  if (/pizzer/i.test(t)) return "pizzeria";
  if (/ristorant/i.test(t)) return "ristorante";
  if (/\bbar\b|caf[èe]|caffetteria/.test(t)) return "bar";
  if (/panific|forn|bakery|pane/.test(t)) return "panificio";
  if (/pasticc|dolci|gelat/.test(t)) return "pasticceria";
  if (/farmac/i.test(t)) return "farmacia";
  if (/tabac/i.test(t)) return "tabacchi";
  if (/supermerc|market|alimentar/.test(t)) return "supermercato";
  if (/parrucch|barbier/i.test(t)) return "parrucchiere";
  if (/estetica|estetist/i.test(t)) return "estetista";
  if (/ferrament/i.test(t)) return "ferramenta";
  return "altro";
}

/* ---------- Utils HTTP ---------- */
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

/* ---------- Simple per-IP throttle (token bucket) ---------- */
const BUCKET = new Map(); // ip -> { tokens, last }
const RATE = { capacity: 3, refillMs: 1500 }; // max 3 richieste, 1 token ogni 1.5s

function allow(ip) {
  const now = Date.now();
  const s = BUCKET.get(ip) ?? { tokens: RATE.capacity, last: now };
  // refill
  const elapsed = now - s.last;
  const add = Math.floor(elapsed / RATE.refillMs);
  if (add > 0) {
    s.tokens = Math.min(RATE.capacity, s.tokens + add);
    s.last = now;
  }
  if (s.tokens <= 0) {
    BUCKET.set(ip, s);
    return false;
  }
  s.tokens -= 1;
  BUCKET.set(ip, s);
  return true;
}

/* ---------- Retry con jitter + timeout ---------- */
async function withRetry(fn, { tries = RETRIES, min = BACKOFF_MIN, max = BACKOFF_MAX } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (i === tries - 1) break;
      const sleep = min + Math.random() * (max - min);
      await new Promise((r) => setTimeout(r, sleep));
    }
  }
  throw lastErr;
}

async function fetchWithTimeout(url, opts = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error("timeout")), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ---------- Mini-cache JSON (60s) ---------- */
const JSON_CACHE = new Map(); // key -> { ts, data }
const JSON_TTL = 60_000;

async function fetchJsonCached(url) {
  const now = Date.now();
  const hit = JSON_CACHE.get(url);
  if (hit && now - hit.ts < JSON_TTL) {
    return hit.data;
  }
  const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  if (!r.ok) throw new Error(`json ${r.status}`);
  const data = await r.json();
  JSON_CACHE.set(url, { ts: now, data });
  return data;
}

export async function handler(event) {
  const requestId = rid();
  const started = Date.now();

  try {
    if (event.httpMethod !== "POST") {
      return res(405, { error: "Method Not Allowed" });
    }

    // Throttle per-IP
    const ip =
      event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      event.headers?.["client-ip"] ||
      "anon";
    if (!allow(ip)) {
      console.warn(`[ask][${requestId}] throttle hit ip=${ip}`);
      return res(429, { error: "Too Many Requests" }, { "Retry-After": "2" });
    }

    const payload = JSON.parse(event.body || "{}");
    const question = String(payload.question || "").trim();
    const model = String(payload.model || "deepseek-ai/DeepSeek-V3.1");
    if (!question) return res(400, { error: "Bad request: missing question" });

    const HF_KEY =
      process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";
    if (!HF_KEY) return res(503, { error: "AI not configured (HF_TOKEN missing)" });

    // origine assoluta (prod & preview) — serve anche per venues.json in HOME
    const host = event.headers?.host || "";
    const proto = (event.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
    const origin =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      (host ? `${proto}://${host}` : "");

    // 1) Dati: inline oppure via slug
    let data = payload.data;
    let slugUsed = null;

    if (!data) {
      const slug = String(payload.slug || "").trim();
      if (!slug) return res(400, { error: "Bad request: missing data or slug" });
      slugUsed = slug;

      const jsonUrl = `${origin}/data/${slug}.json`;
      try {
        data = await fetchJsonCached(jsonUrl);
      } catch (e) {
        console.warn(`[ask][${requestId}] json 404 slug=${slug} ip=${ip}`);
        return res(404, { error: `JSON not found for slug '${slug}'` });
      }
    }

    /* ========== PROFILO ========== */
    const isMunicipality = !!data?.cityName && !data?.menu;
    const brand = isMunicipality
      ? `Comune di ${data.cityName}`
      : data?.config?.name || "Il locale";
    const assistantTitle = isMunicipality
      ? data?.assistant?.panelTitle || `Assistente digitale del ${brand}`
      : `Assistente di ${brand}`;

    /* ========== CONTESTO COMPATTO ========== */
    let context = {};
    let ctas = [];

    if (isMunicipality) {
      // HOME / COMUNE
      context = {
        cityName: data.cityName,
        about: data?.about?.text, // testo “La storia di Siano”
        pilot: {
          title: data?.pilot?.title,
          intro: data?.pilot?.intro,
          goals: data?.pilot?.goals,
          governance: data?.pilot?.governance,
        },
        festivities: Array.isArray(data?.festivities)
          ? data.festivities.map((f) => ({
              name: f?.name,
              month: f?.month,
              description: f?.description,
            }))
          : [],
        openData: data?.openData?.jsonUrl || data?.openData?.csvUrl || null,
        social: data?.social || null,
      };

      // Includi elenco Esercenti (compatto) per domande tipo "pizzeria", "dove mangiare", ecc.
      try {
        const venues = await fetchJsonCached(`${origin}/data/venues.json`);
        if (Array.isArray(venues) && venues.length) {
          // Minimizza il payload: { n: name, c: category }
          const vlist = venues.map((v) => ({
            n: String(v?.name || "").trim(),
            c: inferCategory(String(v?.name || ""), String(v?.tagline || "")),
          })).filter(x => x.n);
          context.venues = vlist;
        }
      } catch {
        // nessun blocco se venues.json non esiste
      }

      // CTA base
      if (data?.social?.website) ctas.push("[Sito]");
      if (data?.openData?.jsonUrl || data?.openData?.csvUrl) ctas.push("[Open Data]");
      // CTA dichiarate nel JSON (chat.ctas a livello root)
      if (Array.isArray(data?.chat?.ctas)) {
        ctas = [...new Set([...ctas, ...projectCtasFromJson(data.chat.ctas)])];
      }
      // niente [Chiama]/[WhatsApp]/[Indicazioni] per la home
    } else {
      // ESERCENTE
      context = {
        brand,
        hours: data?.config?.hours,
        address: data?.config?.address,
        phone: data?.config?.phone,
        whatsapp: data?.config?.whatsapp,
        specials: data?.menu?.specials || [],
        categories: (Array.isArray(data?.menu?.categories)
          ? data.menu.categories
          : []
        ).map((c) => ({
          name: c?.name,
          items: (Array.isArray(c?.items) ? c.items : []).map((i) => ({
            name: i?.name,
            desc: i?.desc,
            price: i?.price,
            tags: i?.tags,
            fav: i?.fav,
          })),
        })),
      };

      // CTA derivate da config
      if (data?.config?.phone) ctas.push("[Chiama]");
      if (data?.config?.whatsapp) ctas.push("[WhatsApp]");
      if (data?.config?.address || data?.config?.mapUrl) ctas.push("[Indicazioni]");
      // CTA dichiarate nel JSON
      const rootCtas = Array.isArray(data?.chat?.ctas)
        ? projectCtasFromJson(data.chat.ctas)
        : [];
      const nestedCtas = Array.isArray(data?.config?.chat?.ctas)
        ? projectCtasFromJson(data.config.chat.ctas)
        : [];
      if (rootCtas.length || nestedCtas.length) {
        ctas = [...new Set([...ctas, ...rootCtas, ...nestedCtas])];
      }
    }

    /* ========== PROMPT ========== */
    const commonHdr =
      `Sei "${assistantTitle}". Rispondi nella lingua dell'utente, max 90 parole, tono cortese e sintetico. ` +
      `Usa SOLO le informazioni nei DATI. Se qualcosa manca, rispondi "Non disponibile". ` +
      `Non inventare link o contatti.`;

    // Regola speciale per HOME: se l’utente chiede luoghi/cibo/attività, seleziona dai VENUES fino a 5 nomi pertinenti.
    const homeVenueGuide = context.venues
      ? `Se l'utente chiede un luogo o dove mangiare/bere/acquistare (es. "pizzeria", "ristorante", "bar", "panificio", "pasticceria", "farmacia", "tabacchi", "supermercato", "parrucchiere", "estetista", "ferramenta"):
- Seleziona dai VENUES fino a 5 nomi con categoria pertinente.
- Elenca solo i nomi (separati da " • "). Non inventare indirizzi o telefoni.
- Chiudi con: "Per i dettagli apri Esercenti aderenti."`
      : ``;

    const system = isMunicipality
      ? [
          commonHdr,
          `Contesto: assistente istituzionale del ${brand}.`,
          `Tratta storia locale, progetto/pilot, attività aderenti, festività/eventi e link utili.`,
          `NON parlare di piatti/menu/prezzi.`,
          `Per saluti o convenevoli (es. “ciao”, “come va”, “grazie”), rispondi brevemente e in modo cordiale anche se non è nei DATI.`,
          homeVenueGuide,
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

    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: String(question) },
      ],
      max_tokens: 220,
      temperature: 0.2,
      provider: { order: ["Fireworks"] },
    };

    /* ========== Chiamata a Hugging Face con retry/timeout ========== */
    const hfUrl = "https://router.huggingface.co/v1/chat/completions";

    const r = await withRetry(
      async (attempt) => {
        const resp = await fetchWithTimeout(
          hfUrl,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HF_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
          TIMEOUT_MS
        );

        // Se rate-limit/errore server → trigger retry
        if (resp.status === 429 || resp.status === 502 || resp.status === 503) {
          const e = new Error(`upstream ${resp.status}`);
          e.code = resp.status;
          console.warn(`[ask][${requestId}] upstream=${resp.status} attempt=${attempt+1}/${RETRIES} ip=${ip} slug=${slugUsed??"-"}`);
          throw e;
        }
        return resp;
      },
      { tries: RETRIES, min: BACKOFF_MIN, max: BACKOFF_MAX }
    );

    const text = await r.text();
    if (!r.ok) {
      // Mappa in 429/503, niente 500
      if (r.status === 429) {
        console.warn(`[ask][${requestId}] HF 429 rate-limited ip=${ip} slug=${slugUsed??"-"}`);
        return res(429, { error: "Rate limited by AI" }, { "Retry-After": "2" });
      }
      console.warn(`[ask][${requestId}] HF ${r.status} mapped->503 ip=${ip} slug=${slugUsed??"-"}`);
      return res(503, { error: "AI temporarily unavailable", detail: text });
    }

    // parsing risposta più robusto
    let answer = "Non disponibile al momento.";
    try {
      const j = JSON.parse(text);
      const raw = j?.choices?.[0]?.message?.content;
      if (typeof raw === "string") {
        answer = (raw || "").replace(/\s+$/, "").trim() || answer;
      }
    } catch (e) {
      console.error(`[ask][${requestId}] parse error`, e);
    }

    console.info(`[ask][${requestId}] ok ip=${ip} slug=${slugUsed??"-"} t=${Date.now()-started}ms`);
    // Manteniamo il formato originale (solo {answer}) per evitare regressioni lato client
    return res(200, { answer });
  } catch (e) {
    // Timeout o eccezioni generiche → 503 (non 500) per forzare fallback senza "errori rossi"
    if (e?.name === "AbortError" || e?.message === "timeout") {
      console.warn(`[ask][${requestId}] timeout ${TIMEOUT_MS}ms`);
      return res(503, { error: "AI timeout" });
    }
    console.error(`[ask][${requestId}] fatal`, e);
    return res(503, { error: "Service temporarily unavailable" });
  }
}
