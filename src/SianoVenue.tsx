// SianoVenue.tsx — versione pulita e parametrica (safe anti-flash)
import React from "react";
import ChatWidget from "./ChatWidget";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MessageCircle, MapPin, Clock, Search, Star, UtensilsCrossed, BookOpenText } from "lucide-react";

/** Types */
type CTAType = "call" | "directions" | "whatsapp" | "link";
type CTA = { type: CTAType; label: string; url?: string };

type Config = {
  name: string;
  tagline?: string;
  address?: string;
  mapUrl?: string;
  hours?: string;
  phone?: string;
  whatsapp?: string;
  whatsDefaultMsg?: string;
  logoUrl?: string;
  heroImages?: string[];
  lastUpdated?: string;
  footerNote?: string;
  assistantLabel?: string;

  /** personalizzazioni UI */
  onlineBadgeLabel?: string | null;
  searchPlaceholder?: string;
  allergenNotice?: { enabled?: boolean; text?: string };

  theme?: {
    mode?: "light" | "dark";
    accent?: string;
    accentText?: string;
    bgFrom?: string;
    bgTo?: string;
    radius?: string;
    fontUrl?: string;
    fontFamily?: string;
    cssUrl?: string;
  };
  chat?: {
    quickReplies?: string[];
    ctas?: CTA[];
    initialMessage?: string;
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

/** Favicon per-locale dal logo */
function applyFavicon(url?: string){
  if(!url) return;
  const ensure = (rel: string) => {
    let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if(!el){ el = document.createElement("link"); el.rel = rel; document.head.appendChild(el); }
    return el;
  };
  const ico = ensure("icon"); ico.type = "image/png"; ico.href = url;
  const apple = ensure("apple-touch-icon"); apple.href = url;
}

/** Tema → CSS vars (+ glass adattivo) */
function applyTheme(t?: Config["theme"]){
  const mode = t?.mode || "light";
  const root = document.documentElement;
  const st = root.style;

  st.setProperty("--accent", t?.accent || "#0f766e");
  st.setProperty("--accentText", t?.accentText || "#ffffff");
  st.setProperty("--radius", t?.radius || "16px");

  const setDefaults = () => {
    st.setProperty("--bgFrom", t?.bgFrom || (mode==="dark" ? "#0f0f12" : "#f8fafc"));
    st.setProperty("--bgTo",   t?.bgTo   || (mode==="dark" ? "#121417" : "#ffffff"));
    st.setProperty("--accent-20", "color-mix(in_oklab, var(--accent), white 80%)");
    st.setProperty("--accent-10", "color-mix(in_oklab, var(--accent), white 90%)");
    st.setProperty("--accent-05", "color-mix(in_oklab, var(--accent), white 95%)");
    st.setProperty("--chromeTint", "var(--accent-05)");

    if (mode === "dark") {
      st.setProperty("--text", "#e5e7eb");
      st.setProperty("--textSoft", "#cbd5e1");
      st.setProperty("--card", "#111214");
      st.setProperty("--muted", "#0e0f11");
      st.setProperty("--border", "rgba(255,255,255,0.08)");
      st.setProperty("--glass", "linear-gradient(180deg, rgba(24,24,27,.92), rgba(24,24,27,.84))");
    } else {
      st.setProperty("--text", "#0f172a");
      st.setProperty("--textSoft", "#475569");
      st.setProperty("--card", "#ffffff");
      st.setProperty("--muted", "#f8fafc");
      st.setProperty("--border", "#e5e7eb");
      st.setProperty("--glass", "linear-gradient(180deg, rgba(255,255,255,.86), rgba(255,255,255,.74))");
    }
  };

  setDefaults();

  if (t?.cssUrl){
    let link = document.getElementById("venue-css") as HTMLLinkElement | null;
    if(!link){
      link = document.createElement("link");
      link.id = "venue-css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = t.cssUrl;

    link.onload = () => {
      const maybeThemeVars = [
        "--bgFrom","--bgTo","--glass","--card","--muted","--border",
        "--accent-20","--accent-10","--accent-05","--chromeTint",
        "--text","--textSoft"
      ];
      const comp = getComputedStyle(root);

      for (const v of maybeThemeVars){
        const fromTheme = comp.getPropertyValue(v).trim();
        if (fromTheme) st.removeProperty(v);
      }
      document.body.style.backgroundColor = comp.getPropertyValue("--bgTo") || "var(--bgTo)";
    };
  }

  if (t?.fontUrl){
    let link = document.getElementById("venue-font") as HTMLLinkElement | null;
    if(!link){ link=document.createElement("link"); link.id="venue-font"; link.rel="stylesheet"; document.head.appendChild(link); }
    link.href=t.fontUrl;
    let style=document.getElementById("venue-font-style") as HTMLStyleElement | null;
    if(!style){ style=document.createElement("style"); style.id="venue-font-style"; document.head.appendChild(style); }
    style.textContent=`body{font-family:${t.fontFamily || "system-ui"};}`;
  }

  document.body.style.backgroundColor = "var(--bgTo)";
}

/** Label “Chiedi al/allo/alla/all’/ai…” */
function makeAskLabel(venueName: string): string {
  const name = (venueName || "").trim();
  if (!name) return "Chiedi all’assistente AI";
  const lower = name.toLowerCase();
  const lapost = /^l['\u2019]/i.test(lower);
  if (lower.startsWith("il "))   return `Chiedi al ${name.slice(3).trim()}`;
  if (lower.startsWith("lo "))   return `Chiedi allo ${name.slice(3).trim()}`;
  if (lower.startsWith("la "))   return `Chiedi alla ${name.slice(3).trim()}`;
  if (lapost)                    return `Chiedi all\u2019${name.slice(2).trim()}`;
  if (lower.startsWith("i "))    return `Chiedi ai ${name.slice(2).trim()}`;
  if (lower.startsWith("gli "))  return `Chiedi agli ${name.slice(4).trim()}`;
  if (lower.startsWith("le "))   return `Chiedi alle ${name.slice(3).trim()}`;
  return `Chiedi a ${name}`;
}

function resolveBadgeLabel(label?: string | null): string | null {
  if (label === null) return null;
  if (label === "") return null;
  return label ?? "Menu online";
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
        applyFavicon(c.logoUrl);

        const badge = resolveBadgeLabel(c.onlineBadgeLabel);
        document.title = badge ? `${c.name} — ${badge}` : c.name;
      })
      .catch(e=>{ console.error(e); setErr(`Locale non trovato o JSON non valido (${slug})`); });
  },[]);

  return {cfg,men,story,err};
}

