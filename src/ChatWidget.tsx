// ChatWidget.tsx
import React from "react";
import {
  MessageCircle,
  X,
  SendHorizonal,
  Phone,
  MapPin,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

/** -------- Types (extended) -------- */
type MenuItem = { name: string; desc?: string; price?: number; tags?: string[]; fav?: boolean };
type Category = { name: string; items: MenuItem[] };
type MenuJson = {
  config?: {
    name?: string;
    phone?: string;
    whatsapp?: string;
    hours?: string;
    address?: string;
    assistantLabel?: string;
    mapUrl?: string;
  };
  menu?: { specials?: { title: string; price?: string }[]; categories?: Category[] };
  story?: { title?: string; text?: string } | null;
  chat?: {
    quickReplies?: string[];
    faq?: Record<string, string>;
    /** opzionale: bottoni azione */
    ctas?: Array<{ type: "link" | "call" | "directions" | "whatsapp"; label: string; href?: string; url?: string }>;
  };
};

type CTAType = "call" | "directions" | "whatsapp" | "link";
type CTA = { type: CTAType; label: string; url?: string };

type Props = {
  slug: string;
  phone?: string;
  mapsUrl?: string;
  venueName?: string;
  buttonLabel?: string;
  panelTitle?: string;
  quickReplies?: string[];
  ctas?: CTA[];
  whatsapp?: string;
  whatsDefaultMsg?: string;
  assistantLabel?: string;
  assistantTitle?: string;
  initialMessage?: string;
};

type Msg = { role: "user" | "assistant"; text: string };

const MORE_RE = /^(si|sì|ok|va bene|quali|quale|altri|altre|altro|ancora|poi|dimmi|cos'?altro)\b/i;

/** -------- Small helpers -------- */
type Filters = { veg?: boolean; nolactose?: boolean; spicy?: boolean };
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "").trim();

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
  for (const c of cats) for (const it of c.items || []) if (itemMatchesFilters(it, f)) all.push(it);
  const fresh = all.filter((it) => !exclude.has(it.name));
  if (!f.veg && !f.nolactose && !f.spicy) return fresh.sort((a, b) => Number(!!b.fav) - Number(!!a.fav) || a.name.localeCompare(b.name));
  return fresh.sort((a, b) => a.name.localeCompare(b.name) || (a.price ?? 0) - (b.price ?? 0));
}
function formatItem(i: MenuItem) {
  return i.price != null ? `${i.name} — ${i.price!.toFixed(2)} €` : i.name;
}

