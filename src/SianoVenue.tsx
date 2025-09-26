import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatWidget from "./ChatWidget";
import {
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Star,
  ExternalLink,
  Bot,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  Instagram,
  Facebook,
  Search,
} from "lucide-react";

/** Types */
type CTAType = "call" | "directions" | "whatsapp" | "link";
type CTA = { type: CTAType; label: string; url?: string };

type AssistantIconKey =
  | "shield"
  | "bot"
  | "sparkles"
  | "star"
  | "clock"
  | "message"
  | "phone"
  | "map";

type AssistantHighlight = {
  icon?: AssistantIconKey;
  title?: string;
  text: string;
};

type AssistantContent = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  highlights?: AssistantHighlight[];
};

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

  instagramUrl?: string;
  facebookUrl?: string;

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

type MenuItem = {
  name: string;
  desc?: string;
  price: number;
  tags?: string[];
  img?: string;
  fav?: boolean;
  url?: string; // link scheda prodotto/polizza
};
type Category = { name: string; items: MenuItem[] };
type Menu = { specials?: { title: string; price: string; badge?: string }[]; categories: Category[] };
type Story = { title?: string; text?: string } | null;

/** Utils */
function telHref(t?: string) {
  return t ? `tel:${t.replace(/\s|\+/g, "").trim()}` : "#";
}
function waHref(t?: string, msg = "") {
  if (!t) return "#";
  const p = t.replace(/\D/g, "");
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}
function getSlug(): string {
  const raw =
    location.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "il-pirata";
  const cleaned = raw.toLowerCase().match(/[a-z0-9-]+/g)?.join("-") || "il-pirata";
  return cleaned;
}

/** Favicon per-locale dal logo */
function applyFavicon(url?: string) {
  if (!url) return;
  const ensure = (rel: string) => {
    let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      document.head.appendChild(el);
    }
    return el;
  };
  const ico = ensure("icon");
  ico.type = "image/png";
  ico.href = url;
  const apple = ensure("apple-touch-icon");
  apple.href = url;
}

/** Tema → CSS vars */
function applyTheme(t?: Config["theme"]) {
  const mode = t?.mode || "light";
  const root = document.documentElement;
  const st = root.style;

  st.setProperty("--accent", t?.accent || "#0f766e");
  st.setProperty("--accentText", t?.accentText || "#ffffff");
  st.setProperty("--radius", t?.radius || "18px");

  const setDefaults = () => {
    st.setProperty("--bgFrom", t?.bgFrom || (mode === "dark" ? "#08090c" : "#eff6ff"));
    st.setProperty("--bgTo", t?.bgTo || (mode === "dark" ? "#10131a" : "#ffffff"));
    st.setProperty("--accent-15", "color-mix(in_oklab, var(--accent), white 85%)");
    st.setProperty("--accent-08", "color-mix(in_oklab, var(--accent), white 92%)");
    st.setProperty("--accent-04", "color-mix(in_oklab, var(--accent), white 96%)");

    if (mode === "dark") {
      st.setProperty("--text", "#e5e7eb");
      st.setProperty("--textSoft", "#cbd5e1");
      st.setProperty("--card", "#14161d");
      st.setProperty("--muted", "#10131a");
      st.setProperty("--border", "rgba(148,163,184,0.18)");
      st.setProperty("--glass", "linear-gradient(160deg, rgba(20,22,29,.88), rgba(20,22,29,.72))");
    } else {
      st.setProperty("--text", "#0f172a");
      st.setProperty("--textSoft", "#475569");
      st.setProperty("--card", "#ffffff");
      st.setProperty("--muted", "#f8fafc");
      st.setProperty("--border", "rgba(15,23,42,0.08)");
      st.setProperty("--glass", "linear-gradient(160deg, rgba(255,255,255,.86), rgba(255,255,255,.74))");
    }
  };

  setDefaults();

  if (t?.cssUrl) {
    let link = document.getElementById("venue-css") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "venue-css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = t.cssUrl;

    link.onload = () => {
      const maybeThemeVars = [
        "--bgFrom",
        "--bgTo",
        "--card",
        "--muted",
        "--border",
        "--text",
        "--textSoft",
      ];
      const comp = getComputedStyle(root);
      for (const v of maybeThemeVars) {
        const fromTheme = comp.getPropertyValue(v).trim();
        if (fromTheme) st.removeProperty(v);
      }
      document.body.style.backgroundColor = comp.getPropertyValue("--bgTo") || "var(--bgTo)";
    };
  }

  if (t?.fontUrl) {
    let link = document.getElementById("venue-font") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "venue-font";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = t.fontUrl;
    let style = document.getElementById("venue-font-style") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "venue-font-style";
      document.body.appendChild(style);
    }
    style.textContent = `body{font-family:${t.fontFamily || "system-ui"};}`;
  }

  document.body.style.backgroundColor = "var(--bgTo)";
}

