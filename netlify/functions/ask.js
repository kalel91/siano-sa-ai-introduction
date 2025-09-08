// netlify/functions/ask.js
export async function handler(event) {
  try {
    const { question, data } = JSON.parse(event.body || "{}");
    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) return { statusCode: 500, body: "HF_TOKEN missing" };

    const context = JSON.stringify({
      name: data?.config?.name,
      hours: data?.config?.hours,
      address: data?.config?.address,
      specials: data?.menu?.specials || [],
      categories: (data?.menu?.categories || []).map(c => ({
        name: c.name,
        items: (c.items || []).map(i => ({
          name: i.name, desc: i.desc, price: i.price, tags: i.tags, fav: i.fav
        }))
      }))
    });

    const system = [
      "Sei un assistente per il ristorante.",
      "Rispondi in italiano in max 90 parole.",
      "Usa SOLO i dati JSON forniti (menu/orari/indirizzo).",
      'Se manca qualcosa, rispondi: "Non disponibile".',
      "Chiudi SEMPRE suggerendo: [Chiama] [WhatsApp] [Indicazioni].",
      "JSON:\n" + context
    ].join("\n");

    const body = {
      model: "deepseek-ai/DeepSeek-V3.1",
      provider: { order: ["Fireworks"] },           // assicurati che Fireworks sia ON nei Provider
      messages: [
        { role: "system", content: system },
        { role: "user", content: String(question || "") }
      ],
      max_tokens: 300,
      temperature: 0.2
    };

    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await r.text();
    if (!r.ok) return { statusCode: r.status, body: text };

    const json = JSON.parse(text);
    const answer = json?.choices?.[0]?.message?.content?.trim() || "Non disponibile al momento.";
    return { statusCode: 200, body: JSON.stringify({ answer }) };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}