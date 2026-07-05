import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  ssr: false,
  component: AdminLeads,
});

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  interest: string | null;
  service: string | null;
  source: string;
  status: string;
  consent: boolean;
  notes: string | null;
  created_at: string;
};

const STATUSES = ["novo", "interessado", "em atendimento", "agendado", "cliente", "inativo", "arquivado"];

export default function AdminLeads() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as Lead[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    await supabase.from("leads").update({ status }).eq("id", id);
    setItems((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  }

  async function remove(id: string) {
    if (!confirm("Excluir este lead?")) return;
    await supabase.from("leads").delete().eq("id", id);
    setItems((prev) => prev.filter((l) => l.id !== id));
  }

  const filtered = filter === "todos" ? items : items.filter((l) => l.status === filter);

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">CRM</p>
          <h1 className="font-serif text-4xl text-sage-deep">Leads</h1>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-sage"
        >
          <option value="todos">Todos</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum lead nesta seleção ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-cream/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Interesse</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Status</th>
                <th className="p-3">Data</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-medium text-sage-deep">{l.name}</td>
                  <td className="p-3 text-xs">
                    {l.phone && (
                      <a href={SITE.whatsapp.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[oklch(0.55_0.15_150)] hover:underline">
                        <MessageCircle className="h-3 w-3" /> {l.phone}
                      </a>
                    )}
                    {l.email && <div className="text-muted-foreground">{l.email}</div>}
                  </td>
                  <td className="p-3 text-xs">{l.service || l.interest || "—"}</td>
                  <td className="p-3 text-xs capitalize text-muted-foreground">{l.source}</td>
                  <td className="p-3">
                    <select
                      value={l.status}
                      onChange={(e) => updateStatus(l.id, e.target.value)}
                      className="rounded-full border border-border bg-background px-2 py-1 text-xs capitalize outline-none focus:border-sage"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">
                    <button onClick={() => remove(l.id)} className="text-destructive hover:opacity-70" aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
