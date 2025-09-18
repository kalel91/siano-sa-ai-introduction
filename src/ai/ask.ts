// src/ai/ask.ts

// ===== Types: tutto opzionale per funzionare sia con esercenti che con "home" comunale
export type MenuItem = { name: string; desc?: string; price?: number; tags?: string[]; fav?: boolean };
export type Category = { name: string; items?: MenuItem[] };

export type GenericJson = {
  // modello "esercente"
  config?: {
    name?: string;
    hours?: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
    assistantLabel?: string;
    mapUrl?: string;
  };
  menu?: {
    specials?: { title: string; price?: string; badge?: string }[];
    categories?: Category[];
  };
  story?: { title?: string; text?: string } | null;

  // modello "comune"
  cityName?: string;
  about?: { title?: string; text?: string };
  pilot?: {
    title?: string;
    intro?: string;
    goals?: string[];
    components?: string[];
    governance?: string;
  };
  festivities?: Array<{ name: string; month?: string; description?: string; link?: string }>;
  openData?: { csvUrl?: string; jsonUrl?: string };
  social?: { website?: string; facebook?: string; instagram?: string };

  chat?: {
    quickReplies?: string[];
    faq?: Record<string, string>;
    ctas?: Array<{ type: "link" | "call" | "directions" | "whatsapp"; label: string; href?: string; url?: string }>;
  };
};

type AskOptions = {
  locale?: "it" | "en";
};

// ===== Helpers
const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

const hasMenu = (data?: GenericJson) => !!(data?.menu?.categories && data.menu.categories.length);
const hasConfig = (data?: GenericJson) => !!data?.config;

// filtri semplici ma generici
type Filters = { veg?: boolean; nolactose?: boolean; spicy?: boolean };
function parseFilters(q: string): Filters {
  const t = norm(q);
  return {
    veg: /\bveg(etarian|\b)|senza carne\b/.test(t),
    nolactose: /senza (latte|lattosio)|no lattosio/.test(t),
    spicy: /\b(piccant|speziat|hot|spicy|diavol)\b/.test(t),
  };
}

function itemMatchesFilters(item: MenuItem, f: Filters): boolean {
  if (!f.veg && !f.nolactose && !f.spicy) return true;
  const hay = norm([item.name, item.desc, (item.tags || []).join(" ")].join(" "));
  if (f.veg && !/\bveg\b/.test(hay)) return false;
  if (f.nolactose && /(latte|lattosio|formagg)/.test(hay)) return false;
  if (f.spicy && !/(piccant|spicy|hot|diavol)/.test(hay)) return false;
  return true;
}

