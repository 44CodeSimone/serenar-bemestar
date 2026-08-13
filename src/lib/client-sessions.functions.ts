import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  listClientSessions,
  getClientSessionById,
  createClientSession,
  updateClientSession,
  insertSessionNote,
  listSessionNotes,
  type ClientSessionInsert,
  type ClientSessionUpdate,
  type SessionNoteInsert,
} from "@/lib/client-sessions.repository";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

const ALLOWED_SESSION_STATUSES = ["scheduled", "in_progress", "completed", "cancelled", "no_show"] as const;
const ALLOWED_NOTE_TYPES = ["observation", "evolution", "recommendation", "correction", "administrative"] as const;

/**
 * Server Function: Lista todas as sessões clínicas de um cliente.
 */
export const listClientSessionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { clientId: string }) => {
    if (!isValidUuid(data.clientId)) {
      throw new Error("ID de cliente inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    return await listClientSessions(context.supabase, data.clientId);
  });

/**
 * Server Function: Obtém os detalhes de uma sessão clínica por ID.
 */
export const getClientSessionFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { sessionId: string }) => {
    if (!isValidUuid(data.sessionId)) {
      throw new Error("ID de sessão inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const session = await getClientSessionById(context.supabase, data.sessionId);
    if (!session) {
      throw new Error("Sessão não encontrada.");
    }
    return session;
  });

/**
 * Server Function: Cria uma nova sessão clínica com controle server-side do profissional responsável.
 */
export const createClientSessionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    clientId: string;
    appointmentId?: string | null;
    serviceId?: string | null;
    session_started_at?: string;
    status?: string;
    duration_minutes?: number | null;
    client_report?: string | null;
    professional_summary?: string | null;
    recommendations?: string | null;
  }) => {
    if (!isValidUuid(data.clientId)) {
      throw new Error("ID de cliente inválido.");
    }
    if (data.appointmentId && !isValidUuid(data.appointmentId)) {
      throw new Error("ID de agendamento inválido.");
    }
    if (data.serviceId && !isValidUuid(data.serviceId)) {
      throw new Error("ID de serviço inválido.");
    }
    if (data.duration_minutes !== undefined && data.duration_minutes !== null) {
      if (typeof data.duration_minutes !== "number" || data.duration_minutes <= 0) {
        throw new Error("A duração em minutos deve ser um valor numérico positivo.");
      }
    }
    if (data.status && !ALLOWED_SESSION_STATUSES.includes(data.status as typeof ALLOWED_SESSION_STATUSES[number])) {
      throw new Error("Status de sessão inválido.");
    }
    if (data.session_started_at && isNaN(Date.parse(data.session_started_at))) {
      throw new Error("Data de início da sessão inválida.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    // Validar existência do cliente
    const { data: clientObj, error: clientErr } = await context.supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();

    if (clientErr || !clientObj) {
      throw new Error("Cliente não encontrado.");
    }

    // Validar agendamento se informado
    if (data.appointmentId) {
      const { data: apptObj, error: apptErr } = await context.supabase
        .from("appointments")
        .select("id, client_id")
        .eq("id", data.appointmentId)
        .maybeSingle();

      if (apptErr || !apptObj) {
        throw new Error("Agendamento não encontrado.");
      }

      if (apptObj.client_id && apptObj.client_id !== data.clientId) {
        throw new Error("O agendamento informado pertence a outro cliente.");
      }
    }

    // Validar serviço se informado
    if (data.serviceId) {
      const { data: srvObj, error: srvErr } = await context.supabase
        .from("services")
        .select("id")
        .eq("id", data.serviceId)
        .maybeSingle();

      if (srvErr || !srvObj) {
        throw new Error("Serviço não encontrado.");
      }
    }

    const insertPayload: ClientSessionInsert = {
      client_id: data.clientId,
      professional_user_id: context.user.id,
      session_started_at: data.session_started_at || new Date().toISOString(),
      status: data.status || "scheduled",
      appointment_id: data.appointmentId || null,
      service_id: data.serviceId || null,
      duration_minutes: data.duration_minutes ?? null,
      client_report: data.client_report || null,
      professional_summary: data.professional_summary || null,
      recommendations: data.recommendations || null,
    };

    return await createClientSession(context.supabase, insertPayload);
  });

/**
 * Server Function: Atualiza uma sessão clínica existente com whitelist de campos e validação de transição de status.
 */
export const updateClientSessionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    sessionId: string;
    session_started_at?: string;
    session_ended_at?: string | null;
    duration_minutes?: number | null;
    status?: string;
    client_report?: string | null;
    professional_summary?: string | null;
    recommendations?: string | null;
    appointmentId?: string | null;
    serviceId?: string | null;
  }) => {
    if (!isValidUuid(data.sessionId)) {
      throw new Error("ID de sessão inválido.");
    }
    if (data.appointmentId !== undefined && data.appointmentId !== null && !isValidUuid(data.appointmentId)) {
      throw new Error("ID de agendamento inválido.");
    }
    if (data.serviceId !== undefined && data.serviceId !== null && !isValidUuid(data.serviceId)) {
      throw new Error("ID de serviço inválido.");
    }
    if (data.duration_minutes !== undefined && data.duration_minutes !== null) {
      if (typeof data.duration_minutes !== "number" || data.duration_minutes <= 0) {
        throw new Error("A duração em minutos deve ser um valor numérico positivo.");
      }
    }
    if (data.status && !ALLOWED_SESSION_STATUSES.includes(data.status as typeof ALLOWED_SESSION_STATUSES[number])) {
      throw new Error("Status de sessão inválido.");
    }
    if (data.session_started_at && isNaN(Date.parse(data.session_started_at))) {
      throw new Error("Data de início da sessão inválida.");
    }
    if (data.session_ended_at && isNaN(Date.parse(data.session_ended_at))) {
      throw new Error("Data de término da sessão inválida.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const currentSession = await getClientSessionById(context.supabase, data.sessionId);
    if (!currentSession) {
      throw new Error("Sessão não encontrada.");
    }

    // Validar agendamento se informado
    if (data.appointmentId) {
      const { data: apptObj, error: apptErr } = await context.supabase
        .from("appointments")
        .select("id, client_id")
        .eq("id", data.appointmentId)
        .maybeSingle();

      if (apptErr || !apptObj) {
        throw new Error("Agendamento não encontrado.");
      }

      if (apptObj.client_id && apptObj.client_id !== currentSession.client_id) {
        throw new Error("O agendamento informado pertence a outro cliente.");
      }
    }

    // Validar serviço se informado
    if (data.serviceId) {
      const { data: srvObj, error: srvErr } = await context.supabase
        .from("services")
        .select("id")
        .eq("id", data.serviceId)
        .maybeSingle();

      if (srvErr || !srvObj) {
        throw new Error("Serviço não encontrado.");
      }
    }

    const currentStatus = currentSession.status;
    const targetStatus = data.status || currentStatus;

    // Regras de transição de status
    if (currentStatus === "cancelled" || currentStatus === "no_show") {
      if (data.status && data.status !== currentStatus) {
        throw new Error("Esta operação não é permitida para o status atual da sessão.");
      }
    }

    if (currentStatus === "completed") {
      if (data.status && data.status !== "completed") {
        throw new Error("Esta operação não é permitida para o status atual da sessão.");
      }
    }

    let endedAt = data.session_ended_at !== undefined ? data.session_ended_at : currentSession.session_ended_at;
    if (targetStatus === "completed" && !endedAt) {
      endedAt = new Date().toISOString();
    }

    const startedAt = data.session_started_at || currentSession.session_started_at;
    if (startedAt && endedAt) {
      const startTime = Date.parse(startedAt);
      const endTime = Date.parse(endedAt);
      if (!isNaN(startTime) && !isNaN(endTime) && endTime < startTime) {
        throw new Error("A data de término da sessão não pode ser anterior à data de início.");
      }
    }

    const updatePayload: ClientSessionUpdate = {};

    if (data.session_started_at !== undefined) updatePayload.session_started_at = data.session_started_at;
    if (endedAt !== undefined) updatePayload.session_ended_at = endedAt;
    if (data.duration_minutes !== undefined) updatePayload.duration_minutes = data.duration_minutes;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.client_report !== undefined) updatePayload.client_report = data.client_report;
    if (data.professional_summary !== undefined) updatePayload.professional_summary = data.professional_summary;
    if (data.recommendations !== undefined) updatePayload.recommendations = data.recommendations;
    if (data.appointmentId !== undefined) updatePayload.appointment_id = data.appointmentId;
    if (data.serviceId !== undefined) updatePayload.service_id = data.serviceId;

    return await updateClientSession(context.supabase, data.sessionId, updatePayload);
  });

