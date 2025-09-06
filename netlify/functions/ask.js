// Runtime Node 18+: fetch è già disponibile
export async function handler(event) {
  try {
    const { question, data, model = "HuggingFaceH4/zephyr-7b-beta" } = JSON.parse(event.body || "{}");
    if (!process.env.HF_TOKEN) return { statusCode: 500, body: "HF_TOKEN missing" };

    const prompt =
`Sei un assistente per il ristorante. Rispondi in italiano (max 90 parole).
Usa SOLO questo JSON (menu, orari, indirizzo). Se manca qualcosa, di' "Non disponibile".
Termina sempre suggerendo: [Chiama] [WhatsApp] [Indicazioni].

JSON: ${JSON.stringify({
  name: data?.config?.name,
  hours: data?.config?.hours,
  address: data?.config?.address,
  specials: data?.menu?.specials || [],
  categories: (data?.menu?.categories || []).map(c => ({
    name: c.name,
    items: (c.items || []).map(i => ({ name: i.name, desc: i.desc, price: i.price, tags: i.tags, fav: i.fav }))
  }))
})}
Domanda: ${question}
Risposta:`;

    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 180, temperature: 0.2 } })
    });

    if (!r.ok) return { statusCode: r.status, body: await r.text() };
    const j = await r.json();
    const text = Array.isArray(j) ? j[0]?.generated_text || "" : (j.generated_text || "");
    const answer = (text || "").replace(prompt, "").trim() || "Non disponibile al momento.";
    return { statusCode: 200, body: JSON.stringify({ answer }) };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
