// netlify/functions/ask.js
// Runtime: Node 18+ (fetch già disponibile)
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

      // Costruisci l'origine assoluta del sito (funziona in prod e in preview)
      const host = event.headers?.host || "";
      const proto = (event.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
      const origin =
        process.env.URL ||
        process.env.DEPLOY_PRIME_URL ||
        (host ? `${proto}://${host}` : "");

      const jsonUrl = `${origin}/data/${slug}.json`;
      const r = await fetch(jsonUrl, { headers: { "Cache-Control": "no-cache" } });
      if (!r.ok) return { statusCode: 404, body: `Menu JSON not found for slug '${slug}'` };
      data = await r.json();
    }

    // Etichette dal JSON
    const brand = data?.config?.name || "Il locale";
    const assistantTitle = `Assistente di ${brand}`;

    // Compatta il contesto (evita gonfiaggi di token)
    const context = {
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

    const system = [
      `Sei "${assistantTitle}", l'assistente del locale ${brand}.`,
      `Rispondi sempre in italiano, massimo 90 parole, tono cortese e sintetico.`,
      `Devi usare SOLO i dati seguenti (menu/orari/indirizzo).`,
      `Se qualcosa non c'è nei dati, rispondi "Non disponibile".`,
      `Se utile, suggerisci una o due opzioni del menu con prezzo.`,
      `Chiudi SEMPRE con: [Chiama] [WhatsApp] [Indicazioni] (testo semplice).`,
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
      // prova prima Fireworks (dove DeepSeek funziona bene), poi generic routing
      provider: { order: ["Fireworks"] }
    };

    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    if (!r.ok) {
      // utile in debug: log server-side e bubble up all client
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
