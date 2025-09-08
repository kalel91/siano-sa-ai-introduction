// netlify/functions/ask.js
export async function handler(event) {
  try {
    const method = event.httpMethod || "GET";
    if (method !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Use POST" }) };
    }

    const { question, data, model = "HuggingFaceH4/zephyr-7b-beta" } =
      JSON.parse(event.body || "{}");

    if (!process.env.HF_TOKEN) {
      return { statusCode: 500, body: "HF_TOKEN missing" };
    }

    const safe = (x) => (x == null ? "" : x);
    const payload = {
      name: safe(data?.config?.name),
      hours: safe(data?.config?.hours),
      address: safe(data?.config?.address),
      specials: Array.isArray(data?.menu?.specials) ? data.menu.specials : [],
      categories: Array.isArray(data?.menu?.categories)
        ? data.menu.categories.map((c) => ({
            name: safe(c?.name),
            items: Array.isArray(c?.items)
              ? c.items.map((i) => ({
                  name: safe(i?.name),
                  desc: safe(i?.desc),
                  price: i?.price ?? null,
                  tags: Array.isArray(i?.tags) ? i.tags : [],
                  fav: !!i?.fav
                }))
              : []
          }))
        : []
    };

    const prompt =
`Sei un assistente per il ristorante. Rispondi in italiano (max 90 parole).
Usa SOLO questo JSON (menu, orari, indirizzo). Se manca qualcosa, di' "Non disponibile".
Termina sempre suggerendo: [Chiama] [WhatsApp] [Indicazioni].

JSON: ${JSON.stringify(payload)}
Domanda: ${question || "(vuota)"}
Risposta:`;

    const url = `https://api-inference.huggingface.co/models/${model}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 180, temperature: 0.2 }
      })
    });

    const bodyText = await r.text();
    console.log("HF status:", r.status, "model:", model);
    if (!r.ok) {
      console.error("HF error body:", bodyText);
      return {
        statusCode: r.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "HF call failed", status: r.status, body: bodyText })
      };
    }

    let answer = "";
    try {
      const j = JSON.parse(bodyText);
      answer = Array.isArray(j) ? j[0]?.generated_text || "" : (j.generated_text || "");
    } catch {
      answer = bodyText;
    }

    if (answer.startsWith(prompt)) answer = answer.slice(prompt.length);
    answer = (answer || "").trim() || "Non disponibile al momento.";

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) };
  } catch (e) {
    console.error("ask.js fatal", e);
    return { statusCode: 500, body: String(e) };
  }
}
