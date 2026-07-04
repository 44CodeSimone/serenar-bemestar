import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { serenaChat } from "@/lib/serena.functions";
import { SITE, waMessage } from "@/lib/site-config";

type Msg = { role: "user" | "assistant"; content: string };

const OPENER: Msg = {
  role: "assistant",
  content:
    "Olá, sou a Serená, recepcionista virtual do espaço. Estou aqui para te acolher — me conta o que está buscando hoje?",
};

export function SerenaChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([OPENER]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const chatFn = useServerFn(serenaChat);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await chatFn({ data: { messages: next } });
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            reply ||
            "Desculpe, não consegui responder agora. Se preferir, chame a Mariah no WhatsApp.",
        },
      ]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "Tive um pequeno contratempo por aqui. Se quiser, siga a conversa pelo WhatsApp — a Mariah te atende com todo o cuidado.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir chat com Serená"
        className={
          "fixed bottom-6 left-6 z-50 inline-flex items-center gap-2 rounded-full bg-sage-deep px-4 py-3 text-sm text-primary-foreground shadow-elegant transition-all hover:scale-105 md:bottom-8 md:left-8 " +
          (open ? "hidden" : "flex")
        }
      >
        <Sparkles className="h-4 w-4 text-gold" />
        <span className="hidden sm:inline">Converse com Serená</span>
        <span className="sm:hidden"><MessageCircle className="h-4 w-4" /></span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-4 bottom-4 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-elegant animate-fade-up md:inset-auto md:bottom-8 md:left-8 md:w-[380px]">
          <div className="flex items-center justify-between border-b border-border bg-cream px-5 py-4">
            <div>
              <p className="eyebrow">Recepcionista virtual</p>
              <p className="font-serif text-xl text-sage-deep">Serená</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar chat"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 hover:bg-blush"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-background/70 px-5 py-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
                  (m.role === "user"
                    ? "ml-auto bg-sage-deep text-primary-foreground"
                    : "bg-blush text-foreground")
                }
              >
                {m.content}
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
          </div>

          <div className="border-t border-border bg-cream/70 px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Escreva com calma…"
                className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-sage"
                disabled={loading}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sage-deep text-primary-foreground transition-colors disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <a
              href={waMessage(`Olá Mariah! Estava conversando com a Serená e gostaria de continuar por aqui.`)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-center text-[11px] tracking-wider text-muted-foreground hover:text-sage-deep"
            >
              Prefere falar com uma pessoa? Continue no WhatsApp {SITE.whatsapp.display}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
