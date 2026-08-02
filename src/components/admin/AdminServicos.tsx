import { useEffect, useState } from "react";
import { Loader2, Star, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Service = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  duration: string | null;
  price_label: string | null;
  display_order: number;
  featured: boolean;
  active: boolean;
};

export default function AdminServicos() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, Partial<Service>>>({});
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setFeedback(null);
    const { data, error } = await supabase.from("services").select("*").order("display_order");
    if (error) {
      setFeedback("Não foi possível carregar os serviços. Tente novamente.");
    } else {
      setItems((data ?? []) as Service[]);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function edit(id: string, patch: Partial<Service>) {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveAll() {
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    const failed: Record<string, Partial<Service>> = {};
    for (const [id, patch] of Object.entries(dirty)) {
      const { error } = await supabase
        .from("services")
        .update(patch)
        .eq("id", id)
        .select("id")
        .single();
      if (error) failed[id] = patch;
    }
    setDirty(failed);
    setFeedback(
      Object.keys(failed).length === 0
        ? "Alterações salvas com sucesso."
        : "Não foi possível salvar todas as alterações. Revise e tente novamente.",
    );
    setSaving(false);
  }

  async function addNew() {
    if (adding) return;
    const name = prompt("Nome do novo serviço:");
    if (!name) return;
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setAdding(true);
    setFeedback(null);
    const { data, error } = await supabase
      .from("services")
      .insert({ slug, name, display_order: (items.at(-1)?.display_order ?? 0) + 1 })
      .select()
      .single();
    if (error) {
      setFeedback("Não foi possível criar o serviço. Verifique os dados e tente novamente.");
    } else {
      setItems((prev) => [...prev, data as Service]);
      setFeedback("Serviço criado com sucesso.");
    }
    setAdding(false);
  }

  async function remove(id: string) {
    if (removingId) return;
    if (!confirm("Excluir este serviço? Esta ação não pode ser desfeita.")) return;
    setRemovingId(id);
    setFeedback(null);
    const { error } = await supabase.from("services").delete().eq("id", id).select("id").single();
    if (error) {
      setFeedback("Não foi possível excluir o serviço. Tente novamente.");
    } else {
      setItems((prev) => prev.filter((s) => s.id !== id));
      setDirty((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setFeedback("Serviço excluído com sucesso.");
    }
    setRemovingId(null);
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">Catálogo</p>
          <h1 className="font-serif text-4xl text-sage-deep">Serviços</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={addNew} disabled={adding} className="btn-serena-outline">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
            Novo serviço
          </button>
          <button
            onClick={saveAll}
            disabled={saving || Object.keys(dirty).length === 0}
            className="btn-serena"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" /> Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <p className="mb-6 rounded-xl bg-blush px-4 py-2 text-sm text-sage-deep">{feedback}</p>
      )}

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div
              key={s.id}
              className={
                "rounded-2xl border p-4 shadow-soft transition-all " +
                (s.active ? "border-border bg-card" : "border-border/50 bg-muted/40 opacity-70")
              }
            >
              <div className="flex items-start gap-3">
                <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 space-y-2">
                  <div className="grid gap-2 md:grid-cols-[1fr_140px_140px_auto]">
                    <input
                      value={s.name}
                      disabled={saving}
                      onChange={(e) => edit(s.id, { name: e.target.value })}
                      placeholder="Nome"
                      className="rounded-xl border border-border bg-background px-3 py-2 font-serif text-lg text-sage-deep outline-none focus:border-sage"
                    />
                    <input
                      value={s.duration ?? ""}
                      disabled={saving}
                      onChange={(e) => edit(s.id, { duration: e.target.value })}
                      placeholder="60 min"
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                    />
                    <input
                      value={s.price_label ?? ""}
                      disabled={saving}
                      onChange={(e) => edit(s.id, { price_label: e.target.value })}
                      placeholder="Valor"
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                    />
                    <input
                      type="number"
                      value={s.display_order}
                      disabled={saving}
                      onChange={(e) => edit(s.id, { display_order: Number(e.target.value) })}
                      className="w-16 rounded-xl border border-border bg-background px-2 py-2 text-center text-sm outline-none focus:border-sage"
                    />
                  </div>
                  <textarea
                    value={s.short_description ?? ""}
                    disabled={saving}
                    onChange={(e) => edit(s.id, { short_description: e.target.value })}
                    placeholder="Descrição curta…"
                    rows={2}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                  />
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={s.active}
                        disabled={saving}
                        onChange={(e) => edit(s.id, { active: e.target.checked })}
                      />
                      Ativo
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={s.featured}
                        disabled={saving}
                        onChange={(e) => edit(s.id, { featured: e.target.checked })}
                      />
                      <Star className="h-3 w-3 text-gold" /> Destaque na home
                    </label>
                    <span className="text-muted-foreground">slug: {s.slug}</span>
                    <button
                      onClick={() => remove(s.id)}
                      disabled={removingId !== null}
                      className="ml-auto text-destructive hover:opacity-70"
                      aria-label="Excluir"
                    >
                      {removingId === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