/** Label “Chiedi al/allo/alla/all’/ai…” */
function makeAskLabel(venueName: string): string {
  const name = (venueName || "").trim();
  if (!name) return "Chiedi all’assistente AI";
  const lower = name.toLowerCase();
  const lapost = /^l['\u2019]/i.test(lower);
  if (lower.startsWith("il ")) return `Chiedi al ${name.slice(3).trim()}`;
  if (lower.startsWith("lo ")) return `Chiedi allo ${name.slice(3).trim()}`;
  if (lower.startsWith("la ")) return `Chiedi alla ${name.slice(3).trim()}`;
  if (lapost) return `Chiedi all\u2019${name.slice(2).trim()}`;
  if (lower.startsWith("i ")) return `Chiedi ai ${name.slice(2).trim()}`;
  if (lower.startsWith("gli ")) return `Chiedi agli ${name.slice(4).trim()}`;
  if (lower.startsWith("le ")) return `Chiedi alle ${name.slice(3).trim()}`;
  return `Chiedi a ${name}`;
}

function resolveBadgeLabel(label?: string | null): string | null {
  if (label === null) return null;
  if (label === "") return null;
  return label ?? "Studio digitale";
}

/** Data loader */
function useVenueData() {
  const [cfg, setCfg] = React.useState<Config | null>(null);
  const [men, setMen] = React.useState<Menu | null>(null);
  const [story, setStory] = React.useState<Story>(null);
  const [assistant, setAssistant] = React.useState<AssistantContent | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const slug = getSlug();
    fetch(`/data/${slug}.json?ts=${Date.now()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((json) => {
        const c = (json.config || {}) as Config;
        const m = (json.menu || {}) as Menu;
        m.categories = Array.isArray(m.categories) ? m.categories : [];
        m.categories = m.categories.map((x) => ({
          name: x.name,
          items: Array.isArray(x.items) ? x.items : [],
        }));

        setCfg(c);
        setMen(m);
        setStory((json.story as Story) ?? null);
        setAssistant((json.assistant as AssistantContent) ?? null);
        applyTheme(c.theme);
        applyFavicon(c.logoUrl);

        const badge = resolveBadgeLabel(c.onlineBadgeLabel);
        document.title = badge ? `${c.name} — ${badge}` : c.name;
      })
      .catch((e) => {
        console.error(e);
        setErr(`Locale non trovato o JSON non valido (${slug})`);
      });
  }, []);

  return { cfg, men, story, assistant, err };
}

/** Helpers */
function formatPrice(value: number) {
  return value.toFixed(2).replace(".", ",");
}

const sectionClass = "mx-auto w-full max-w-5xl px-4";

function extractMenuHighlight(menu?: Menu | null): string | null {
  if (!menu) return null;
  const special = menu.specials?.find((item) => item?.title?.trim());
  if (special?.title) return special.title.trim();

  for (const category of menu.categories || []) {
    const candidate = category.items.find((item) => item?.name?.trim());
    if (candidate?.name) return candidate.name.trim();
  }

  return null;
}

function extractStoryHighlight(story: Story): string | null {
  if (!story) return null;
  const title = story.title?.trim();
  const text = story.text?.trim();

  if (title && text) {
    const firstSentence = text.split(/[.!?]/)[0]?.trim();
    return firstSentence ? `${title}: ${firstSentence}` : title;
  }

  if (title) return title;
  if (!text) return null;
  return text.split(/[.!?]/)[0]?.trim() || null;
}

const sectionTitleContainer = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const sectionTitleItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const sectionTitleUnderline = {
  hidden: { opacity: 0, scaleX: 0 },
  visible: {
    opacity: 1,
    scaleX: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      className="mb-6 max-w-3xl space-y-4"
      variants={sectionTitleContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {eyebrow && (
        <motion.span
          variants={sectionTitleItem}
          className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]"
          style={{ letterSpacing: "0.28em" }}
        >
          {eyebrow}
        </motion.span>
      )}
      <motion.h2
        variants={sectionTitleItem}
        className="mt-2 text-2xl font-semibold"
        style={{ color: "var(--text)" }}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={sectionTitleItem}
          className="mt-2 text-base"
          style={{ color: "var(--textSoft)" }}
        >
          {subtitle}
        </motion.p>
      )}
      <motion.span
        variants={sectionTitleUnderline}
        className="inline-flex h-1 w-16 rounded-full"
        style={{
          transformOrigin: "left",
          background:
            "linear-gradient(90deg, color-mix(in_oklab,var(--accent),transparent 10%) 0%, color-mix(in_oklab,var(--accent),transparent 35%) 45%, transparent 100%)",
        }}
        aria-hidden="true"
      />
    </motion.div>
  );
}

function GradientPanel({
  children,
  className = "",
  innerClassName = "",
  showHoverOverlay = false,
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  showHoverOverlay?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-[calc(var(--radius)*1.08)] p-[1.5px] ${className}`}
      style={{
        background:
          "linear-gradient(135deg, color-mix(in_oklab,var(--accent),transparent 18%) 0%, color-mix(in_oklab,var(--accent),transparent 65%) 55%, transparent 100%)",
      }}
    >
      <div
        className={`relative h-full rounded-[calc(var(--radius)*1.05)] border bg-[var(--card)]/92 p-6 backdrop-blur-sm transition-shadow duration-500 ${innerClassName}`}
        style={{
          borderColor: "color-mix(in_oklab,var(--accent),transparent 78%)",
          boxShadow: "0 35px 80px -45px rgba(15,23,42,0.55)",
        }}
      >
        {showHoverOverlay && (
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in_oklab,var(--accent),transparent 75%) 0%, transparent 45%, color-mix(in_oklab,var(--accent),transparent 88%) 100%)",
            }}
            aria-hidden="true"
          />
        )}
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function Hero({ cfg, badgeLabel }: { cfg: Config; badgeLabel: string | null }) {
  const images = React.useMemo(() => cfg.heroImages?.filter(Boolean) ?? [], [cfg.heroImages]);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % images.length), 6000);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 10% 20%, color-mix(in_oklab,var(--accent),white 40%), transparent 55%)," +
          "radial-gradient(circle at 80% 0%, color-mix(in_oklab,var(--accent),white 15%), transparent 60%)," +
          "linear-gradient(140deg, var(--bgFrom), var(--bgTo))",
      }}
    >
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.08)] mix-blend-multiply" aria-hidden="true" />
      <div className={`${sectionClass} relative z-10 py-16 lg:py-20`}>
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-6">
            {badgeLabel && (
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur"
                style={{
                  color: "var(--accent)",
                  background: "color-mix(in_oklab,var(--accent),transparent 82%)",
                  borderColor: "color-mix(in_oklab,var(--accent),transparent 65%)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" /> {badgeLabel}
              </span>
            )}

            <div className="flex items-center gap-4">
              {cfg.logoUrl ? (
                <div
                  className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[var(--radius)] border bg-[var(--card)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <img
                    src={cfg.logoUrl}
                    alt={`Logo ${cfg.name}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : null}
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: "var(--text)" }}>
                  {cfg.name}
                </h1>
                {cfg.tagline && (
                  <p className="mt-2 text-base leading-relaxed" style={{ color: "var(--textSoft)" }}>
                    {cfg.tagline}
                  </p>
                )}
              </div>
            </div>

            <div
              className="rounded-[var(--radius)] border p-4 shadow-sm"
              style={{
                borderColor: "color-mix(in_oklab,var(--accent),transparent 75%)",
                background: "color-mix(in_oklab,var(--accent),white 90%)",
              }}
            >
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <Bot className="h-5 w-5 flex-none text-[color:var(--accent)]" />
                <div>
                  <p className="font-medium text-[color:var(--text)]">
                    {cfg.assistantLabel || "Assistente AI dedicato"}
                  </p>
                  <p className="mt-1 text-[color:var(--textSoft)]">
                    Risposte immediate su servizi, disponibilità, preventivi e follow-up. L’assistente AI attinge solo
                    dalle informazioni pubblicate da {cfg.name}, così i tuoi clienti hanno sempre un punto di contatto
                    affidabile, 24/7.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {cfg.phone && (
                <a
                  href={telHref(cfg.phone)}
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--card)] px-4 py-3 text-sm font-medium shadow-sm transition hover:shadow-md"
                  style={{ border: "1px solid var(--border)", color: "var(--text)" }}
                >
                  <Phone className="h-4 w-4" /> Chiama subito
                </a>
              )}
              {cfg.whatsapp && (
                <a
                  href={waHref(cfg.whatsapp, cfg.whatsDefaultMsg || "")}
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] px-4 py-3 text-sm font-medium text-[color:var(--accentText)] shadow-sm transition hover:shadow-lg"
                  style={{ background: "var(--accent)" }}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp diretto
                </a>
              )}
              {cfg.mapUrl && (
                <a
                  href={cfg.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border px-4 py-3 text-sm font-medium transition hover:shadow-md"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}
                >
                  <MapPin className="h-4 w-4" /> Indicazioni
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              {cfg.hours && (
                <div className="flex items-start gap-2" style={{ color: "var(--textSoft)" }}>
                  <Clock className="mt-0.5 h-4 w-4 text-[color:var(--accent)]" />
                  <div>
                    <dt className="text-[color:var(--text)] font-medium">Orari</dt>
                    <dd>{cfg.hours}</dd>
                  </div>
                </div>
              )}
              {cfg.address && (
                <div className="flex items-start gap-2" style={{ color: "var(--textSoft)" }}>
                  <MapPin className="mt-0.5 h-4 w-4 text-[color:var(--accent)]" />
                  <div>
                    <dt className="text-[color:var(--text)] font-medium">Location</dt>
                    <dd>{cfg.address}</dd>
                  </div>
                </div>
              )}
            </dl>

            {(cfg.instagramUrl || cfg.facebookUrl) && (
              <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--textSoft)" }}>
                <span>Ci trovi anche su</span>
                {cfg.instagramUrl && (
                  <a
                    href={cfg.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition hover:bg-[var(--card)]"
                    style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    <Instagram className="h-4 w-4" /> Instagram
                  </a>
                )}
                {cfg.facebookUrl && (
                  <a
                    href={cfg.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition hover:bg-[var(--card)]"
                    style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    <Facebook className="h-4 w-4" /> Facebook
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <div
              className="absolute -inset-6 -z-10 rounded-[calc(var(--radius)*1.6)] opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 20% 20%, color-mix(in_oklab,var(--accent),transparent 40%), transparent 70%)",
                boxShadow: "0 60px 120px rgba(15,23,42,0.22)",
              }}
              aria-hidden="true"
            />

            <div
              className="overflow-hidden rounded-[calc(var(--radius)*1.2)] border shadow-2xl"
              style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 70%)" }}
            >
              {images.length ? (
                <div className="relative aspect-[4/5] w-full">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={idx}
                      src={images[idx]}
                      alt={`Gallery ${idx + 1}`}
                      loading="eager"
                      className="h-full w-full object-cover"
                      initial={{ opacity: 0.2, scale: 1.04 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.02 }}
                      transition={{ duration: 0.6 }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </AnimatePresence>
                  {images.length > 1 && (
                    <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setIdx(i)}
                          className={`h-2.5 w-2.5 rounded-full transition ${
                            idx === i ? "bg-white" : "bg-white/50"
                          }`}
                          aria-label={`Mostra immagine ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex aspect-[4/5] w-full items-center justify-center bg-[var(--muted)]"
                  style={{ color: "var(--textSoft)" }}
                >
                  Nessuna immagine disponibile
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StorySection({ story }: { story: Story }) {
  if (!story) return null;
  const highlightSentence = story.text?.split(/[.!?]/).find((sentence) => sentence.trim().length > 0)?.trim();
  return (
    <section className={`${sectionClass} py-14`}>
      <div className="grid gap-6 lg:grid-cols-[0.5fr_1fr]">
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-8 -z-10 opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at 10% 10%, color-mix(in_oklab,var(--accent),transparent 45%) 0%, transparent 60%), radial-gradient(circle at 80% 0%, color-mix(in_oklab,var(--accent),transparent 65%) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />
          <div
            className="relative overflow-hidden rounded-[calc(var(--radius)*1.08)] p-[1.5px]"
            style={{
              background:
                "linear-gradient(140deg, color-mix(in_oklab,var(--accent),transparent 20%) 0%, color-mix(in_oklab,var(--accent),transparent 75%) 65%, transparent 100%)",
            }}
          >
            <div
              className="relative h-full rounded-[calc(var(--radius)*1.05)] border bg-[var(--card)]/90 p-6 backdrop-blur-sm"
              style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 78%)" }}
            >
              <SectionTitle
                eyebrow="identità"
                title={story.title || "Una storia costruita sul territorio"}
                subtitle="Mettiamo in evidenza la visione e la metodologia professionale, perché clienti e partner possano capire da subito l’approccio dello studio."
              />
              {highlightSentence && (
                <blockquote
                  className="rounded-[calc(var(--radius)*0.75)] border-l-4 border-[color:var(--accent)] bg-[color:var(--accent-08)] p-4 text-sm font-medium leading-relaxed text-[color:var(--accent)]"
                >
                  “{highlightSentence}”
                </blockquote>
              )}
            </div>
          </div>
        </div>
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 -translate-y-6 opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at 20% 0%, color-mix(in_oklab,var(--accent),transparent 55%) 0%, transparent 65%), radial-gradient(circle at 85% 20%, color-mix(in_oklab,var(--accent),transparent 65%) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />
          <div
            className="group relative overflow-hidden rounded-[var(--radius)] border bg-[var(--card)]/95 p-6 shadow-xl"
            style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 72%)" }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in_oklab,var(--accent),transparent 75%) 0%, transparent 45%, color-mix(in_oklab,var(--accent),transparent 88%) 100%)",
              }}
            />
            <p className="relative text-base leading-relaxed" style={{ color: "var(--textSoft)" }}>
              {story.text}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpecialsShowcase({ specials }: { specials: Menu["specials"] | undefined }) {
  if (!specials?.length) return null;
  return (
    <section className={`${sectionClass} pb-6`}>
      <GradientPanel innerClassName="md:p-8" showHoverOverlay>
        <SectionTitle
          eyebrow="focus"
          title="In evidenza oggi"
          subtitle="Una selezione rapida di soluzioni e promozioni pensate per rispondere alle richieste più frequenti."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {specials.map((spec, idx) => (
            <div
              key={idx}
              className="rounded-[var(--radius)] border bg-[var(--card)]/95 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 70%)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[color:var(--accent)]">
                    {spec.badge || "Novità"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>
                    {spec.title}
                  </h3>
                </div>
                <span
                  className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-sm font-medium text-[color:var(--accentText)] shadow-sm"
                  style={{
                    boxShadow:
                      "0 18px 35px -22px color-mix(in_oklab,var(--accent),transparent 40%)",
                  }}
                >
                  {spec.price}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--textSoft)" }}>
                L’assistente AI può descriverti modalità, benefit e requisiti di questa proposta: chiedi “Parlami di {spec.title}”
              </p>
            </div>
          ))}
        </div>
      </GradientPanel>
    </section>
  );
}

function ServiceCard({ item }: { item: MenuItem }) {
  const hasImage = Boolean(item.img);
  const [imageFailed, setImageFailed] = React.useState(false);
  const showImage = hasImage && !imageFailed;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-[var(--radius)] border bg-[var(--card)] p-5 shadow-sm"
      style={{
        borderColor: "color-mix(in_oklab,var(--accent),transparent 82%)",
        boxShadow: "0 45px 85px -60px rgba(15,23,42,0.55)",
      }}
    >
      <div className="relative overflow-hidden rounded-[calc(var(--radius)*0.9)] border bg-[var(--muted)]"
        style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 70%)" }}>
        {showImage ? (
          <motion.img
            src={item.img}
            alt={item.name}
            className="h-44 w-full object-cover"
            loading="lazy"
            initial={{ scale: 1.05 }}
            whileHover={{ scale: 1.12 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className="flex h-44 items-center justify-center text-[11px] uppercase tracking-[0.24em]"
            style={{ color: "var(--textSoft)" }}
          >
            Immagine in arrivo
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, color-mix(in_oklab,var(--accent),transparent 65%) 0%, transparent 55%), linear-gradient(135deg, transparent 35%, color-mix(in_oklab,var(--accent),transparent 80%) 100%)",
          }}
        />

        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          {item.fav && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--accent-08)] px-3 py-1 text-[color:var(--accent)]"
            >
              <Star className="h-3.5 w-3.5" /> Preferito
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] px-3 py-1 text-[color:var(--text)] shadow-sm"
          >
            {formatPrice(item.price)} €
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            {item.name}
          </h3>
          {item.desc && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--textSoft)" }}>
              {item.desc}
            </p>
          )}
        </div>

        {!!item.tags?.length && (
          <div className="flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--textSoft)" }}>
            {item.tags?.map((tag, i) => (
              <span
                key={i}
                className="rounded-full border px-3 py-1"
                style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 75%)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--accent)] transition hover:gap-3"
          >
            Approfondisci
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </motion.article>
  );
}

