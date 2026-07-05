import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { serenaChat } from "@/lib/serena.functions";
import { waMessage } from "@/lib/site-config";

type Msg = { role: "user" | "assistant"; content: string; handoff?: boolean };

const OPENER: Msg = {
  role: "assistant",
  content:
    "Olá, que bom te ver por aqui. Sou a Serená, recepcionista do espaço. Me conta com calma — o que seu corpo está pedindo hoje?",
};

const CHIPS = [
  "Quero agendar",
  "Qual massagem escolher?",
  "Estou com tensão nas costas",
  "Quero drenagem linfática",
  "Ver valores",
  "Falar no WhatsApp",
] as const;

const HANDOFF_URL = waMessage(
  "Olá Mariah! Conversei com a Serená no site e gostaria de receber uma orientação.",
);

export function SerenaChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([OPENER]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const chatFn = useServerFn(serenaChat);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 6000);
    return () => clearTimeout(t);
  }, []);

  async function sendText(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply, handoff } = await chatFn({ data: { messages: next } });
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            reply ||
            "Desculpe, não consegui responder agora. Se preferir, chame a Mariah no WhatsApp — ela te atende com todo o cuidado.",
          handoff: handoff || !reply,
        },
      ]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "Tive um pequeno contratempo por aqui. Se quiser, siga a conversa pelo WhatsApp — a Mariah continua contigo com carinho.",
          handoff: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger + hint bubble */}
      {!open && (
        <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2 md:bottom-8 md:left-8">
          {showHint && messages.length <= 1 && (
            <div className="hidden animate-fade-up rounded-2xl border border-border bg-background/95 px-4 py-2.5 text-sm text-sage-deep shadow-soft backdrop-blur sm:block">
              Olá, posso te ajudar?
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir chat com Serená"
            className="group relative inline-flex items-center gap-2 rounded-full bg-sage-deep px-4 py-3 text-sm text-primary-foreground shadow-elegant transition-transform duration-300 hover:scale-105 animate-soft-pulse"
          >
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="hidden sm:inline">Converse com Serená</span>
            <span className="sm:hidden"><MessageCircle className="h-4 w-4" /></span>
          </button>
        </div>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-4 bottom-4 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-3xl border border-border/70 bg-background/95 shadow-elegant backdrop-blur-xl animate-fade-up md:inset-auto md:bottom-8 md:left-8 md:w-[400px]">
          <div className="flex items-center justify-between border-b border-border/60 bg-cream/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-sage-deep text-gold">
                <Sparkles className="h-4 w-4" />
                <span className="absolute inset-0 rounded-full ring-1 ring-gold/30 animate-breathe" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Recepcionista virtual</p>
                <p className="font-serif text-xl text-sage-deep leading-tight">Serená</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar chat"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 hover:bg-blush transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed animate-fade-in " +
                  (m.role === "user"
                    ? "ml-auto bg-sage-deep text-primary-foreground"
                    : "bg-blush text-foreground")
                }
              >
                {m.content}
                {m.role === "assistant" && m.handoff && (
                  <a
                    href={HANDOFF_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage-deep px-4 py-2.5 text-sm text-primary-foreground shadow-soft transition-transform hover:scale-105"
                  >
                    <span>💬</span>
                    <span>Conversar com a Mariah no WhatsApp</span>
                  </a>
                )}
              </div>
            ))}
            {loading && (
              <div className="max-w-[85%] rounded-2xl bg-blush px-4 py-2.5 text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
                </span>
              </div>
            )}

            {messages.length <= 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {CHIPS.map((c) => (
                  <button key={c} className="chip-serena" onClick={() => sendText(c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-cream/60 px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendText(input))}
                placeholder="Escreva com calma…"
                className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-sage"
                disabled={loading}
              />
              <button
                onClick={() => sendText(input)}
                disabled={loading || !input.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sage-deep text-primary-foreground transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <a
              href={waMessage("Olá Mariah! Estava conversando com a Serená e gostaria de continuar por aqui.")}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-center text-[11px] tracking-wider text-muted-foreground transition-colors hover:text-sage-deep"
            >
              Prefere falar com uma pessoa? Continue no WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}
