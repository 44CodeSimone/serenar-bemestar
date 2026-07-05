import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Phone, MessageCircle, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SITE } from "@/lib/site-config";

export const Route = createFileRoute("/_authenticated/admin/agendamentos")({
  ssr: false,
  component: AdminAppointments,
});

type Appt = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  service: string;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  internal_notes: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["Novo", "Confirmado", "Em atendimento", "Concluído", "Cancelado", "Não compareceu"];

export default function AdminAppointments() {
  const [items, setItems] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Appt[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    await supabase.from("appointments").update({ status }).eq("id", id);
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  async function updateNotes(id: string, internal_notes: string) {
    await supabase.from("appointments").update({ internal_notes }).eq("id", id);
  }

  const filtered = filter === "todos" ? items : items.filter((a) => a.status === filter);

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Agendamentos</p>
          <h1 className="font-serif text-4xl text-sage-deep">Pedidos recebidos</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-sage"
          >
            <option value="todos">Todos</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="pending">Pending (legado)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum agendamento nesta seleção ainda.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-serif text-xl text-sage-deep">{a.full_name}</h3>
                    <span className="text-xs uppercase tracking-wider text-gold">{a.service.replace(/-/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.preferred_date ? new Date(a.preferred_date).toLocaleDateString("pt-BR") : "sem data"}
                    {a.preferred_time ? ` • ${a.preferred_time}` : ""}
                    {" • recebido em "}{new Date(a.created_at).toLocaleString("pt-BR")}
                  </p>
                  {a.notes && <p className="mt-3 rounded-xl bg-blush/40 p-3 text-sm text-foreground/80">{a.notes}</p>}
                  <textarea
                    defaultValue={a.internal_notes ?? ""}
                    onBlur={(e) => updateNotes(a.id, e.target.value)}
                    placeholder="Observações internas (só para você)…"
                    className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                    rows={2}
                  />
                </div>
                <div className="flex flex-col items-stretch gap-2 md:min-w-[220px]">
                  <select
                    value={a.status}
                    onChange={(e) => updateStatus(a.id, e.target.value)}
                    className="rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                  >
                    {[a.status, ...STATUSES.filter((s) => s !== a.status)].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <a
                    href={SITE.whatsapp.link}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[oklch(0.62_0.16_150)] px-4 py-2 text-xs text-white transition-transform hover:scale-105"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp {a.phone}
                  </a>
                  {a.email && (
                    <a href={`mailto:${a.email}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-sage-deep hover:bg-blush">
                      <Phone className="h-3.5 w-3.5" /> {a.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Contato do espaço: {SITE.whatsapp.display}
      </p>
    </div>
  );
}
