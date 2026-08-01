// src/lib/calendar-slots.repository.ts
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public calendar slot row type from the generated Supabase typings.
 */
type CalendarSlotRow = Database["public"]["Tables"]["calendar_slots"]["Row"];
type CalendarSlotInsert = Database["public"]["Tables"]["calendar_slots"]["Insert"];
type CalendarSlotUpdate = Database["public"]["Tables"]["calendar_slots"]["Update"];
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

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Usuário não autenticado.");
  }

  return data.user.id;
}

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

async function getMutableCalendarSlot(calendarSlotId: string): Promise<MutableCalendarSlot> {
  const { data, error } = await supabase
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
  slotDate: string,
  startTime: string,
  endTime: string,
  professionalName: string | null,
  ignoredSlotId?: string,
): Promise<void> {
  let query = supabase
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
 *
 * The query selects only the fields required for the public UI:
 *   - id
 *   - slot_date
 *   - start_time
 *   - end_time
 *
 * Filters applied:
 *   - published = true
 *   - status = "open"
 *   - deleted_at IS NULL (handled implicitly by the RLS policy)
 *
 * Results are ordered by slot_date ascending, then start_time ascending.
 */
export async function listPublicCalendarSlots(): Promise<
  Array<Pick<CalendarSlotRow, "id" | "slot_date" | "start_time" | "end_time">>
> {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const currentTime = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join(":");

  const { data, error } = await supabase
    .from("calendar_slots")
    .select("id,slot_date,start_time,end_time")
    .eq("published", true)
    .eq("status", "open")
    .is("deleted_at", null)
    .gte("slot_date", today)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Failed to load public calendar slots:", error);
    return [];
  }

  return (data ?? []).filter(
    (slot) => slot.slot_date > today || slot.start_time > currentTime,
  ) as Array<Pick<CalendarSlotRow, "id" | "slot_date" | "start_time" | "end_time">>;
}

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

/**
 * Returns administrative calendar slots in chronological order, including
 * the active appointment linked to each slot when one exists.
 */
export async function listAdminCalendarSlots(): Promise<AdminCalendarSlot[]> {
  const { data: slots, error: slotsError } = await supabase
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

  const { data: appointments, error: appointmentsError } = await supabase
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

export async function createCalendarSlot(
  params: CreateCalendarSlotParams,
): Promise<CalendarSlotRow> {
  validateSlotDateTime(params.slot_date, params.start_time, params.end_time);
  const professionalName = normalizeProfessionalName(params.professional_name);
  await ensureNoSlotConflict(
    params.slot_date,
    params.start_time,
    params.end_time,
    professionalName,
  );

  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("calendar_slots")
    .insert({
      ...params,
      professional_name: professionalName,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCalendarSlot(
  calendarSlotId: string,
  params: UpdateCalendarSlotParams,
): Promise<CalendarSlotRow> {
  const currentSlot = await getMutableCalendarSlot(calendarSlotId);
  const slotDate = params.slot_date ?? currentSlot.slot_date;
  const startTime = params.start_time ?? currentSlot.start_time;
  const endTime = params.end_time ?? currentSlot.end_time;
  const professionalName =
    "professional_name" in params
      ? normalizeProfessionalName(params.professional_name)
      : currentSlot.professional_name;

  validateSlotDateTime(slotDate, startTime, endTime);
  await ensureNoSlotConflict(slotDate, startTime, endTime, professionalName, calendarSlotId);

  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("calendar_slots")
    .update({
      ...params,
      ...(typeof params.start_time === "string"
        ? { start_time: normalizeTime(params.start_time) }
        : {}),
      ...(typeof params.end_time === "string" ? { end_time: normalizeTime(params.end_time) } : {}),
      ...("professional_name" in params ? { professional_name: professionalName } : {}),
      updated_by: userId,
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

export async function toggleCalendarSlotPublished(
  calendarSlotId: string,
  published: boolean,
): Promise<CalendarSlotRow> {
  await getMutableCalendarSlot(calendarSlotId);
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("calendar_slots")
    .update({ published, updated_by: userId })
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

export async function blockCalendarSlot(calendarSlotId: string): Promise<CalendarSlotRow> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("calendar_slots")
    .update({ status: "blocked", reserved_at: null, updated_by: userId })
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

export async function releaseCalendarSlot(calendarSlotId: string): Promise<CalendarSlotRow> {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("calendar_slots")
    .update({ status: "open", reserved_at: null, updated_by: userId })
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

export async function deleteCalendarSlot(calendarSlotId: string): Promise<void> {
  try {
    await getMutableCalendarSlot(calendarSlotId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("agendamento ativo")) {
      throw new Error("Este horário possui agendamento ativo e não pode ser excluído.");
    }

    throw error;
  }

  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("calendar_slots")
    .update({
      deleted_at: new Date().toISOString(),
      published: false,
      updated_by: userId,
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
};

/**
 * Atomically reserves a calendar slot and creates a pre-booking appointment
 * via the `create_prebooking` database RPC function.
 */
export async function createPrebooking(params: CreatePrebookingParams) {
  const { data, error } = await supabase.rpc("create_prebooking", {
    p_calendar_slot_id: params.calendarSlotId,
    p_full_name: params.fullName,
    p_phone: params.phone,
    p_email: params.email || "",
    p_service_id: params.serviceId,
    p_notes: params.notes || "",
  });

  if (error) {
    throw error;
  }

  return data;
}
