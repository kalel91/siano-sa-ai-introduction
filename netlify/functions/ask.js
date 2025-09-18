// netlify/functions/ask.js
// Runtime: Node 18+
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

    // 1) DATI: passati inline...
    let data = payload.data;

    // ...oppure caricati dal sito tramite slug
    if (!data) {
      const slug = String(payload.slug || "").trim();
      if (!slug) return { statusCode: 400, body: "Bad request: missing data or slug" };

      // Origine assoluta (funziona in prod e preview)
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

    /* ---------- Riconoscimento profilo ---------- */
    const isMunicipality = !!data?.cityName && !data?.menu;
    const brand = isMunicipality
      ? `Comune di ${data.cityName}`
      : (data?.config?.name || "Il locale");
    const assistantTitle =
      (isMunicipality
        ? (data?.assistant?.panelTitle || `Assistente digitale del ${brand}`)
        : `Assistente di ${brand}`);

    /* ---------- Compattazione contesto ---------- */
    let context = {};
    let ctas = [];

    if (isMunicipality) {
      // HOME / MUNICIPIO
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
          ? data.festivities.map(f => ({
              name: f?.name, month: f?.month, description: f?.description
            }))
          : [],
        openData: data?.openData?.jsonUrl || data?.openData?.csvUrl || null,
        social: data?.social || null,
      };

      // CTA suggerite (solo se davvero presenti nel JSON)
      if (data?.social?.website) ctas.push("[Sito]");
      if (data?.openData?.jsonUrl || data?.openData?.csvUrl) ctas.push("[Open Data]");
      // (nessun [Chiama]/[WhatsApp]/[Indicazioni] perché la home non li espone)
    } else {
      // ESERCENTE
      context = {
        brand,
        hours: data?.config?.hours,
        address: data?.config?.address,
        phone: data?.config?.phone,
        whatsapp: data?.config?.whatsapp,
        specials: data?.menu?.specials || [],
        categories: (Array.isArray(data?.menu?.categories) ? data.menu.categories : []).map(c => ({
          name: c?.name,
          items: (Array.isArray(c?.items) ? c.items : []).map(i => ({
            name: i?.name, desc: i?.desc, price: i?.price, tags: i?.tags, fav: i?.fav
          }))
        }))
      };

      if (data?.config?.phone) ctas.push("[Chiama]");
      if (data?.config?.whatsapp) ctas.push("[WhatsApp]");
      if (data?.config?.address || data?.config?.mapUrl) ctas.push("[Indicazioni]");
    }

    /* ---------- Prompt ---------- */
    const commonHdr =
      `Sei "${assistantTitle}". Rispondi nella lingua dell'utente, in max 90 parole, tono cortese e sintetico. ` +
      `Usa SOLO le informazioni nei DATI. Se qualcosa manca, rispondi "Non disponibile". ` +
      `Non inventare link o contatti.`;

    const system = isMunicipality
      ? [
          commonHdr,
          // vincoli specifici per la Home comunale
          `Contesto: assistente istituzionale del ${brand}.`,
          `Tratta argomenti come storia locale, progetto pilota, attività aderenti, festività/eventi e link utili.`,
          `NON parlare di piatti, menu, ristorante o prezzi.`,
          ctas.length ? `Se utile, chiudi con: ${ctas.join(" ")}` : `Evita CTA finali se non pertinenti.`,
          `DATI: ${JSON.stringify(context)}`
        ].join("\n")
      : [
          commonHdr,
          // vincoli specifici per l'esercente
          `Contesto: assistente dell'attività "${brand}".`,
          `Puoi citare orari, indirizzo, telefono/WhatsApp. Se utile, suggerisci 1–2 voci di menu con prezzo.`,
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

    let answer = "Non disponibile al momento.";
    try {
      const j = JSON.parse(text);
      answer = j?.choices?.[0]?.message?.content?.trim() || answer;
    } catch (e) {
      console.error("Parse error:", e);
    }

    return { statusCode: 200, body: JSON.stringify({ answer }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: String(e) };
  }
}
