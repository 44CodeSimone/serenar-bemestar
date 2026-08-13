import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createProtectedPrebooking } from "@/lib/prebooking.functions";

export type CalendarSlotRow = Database["public"]["Tables"]["calendar_slots"]["Row"];
export type CalendarSlotInsert = Database["public"]["Tables"]["calendar_slots"]["Insert"];
export type CalendarSlotUpdate = Database["public"]["Tables"]["calendar_slots"]["Update"];

type MutableCalendarSlot = Pick<
  CalendarSlotRow,
  "slot_date" | "start_time" | "end_time" | "professional_name" | "status"
>;

export type CreateCalendarSlotParams = Omit<
  CalendarSlotInsert,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by" | "deleted_at" | "reserved_at"
>;

export type UpdateCalendarSlotParams = Omit<
  CalendarSlotUpdate,
  | "id"
  | "created_at"
  | "created_by"
  | "updated_at"
  | "updated_by"
  | "deleted_at"
  | "reserved_at"
  | "status"
>;

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

export type AdminCalendarAppointment = Pick<
  AppointmentRow,
  "id" | "full_name" | "service" | "status"
> & {
  calendar_slot_id: string;
};

export type AdminCalendarSlot = Pick<
  CalendarSlotRow,
  | "id"
  | "slot_date"
  | "start_time"
  | "end_time"
  | "status"
  | "published"
  | "professional_name"
  | "notes"
> & {
  appointment: AdminCalendarAppointment | null;
};

