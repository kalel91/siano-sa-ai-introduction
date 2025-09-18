import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatWidget from "./ChatWidget";
import {
  MapPin, ExternalLink, CalendarClock, Landmark, Sparkles, Bot, Users, Navigation
} from "lucide-react";

/* ===== Types ===== */
type HomeJson = {
  cityName: string;
  logoUrl?: string;

  heroTitle: string;
  heroSubtitle?: string;
  heroImages?: string[];

  about?: { title?: string; text?: string };
  project?: { title?: string; text?: string };

  festivities?: Array<{ name: string; month?: string; description?: string; link?: string }>;
  pilot?: {
    title?: string;
    intro?: string;
    goals?: string[];
    components?: string[];
    benefits?: { commerce?: string[]; citizens?: string[]; visitors?: string[] };
    governance?: string;
    downloadUrl?: string;
  };

  gallery?: string[];

  openData?: { csvUrl?: string; jsonUrl?: string };
  social?: { website?: string; facebook?: string; instagram?: string };

  footer?: { note?: string; updated?: string };

  theme?: { accent?: string; accentText?: string; bgFrom?: string; bgTo?: string };

  chat?: { quickReplies?: string[] };

  assistant?: {
    enabled?: boolean;
    label?: string;
    panelTitle?: string;
    slugForQA?: string;
    initialMessage?: string;
  };
};

type Venue = { slug: string; name: string; tagline?: string; logoUrl?: string };

/* ===== Public assets helper ===== */
function publicAsset(path: string) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  try {
    const base = (import.meta as any)?.env?.BASE_URL as string | undefined;
    if (base) return base.replace(/\/$/, "") + "/" + clean;
  } catch { }
  try {
    const g = globalThis as any;
    const base2 = g?.process?.env?.PUBLIC_URL as string | undefined;
    if (base2) return base2.replace(/\/$/, "") + "/" + clean;
  } catch { }
  return "/" + clean;
}

/* ===== Theming / assets ===== */
function applyHomeFavicon(url?: string) {
  if (!url) return;
  const ensure = (rel: string) => {
    let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement("link"); el.rel = rel; document.head.appendChild(el); }
    return el;
  };
  const ico = ensure("icon"); ico.type = "image/png"; ico.href = url;
  const apple = ensure("apple-touch-icon"); apple.href = url;
}

function applyHomeTheme(t?: HomeJson["theme"]) {
  const COBALT = "#1e40ff";
  const COBALT_SOLID = "rgb(30, 64, 255)"; // identico alla top bar

  const root = document.documentElement.style;
  root.setProperty("--accent", t?.accent || COBALT);
  root.setProperty("--accentText", t?.accentText || "#ffffff");
  root.setProperty("--accentSolid", COBALT_SOLID); // per tab / bottoni
  root.setProperty("--bgFrom", t?.bgFrom || "#f4f7fb");
  root.setProperty("--bgTo", t?.bgTo || "#ffffff");
  root.setProperty("--text", "#0f172a");
  root.setProperty("--textSoft", "#475569");
  root.setProperty("--card", "#ffffff");
  root.setProperty("--muted", "#f8fafc");
  root.setProperty("--border", "#e5e7eb");
}

/* ===== Data hook ===== */
function useHomeData() {
  const [cfg, setCfg] = React.useState<HomeJson | null>(null);
  const [venues, setVenues] = React.useState<Venue[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const home = await fetch(`/data/home.json?ts=${Date.now()}`).then((r) => r.ok ? r.json() : Promise.reject(r.status));
        const h = home as HomeJson;
        setCfg(h);
        applyHomeTheme(h.theme);
        applyHomeFavicon(h.logoUrl);

        const jsonUrl = h?.openData?.jsonUrl || "/data/venues.json";
        try {
          const v = await fetch(`${jsonUrl}?ts=${Date.now()}`).then((r) => r.ok ? r.json() : Promise.reject(r.status));
          if (Array.isArray(v)) setVenues(v as Venue[]);
        } catch { setVenues([]); }

        document.title = `${h.cityName} — Progetto AI`;
      } catch (e) {
        console.error(e);
        setErr("Impossibile caricare la homepage (home.json).");
      }
    })();
  }, []);

  return { cfg, venues, err };
}

