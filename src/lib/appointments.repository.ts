// src/lib/appointments.repository.ts
import { supabase } from "@/integrations/supabase/client";

/**
 * Statuses accepted by the `change_appointment_status` RPC.
 * The allowed transitions themselves are enforced in PostgreSQL, not here.
 */
export type AppointmentStatus = "confirmed" | "cancelled" | "completed";

export type ChangeAppointmentStatusParams = {
  appointmentId: string;
  newStatus: AppointmentStatus;
};

export type ChangeAppointmentStatusResult = {
  appointment_id: string;
  previous_status: string;
  appointment_status: string;
  calendar_slot_id: string | null;
  changed_at: string;
};

/**
 * Thin wrapper around the `change_appointment_status` database RPC.
 * All business rules (authorization, allowed transitions, row locking and
 * calendar slot release) live inside PostgreSQL.
 */
export async function changeAppointmentStatus(
  params: ChangeAppointmentStatusParams,
): Promise<ChangeAppointmentStatusResult> {
  const { data, error } = await supabase.rpc("change_appointment_status", {
    p_appointment_id: params.appointmentId,
    p_new_status: params.newStatus,
  });

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data[0] : data) as ChangeAppointmentStatusResult;
}