function telHref(t?: string) {
  return t ? `tel:${String(t).replace(/\s|\+/g, "")}` : "#";
}
function waHref(t?: string, msg = "") {
  if (!t) return "#";
  const p = String(t).replace(/\D/g, "");
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

/** -------- Topic engine -------- */
function topicAnswer(topicRaw: string, data: MenuJson): string | null {
  const topic = norm(topicRaw);
  const faq = data.chat?.faq || ((data as any)?.config?.chat?.faq) || {};
  for (const k of Object.keys(faq)) {
    if (norm(k) === topic) return faq[k];
  }
  const cfg = data.config || {};
  if (/orari|apertur|chiusur/.test(topic)) return cfg.hours ? `Orari: ${cfg.hours}` : "Gli orari non sono indicati.";
  if (/indirizz|dove|come si arriv|indicaz/.test(topic))
    return cfg.address ? `Indirizzo: ${cfg.address}. Per le indicazioni usa il pulsante qui sotto.` : "L'indirizzo non è indicato.";
  if (/contatt|telefono|chiama|whatsapp/.test(topic)) {
    const p = cfg.phone ? `Telefono: ${cfg.phone}` : "Telefono non indicato.";
    const w = (cfg as any).whatsapp ? ` WhatsApp: ${(cfg as any).whatsapp}` : "";
    return p + w;
  }
  if (/storia|chi siamo|about/.test(topic)) return data.story?.text?.trim() || "Al momento non è stata inserita una descrizione.";
  if (/serviz|prodott|catalogo|listino|menu/.test(topic)) {
    const cats = data.menu?.categories || [];
    if (!cats.length) return "Non ho un elenco di servizi/prodotti pubblicato.";
    const names = cats.map((c) => c.name).slice(0, 5).join(" • ");
    return `Posso mostrarti alcune categorie: ${names}. Scrivi una parola chiave oppure apri una categoria.`;
  }
  return null;
}

/** -------- Offline fallback -------- */
function offlineAnswer(q: string, data: MenuJson, cursor: number, already: Set<string>, hints: string[] = []) {
  const t = q.toLowerCase();
  const cfg = data?.config || {};
  const tAns = topicAnswer(q, data);
  if (tAns) return { text: tAns, used: [], exhausted: false };

  if (/orari|apertur|chiusur/.test(t)) {
    const base = cfg.hours ? `Siamo aperti: ${cfg.hours}.` : "Gli orari non sono indicati.";
    const suffix = hints.length ? ` Prova uno dei tasti rapidi: ${hints.slice(0, 3).join(" • ")}.` : "";
    return { text: base + suffix, used: [] as string[], exhausted: false };
  }
  if (/dove|indirizz|come (si )?arriv|indicazioni/.test(t)) {
    const base = cfg.address ? `Ci trovi in ${cfg.address}.` : "L'indirizzo non è indicato.";
    const suffix = hints.length ? ` Vuoi altro? ${hints.slice(0, 3).join(" • ")}.` : "";
    return { text: base + suffix, used: [] as string[], exhausted: false };
  }

  const filters = parseFilters(t);
  const pool = buildCandidates(data, filters, already);

  if (!pool.length) {
    for (const c of data.menu?.categories || []) {
      const hit = (c.items || []).find((i) => {
        const nm = norm(i.name);
        const ds = norm(i.desc || "");
        const tt = norm(q);
        return nm.includes(tt) || ds.includes(tt);
      });
      if (hit) {
        return {
          text:
            hit.price != null
              ? `${hit.name}: ${hit.desc || "nessuna descrizione"}. Prezzo ${hit.price.toFixed(2)} €.`
              : `${hit.name}: ${hit.desc || "nessuna descrizione"}.`,
          used: [hit.name],
          exhausted: false,
        };
      }
    }
  }

  if (pool.length) {
    const first = pool[cursor % pool.length];
    const second = pool.length > 1 ? pool[(cursor + 1) % pool.length] : undefined;
    const items = [first, second].filter(Boolean) as MenuItem[];
    return {
      text: `Potrebbe interessarti: ${items.map(formatItem).join(" • ")}. Vuoi altre opzioni?`,
      used: items.map((x) => x.name),
      exhausted: false,
    };
  }

  const example = hints.length ? ` Prova con un argomento tra: ${hints.slice(0, 3).join(" • ")}.` : " Prova a scrivere una parola chiave (es. orari, indirizzo, servizi).";
  return { text: "Per ora non ho altre proposte." + example, used: [], exhausted: true };
}

/** -------- Component -------- */
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
  assistantLabel,
  assistantTitle,
  initialMessage,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [aiOnline, setAiOnline] = React.useState(true);
  const [dataVersion, setDataVersion] = React.useState(0);

  const [history, setHistory] = React.useState<Msg[]>([
    {
      role: "assistant",
      text:
        initialMessage?.trim() ||
        `Ciao! Sono l’assistente ${venueName ? `di ${venueName}` : "AI"}. Dimmi su cosa ti serve aiuto (orari, indirizzo, servizi/prodotti, o un argomento).`,
    },
  ]);
  const [cursor, setCursor] = React.useState(0);
  const [suggested, setSuggested] = React.useState<Set<string>>(new Set());

  const resolvedButtonLabel = (buttonLabel && buttonLabel.trim()) || (assistantLabel && assistantLabel.trim()) || "Chiedi all’assistente AI";
  const resolvedPanelTitle =
    (panelTitle && panelTitle.trim()) || (assistantTitle && assistantTitle.trim()) || (venueName ? `Assistente di ${venueName}` : "Assistente AI");

  const dataRef = React.useRef<MenuJson | undefined>(undefined);
  React.useEffect(() => {
    fetch(`/data/${slug}.json?ts=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        dataRef.current = j as MenuJson;
        setDataVersion((v) => v + 1);
      })
      .catch(() => {});
  }, [slug]);

  function getAIEndpoint(): string {
    const env = (import.meta as any)?.env;
    return env?.VITE_AI_ENDPOINT ? env.VITE_AI_ENDPOINT : "/.netlify/functions/ask";
  }

  async function onSend() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setHistory((h) => [...h, { role: "user", text: q }]);

    const data = dataRef.current;

    const hints = ((quickReplies && quickReplies.length ? quickReplies : data?.chat?.quickReplies || ((data as any)?.config?.chat?.quickReplies) || []) ??
      []) as string[];

    const predefined = data ? topicAnswer(q, data) : null;
    if (predefined) {
      setHistory((h) => [...h, { role: "assistant", text: predefined }]);
      return;
    }

    if (!data) {
      const more = MORE_RE.test(q);
      const ans = offlineAnswer(q, { menu: { categories: [] } }, cursor + (more ? 2 : 0), suggested, hints);
      setCursor((v) => v + (more ? 2 : 1));
      if (ans.used.length) setSuggested((s) => new Set([...s, ...ans.used]));
      setHistory((h) => [...h, { role: "assistant", text: ans.text }]);
      setAiOnline(false);
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
        const more = MORE_RE.test(q);
        const ans = offlineAnswer(q, data, cursor + (more ? 2 : 0), suggested, hints);
        setCursor((v) => v + (more ? 2 : 1));
        if (ans.used.length) setSuggested((s) => new Set([...s, ...ans.used]));
        setHistory((h) => [...h, { role: "assistant", text: ans.text }]);
        setAiOnline(false);
      } else {
        const j = await resp.json();
        const text: string | undefined = j?.answer;
        if (text && text.trim()) {
          setHistory((h) => [...h, { role: "assistant", text }]);
          setAiOnline(true);
        } else {
          const more = MORE_RE.test(q);
          const ans = offlineAnswer(q, data, cursor + (more ? 2 : 0), suggested, hints);
          setCursor((v) => v + (more ? 2 : 1));
          if (ans.used.length) setSuggested((s) => new Set([...s, ...ans.used]));
          setHistory((h) => [...h, { role: "assistant", text: ans.text }]);
          setAiOnline(false);
        }
      }
    } catch {
      const data = dataRef.current || ({ menu: { categories: [] } } as any);
      const more = MORE_RE.test(q);
      const ans = offlineAnswer(q as any, data as any, cursor + (more ? 2 : 0), suggested, []);
      setCursor((v) => v + (more ? 2 : 1));
      if (ans.used.length) setSuggested((s) => new Set([...s, ...ans.used]));
      setHistory((h) => [...h, { role: "assistant", text: ans.text }]);
      setAiOnline(false);
    } finally {
      setLoading(false);
    }
  }

  const chips: string[] =
    (quickReplies && quickReplies.length
      ? quickReplies
      : dataRef.current?.chat?.quickReplies || ((dataRef.current as any)?.config?.chat?.quickReplies) || ["Informazioni", "Orari e contatti", "Servizi", "Dove siamo", "Novità"]) || [];

  // CTA priority: props.ctas > json.chat.ctas > (config-derivate) > []
  const actions: CTA[] = React.useMemo(() => {
    if (ctas && ctas.length) return ctas;

    const data = dataRef.current;
    if (data?.chat?.ctas && data.chat.ctas.length) {
      return data.chat.ctas.map((c) => ({
        type: c.type as CTAType,
        label: c.label,
        url: c.url || c.href,
      }));
    }

    const cfg = data?.config || {};
    const list: CTA[] = [];
    if (cfg.phone) list.push({ type: "call", label: "Chiama" });
    if ((cfg as any).whatsapp) list.push({ type: "whatsapp", label: "WhatsApp" });
    if (cfg.address || cfg.mapUrl) list.push({ type: "directions", label: "Indicazioni" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctas, dataVersion]);

  // stile outline cobalt riutilizzabile
  const outlineCobalt: React.CSSProperties = {
    borderColor: "color-mix(in_oklab,var(--accent),white 72%)",
    color: "var(--accent)",
    background: "var(--card)",
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-[9999] inline-flex items-center gap-2 rounded-full px-4 py-2 shadow-lg border"
        style={{ background: "var(--accent)", color: "var(--accentText)", borderColor: "color-mix(in_oklab,var(--accent),white 60%)" }}
        aria-label={resolvedButtonLabel}
      >
        <MessageCircle className="inline w-5 h-5" />
        {resolvedButtonLabel}
      </button>

      {/* PANEL */}
      {open && (
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center sm:justify-end" role="dialog" aria-modal="true" aria-label={resolvedPanelTitle}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative m-3 w-[min(680px,100%)] sm:w-[520px] rounded-2xl border shadow-2xl overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--glass)" }}>
              <div className="font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}>
                {resolvedPanelTitle}
                {!aiOnline && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--accent-10)", color: "var(--accent)" }}
                    title="Il modello AI non è raggiungibile: risposte locali attive"
                  >
                    <AlertTriangle className="w-3 h-3" /> AI offline
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg border hover:opacity-90"
                style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}
                aria-label="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick prompts */}
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {chips.map((p: string) => (
                <button
                  key={p}
                  className="px-3 py-1.5 rounded-full border text-sm hover:opacity-90"
                  style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--text)" }}
                  onClick={() => {
                    setInput(p);
                    setTimeout(onSend, 0);
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="px-4 py-3 h-72 overflow-y-auto space-y-2" role="log" aria-live="polite" aria-relevant="additions">
              {history.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user" ? "ml-auto max-w-[80%] rounded-2xl px-3 py-2" : "mr-auto max-w-[85%] rounded-2xl px-3 py-2 border"
                  }
                  style={
                    m.role === "user"
                      ? { background: "var(--accent)", color: "var(--accentText)" }
                      : { background: "var(--card)", color: "var(--text)", borderColor: "var(--border)" }
                  }
                >
                  {m.text}
                </div>
              ))}
              {loading && (
                <div className="text-sm" style={{ color: "var(--textSoft)" }}>
                  Sto pensando…
                </div>
              )}
            </div>

            {/* CTA row */}
            {actions.length > 0 && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap">
                {actions.map((a, i) => {
                  if (a.type === "call") {
                    return (
                      <a
                        key={i}
                        href={telHref(phone || dataRef.current?.config?.phone)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm hover:opacity-90"
                        style={outlineCobalt}
                      >
                        <Phone className="w-4 h-4" /> {a.label}
                      </a>
                    );
                  }
                  if (a.type === "directions") {
                    const cfg = dataRef.current?.config;
                    const map = cfg?.mapUrl || mapsUrl || "#";
                    return (
                      <a
                        key={i}
                        href={map}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm hover:opacity-90"
                        style={outlineCobalt}
                      >
                        <MapPin className="w-4 h-4" /> {a.label}
                      </a>
                    );
                  }
                  if (a.type === "whatsapp") {
                    const wa = dataRef.current?.config?.whatsapp || whatsapp;
                    return (
                      <a
                        key={i}
                        href={waHref(wa, whatsDefaultMsg || "")}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded text-sm"
                        style={{
                          background: "var(--accent)",
                          color: "var(--accentText)",
                          boxShadow: "0 6px 24px -6px color-mix(in_oklab,var(--accent),transparent 70%)",
                        }}
                      >
                        <MessageCircle className="w-4 h-4" /> {a.label}
                      </a>
                    );
                  }
                  // link (Sito, Open Data) — outline cobalto come gli altri
                  return (
                    <a
                      key={i}
                      href={a.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm hover:opacity-90"
                      style={outlineCobalt}
                    >
                      <ExternalLink className="w-4 h-4" /> {a.label}
                    </a>
                  );
                })}
              </div>
            )}

            {/* Input + send */}
            <div className="px-4 pb-4 flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Scrivi una domanda…"
                className="flex-1 min-w-0 rounded-xl px-3 h-11 border focus:outline-none"
                style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}
              />
              <button
                onClick={onSend}
                disabled={loading || !input.trim()}
                className="shrink-0 inline-flex items-center justify-center gap-1 px-3 h-11 rounded-xl disabled:opacity-60"
                style={{ background: "var(--accent)", color: "var(--accentText)" }}
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
