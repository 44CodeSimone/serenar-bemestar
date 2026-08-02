import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Faq = {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  active: boolean;
};

export default function AdminFaq() {
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, Partial<Faq>>>({});
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setFeedback(null);
    const { data, error } = await supabase.from("faq_items").select("*").order("display_order");
    if (error) {
      setFeedback("Não foi possível carregar as perguntas. Tente novamente.");
    } else {
      setItems((data ?? []) as Faq[]);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function edit(id: string, patch: Partial<Faq>) {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setDirty((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveAll() {
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    const failed: Record<string, Partial<Faq>> = {};
    for (const [id, patch] of Object.entries(dirty)) {
      const { error } = await supabase
        .from("faq_items")
        .update(patch)
        .eq("id", id)
        .select("id")
        .single();
      if (error) failed[id] = patch;
    }
    setDirty(failed);
    setFeedback(
      Object.keys(failed).length === 0
        ? "Perguntas salvas com sucesso."
        : "Não foi possível salvar todas as perguntas. Revise e tente novamente.",
    );
    setSaving(false);
  }

  async function addNew() {
    if (adding) return;
    const question = prompt("Nova pergunta:");
    if (!question) return;
    setAdding(true);
    setFeedback(null);
    const { data, error } = await supabase
      .from("faq_items")
      .insert({ question, answer: "", display_order: (items.at(-1)?.display_order ?? 0) + 1 })
      .select()
      .single();
    if (error) {
      setFeedback("Não foi possível criar a pergunta. Verifique os dados e tente novamente.");
    } else {
      setItems((prev) => [...prev, data as Faq]);
      setFeedback("Pergunta criada com sucesso.");
    }
    setAdding(false);
  }

  async function remove(id: string) {
    if (removingId) return;
    if (!confirm("Excluir esta pergunta?")) return;
    setRemovingId(id);
    setFeedback(null);
    const { error } = await supabase.from("faq_items").delete().eq("id", id).select("id").single();
    if (error) {
      setFeedback("Não foi possível excluir a pergunta. Tente novamente.");
    } else {
      setItems((prev) => prev.filter((f) => f.id !== id));
      setDirty((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setFeedback("Pergunta excluída com sucesso.");
    }
    setRemovingId(null);
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">Conteúdo</p>
          <h1 className="font-serif text-4xl text-sage-deep">FAQ</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={addNew} disabled={adding} className="btn-serena-outline">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
            Nova pergunta
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
                <Save className="h-4 w-4" /> Salvar
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
          {items.map((f) => (
            <div key={f.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <input
                value={f.question}
                disabled={saving}
                onChange={(e) => edit(f.id, { question: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 font-serif text-lg text-sage-deep outline-none focus:border-sage"
              />
              <textarea
                value={f.answer}
                disabled={saving}
                onChange={(e) => edit(f.id, { answer: e.target.value })}
                rows={3}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
              />
              <div className="mt-2 flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={f.active}
                    disabled={saving}
                    onChange={(e) => edit(f.id, { active: e.target.checked })}
                  />
                  Ativa
                </label>
                <label className="inline-flex items-center gap-2">
                  Ordem{" "}
                  <input
                    type="number"
                    value={f.display_order}
                    disabled={saving}
                    onChange={(e) => edit(f.id, { display_order: Number(e.target.value) })}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-center"
                  />
                </label>
                <button
                  onClick={() => remove(f.id)}
                  disabled={removingId !== null}
                  className="ml-auto text-destructive hover:opacity-70"
                  aria-label="Excluir"
                >
                  {removingId === f.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
