import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Clock, X } from "lucide-react";
import { SERVICES, type Service } from "@/lib/services";
import { LeafMark } from "@/components/site/Logo";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Massoterapia e rituais de bem-estar | Serenar" },
      {
        name: "description",
        content:
          "Massagem relaxante, terapêutica, drenagem linfática, pedras quentes, spa dos pés e mais. Conheça todos os rituais de bem-estar do Serenar em Urubici/SC.",
      },
      { property: "og:title", content: "Serviços | Serenar" },
      { property: "og:description", content: "Rituais de autocuidado feitos com mãos que escutam." },
    ],
  }),
  component: Servicos,
});

function Servicos() {
  const [active, setActive] = useState<Service | null>(null);

  return (
    <>
      <section className="container-narrow py-16 md:py-24 text-center">
        <p className="eyebrow mb-3">Rituais Serenar</p>
        <h1 className="display-serif text-5xl md:text-6xl">
          Serviços de <span className="italic text-sage">bem-estar</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
          Cada modalidade tem seu propósito. Escolha o que seu corpo pede hoje —
          ou fale com a Serená e ela ajuda você a decidir.
        </p>
      </section>

      <section className="container-narrow pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <button
              key={s.slug}
              onClick={() => setActive(s)}
              className="card-serena group text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gold flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />{s.duration}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl text-sage-deep">{s.name}</h3>
                </div>
                <LeafMark className="h-6 w-6 text-gold/60 transition-transform group-hover:rotate-12" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{s.short}</p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-sage-deep">
                Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Detail modal */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-sage-deep/40 backdrop-blur-sm md:items-center"
          onClick={() => setActive(null)}
        >
          <div
            className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-background p-8 shadow-elegant animate-fade-up md:rounded-3xl md:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActive(null)}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground/60 hover:bg-blush"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="eyebrow">{active.duration}</p>
            <h2 className="mt-2 font-serif text-4xl text-sage-deep">{active.name}</h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">{active.description}</p>

            <div className="mt-8 space-y-6">
              <Block title="Benefícios">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {active.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="Contraindicações">
                <p className="text-sm text-muted-foreground">{active.contraindications}</p>
              </Block>
              <Block title="Preparação">
                <p className="text-sm text-muted-foreground">{active.preparation}</p>
              </Block>
              <Block title="Pós-sessão">
                <p className="text-sm text-muted-foreground">{active.aftercare}</p>
              </Block>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/agendamento"
                search={{ service: active.slug }}
                className="btn-serena"
              >
                Agendar este ritual <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={() => setActive(null)} className="btn-serena-outline">
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      {children}
    </div>
  );
}
