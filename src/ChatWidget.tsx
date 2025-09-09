import React from "react";
import { MessageCircle, X, SendHorizonal, Phone, MapPin } from "lucide-react";

/** Minimal menu JSON types expected by the widget */
type MenuItem = { name: string; desc?: string; price?: number; tags?: string[]; fav?: boolean };
type Category = { name: string; items: MenuItem[] };
type MenuJson = {
  config?: { name?: string; phone?: string; whatsapp?: string; hours?: string; address?: string; assistantLabel?: string };
  menu?: { specials?: { title: string; price?: string }[]; categories?: Category[] };
  story?: { title?: string; text?: string } | null;
};

/** CTA supportate */
type CTAType = "call" | "directions" | "whatsapp" | "link";
type CTA = { type: CTAType; label: string; url?: string };

/** Props */
type Props = {
  slug: string;
  phone?: string;
  mapsUrl?: string;
  venueName?: string;
  buttonLabel?: string;
  panelTitle?: string;
  /** per-locale dal JSON */
  quickReplies?: string[];
  ctas?: CTA[];
  whatsapp?: string;
  whatsDefaultMsg?: string;

  /** legacy (compat) */
  assistantLabel?: string;
  assistantTitle?: string;
};

type Msg = { role: "user" | "assistant"; text: string };

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers: intent & fallback engine (tieni il tuo “smart” migliorato)
   ──────────────────────────────────────────────────────────────────────────── */

