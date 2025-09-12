import React from "react";
import { motion } from "framer-motion";
import ChatWidget from "./ChatWidget";
import { MapPin, ExternalLink } from "lucide-react";

type HomeJson = {
  cityName: string;
  logoUrl?: string;

  heroTitle: string;
  heroSubtitle?: string;
  heroImages?: string[];

  about?: { title?: string; text?: string };
  project?: { title?: string; text?: string };

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

function applyHomeFavicon(url?: string) {
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

function applyHomeTheme(t?: HomeJson["theme"]) {
  const root = document.documentElement.style;
  root.setProperty("--accent", t?.accent || "#0f766e");
  root.setProperty("--accentText", t?.accentText || "#ffffff");
  root.setProperty("--bgFrom", t?.bgFrom || "#f4f7fb");
  root.setProperty("--bgTo", t?.bgTo || "#ffffff");
  root.setProperty("--text", "#0f172a");
  root.setProperty("--textSoft", "#475569");
  root.setProperty("--card", "#ffffff");
  root.setProperty("--muted", "#f8fafc");
  root.setProperty("--border", "#e5e7eb");
}

function useHomeData() {
  const [cfg, setCfg] = React.useState<HomeJson | null>(null);
  const [venues, setVenues] = React.useState<Venue[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const home = await fetch(`/data/home.json?ts=${Date.now()}`).then((r) =>
          r.ok ? r.json() : Promise.reject(r.status)
        );
        const h = home as HomeJson;
        setCfg(h);
        applyHomeTheme(h.theme);
        applyHomeFavicon(h.logoUrl);

        const jsonUrl = h?.openData?.jsonUrl || "/data/venues.json";
        try {
          const v = await fetch(`${jsonUrl}?ts=${Date.now()}`).then((r) =>
            r.ok ? r.json() : Promise.reject(r.status)
          );
          if (Array.isArray(v)) setVenues(v as Venue[]);
        } catch {
          setVenues([]);
        }
        document.title = `${h.cityName} — Progetto AI`;
      } catch (e) {
        console.error(e);
        setErr("Impossibile caricare la homepage (home.json).");
      }
    })();
  }, []);

  return { cfg, venues, err };
}

const glow = "0 12px 36px -12px color-mix(in_oklab,var(--accent),transparent 75%)";

export default function HomePage() {
  const { cfg, venues, err } = useHomeData();
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!cfg) return <div className="p-6" style={{ color: "var(--textSoft)" }}>Caricamento…</div>;

  const homeAssistantOpening =
    cfg.assistant?.initialMessage ||
    `Ciao! Sono l’assistente del Comune di ${cfg.cityName}. Posso darti informazioni su storia, progetto, servizi e attività aderenti. Scrivi una domanda o scegli un argomento.`;

  return (
    <div
      className="min-h-screen"
      style={{
        color: "var(--text)",
        backgroundImage: `
          radial-gradient(1200px 800px at 70% -10%, var(--bgFrom), var(--bgTo)),
          radial-gradient(600px 400px at -10% 20%, color-mix(in_oklab,var(--accent),white 92%), transparent),
          radial-gradient(700px 500px at 110% 80%, color-mix(in_oklab,var(--accent),white 94%), transparent)
        `,
      }}
    >
      <header className="mx-auto max-w-5xl px-4 pt-10 pb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--textSoft)" }}>
            <MapPin className="w-4 h-4" />
            <span>{cfg.cityName}</span>
          </div>

          {cfg.logoUrl && (
            <div
              className="w-10 h-10 rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--muted)" }}
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
        </div>

        <h1 className="mt-4 text-3xl sm:text-4xl font-bold">{cfg.heroTitle}</h1>
        {cfg.heroSubtitle && (
          <p className="mt-2 text-lg" style={{ color: "var(--textSoft)" }}>
            {cfg.heroSubtitle}
          </p>
        )}

        {!!cfg.heroImages?.length && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cfg.heroImages!.slice(0, 3).map((src, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-xl overflow-hidden border"
                style={{ borderColor: "var(--border)", boxShadow: glow }}
              >
                <img
                  src={src}
                  alt={`siano-${i + 1}`}
                  className="w-full h-44 object-cover"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                />
              </motion.div>
            ))}
          </div>
        )}
      </header>

      <section className="mx-auto max-w-5xl px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {cfg.about && (
          <div className="rounded-xl p-5 border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <h2 className="font-semibold text-lg">{cfg.about.title || "La storia"}</h2>
            {cfg.about.text && (
              <p className="mt-2 text-sm" style={{ color: "var(--textSoft)" }}>
                {cfg.about.text}
              </p>
            )}
          </div>
        )}
        {cfg.project && (
          <div className="rounded-xl p-5 border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <h2 className="font-semibold text-lg">{cfg.project.title || "Il progetto"}</h2>
            {cfg.project.text && (
              <p className="mt-2 text-sm" style={{ color: "var(--textSoft)" }}>
                {cfg.project.text}
              </p>
            )}
          </div>
        )}
      </section>

      {!!cfg.gallery?.length && (
        <section className="mx-auto max-w-5xl px-4 mt-8">
          <h3 className="font-semibold mb-3">Siano in immagini</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cfg.gallery!.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`gallery-${i}`}
                className="w-full h-32 object-cover rounded-xl border"
                style={{ borderColor: "var(--border)" }}
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-5xl px-4 mt-10">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold">Esercenti aderenti</h3>
          {cfg.openData?.jsonUrl && (
            <a
              href={cfg.openData.jsonUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm underline"
              style={{ color: "var(--textSoft)" }}
            >
              Open data <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {venues.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--textSoft)" }}>
            Nessun esercente pubblicato (ancora).
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((v) => (
              <a
                key={v.slug}
                href={`/${v.slug}`}
                className="group rounded-xl p-4 border block"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl border overflow-hidden"
                    style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                  >
                    {v.logoUrl ? (
                      <img
                        src={v.logoUrl}
                        alt={`${v.name} logo`}
                        className="w-full h-full object-cover"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{v.name}</div>
                    {v.tagline && (
                      <div className="text-xs truncate" style={{ color: "var(--textSoft)" }}>
                        {v.tagline}
                      </div>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {(cfg.social?.website || cfg.social?.facebook || cfg.social?.instagram) && (
        <section className="mx-auto max-w-5xl px-4 mt-10">
          <h3 className="font-semibold mb-2">Collegamenti</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {cfg.social?.website && (
              <a className="underline" href={cfg.social.website} target="_blank" rel="noreferrer">
                Sito istituzionale
              </a>
            )}
            {cfg.social?.facebook && (
              <a className="underline" href={cfg.social.facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
            )}
            {cfg.social?.instagram && (
              <a className="underline" href={cfg.social.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
            )}
          </div>
        </section>
      )}

      <footer className="mx-auto max-w-5xl px-4 py-12 text-xs mt-10" style={{ color: "var(--textSoft)" }}>
        {cfg.footer?.note && <div>{cfg.footer.note}</div>}
        {cfg.footer?.updated && <div>Aggiornato: {cfg.footer.updated}</div>}
      </footer>

      {cfg.assistant?.enabled && (
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