function euro(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

// ===== Risposte “FAQ” generiche
function faqHit(q: string, data: GenericJson): string | null {
  const faq = data.chat?.faq || {};
  const t = norm(q);
  for (const k of Object.keys(faq)) {
    if (norm(k) === t) return faq[k];
  }
  return null;
}

// ===== Risposta stile "esercente"
function venueAnswer(q: string, data: GenericJson, hints: string[]): string | null {
  const t = norm(q);
  const cfg = data.config || {};

  if (/(orari|apertur|chiusur|quando|aperto|chiuso)/.test(t)) {
    const base = cfg.hours ? `Orari: ${cfg.hours}.` : "Gli orari non sono indicati.";
    const hint = hints.length ? ` Prova anche: ${hints.slice(0, 3).join(" • ")}.` : "";
    return base + hint;
  }
  if (/(indirizz|dove|come si arriv|indicaz|mappa)/.test(t)) {
    const base = cfg.address ? `Indirizzo: ${cfg.address}.` : "L'indirizzo non è indicato.";
    const hint = hints.length ? ` Usa il pulsante “Indicazioni”.` : "";
    return base + hint;
  }
  if (/(telefono|chiama|numero)/.test(t)) {
    return `Telefono: ${cfg.phone || "—"}.`;
  }
  if (/(whatsapp|contatto)/.test(t)) {
    return `WhatsApp: ${cfg.whatsapp || "—"}.`;
  }

  // categorie / prodotti
  if (/(serviz|prodott|catalog|listin|menu|offert|special)/.test(t) || hasMenu(data)) {
    const cats = data.menu?.categories || [];
    if (!cats.length) return "Non ho un elenco di servizi/prodotti pubblicato.";
    const f = parseFilters(q);

    // pool
    const pool: MenuItem[] = [];
    for (const c of cats) for (const it of c.items || []) if (itemMatchesFilters(it, f)) pool.push(it);
    if (!pool.length) {
      const names = cats.map((c) => c.name).slice(0, 5).join(" • ");
      return `Vuoi esplorare le categorie? ${names}.`;
    }

    // pick top 2 favorendo 'fav'
    const sorted = pool.sort((a, b) => Number(!!b.fav) - Number(!!a.fav) || (a.name || "").localeCompare(b.name || ""));
    const picks = sorted.slice(0, 2);
    const line = picks
      .map((i) => `${i.name}${i.price != null ? ` — ${euro(i.price)}` : ""}`)
      .join(" • ");
    return `Posso suggerire: ${line}. Vuoi altre opzioni?`;
  }

  return null;
}

// ===== Risposta stile "comune"
function cityAnswer(q: string, data: GenericJson, hints: string[]): string | null {
  const t = norm(q);

  if (/(storia|paese|territorio|origini|chi siamo|about)/.test(t)) {
    const s = data.about?.text || data.story?.text;
    return s ? s : "Puoi esplorare storia, galleria e curiosità nella sezione dedicata.";
  }

  if (/(progetto|pilota|ai|digitale)/.test(t)) {
    const intro = data.pilot?.intro || "Il progetto introduce una piattaforma digitale per informare, promuovere e innovare in modo accessibile.";
    const goals = (data.pilot?.goals || []).slice(0, 2);
    const tail = goals.length ? ` Obiettivi: ${goals.join(" • ")}.` : "";
    return intro + tail;
  }

  if (/(eventi|fest|ricorrenz|sagra)/.test(t)) {
    const f = data.festivities || [];
    if (!f.length) return "Calendario eventi non disponibile al momento.";
    const top = f.slice(0, 2).map((x) => (x.month ? `${x.name} (${x.month})` : x.name)).join(" • ");
    return `Alcune ricorrenze: ${top}.`;
  }

  if (/(uffici|contatti|comune|municipio|informazioni)/.test(t)) {
    const site = data.social?.website || "sito istituzionale";
    return `Per orari e contatti degli uffici consulta il ${site}.`;
  }

  if (/(open\s*data|dati|json|csv)/.test(t)) {
    const j = data.openData?.jsonUrl;
    const c = data.openData?.csvUrl;
    if (j || c) return `Dati aperti disponibili: ${[j && "JSON", c && "CSV"].filter(Boolean).join(" e ")}.`;
    return "Open Data non disponibili al momento.";
  }

  if (/(sito|website|web)/.test(t)) {
    return data.social?.website ? `Sito del Comune: ${data.social.website}` : "Sito istituzionale non indicato.";
  }

  // se ci sono quick replies, proponi
  if (hints.length) return `Posso aiutarti con: ${hints.slice(0, 4).join(" • ")}.`;

  return null;
}

// ===== Router principale (nessun LLM)
function localAnswer(q: string, data: GenericJson): string {
  // 1) FAQ esplicite
  const hit = faqHit(q, data);
  if (hit) return hit;

  const hints = data.chat?.quickReplies || [];

  // 2) venue-like
  if (hasConfig(data) || hasMenu(data)) {
    const a = venueAnswer(q, data, hints);
    if (a) return a;
  }

  // 3) city-like
  const b = cityAnswer(q, data, hints);
  if (b) return b;

  // 4) fallback generico
  if (hasMenu(data)) {
    const cats = data.menu?.categories || [];
    if (cats.length) {
      const names = cats.map((c) => c.name).slice(0, 5).join(" • ");
      return `Posso indicarti alcune categorie: ${names}. Oppure chiedimi orari, indirizzo o contatti.`;
    }
  }

  if (data.cityName) {
    const choices = hints.length ? hints.slice(0, 4).join(" • ") : "Storia • Progetto AI • Esercenti • Eventi";
    return `Dimmi cosa ti serve: ${choices}.`;
  }

  return "Posso aiutarti con orari, indirizzo, contatti, prodotti/servizi o argomenti specifici.";
}

// ===== API invariata
export async function askMenu(
  question: string,
  data: GenericJson,
  _opts: AskOptions = {}
): Promise<{ answer: string; used: "local" }> {
  const answer = localAnswer(question, data);
  return { answer, used: "local" };
}