/**
 * Server Function: Lista todas as notas de evolução de uma sessão clínica.
 */
export const listSessionNotesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { sessionId: string }) => {
    if (!isValidUuid(data.sessionId)) {
      throw new Error("ID de sessão inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const session = await getClientSessionById(context.supabase, data.sessionId);
    if (!session) {
      throw new Error("Sessão não encontrada.");
    }
    return await listSessionNotes(context.supabase, data.sessionId);
  });

/**
 * Server Function: Registra uma nova nota de evolução (append-only) para uma sessão.
 */
export const createSessionNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    sessionId: string;
    note_type: string;
    content: string;
    supersedes_note_id?: string | null;
  }) => {
    if (!isValidUuid(data.sessionId)) {
      throw new Error("ID de sessão inválido.");
    }
    if (data.supersedes_note_id && !isValidUuid(data.supersedes_note_id)) {
      throw new Error("ID de nota a ser corrigida inválido.");
    }
    if (!data.content || !data.content.trim()) {
      throw new Error("O conteúdo da nota é obrigatório.");
    }
    if (!ALLOWED_NOTE_TYPES.includes(data.note_type as typeof ALLOWED_NOTE_TYPES[number])) {
      throw new Error("Tipo de nota clínica inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const session = await getClientSessionById(context.supabase, data.sessionId);
    if (!session) {
      throw new Error("Sessão não encontrada.");
    }

    if (data.supersedes_note_id) {
      const existingNotes = await listSessionNotes(context.supabase, data.sessionId);
      const targetNote = existingNotes.find((n) => n.id === data.supersedes_note_id);
      if (!targetNote) {
        throw new Error("A nota informada não pertence a esta sessão.");
      }
      if (data.note_type !== "correction") {
        throw new Error("Notas que corrigem um registro anterior devem ter o tipo 'correction'.");
      }
    }

    const notePayload: SessionNoteInsert = {
      session_id: data.sessionId,
      created_by: context.user.id,
      note_type: data.note_type,
      content: data.content.trim(),
      supersedes_note_id: data.supersedes_note_id || null,
    };

    return await insertSessionNote(context.supabase, notePayload);
  });
