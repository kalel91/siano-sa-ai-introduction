import React from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  useMotionTemplate,
  useMotionValueEvent,
  type MotionValue,
  type MotionStyle,
} from "framer-motion";
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
  heroVideoUrl?: string;
  heroOverlays?: string[];
  heroAuroraColors?: string[];
  heroStats?: { label?: string; value?: string; sublabel?: string }[];
  primaryCta?: { label?: string; url?: string; description?: string };
  lastUpdated?: string;
  footerNote?: string;
  assistantLabel?: string;
  assistantHeroDescription?: string;

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
        const heroStats: Config["heroStats"] = Array.isArray(c.heroStats)
          ? c.heroStats.reduce<NonNullable<Config["heroStats"]>>((acc, stat) => {
              if (!stat) return acc;
              const value = typeof stat.value === "string" ? stat.value.trim() : "";
              const label = typeof stat.label === "string" ? stat.label.trim() : "";
              const sublabel =
                typeof stat.sublabel === "string" && stat.sublabel.trim() ? stat.sublabel.trim() : undefined;
              if (!value && !label) return acc;
              acc.push({ value: value || undefined, label: label || undefined, sublabel });
              return acc;
            }, [])
          : [];
        const rawPrimaryCta = c.primaryCta;
        const primaryCtaCandidate =
          rawPrimaryCta && typeof rawPrimaryCta === "object"
            ? {
                label: typeof rawPrimaryCta.label === "string" ? rawPrimaryCta.label.trim() : "",
                url: typeof rawPrimaryCta.url === "string" ? rawPrimaryCta.url.trim() : "",
                description:
                  typeof rawPrimaryCta.description === "string" && rawPrimaryCta.description.trim()
                    ? rawPrimaryCta.description.trim()
                    : undefined,
              }
            : undefined;
        const primaryCta = primaryCtaCandidate && primaryCtaCandidate.label && primaryCtaCandidate.url
          ? primaryCtaCandidate
          : undefined;

        const assistantHeroDescription =
          typeof c.assistantHeroDescription === "string" && c.assistantHeroDescription.trim()
            ? c.assistantHeroDescription.trim()
            : undefined;

        const heroVideoUrl = typeof c.heroVideoUrl === "string" && c.heroVideoUrl.trim()
          ? c.heroVideoUrl.trim()
          : undefined;
        const heroOverlays = Array.isArray(c.heroOverlays)
          ? c.heroOverlays
              .map((overlay) => (typeof overlay === "string" ? overlay.trim() : ""))
              .filter((overlay) => overlay.length > 0)
          : undefined;
        const heroAuroraColors = Array.isArray(c.heroAuroraColors)
          ? c.heroAuroraColors
              .map((color) => (typeof color === "string" ? color.trim() : ""))
              .filter((color) => color.length > 0)
          : undefined;

        const sanitizedConfig: Config = {
          ...c,
          heroVideoUrl,
          heroOverlays,
          heroAuroraColors,
          heroStats,
          primaryCta,
          assistantHeroDescription,
        };
        const m = (json.menu || {}) as Menu;
        m.categories = Array.isArray(m.categories) ? m.categories : [];
        m.categories = m.categories.map((x) => ({
          name: x.name,
          items: Array.isArray(x.items) ? x.items : [],
        }));

        setCfg(sanitizedConfig);
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

type ParallaxLayerProps = {
  factor: number;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  scroll: MotionValue<number>;
  className?: string;
  style?: MotionStyle;
  children?: React.ReactNode;
  disable?: boolean;
};

function ParallaxLayer({
  factor,
  pointerX,
  pointerY,
  scroll,
  className,
  style,
  children,
  disable,
}: ParallaxLayerProps) {
  const strength = disable ? 0 : factor;
  const offsetX = useTransform(pointerX, (value) => value * strength);
  const offsetYPointer = useTransform(pointerY, (value) => value * strength);
  const offsetYScroll = useTransform(scroll, (value) => value * strength * -0.12);
  const transform = useMotionTemplate`translate3d(${offsetX}px, calc(${offsetYPointer}px + ${offsetYScroll}px), 0)`;

  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={{ ...style, transform }}
    >
      {children}
    </motion.div>
  );
}

