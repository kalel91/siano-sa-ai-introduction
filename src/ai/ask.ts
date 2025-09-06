// src/ai/ask.ts
export type MenuJson = {
  config: {
    name: string; hours?: string; address?: string; phone?: string; whatsapp?: string;
  };
  menu: {
    categories: { name: string; items: { name: string; desc?: string; price: number; tags?: string[]; fav?: boolean; }[] }[];
    specials?: { title: string; price: string; badge?: string }[];
  };
};

type AskOptions = {
  provider?: "local" | "huggingface";
  hfToken?: string;                // VITE_HF_TOKEN
  hfModel?: string;                // es. "HuggingFaceH4/zephyr-7b-beta"
  locale?: "it" | "en";
};

// ----------------------
// Modalità gratuita (local)
// ----------------------
function localAnswer(q: string, data: MenuJson): string {
  const question = q.toLowerCase();

  // intent rapidi
  if (/(orari|apert|chius|quando|aperto|chiuso)/i.test(question)) {
    return `Siamo aperti: ${data.config.hours || "vedi in alto nella pagina"}. Vuoi che ti apra le indicazioni o ti metta in contatto?`;
  }
  if (/(indirizz|dove|come arriv|mappa)/i.test(question)) {
    return `Indirizzo: ${data.config.address}. Tocca "Indicazioni" per Google Maps.`;
  }
  if (/(telefono|chiama|numero)/i.test(question)) {
    return `Telefono: ${data.config.phone || "—"}. Tocca "Chiama" per comporre.`;
  }
  if (/(whatsapp|contatto)/i.test(question)) {
    return `WhatsApp: ${data.config.whatsapp || "—"}. Tocca "WhatsApp" per scrivere.`;
  }
  if (/(promo|offert|special)/i.test(question)) {
    const s = data.menu.specials?.[0];
    if (s) return `Oggi: ${s.title} — ${s.price}${s.badge ? " (" + s.badge + ")" : ""}.`;
  }

  // preferenze/filtri
  const wantsNoCheese = /(senza.*(latte|lattosio)|no.*(latte|lattosio))/i.test(question);
  const wantsSpicy    = /(piccante|calabrese|nduja|diavola)/i.test(question);
  const wantsVeg      = /(vegetarian|veg\b|senza carne)/i.test(question);
  const tokens = question.split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 2 && !["con", "senza", "per", "che", "una", "uno", "gli", "le"].includes(t));

  type Scored = { cat: string; item: any; score: number };
  const scored: Scored[] = [];

  for (const c of data.menu.categories) {
    for (const it of c.items) {
      let score = 0;
      const hay = (it.name + " " + (it.desc || "")).toLowerCase();

      // match parole chiave
      for (const t of tokens) if (hay.includes(t)) score += 2;

      // preferenze soft
      if (wantsVeg && /(verd|margherita|bufala|formagg|ort|pomodoro|melanz|zucchin|friariell)/.test(hay)) score += 1.5;
      if (wantsNoCheese && /(mozz|fior di latte|formagg|bufal)/.test(hay)) score -= 2;
      if (wantsSpicy && /(nduja|diavola|piccant|salame|peperonc)/.test(hay)) score += 2;

      // bestseller
      if (it.fav) score += 1;

      if (score > 0) scored.push({ cat: c.name, item: it, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const picks = scored.slice(0, 4);

  if (picks.length) {
    const lines = picks.map(p => `• ${p.item.name} — ${p.item.price.toFixed(2).replace(".", ",")} €${p.item.desc ? " — " + p.item.desc : ""}`);
    return `Ecco cosa ti consiglio:\n${lines.join("\n")}\n\nVuoi ordinare al telefono o scrivere su WhatsApp?`;
  }

  // fallback elenco categoria più rilevante
  const bestCat = data.menu.categories.find(c => question.includes(c.name.toLowerCase()));
  if (bestCat) {
    const items = bestCat.items.slice(0, 6).map(it => `• ${it.name} — ${it.price.toFixed(2).replace(".", ",")} €`).join("\n");
    return `Nella sezione "${bestCat.name}" trovi:\n${items}`;
  }

  return "Posso aiutarti a scegliere: dimmi ingredienti che ti piacciono (es. 'senza lattosio', 'qualcosa di piccante', 'con salsiccia').";
}

// ----------------------
// Modalità LLM via Hugging Face (opzionale)
// ----------------------
async function llmAnswerHF(q: string, data: MenuJson, token: string, model = "HuggingFaceH4/zephyr-7b-beta"): Promise<string> {
  const context = JSON.stringify({
    name: data.config.name,
    hours: data.config.hours,
    address: data.config.address,
    specials: data.menu.specials,
    categories: data.menu.categories.map(c => ({
      name: c.name,
      items: c.items.map(i => ({ name: i.name, desc: i.desc, price: i.price, tags: i.tags, fav: i.fav }))
    }))
  });

  const prompt = `Sei un assistente per il ristorante. Rispondi in italiano, in massimo 90 parole.
DEVI usare solo queste informazioni JSON (menu, orari, indirizzo) e se qualcosa non c'è, dì "Non disponibile".
Preferisci elenchi puntati e termina SEMPRE proponendo: [Chiama] [WhatsApp] [Indicazioni] (solo come testo).

JSON:
${context}

Domanda: ${q}
Risposta:`;

  const resp = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 180, temperature: 0.2 } })
  });

  if (!resp.ok) throw new Error("HF error " + resp.status);
  const dataHF = await resp.json();
  const text = Array.isArray(dataHF) ? dataHF[0]?.generated_text || "" : (dataHF.generated_text || "");
  return (text || "").replace(prompt, "").trim() || "Non disponibile al momento.";
}

// ----------------------
// API pubblica
// ----------------------
export async function askMenu(question: string, data: MenuJson, opts: AskOptions = {}): Promise<{ answer: string; used: "local" | "huggingface" }> {
  const provider = opts.provider || (opts.hfToken ? "huggingface" : "local");

  if (provider === "huggingface" && opts.hfToken) {
    try {
      const ans = await llmAnswerHF(question, data, opts.hfToken, opts.hfModel);
      return { answer: ans, used: "huggingface" };
    } catch (e) {
      console.warn("HF failed, falling back to local:", e);
    }
  }

  return { answer: localAnswer(question, data), used: "local" };
}
