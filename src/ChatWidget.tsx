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
type CTAType = "call" | "directions" | "whatsapp" | "link";
type CTA = { type: CTAType; label: string; url?: string };

type CtaJson = { type: CTAType; label: string; href?: string; url?: string };

type MenuJson = {
  config?: {
    name?: string;
    phone?: string;
    whatsapp?: string;
    hours?: string;
    address?: string;
    assistantLabel?: string;
    mapUrl?: string;
    chat?: {
      quickReplies?: string[];
      faq?: Record<string, string>;
      ctas?: CtaJson[];
    };
  };
  menu?: { specials?: { title: string; price?: string }[]; categories?: Category[] };
  story?: { title?: string; text?: string } | null;
  about?: { title?: string; text?: string } | null; // home comunale
  chat?: {
    quickReplies?: string[];
    faq?: Record<string, string>;
    ctas?: CtaJson[];
  };
  municipal?: {
    hoursShort?: string;
    address?: string;
    contacts?: any;
    notes?: string;
  } | null;
};

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
  return { veg: /veg(etar(i|)ano)?|senza carne/.test(t), nolactose: /senza lattos|lattosio/.test(t), spicy: /piccant|diavol/.test(t) };
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
  for (const c of cats) for (const it of (c.items || [])) if (itemMatchesFilters(it, f)) all.push(it);
  const fresh = all.filter((it) => !exclude.has(it.name));
  if (!f.veg && !f.nolactose && !f.spicy) return fresh.sort((a, b) => Number(!!b.fav) - Number(!!a.fav) || a.name.localeCompare(b.name));
  return fresh.sort((a, b) => a.name.localeCompare(b.name) || (a.price ?? 0) - (b.price ?? 0));
}
function formatItem(i: MenuItem){ return i.price!=null ? `${i.name} — ${i.price!.toFixed(2)} €` : i.name; }

