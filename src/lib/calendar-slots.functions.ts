import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as repo from "@/lib/calendar-slots.repository";
import type {
  AdminCalendarSlot,
  CalendarSlotRow,
  CreateCalendarSlotParams,
  UpdateCalendarSlotParams,
} from "@/lib/calendar-slots.repository";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

function isValidIsoDate(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  return ISO_DATE_REGEX.test(dateStr.trim());
}

function isValidTimeFormat(timeStr?: string | null): boolean {
  if (!timeStr || typeof timeStr !== "string") return false;
  return TIME_REGEX.test(timeStr.trim());
}

export interface CreateCalendarSlotInput {
  slotDate: string;
  startTime: string;
  endTime: string;
  professionalName?: string | null;
  notes?: string | null;
  published?: boolean;
}

export interface UpdateCalendarSlotInput {
  calendarSlotId: string;
  slotDate?: string;
  startTime?: string;
  endTime?: string;
  professionalName?: string | null;
  notes?: string | null;
  published?: boolean;
}

/**
 * Server Function (GET): Retorna a listagem administrativa de horários da agenda com agendamentos vinculados.
 */
export const listAdminCalendarSlotsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCalendarSlot[]> => {
    try {
      return await repo.listAdminCalendarSlots(context.supabase);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao carregar os horários da agenda.");
    }
  });

/**
 * Server Function (GET): Retorna a listagem pública de horários disponíveis para o site.
 */
export const listPublicCalendarSlotsFn = createServerFn({ method: "GET" }).handler(
  async ({ context }): Promise<Array<Pick<CalendarSlotRow, "id" | "slot_date" | "start_time" | "end_time">>> => {
    try {
      const ctx = context as unknown as { supabase: Parameters<typeof repo.listPublicCalendarSlots>[0] };
      return await repo.listPublicCalendarSlots(ctx.supabase);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao carregar horários disponíveis.");
    }
  },
);

/**
 * Server Function (POST): Cadastra um novo horário na agenda.
 */
