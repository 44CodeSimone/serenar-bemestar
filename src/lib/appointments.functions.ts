import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as appointmentsRepo from "@/lib/appointments.repository";
import type {
  AppointmentRecord,
  AppointmentStatus,
  ChangeAppointmentStatusParams,
  ChangeAppointmentStatusResult,
} from "@/lib/appointments.repository";
import type { ClientSessionInsert, ClientSessionRow } from "@/lib/client-sessions.repository";
import { createClientSession } from "@/lib/client-sessions.repository";
import { getClientById, type ClientRecord } from "@/lib/clients.repository";

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export type ChangeAppointmentStatusInput = {
  appointmentId: string;
  newStatus: Exclude<AppointmentStatus, "pending">;
};

export type UpdateAppointmentInternalNotesInput = {
  appointmentId: string;
  internalNotes: string;
};

export type ConvertAppointmentToSessionInput = {
  appointmentId: string;
  serviceId?: string | null;
  clientReport?: string | null;
  recommendations?: string | null;
  sessionStartedAt?: string | null;
  status?: string | null;
};

/**
 * Server Function: Lista todos os agendamentos cadastrados.
 * Exige autenticação de operador/admin via middleware.
 */
export const listAppointmentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppointmentRecord[]> => {
    try {
      return await appointmentsRepo.listAppointments(context.supabase);
    } catch (error) {
      console.error("[listAppointmentsFn] Error listing appointments:", error);
      throw new Error("Erro ao carregar a lista de agendamentos.");
    }
  });

/**
 * Server Function: Detalhes de um agendamento específico por ID.
 * Exige autenticação de operador/admin via middleware.
 */
export const getAppointmentByIdFn = createServerFn({ method: "GET" })
  .validator((input: unknown): { appointmentId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;
    const appointmentId =
      typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";
    if (!isValidUuid(appointmentId)) {
      throw new Error("ID do agendamento inválido.");
    }
    return { appointmentId };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<AppointmentRecord | null> => {
    try {
      return await appointmentsRepo.getAppointmentById(context.supabase, data.appointmentId);
    } catch (error) {
      console.error("[getAppointmentByIdFn] Error fetching appointment:", error);
      throw new Error("Erro ao buscar detalhes do agendamento.");
    }
  });

/**
 * Server Function: Altera o status de um agendamento via RPC change_appointment_status.
 * Exige autenticação de operador/admin via middleware.
 */
export const changeAppointmentStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): ChangeAppointmentStatusInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload de alteração de status inválido.");
    }
    const params = input as Record<string, unknown>;

    const appointmentId =
      typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";
    if (!isValidUuid(appointmentId)) {
      throw new Error("ID do agendamento inválido.");
    }

    const validStatuses: Array<Exclude<AppointmentStatus, "pending">> = [
      "confirmed",
      "cancelled",
      "completed",
    ];
    const newStatus = params.newStatus as Exclude<AppointmentStatus, "pending">;
    if (!validStatuses.includes(newStatus)) {
      throw new Error("Status de agendamento inválido. Use: confirmed, cancelled ou completed.");
    }

    return { appointmentId, newStatus };
  })
  .handler(async ({ context, data }): Promise<ChangeAppointmentStatusResult> => {
    try {
      const payload: ChangeAppointmentStatusParams = {
        appointmentId: data.appointmentId,
        newStatus: data.newStatus,
      };
      return await appointmentsRepo.changeAppointmentStatus(context.supabase, payload);
    } catch (error) {
      console.error("[changeAppointmentStatusFn] Error changing appointment status:", error);
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error("Erro ao alterar o status do agendamento.");
    }
  });

/**
 * Server Function: Atualiza as notas internas de um agendamento.
 * Exige autenticação de operador/admin via middleware.
 */
export const updateAppointmentInternalNotesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): UpdateAppointmentInternalNotesInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload de notas internas inválido.");
    }
    const params = input as Record<string, unknown>;

    const appointmentId =
      typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";
    if (!isValidUuid(appointmentId)) {
      throw new Error("ID do agendamento inválido.");
    }

    const internalNotes =
      typeof params.internalNotes === "string" ? params.internalNotes.trim() : "";
    if (internalNotes.length > 2000) {
      throw new Error("As notas internas devem ter no máximo 2000 caracteres.");
    }

    return { appointmentId, internalNotes };
  })
  .handler(async ({ context, data }): Promise<{ success: boolean }> => {
    try {
      await appointmentsRepo.updateAppointmentInternalNotes(
        context.supabase,
        data.appointmentId,
        data.internalNotes,
      );
      return { success: true };
    } catch (error) {
      console.error("[updateAppointmentInternalNotesFn] Error updating internal notes:", error);
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error("Erro ao atualizar as notas internas do agendamento.");
    }
  });

/**
 * Server Function: Converte um agendamento em uma Sessão Clínica no CRM.
 * Prioridade 1: Utiliza appointment.client_id se preenchido.
 * Prioridade 2: Recorre a findClientByAppointmentContact apenas se client_id for NULL.
 * Se não existir cliente no CRM, retorna erro de validação amigável. Nunca cria clientes automaticamente.
 */
