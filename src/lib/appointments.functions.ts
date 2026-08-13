import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as appointmentsRepo from "@/lib/appointments.repository";
import * as sessionsRepo from "@/lib/client-sessions.repository";
import type {
  AppointmentRecord,
  AppointmentStatus,
  ChangeAppointmentStatusResult,
} from "@/lib/appointments.repository";
import type { ClientSessionRow, ClientSessionInsert } from "@/lib/client-sessions.repository";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

export interface ConvertAppointmentToSessionInput {
  appointmentId: string;
  serviceId?: string | null;
  clientReport?: string | null;
  recommendations?: string | null;
  sessionStartedAt?: string | null;
  status?: string | null;
}

/**
 * Server Function: Lista todos os agendamentos cadastrados (mais recentes primeiro).
 */
export const listAppointmentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppointmentRecord[]> => {
    try {
      return await appointmentsRepo.listAppointments(context.supabase);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao carregar a lista de agendamentos.");
    }
  });

/**
 * Server Function: Obtém os detalhes de um agendamento específico por ID.
 */
export const getAppointmentByIdFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { appointmentId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Parâmetros inválidos.");
    }
    const params = input as Record<string, unknown>;
    const appointmentId = typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";

    if (!isValidUuid(appointmentId)) {
      throw new Error("ID do agendamento inválido.");
    }

    return { appointmentId };
  })
  .handler(async ({ context, data }): Promise<AppointmentRecord> => {
    try {
      const appointment = await appointmentsRepo.getAppointmentById(
        context.supabase,
        data.appointmentId,
      );
      if (!appointment) {
        throw new Error("Agendamento não encontrado.");
      }
      return appointment;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao buscar detalhes do agendamento.");
    }
  });

/**
 * Server Function: Altera o status de um agendamento (confirmed, cancelled, completed).
 */
export const changeAppointmentStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: unknown): { appointmentId: string; newStatus: AppointmentStatus } => {
      if (typeof input !== "object" || input === null) {
        throw new Error("Payload inválido.");
      }
      const params = input as Record<string, unknown>;
      const appointmentId = typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";
      const newStatus = typeof params.newStatus === "string" ? params.newStatus.trim() : "";

      if (!isValidUuid(appointmentId)) {
        throw new Error("ID do agendamento inválido.");
      }

      if (newStatus !== "confirmed" && newStatus !== "cancelled" && newStatus !== "completed") {
        throw new Error("Novo status de agendamento inválido.");
      }

      return { appointmentId, newStatus };
    },
  )
  .handler(async ({ context, data }): Promise<ChangeAppointmentStatusResult> => {
    try {
      return await appointmentsRepo.changeAppointmentStatus(context.supabase, {
        appointmentId: data.appointmentId,
        newStatus: data.newStatus,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao alterar o status do agendamento.");
    }
  });

/**
 * Server Function: Atualiza as notas internas de um agendamento.
 */
export const updateAppointmentInternalNotesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { appointmentId: string; internalNotes: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;
    const appointmentId = typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";
    const internalNotes = typeof params.internalNotes === "string" ? params.internalNotes.trim() : "";

    if (!isValidUuid(appointmentId)) {
      throw new Error("ID do agendamento inválido.");
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
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao atualizar as notas internas do agendamento.");
    }
  });

/**
 * Server Function: Converte um agendamento em uma Sessão Clínica no CRM.
 * Resolve o cliente pelo contato (telefone/e-mail) via findClientByAppointmentContact.
 * Se não existir cliente no CRM, retorna erro de validação amigável. Nunca cria clientes automaticamente.
 */
export const convertAppointmentToSessionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): ConvertAppointmentToSessionInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload de conversão inválido.");
    }
    const params = input as Record<string, unknown>;

    const appointmentId = typeof params.appointmentId === "string" ? params.appointmentId.trim() : "";
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

      // 2. Resolve o cliente no CRM usando telefone / e-mail do agendamento
      const crmClient = await appointmentsRepo.findClientByAppointmentContact(
        context.supabase,
        appointment.phone,
        appointment.email,
      );

      if (!crmClient) {
        throw new Error(
          "Nenhum cliente cadastrado no CRM foi localizado com este telefone ou e-mail. Por favor, cadastre o cliente no CRM antes de converter o agendamento em sessão.",
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
      const finalStatus = data.status && validStatuses.includes(data.status) ? data.status : "completed";

      const sessionPayload: ClientSessionInsert = {
        client_id: crmClient.id,
        appointment_id: appointment.id,
        service_id: data.serviceId ?? null,
        professional_user_id: context.user.id,
        session_started_at: sessionStartIso,
        status: finalStatus,
        client_report: data.clientReport ?? appointment.notes ?? null,
        professional_summary: `Sessão clínica gerada a partir do agendamento de ${appointment.service}.`,
        recommendations: data.recommendations ?? null,
      };

      // 5. Reutiliza o repositório existente de client_sessions
      const createdSession = await sessionsRepo.createClientSession(
        context.supabase,
        sessionPayload,
      );

      // 6. Atualiza o agendamento para completed se ainda não estiver concluído
      if (appointment.status !== "completed" && finalStatus === "completed") {
        try {
          await appointmentsRepo.changeAppointmentStatus(context.supabase, {
            appointmentId: appointment.id,
            newStatus: "completed",
          });
        } catch {
          // Ignora falha de RPC se a transição não for permitida diretamente
        }
      }

      return createdSession;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao converter agendamento em sessão clínica.");
    }
  });
