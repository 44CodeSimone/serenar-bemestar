import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  MessageCircle,
  Search,
  X,
} from "lucide-react";
import {
  changeAppointmentStatus,
  listAppointments,
  updateAppointmentInternalNotes,
  type AppointmentRecord,
  type AppointmentStatus,
} from "@/lib/appointments.repository";
import { SITE } from "@/lib/site-config";

const GOOGLE_CALENDAR_OPEN_URL =
  "https://calendar.google.com/calendar/u/0/r?cid=YTg0NjE4NzkxZGQzZmFiOWRjZjEzYjIxMzk1OTEyODNhMThkYWRlZmRiMDFkNTVjYzY1YjViZmU1ZWYzYjJjNEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&es=3&pli=1";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;

/** Espelha as transições permitidas na RPC change_appointment_status. */
const ALLOWED_TRANSITIONS: Record<string, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

type NoteSaveState = "idle" | "saving" | "saved" | "error";

function formatAppointmentDate(value: string | null): string {
  if (!value) {
    return "sem data";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function normalizeBrazilianPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const normalized =
    digits.length === 10 || digits.length === 11
      ? `55${digits}`
      : digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
        ? digits
        : "";

  return /^55\d{10,11}$/.test(normalized) ? normalized : null;
}

function buildClientWhatsappUrl(appointment: AppointmentRecord): string | null {
  const phone = normalizeBrazilianPhone(appointment.phone);
  if (!phone) {
    return null;
  }

  const date = formatAppointmentDate(appointment.preferred_date);
  const time = appointment.preferred_time ?? "horário a combinar";
  const message = `Olá, ${appointment.full_name}. Aqui é da Serenar. Recebemos sua solicitação de ${appointment.service} para ${date} às ${time}.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

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

function compareAppointments(left: AppointmentRecord, right: AppointmentRecord): number {
  const priority: Record<string, number> = {
    pending: 0,
    confirmed: 1,
    completed: 2,
    cancelled: 3,
  };
  const priorityDifference = (priority[left.status] ?? 4) - (priority[right.status] ?? 4);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  if (left.status === "pending" || left.status === "confirmed") {
    const today = getSaoPauloDate();
    const leftIsFuture = Boolean(left.preferred_date && left.preferred_date >= today);
    const rightIsFuture = Boolean(right.preferred_date && right.preferred_date >= today);

    if (leftIsFuture !== rightIsFuture) {
      return leftIsFuture ? -1 : 1;
    }

    const leftSchedule = `${left.preferred_date ?? "9999-12-31"}T${left.preferred_time ?? "23:59"}`;
    const rightSchedule = `${right.preferred_date ?? "9999-12-31"}T${right.preferred_time ?? "23:59"}`;
    const scheduleDifference = leftIsFuture
      ? leftSchedule.localeCompare(rightSchedule)
      : rightSchedule.localeCompare(leftSchedule);

    if (scheduleDifference !== 0) {
      return scheduleDifference;
    }
  }

  return right.created_at.localeCompare(left.created_at);
}

export default function AdminAppointments() {
  const [items, setItems] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteStates, setNoteStates] = useState<Record<string, NoteSaveState>>({});
  const noteDraftsRef = useRef<Record<string, string>>({});

  const indicators = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((appointment) => appointment.status === "pending").length,
      confirmed: items.filter((appointment) => appointment.status === "confirmed").length,
      completed: items.filter((appointment) => appointment.status === "completed").length,
      cancelled: items.filter((appointment) => appointment.status === "cancelled").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);

    return items
      .filter((appointment) => {
        const matchesFilter = filter === "todos" || appointment.status === filter;
        const searchableText = normalizeSearchText(
          [
            appointment.full_name,
            appointment.phone,
            appointment.service,
            appointment.preferred_date ?? "",
            formatAppointmentDate(appointment.preferred_date),
          ].join(" "),
        );

        return matchesFilter && (!normalizedSearch || searchableText.includes(normalizedSearch));
      })
      .sort(compareAppointments);
  }, [filter, items, search]);

  const hasActiveFilters = filter !== "todos" || Boolean(search.trim());

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const appointments = await listAppointments();
      const drafts = Object.fromEntries(
        appointments.map((appointment) => [appointment.id, appointment.internal_notes ?? ""]),
      );
      setItems(appointments);
      setNoteDrafts(drafts);
      noteDraftsRef.current = drafts;
    } catch {
      setError("Não foi possível carregar os agendamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function clearFilters() {
    setFilter("todos");
    setSearch("");
  }

  function confirmCancellation(appointment: AppointmentRecord): boolean {
    return window.confirm(
      [
        `Cancelar o pedido de ${appointment.full_name}?`,
        "",
        `Serviço: ${appointment.service}`,
        `Data: ${formatAppointmentDate(appointment.preferred_date)}`,
        `Horário: ${appointment.preferred_time ?? "não informado"}`,
        "",
        "O horário poderá voltar a ficar disponível no site conforme a publicação atual.",
      ].join("\n"),
    );
  }

  async function updateStatus(appointment: AppointmentRecord, status: AppointmentStatus) {
    if (status === "cancelled" && !confirmCancellation(appointment)) {
      return;
    }

    setPendingId(appointment.id);
    setError(null);
    setSuccess(null);

    try {
      const result = await changeAppointmentStatus({
        appointmentId: appointment.id,
        newStatus: status,
      });
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === appointment.id ? { ...item, status: result.appointment_status } : item,
        ),
      );

      const successMessages: Record<AppointmentStatus, string> = {
        confirmed: "Pedido confirmado. Registre agora este compromisso no Google Calendar.",
        cancelled: "Pedido cancelado e horário liberado conforme a disponibilidade publicada.",
        completed: "Atendimento marcado como concluído.",
      };
      setSuccess(successMessages[status]);
    } catch {
      setError("Não foi possível alterar o status deste agendamento.");
    } finally {
      setPendingId(null);
    }
  }

  function updateNoteDraft(appointmentId: string, value: string) {
    noteDraftsRef.current = { ...noteDraftsRef.current, [appointmentId]: value };
    setNoteDrafts(noteDraftsRef.current);
    setNoteStates((currentStates) => ({ ...currentStates, [appointmentId]: "idle" }));
  }

  async function saveNotes(appointment: AppointmentRecord) {
    const draft = noteDraftsRef.current[appointment.id] ?? "";
    const savedValue = appointment.internal_notes ?? "";

    if (draft === savedValue || noteStates[appointment.id] === "saving") {
      return;
    }

    setNoteStates((currentStates) => ({ ...currentStates, [appointment.id]: "saving" }));

    try {
      await updateAppointmentInternalNotes(appointment.id, draft);
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === appointment.id ? { ...item, internal_notes: draft } : item,
        ),
      );
      setNoteStates((currentStates) => ({
        ...currentStates,
        [appointment.id]: noteDraftsRef.current[appointment.id] === draft ? "saved" : "idle",
      }));
    } catch {
      setNoteStates((currentStates) => ({ ...currentStates, [appointment.id]: "error" }));
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Agendamentos</p>
          <h1 className="font-serif text-4xl text-sage-deep">Pedidos recebidos</h1>
        </div>
        <a
          href={GOOGLE_CALENDAR_OPEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-serena"
        >
          Abrir Google Calendar
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-blush/30 p-4 text-sm text-sage-deep">
        <p className="font-medium">O Google Calendar é a agenda oficial da equipe.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Após confirmar um pedido no Serenar, registre manualmente o compromisso no Google
          Calendar.
        </p>
      </div>

      <section
        aria-label="Resumo dos pedidos"
        className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5"
      >
        {[
          ["Total", indicators.total],
          ["Pendentes", indicators.pending],
          ["Confirmados", indicators.confirmed],
          ["Concluídos", indicators.completed],
          ["Cancelados", indicators.cancelled],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-serif text-3xl text-sage-deep">{value}</p>
          </div>
        ))}
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, telefone, serviço ou data"
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 outline-none focus:border-sage"
              />
            </div>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Status</span>
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-sage"
              >
                <option value="todos">Todos</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="btn-serena-outline"
          >
            <X className="h-4 w-4" /> Limpar filtros
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Exibindo {filtered.length} de {items.length} pedidos.
        </p>
      </section>

      {error ? (
        <p className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {success ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-3 rounded-2xl border border-sage/30 bg-sage/10 px-4 py-3 text-sm text-sage-deep"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{success}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum agendamento recebido ainda.
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum agendamento corresponde à busca ou ao filtro atual.
          </p>
          <button type="button" onClick={clearFilters} className="btn-serena-outline mt-4">
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((appointment) => {
            const whatsappUrl = buildClientWhatsappUrl(appointment);
            const noteState = noteStates[appointment.id] ?? "idle";
            const processing = pendingId === appointment.id;

            return (
              <article
                key={appointment.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="font-serif text-xl text-sage-deep">{appointment.full_name}</h2>
                      <span className="text-xs uppercase tracking-wider text-gold">
                        {appointment.service}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatAppointmentDate(appointment.preferred_date)}
                      {appointment.preferred_time ? ` · ${appointment.preferred_time}` : ""}
                      {" · recebido em "}
                      {new Date(appointment.created_at).toLocaleString("pt-BR")}
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-foreground/80">
                      <p>Telefone: {appointment.phone}</p>
                      {appointment.email ? <p>E-mail: {appointment.email}</p> : null}
                    </div>
                    {appointment.notes ? (
                      <div className="mt-3 rounded-xl bg-blush/40 p-3 text-sm text-foreground/80">
                        <p className="mb-1 text-xs font-medium text-sage-deep">
                          Observação da cliente
                        </p>
                        <p>{appointment.notes}</p>
                      </div>
                    ) : null}
                    <label className="mt-3 block text-sm">
                      <span className="text-xs font-medium text-sage-deep">
                        Observações internas
                      </span>
                      <textarea
                        value={noteDrafts[appointment.id] ?? ""}
                        onChange={(event) => updateNoteDraft(appointment.id, event.target.value)}
                        onBlur={() => void saveNotes(appointment)}
                        placeholder="Anotações internas (só para a equipe)…"
                        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                        rows={2}
                      />
                      <span
                        className={`mt-1 block text-xs ${noteState === "error" ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {noteState === "saving"
                          ? "Salvando…"
                          : noteState === "saved"
                            ? "Salvo"
                            : noteState === "error"
                              ? "Erro ao salvar"
                              : "Salva ao sair do campo"}
                      </span>
                    </label>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 md:min-w-[240px]">
                    <div className="relative">
                      <select
                        value={appointment.status}
                        disabled={
                          processing || ALLOWED_TRANSITIONS[appointment.status]?.length === 0
                        }
                        onChange={(event) =>
                          void updateStatus(appointment, event.target.value as AppointmentStatus)
                        }
                        className="w-full rounded-full border border-border bg-background px-3 py-2 pr-9 text-sm outline-none focus:border-sage disabled:opacity-60"
                      >
                        <option value={appointment.status}>
                          {STATUS_LABELS[appointment.status] ?? appointment.status}
                        </option>
                        {(ALLOWED_TRANSITIONS[appointment.status] ?? []).map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      {processing ? (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sage-deep" />
                      ) : null}
                    </div>

                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[oklch(0.62_0.16_150)] px-4 py-2 text-xs text-white transition-transform hover:scale-105"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp da cliente
                      </a>
                    ) : (
                      <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full bg-muted px-4 py-2 text-xs text-muted-foreground">
                        <MessageCircle className="h-3.5 w-3.5" /> Telefone inválido
                      </span>
                    )}
                    {appointment.email ? (
                      <a
                        href={`mailto:${appointment.email}`}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-sage-deep hover:bg-blush"
                      >
                        <Mail className="h-3.5 w-3.5" /> Enviar e-mail
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Contato do espaço: {SITE.whatsapp.display}
      </p>
    </div>
  );
}
