import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Loader2 } from "lucide-react";

const EMBED_URL =
  "https://calendar.google.com/calendar/embed?src=a84618791dd3fab9dcf13b2139591283a18dadefdb01d55cc65b5bfe5ef3b2c4%40group.calendar.google.com&ctz=America%2FSao_Paulo";
const OPEN_URL =
  "https://calendar.google.com/calendar/u/0/r?cid=YTg0NjE4NzkxZGQzZmFiOWRjZjEzYjIxMzk1OTEyODNhMThkYWRlZmRiMDFkNTVjYzY1YjViZmU1ZWYzYjJjNEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&es=3&pli=1";

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  ssr: false,
  component: AdminAgenda,
});

function useNowSaoPaulo() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    // align to next minute
    const msToNextMinute = 60000 - (Date.now() % 60000);
    const timeout = setTimeout(() => {
      tick();
    }, msToNextMinute);
    const interval = setInterval(tick, 60000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
  return now;
}

function AdminAgenda() {
  const now = useNowSaoPaulo();
  const [loaded, setLoaded] = useState(false);

  const weekdayDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(now);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(now);

  return (
    <section className="container-narrow space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl text-sage-deep">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Visualize e acompanhe a agenda da Serenar sem sair do painel administrativo.
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-gold">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-foreground/80">
              Hoje é <span className="font-medium text-sage-deep capitalize">{weekdayDate}</span>
            </p>
            <p className="font-serif text-2xl text-sage-deep">{time}</p>
          </div>
        </div>
        <a
          href={OPEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-serena inline-flex items-center gap-2"
        >
          Abrir no Google Calendar
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="rounded-2xl border border-border bg-blush/40 p-4 text-sm text-sage-deep">
        <p>
          Todos os compromissos continuam sendo administrados diretamente pelo Google Calendar.
          Qualquer alteração realizada lá aparecerá automaticamente nesta tela.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Dica: para criar, editar ou cancelar compromissos, utilize o botão “Abrir no Google
          Calendar”. Esta página é destinada à consulta rápida da agenda.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-cream/60 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando agenda…
          </div>
        )}
        <iframe
          src={EMBED_URL}
          title="Agenda Serenar"
          width="100%"
          frameBorder="0"
          scrolling="no"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          className="block w-full min-h-[600px] md:min-h-[700px] lg:min-h-[800px]"
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Caso a agenda não carregue, utilize o botão “Abrir no Google Calendar”.
      </p>
    </section>
  );
}
