import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, Quote, Save, Star, Trash2, X } from "lucide-react";
import {
  createTestimonial,
  deleteTestimonial,
  listAdminTestimonials,
  updateTestimonial,
  type CreateTestimonialParams,
  type TestimonialRecord,
  type UpdateTestimonialParams,
} from "@/lib/testimonials.repository";

type NewTestimonialForm = Pick<
  CreateTestimonialParams,
  "name" | "text" | "service" | "rating" | "authorized" | "active" | "display_order"
>;

const EMPTY_NEW_TESTIMONIAL: NewTestimonialForm = {
  name: "",
  text: "",
  service: null,
  rating: 5,
  authorized: false,
  active: false,
  display_order: 0,
};

export default function AdminTestimonials() {
  const [items, setItems] = useState<TestimonialRecord[]>([]);
  const [persistedItems, setPersistedItems] = useState<TestimonialRecord[]>([]);
  const [dirty, setDirty] = useState<Record<string, UpdateTestimonialParams>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTestimonial, setNewTestimonial] = useState<NewTestimonialForm>(EMPTY_NEW_TESTIMONIAL);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadTestimonials() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const testimonials = await listAdminTestimonials();
      setItems(testimonials);
      setPersistedItems(testimonials);
      setDirty({});
    } catch {
      setError("Não foi possível carregar os depoimentos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTestimonials();
  }, []);

  function edit(testimonialId: string, patch: UpdateTestimonialParams) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === testimonialId ? { ...item, ...patch } : item)),
    );

    setDirty((currentDirty) => ({
      ...currentDirty,
      [testimonialId]: {
        ...currentDirty[testimonialId],
        ...patch,
      },
    }));
  }

  async function saveAll() {
    const changes = Object.entries(dirty);

    if (changes.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const invalidItem = items.find(
      (item) =>
        dirty[item.id] &&
        (!item.name.trim() ||
          !item.text.trim() ||
          item.display_order < 0 ||
          !Number.isFinite(item.display_order) ||
          (item.rating !== null && (item.rating < 1 || item.rating > 5))),
    );

    if (invalidItem) {
      setError(
        "Preencha nome e depoimento, use uma ordem válida e escolha uma avaliação entre 1 e 5.",
      );
      setSaving(false);
      return;
    }

    const updatedItems: TestimonialRecord[] = [];
    const failedChanges: Record<string, UpdateTestimonialParams> = {};

    for (const [testimonialId, patch] of changes) {
      try {
        updatedItems.push(await updateTestimonial(testimonialId, patch));
      } catch {
        failedChanges[testimonialId] = patch;
      }
    }

    const updatedById = new Map(updatedItems.map((item) => [item.id, item]));
    setItems((currentItems) => currentItems.map((item) => updatedById.get(item.id) ?? item));
    setPersistedItems((currentItems) =>
      currentItems.map((item) => updatedById.get(item.id) ?? item),
    );
    setDirty(failedChanges);

    if (Object.keys(failedChanges).length > 0) {
      setError("Não foi possível salvar todos os depoimentos. Revise e tente novamente.");
    } else {
      setSuccess("Alterações salvas com sucesso.");
    }

    setSaving(false);
  }

  async function addNew() {
    if (creating) return;
    if (
      !newTestimonial.name.trim() ||
      !newTestimonial.text.trim() ||
      (newTestimonial.display_order ?? -1) < 0 ||
      !Number.isFinite(newTestimonial.display_order) ||
      (newTestimonial.rating !== null &&
        newTestimonial.rating !== undefined &&
        (newTestimonial.rating < 1 || newTestimonial.rating > 5))
    ) {
      setError(
        "Preencha nome e depoimento, use uma ordem válida e escolha uma avaliação entre 1 e 5.",
      );
      setSuccess(null);
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const createdTestimonial = await createTestimonial({
        ...newTestimonial,
        name: newTestimonial.name.trim(),
        text: newTestimonial.text.trim(),
        service: newTestimonial.service?.trim() || null,
      });

      setItems((currentItems) => [...currentItems, createdTestimonial]);
      setPersistedItems((currentItems) => [...currentItems, createdTestimonial]);
      setNewTestimonial(EMPTY_NEW_TESTIMONIAL);
      setShowCreateForm(false);
      setSuccess("Depoimento criado com sucesso.");
    } catch {
      setError("Não foi possível criar o depoimento. Verifique os dados e tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(testimonialId: string) {
    if (deletingId) return;
    const confirmed = window.confirm("Excluir este depoimento permanentemente?");

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingId(testimonialId);

    try {
      await deleteTestimonial(testimonialId);

      setItems((currentItems) => currentItems.filter((item) => item.id !== testimonialId));
      setPersistedItems((currentItems) => currentItems.filter((item) => item.id !== testimonialId));

      setDirty((currentDirty) => {
        const nextDirty = { ...currentDirty };
        delete nextDirty[testimonialId];
        return nextDirty;
      });
      setSuccess("Depoimento excluído com sucesso.");
    } catch {
      setError("Não foi possível excluir o depoimento. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  function startCreating() {
    const nextOrder =
      items.reduce((highestOrder, item) => Math.max(highestOrder, item.display_order), 0) + 1;
    setNewTestimonial({ ...EMPTY_NEW_TESTIMONIAL, display_order: nextOrder });
    setShowCreateForm(true);
    setError(null);
    setSuccess(null);
  }

  function cancelEdit(testimonialId: string) {
    const persistedItem = persistedItems.find((item) => item.id === testimonialId);
    if (!persistedItem) return;

    setItems((currentItems) =>
      currentItems.map((item) => (item.id === testimonialId ? persistedItem : item)),
    );
    setDirty((currentDirty) => {
      const nextDirty = { ...currentDirty };
      delete nextDirty[testimonialId];
      return nextDirty;
    });
    setError(null);
    setSuccess(null);
  }

  const hasChanges = Object.keys(dirty).length > 0;
  const busy = saving || creating || deletingId !== null;

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Conteúdo</p>
          <h1 className="font-serif text-4xl text-sage-deep">Depoimentos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre, autorize e organize os depoimentos exibidos no site.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startCreating}
            disabled={busy || showCreateForm}
            className="btn-serena-outline"
          >
            <Plus className="h-4 w-4" />
            Novo depoimento
          </button>

          <button
            type="button"
            onClick={saveAll}
            disabled={busy || !hasChanges}
            className="btn-serena"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Não foi possível concluir a operação.</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-sage/30 bg-sage/10 p-4 text-sm text-sage-deep"
        >
          {success}
        </div>
      ) : null}

      {showCreateForm ? (
        <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-sage-deep">Novo depoimento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O depoimento começa inativo e sem autorização para não aparecer no site antes da
                revisão.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              disabled={creating}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-sage-deep"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-sage-deep">Nome da cliente *</span>
              <input
                value={newTestimonial.name}
                disabled={creating}
                required
                onChange={(event) =>
                  setNewTestimonial((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-sage-deep">Serviço</span>
              <input
                value={newTestimonial.service ?? ""}
                disabled={creating}
                onChange={(event) =>
                  setNewTestimonial((current) => ({
                    ...current,
                    service: event.target.value || null,
                  }))
                }
                placeholder="Ex.: Massagem relaxante"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
              />
            </label>
          </div>

          <label className="mt-4 block space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Depoimento *</span>
            <textarea
              value={newTestimonial.text}
              disabled={creating}
              required
              rows={4}
              onChange={(event) =>
                setNewTestimonial((current) => ({ ...current, text: event.target.value }))
              }
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 leading-relaxed outline-none focus:border-sage"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <span>Ordem</span>
              <input
                type="number"
                min={0}
                value={newTestimonial.display_order}
                disabled={creating}
                onChange={(event) =>
                  setNewTestimonial((current) => ({
                    ...current,
                    display_order: Number(event.target.value),
                  }))
                }
                className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-center outline-none focus:border-sage"
              />
            </label>

            <label className="inline-flex items-center gap-2">
              <span>Avaliação</span>
              <select
                value={newTestimonial.rating ?? 0}
                disabled={creating}
                onChange={(event) =>
                  setNewTestimonial((current) => ({
                    ...current,
                    rating: event.target.value === "0" ? null : Number(event.target.value),
                  }))
                }
                className="rounded-lg border border-border bg-background px-2 py-1.5 outline-none focus:border-sage"
              >
                <option value={0}>Sem nota</option>
                <option value={1}>1 estrela</option>
                <option value={2}>2 estrelas</option>
                <option value={3}>3 estrelas</option>
                <option value={4}>4 estrelas</option>
                <option value={5}>5 estrelas</option>
              </select>
            </label>

            <button
              type="button"
              onClick={addNew}
              disabled={creating}
              className="btn-serena ml-auto"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar depoimento
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-sage-deep" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-cream/40 p-10 text-center shadow-soft">
          <Quote className="mx-auto mb-3 h-8 w-8 text-gold" />
          <h2 className="font-serif text-2xl text-sage-deep">Nenhum depoimento cadastrado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Crie o primeiro depoimento para começar a organizar as avaliações exibidas no site.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((testimonial) => {
            const rating = testimonial.rating ?? 0;
            const isDirty = Boolean(dirty[testimonial.id]);

            return (
              <article
                key={testimonial.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium text-sage-deep">Nome da cliente *</span>
                    <input
                      value={testimonial.name}
                      disabled={busy}
                      required
                      onChange={(event) =>
                        edit(testimonial.id, {
                          name: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
                    />
                  </label>

                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium text-sage-deep">Serviço</span>
                    <input
                      value={testimonial.service ?? ""}
                      disabled={busy}
                      onChange={(event) =>
                        edit(testimonial.id, {
                          service: event.target.value.trim() === "" ? null : event.target.value,
                        })
                      }
                      placeholder="Ex.: Massagem relaxante"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
                    />
                  </label>
                </div>

                <label className="mt-4 block space-y-1.5 text-sm">
                  <span className="font-medium text-sage-deep">Depoimento *</span>
                  <textarea
                    value={testimonial.text}
                    disabled={busy}
                    required
                    onChange={(event) =>
                      edit(testimonial.id, {
                        text: event.target.value,
                      })
                    }
                    rows={4}
                    className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 leading-relaxed outline-none focus:border-sage"
                  />
                </label>

                <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-center">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={testimonial.active}
                      disabled={busy}
                      onChange={(event) =>
                        edit(testimonial.id, {
                          active: event.target.checked,
                        })
                      }
                    />
                    Ativo
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={testimonial.authorized}
                      disabled={busy}
                      onChange={(event) =>
                        edit(testimonial.id, {
                          authorized: event.target.checked,
                        })
                      }
                    />
                    Uso autorizado
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm">
                    <span>Ordem</span>
                    <input
                      type="number"
                      min={0}
                      value={testimonial.display_order}
                      disabled={busy}
                      onChange={(event) =>
                        edit(testimonial.id, {
                          display_order: Number(event.target.value),
                        })
                      }
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-center outline-none focus:border-sage"
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm">
                    <span>Avaliação</span>
                    <select
                      value={rating}
                      disabled={busy}
                      onChange={(event) =>
                        edit(testimonial.id, {
                          rating: event.target.value === "0" ? null : Number(event.target.value),
                        })
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1.5 outline-none focus:border-sage"
                    >
                      <option value={0}>Sem nota</option>
                      <option value={1}>1 estrela</option>
                      <option value={2}>2 estrelas</option>
                      <option value={3}>3 estrelas</option>
                      <option value={4}>4 estrelas</option>
                      <option value={5}>5 estrelas</option>
                    </select>
                  </label>

                  <div className="flex items-center gap-0.5" aria-label={`${rating} de 5 estrelas`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${
                          index < rating ? "fill-gold text-gold" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="ml-auto flex items-center gap-3">
                    {isDirty ? (
                      <>
                        <span className="text-xs font-medium text-gold">Alterações não salvas</span>
                        <button
                          type="button"
                          onClick={() => cancelEdit(testimonial.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-sage-deep"
                        >
                          <X className="h-4 w-4" /> Cancelar edição
                        </button>
                      </>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => remove(testimonial.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 text-sm text-destructive transition-opacity hover:opacity-70"
                      aria-label={`Excluir depoimento de ${testimonial.name}`}
                    >
                      {deletingId === testimonial.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
