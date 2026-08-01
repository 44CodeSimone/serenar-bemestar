// src/lib/calendar-slots.repository.ts
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public calendar slot row type from the generated Supabase typings.
 */
type CalendarSlotRow = Database["public"]["Tables"]["calendar_slots"]["Row"];
type CalendarSlotInsert = Database["public"]["Tables"]["calendar_slots"]["Insert"];
type CalendarSlotUpdate = Database["public"]["Tables"]["calendar_slots"]["Update"];

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
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("calendar_slots")
    .insert({
      ...params,
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
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("calendar_slots")
    .update({ ...params, updated_by: userId })
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
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase
    .from("calendar_slots")
    .update({
      deleted_at: new Date().toISOString(),
      published: false,
      updated_by: userId,
    })
    .eq("id", calendarSlotId)
    .neq("status", "reserved")
    .is("deleted_at", null);

  if (error) {
    throw error;
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
