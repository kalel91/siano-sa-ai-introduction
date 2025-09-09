import React from "react";
import ChatWidget from "./ChatWidget";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MessageCircle, MapPin, Clock, Search, Star, UtensilsCrossed } from "lucide-react";

/** Types */
type Config = {
  name: string;
  tagline?: string;
  address?: string;
  mapUrl?: string;
  hours?: string;
  phone?: string;
  whatsapp?: string;
  whatsDefaultMsg?: string;
  heroImages?: string[];
  lastUpdated?: string;
  footerNote?: string;
  assistantLabel?: string; // opzionale: se presente sovrascrive la label del bottone
  theme?: {
    accent?: string; accentText?: string; bgFrom?: string; bgTo?: string;
    radius?: string; fontUrl?: string; fontFamily?: string; cssUrl?: string;
  };
};
type MenuItem = { name: string; desc?: string; price: number; tags?: string[]; img?: string; fav?: boolean };
type Category = { name: string; items: MenuItem[] };
type Menu = { specials?: { title: string; price: string; badge?: string }[]; categories: Category[] };
type Story = { title?: string; text?: string } | null;

/** Utils */
function telHref(t?: string){ return t ? `tel:${t.replace(/\s|\+/g,"").trim()}` : "#"; }
function waHref(t?: string,msg=""){ if(!t) return "#"; const p=t.replace(/\D/g,""); return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`; }
function getSlug(): string {
  const raw = location.pathname.replace(/\/+$/,"").split("/").filter(Boolean).pop() || "il-pirata";
  const cleaned = raw.toLowerCase().match(/[a-z0-9-]+/g)?.join("-") || "il-pirata";
  return cleaned;
}
function applyTheme(t?: Config["theme"]){
  const root = document.documentElement.style;
  root.setProperty("--accent", t?.accent || "#0f766e");
  root.setProperty("--accentText", t?.accentText || "#ffffff");
  root.setProperty("--bgFrom", t?.bgFrom || "#ecfeff");
  root.setProperty("--bgTo", t?.bgTo || "#f0fdfa");
  root.setProperty("--radius", t?.radius || "14px");
  if (t?.fontUrl){
    let link = document.getElementById("venue-font") as HTMLLinkElement | null;
    if(!link){ link=document.createElement("link"); link.id="venue-font"; link.rel="stylesheet"; document.head.appendChild(link); }
    link.href=t.fontUrl;
    let style=document.getElementById("venue-font-style") as HTMLStyleElement | null;
    if(!style){ style=document.createElement("style"); style.id="venue-font-style"; document.head.appendChild(style); }
    style.textContent=`body{font-family:${t.fontFamily || "system-ui"};}`;
  }
  if (t?.cssUrl){
    let link2=document.getElementById("venue-css") as HTMLLinkElement | null;
    if(!link2){ link2=document.createElement("link"); link2.id="venue-css"; link2.rel="stylesheet"; document.head.appendChild(link2); }
    link2.href=t.cssUrl;
  }
}

/** Articolo automatico per il bottone: "Chiedi al/allo/alla/all’/ai/agli/alle <nome>" oppure "Chiedi a <nome>" */
function makeAskLabel(venueName: string): string {
  const name = (venueName || "").trim();
  if (!name) return "Chiedi all’assistente AI";

  const lower = name.toLowerCase();
  // supporta apostrofi tipografici e semplici
  const lapost = /^l[’']/i.test(lower);
  if (lower.startsWith("il "))   return `Chiedi al ${name.slice(3).trim()}`;
  if (lower.startsWith("lo "))   return `Chiedi allo ${name.slice(3).trim()}`;
  if (lower.startsWith("la "))   return `Chiedi alla ${name.slice(3).trim()}`;
  if (lapost)                    return `Chiedi all’${name.slice(2).trim()}`;
  if (lower.startsWith("i "))    return `Chiedi ai ${name.slice(2).trim()}`;
  if (lower.startsWith("gli "))  return `Chiedi agli ${name.slice(4).trim()}`;
  if (lower.startsWith("le "))   return `Chiedi alle ${name.slice(3).trim()}`;
  // niente articolo nel brand (es. "De Santis", "Zen Café") → "a <nome>"
  return `Chiedi a ${name}`;
}

/** Data loader */
function useVenueData(){
  const [cfg,setCfg]=React.useState<Config|null>(null);
  const [men,setMen]=React.useState<Menu|null>(null);
  const [story,setStory]=React.useState<Story>(null);
  const [err,setErr]=React.useState<string|null>(null);

  React.useEffect(()=>{
    const slug = getSlug();
    fetch(`/data/${slug}.json?ts=${Date.now()}`)
      .then(r=>{ if(!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(json=>{
        const c = (json.config||{}) as Config;
        const m = (json.menu||{}) as Menu;
        m.categories = Array.isArray(m.categories) ? m.categories : [];
        m.categories = m.categories.map((x)=>({ name:x.name, items:Array.isArray(x.items)?x.items:[] }));

        setCfg(c);
        setMen(m);
        setStory((json.story as Story) ?? null);
        applyTheme(c.theme);

        document.title = `${c.name} — Menu online`;
      })
      .catch(e=>{ console.error(e); setErr(`Locale non trovato o JSON non valido (${slug})`); });
  },[]);

  return {cfg,men,story,err};
}

/** UI blocks */
const Pill: React.FC<{active?:boolean; onClick?:()=>void; children:React.ReactNode}> = ({active,onClick,children}) => (
  <button onClick={onClick}
    className={`px-3 py-1.5 rounded-full border text-sm transition ${active?"bg-[var(--accent)] text-[var(--accentText)] border-[var(--accent)]":"bg-white border-slate-200 hover:border-slate-300"}`}>
    {children}
  </button>
);

function ItemCard({item}:{item:MenuItem}){
  return (
    <motion.div initial={{opacity:0,y:10}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
      className="group overflow-hidden rounded-[var(--radius)] border border-slate-200 bg-white shadow-sm">
      {item.img && (
        <div className="h-40 w-full overflow-hidden">
          <img src={item.img} alt={item.name} loading="lazy"
            onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display="none";}}
            className="h-full w-full object-cover transition group-hover:scale-105"/>
        </div>
      )}
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{item.name}</h3>
            {item.fav && <span className="inline-flex items-center gap-1 text-amber-700 text-[11px] bg-amber-100 px-2 py-0.5 rounded-full"><Star className="w-3 h-3"/> Best seller</span>}
          </div>
          {item.desc && <p className="text-slate-600 text-sm mt-0.5">{item.desc}</p>}
          {!!item.tags?.length && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags!.map((t,i)=><span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{t}</span>)}
            </div>
          )}
        </div>
        <div className="text-right min-w-[80px]">
          <div className="font-bold text-slate-900">{item.price.toFixed(2).replace(".", ",")} €</div>
        </div>
      </div>
    </motion.div>
  );
}

function Hero({images}:{images:string[]}) {
  const [idx,setIdx]=React.useState(0);
  React.useEffect(()=>{ const id=setInterval(()=>setIdx(i=>(i+1)%images.length),4000); return ()=>clearInterval(id); },[images.length]);
  if(!images.length) return null;
  return (
    <div className="mx-auto max-w-3xl px-4 pt-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius)] border border-slate-200 shadow-sm bg-slate-100">
        <AnimatePresence mode="wait">
          <motion.img key={idx} src={images[idx]} alt="hero" loading="eager"
            onError={(e)=>{(e.currentTarget as HTMLImageElement).style.opacity="0";}}
            initial={{opacity:0,scale:1.02}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:0.6}}
            className="h-full w-full object-cover"/>
        </AnimatePresence>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_,i)=><button key={i} onClick={()=>setIdx(i)} aria-label={`slide ${i+1}`} className={`h-2.5 w-2.5 rounded-full transition ${i===idx?"bg-white":"bg-white/60"}`}/>)}
        </div>
      </div>
    </div>
  );
}

export default function QRMenuPro(){
  const {cfg,men,story,err} = useVenueData();

  const [query,setQuery] = React.useState("");
  const categories: Category[] = React.useMemo(()=> men?.categories ?? [], [men]);
  const catNames = React.useMemo(()=> categories.map(c=>c.name), [categories]);
  const [activeCat,setActiveCat] = React.useState<string>("");

  React.useEffect(()=>{
    if(!activeCat && catNames.length) setActiveCat(catNames[0]);
    if(activeCat && !catNames.includes(activeCat) && catNames.length) setActiveCat(catNames[0]);
  },[catNames,activeCat]);

  const filtered = React.useMemo(()=> categories.map(c=>({
    ...c,
    items: c.items.filter(it=>{
      const q=query.trim().toLowerCase();
      return !q || it.name.toLowerCase().includes(q) || (it.desc||"").toLowerCase().includes(q);
    })
  })),[categories,query]);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!cfg || !men) return <div className="p-6 text-slate-500">Caricamento…</div>;

  const computedFab = cfg.assistantLabel || makeAskLabel(cfg.name);

  return (
    <div className="min-h-screen text-slate-900 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[var(--bgFrom)] via-[color-mix(in_oklab,var(--bgFrom),var(--bgTo)70%)] to-[var(--bgTo)]">
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white/70 backdrop-blur border-b border-slate-200/70">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <div className="w-11 h-11 rounded-[var(--radius)] bg-[color-mix(in_oklab,var(--accent),white_75%)] flex items-center justify-center ring-1 ring-[color-mix(in_oklab,var(--accent),black_15%)]">
            <UtensilsCrossed className="w-5 h-5" style={{color:"var(--accent)"}}/>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold">{cfg.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{background:"color-mix(in_oklab,var(--accent),white 85%)", color:"var(--accent)"}}>Menu online</span>
            </div>
            {cfg.tagline && <p className="text-slate-600 text-sm">{cfg.tagline}</p>}
          </div>
          <div className="hidden sm:flex gap-2">
            <a href={telHref(cfg.phone)} className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border border-slate-200 hover:bg-white"><Phone className="w-4 h-4"/> Chiama</a>
            <a href={waHref(cfg.whatsapp, cfg.whatsDefaultMsg || "")} className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] text-[var(--accentText)]" style={{background:"var(--accent)"}}><MessageCircle className="w-4 h-4"/> WhatsApp</a>
          </div>
        </div>

        {/* INFO ROW */}
        <div className="mx-auto max-w-3xl px-4 -mt-2 pb-2 text-slate-600 text-sm flex flex-wrap items-center gap-4">
          {cfg.address && <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4"/> <a href={cfg.mapUrl} target="_blank" className="underline decoration-dotted">{cfg.address}</a></span>}
          {cfg.hours && <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4"/> {cfg.hours}</span>}
        </div>

        {/* SEARCH + TABS */}
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={query} onChange={(e)=>setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-[var(--radius)] border border-slate-200 bg-white/70 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),white_70%)]"
                placeholder="Cerca piatto o ingrediente…"/>
            </div>
          </div>
          <div className="mt-2 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 min-w-max">
              {categories.map((c)=>(
                <Pill key={c.name} active={activeCat===c.name} onClick={()=>setActiveCat(c.name)}>{c.name}</Pill>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HERO */}
      <Hero images={cfg.heroImages || []}/>

      {/* STORIA */}
      {story && (
        <div className="mx-auto max-w-3xl px-4 mt-4">
          <div className="p-4 rounded-[var(--radius)] border border-amber-200 bg-amber-50/70">
            <div className="flex items-start gap-3">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-700" fill="currentColor" aria-hidden="true">
                <path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-5-7 5V4z"/>
              </svg>
              <div>
                <div className="font-semibold text-amber-900">{story.title || "La nostra storia"}</div>
                {story.text && <p className="text-amber-900/90 text-sm mt-1">{story.text}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MENU */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {filtered.map((cat)=>(
          <section key={cat.name} className={`${activeCat===cat.name?"block":"hidden"} mb-8`}>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xl font-semibold">{cat.name}</h2>
              <span className="text-xs text-slate-500">{cat.items.length} piatti</span>
            </div>
            {cat.items.length>0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cat.items.map((it,i)=><ItemCard key={i} item={it}/>)}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Nessun elemento corrisponde alla ricerca.</div>
            )}
          </section>
        ))}
        <footer className="mt-10 mb-24 text-xs text-slate-500 space-y-1">
          {cfg.footerNote && <div>{cfg.footerNote}</div>}
          <div>
            Aggiornato: {cfg.lastUpdated || ""} • Allergeni:
            {" "}G(Glutine), L(Latte), U(Uova), N(Noci), P(Pesce), C(Crostacei),
            M(Molluschi), S(Soia), Se(Sesamo), Sd(Sedano), Sn(Senape), Lu(Lupini),
            A(Arachidi), As(Anidride solforosa)
          </div>
        </footer>
      </main>

      {/* STICKY CTA (mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden p-3">
        <div className="mx-auto max-w-md grid grid-cols-2 gap-2 bg-white/95 backdrop-blur border border-slate-200 rounded-[var(--radius)] shadow-lg">
          <a href={telHref(cfg.phone)} className="flex items-center justify-center gap-2 py-3 rounded-[var(--radius)]"><Phone className="w-5 h-5"/> Chiama</a>
          <a href={waHref(cfg.whatsapp, cfg.whatsDefaultMsg || "")} className="flex items-center justify-center gap-2 py-3 rounded-[var(--radius)] text-[var(--accentText)]" style={{background:"var(--accent)"}}><MessageCircle className="w-5 h-5"/> WhatsApp</a>
        </div>
      </div>

      {/* CHAT */}
      <ChatWidget
        slug={getSlug()}
        phone={cfg.phone}
        mapsUrl={cfg.mapUrl}
        venueName={cfg.name}
        buttonLabel={computedFab}
        panelTitle={`Assistente di ${cfg.name}`}
      />
    </div>
  );
}