// src/ChatWidget.tsx
import React from "react";
import { MessageCircle, X, SendHorizonal, Phone, MapPin } from "lucide-react";
import { askMenu } from "./ai/ask";
import type { MenuJson } from "./ai/ask";


type Props = { slug: string; phone?: string; mapsUrl?: string };

export default function ChatWidget({ slug, phone, mapsUrl }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Ciao! Posso aiutarti a scegliere dal menu: dimmi cosa ti va (es. 'piccante', 'senza lattosio', 'con salsiccia')." }
  ]);
  const dataRef = React.useRef<MenuJson | null>(null);

  // carica il JSON del locale
  React.useEffect(() => {
    fetch(`/data/${slug}.json?ts=${Date.now()}`)
      .then(r => r.json())
      .then((json) => { dataRef.current = json as MenuJson; })
      .catch(() => { /* ignora, mostreremo messaggio di errore alla domanda */ });
  }, [slug]);

  async function onSend() {
    const q = input.trim();
    if (!q) return;
    setInput("");
    setHistory(h => [...h, { role: "user", text: q }]);
    if (!dataRef.current) {
      setHistory(h => [...h, { role: "assistant", text: "Non riesco a leggere il menu in questo momento. Riprova tra poco." }]);
      return;
    }
    setLoading(true);

    try {
      const { answer, used } = await askMenu(q, dataRef.current, {
        // AI opzionale: leggi da env (se non impostato resta in 'local')
        provider: import.meta.env.VITE_AI_PROVIDER as any,        // "huggingface" | "local"
        hfToken: import.meta.env.VITE_HF_TOKEN,                   // string | undefined
        hfModel: import.meta.env.VITE_HF_MODEL || "HuggingFaceH4/zephyr-7b-beta"
      });
      setHistory(h => [...h, { role: "assistant", text: answer + (used === "local" ? "\n\n(Modalità gratuita)" : "") }]);
    } catch {
      setHistory(h => [...h, { role: "assistant", text: "Si è verificato un problema. Prova di nuovo." }]);
    } finally {
      setLoading(false);
    }
  }

  function Quick({ label }: { label: string }) {
    return (
      <button onClick={() => { setInput(label); setTimeout(onSend, 0); }}
        className="text-xs px-2 py-1 rounded-full bg-slate-100 border border-slate-200 hover:bg-white">
        {label}
      </button>
    );
  }

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg px-4 py-3 text-white"
          style={{ background: "var(--accent, #10b981)" }}
          aria-label="Apri chat"
        >
          <MessageCircle className="inline w-5 h-5 mr-2" />
          Chiedi al menu
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(420px,90vw)] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="font-semibold">Assistente menu</div>
            <button className="p-1 rounded hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Chiudi">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
            <Quick label="Consigli piccanti" />
            <Quick label="Senza lattosio" />
            <Quick label="Vegetariano" />
            <Quick label="Promo del giorno" />
            <Quick label="Orari di apertura" />
          </div>

          <div className="px-4 h-64 overflow-y-auto space-y-3">
            {history.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "assistant" ? "text-slate-800" : "text-slate-900"}`}>
                {m.role === "user" ? <div className="font-semibold">Tu:</div> : <div className="text-slate-500">Assistente:</div>}
                <pre className="whitespace-pre-wrap leading-relaxed">{m.text}</pre>
              </div>
            ))}
            {loading && <div className="text-sm text-slate-500">Sto pensando…</div>}
          </div>

          <div className="px-4 pt-2 pb-3 border-t border-slate-200 space-y-2">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scrivi una domanda…"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200"
                onKeyDown={(e) => e.key === "Enter" && onSend()}
              />
              <button onClick={onSend} className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">
                <SendHorizonal className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 text-xs">
              {phone && (
                <a href={`tel:${phone.replace(/\s|\+/g, "")}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <Phone className="w-3 h-3" /> Chiama
                </a>
              )}
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <MapPin className="w-3 h-3" /> Indicazioni
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