type AuroraFieldProps = {
  colors: string[];
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  scroll: MotionValue<number>;
  disable?: boolean;
};

function AuroraField({ colors, pointerX, pointerY, scroll, disable }: AuroraFieldProps) {
  const palette = React.useMemo(() => {
    if (!colors.length) {
      return [
        "var(--accent)",
        "color-mix(in_oklab,var(--accent),white 28%)",
        "color-mix(in_oklab,var(--accent),transparent 42%)",
      ];
    }
    return colors;
  }, [colors]);

  const background = React.useMemo(() => {
    const [c1, c2 = c1, c3 = c2] = palette;
    return `radial-gradient(circle at 18% 20%, color-mix(in_oklab, ${c1}, transparent 55%) 0%, transparent 68%),` +
      `radial-gradient(circle at 82% 18%, color-mix(in_oklab, ${c2}, transparent 50%) 0%, transparent 70%),` +
      `radial-gradient(circle at 50% 80%, color-mix(in_oklab, ${c3}, transparent 60%) 0%, transparent 75%)`;
  }, [palette]);

  return (
    <ParallaxLayer
      factor={18}
      pointerX={pointerX}
      pointerY={pointerY}
      scroll={scroll}
      disable={disable}
      className="absolute inset-0 blur-3xl"
      style={{ mixBlendMode: "screen", opacity: 0.65, background }}
    />
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const normalizedEyebrow = React.useMemo(() => {
    if (!eyebrow) return "";
    const compact = eyebrow.trim().replace(/\s+/g, " ");
    return compact.toUpperCase();
  }, [eyebrow]);

  return (
    <div className="mb-6 max-w-3xl space-y-4">
      {normalizedEyebrow && (
        <span className="inline-flex items-center gap-3 text-[11px] font-semibold tracking-[0.32em] text-[color:var(--accent)]">
          <span
            aria-hidden="true"
            className="h-[1px] w-10 bg-[color:var(--accent-08)]"
            style={{ background: "color-mix(in_oklab,var(--accent),transparent 75%)" }}
          />
          <span className="uppercase" style={{ letterSpacing: "0.32em" }}>
            {normalizedEyebrow}
          </span>
        </span>
      )}
      <h2 className="mt-2 text-2xl font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-base" style={{ color: "var(--textSoft)" }}>
          {subtitle}
        </p>
      )}
      <span
        className="inline-flex h-1 w-16 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in_oklab,var(--accent),transparent 10%) 0%, color-mix(in_oklab,var(--accent),transparent 35%) 45%, transparent 100%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function Hero({ cfg, badgeLabel }: { cfg: Config; badgeLabel: string | null }) {
  const images = React.useMemo(() => cfg.heroImages?.filter(Boolean) ?? [], [cfg.heroImages]);
  const heroOverlays = React.useMemo(() => cfg.heroOverlays?.filter(Boolean) ?? [], [cfg.heroOverlays]);
  const auroraColors = React.useMemo(
    () => cfg.heroAuroraColors?.filter(Boolean) ?? [],
    [cfg.heroAuroraColors],
  );
  const [idx, setIdx] = React.useState(0);
  const heroStats = React.useMemo(() => {
    const fallback: { value?: string; label?: string; sublabel?: string }[] = [
      { value: "Risposte in <2 min", label: "Supporto immediato" },
      { value: "+120", label: "Clienti soddisfatti" },
    ];

    if (!cfg.heroStats || cfg.heroStats.length === 0) return fallback;

    return cfg.heroStats
      .map((stat) => {
        const value =
          typeof stat.value === "string" && stat.value.trim().length > 0
            ? stat.value.trim()
            : undefined;
        const label =
          typeof stat.label === "string" && stat.label.trim().length > 0
            ? stat.label.trim()
            : undefined;
        const sublabel =
          typeof stat.sublabel === "string" && stat.sublabel.trim().length > 0
            ? stat.sublabel.trim()
            : undefined;

        return { value, label, sublabel };
      })
      .filter((stat) => stat.value || stat.label || stat.sublabel);
  }, [cfg.heroStats]);

  const primaryCta = React.useMemo((): { label: string; url: string; description?: string } => {
    if (cfg.primaryCta?.label && cfg.primaryCta?.url) {
      return {
        label: cfg.primaryCta.label,
        url: cfg.primaryCta.url,
        description: cfg.primaryCta.description,
      };
    }

    if (cfg.whatsapp) {
      return {
        label: "Scrivici ora su WhatsApp",
        url: waHref(cfg.whatsapp, cfg.whatsDefaultMsg || ""),
        description: "Ricevi risposte immediate dal nostro assistente o dal team in persona.",
      };
    }

    if (cfg.phone) {
      return {
        label: "Parla con un consulente",
        url: telHref(cfg.phone),
        description: "Prenota subito una chiacchierata senza impegno con lo studio.",
      };
    }

    return {
      label: "Scopri come funziona",
      url: "#contattaci",
      description: "Esplora l’assistente AI e scopri perché i clienti lo amano.",
    };
  }, [cfg.primaryCta, cfg.whatsapp, cfg.whatsDefaultMsg, cfg.phone]);
  const primaryCtaUrl = primaryCta.url || "#";
  const primaryCtaIsExternal = /^https?:/i.test(primaryCtaUrl);
  const assistantHeroDescription =
    cfg.assistantHeroDescription ||
    `Risposte immediate su servizi, disponibilità, preventivi e follow-up. L’assistente AI attinge solo dalle informazioni pubblicate da ${cfg.name}, così i tuoi clienti hanno sempre un punto di contatto affidabile, 24/7.`;

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const scrollProgress = useMotionValue(0);
  const pointerXSpring = useSpring(pointerX, { stiffness: 120, damping: 24, mass: 0.6 });
  const pointerYSpring = useSpring(pointerY, { stiffness: 120, damping: 24, mass: 0.6 });
  const scrollSpring = useSpring(scrollProgress, { stiffness: 80, damping: 22, mass: 0.8 });
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (reduceMotion) {
      scrollProgress.set(0);
      return;
    }

    const handleScroll = () => {
      scrollProgress.set(window.scrollY || 0);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollProgress, reduceMotion]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
      const relativeY = (event.clientY - rect.top) / rect.height - 0.5;
      pointerX.set(relativeX * 40);
      pointerY.set(relativeY * 28);
    },
    [pointerX, pointerY, reduceMotion],
  );

  const resetPointer = React.useCallback(() => {
    pointerX.set(0);
    pointerY.set(0);
  }, [pointerX, pointerY]);

  React.useEffect(() => {
    if (!reduceMotion) return;
    resetPointer();
  }, [reduceMotion, resetPointer]);

  React.useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % images.length), 6000);
    return () => clearInterval(id);
  }, [images.length]);

  const hasVideo = Boolean(cfg.heroVideoUrl);
  const heroVideoPoster = React.useMemo(() => images[0] || undefined, [images]);
  const disableParallax = Boolean(reduceMotion);

  return (
    <section
      id="hero"
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 10% 20%, color-mix(in_oklab,var(--accent),white 40%), transparent 55%)," +
          "radial-gradient(circle at 80% 0%, color-mix(in_oklab,var(--accent),white 15%), transparent 60%)," +
          "linear-gradient(140deg, var(--bgFrom), var(--bgTo))",
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      onPointerUp={resetPointer}
      onPointerCancel={resetPointer}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[rgba(15,23,42,0.08)] mix-blend-multiply" />
        <AuroraField
          colors={auroraColors}
          pointerX={pointerXSpring}
          pointerY={pointerYSpring}
          scroll={scrollSpring}
          disable={disableParallax}
        />
        <ParallaxLayer
          factor={10}
          pointerX={pointerXSpring}
          pointerY={pointerYSpring}
          scroll={scrollSpring}
          disable={disableParallax}
          className="absolute -inset-32"
          style={{
            mixBlendMode: "screen",
            opacity: 0.4,
            backgroundImage:
              "radial-gradient(circle at 15% 35%, color-mix(in_oklab,var(--accent),transparent 60%) 0%, transparent 68%)," +
              "radial-gradient(circle at 70% 75%, color-mix(in_oklab,var(--accent),transparent 70%) 0%, transparent 75%)",
          }}
        />
        <ParallaxLayer
          factor={6}
          pointerX={pointerXSpring}
          pointerY={pointerYSpring}
          scroll={scrollSpring}
          disable={disableParallax}
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 60%)," +
              "radial-gradient(circle at 80% 10%, rgba(255,255,255,0.04) 0%, transparent 65%)",
            backgroundSize: "40% 40%, 35% 35%",
            backgroundRepeat: "no-repeat",
            mixBlendMode: "overlay",
            opacity: 0.6,
          }}
        />
        {heroOverlays.map((overlay, index) => (
          <ParallaxLayer
            key={`${overlay}-${index}`}
            factor={4 + index * 2}
            pointerX={pointerXSpring}
            pointerY={pointerYSpring}
            scroll={scrollSpring}
            disable={disableParallax}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${overlay})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              mixBlendMode: index % 2 === 0 ? "screen" : "lighten",
              opacity: 0.55,
            }}
          />
        ))}
      </div>
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

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-[var(--radius)] border bg-[color:var(--card)]/70 p-5 shadow-sm backdrop-blur-sm"
              style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 75%)" }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <a
                  href={primaryCtaUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-[calc(var(--radius)-4px)] px-5 py-3 text-sm font-semibold text-[color:var(--accentText)] shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-transparent hover:shadow-lg"
                  style={{ background: "var(--accent)" }}
                  target={primaryCtaIsExternal ? "_blank" : undefined}
                  rel={primaryCtaIsExternal ? "noreferrer" : undefined}
                >
                  {primaryCta.label}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                {primaryCta.description ? (
                  <p className="text-sm leading-relaxed text-[color:var(--textSoft)] lg:max-w-sm">
                    {primaryCta.description}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {heroStats.map((stat, index) => {
                  const hasValue = Boolean(stat.value);
                  const hasSublabel = Boolean(stat.sublabel);
                  const label = hasValue
                    ? stat.label
                    : hasSublabel
                      ? stat.label
                      : undefined;
                  const description = hasValue
                    ? stat.sublabel
                    : hasSublabel
                      ? stat.sublabel
                      : stat.label;
                  const cardKey =
                    stat.value || stat.label || stat.sublabel || String(index);
                  return (
                    <motion.div
                      key={`${cardKey}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 * index }}
                      className="rounded-[calc(var(--radius)-6px)] border bg-white/60 p-4 shadow-sm dark:bg-white/5"
                      style={{
                        borderColor: "color-mix(in_oklab,var(--accent),transparent 75%)",
                        background:
                          "linear-gradient(160deg, color-mix(in_oklab,var(--accent),white 92%), color-mix(in_oklab,var(--accent),transparent 92%))",
                      }}
                    >
                      {hasValue ? (
                        <span className="block text-xl font-semibold text-[color:var(--text)] sm:text-2xl">
                          {stat.value}
                        </span>
                      ) : null}
                      {label ? (
                        <span
                          className={
                            hasValue
                              ? "mt-1 block text-sm font-medium uppercase tracking-wide text-[color:var(--accent)]"
                              : "block text-sm font-medium text-[color:var(--text)]"
                          }
                        >
                          {label}
                        </span>
                      ) : null}
                      {description ? (
                        <span
                          className={`${
                            hasValue
                              ? "mt-1 block text-xs"
                              : `${label ? "mt-2" : ""} block text-sm leading-relaxed`
                          } text-[color:var(--textSoft)]`}
                        >
                          {description}
                        </span>
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

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
                  <p className="mt-1 text-[color:var(--textSoft)]">{assistantHeroDescription}</p>
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
              {hasVideo ? (
                <div className="relative aspect-[4/5] w-full">
                  <motion.video
                    key={cfg.heroVideoUrl}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full w-full object-cover"
                    src={cfg.heroVideoUrl}
                    poster={heroVideoPoster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    aria-hidden="true"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 mix-blend-screen"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 25%, color-mix(in_oklab,var(--accent),transparent 45%) 0%, transparent 65%)," +
                        "radial-gradient(circle at 80% 70%, color-mix(in_oklab,var(--accent),transparent 55%) 0%, transparent 75%)",
                      opacity: 0.7,
                    }}
                  />
                  <ParallaxLayer
                    factor={8}
                    pointerX={pointerXSpring}
                    pointerY={pointerYSpring}
                    scroll={scrollSpring}
                    disable={disableParallax}
                    className="pointer-events-none absolute inset-0"
                    style={{
                      mixBlendMode: "screen",
                      backgroundImage:
                        "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.18) 0%, transparent 55%)," +
                        "radial-gradient(circle at 70% 20%, rgba(255,255,255,0.1) 0%, transparent 65%)",
                    }}
                  />
                </div>
              ) : images.length ? (
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
    <section id="story" className={`${sectionClass} py-14`}>
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
    <section id="specials" className={`${sectionClass} pb-6`}>
      <div
        className="relative overflow-hidden rounded-[calc(var(--radius)*1.08)] p-[1.5px]"
        style={{
          background:
            "linear-gradient(140deg, color-mix(in_oklab,var(--accent),transparent 22%) 0%, color-mix(in_oklab,var(--accent),transparent 78%) 65%, transparent 100%)",
          boxShadow: "0 40px 120px -80px rgba(15,23,42,0.45)",
        }}
      >
        <div
          className="relative rounded-[calc(var(--radius)*1.05)] border bg-[var(--card)]/95 p-6 shadow-sm"
          style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 78%)" }}
        >
          <SectionTitle
            eyebrow="focus"
            title="In evidenza oggi"
            subtitle="Una selezione rapida di soluzioni e promozioni pensate per rispondere alle richieste più frequenti."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {specials.map((spec, idx) => (
              <div
                key={idx}
                className="rounded-[var(--radius)] border bg-[var(--card)] p-5 shadow-sm transition hover:shadow-lg"
                style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 75%)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--accent)]">
                      {spec.badge || "Novità"}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--text)" }}>
                      {spec.title}
                    </h3>
                  </div>
                  <span
                    className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-sm font-medium text-[color:var(--accentText)]"
                  >
                    {spec.price}
                  </span>
                </div>
                <p className="mt-3 text-sm" style={{ color: "var(--textSoft)" }}>
                  L’assistente AI può descriverti modalità, benefit e requisiti di questa proposta: chiedi “Parlami di {spec.title}”.
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
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
    <section id="services" className={`${sectionClass} py-14`}>
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-5%] -top-24 bottom-[-120px] -z-10 rounded-[calc(var(--radius)*2.4)] opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, color-mix(in_oklab,var(--accent),transparent 78%) 0%, transparent 55%), radial-gradient(circle at 80% 0%, color-mix(in_oklab,var(--accent),transparent 82%) 0%, transparent 60%)",
          }}
        />
        <div
          className="relative mb-10 overflow-hidden rounded-[calc(var(--radius)*1.12)] p-[1.5px]"
          style={{
            background:
              "linear-gradient(140deg, color-mix(in_oklab,var(--accent),transparent 20%) 0%, color-mix(in_oklab,var(--accent),transparent 75%) 60%, transparent 100%)",
            boxShadow: "0 40px 120px -80px rgba(15,23,42,0.45)",
          }}
        >
          <div
            className="relative rounded-[calc(var(--radius)*1.08)] border bg-[var(--card)]/95 p-6 shadow-xl sm:p-8"
            style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 76%)" }}
          >
            <SectionTitle
              eyebrow="servizi"
              title="Soluzioni guidate dall’esperienza"
              subtitle="Ogni categoria rappresenta un ambito di intervento. L’assistente AI aiuta a scegliere l’opzione più adatta e può raccogliere richieste di appuntamento."
            />

            <div className="mt-6 space-y-4">
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
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
    <section id="assistant" className={`${sectionClass} py-14`}>
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
          <div
            className="relative overflow-hidden rounded-[calc(var(--radius)*1.08)] p-[1.5px]"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in_oklab,var(--accent),transparent 18%) 0%, color-mix(in_oklab,var(--accent),transparent 65%) 55%, transparent 100%)",
            }}
          >
            <div
              className="relative h-full rounded-[calc(var(--radius)*1.05)] border bg-[var(--card)]/92 p-6 backdrop-blur-sm"
              style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 78%)" }}
            >
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
            </div>
          </div>
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
    <section id="details" className={`${sectionClass} pb-24 pt-4`}>
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

type FloatingSectionNavProps = {
  sections: { id: string; label: string }[];
  phone?: string;
  whatsapp?: string;
  whatsDefaultMsg?: string;
};

function FloatingSectionNav({ sections, phone, whatsapp, whatsDefaultMsg }: FloatingSectionNavProps) {
  const reduceMotion = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const progressSpring = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 32,
    mass: 0.9,
  });
  const progress = React.useMemo(
    () => (reduceMotion ? scrollYProgress : progressSpring),
    [reduceMotion, scrollYProgress, progressSpring],
  );
  const [activeSection, setActiveSection] = React.useState<string | null>(sections[0]?.id ?? null);
  const activeRef = React.useRef<string | null>(sections[0]?.id ?? null);
  const [isPastFold, setIsPastFold] = React.useState(false);
  const sectionRects = React.useRef<{ id: string; top: number; bottom: number }[]>([]);
  const heroObserved = React.useRef(false);

  const updateSectionRects = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (!sections.length) {
      sectionRects.current = [];
      return;
    }

    sectionRects.current = sections
      .map(({ id }) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const bottom = top + rect.height;
        return { id, top, bottom };
      })
      .filter(Boolean) as { id: string; top: number; bottom: number }[];
  }, [sections]);

  React.useEffect(() => {
    updateSectionRects();

    if (!sections.length) {
      setActiveSection(null);
      activeRef.current = null;
      return;
    }

    const hasActive = sections.some((section) => section.id === activeRef.current);
    if (!hasActive && sections[0]) {
      activeRef.current = sections[0].id;
      setActiveSection(sections[0].id);
    }
  }, [sections, updateSectionRects]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => updateSectionRects();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateSectionRects]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const heroEl = document.getElementById("hero");
    if (!heroEl) {
      heroObserved.current = false;
      setIsPastFold(true);
      return;
    }

    heroObserved.current = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const leavingTop = entry.boundingClientRect.top < 0;
        setIsPastFold(!entry.isIntersecting && leavingTop);
      },
      {
        root: null,
        threshold: [0, 0.05, 1],
        rootMargin: "-64px 0px 0px 0px",
      },
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (typeof window === "undefined") return;

    if (!heroObserved.current) {
      setIsPastFold(latest > window.innerHeight * 0.55);
    }

    if (!sectionRects.current.length) return;
    const viewportProbe = latest + window.innerHeight * 0.3;
    const current =
      sectionRects.current.find((section) => viewportProbe >= section.top && viewportProbe < section.bottom) ||
      (viewportProbe >= sectionRects.current[sectionRects.current.length - 1].bottom
        ? sectionRects.current[sectionRects.current.length - 1]
        : sectionRects.current[0]);

    if (current && current.id !== activeRef.current) {
      activeRef.current = current.id;
      setActiveSection(current.id);
    }
  });

  const scrollToSection = React.useCallback(
    (id: string) => {
      if (typeof window === "undefined") return;
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    },
    [reduceMotion],
  );

  const quickLinks = React.useMemo(() => {
    const items: { id: string; label: string; href: string; Icon: typeof Phone }[] = [];
    if (phone) {
      items.push({ id: "call", label: "Chiama ora", href: telHref(phone), Icon: Phone });
    }
    if (whatsapp) {
      items.push({
        id: "whatsapp",
        label: "Scrivi su WhatsApp",
        href: waHref(whatsapp, whatsDefaultMsg || ""),
        Icon: MessageCircle,
      });
    }
    return items;
  }, [phone, whatsapp, whatsDefaultMsg]);

  const shouldRender = isPastFold && sections.length > 0;

  return (
    <AnimatePresence>
      {shouldRender && (
        <motion.aside
          key="floating-nav"
          className="pointer-events-none fixed right-4 top-[clamp(96px,18vh,220px)] z-40 hidden md:block lg:right-6"
          initial={reduceMotion ? false : { opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
            className="pointer-events-auto w-64 max-w-[75vw] rounded-[calc(var(--radius)*1.1)] border bg-[var(--card)]/90 p-4 shadow-2xl backdrop-blur"
            style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 75%)" }}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
          <nav role="navigation" aria-label="Navigazione sezioni" className="flex flex-col gap-4">
            <div className="relative pl-6">
              <div
                aria-hidden="true"
                className="absolute left-2 top-2 bottom-2 w-px rounded-full bg-[color:var(--border)]"
              />
              <motion.div
                aria-hidden="true"
                className="absolute left-2 top-2 bottom-2 w-px rounded-full bg-[color:var(--accent)]"
                style={{ scaleY: progress, transformOrigin: "top center" }}
              />
              <ul className="flex flex-col gap-1">
                {sections.map((section) => {
                  const isActive = section.id === activeSection;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full rounded-[calc(var(--radius)*0.85)] px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                          isActive
                            ? "bg-[color:var(--accent-08)] text-[color:var(--accent)] shadow-sm"
                            : "text-[color:var(--textSoft)] hover:bg-[color:var(--accent-04)] hover:text-[color:var(--text)]"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {section.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {quickLinks.length > 0 && (
              <div className="mt-2 border-t border-[color:var(--border)] pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--textSoft)]">
                  Contatti rapidi
                </span>
                <div className="mt-3 flex flex-col gap-2">
                  {quickLinks.map(({ id, label, href, Icon }) => (
                    <a
                      key={id}
                      href={href}
                      className="inline-flex items-center gap-2 rounded-[calc(var(--radius)*0.85)] border px-3 py-2 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                      style={{ borderColor: "color-mix(in_oklab,var(--accent),transparent 70%)" }}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </nav>
        </motion.div>
      </motion.aside>
      )}
    </AnimatePresence>
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
  const showDetailsFooter = React.useMemo(() => {
    const allergenText = cfg.allergenNotice?.text?.trim() ?? "";
    const showAllergen = cfg.allergenNotice?.enabled !== false && allergenText !== "";
    return Boolean(cfg.footerNote || cfg.lastUpdated || showAllergen);
  }, [cfg.allergenNotice, cfg.footerNote, cfg.lastUpdated]);
  const navSections = React.useMemo(() => {
    const sectionsList: { id: string; label: string }[] = [];
    if (story) {
      sectionsList.push({ id: "story", label: "La nostra storia" });
    }
    sectionsList.push({ id: "assistant", label: "Assistente AI" });
    if (men.specials?.length) {
      sectionsList.push({ id: "specials", label: "In evidenza" });
    }
    if (men.categories?.length) {
      sectionsList.push({ id: "services", label: "Servizi" });
    }
    if (showDetailsFooter) {
      sectionsList.push({ id: "details", label: "Dettagli" });
    }
    return sectionsList;
  }, [men.categories?.length, men.specials?.length, showDetailsFooter, story]);

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
      <FloatingSectionNav
        sections={navSections}
        phone={cfg.phone}
        whatsapp={cfg.whatsapp}
        whatsDefaultMsg={cfg.whatsDefaultMsg}
      />
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
