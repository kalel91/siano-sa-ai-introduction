// netlify/functions/ask.js
// Runtime: Node 18+
// Endpoint usato dal widget quando l’AI è “online”.
// Profilo COMUNE vs ESERCENTE, contesto compatto, CTA coerenti + chat.ctas (anche sotto config.chat) support.

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

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const payload = JSON.parse(event.body || "{}");
    const question = String(payload.question || "").trim();
    const model = String(payload.model || "deepseek-ai/DeepSeek-V3.1");
    if (!question) return { statusCode: 400, body: "Bad request: missing question" };
    if (!process.env.HF_TOKEN) return { statusCode: 500, body: "HF_TOKEN missing" };

    // 1) Dati: inline oppure via slug
    let data = payload.data;
    if (!data) {
      const slug = String(payload.slug || "").trim();
      if (!slug) return { statusCode: 400, body: "Bad request: missing data or slug" };

      // origine assoluta (prod & preview)
      const host = event.headers?.host || "";
      const proto = (event.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
      const origin =
        process.env.URL ||
        process.env.DEPLOY_PRIME_URL ||
        (host ? `${proto}://${host}` : "");

      const jsonUrl = `${origin}/data/${slug}.json`;
      const r = await fetch(jsonUrl, { headers: { "Cache-Control": "no-cache" } });
      if (!r.ok) return { statusCode: 404, body: `JSON not found for slug '${slug}'` };
      data = await r.json();
    }

    /* ========== PROFILO ========== */
    const isMunicipality = !!data?.cityName && !data?.menu;
    const brand = isMunicipality
      ? `Comune di ${data.cityName}`
      : (data?.config?.name || "Il locale");
    const assistantTitle = isMunicipality
      ? (data?.assistant?.panelTitle || `Assistente digitale del ${brand}`)
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
              description: f?.description
            }))
          : [],
        openData: data?.openData?.jsonUrl || data?.openData?.csvUrl || null,
        social: data?.social || null,
      };

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
        categories: (Array.isArray(data?.menu?.categories) ? data.menu.categories : []).map((c) => ({
          name: c?.name,
          items: (Array.isArray(c?.items) ? c.items : []).map((i) => ({
            name: i?.name, desc: i?.desc, price: i?.price, tags: i?.tags, fav: i?.fav
          }))
        }))
      };

      // CTA derivate da config
      if (data?.config?.phone) ctas.push("[Chiama]");
      if (data?.config?.whatsapp) ctas.push("[WhatsApp]");
      if (data?.config?.address || data?.config?.mapUrl) ctas.push("[Indicazioni]");
      // CTA dichiarate nel JSON
      const rootCtas = Array.isArray(data?.chat?.ctas) ? projectCtasFromJson(data.chat.ctas) : [];
      const nestedCtas = Array.isArray(data?.config?.chat?.ctas) ? projectCtasFromJson(data.config.chat.ctas) : [];
      if (rootCtas.length || nestedCtas.length) {
        ctas = [...new Set([...ctas, ...rootCtas, ...nestedCtas])];
      }
    }

    /* ========== PROMPT ========== */
    const commonHdr =
      `Sei "${assistantTitle}". Rispondi nella lingua dell'utente, max 90 parole, tono cortese e sintetico. ` +
      `Usa SOLO le informazioni nei DATI. Se qualcosa manca, rispondi "Non disponibile". ` +
      `Non inventare link o contatti.`;

    const system = isMunicipality
      ? [
          commonHdr,
          `Contesto: assistente istituzionale del ${brand}.`,
          `Tratta storia locale, progetto/pilot, attività aderenti, festività/eventi e link utili.`,
          `NON parlare di piatti/menu/prezzi.`,
          `Per saluti o convenevoli (es. “ciao”, “come va”, “grazie”), rispondi brevemente e in modo cordiale anche se non è nei DATI.`,
          ctas.length ? `Se utile, chiudi con: ${ctas.join(" ")}` : `Evita CTA finali se non pertinenti.`,
          `DATI: ${JSON.stringify(context)}`
        ].join("\n")
      : [
          commonHdr,
          `Contesto: assistente dell'attività "${brand}".`,
          `Puoi citare orari, indirizzo, telefono/WhatsApp. Se utile, suggerisci 1–2 voci di catalogo/servizi (o piatti, se ristorante) con prezzo se presente.`,
          `Per saluti o convenevoli (es. “ciao”, “come va”, “grazie”), rispondi brevemente e in modo cordiale anche se non è nei DATI.`,
          ctas.length ? `Chiudi con: ${ctas.join(" ")}` : `Evita CTA finali se non pertinenti.`,
          `DATI: ${JSON.stringify(context)}`
        ].join("\n");

    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: String(question) }
      ],
      max_tokens: 220,
      temperature: 0.2,
      provider: { order: ["Fireworks"] }
    };

    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("HF error:", r.status, text);
      return { statusCode: r.status, body: text };
    }

    // parsing risposta più robusto
    let answer = "Non disponibile al momento.";
    try {
      const j = JSON.parse(text);
      const raw = j?.choices?.[0]?.message?.content;
      if (typeof raw === "string") {
        answer = raw.replace(/\s+$/,'').trim() || answer;
      }
    } catch (e) {
      console.error("Parse error:", e);
    }

    // Manteniamo il formato original (no ctas nel payload) per evitare regressioni lato client
    return { statusCode: 200, body: JSON.stringify({ answer }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: String(e) };
  }
}