/** UI helpers */
const glowShadow = "0 10px 30px 0 color-mix(in_oklab, var(--accent), transparent 80%)";

/** ITEM CARD */
function ItemCard({item}:{item:MenuItem}){
  return (
    <motion.div
      initial={{opacity:0, y:10}}
      whileInView={{opacity:1, y:0}}
      viewport={{once:true}}
      whileHover={{y:-2, scale:1.01}}
      transition={{type:"spring", stiffness:250, damping:22}}
      className="relative rounded-[var(--radius)]"
      style={{ padding: "1px", background: "linear-gradient(135deg, var(--accent-20), var(--accent-05))", boxShadow: glowShadow }}
    >
      <div className="group overflow-hidden rounded-[calc(var(--radius)-1px)] border"
           style={{ borderColor:"var(--border)", background:"var(--card)" }}>
        {item.img && (
          <div className="h-44 w-full overflow-hidden">
            <img src={item.img} alt={item.name} loading="lazy"
                 onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display="none";}}
                 className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          </div>
        )}

        <div className="absolute right-3 top-3 rounded-full px-3 py-1 text-sm font-semibold shadow"
             style={{ background:"var(--accent)", color:"var(--accentText)", boxShadow: glowShadow }}>
          {item.price.toFixed(2).replace(".", ",")} €
        </div>

        <div className="p-4 flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold" style={{color:"var(--text)"}}>{item.name}</h3>
              {item.fav && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                      style={{background:"var(--accent-10)", color:"var(--accent)"}}>
                  <Star className="w-3 h-3"/> Best seller
                </span>
              )}
            </div>
            {item.desc && <p className="text-sm mt-1" style={{color:"var(--textSoft)"}}>{item.desc}</p>}
            {!!item.tags?.length && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags!.map((t,i)=>
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{background:"var(--muted)", color:"var(--textSoft)", borderColor:"var(--border)"}}>
                    {t}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** HERO */
function Hero({images}:{images:string[]}) {
  const [idx,setIdx]=React.useState(0);
  React.useEffect(()=>{ const id=setInterval(()=>setIdx(i=>(i+1)%images.length),4500); return ()=>clearInterval(id); },[images.length]);
  if(!images.length) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius)] border shadow-sm"
           style={{borderColor:"var(--border)", background:"var(--muted)"}}>
        <AnimatePresence mode="wait">
          <motion.img
            key={idx}
            src={images[idx]}
            alt="hero"
            loading="eager"
            onError={(e)=>{(e.currentTarget as HTMLImageElement).style.opacity="0";}}
            initial={{opacity:0, scale:1.02}}
            animate={{opacity:1, scale:1}}
            exit={{opacity:0}}
            transition={{duration:0.6}}
            className="h-full w-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 to-transparent" />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_,i)=>
            <button key={i} onClick={()=>setIdx(i)} aria-label={`slide ${i+1}`}
              className={`h-2.5 w-2.5 rounded-full transition ${i===idx?"bg-white":"bg-white/70"}`}/>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SianoVenue(){
  const {cfg,men,story,err} = useVenueData();

  const [query,setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 120);
    return () => clearTimeout(id);
  }, [query]);

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
      const q=debouncedQuery.trim().toLowerCase();
      return !q || it.name.toLowerCase().includes(q) || (it.desc||"").toLowerCase().includes(q);
    })
  })),[categories,debouncedQuery]);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!cfg || !men) return <div className="p-6" style={{color:"var(--textSoft)"}}>Caricamento…</div>;

  const computedFab   = cfg.assistantLabel || makeAskLabel(cfg.name);
  const searchPH      = cfg.searchPlaceholder || "Cerca piatto o ingrediente…";
  const badgeLabel    = resolveBadgeLabel(cfg.onlineBadgeLabel);
  const allergenText  = cfg.allergenNotice?.text?.trim() ?? "";
  const showAllergen  = (cfg.allergenNotice?.enabled !== false) && allergenText !== "";

  return (
    <div
      className="min-h-screen"
      style={{
        color:"var(--text)",
        backgroundImage: `
          radial-gradient(1200px 800px at 80% -10%, var(--bgFrom), var(--bgTo)),
          radial-gradient(600px 400px at -10% 20%, var(--chromeTint), transparent),
          radial-gradient(700px 500px at 110% 80%, var(--chromeTint), transparent)
        `
      }}
    >
      {/* HEADER GLASS */}
      <div className="sticky top-0 z-40 backdrop-blur border-b"
           style={{ background: "var(--glass)", borderColor: "transparent", boxShadow: "0 10px 30px rgba(0,0,0,.12)" }}>
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          {cfg.logoUrl ? (
            <div className="w-11 h-11 rounded-[var(--radius)] overflow-hidden ring-1"
                 style={{borderColor:"var(--border)", background:"var(--card)", boxShadow:"0 4px 20px rgba(0,0,0,.06)"}}>
              <img src={cfg.logoUrl} alt={`${cfg.name} logo`} className="w-full h-full object-cover"
                   onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display="none"; }} />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-[var(--radius)] bg-[var(--muted)] flex items-center justify-center ring-1"
                 style={{borderColor:"var(--border)"}}>
              <UtensilsCrossed className="w-5 h-5" style={{color:"var(--textSoft)"}}/>
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold" style={{color:"var(--text)"}}>{cfg.name}</h1>
              {badgeLabel && (
                <span className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{background:"var(--accent-10)", color:"var(--accent)"}}>
                  {badgeLabel}
                </span>
              )}
            </div>
            {cfg.tagline && <p className="text-sm" style={{color:"var(--textSoft)"}}>{cfg.tagline}</p>}
          </div>

          <div className="hidden sm:flex gap-2">
            <a href={telHref(cfg.phone)} className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border hover:opacity-90"
               style={{borderColor:"var(--border)", color:"var(--text)", background:"var(--card)"}}><Phone className="w-4 h-4"/> Chiama</a>
            <a href={waHref(cfg.whatsapp, cfg.whatsDefaultMsg || "")}
               className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] text-[var(--accentText)]"
               style={{background:"var(--accent)", boxShadow: glowShadow}}><MessageCircle className="w-4 h-4"/> WhatsApp</a>
          </div>
        </div>

        {/* INFO ROW */}
        <div className="mx-auto max-w-3xl px-4 -mt-2 pb-3 text-sm flex flex-wrap items-center gap-4" style={{color:"var(--textSoft)"}}>
          {cfg.address && <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4"/><a href={cfg.mapUrl} target="_blank" className="underline decoration-dotted">{cfg.address}</a></span>}
          {cfg.hours && <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4"/> {cfg.hours}</span>}
        </div>

        {/* SEARCH + CATEGORIES */}
        <div className="mx-auto max-w-3xl px-4 pb-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2" style={{color:"var(--textSoft)"}}/>
            <input
              value={query} onChange={(e)=>setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-[var(--radius)] border outline-none transition"
              style={{ borderColor:"var(--border)", background:"var(--card)", color:"var(--text)", boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
              onFocus={(e)=>{ e.currentTarget.style.boxShadow = `0 0 0 5px var(--accent-05)`; }}
              onBlur ={(e)=>{ e.currentTarget.style.boxShadow = "0 0 0 0 rgba(0,0,0,0)"; }}
              placeholder={searchPH}
              aria-label={searchPH}
            />
          </div>

          <div className="mt-3 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 min-w-max">
              {categories.map((c)=>(
                <button
                  key={c.name} onClick={()=>setActiveCat(c.name)}
                  className="px-3 py-1.5 rounded-full border text-sm transition active:scale-[.98]"
                  aria-pressed={activeCat===c.name}
                  style={ activeCat===c.name
                    ? { background:"var(--accent)", color:"var(--accentText)", borderColor:"var(--accent)", boxShadow: glowShadow }
                    : { background:"var(--muted)", color:"var(--text)", borderColor:"var(--border)" }
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HERO */}
      <Hero images={cfg.heroImages || []}/>

      {/* STORY */}
      {story && (
        <div className="mx-auto max-w-3xl px-4 mt-6">
          <div className="rounded-[var(--radius)] p-[1px]"
               style={{ background: "linear-gradient(135deg, var(--accent-20), var(--accent-05))", boxShadow: glowShadow }}>
            <div className="rounded-[calc(var(--radius)-1px)] p-4 sm:p-5 border"
                 style={{ background:"var(--glass)", borderColor:"var(--border)" }}>
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-full p-2" style={{background:"var(--accent-10)", color:"var(--accent)"}}>
                  <BookOpenText className="w-5 h-5"/>
                </div>
                <div>
                  <div className="font-semibold" style={{color:"var(--text)"}}>
                    {story.title || "La nostra storia"}
                  </div>
                  {story.text && <p className="text-sm mt-1" style={{color:"var(--textSoft)"}}>{story.text}</p>}
                </div>
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
              <h2 className="text-xl font-semibold" style={{color:"var(--text)"}}>{cat.name}</h2>
              <span className="text-xs" style={{color:"var(--textSoft)"}}>{cat.items.length} piatti</span>
            </div>

            {cat.items.length>0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cat.items.map((it,i)=><ItemCard key={i} item={it}/>)}
              </div>
            ) : (
              <div className="text-sm" style={{color:"var(--textSoft)"}}>Nessun elemento corrisponde alla ricerca.</div>
            )}
          </section>
        ))}

        <footer className="mt-12 mb-28 text-xs space-y-1" style={{color:"var(--textSoft)"}}>
          {cfg.footerNote && <div>{cfg.footerNote}</div>}
          {showAllergen && (
            <div>
              {cfg.lastUpdated ? <>Aggiornato: {cfg.lastUpdated} • </> : null}
              {allergenText}
            </div>
          )}
        </footer>
      </main>

      {/* STICKY CTA (mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden p-3">
        <div className="mx-auto max-w-md grid grid-cols-2 gap-2 backdrop-blur border rounded-[var(--radius)] shadow-lg"
             style={{background:"var(--glass)", borderColor:"var(--border)"}}>
          <a href={telHref(cfg.phone)} className="flex items-center justify-center gap-2 py-3 rounded-[var(--radius)]" style={{color:"var(--text)"}}>
            <Phone className="w-5 h-5"/> Chiama
          </a>
          <a href={waHref(cfg.whatsapp, cfg.whatsDefaultMsg || "")}
             className="flex items-center justify-center gap-2 py-3 rounded-[var(--radius)] text-[var(--accentText)]"
             style={{background:"var(--accent)", boxShadow: glowShadow}}>
            <MessageCircle className="w-5 h-5"/> WhatsApp
          </a>
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
        quickReplies={cfg.chat?.quickReplies}
        ctas={cfg.chat?.ctas}
        whatsapp={cfg.whatsapp}
        whatsDefaultMsg={cfg.whatsDefaultMsg}
        initialMessage={cfg.chat?.initialMessage}
      />
    </div>
  );
}
