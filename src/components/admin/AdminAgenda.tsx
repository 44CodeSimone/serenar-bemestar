import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
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
  Search,
  Trash2,
  X,
  UserX,
  UserPlus,
  Sparkles,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAdminCalendarSlotsFn,
  createCalendarSlotFn,
  updateCalendarSlotFn,
  toggleCalendarSlotPublishedFn,
  blockCalendarSlotFn,
  releaseCalendarSlotFn,
  deleteCalendarSlotFn,
} from "@/lib/calendar-slots.functions";
import type { AdminCalendarAppointment, AdminCalendarSlot } from "@/lib/calendar-slots.repository";
import { convertAppointmentToSessionFn } from "@/lib/appointments.functions";
import AdminClientSessions from "@/components/admin/AdminClientSessions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

type SlotFilter = "all" | "available" | "reserved" | "blocked" | "hidden";

function getSaoPauloDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function emptyForm(): SlotForm {
  return {
    slotDate: getSaoPauloDate(),
    startTime: "09:00",
    endTime: "10:00",
    professionalName: "",
    notes: "",
    published: false,
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

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

const statusText: Record<AdminCalendarSlot["status"], string> = {
  open: "Disponível",
  reserved: "Reservado",
  blocked: "Bloqueado",
};

export default function AdminAgenda() {
  // Server Functions via useServerFn
  const fetchSlots = useServerFn(listAdminCalendarSlotsFn);
  const createSlot = useServerFn(createCalendarSlotFn);
  const updateSlot = useServerFn(updateCalendarSlotFn);
  const publishSlot = useServerFn(toggleCalendarSlotPublishedFn);
  const blockSlot = useServerFn(blockCalendarSlotFn);
  const releaseSlot = useServerFn(releaseCalendarSlotFn);
  const deleteSlot = useServerFn(deleteCalendarSlotFn);
  const convertToSession = useServerFn(convertAppointmentToSessionFn);

  // Estados locais
  const [slots, setSlots] = useState<AdminCalendarSlot[]>([]);
  const [form, setForm] = useState<SlotForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [googleCalendarLoaded, setGoogleCalendarLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SlotFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState("");
  const [search, setSearch] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const minimumDate = getSaoPauloDate();

  // Estado do Modal de Sessões do Cliente
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [sessionsClient, setSessionsClient] = useState<{ id: string; name: string } | null>(null);

  const indicators = useMemo(
    () => ({
      total: slots.length,
      available: slots.filter((slot) => slot.status === "open" && slot.published).length,
      reserved: slots.filter((slot) => slot.status === "reserved").length,
      blocked: slots.filter((slot) => slot.status === "blocked").length,
      hidden: slots.filter((slot) => !slot.published).length,
      pending: slots.filter((slot) => slot.appointment?.status === "pending").length,
      confirmed: slots.filter((slot) => slot.appointment?.status === "confirmed").length,
    }),
    [slots],
  );

  const professionals = useMemo(
    () =>
      Array.from(
        new Set(
          slots
            .map((slot) => slot.professional_name?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [slots],
  );

  const filteredSlots = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);

    return slots.filter((slot) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && slot.status === "open" && slot.published) ||
        (statusFilter === "reserved" && slot.status === "reserved") ||
        (statusFilter === "blocked" && slot.status === "blocked") ||
        (statusFilter === "hidden" && !slot.published);
      const matchesDate = !dateFilter || slot.slot_date === dateFilter;
      const matchesProfessional =
        !professionalFilter || slot.professional_name === professionalFilter;
      const searchableText = normalizeSearchText(
        [
          slot.appointment?.full_name ?? "",
          slot.professional_name ?? "",
          slot.slot_date,
          formatDate(slot.slot_date),
        ].join(" "),
      );
      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesStatus && matchesDate && matchesProfessional && matchesSearch;
    });
  }, [dateFilter, professionalFilter, search, slots, statusFilter]);

  const hasActiveFilters =
    statusFilter !== "all" || Boolean(dateFilter || professionalFilter || search.trim());

  async function loadSlots(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      setSlots(await fetchSlots());
    } catch (loadError) {
      setError(errorMessage(loadError, "Não foi possível carregar os horários."));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
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

  function clearFilters() {
    setStatusFilter("all");
    setDateFilter("");
    setProfessionalFilter("");
    setSearch("");
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
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    if (form.endTime <= form.startTime) {
      setError("O horário final deve ser posterior ao horário inicial.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        await updateSlot({
          data: {
            calendarSlotId: editingId,
            slotDate: form.slotDate,
            startTime: form.startTime,
            endTime: form.endTime,
            professionalName: form.professionalName.trim() || null,
            notes: form.notes.trim() || null,
            published: form.published,
          },
        });
        setSuccess("Horário atualizado com sucesso.");
      } else {
        await createSlot({
          data: {
            slotDate: form.slotDate,
            startTime: form.startTime,
            endTime: form.endTime,
            professionalName: form.professionalName.trim() || null,
            notes: form.notes.trim() || null,
            published: form.published,
          },
        });
        setSuccess("Horário criado com sucesso.");
      }

      resetForm();
      await loadSlots(false);
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
      await loadSlots(false);
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

    const professional = slot.professional_name ?? "Não informado";
    const confirmed = window.confirm(
      [
        "Excluir este horário disponível do site?",
        "",
        `Data: ${formatDate(slot.slot_date)}`,
        `Horário: ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
        `Profissional: ${professional}`,
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    await runAction(
      slot.id,
      () => deleteSlot({ data: { calendarSlotId: slot.id } }),
      "Horário excluído do site.",
    );
  }

  // Action handers para o Workflow CRM (Status A, B e C)
  async function handleConvertToSession(appointment: AdminCalendarAppointment) {
    setConvertingId(appointment.id);
    try {
      await convertToSession({ data: { appointmentId: appointment.id } });
      toast.success("Sessão Clínica criada com sucesso no CRM!");
      await loadSlots(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao converter agendamento em sessão.";
      toast.error(msg);
    } finally {
      setConvertingId(null);
    }
  }

  function handleOpenSessions(crmClient: { id: string; full_name: string }) {
    setSessionsClient({ id: crmClient.id, name: crmClient.full_name });
    setIsSessionsOpen(true);
  }

  function handleCreateClientNotice(appointment: AdminCalendarAppointment) {
    toast.info(
      `Para converter este agendamento, cadastre o cliente no CRM (Aba Clientes). Dados: ${appointment.full_name} (${appointment.phone || "sem telefone"}).`,
      { duration: 6000 },
    );
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
            onClick={() => {
              clearFeedback();
              void loadSlots();
            }}
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
                <Loader2 className="h-4 w-4 animate-spin text-sage-deep" />
                Carregando Google Calendar…
              </div>
            </div>
          ) : null}
          <iframe
            src={GOOGLE_CALENDAR_EMBED_URL}
            title="Agenda pública Serenar no Google Calendar"
            onLoad={() => setGoogleCalendarLoaded(true)}
            className="h-[560px] w-full border-0"
          />
        </div>
      </section>

      <section
        aria-label="Resumo dos horários"
        className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7"
      >
        {[
          ["Total", indicators.total],
          ["Disponíveis", indicators.available],
          ["Reservados", indicators.reserved],
          ["Bloqueados", indicators.blocked],
          ["Ocultos", indicators.hidden],
          ["Pedidos pendentes", indicators.pending],
          ["Confirmados", indicators.confirmed],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-serif text-3xl text-sage-deep">{value}</p>
          </div>
        ))}
      </section>

      {error ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-sage/30 bg-sage/10 p-4 text-sm text-sage-deep"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}

      <form
        ref={formRef}
        onSubmit={(event) => void submit(event)}
        className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-soft"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-sage-deep">
              {editingId ? "Editar horário" : "Disponibilizar novo horário"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {editingId
                ? "Altere as informações do horário selecionado."
                : "Cadastre um novo horário para exibição no site."}
            </p>
          </div>
          {editingId ? (
            <button type="button" onClick={resetForm} className="btn-serena-outline text-xs">
              Cancelar edição
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Data *</span>
            <input
              type="date"
              required
              min={editingId ? undefined : minimumDate}
              value={form.slotDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, slotDate: event.target.value }))
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Horário inicial *</span>
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
            <span className="font-medium text-sage-deep">Horário final *</span>
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
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Profissional</span>
            <input
              maxLength={100}
              value={form.professionalName}
              onChange={(event) =>
                setForm((current) => ({ ...current, professionalName: event.target.value }))
              }
              placeholder="Ex.: Dra. Serena"
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

      <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, profissional ou data"
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 outline-none focus:border-sage"
              />
            </div>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as SlotFilter)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            >
              <option value="all">Todos</option>
              <option value="available">Disponíveis</option>
              <option value="reserved">Reservados</option>
              <option value="blocked">Bloqueados</option>
              <option value="hidden">Ocultos</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Data</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Profissional</span>
            <select
              value={professionalFilter}
              onChange={(event) => setProfessionalFilter(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-sage"
            >
              <option value="">Todos</option>
              {professionals.map((professional) => (
                <option key={professional} value={professional}>
                  {professional}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="btn-serena-outline self-end"
          >
            <X className="h-4 w-4" />
            Limpar filtros
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Exibindo {filteredSlots.length} de {slots.length} horários.
        </p>
      </section>

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
      ) : filteredSlots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-cream/40 p-10 text-center shadow-soft">
          <Search className="mx-auto mb-3 h-8 w-8 text-gold" />
          <h2 className="font-serif text-2xl text-sage-deep">Nenhum horário encontrado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Não há horários que correspondam aos filtros ou à busca atual.
          </p>
          <button type="button" onClick={clearFilters} className="btn-serena-outline mt-5">
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSlots.map((slot) => {
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

                    {/* Seção de Badges e Ações do Workflow CRM para Horários Reservados (Status A, B e C) */}
                    {slot.appointment && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-cream/30 p-3 rounded-xl">
                        <div className="flex items-center gap-2">
                          {slot.appointment.crmStatus === "no_client" ? (
                            <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900 text-[11px] gap-1 font-medium">
                              <UserX className="h-3.5 w-3.5 text-amber-600" /> Cliente não cadastrado
                            </Badge>
                          ) : slot.appointment.crmStatus === "session_created" ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] gap-1 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Sessão criada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-sky-400 bg-sky-50 text-sky-900 text-[11px] gap-1 font-medium">
                              <Sparkles className="h-3.5 w-3.5 text-sky-600" /> Pronto para Sessão
                            </Badge>
                          )}
                        </div>

                        <div>
                          {slot.appointment.crmStatus === "no_client" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreateClientNotice(slot.appointment!)}
                              className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100 gap-1.5 h-8 font-medium"
                            >
                              <UserPlus className="h-3.5 w-3.5" /> Cadastrar Cliente
                            </Button>
                          ) : slot.appointment.crmStatus === "session_created" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenSessions(slot.appointment!.crmClient!)}
                              className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1.5 h-8 font-medium"
                            >
                              <Eye className="h-3.5 w-3.5" /> Abrir Sessão
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => void handleConvertToSession(slot.appointment!)}
                              disabled={convertingId === slot.appointment.id}
                              className="btn-serena text-xs gap-1.5 h-8 font-medium"
                            >
                              {convertingId === slot.appointment.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Activity className="h-3.5 w-3.5" />
                              )}
                              Converter em Sessão
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
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
                                () =>
                                  publishSlot({
                                    data: { calendarSlotId: slot.id, published: !slot.published },
                                  }),
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
                                () => blockSlot({ data: { calendarSlotId: slot.id } }),
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
                                () => releaseSlot({ data: { calendarSlotId: slot.id } }),
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

      {/* Modal de Sessões do Cliente Integrado */}
      {sessionsClient && (
        <AdminClientSessions
          clientId={sessionsClient.id}
          clientName={sessionsClient.name}
          isOpen={isSessionsOpen}
          onOpenChange={setIsSessionsOpen}
        />
      )}
    </div>
  );
}