export const convertAppointmentToSessionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): ConvertAppointmentToSessionInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload de conversão inválido.");
    }
    const params = input as Record<string, unknown>;

    const appointmentId =
      typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";
    if (!isValidUuid(appointmentId)) {
      throw new Error("ID do agendamento inválido.");
    }

    const serviceId =
      typeof params.serviceId === "string" && isValidUuid(params.serviceId)
        ? params.serviceId.trim()
        : null;

    const clientReport =
      typeof params.clientReport === "string" && params.clientReport.trim().length > 0
        ? params.clientReport.trim()
        : null;

    const recommendations =
      typeof params.recommendations === "string" && params.recommendations.trim().length > 0
        ? params.recommendations.trim()
        : null;

    const sessionStartedAt =
      typeof params.sessionStartedAt === "string" && params.sessionStartedAt.trim().length > 0
        ? params.sessionStartedAt.trim()
        : null;

    const status =
      typeof params.status === "string" && params.status.trim().length > 0
        ? params.status.trim()
        : null;

    return {
      appointmentId,
      serviceId,
      clientReport,
      recommendations,
      sessionStartedAt,
      status,
    };
  })
  .handler(async ({ context, data }): Promise<ClientSessionRow> => {
    try {
      // 1. Carrega o agendamento
      const appointment = await appointmentsRepo.getAppointmentById(
        context.supabase,
        data.appointmentId,
      );
      if (!appointment) {
        throw new Error("Agendamento não encontrado.");
      }

      // 2. Resolve o cliente no CRM:
      // Priority 1: Utiliza appointment.client_id se preenchido
      // Priority 2: Fallback por contato se client_id for NULL
      let crmClient: ClientRecord | null = null;
      if (appointment.client_id) {
        crmClient = await getClientById(context.supabase, appointment.client_id);
      }

      if (!crmClient) {
        crmClient = await appointmentsRepo.findClientByAppointmentContact(
          context.supabase,
          appointment.phone,
          appointment.email,
        );
      }

      if (!crmClient) {
        throw new Error(
          "Nenhum cliente cadastrado no CRM foi localizado para este agendamento. Por favor, cadastre o cliente no CRM antes de converter o agendamento em sessão.",
        );
      }

      // 3. Monta a data de início da sessão
      let sessionStartIso = new Date().toISOString();
      if (data.sessionStartedAt) {
        sessionStartIso = data.sessionStartedAt;
      } else if (appointment.preferred_date) {
        const timePart = appointment.preferred_time || "09:00";
        const dateObj = new Date(`${appointment.preferred_date}T${timePart}:00Z`);
        if (!isNaN(dateObj.getTime())) {
          sessionStartIso = dateObj.toISOString();
        }
      }

      // 4. Constrói o payload da sessão clínica
      const validStatuses = ["scheduled", "in_progress", "completed", "cancelled", "no_show"];
      const finalStatus =
        data.status && validStatuses.includes(data.status) ? data.status : "completed";

      const sessionPayload: ClientSessionInsert = {
        client_id: crmClient.id,
        appointment_id: appointment.id,
        service_id: data.serviceId ?? null,
        professional_user_id: context.user?.id ?? context.userId,
        session_started_at: sessionStartIso,
        status: finalStatus,
        client_report: data.clientReport ?? null,
        recommendations: data.recommendations ?? null,
      };

      // 5. Cria a sessão clínica no repositório de client_sessions
      const newSession = await createClientSession(context.supabase, sessionPayload);

      // 6. Atualiza o status do agendamento para completed via RPC
      try {
        await appointmentsRepo.changeAppointmentStatus(context.supabase, {
          appointmentId: appointment.id,
          newStatus: "completed",
        });
      } catch (rpcError) {
        console.warn("[convertAppointmentToSessionFn] Status update warning:", rpcError);
      }

      return newSession;
    } catch (error) {
      console.error("[convertAppointmentToSessionFn] Conversion error:", error);
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error("Erro ao converter agendamento em Sessão Clínica.");
    }
  });

/**
 * Server Function: Resolve o cliente do CRM para um determinado agendamento.
 * 1. Utiliza appointment.client_id se preenchido.
 * 2. Recorre a findClientByAppointmentContact (servidor) se client_id for NULL.
 * Nunca carrega a lista completa de clientes.
 */
export const resolveAppointmentClientFn = createServerFn({ method: "GET" })
  .validator((input: unknown): { appointmentId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;
    const appointmentId =
      typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";
    if (!isValidUuid(appointmentId)) {
      throw new Error("ID do agendamento inválido.");
    }
    return { appointmentId };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<ClientRecord | null> => {
    try {
      const appointment = await appointmentsRepo.getAppointmentById(
        context.supabase,
        data.appointmentId,
      );
      if (!appointment) return null;

      if (appointment.client_id) {
        const client = await getClientById(context.supabase, appointment.client_id);
        if (client) return client;
      }

      return await appointmentsRepo.findClientByAppointmentContact(
        context.supabase,
        appointment.phone,
        appointment.email,
      );
    } catch (error) {
      console.error("[resolveAppointmentClientFn] Error resolving client:", error);
      throw new Error("Erro ao resolver cliente do agendamento.");
    }
  });
