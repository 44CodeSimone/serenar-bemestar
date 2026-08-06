import { useRouterState } from "@tanstack/react-router";
import { Sparkles, MessageCircle } from "lucide-react";
import { useState } from "react";
import { SerenaChat } from "./SerenaChat";
import { WhatsappFloat } from "./WhatsappFloat";

/** Routes where public floating actions should NOT appear. */
const HIDDEN_PREFIXES = ["/_authenticated", "/auth"] as const;

export function FloatingContactActions() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [chatOpen, setChatOpen] = useState(false);

  /* ── Route gating ─────────────────────────────────────────── */
  const isHidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  if (isHidden) return null;

  return (
    <>
      {/* Floating group — hidden when chat panel is open */}
      {!chatOpen && (
        <div
          className="fixed bottom-6 left-6 z-40 flex items-end gap-2.5 md:bottom-8 md:left-8"
          style={{
            paddingLeft: "env(safe-area-inset-left, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Serena AI trigger */}
          <button
            onClick={() => setChatOpen(true)}
            aria-label="Abrir chat com Serenar"
            className="group inline-flex items-center gap-2 rounded-full bg-sage-deep px-3.5 py-2.5 text-sm text-primary-foreground shadow-soft transition-all duration-300 hover:shadow-elegant hover:translate-y-[-2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
          >
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="hidden sm:inline text-xs tracking-wide">Falar com Serena</span>
            <span className="sm:hidden">
              <MessageCircle className="h-4 w-4" />
            </span>
          </button>

          {/* WhatsApp */}
          <WhatsappFloat />
        </div>
      )}

      {/* Chat panel */}
      <SerenaChat open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