function telHref(t?: string){ return t ? `tel:${String(t).replace(/\s|\+/g, "")}` : "#"; }
function waHref(t?: string,msg=""){ if(!t) return "#"; const p=String(t).replace(/\D/g,""); return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`; }
function normalizeCtas(src?: CtaJson[]): CTA[] {
  if (!Array.isArray(src)) return [];
  return src
    .filter((c) => c && c.label && c.type)
    .map((c) => ({ type: c.type, label: c.label, url: c.url || c.href }))
    .filter((c) => !!c.label);
}

/** -------- Intent helpers -------- */
function isAddressIntent(q: string): boolean {
  const t = q.toLowerCase().trim();
  if (/\bindirizz/.test(t)) return true;
  if (/\bindicaz(ioni)?\b/.test(t)) return true;
  if (/\bcome\s+si\s+arriv/.test(t)) return true;
  if (/\bdove\s+(siamo|siete|si\s+trova|vi\s+trov\w*)\b/.test(t)) return true;
  return false;
}
function isHoursIntent(q: string): boolean {
  const t = norm(q);
  return /\b(orar?\w*|apertur\w*|chiusur\w*|quando\s+siete\s+aperti)\b/.test(t);
}
function isContactIntent(q: string): boolean {
  const t = norm(q);
  if (/\b(contatt\w*|telefono|tel\.?|chiama\w*|whatsapp|cellular\w*|cell|phone|telephone|recapit\w*)\b/.test(t)) return true;
  if (/\bnumero(\s+di)?\s+(telefono|cellulare)\b/.test(t)) return true;
  return false;
}
function isStoryIntent(q: string): boolean {
  const t = norm(q);
  return /\b(storia|chi siamo|about)\b/.test(t);
}
function isServicesIntent(q: string): boolean {
  const t = norm(q);
  return /\b(serviz\w*|prodott\w*|catalog\w*|listin\w*|menu|menu)\b/.test(t);
}

/** ---- Contacts extraction (config + municipal.contacts) ---- */
function firstString(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}
function extractContacts(data: MenuJson): { phone?: string; whatsapp?: string } {
  const cfg = data?.config || {};
  const muni = (data as any)?.municipal || {};
  const mC = muni?.contacts || {};

  const phone =
    cfg.phone ||
    firstString(mC, [
      "phone", "telefono", "tel", "mobile", "cell", "cellulare", "phoneNumber",
      "switchboard", "centralino", "centralinoComune", "numeroTelefono", "numero"
    ]) ||
    (() => {
      try {
        const vals = Object.values(mC) as any[];
        for (const v of vals) {
          if (typeof v === "string") {
            const digits = v.replace(/\D/g, "");
            if (digits.length >= 5) return v.trim();
          }
        }
      } catch {}
      return undefined;
    })();

  const whatsapp =
    cfg.whatsapp ||
    firstString(mC, ["whatsapp", "wa", "numeroWhatsapp", "whatsApp"]);

  return { phone, whatsapp };
}

/** -------- Topic engine -------- */
function topicAnswer(topicRaw: string, data: MenuJson): string | null {
  const topic = norm(topicRaw);
  const faqRoot = data.chat?.faq || {};
  const faqNested = (data as any)?.config?.chat?.faq || {};
  const faq = { ...faqRoot, ...faqNested };
  for (const k of Object.keys(faq)) {
    if (norm(k) === topic) return faq[k];
  }
  const cfg = data.config || {};
  if (isHoursIntent(topicRaw)) return cfg.hours ? `Orari: ${cfg.hours}` : "Gli orari non sono indicati.";
  if (isAddressIntent(topicRaw))
    return cfg.address ? `Indirizzo: ${cfg.address}. Per le indicazioni usa il pulsante qui sotto.` : "L'indirizzo non è indicato.";
  if (isContactIntent(topicRaw)) {
    const { phone, whatsapp } = extractContacts(data);
    const p = phone ? `Telefono: ${phone}` : "Telefono non indicato.";
    const w = whatsapp ? ` WhatsApp: ${whatsapp}` : "";
    return p + w;
  }
  if (isStoryIntent(topicRaw)) {
    const desc = (data.story?.text ?? (data as any)?.about?.text)?.trim();
    return desc || "Al momento non è stata inserita una descrizione.";
  }
  if (isServicesIntent(topicRaw)) {
    const cats = (data.menu?.categories || []);
    if (!cats.length) return "Non ho un elenco di servizi/prodotti pubblicato.";
    const names = cats.map(c=>c.name).slice(0,5).join(" • ");
    return `Posso mostrarti alcune categorie: ${names}. Scrivi una parola chiave oppure apri una categoria.`;
  }
  return null;
}

/** -------- Offline fallback -------- */
function offlineAnswer(
  q: string,
  data: MenuJson,
  cursor: number,
  already: Set<string>,
  hints: string[] = []
) {
  const cfg = data?.config || {};
  const tAns = topicAnswer(q, data);
  if (tAns) return { text: tAns, used: [], exhausted: false };

  if (isHoursIntent(q)) {
    const muni = (data as any)?.municipal;
    const base =
      (muni && muni.hoursShort) ? `Uffici comunali — ${muni.hoursShort}.`
      : (cfg.hours ? `Siamo aperti: ${cfg.hours}.` : "Gli orari non sono indicati.");
    const suffix = hints.length ? ` Prova uno dei tasti rapidi: ${hints.slice(0,3).join(" • ")}.` : "";
    return { text: base + suffix, used: [] as string[], exhausted: false };
  }

  if (isContactIntent(q)) {
    const { phone, whatsapp } = extractContacts(data);
    const parts: string[] = [];
    if (phone) parts.push(`Telefono: ${phone}`);
    if (whatsapp) parts.push(`WhatsApp: ${whatsapp}`);
    const base = parts.length ? parts.join(" — ") : "I contatti non sono indicati.";
    const suffix = hints.length ? ` Ti posso aiutare anche con: ${hints.slice(0,3).join(" • ")}.` : "";
    return { text: base + suffix, used: [] as string[], exhausted: false };
  }

  if (isAddressIntent(q)) {
    const muni = (data as any)?.municipal;
    const base =
      (muni && muni.address) ? `Uffici comunali: ${muni.address}.`
      : (cfg.address ? `Ci trovi in ${cfg.address}.` : "L'indirizzo non è indicato.");
    const suffix = hints.length ? ` Vuoi altro? ${hints.slice(0,3).join(" • ")}.` : "";
    return { text: base + suffix, used: [] as string[], exhausted: false };
  }

  const filters = parseFilters(q);
  const pool = buildCandidates(data, filters, already);

  if (!pool.length) {
    for (const c of data.menu?.categories || []) {
      const hit = (c.items || []).find((i) => {
        const nm = norm(i.name); const ds = norm(i.desc || "");
        const tt = norm(q);
        return nm.includes(tt) || ds.includes(tt);
      });
      if (hit) {
        return {
          text: hit.price!=null
            ? `${hit.name}: ${(hit.desc||"nessuna descrizione")}. Prezzo ${hit.price.toFixed(2)} €.`
            : `${hit.name}: ${(hit.desc||"nessuna descrizione")}.`,
          used: [hit.name], exhausted: false
        };
      }
    }
  }

  if (pool.length) {
    const first = pool[cursor % pool.length];
    const second = pool.length>1 ? pool[(cursor+1)%pool.length] : undefined;
    const items = [first, second].filter(Boolean) as MenuItem[];
    return {
      text: `Ciao, potrebbe interessarti: ${items.map(formatItem).join(" • ")}. Vuoi altre opzioni?`,
      used: items.map(x=>x.name), exhausted: false
    };
  }

  const example = hints.length
    ? ` Prova con un argomento tra quelli che vedi disponibili in chat: ${hints.slice(0,5).join(" • ")}.`
    : " Prova a scrivere una parola chiave (es. orari, indirizzo, servizi).";
  return { text: "Ciao, per ora non ho altre proposte." + example, used: [], exhausted: true };
}

/** -------- PERSISTENZA SESSIONE -------- */
const STORE_PREFIX = "sianoai_chat_";
const MAX_TURNS = 20;
function loadStored(slug: string): Msg[] {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + slug);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string");
  } catch { return []; }
}
function saveStored(slug: string, history: Msg[]) {
  try {
    const trimmed = history.slice(-MAX_TURNS);
    localStorage.setItem(STORE_PREFIX + slug, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

/** -------- FAB animations: pill-aware ripples (synced) -------- */
const FAB_STYLE_ID = "sianoai-fab-anim-pill-stable";
function ensureFabStyleInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FAB_STYLE_ID)) return;

  const css = `
  /* Motion */
  @keyframes fab-breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-1.5px) scale(1.06); } }
  @keyframes fab-sheen {
    0%   { transform: translateX(-420%) skewX(-18deg); }
    100% { transform: translateX( 420%) skewX(-18deg); }
  }

  /* Ripple con pausa finale: visibile fino al 40%, poi invisibile fino al 100% */
  @keyframes fab-ripple {
    0%   { transform: scale(0.88); opacity:.75; }  /* inizio */
    18%  { transform: scale(1.15); opacity:.40; }  /* espansione */
    30%  { transform: scale(1.25); opacity:0;   }  /* sparisce */
    100% { transform: scale(1.25); opacity:0;   }  /* pausa (invisibile) */
  }

  /* Guard: confina gli effetti; usa currentColor per i ripple */
  .sianoai-fab-guard{
    position:relative; display:inline-block;
    padding:20px 32px 20px 32px;
    border-radius:9999px;
    overflow:hidden;
    color: var(--accent, #c0163a);
     /* === controlli timing === */
    --fab-cycle: 2.2s;      /* durata parte “attiva” dei ripple */
    --fab-gap:   5s;        /* pausa globale desiderata */
    --fab-total: calc(var(--fab-cycle) + var(--fab-gap));
    --fab-stagger: calc(var(--fab-cycle) / 3); /* sfasamento solo sulla parte attiva */
  }

  /* Stage = dimensione bottone + respiro */
  .sianoai-fab-stage{
    position:relative; display:inline-block; border-radius:9999px;
    padding-block: 5px;     /* ↑/↓ espansione verticale cerchi */
    padding-inline: 5px;    /* ↑/↓ respiro laterale */
  }
  .sianoai-fab-stage *[data-layer]{ position:absolute; inset:-10px; border-radius:inherit; pointer-events:none; }

  /* Z-order */
  .sianoai-fab{ position:relative; z-index:6; }
  .sianoai-fab-anim{ animation: fab-breathe 4s ease-in-out infinite; will-change: transform; }

  /* RIPPLE (3 anelli sincronizzati) */
  .sianoai-fab-ring,
  .sianoai-fab-ringX{
  z-index:7; box-sizing:border-box; border:3px solid rgba(255,255,255,.9);
  border-color: currentColor;
  box-shadow: 0 0 12px currentColor, inset 0 0 6px currentColor;
  transform-origin: 50% 50%;
  animation-name: fab-ripple;
  animation-duration: var(--fab-total);     /* <-- totale = ciclo + pausa */
  animation-timing-function: ease-out;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
  }

  /*sfasamento parte attiva*/
  .sianoai-fab-ring[data-variant="1"]{ animation-delay: 0s; }
  .sianoai-fab-ring[data-variant="2"]{ animation-delay: calc(-1 * var(--fab-stagger)); }
  .sianoai-fab-ringX{                  animation-delay: calc(-2 * var(--fab-stagger)); }

  /* SHEEN (opzionale, disattivato nel markup) */
  .sianoai-fab-sheen{ position:absolute; inset:0; border-radius:9999px; overflow:hidden; z-index:9; pointer-events:none; }
  .sianoai-fab-sheen::before{
    content:""; position:absolute; top:0; bottom:0; width:56%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.60), transparent);
    filter: blur(1px);
    transform: translateX(-420%) skewX(-18deg);
    animation: fab-sheen 4.2s ease-in-out infinite;
  }

  .sianoai-fab:hover, .sianoai-fab:focus-visible { transform: translateY(-1px) scale(1.04); }

  @media (prefers-reduced-motion: reduce){
    .sianoai-fab-anim,
    .sianoai-fab-ring,
    .sianoai-fab-ringX,
    .sianoai-fab-sheen::before{ animation:none !important; }
    .sianoai-fab{ transition:none !important; }
  }`;

  const el = document.createElement("style");
  el.id = FAB_STYLE_ID;
  el.appendChild(document.createTextNode(css));
  document.head.appendChild(el);
}

/** -------- Component -------- */
export default function ChatWidget({
  slug, phone, mapsUrl, venueName, buttonLabel, panelTitle, quickReplies, ctas, whatsapp, whatsDefaultMsg,
  assistantLabel, assistantTitle, initialMessage
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [aiOnline, setAiOnline] = React.useState(true);
  const [dataVersion, setDataVersion] = React.useState(0);

  const [history, setHistory] = React.useState<Msg[]>([{
    role: "assistant",
    text:
      (initialMessage?.trim()) ||
      `Ciao! Sono l’assistente ${venueName ? `di ${venueName}` : "AI"}. Dimmi su cosa ti serve aiuto (orari, indirizzo, servizi/prodotti, o un argomento).`
  }]);
  const [cursor, setCursor] = React.useState(0);
  const [suggested, setSuggested] = React.useState<Set<string>>(new Set());

  const resolvedButtonLabel =
    (buttonLabel && buttonLabel.trim()) || (assistantLabel && assistantLabel.trim()) || "Chiedi all’assistente AI";
  const resolvedPanelTitle =
    (panelTitle && panelTitle.trim()) || (assistantTitle && assistantTitle.trim()) || (venueName ? `Assistente di ${venueName}` : "Assistente AI");

  const dataRef = React.useRef<MenuJson | undefined>(undefined);
  React.useEffect(() => {
    fetch(`/data/${slug}.json?ts=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { dataRef.current = j as MenuJson; setDataVersion(v => v + 1); })
      .catch(() => {});
  }, [slug]);

  // Persistenza sessione
  React.useEffect(() => {
    const stored = loadStored(slug);
    if (stored.length) setHistory(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  React.useEffect(() => { saveStored(slug, history); }, [slug, history]);

  // Inietta CSS animazioni
  React.useEffect(() => { ensureFabStyleInjected(); }, []);

  function getAIEndpoint(): string {
    const env = (import.meta as any)?.env;
    return (env && env.VITE_AI_ENDPOINT) ? env.VITE_AI_ENDPOINT : "/.netlify/functions/ask";
  }

  // ---------- Auto-scroll ----------
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = React.useMemo(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return false;
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  }, []);
  function scrollToBottom(immediate = false) {
    const el = listRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = (immediate || prefersReducedMotion) ? "auto" : "smooth";
    if (endRef.current?.scrollIntoView) endRef.current.scrollIntoView({ behavior, block: "end" });
    else el.scrollTo({ top: el.scrollHeight, behavior });
  }
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => scrollToBottom());
    return () => cancelAnimationFrame(id);
  }, [open, history, loading]);
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => scrollToBottom(true));
    return () => cancelAnimationFrame(id);
  }, [dataVersion]);

  // ---------- FAB offset vs sticky CTA ----------
  const [fabBottomOffset, setFabBottomOffset] = React.useState<number>(16);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const el = document.querySelector<HTMLElement>("[data-sticky-cta]");
    const compute = () => {
      if (!el) { setFabBottomOffset(16); return; }
      const rect = el.getBoundingClientRect();
      const visible = rect.height > 0 && getComputedStyle(el).display !== "none";
      const h = visible ? Math.round(rect.height) : 0;
      setFabBottomOffset(Math.max(16, h + 12));
    };

    compute();

    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => compute());
      if (el) ro.observe(el);
    } catch {}

    const onResize = () => compute();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (ro && el) ro.disconnect();
    };
  }, []);

  // ---------- Mobile FAB auto-hide near bottom ----------
  const [hideFab, setHideFab] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const check = () => {
      if (!mq.matches) { setHideFab(false); return; }
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= (doc.scrollHeight - 120);
      setHideFab(atBottom);
    };
    check();
    const onScroll = () => { requestAnimationFrame(check); };
    const onResize = () => { requestAnimationFrame(check); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  async function onSend() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setHistory((h) => [...h, { role: "user", text: q }]);

    const data = dataRef.current;
    const hints = (quickReplies && quickReplies.length
      ? quickReplies
      : (data?.chat?.quickReplies ||
         data?.config?.chat?.quickReplies ||
         [])
    ) as string[];

    // MICRO-FIX home: orari Comune
    if (data && slug === "home" && isHoursIntent(q)) {
      const t = norm(q);
      const wantsMunicipal = /\b(comune|municip|uffic)\w*\b/.test(t);
      const muni = (data as any)?.municipal;
      if (wantsMunicipal && muni?.hoursShort) {
        const txt = `Orari uffici comunali: ${muni.hoursShort}.`;
        setHistory((h) => [...h, { role: "assistant", text: txt }]);
        return;
      }
    }

    const predefined = (data && slug !== "home") ? topicAnswer(q, data) : null;
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
      const recent = history.slice(-MAX_TURNS).map(m => ({ role: m.role, text: m.text }));
      const payload = isNetlify ? { slug, question: q, history: recent } : { question: q, data, history: recent };

      const resp = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

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
      const dataLocal = dataRef.current || { menu: { categories: [] } as any };
      const more = MORE_RE.test(q);
      const ans = offlineAnswer(q as any, dataLocal as any, cursor + (more ? 2 : 0), suggested, []);
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
      : (dataRef.current?.chat?.quickReplies ||
         dataRef.current?.config?.chat?.quickReplies ||
         ["Informazioni", "Orari e contatti", "Servizi", "Dove siamo", "Novità"])) || [];

  const actions: CTA[] = React.useMemo(() => {
    if (ctas && ctas.length) return ctas;

    const data = dataRef.current;

    if (data?.chat?.ctas && data.chat.ctas.length) {
      return normalizeCtas(data.chat.ctas);
    }
    if (data?.config?.chat?.ctas && data.config.chat.ctas.length) {
      return normalizeCtas(data.config.chat.ctas);
    }

    if (slug === "home") return [];
    const cfg = data?.config || {};
    const list: CTA[] = [];
    if (cfg.phone) list.push({ type: "call", label: "Chiama" });
    if ((cfg as any).whatsapp) list.push({ type: "whatsapp", label: "WhatsApp" });
    if (cfg.address || cfg.mapUrl) list.push({ type: "directions", label: "Indicazioni" });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctas, dataVersion, slug]);

  const outlineCobalt: React.CSSProperties = {
    borderColor: "rgba(0,0,0,0.08)",
    color: "var(--accent)",
    background: "var(--card)",
  };

  const chipStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.03)",
    borderColor: "rgba(0,0,0,0.08)",
    color: "var(--text)",
  };

  return (
    <>
      {/* FAB con effetti */}
      {!open && (
        <div
          className={`fixed right-4 z-[9999] ${hideFab ? "pointer-events-none opacity-0 translate-y-6" : "opacity-100 translate-y-0"}`}
          style={{ position: "fixed", bottom: `calc(env(safe-area-inset-bottom, 0px) + ${fabBottomOffset}px)` }}
        >
          <div className="sianoai-fab-guard">
            <div className="sianoai-fab-stage">
              {/* Bottone */}
              <button
                onClick={() => setOpen(true)}
                className="sianoai-fab sianoai-fab-anim inline-flex items-center gap-2 rounded-full px-4 py-2 shadow-lg border transition-all duration-200"
                style={{
                  background: "var(--accent)",
                  color: "var(--accentText)",
                  borderColor: "rgba(0,0,0,0.08)",
                  transformOrigin: "center",
                }}
                aria-label={resolvedButtonLabel}
              >
                <MessageCircle className="inline w-5 h-5" />
                {resolvedButtonLabel}
                {/* sheen disabilitato */}
                {/* <span aria-hidden="true" className="sianoai-fab-sheen" /> */}
              </button>
              {/* 3 ripple pill-shaped sincronizzati */}
              <span aria-hidden="true" className="sianoai-fab-ring" data-layer data-variant="1" />
              <span aria-hidden="true" className="sianoai-fab-ring" data-layer data-variant="2" />
              <span aria-hidden="true" className="sianoai-fab-ringX" data-layer />
            </div>
          </div>
        </div>
      )}

      {/* PANEL */}
      {open && (
        <div
          className="fixed inset-0 z-[9998] flex items-end sm:items-center sm:justify-end"
          role="dialog" aria-modal="true" aria-label={resolvedPanelTitle}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="relative m-3 w-[min(680px,100%)] sm:w-[520px] rounded-2xl border shadow-2xl overflow-hidden"
            style={{ background:"var(--card)", borderColor:"var(--border)" }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor:"var(--border)", background:"var(--glass)" }}>
              <div className="font-semibold flex items-center gap-2" style={{color:"var(--text)"}}>
                {resolvedPanelTitle}
                {!aiOnline && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{background:"var(--accent-10)", color:"var(--accent)"}}
                        title="Il modello AI non è raggiungibile: risposte locali attive">
                    <AlertTriangle className="w-3 h-3" /> AI offline
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg border hover:opacity-90"
                      style={{borderColor:"var(--border)", background:"var(--card)", color:"var(--text)"}} aria-label="Chiudi">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick prompts */}
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {chips.map((p: string) => (
                <button
                  key={p}
                  className="px-3 py-1.5 rounded-full border text-sm hover:opacity-95 focus:outline-none focus:ring-2 transition-colors font-medium"
                  style={{ ...chipStyle, boxShadow: "0 1px 0 rgba(0,0,0,0.02)" }}
                  onClick={() => { setInput(p); setTimeout(onSend, 0); }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,0,0,.08)")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "0 1px 0 rgba(0,0,0,0.02)")}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="px-4 py-3 h-72 overflow-y-auto space-y-2"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {history.map((m, i) => (
                <div key={i}
                  className={m.role === "user"
                    ? "ml-auto max-w-[80%] rounded-2xl px-3 py-2"
                    : "mr-auto max-w-[85%] rounded-2xl px-3 py-2 border"}
                  style={m.role === "user"
                    ? { background:"var(--accent)", color:"var(--accentText)" }
                    : { background:"var(--card)", color:"var(--text)", borderColor:"var(--border)" }}
                >
                  {m.text}
                </div>
              ))}
              {loading && <div className="text-sm" style={{color:"var(--textSoft)"}}>Sto pensando…</div>}
              <div ref={endRef} />
            </div>

            {/* CTA row */}
            {actions.length > 0 && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap">
                {actions.map((a, i) => {
                  if (a.type === "call") {
                    return (
                      <a key={i} href={telHref(phone || dataRef.current?.config?.phone)} className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm hover:opacity-90"
                         style={outlineCobalt}>
                        <Phone className="w-4 h-4" /> {a.label}
                      </a>
                    );
                  }
                  if (a.type === "directions") {
                    const cfg = dataRef.current?.config;
                    const map = (cfg?.mapUrl) || mapsUrl || "#";
                    return (
                      <a key={i} href={map} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm hover:opacity-90"
                         style={outlineCobalt}>
                        <MapPin className="w-4 h-4" /> {a.label}
                      </a>
                    );
                  }
                  if (a.type === "whatsapp") {
                    const wa = dataRef.current?.config?.whatsapp || whatsapp;
                    return (
                      <a key={i} href={waHref(wa, whatsDefaultMsg || "")} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-2 px-3 py-2 rounded text-sm"
                         style={{background:"var(--accent)", color:"var(--accentText)", boxShadow:"0 6px 24px -6px rgba(0,0,0,0.25)"}}>
                        <MessageCircle className="w-4 h-4" /> {a.label}
                      </a>
                    );
                  }
                  return (
                    <a key={i} href={a.url || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm hover:opacity-90"
                       style={outlineCobalt}>
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
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
                placeholder="Scrivi una domanda…"
                className="flex-1 min-w-0 rounded-xl px-3 h-11 border focus:outline-none"
                style={{ borderColor:"var(--border)", background:"var(--card)", color:"var(--text)" }}
              />
              <button
                onClick={onSend}
                disabled={loading || !input.trim()}
                className="shrink-0 inline-flex items-center justify-center gap-1 px-3 h-11 rounded-xl disabled:opacity-60"
                style={{ background: "var(--accent)", color:"var(--accentText)" }}
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