// netlify/functions/ask.js
// Runtime: Node 18+ (fetch già disponibile)
export async function handler(event) {
  try {
    const { question, data, model = "deepseek-ai/DeepSeek-V3.1" } = JSON.parse(event.body || "{}");
    if (!question || !data) return { statusCode: 400, body: "Bad request" };
    if (!process.env.HF_TOKEN) return { statusCode: 500, body: "HF_TOKEN missing" };

    // Etichette dal JSON
    const brand = data?.config?.name || "Il locale";
    const assistantTitle = `Assistente di ${brand}`;

    // Compatta il contesto menu in modo sicuro
    const context = {
      brand,
      hours: data?.config?.hours,
      address: data?.config?.address,
      phone: data?.config?.phone,
      whatsapp: data?.config?.whatsapp,
      specials: data?.menu?.specials || [],
      categories: (data?.menu?.categories || []).map(c => ({
        name: c.name,
        items: (c.items || []).map(i => ({ name: i.name, desc: i.desc, price: i.price, tags: i.tags, fav: i.fav }))
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
    if (!r.ok) return { statusCode: r.status, body: text };

    const j = JSON.parse(text);
    const answer = j?.choices?.[0]?.message?.content?.trim() || "Non disponibile al momento.";
    return { statusCode: 200, body: JSON.stringify({ answer }) };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}