function ServicesSection({
  categories,
  placeholder,
}: {
  categories: Category[];
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCategories = React.useMemo(() => {
    if (!normalizedQuery) return categories;
    return categories
      .map((category) => {
        const items = category.items.filter((item) => {
          const haystack = [
            item.name,
            item.desc,
            ...(item.tags || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        });
        return { ...category, items };
      })
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedQuery]);

  const totalServices = React.useMemo(
    () => categories.reduce((acc, category) => acc + category.items.length, 0),
    [categories],
  );

  const resultCount = React.useMemo(
    () =>
      filteredCategories.reduce(
        (acc, category) => acc + category.items.length,
        0,
      ),
    [filteredCategories],
  );

  const showAll = normalizedQuery === "";
  const placeholderText =
    placeholder?.trim() || "Cerca un servizio, una keyword o un tag…";

  if (!categories.length) return null;
  return (
    <section className={`${sectionClass} py-14`}>
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-5%] -top-24 bottom-[-120px] -z-10 rounded-[calc(var(--radius)*2.4)] opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, color-mix(in_oklab,var(--accent),transparent 78%) 0%, transparent 55%), radial-gradient(circle at 80% 0%, color-mix(in_oklab,var(--accent),transparent 82%) 0%, transparent 60%)",
          }}
        />

        <SectionTitle
          eyebrow="servizi"
          title="Soluzioni guidate dall’esperienza"
          subtitle="Ogni categoria rappresenta un ambito di intervento. L’assistente AI aiuta a scegliere l’opzione più adatta e può raccogliere richieste di appuntamento."
        />

        <div className="mb-10 space-y-4">
          <div
            className="group relative overflow-hidden rounded-[calc(var(--radius)*1.4)] p-[1.5px]"
            style={{
              background: isFocused || query
                ? "linear-gradient(135deg, color-mix(in_oklab,var(--accent),transparent 20%) 0%, color-mix(in_oklab,var(--accent),transparent 70%) 45%, transparent 100%)"
                : "linear-gradient(135deg, color-mix(in_oklab,var(--accent),transparent 82%) 0%, transparent 90%)",
              boxShadow: isFocused || query
                ? "0 45px 120px -60px rgba(15,23,42,0.55)"
                : "0 30px 80px -60px rgba(15,23,42,0.35)",
            }}
          >
            <div
              className="relative flex items-center gap-3 rounded-[calc(var(--radius)*1.35)] border bg-[var(--card)] px-4 py-3 transition"
              style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 70%)" }}
            >
              <div
                className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in_oklab,var(--accent),transparent 84%) 0%, transparent 55%, color-mix(in_oklab,var(--accent),transparent 90%) 100%)",
                }}
                aria-hidden="true"
              />

              <Search
                className="relative h-5 w-5 flex-none text-[color:var(--accent)]"
                strokeWidth={2.2}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholderText}
                className="relative w-full bg-transparent text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--textSoft)]"
                aria-label="Cerca un servizio"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="relative inline-flex items-center rounded-full bg-[color:var(--accent-08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)] transition hover:bg-[color:var(--accent-15)]"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className="text-xs uppercase tracking-[0.24em] text-[color:var(--textSoft)]"
              style={{ letterSpacing: "0.24em" }}
            >
              {showAll
                ? `Esplora ${totalServices} soluzioni professionali`
                : resultCount
                ? `${resultCount} ${resultCount === 1 ? "risultato" : "risultati"} per “${query}”`
                : `Nessun risultato per “${query}”`}
            </p>
            {!showAll && resultCount > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent-08)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" /> Ricerca attiva
              </span>
            )}
          </div>
        </div>

        {!resultCount && !showAll ? (
          <div
            className="rounded-[var(--radius)] border bg-[var(--card)] p-8 text-center shadow-sm"
            style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 78%)" }}
          >
            <p className="text-sm" style={{ color: "var(--textSoft)" }}>
              Nessun servizio corrisponde alla ricerca. Prova con un’altra keyword o contatta l’assistente AI per ricevere
              suggerimenti immediati.
            </p>
          </div>
        ) : null}

        {resultCount || showAll ? (
        <div className="space-y-10">
          {(showAll ? categories : filteredCategories).map((category) => (
            <div key={category.name} className="space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
                  {category.name}
                </h3>
                <span className="text-xs" style={{ color: "var(--textSoft)" }}>
                  {category.items.length} {category.items.length === 1 ? "proposta" : "proposte"}
                </span>
              </div>
              {category.items.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {category.items.map((item, idx) => (
                    <ServiceCard key={`${category.name}-${idx}`} item={item} />
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--textSoft)" }}>
                  Al momento non sono presenti servizi in questa categoria.
                </p>
              )}
            </div>
          ))}
        </div>
        ) : null}
      </div>
    </section>
  );
}

