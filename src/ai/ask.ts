// src/ai/ask.ts
export type MenuJson = {
  config: {
    name: string;
    hours?: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
    assistantLabel?: string;
  };
  story?: { title?: string; text?: string } | null;
  menu: {
    specials?: { title: string; price: string; badge?: string }[];
    categories: { name: string; items: { name: string; desc?: string; price: number; tags?: string[]; fav?: boolean }[] }[];
  };
};

type AskOptions = {
  locale?: "it" | "en";
};

// semplice euristica locale (no LLM)
function localAnswer(q: string, data: MenuJson): string {
  const question = q.toLowerCase();

  if (/(orari|apert|chius|quando|aperto|chiuso)/i.test(question)) {
    return `Siamo aperti: ${data.config.hours || "vedi in alto nella pagina"}. Vuoi che apra le indicazioni o ti metta in contatto?`;
  }
  if (/(indirizz|dove|come arriv|mappa)/i.test(question)) {
    return `Indirizzo: ${data.config.address || "—"}. Tocca "Indicazioni" per Google Maps.`;
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

  // scoring leggero su ingredienti/parole chiave
  const wantsNoCheese = /(senza.*(latte|lattosio)|no.*(latte|lattosio))/i.test(question);
  const wantsSpicy    = /(piccante|calabrese|nduja|diavola)/i.test(question);
  const wantsVeg      = /(vegetarian|veg\b|senza carne)/i.test(question);
  const tokens = question.split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 2);

  type Scored = { cat: string; item: any; score: number };
  const scored: Scored[] = [];

  for (const c of data.menu.categories || []) {
    for (const it of c.items || []) {
      let score = 0;
      const hay = (it.name + " " + (it.desc || "")).toLowerCase();

      for (const t of tokens) if (hay.includes(t)) score += 2;
      if (wantsVeg && /(verd|margherita|bufala|formagg|ort|pomodoro|melanz|zucchin|friariell)/.test(hay)) score += 1.5;
      if (wantsNoCheese && /(mozz|fior di latte|formagg|bufal)/.test(hay)) score -= 2;
      if (wantsSpicy && /(nduja|diavola|piccant|salame|peperonc)/.test(hay)) score += 2;
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

  return "Posso aiutarti a scegliere: dimmi ingredienti che ti piacciono (es. 'senza lattosio', 'qualcosa di piccante', 'con salsiccia').";
}

export async function askMenu(question: string, data: MenuJson, _opts: AskOptions = {}): Promise<{ answer: string; used: "local" }> {
  const answer = localAnswer(question, data);
  return { answer, used: "local" };
}