// “Dimmi altre opzioni”: riconosce varie forme brevi colloquiali
const MORE_RE = /^(si|sì|ok|va bene|quali|quale|altri|altre|altro|ancora|poi|dimmi|cos'?altro)\b/i;

type Filters = { veg?: boolean; nolactose?: boolean; spicy?: boolean };

function parseFilters(q: string): Filters {
  const t = q.toLowerCase();
  return {
    veg: /veg(etar(i|)ano)?|senza carne/.test(t),
    nolactose: /senza lattos|lattosio/.test(t),
    spicy: /piccant|diavol/.test(t),
  };
}

function itemMatchesFilters(item: MenuItem, f: Filters): boolean {
  if (!f.veg && !f.nolactose && !f.spicy) return true;
  const tags = (item.tags || []).map((s) => s.toLowerCase()).join(" ");
  if (f.veg && !/veg/.test(tags)) return false;
  if (f.nolactose && !/senza\s*lattos/.test(tags)) return false;
  if (f.spicy && !/(piccante|diavola|spicy)/.test(tags)) return false;
  return true;
}

function buildCandidates(data: MenuJson, f: Filters, exclude: Set<string>): MenuItem[] {
  const cats = data?.menu?.categories || [];
  const all: MenuItem[] = [];
  for (const c of cats) for (const it of c.items) if (itemMatchesFilters(it, f)) all.push(it);

  // escludi già suggeriti
  const fresh = all.filter((it) => !exclude.has(it.name));

  // se non ci sono filtri → priorità ai best seller, poi alfabetico
  if (!f.veg && !f.nolactose && !f.spicy) {
    return fresh.sort((a, b) => Number(!!b.fav) - Number(!!a.fav) || a.name.localeCompare(b.name));
  }
  // con filtri → alfabetico e poi prezzo se presente
  return fresh.sort((a, b) => a.name.localeCompare(b.name) || (a.price ?? 0) - (b.price ?? 0));
}

function formatItem(i: MenuItem): string {
  return i.price != null ? `${i.name} — ${i.price!.toFixed(2)} €` : i.name;
}

/** Ritorna testo + nomi usati + se abbiamo esaurito le opzioni */
function offlineAnswer(q: string, data: MenuJson, cursor: number, already: Set<string>) {
  const t = q.toLowerCase();
  const cfg = data?.config || {};

  // Orari / indirizzo
  if (/orari|apertur|chiusur/.test(t))
    return { text: cfg.hours ? `Siamo aperti: ${cfg.hours}. Vuoi un consiglio dal menu?` : "Gli orari non sono indicati nel menu.", used: [] as string[], exhausted: false };

  if (/dove|indirizz|come (si )?arriv|indicazioni/.test(t))
    return { text: cfg.address ? `Ci trovi in ${cfg.address}. Se vuoi, premi Indicazioni qui sotto.` : "L'indirizzo non è indicato nel menu.", used: [] as string[], exhausted: false };

  const filters = parseFilters(t);
  const pool = buildCandidates(data, filters, already);

  // ricerca diretta per nome / descrizione
  if (!pool.length) {
    for (const c of data.menu?.categories || []) {
      const hit = c.items.find((i) => i.name.toLowerCase().includes(t) || (i.desc || "").toLowerCase().includes(t));
      if (hit) {
        return {
          text: hit.price != null
            ? `${hit.name}: ${(hit.desc || "nessuna descrizione")}. Prezzo ${hit.price.toFixed(2)} €.`
            : `${hit.name}: ${(hit.desc || "nessuna descrizione")}.`,
          used: [hit.name],
          exhausted: false,
        };
      }
    }
  }

  // elenco suggerimenti (2 alla volta, rotazione)
  if (pool.length) {
    const first = pool[cursor % pool.length];
    const second = pool.length > 1 ? pool[(cursor + 1) % pool.length] : undefined;
    const items = [first, second].filter(Boolean) as MenuItem[];
    const text = `Potrebbero piacerti: ${items.map(formatItem).join(" • ")}. Vuoi altre opzioni?`;
    return { text, used: items.map((x) => x.name), exhausted: false };
  }

  // niente con questi vincoli → guida l’utente
  return {
    text: "Con questi criteri non ho altre proposte. Prova a dirmi un ingrediente (es. 'pomodoro', 'salsiccia') oppure usa un filtro come 'vegetariano', 'senza lattosio' o 'piccante'.",
    used: [],
    exhausted: true,
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
   Util per CTA/WhatsApp
   ──────────────────────────────────────────────────────────────────────────── */
function telHref(t?: string){ return t ? `tel:${String(t).replace(/\s|\+/g, "")}` : "#"; }
function waHref(t?: string,msg=""){ if(!t) return "#"; const p=String(t).replace(/\D/g,""); return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`; }

/* ──────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */
export default function ChatWidget({
  slug,
  phone,
  mapsUrl,
  venueName,
  buttonLabel,
  panelTitle,
  quickReplies,
  ctas,
  whatsapp,
  whatsDefaultMsg,
  // legacy
  assistantLabel,
  assistantTitle,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState<Msg[]>([
    { role: "assistant", text: `Ciao! Posso aiutarti a scegliere dal menu${venueName ? ` di ${venueName}`:""}: dimmi cosa ti va (es. "piccante", "senza lattosio", "vegetariano", o un ingrediente).` },
  ]);

  // Stato per il fallback “smart”
  const [cursor, setCursor] = React.useState(0);                // ruota i suggerimenti
  const [suggested, setSuggested] = React.useState<Set<string>>(new Set()); // evita ripetizioni

  // Label UI
  const resolvedButtonLabel =
    (buttonLabel && buttonLabel.trim()) ||
    (assistantLabel && assistantLabel.trim()) ||
    "Chiedi all’assistente AI";
  const resolvedPanelTitle =
    (panelTitle && panelTitle.trim()) ||
    (assistantTitle && assistantTitle.trim()) ||
    (venueName ? `Assistente di ${venueName}` : "Assistente AI");

  // carica JSON del locale per l'AI e per il fallback
  const dataRef = React.useRef<MenuJson | undefined>(undefined);
  React.useEffect(() => {
    fetch(`/data/${slug}.json?ts=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { dataRef.current = j as MenuJson; })
      .catch(() => { /* useremo fallback */ });
  }, [slug]);

  // Endpoint dinamico: se hai VITE_AI_ENDPOINT lo usiamo; altrimenti Netlify function
  function getAIEndpoint(): string {
    const env = (import.meta as any)?.env;
    return (env && env.VITE_AI_ENDPOINT) ? env.VITE_AI_ENDPOINT : "/.netlify/functions/ask";
  }

  async function onSend() {
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setHistory((h) => [...h, { role: "user", text: q }]);

    const data = dataRef.current;
    // se non abbiamo i dati → fallback subito (con rotazione)
    if (!data) {
      const more = MORE_RE.test(q);
      const ans = offlineAnswer(q, { menu: { categories: [] } }, cursor + (more ? 2 : 0), suggested);
      setCursor((v) => v + (more ? 2 : 1));
      if (ans.used.length) setSuggested((s) => new Set([...s, ...ans.used]));
      setHistory((h) => [...h, { role: "assistant", text: ans.text }]);
      return;
    }

    setLoading(true);
    try {
      const endpoint = getAIEndpoint();
      const isNetlify = endpoint.includes("/.netlify/functions/");
      const payload = isNetlify ? { slug, question: q } : { question: q, data };
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        // FALLBACK “SMART”
        const more = MORE_RE.test(q);
        const ans = offlineAnswer(q, data, cursor + (more ? 2 : 0), suggested);
        setCursor((v) => v + (more ? 2 : 1));
        if (ans.used.length) setSuggested((s) => new Set([...s, ...ans.used]));
        setHistory((h) => [...h, { role: "assistant", text: ans.text }]);
      } else {
        const j = await resp.json();
        const text: string | undefined = j?.answer;
        if (text && text.trim()) {
          setHistory((h) => [...h, { role: "assistant", text }]);
        } else {
          const more = MORE_RE.test(q);
          const ans = offlineAnswer(q, data, cursor + (more ? 2 : 0), suggested);
          setCursor((v) => v + (more ? 2 : 1));
          if (ans.used.length) setSuggested((s) => new Set([...s, ...ans.used]));
          setHistory((h) => [...h, { role: "assistant", text: ans.text }]);
        }
      }
    } catch {
      const more = MORE_RE.test(q);
      const ans = offlineAnswer(q, data!, cursor + (more ? 2 : 0), suggested);
      setCursor((v) => v + (more ? 2 : 1));
      if (ans.used.length) setSuggested((s) => new Set([...s, ...ans.used]));
      setHistory((h) => [...h, { role: "assistant", text: ans.text }]);
    } finally {
      setLoading(false);
    }
  }

  // quick replies da JSON oppure default
  const chips = (quickReplies && quickReplies.length
    ? quickReplies
    : ["Consigli piccanti", "Senza lattosio", "Vegetariano", "Promo del giorno", "Orari di apertura"]
  );

  // CTA da JSON oppure default
  const actions: CTA[] = (ctas && ctas.length
    ? ctas
    : [{ type: "call", label: "Chiama" }, { type: "directions", label: "Indicazioni" }]
  );

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-[60] inline-flex items-center gap-2 rounded-full px-4 py-2 shadow-lg border border-slate-200"
        style={{ background: "var(--accent)", color: "var(--accentText)" }}
        aria-label={resolvedButtonLabel}
      >
        <MessageCircle className="inline w-5 h-5" />
        {resolvedButtonLabel}
      </button>

      {/* PANEL */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative m-3 w-[min(680px,100%)] sm:w-[520px] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-white/70 backdrop-blur flex items-center justify-between">
              <div className="font-semibold">{resolvedPanelTitle}</div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick prompts */}
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {chips.map((p) => (
                <button
                  key={p}
                  className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-sm hover:bg-slate-100"
                  onClick={() => { setInput(p); setTimeout(onSend, 0); }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="px-4 py-3 h-72 overflow-y-auto space-y-2">
              {history.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[80%] rounded-2xl px-3 py-2 bg-[var(--accent)] text-[var(--accentText)]"
                      : "mr-auto max-w-[85%] rounded-2xl px-3 py-2 bg-slate-100"
                  }
                >
                  {m.text}
                </div>
              ))}
              {loading && <div className="text-sm text-slate-500">Sto pensando…</div>}
            </div>

            {/* CTA row (config da JSON) */}
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              {actions.map((a, i) => {
                if (a.type === "call") {
                  return (
                    <a key={i} href={telHref(phone)} className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-200 hover:bg-slate-50 text-sm">
                      <Phone className="w-4 h-4" /> {a.label}
                    </a>
                  );
                }
                if (a.type === "directions") {
                  return (
                    <a key={i} href={mapsUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-200 hover:bg-slate-50 text-sm">
                      <MapPin className="w-4 h-4" /> {a.label}
                    </a>
                  );
                }
                if (a.type === "whatsapp") {
                  return (
                    <a key={i} href={waHref(whatsapp, whatsDefaultMsg || "")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-200 hover:bg-slate-50 text-sm">
                      <MessageCircle className="w-4 h-4" /> {a.label}
                    </a>
                  );
                }
                // generic external link
                return (
                  <a key={i} href={a.url || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-200 hover:bg-slate-50 text-sm">
                    {a.label}
                  </a>
                );
              })}
            </div>

            {/* Input + send (allineamento fix) */}
            <div className="px-4 pb-4 flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
                placeholder="Scrivi una domanda…"
                className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 h-11 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),white_70%)]"
              />
              <button
                onClick={onSend}
                disabled={loading || !input.trim()}
                className="shrink-0 inline-flex items-center justify-center gap-1 px-3 h-11 rounded-xl text-[var(--accentText)] disabled:opacity-60"
                style={{ background: "var(--accent)" }}
                aria-label="Invia messaggio"
              >
                <SendHorizonal className="w-4 h-4" />
                <span>Invia</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
