import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CalendarCheck, Users, Sparkles, MessageCircle, TrendingUp, Loader2 } from "lucide-react";
import { adminDashboardStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: Dashboard,
});

type Stats = Awaited<ReturnType<typeof adminDashboardStats>>;

function Dashboard() {
  const fn = useServerFn(adminDashboardStats);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fn().then((s) => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, [fn]);

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Bem-vinda</p>
        <h1 className="font-serif text-4xl text-sage-deep">Painel Serenar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Um olhar rápido sobre o que está acontecendo no seu espaço.
        </p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
        </div>
      ) : !stats ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar os dados agora.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard icon={CalendarCheck} label="Agendamentos hoje" value={stats.appointmentsToday} />
            <KpiCard icon={TrendingUp} label="Agendamentos no mês" value={stats.appointmentsMonth} />
            <KpiCard icon={Users} label="Leads novos" value={stats.leadsNew} accent />
            <KpiCard icon={Users} label="Leads no mês" value={stats.leadsMonth} />
            <KpiCard icon={MessageCircle} label="Conversas IA (mês)" value={stats.aiConversationsMonth} />
          </div>

          <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <h2 className="font-serif text-2xl text-sage-deep">Serviços mais pedidos (mês)</h2>
            </div>
            {stats.topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem agendamentos este mês.</p>
            ) : (
              <ul className="space-y-3">
                {stats.topServices.map((s, i) => {
                  const max = stats.topServices[0].count;
                  const pct = Math.round((s.count / max) * 100);
                  return (
                    <li key={s.service}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="capitalize text-foreground/80">{i + 1}. {s.service.replace(/-/g, " ")}</span>
                        <span className="text-muted-foreground">{s.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-blush">
                        <div className="h-full rounded-full bg-sage-deep transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: number; accent?: boolean }) {
  return (
    <div className={"rounded-2xl border border-border p-5 shadow-soft transition-all hover:shadow-elegant " + (accent ? "bg-sage-deep text-primary-foreground" : "bg-card")}>
      <div className="flex items-center justify-between">
        <p className={"text-xs uppercase tracking-wider " + (accent ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</p>
        <Icon className={"h-4 w-4 " + (accent ? "text-gold" : "text-gold")} />
      </div>
      <p className="mt-3 font-serif text-4xl">{value}</p>
    </div>
  );
}