function getSaoPauloDateTime(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}:${value("second")}`,
  };
}

function normalizeTime(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value);

  if (!match) {
    throw new Error("Informe um horário válido.");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");

  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error("Informe um horário válido.");
  }

  return `${match[1]}:${match[2]}:${String(second).padStart(2, "0")}`;
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function validateSlotDateTime(slotDate: string, startTime: string, endTime: string): void {
  if (!isValidIsoDate(slotDate)) {
    throw new Error("Informe uma data válida.");
  }

  const normalizedStart = normalizeTime(startTime);
  const normalizedEnd = normalizeTime(endTime);
  const now = getSaoPauloDateTime();

  if (slotDate < now.date || (slotDate === now.date && normalizedStart <= now.time)) {
    throw new Error("Não é possível cadastrar um horário no passado.");
  }

  if (normalizedEnd <= normalizedStart) {
    throw new Error("O horário final deve ser posterior ao horário inicial.");
  }
}

function normalizeProfessionalName(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized === "" ? null : normalized;
}

async function getMutableCalendarSlot(
  client: SupabaseClient<Database>,
  calendarSlotId: string,
): Promise<MutableCalendarSlot> {
  const { data, error } = await client
    .from("calendar_slots")
    .select("slot_date,start_time,end_time,professional_name,status")
    .eq("id", calendarSlotId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Horário não encontrado.");
  }

  if (data.status === "reserved") {
    throw new Error("Este horário possui agendamento ativo e não pode ser alterado.");
  }

  return data;
}

async function ensureNoSlotConflict(
  client: SupabaseClient<Database>,
  slotDate: string,
  startTime: string,
  endTime: string,
  professionalName: string | null,
  ignoredSlotId?: string,
): Promise<void> {
  let query = client
    .from("calendar_slots")
    .select("id")
    .eq("slot_date", slotDate)
    .is("deleted_at", null)
    .lt("start_time", normalizeTime(endTime))
    .gt("end_time", normalizeTime(startTime));

  query = professionalName
    ? query.eq("professional_name", professionalName)
    : query.is("professional_name", null);

  if (ignoredSlotId) {
    query = query.neq("id", ignoredSlotId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    throw new Error("Já existe um horário sobreposto para este profissional.");
  }
}

/**
 * Returns a list of publicly available calendar slots.
 */
export async function listPublicCalendarSlots(
  client: SupabaseClient<Database>,
): Promise<Array<Pick<CalendarSlotRow, "id" | "slot_date" | "start_time" | "end_time">>> {
  const { date: today, time: currentTime } = getSaoPauloDateTime();

  const { data, error } = await client
    .from("calendar_slots")
    .select("id,slot_date,start_time,end_time")
    .eq("published", true)
    .eq("status", "open")
    .is("deleted_at", null)
    .gte("slot_date", today)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []).filter(
    (slot) => slot.slot_date > today || slot.start_time > currentTime,
  ) as Array<Pick<CalendarSlotRow, "id" | "slot_date" | "start_time" | "end_time">>);
}

/**
 * Returns administrative calendar slots in chronological order, including
 * the active appointment linked to each slot when one exists.
 */
export async function listAdminCalendarSlots(
  client: SupabaseClient<Database>,
): Promise<AdminCalendarSlot[]> {
  const { data: slots, error: slotsError } = await client
    .from("calendar_slots")
    .select("id,slot_date,start_time,end_time,status,published,professional_name,notes")
    .is("deleted_at", null)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (slotsError) {
    throw slotsError;
  }

  const calendarSlots = slots ?? [];

  if (calendarSlots.length === 0) {
    return [];
  }

  const slotIds = calendarSlots.map((slot) => slot.id);

  const { data: appointments, error: appointmentsError } = await client
    .from("appointments")
    .select("id,calendar_slot_id,full_name,service,status")
    .in("calendar_slot_id", slotIds)
    .in("status", ["pending", "confirmed", "completed"]);

  if (appointmentsError) {
    throw appointmentsError;
  }

  const appointmentBySlot = new Map<string, AdminCalendarAppointment>();

  for (const appointment of appointments ?? []) {
    if (!appointment.calendar_slot_id) {
      continue;
    }

    appointmentBySlot.set(appointment.calendar_slot_id, {
      id: appointment.id,
      calendar_slot_id: appointment.calendar_slot_id,
      full_name: appointment.full_name,
      service: appointment.service,
      status: appointment.status,
    });
  }

  return calendarSlots.map((slot) => ({
    ...slot,
    appointment: appointmentBySlot.get(slot.id) ?? null,
  }));
}

/**
 * Cadastra um novo horário na agenda.
 */
export async function createCalendarSlot(
  client: SupabaseClient<Database>,
  params: CreateCalendarSlotParams,
  userId?: string,
): Promise<CalendarSlotRow> {
  validateSlotDateTime(params.slot_date, params.start_time, params.end_time);
  const professionalName = normalizeProfessionalName(params.professional_name);
  await ensureNoSlotConflict(
    client,
    params.slot_date,
    params.start_time,
    params.end_time,
    professionalName,
  );

  const { data, error } = await client
    .from("calendar_slots")
    .insert({
      ...params,
      professional_name: professionalName,
      ...(userId ? { created_by: userId, updated_by: userId } : {}),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Atualiza as informações de um horário existente na agenda.
 */
export async function updateCalendarSlot(
  client: SupabaseClient<Database>,
  calendarSlotId: string,
  params: UpdateCalendarSlotParams,
  userId?: string,
): Promise<CalendarSlotRow> {
  const currentSlot = await getMutableCalendarSlot(client, calendarSlotId);
  const slotDate = params.slot_date ?? currentSlot.slot_date;
  const startTime = params.start_time ?? currentSlot.start_time;
  const endTime = params.end_time ?? currentSlot.end_time;
  const professionalName =
    "professional_name" in params
      ? normalizeProfessionalName(params.professional_name)
      : currentSlot.professional_name;

  validateSlotDateTime(slotDate, startTime, endTime);
  await ensureNoSlotConflict(client, slotDate, startTime, endTime, professionalName, calendarSlotId);

  const { data, error } = await client
    .from("calendar_slots")
    .update({
      ...params,
      ...(typeof params.start_time === "string"
        ? { start_time: normalizeTime(params.start_time) }
        : {}),
      ...(typeof params.end_time === "string" ? { end_time: normalizeTime(params.end_time) } : {}),
      ...("professional_name" in params ? { professional_name: professionalName } : {}),
      ...(userId ? { updated_by: userId } : {}),
    })
    .eq("id", calendarSlotId)
    .neq("status", "reserved")
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Altera o status de publicação (visibilidade pública no site).
 */
export async function toggleCalendarSlotPublished(
  client: SupabaseClient<Database>,
  calendarSlotId: string,
  published: boolean,
  userId?: string,
): Promise<CalendarSlotRow> {
  await getMutableCalendarSlot(client, calendarSlotId);
  const { data, error } = await client
    .from("calendar_slots")
    .update({ published, ...(userId ? { updated_by: userId } : {}) })
    .eq("id", calendarSlotId)
    .neq("status", "reserved")
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Bloqueia administrativamente um horário disponível.
 */
export async function blockCalendarSlot(
  client: SupabaseClient<Database>,
  calendarSlotId: string,
  userId?: string,
): Promise<CalendarSlotRow> {
  const { data, error } = await client
    .from("calendar_slots")
    .update({ status: "blocked", reserved_at: null, ...(userId ? { updated_by: userId } : {}) })
    .eq("id", calendarSlotId)
    .eq("status", "open")
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Libera um horário bloqueado de volta para o estado disponível.
 */
export async function releaseCalendarSlot(
  client: SupabaseClient<Database>,
  calendarSlotId: string,
  userId?: string,
): Promise<CalendarSlotRow> {
  const { data, error } = await client
    .from("calendar_slots")
    .update({ status: "open", reserved_at: null, ...(userId ? { updated_by: userId } : {}) })
    .eq("id", calendarSlotId)
    .eq("status", "blocked")
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Exclui logicamente (soft delete) um horário da agenda.
 */
export async function deleteCalendarSlot(
  client: SupabaseClient<Database>,
  calendarSlotId: string,
  userId?: string,
): Promise<void> {
  try {
    await getMutableCalendarSlot(client, calendarSlotId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("agendamento ativo")) {
      throw new Error("Este horário possui agendamento ativo e não pode ser excluído.");
    }

    throw error;
  }

  const { data, error } = await client
    .from("calendar_slots")
    .update({
      deleted_at: new Date().toISOString(),
      published: false,
      ...(userId ? { updated_by: userId } : {}),
    })
    .eq("id", calendarSlotId)
    .neq("status", "reserved")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Este horário não pôde ser excluído porque foi alterado por outra operação.");
  }
}

export type CreatePrebookingParams = {
  calendarSlotId: string;
  fullName: string;
  phone: string;
  email?: string;
  serviceId: string;
  notes?: string;
  turnstileToken?: string;
  website?: string;
};

/**
 * Atomically reserves a calendar slot and creates a pre-booking appointment
 * via the `create_prebooking` database RPC function.
 */
export async function createPrebooking(params: CreatePrebookingParams) {
  return createProtectedPrebooking({ data: params });
}