const glow = "0 12px 36px -12px color-mix(in_oklab,var(--accentSolid),transparent 72%)";

/* ===== Tab switcher ===== */
type TabKey = "siano" | "pilot" | "venues";
type AvailableMap = Partial<Record<TabKey, boolean>>;

function SectionSwitcher({
  active, onChange, available = {}
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  available?: AvailableMap;
}) {
  const items = [
    { key: "siano", label: "Siano", icon: <Landmark className="w-4 h-4" /> },
    { key: "pilot", label: "Progetto Pilota", icon: <Sparkles className="w-4 h-4" /> },
    { key: "venues", label: "Esercenti", icon: <Users className="w-4 h-4" /> },
  ] as const;

  const visible = items.filter((e) => available[e.key] !== false);

  return (
    <div
      id="section-switcher"
      style={{
        position: "sticky",
        top: 64,
        zIndex: 25,
        background: "transparent",
        scrollMarginTop: "calc(var(--headerH, 64px) + 12px)",
      }}
      className="mx-auto max-w-5xl px-4"
    >
      <div className="rounded-xl border shadow-sm overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <nav role="tablist" aria-label="Sezioni" className="flex">
          {visible.map((e) => {
            const activeStyle = active === e.key
              ? { background: "var(--accentSolid)", color: "var(--accentText)", boxShadow: glow }
              : { background: "transparent", color: "var(--text)" };
            return (
              <button
                key={e.key}
                role="tab"
                aria-selected={active === e.key}
                onClick={() => onChange(e.key)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm transition"
                style={activeStyle}
              >
                {e.icon}{e.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ===== Page ===== */
export default function HomePage() {
  const { cfg, venues, err } = useHomeData();
  const [active, setActive] = React.useState<TabKey>("siano");

  /* Header height -> CSS var e scroll padding nativo */
  React.useEffect(() => {
    const header = document.getElementById("site-header");
    if (!header) return;

    const apply = () => {
      const h = header.getBoundingClientRect().height || 64;
      const px = `${Math.round(h)}px`;
      const root = document.documentElement.style;
      root.setProperty("--headerH", px);
      // compensazione sticky per scrollIntoView
      root.setProperty("scroll-padding-top", `calc(${px} + 12px)`);
    };

    apply();

    const g = globalThis as any;
    if (g && "ResizeObserver" in g && typeof g.ResizeObserver === "function") {
      const ro = new g.ResizeObserver(apply);
      ro.observe(header);
      return () => ro.disconnect();
    }
    if (typeof window.addEventListener === "function") {
      window.addEventListener("resize", apply);
      return () => window.removeEventListener("resize", apply);
    }
  }, []);

  /* Override cobalto + dimensioni ridotte per il launcher dell'assistente */
  React.useEffect(() => {
    const id = "theme-accent-overrides";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
:root{ --chat-accent: var(--accentSolid); --chat-accent-text: var(--accentText); }

/* Colori + dimensioni compatte del bottone chat */
button[data-chat-launcher],
.chat-launcher,
.cw-launcher,
[data-widget="chat"] button{
  background: var(--chat-accent) !important;
  color: var(--chat-accent-text) !important;
  border-color: color-mix(in_oklab,var(--chat-accent),black 10%) !important;

  font-size: 14px !important;
  padding: 8px 14px !important;
  min-height: 40px !important;
  border-radius: 9999px !important;
  gap: 8px !important;

  right: 20px !important;
  bottom: 20px !important;
}
button[data-chat-launcher] svg,
.chat-launcher svg,
.cw-launcher svg,
[data-widget="chat"] button svg{
  width: 18px !important;
  height: 18px !important;
}
@media (max-width: 640px){
  button[data-chat-launcher],
  .chat-launcher,
  .cw-launcher,
  [data-widget="chat"] button{
    padding: 10px !important;
    min-height: 44px !important;
  }
}
    `.trim();
    document.head.appendChild(style);
  }, []);

  /* Scroll: parte SOLO quando la nuova sezione ha finito l'animazione */
  const pendingScrollRef = React.useRef(false);
  const scrollToAnchor = React.useCallback(() => {
    const anchor = document.getElementById("content-anchor");
    if (!anchor) return;
    requestAnimationFrame(() => {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleTabChange = React.useCallback((k: TabKey) => {
    pendingScrollRef.current = true;
    setActive(k);
  }, []);

  const onSectionAnimComplete = React.useCallback(() => {
    if (!pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    scrollToAnchor();
  }, [scrollToAnchor]);

  const tabsAvailable: AvailableMap = { siano: true, pilot: !!cfg?.pilot, venues: true };

  // Festività
  const [showAllFeasts, setShowAllFeasts] = React.useState(false);
  const shuffledFeasts = React.useMemo(() => {
    const list = [...(cfg?.festivities || [])];
    if (list.length >= 6) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor((Math.sin(i * 9301 + 49297) * 233280) % (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    return list;
  }, [cfg?.festivities]);
  const visibleFeasts = showAllFeasts ? shuffledFeasts : shuffledFeasts.slice(0, 3);

  const homeAssistantOpening =
    cfg?.assistant?.initialMessage ||
    (cfg?.cityName
      ? `Ciao! Sono l’assistente del Comune di ${cfg.cityName}. Posso aiutarti con storia, progetto, servizi e attività aderenti.`
      : "Ciao! Posso aiutarti con storia, progetto, servizi e attività aderenti.");

  const bannerUrl = publicAsset("/city/banner_title.png");

  // immagini galleria (hero + gallery)
  const galleryImages = React.useMemo(
    () => ([...(cfg?.heroImages || []), ...(cfg?.gallery || [])]),
    [cfg?.heroImages, cfg?.gallery]
  );

  return (
    <div
      className="min-h-screen"
      style={{
        color: "var(--text)",
        backgroundImage: `
          radial-gradient(1200px 800px at 70% -10%, var(--bgFrom), var(--bgTo)),
          radial-gradient(600px 400px at -10% 20%, color-mix(in_oklab,var(--accentSolid),white 92%), transparent),
          radial-gradient(700px 500px at 110% 80%, color-mix(in_oklab,var(--accentSolid),white 94%), transparent)
        `,
      }}
    >
      {/* HEADER */}
      <div
        id="site-header"
        className="sticky top-0 z-30 backdrop-blur border-b"
        style={{
          background: "linear-gradient(180deg, rgba(30,64,255,.28), rgba(30,64,255,.18))",
          borderColor: "transparent"
        }}
      >
        <header className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm" style={{ color: "#eef2ff" }}>
            <MapPin className="w-4 h-4" />
            <span>{cfg?.cityName || "—"}</span>
          </div>
          {cfg?.logoUrl && (
            <div
              className="w-10 h-10 rounded-xl border overflow-hidden"
              style={{
                borderColor: "color-mix(in_oklab,var(--accentSolid),white 60%)",
                background: "var(--muted)",
                boxShadow: "0 6px 18px rgba(0,0,0,.08)"
              }}
              aria-label="Logo comunale"
            >
              <img
                src={cfg.logoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
              />
            </div>
          )}
        </header>
      </div>

      {/* HERO */}
      <section className="relative mx-auto max-w-5xl px-4 pt-10 pb-6">
        <div className="rounded-2xl border p-6 sm:p-8 shadow-xl"
          style={{ background: "var(--card)", borderColor: "color-mix(in_oklab,var(--accentSolid),white 65%)" }}>
          <div className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full"
            style={{ background: "color-mix(in_oklab,var(--accentSolid),white 86%)", color: "color-mix(in_oklab,var(--accentSolid),black 25%)" }}>
            <Sparkles className="w-3.5 h-3.5" />
            Progetto digitale del Comune
          </div>

          <h1 className="mt-3 text-[clamp(28px,4.5vw,48px)] font-extrabold leading-tight tracking-tight"
            style={{ color: "color-mix(in_oklab,var(--text),black 10%)" }}>
            {cfg?.heroTitle || "—"}
          </h1>
          <div aria-hidden className="mt-3 h-1.5 w-28 rounded-full"
            style={{ background: "linear-gradient(90deg, var(--accentSolid), color-mix(in_oklab,var(--accentSolid),white 35%) 70%, transparent)" }} />
          {cfg?.heroSubtitle && (
            <p className="mt-4 text-base sm:text-lg" style={{ color: "var(--textSoft)" }}>
              {cfg.heroSubtitle}
            </p>
          )}

          <figure className="mt-6 rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--border)", boxShadow: glow }}>
            <img
              src={bannerUrl}
              alt="Siano - panorama"
              className="w-full"
              style={{
                display: "block",
                height: "clamp(180px, 32vh, 300px)",
                objectFit: "cover",
                objectPosition: "center"
              }}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          </figure>
        </div>
      </section>

      {/* ANCHOR: poco sopra lo switcher, usato per lo scroll */}
      <div id="content-anchor" style={{ height: 1 }} />

      {/* SWITCHER sticky */}
      <SectionSwitcher active={active} onChange={handleTabChange} available={tabsAvailable} />

      {/* CONTENUTI */}
      <main className="mx-auto max-w-5xl px-4 pb-24">
        {err && <div className="p-6 text-red-600">{err}</div>}
        {!cfg && !err && <div className="p-6" style={{ color: "var(--textSoft)" }}>Caricamento…</div>}

        {cfg && (
          <AnimatePresence mode="wait">
            {active === "siano" && (
              <motion.section
                key="siano"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                onAnimationComplete={onSectionAnimComplete}
                className="grid grid-cols-1 gap-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl p-5 border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Landmark className="w-5 h-5" /><h2 className="font-semibold text-lg">{cfg.about?.title || "La storia"}</h2>
                    </div>
                    {cfg.about?.text && <p className="mt-2 text-sm" style={{ color: "var(--textSoft)" }}>{cfg.about.text}</p>}
                  </div>

                  {(shuffledFeasts.length > 0) && (
                    <div className="rounded-xl p-5 border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="w-5 h-5" /><h2 className="font-semibold text-lg">Festività & Tradizioni</h2>
                        </div>
                        {shuffledFeasts.length > 2 && (
                          <button
                            onClick={() => setShowAllFeasts(v => !v)}
                            className="text-xs px-2 py-1 rounded-full border"
                            style={{ borderColor: "var(--border)", background: "var(--muted)", color: "var(--text)" }}
                            aria-expanded={showAllFeasts}
                          >
                            {showAllFeasts ? "Mostra meno" : "Mostra tutte"}
                          </button>
                        )}
                      </div>

                      <ul className="mt-2 space-y-3">
                        {visibleFeasts.map((f, i) => (
                          <li key={i} className="rounded-lg p-3 border" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium">{f.name}</div>
                              {f.month && (
                                <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: "var(--accentSolid)", color: "var(--accentText)" }}>
                                  {f.month}
                                </span>
                              )}
                            </div>
                            {f.description && <p className="text-sm mt-1" style={{ color: "var(--textSoft)" }}>{f.description}</p>}
                            {f.link && (
                              <a className="text-sm underline inline-flex items-center gap-1 mt-1"
                                href={f.link} target="_blank" rel="noreferrer" style={{ color: "var(--textSoft)" }}>
                                Approfondisci <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Siano in immagini */}
                {galleryImages.length > 0 && (
                  <section>
                    <h3 className="font-semibold mb-3">Siano in immagini</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {galleryImages.slice(0, 8).map((src, i) => (
                        <motion.figure
                          key={src || i}
                          initial={{ opacity: 0, y: 6 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          whileHover={{ scale: 1.03, y: -2 }}
                          transition={{ type: "spring", stiffness: 220, damping: 20 }}
                          className="rounded-xl border overflow-hidden"
                          style={{ borderColor: "var(--border)", boxShadow: glow }}
                        >
                          <img
                            src={src}
                            alt={`siano-${i}`}
                            className="w-full h-32 object-cover"
                            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                          />
                        </motion.figure>
                      ))}
                    </div>
                  </section>
                )}
              </motion.section>
            )}

            {active === "pilot" && cfg.pilot && (
              <motion.section
                key="pilot"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                onAnimationComplete={onSectionAnimComplete}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2 rounded-xl p-5 border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5" /><h2 className="font-semibold text-lg">{cfg.pilot.title || "Progetto Pilota — Siano AI"}</h2>
                  </div>
                  {cfg.pilot.intro && <p className="text-sm mt-2" style={{ color: "var(--textSoft)" }}>{cfg.pilot.intro}</p>}

                  {!!cfg.pilot.goals?.length && (
                    <div className="mt-4">
                      <h3 className="font-medium flex items-center gap-2"><Navigation className="w-4 h-4" /> Obiettivi chiave</h3>
                      <ul className="list-disc ms-5 text-sm mt-2" style={{ color: "var(--textSoft)" }}>
                        {cfg.pilot.goals.map((g, i) => <li key={i}>{g}</li>)}
                      </ul>
                    </div>
                  )}

                  {!!cfg.pilot.components?.length && (
                    <div className="mt-4">
                      <h3 className="font-medium flex items-center gap-2"><Bot className="w-4 h-4" /> Cosa include</h3>
                      <ul className="list-disc ms-5 text-sm mt-2" style={{ color: "var(--textSoft)" }}>
                        {cfg.pilot.components.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}

                  {cfg.pilot.governance && (
                    <div className="mt-4">
                      <h3 className="font-medium flex items-center gap-2"><Landmark className="w-4 h-4" /> Governance & sostenibilità</h3>
                      <p className="text-sm mt-2" style={{ color: "var(--textSoft)" }}>{cfg.pilot.governance}</p>
                    </div>
                  )}

                  {cfg.pilot.downloadUrl && (
                    <div className="mt-4">
                      <a href={cfg.pilot.downloadUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "var(--accentSolid)", color: "var(--accentText)", boxShadow: glow }}>
                        Scarica il documento del progetto <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="rounded-xl p-5 border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <h3 className="font-semibold mb-2">Benefici</h3>
                  <div className="space-y-4">
                    {!!cfg.pilot.benefits?.commerce?.length && (
                      <div>
                        <div className="text-sm font-medium">Per le attività</div>
                        <ul className="list-disc ms-5 text-sm" style={{ color: "var(--textSoft)" }}>
                          {cfg.pilot.benefits!.commerce!.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      </div>
                    )}
                    {!!cfg.pilot.benefits?.citizens?.length && (
                      <div>
                        <div className="text-sm font-medium">Per i cittadini</div>
                        <ul className="list-disc ms-5 text-sm" style={{ color: "var(--textSoft)" }}>
                          {cfg.pilot.benefits!.citizens!.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      </div>
                    )}
                    {!!cfg.pilot.benefits?.visitors?.length && (
                      <div>
                        <div className="text-sm font-medium">Per i visitatori</div>
                        <ul className="list-disc ms-5 text-sm" style={{ color: "var(--textSoft)" }}>
                          {cfg.pilot.benefits!.visitors!.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {active === "venues" && (
              <motion.section
                key="venues"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                onAnimationComplete={onSectionAnimComplete}
                className="mt-2"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-semibold">Esercenti aderenti</h3>
                  {cfg.openData?.jsonUrl && (
                    <a href={cfg.openData.jsonUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline"
                      style={{ color: "var(--textSoft)" }}>
                      Open data <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {(venues.length === 0) ? (
                  <div className="text-sm" style={{ color: "var(--textSoft)" }}>Nessun esercente pubblicato (ancora).</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence initial={false}>
                      {venues.map((v) => (
                        <motion.a
                          key={v.slug}
                          href={`/${v.slug}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ type: "spring", stiffness: 250, damping: 24 }}
                          className="group rounded-xl p-4 border block"
                          style={{ borderColor: "var(--border)", background: "var(--card)" }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl border overflow-hidden"
                              style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                              {v.logoUrl ? (
                                <img src={v.logoUrl} alt={`${v.name} logo`} className="w-full h-full object-cover"
                                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{v.name}</div>
                              {v.tagline && <div className="text-xs truncate" style={{ color: "var(--textSoft)" }}>{v.tagline}</div>}
                            </div>
                          </div>
                        </motion.a>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-4 py-10 text-xs"
        style={{ color: "var(--textSoft)", borderTop: "1px solid var(--border)" }}>
        {cfg?.footer?.note && <div>{cfg.footer.note}</div>}
        {cfg?.footer?.updated && <div>Aggiornato: {cfg.footer.updated}</div>}
      </footer>

      {/* Chat comunale */}
      {cfg?.assistant?.enabled && (
        <ChatWidget
          slug={cfg.assistant.slugForQA || "municipio"}
          buttonLabel={cfg.assistant.label || "Chiedi al Comune di Siano"}
          panelTitle={cfg.assistant.panelTitle || "Assistente del Comune di Siano"}
          quickReplies={cfg.chat?.quickReplies}
          initialMessage={homeAssistantOpening}
        />
      )}
    </div>
  );
}