type AssistantSectionProps = {
  cfg: Config;
  menu: Menu | null;
  story: Story;
  assistant: AssistantContent | null;
};

const assistantIcons: Record<AssistantIconKey, React.ComponentType<React.ComponentProps<typeof ShieldCheck>>> = {
  shield: ShieldCheck,
  bot: Bot,
  sparkles: Sparkles,
  star: Star,
  clock: Clock,
  message: MessageCircle,
  phone: Phone,
  map: MapPin,
};

function AssistantSection({ cfg, menu, story, assistant }: AssistantSectionProps) {
  const venueName = cfg.name?.trim() || "il tuo locale";
  const tagline = cfg.tagline?.trim();
  const menuHighlight = extractMenuHighlight(menu);
  const storyHighlight = extractStoryHighlight(story);

  const fallbackTitle = cfg.name?.trim() ? `L’assistente AI di ${cfg.name}` : "Assistente AI dedicato";
  const fallbackSubtitle = tagline
    ? `Risponde con il tono di “${tagline}” e accompagna chi cerca informazioni su ${venueName}.`
    : `Offre risposte puntuali a chi contatta ${venueName} e li guida verso il canale migliore.`;

  const fallbackHighlights = [
    {
      Icon: ShieldCheck,
      title: tagline ? "Coerenza" : undefined,
      text: tagline
        ? `Mantiene la promessa di “${tagline}”, garantendo risposte coerenti con ${venueName}.`
        : `Mantiene allineate le risposte alle informazioni ufficiali di ${venueName}.`,
    },
    {
      Icon: Bot,
      title: menuHighlight ? "Suggerimenti immediati" : undefined,
      text: menuHighlight
        ? `Suggerisce ${menuHighlight} quando i clienti chiedono cosa provare o prenotare.`
        : `Propone servizi e appuntamenti su misura in base alle richieste dei clienti.`,
    },
    {
      Icon: Sparkles,
      title: storyHighlight ? "Storytelling" : undefined,
      text: storyHighlight
        ? `Racconta ${storyHighlight}, trasformando la curiosità in relazioni durature.`
        : `Valorizza storia e offerte del locale per conquistare nuovi clienti.`,
    },
  ];

  const resolvedHighlights = (assistant?.highlights || [])
    .map((item) => {
      const text = item?.text?.trim();
      if (!text) return null;
      const Icon = item.icon ? assistantIcons[item.icon] || Sparkles : Sparkles;
      return {
        Icon,
        title: item.title?.trim(),
        text,
      };
    })
    .filter(Boolean) as { Icon: typeof ShieldCheck; title?: string; text: string }[];

  const highlights = resolvedHighlights.length ? resolvedHighlights : fallbackHighlights;
  const eyebrow = assistant?.eyebrow?.trim() || "assistente";
  const title = assistant?.title?.trim() || fallbackTitle;
  const subtitle = assistant?.subtitle?.trim() || fallbackSubtitle;
  const description = assistant?.description?.trim();

  return (
    <section className={`${sectionClass} py-14`}>
      <div className="grid gap-6 lg:grid-cols-[0.55fr_1fr]">
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-10 -z-10 opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at 5% 20%, color-mix(in_oklab,var(--accent),transparent 40%) 0%, transparent 60%), radial-gradient(circle at 95% 10%, color-mix(in_oklab,var(--accent),transparent 70%) 0%, transparent 75%)",
            }}
            aria-hidden="true"
          />
          <GradientPanel innerClassName="md:p-8">
            <SectionTitle
              eyebrow={eyebrow}
              title={title}
              subtitle={subtitle}
            />
            {description && (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--textSoft)" }}>
                {description}
              </p>
            )}
          </GradientPanel>
        </div>
        <div className="grid gap-4">
          {highlights.map(({ Icon, text, title: bulletTitle }, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-[var(--radius)] border bg-[var(--card)]/95 p-5 shadow-lg"
              style={{
                borderColor: "color-mix(in_oklab,var(--accent),transparent 75%)",
                boxShadow: "0 30px 70px -35px rgba(15,23,42,0.45)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in_oklab,var(--accent),transparent 75%) 0%, transparent 45%, color-mix(in_oklab,var(--accent),transparent 85%) 100%)",
                }}
              />
              <div className="relative flex gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent-08)]">
                  <Icon className="h-5 w-5 text-[color:var(--accent)]" />
                </span>
                <div>
                  {bulletTitle && (
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {bulletTitle}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed" style={{ color: "var(--textSoft)" }}>
                    {text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DetailsFooter({ cfg }: { cfg: Config }) {
  if (!cfg.footerNote && !cfg.lastUpdated && !cfg.allergenNotice?.text) return null;
  const allergenText = cfg.allergenNotice?.text?.trim() ?? "";
  const showAllergen = cfg.allergenNotice?.enabled !== false && allergenText !== "";

  return (
    <section className={`${sectionClass} pb-24 pt-4`}>
      <div className="flex flex-col gap-2 text-xs" style={{ color: "var(--textSoft)" }}>
        {cfg.footerNote && <div>{cfg.footerNote}</div>}
        {(cfg.lastUpdated || showAllergen) && (
          <div>
            {cfg.lastUpdated && <span>Aggiornato il {cfg.lastUpdated}</span>}
            {cfg.lastUpdated && showAllergen && <span> • </span>}
            {showAllergen && <span>{allergenText}</span>}
          </div>
        )}
      </div>
    </section>
  );
}

function StickyActions({ cfg }: { cfg: Config }) {
  const hasPhone = Boolean(cfg.phone);
  const hasWhatsapp = Boolean(cfg.whatsapp);
  const hasMap = Boolean(cfg.mapUrl);
  if (!hasPhone && !hasWhatsapp && !hasMap) return null;

  const cols = [hasPhone, hasWhatsapp, hasMap].filter(Boolean).length;
  const gridClass =
    cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : cols === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:hidden">
      <div
        className={`mx-auto max-w-md ${gridClass} grid gap-2 rounded-[calc(var(--radius)*1.1)] border bg-[var(--glass)] p-3 backdrop-blur shadow-lg`}
        style={{ borderColor: "var(--border)" }}
      >
        {hasPhone && (
          <a
            href={telHref(cfg.phone)}
            className="flex items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--card)] py-3 text-sm font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <Phone className="h-4 w-4" /> Chiama
          </a>
        )}
        {hasWhatsapp && (
          <a
            href={waHref(cfg.whatsapp, cfg.whatsDefaultMsg || "")}
            className="flex items-center justify-center gap-2 rounded-[var(--radius)] py-3 text-sm font-medium text-[color:var(--accentText)]"
            style={{ background: "var(--accent)" }}
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        {hasMap && (
          <a
            href={cfg.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--card)] py-3 text-sm font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <MapPin className="h-4 w-4" /> Indicazioni
          </a>
        )}
      </div>
    </div>
  );
}

export default function SianoVenue() {
  const { cfg, men, story, assistant, err } = useVenueData();

  React.useEffect(() => {
    document.body.style.backgroundColor = "var(--bgTo)";
  }, []);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!cfg || !men)
    return (
      <div className="p-6" style={{ color: "var(--textSoft)" }}>
        Caricamento…
      </div>
    );

  const computedFab = cfg.assistantLabel || makeAskLabel(cfg.name);
  const badgeLabel = resolveBadgeLabel(cfg.onlineBadgeLabel);

  return (
    <div
      className="min-h-screen"
      style={{
        color: "var(--text)",
        background:
          "linear-gradient(180deg, var(--bgFrom) 0%, color-mix(in_oklab,var(--bgFrom),var(--bgTo) 60%) 35%, var(--bgTo) 100%)",
      }}
    >
      <Hero cfg={cfg} badgeLabel={badgeLabel} />
      <main>
        <StorySection story={story} />
        <AssistantSection cfg={cfg} menu={men} story={story} assistant={assistant} />
        <SpecialsShowcase specials={men.specials} />
        <ServicesSection categories={men.categories} placeholder={cfg.searchPlaceholder} />
        <DetailsFooter cfg={cfg} />
      </main>

      <StickyActions cfg={cfg} />

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
