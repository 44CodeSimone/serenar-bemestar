import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Ban,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  LockOpen,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  blockCalendarSlot,
  createCalendarSlot,
  deleteCalendarSlot,
  listAdminCalendarSlots,
  releaseCalendarSlot,
  toggleCalendarSlotPublished,
  updateCalendarSlot,
  type AdminCalendarSlot,
} from "@/lib/calendar-slots.repository";

const GOOGLE_CALENDAR_EMBED_URL =
  "https://calendar.google.com/calendar/embed?src=a84618791dd3fab9dcf13b2139591283a18dadefdb01d55cc65b5bfe5ef3b2c4%40group.calendar.google.com&ctz=America%2FSao_Paulo";
const GOOGLE_CALENDAR_OPEN_URL =
  "https://calendar.google.com/calendar/u/0/r?cid=YTg0NjE4NzkxZGQzZmFiOWRjZjEzYjIxMzk1OTEyODNhMThkYWRlZmRiMDFkNTVjYzY1YjViZmU1ZWYzYjJjNEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&es=3&pli=1";

type SlotForm = {
  slotDate: string;
  startTime: string;
  endTime: string;
  professionalName: string;
  notes: string;
  published: boolean;
};

function emptyForm(): SlotForm {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

  return {
    slotDate: localDate,
    startTime: "09:00",
    endTime: "10:00",
    professionalName: "",
    notes: "",
    published: true,
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

const statusText: Record<AdminCalendarSlot["status"], string> = {
  open: "Disponível",
  reserved: "Reservado",
  blocked: "Bloqueado",
};

export default function AdminAgenda() {
  const [slots, setSlots] = useState<AdminCalendarSlot[]>([]);
  const [form, setForm] = useState<SlotForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [googleCalendarLoaded, setGoogleCalendarLoaded] = useState(false);

  async function loadSlots() {
    setLoading(true);
    setError(null);

    try {
      setSlots(await listAdminCalendarSlots());
    } catch (loadError) {
      setError(errorMessage(loadError, "Não foi possível carregar os horários."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSlots();
  }, []);

  function clearFeedback() {
    setError(null);
    setSuccess(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEditing(slot: AdminCalendarSlot) {
    clearFeedback();
    setEditingId(slot.id);
    setForm({
      slotDate: slot.slot_date,
      startTime: slot.start_time.slice(0, 5),
      endTime: slot.end_time.slice(0, 5),
      professionalName: slot.professional_name ?? "",
      notes: slot.notes ?? "",
      published: slot.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    if (form.endTime <= form.startTime) {
      setError("O horário final deve ser posterior ao horário inicial.");
      return;
    }

    setSaving(true);

    const values = {
      slot_date: form.slotDate,
      start_time: form.startTime,
      end_time: form.endTime,
      professional_name: form.professionalName.trim() || null,
      notes: form.notes.trim() || null,
      published: form.published,
    };

    try {
      if (editingId) {
        await updateCalendarSlot(editingId, values);
        setSuccess("Horário atualizado com sucesso.");
      } else {
        await createCalendarSlot(values);
        setSuccess("Horário criado com sucesso.");
      }

      resetForm();
      await loadSlots();
    } catch (saveError) {
      setError(errorMessage(saveError, "Não foi possível salvar o horário."));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(slotId: string, action: () => Promise<unknown>, message: string) {
    clearFeedback();
    setBusyId(slotId);

    try {
      await action();
      setSuccess(message);
      await loadSlots();
    } catch (actionError) {
      setError(errorMessage(actionError, "Não foi possível concluir a operação."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(slot: AdminCalendarSlot) {
    if (slot.status === "reserved") {
      setError("Cancele o agendamento antes de excluir um horário reservado.");
      return;
    }

    if (!window.confirm("Excluir este horário disponível do site?")) {
      return;
    }

    await runAction(slot.id, () => deleteCalendarSlot(slot.id), "Horário excluído do site.");
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Agenda oficial</p>
          <h1 className="font-serif text-4xl text-sage-deep">Agenda</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Consulte a agenda da equipe e disponibilize manualmente horários para solicitação no
            site.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={GOOGLE_CALENDAR_OPEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-serena"
          >
            Abrir Google Calendar
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => void loadSlots()}
            disabled={loading}
            className="btn-serena-outline"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar horários
          </button>
        </div>
      </div>

      <section className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-2 border-b border-border bg-blush/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-sage-deep">Google Calendar</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Esta é a única agenda da equipe, incluindo profissionais que não utilizam o site.
            </p>
          </div>
          <span className="text-xs font-medium text-sage-deep">Agenda oficial</span>
        </div>
        <div className="relative min-h-[560px]">
          {!googleCalendarLoaded ? (
            <div className="absolute inset-0 grid place-items-center bg-cream/60">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando Google Calendar…
              </div>
            </div>
          ) : null}
          <iframe
            src={GOOGLE_CALENDAR_EMBED_URL}
            title="Google Calendar da Serenar"
            width="100%"
            frameBorder="0"
            scrolling="no"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setGoogleCalendarLoaded(true)}
            className="block min-h-[560px] w-full md:min-h-[680px]"
          />
        </div>
      </section>

      <div className="mb-5">
        <h2 className="font-serif text-3xl text-sage-deep">Horários disponíveis no site</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Depois de conferir o Google Calendar, publique aqui apenas os horários livres que as
          clientes poderão solicitar. Esta lista não é uma segunda agenda.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-5 flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
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
          className="mb-5 flex gap-3 rounded-2xl border border-sage/30 bg-sage/10 p-4 text-sm text-sage-deep"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}

      <form
        onSubmit={submit}
        className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-soft"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl text-sage-deep">
              {editingId ? "Editar horário" : "Novo horário"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Horários publicados e disponíveis aparecem para solicitação no site.
            </p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" /> Cancelar edição
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Data</span>
            <input
              type="date"
              required
              value={form.slotDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, slotDate: event.target.value }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Início</span>
            <input
              type="time"
              required
              value={form.startTime}
              onChange={(event) =>
                setForm((current) => ({ ...current, startTime: event.target.value }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Término</span>
            <input
              type="time"
              required
              value={form.endTime}
              onChange={(event) =>
                setForm((current) => ({ ...current, endTime: event.target.value }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Profissional</span>
            <input
              maxLength={200}
              value={form.professionalName}
              onChange={(event) =>
                setForm((current) => ({ ...current, professionalName: event.target.value }))
              }
              placeholder="Opcional"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Observações internas</span>
            <input
              maxLength={2000}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Opcional"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) =>
                setForm((current) => ({ ...current, published: event.target.checked }))
              }
            />
            Publicar como disponível no site
          </label>
          <button type="submit" disabled={saving} className="btn-serena">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingId ? (
              <Pencil className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {editingId ? "Salvar alterações" : "Criar horário"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-sage-deep" />
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-cream/40 p-10 text-center shadow-soft">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-gold" />
          <h2 className="font-serif text-2xl text-sage-deep">Nenhum horário cadastrado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Use o formulário acima para disponibilizar o primeiro horário.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map((slot) => {
            const busy = busyId === slot.id;
            const reserved = slot.status === "reserved";
            return (
              <article
                key={slot.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-52">
                    <p className="font-medium capitalize text-sage-deep">
                      {formatDate(slot.slot_date)}
                    </p>
                    <p className="mt-1 font-serif text-2xl text-foreground">
                      {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${slot.status === "open" ? "bg-sage/15 text-sage-deep" : slot.status === "reserved" ? "bg-gold/15 text-amber-800" : "bg-muted text-muted-foreground"}`}
                      >
                        {statusText[slot.status]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${slot.published ? "bg-sage/15 text-sage-deep" : "bg-muted text-muted-foreground"}`}
                      >
                        {slot.published ? "Publicado" : "Oculto"}
                      </span>
                    </div>
                    {slot.professional_name ? (
                      <p className="mt-2 text-foreground/80">
                        Profissional: {slot.professional_name}
                      </p>
                    ) : null}
                    {slot.appointment ? (
                      <p className="mt-1 text-foreground/80">
                        Cliente: <span className="font-medium">{slot.appointment.full_name}</span> ·{" "}
                        {slot.appointment.service}
                      </p>
                    ) : null}
                    {slot.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{slot.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {busy ? (
                      <Loader2 className="m-2 h-4 w-4 animate-spin text-sage-deep" />
                    ) : (
                      <>
                        {!reserved ? (
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                slot.id,
                                () => toggleCalendarSlotPublished(slot.id, !slot.published),
                                slot.published
                                  ? "Horário ocultado do site."
                                  : "Horário publicado no site.",
                              )
                            }
                            className="btn-serena-outline text-xs"
                          >
                            {slot.published ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            {slot.published ? "Ocultar" : "Publicar"}
                          </button>
                        ) : null}
                        {slot.status === "open" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                slot.id,
                                () => blockCalendarSlot(slot.id),
                                "Horário bloqueado.",
                              )
                            }
                            className="btn-serena-outline text-xs"
                          >
                            <Ban className="h-4 w-4" />
                            Bloquear
                          </button>
                        ) : null}
                        {slot.status === "blocked" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                slot.id,
                                () => releaseCalendarSlot(slot.id),
                                "Horário liberado.",
                              )
                            }
                            className="btn-serena-outline text-xs"
                          >
                            <LockOpen className="h-4 w-4" />
                            Liberar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => startEditing(slot)}
                          disabled={reserved}
                          title={reserved ? "Cancele o agendamento antes de editar" : undefined}
                          className="btn-serena-outline text-xs"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(slot)}
                          disabled={reserved}
                          className="inline-flex items-center gap-1.5 px-2 text-xs text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </>
                    )}
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
