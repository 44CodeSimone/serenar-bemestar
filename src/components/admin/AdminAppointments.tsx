import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  MessageCircle,
  Search,
  X,
  UserX,
  UserPlus,
  Sparkles,
  Activity,
  Eye,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAppointmentsFn,
  changeAppointmentStatusFn,
  updateAppointmentInternalNotesFn,
  convertAppointmentToSessionFn,
  deleteAppointmentFn,
} from "@/lib/appointments.functions";
import type { AppointmentRecord, AppointmentStatus } from "@/lib/appointments.repository";
import { listClientsFn } from "@/lib/clients.functions";
import type { ClientRecord } from "@/lib/clients.repository";
import AdminClientSessions from "@/components/admin/AdminClientSessions";
import { SITE } from "@/lib/site-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { normalizeBrazilianPhone, sameBrazilianPhone } from "@/lib/phone";

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
  // Server Functions via useServerFn
  const fetchAppointments = useServerFn(listAppointmentsFn);
  const changeStatus = useServerFn(changeAppointmentStatusFn);
  const updateNotes = useServerFn(updateAppointmentInternalNotesFn);
  const convertToSession = useServerFn(convertAppointmentToSessionFn);
  const deleteAppointment = useServerFn(deleteAppointmentFn);
  const fetchClients = useServerFn(listClientsFn);

  // Estados
  const [items, setItems] = useState<AppointmentRecord[]>([]);
  const [crmClients, setCrmClients] = useState<ClientRecord[]>([]);
  const [convertedAppointments, setConvertedAppointments] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteStates, setNoteStates] = useState<Record<string, NoteSaveState>>({});
  const noteDraftsRef = useRef<Record<string, string>>({});

  // Estado do Modal de Sessões do Cliente
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [sessionsClient, setSessionsClient] = useState<{ id: string; name: string } | null>(null);

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
      const [appointments, clientsRes] = await Promise.all([
        fetchAppointments(),
        fetchClients({ data: { pageSize: 500, includeArchived: false } }).catch(() => ({
          data: [],
        })),
      ]);

      const drafts = Object.fromEntries(
        appointments.map((appointment) => [appointment.id, appointment.internal_notes ?? ""]),
      );
      setItems(appointments);
      setCrmClients(clientsRes.data || []);
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
      const result = await changeStatus({
        data: {
          appointmentId: appointment.id,
          newStatus: status,
        },
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
        pending: "Pedido movido para pendente.",
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
      await updateNotes({
        data: {
          appointmentId: appointment.id,
          internalNotes: draft,
        },
      });
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

  // Resolução do cliente no CRM por telefone ou e-mail
  function resolveCrmClient(appointment: AppointmentRecord): ClientRecord | null {
    const cleanEmail = appointment.email?.trim().toLowerCase() ?? "";

    if (normalizeBrazilianPhone(appointment.phone)) {
      const match = crmClients.find((client) =>
        sameBrazilianPhone(client.phone, appointment.phone),
      );
      if (match) return match;
    }

    if (cleanEmail.length > 3) {
      const match = crmClients.find((c) => c.email?.trim().toLowerCase() === cleanEmail);
      if (match) return match;
    }

    return null;
  }

  // Handler de conversão do agendamento em Sessão Clínica
  async function handleConvertToSession(appointment: AppointmentRecord) {
    setConvertingId(appointment.id);
    try {
      await convertToSession({
        data: {
          appointmentId: appointment.id,
        },
      });

      toast.success("Sessão Clínica criada com sucesso no CRM!");
      setConvertedAppointments((prev) => ({ ...prev, [appointment.id]: true }));
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao converter agendamento em sessão.";
      toast.error(msg);
    } finally {
      setConvertingId(null);
    }
  }

  // Abrir modal de sessões do cliente
  function handleOpenClientSessions(client?: ClientRecord | null) {
    if (!client) {
      toast.warning("Nenhum cliente cadastrado no CRM está associado a este agendamento.");
      return;
    }
    setSessionsClient({ id: client.id, name: client.full_name });
    setIsSessionsOpen(true);
  }

  // Navegar para o fluxo oficial de cadastro de cliente no CRM com pré-preenchimento
  function handleCreateClientNotice(appointment: AppointmentRecord) {
    const params = new URLSearchParams({
      create: "true",
      name: appointment.full_name,
      phone: appointment.phone ?? "",
      email: appointment.email ?? "",
    });
    window.location.href = `/admin/clientes?${params.toString()}`;
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deletingId) {
      return;
    }

    const appointment = deleteTarget;
    setDeletingId(appointment.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteAppointment({ data: { appointmentId: appointment.id } });
      setItems((currentItems) => currentItems.filter((item) => item.id !== appointment.id));
      setNoteDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[appointment.id];
        noteDraftsRef.current = nextDrafts;
        return nextDrafts;
      });
      setDeleteTarget(null);
      toast.success("Agendamento excluído com sucesso.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Não foi possível excluir o agendamento.";
      toast.error(message);
    } finally {
      setDeletingId(null);
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
          Após confirmar um pedido no Serenar, registre manualmente o compromisso no Google Calendar
          e converta o agendamento em Sessão Clínica no CRM.
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
            const isCancelled = appointment.status === "cancelled";

            // Determinação do Estado de Workflow CRM (Status A, B ou C)
            const matchedClient = resolveCrmClient(appointment);
            const isSessionCreated =
              Boolean(convertedAppointments[appointment.id]) || appointment.status === "completed";

            const crmWorkflowStatus: "no_client" | "ready_for_session" | "session_created" =
              !matchedClient
                ? "no_client"
                : isSessionCreated
                  ? "session_created"
                  : "ready_for_session";

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

                {/* Seção de Integração de Workflow CRM (Status A, B ou C) */}
                <div className="mt-4 pt-3 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-cream/30 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    {isCancelled ? (
                      <Badge
                        variant="outline"
                        className="border-slate-300 bg-slate-100 text-slate-700 text-[11px] gap-1 font-medium"
                      >
                        <UserX className="h-3.5 w-3.5" /> Cancelado — histórico preservado
                      </Badge>
                    ) : crmWorkflowStatus === "no_client" ? (
                      <Badge
                        variant="outline"
                        className="border-amber-400 bg-amber-50 text-amber-900 text-[11px] gap-1 font-medium"
                      >
                        <UserX className="h-3.5 w-3.5 text-amber-600" /> Cliente não cadastrado no
                        CRM (Cliente Não Cadastrado)
                      </Badge>
                    ) : crmWorkflowStatus === "session_created" ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] gap-1 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Sessão clínica criada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-sky-400 bg-sky-50 text-sky-900 text-[11px] gap-1 font-medium"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-sky-600" /> Pronto para sessão
                      </Badge>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {isCancelled ? null : crmWorkflowStatus === "no_client" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateClientNotice(appointment)}
                          className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100 gap-1.5 h-8 font-medium"
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Cadastrar cliente
                        </Button>
                      ) : crmWorkflowStatus === "session_created" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenClientSessions(matchedClient)}
                          className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1.5 h-8 font-medium"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver sessão clínica
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => void handleConvertToSession(appointment)}
                          disabled={convertingId === appointment.id}
                          className="btn-serena text-xs gap-1.5 h-8 font-medium"
                        >
                          {convertingId === appointment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Activity className="h-3.5 w-3.5" />
                          )}
                          Converter em sessão
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="text-xs border-sage-deep/30 text-sage-deep hover:bg-sage/10 gap-1.5 h-8 font-medium"
                      >
                        <Link
                          to="/admin/atendimento/$appointmentId"
                          params={{ appointmentId: appointment.id }}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-gold" /> Abrir Central
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteTarget(appointment)}
                        disabled={
                          processing ||
                          convertingId === appointment.id ||
                          deletingId === appointment.id
                        }
                        className="h-8 gap-1.5 border-destructive/40 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {deletingId === appointment.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Excluir
                      </Button>
                    </div>
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

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl text-sage-deep">
              Excluir agendamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <span className="block">
                O pedido de <strong>{deleteTarget?.full_name}</strong> será excluído
                permanentemente.
              </span>
              <span className="block">
                Se o horário ainda estiver reservado, ele voltará a ficar disponível. Uma sessão
                clínica já criada será preservada, mas deixará de apontar para este pedido.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={Boolean(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Contato do espaço: {SITE.whatsapp.display}
      </p>
    </div>
  );
}