export const createCalendarSlotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): CreateCalendarSlotInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;

    const slotDate = typeof params.slotDate === "string" ? params.slotDate.trim() : "";
    const startTime = typeof params.startTime === "string" ? params.startTime.trim() : "";
    const endTime = typeof params.endTime === "string" ? params.endTime.trim() : "";

    if (!isValidIsoDate(slotDate)) {
      throw new Error("Data do horário inválida.");
    }
    if (!isValidTimeFormat(startTime)) {
      throw new Error("Horário inicial inválido.");
    }
    if (!isValidTimeFormat(endTime)) {
      throw new Error("Horário final inválido.");
    }

    const professionalName =
      typeof params.professionalName === "string" && params.professionalName.trim().length > 0
        ? params.professionalName.trim()
        : null;

    const notes =
      typeof params.notes === "string" && params.notes.trim().length > 0 ? params.notes.trim() : null;

    const published = typeof params.published === "boolean" ? params.published : false;

    return {
      slotDate,
      startTime,
      endTime,
      professionalName,
      notes,
      published,
    };
  })
  .handler(async ({ context, data }): Promise<CalendarSlotRow> => {
    try {
      const payload: CreateCalendarSlotParams = {
        slot_date: data.slotDate,
        start_time: data.startTime,
        end_time: data.endTime,
        professional_name: data.professionalName,
        notes: data.notes,
        published: data.published,
      };

      return await repo.createCalendarSlot(
        context.supabase,
        payload,
        context.user?.id ?? context.userId,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao criar horário na agenda.");
    }
  });

/**
 * Server Function (POST): Atualiza as informações de um horário existente.
 */
export const updateCalendarSlotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): UpdateCalendarSlotInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;

    const calendarSlotId = typeof params.calendarSlotId === "string" ? params.calendarSlotId.trim() : "";
    if (!isValidUuid(calendarSlotId)) {
      throw new Error("ID do horário inválido.");
    }

    const result: UpdateCalendarSlotInput = { calendarSlotId };

    if (typeof params.slotDate === "string" && params.slotDate.trim().length > 0) {
      if (!isValidIsoDate(params.slotDate)) {
        throw new Error("Data do horário inválida.");
      }
      result.slotDate = params.slotDate.trim();
    }

    if (typeof params.startTime === "string" && params.startTime.trim().length > 0) {
      if (!isValidTimeFormat(params.startTime)) {
        throw new Error("Horário inicial inválido.");
      }
      result.startTime = params.startTime.trim();
    }

    if (typeof params.endTime === "string" && params.endTime.trim().length > 0) {
      if (!isValidTimeFormat(params.endTime)) {
        throw new Error("Horário final inválido.");
      }
      result.endTime = params.endTime.trim();
    }

    if ("professionalName" in params) {
      result.professionalName =
        typeof params.professionalName === "string" && params.professionalName.trim().length > 0
          ? params.professionalName.trim()
          : null;
    }

    if ("notes" in params) {
      result.notes =
        typeof params.notes === "string" && params.notes.trim().length > 0
          ? params.notes.trim()
          : null;
    }

    if (typeof params.published === "boolean") {
      result.published = params.published;
    }

    return result;
  })
  .handler(async ({ context, data }): Promise<CalendarSlotRow> => {
    try {
      const payload: UpdateCalendarSlotParams = {};
      if (data.slotDate) payload.slot_date = data.slotDate;
      if (data.startTime) payload.start_time = data.startTime;
      if (data.endTime) payload.end_time = data.endTime;
      if ("professionalName" in data) payload.professional_name = data.professionalName;
      if ("notes" in data) payload.notes = data.notes;
      if (typeof data.published === "boolean") payload.published = data.published;

      return await repo.updateCalendarSlot(
        context.supabase,
        data.calendarSlotId,
        payload,
        context.user?.id ?? context.userId,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao atualizar horário na agenda.");
    }
  });

/**
 * Server Function (POST): Alterna a visibilidade (publicação) de um horário.
 */
export const toggleCalendarSlotPublishedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { calendarSlotId: string; published: boolean } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;
    const calendarSlotId = typeof params.calendarSlotId === "string" ? params.calendarSlotId.trim() : "";
    const published = Boolean(params.published);

    if (!isValidUuid(calendarSlotId)) {
      throw new Error("ID do horário inválido.");
    }

    return { calendarSlotId, published };
  })
  .handler(async ({ context, data }): Promise<CalendarSlotRow> => {
    try {
      return await repo.toggleCalendarSlotPublished(
        context.supabase,
        data.calendarSlotId,
        data.published,
        context.user?.id ?? context.userId,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao alterar publicação do horário.");
    }
  });

/**
 * Server Function (POST): Bloqueia um horário disponível.
 */
export const blockCalendarSlotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { calendarSlotId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;
    const calendarSlotId = typeof params.calendarSlotId === "string" ? params.calendarSlotId.trim() : "";

    if (!isValidUuid(calendarSlotId)) {
      throw new Error("ID do horário inválido.");
    }

    return { calendarSlotId };
  })
  .handler(async ({ context, data }): Promise<CalendarSlotRow> => {
    try {
      return await repo.blockCalendarSlot(
        context.supabase,
        data.calendarSlotId,
        context.user?.id ?? context.userId,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao bloquear horário.");
    }
  });

/**
 * Server Function (POST): Libera um horário bloqueado de volta para o estado disponível.
 */
export const releaseCalendarSlotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { calendarSlotId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;
    const calendarSlotId = typeof params.calendarSlotId === "string" ? params.calendarSlotId.trim() : "";

    if (!isValidUuid(calendarSlotId)) {
      throw new Error("ID do horário inválido.");
    }

    return { calendarSlotId };
  })
  .handler(async ({ context, data }): Promise<CalendarSlotRow> => {
    try {
      return await repo.releaseCalendarSlot(
        context.supabase,
        data.calendarSlotId,
        context.user?.id ?? context.userId,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao liberar horário.");
    }
  });

/**
 * Server Function (POST): Exclui logicamente (soft delete) um horário da agenda.
 */
export const deleteCalendarSlotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { calendarSlotId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload inválido.");
    }
    const params = input as Record<string, unknown>;
    const calendarSlotId = typeof params.calendarSlotId === "string" ? params.calendarSlotId.trim() : "";

    if (!isValidUuid(calendarSlotId)) {
      throw new Error("ID do horário inválido.");
    }

    return { calendarSlotId };
  })
  .handler(async ({ context, data }): Promise<{ success: boolean }> => {
    try {
      await repo.deleteCalendarSlot(
        context.supabase,
        data.calendarSlotId,
        context.user?.id ?? context.userId,
      );
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao excluir horário.");
    }
  });
