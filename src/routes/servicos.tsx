import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock, X } from "lucide-react";
import { listPublicServices, serviceBenefitsToArray, type PublicService } from "@/lib/services.repository";
import { LeafMark } from "@/components/site/Logo";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "ServiÃ§os â€” Massoterapia e rituais de bem-estar | Serenar" },
      {
        name: "description",
        content:
          "Massagem relaxante, terapÃªutica, drenagem linfÃ¡tica, pedras quentes, spa dos pÃ©s e mais. ConheÃ§a todos os rituais de bem-estar do Serenar em Urubici/SC.",
      },
      { property: "og:title", content: "ServiÃ§os | Serenar" },
      { property: "og:description", content: "Rituais de autocuidado feitos com mÃ£os que escutam." },
    ],
  }),
  component: Servicos,
});

function Servicos() {
    const [services, setServices] = useState<PublicService[]>([]);
  const [active, setActive] = useState<PublicService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadServices() {
      try {
        const data = await listPublicServices();

        if (mounted) {
          setServices(data);
          setError(null);
        }
      } catch {
        if (mounted) {
          setError("Não foi possível carregar os serviços no momento.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadServices();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <section className="container-narrow py-16 md:py-24 text-center">
        <p className="eyebrow mb-3">Rituais Serenar</p>
        <h1 className="display-serif text-5xl md:text-6xl">
          ServiÃ§os de <span className="italic text-sage">bem-estar</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-muted-foreground">
          Cada modalidade tem seu propÃ³sito. Escolha o que seu corpo pede hoje â€”
          ou fale com a SerenÃ¡ e ela ajuda vocÃª a decidir.
        </p>
      </section>

      <section className="container-narrow pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground shadow-soft">
              Carregando serviços...
            </div>
          ) : error ? (
            <div className="col-span-full rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground shadow-soft">
              {error}
            </div>
          ) : services.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground shadow-soft">
              Nenhum serviço disponível no momento.
            </div>
          ) : services.map((s) => (
            <button
              key={s.slug}
              onClick={() => setActive(s)}
              className="card-serena group text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gold flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />{s.duration ?? "Duração sob consulta"}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl text-sage-deep">{s.name}</h3>
                </div>
                <LeafMark className="h-6 w-6 text-gold/60 transition-transform group-hover:rotate-12" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{s.short_description ?? "Conheça os detalhes deste ritual de bem-estar."}</p>
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
            <p className="eyebrow">{active.duration ?? "Duração sob consulta"}</p>
            <h2 className="mt-2 font-serif text-4xl text-sage-deep">{active.name}</h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">{active.description ?? active.short_description}</p>

            <div className="mt-8 space-y-6">
              <Block title="BenefÃ­cios">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {serviceBenefitsToArray(active.benefits).map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="ContraindicaÃ§Ãµes">
                <p className="text-sm text-muted-foreground">{active.contraindications ?? "Consulte a Mariah para orientações específicas antes da sessão."}</p>
              </Block>
              <Block title="PreparaÃ§Ã£o">
                <p className="text-sm text-muted-foreground">{active.preparation ?? "Venha com roupas confortáveis e alguns minutos de antecedência."}</p>
              </Block>
              <Block title="PÃ³s-sessÃ£o">
                <p className="text-sm text-muted-foreground">{active.aftercare ?? "Beba água e respeite o tempo de descanso do seu corpo após a sessão."}</p>
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


