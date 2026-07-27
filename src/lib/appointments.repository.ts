// src/lib/appointments.repository.ts
import { supabase } from "@/integrations/supabase/client";

export type AppointmentStatus = "confirmed" | "cancelled" | "completed";

export type AppointmentRecord = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  service: string;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  internal_notes: string | null;
  status: string;
  created_at: string;
};

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

export async function listAppointments(): Promise<AppointmentRecord[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, full_name, phone, email, service, preferred_date, preferred_time, notes, internal_notes, status, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AppointmentRecord[];
}

export async function updateAppointmentInternalNotes(
  appointmentId: string,
  internalNotes: string,
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ internal_notes: internalNotes })
    .eq("id", appointmentId);

  if (error) {
    throw error;
  }
}

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

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error("A RPC não retornou o agendamento atualizado.");
  }

  return result as ChangeAppointmentStatusResult;
}
