import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ClientRecord } from "@/lib/clients.repository";
import { normalizeBrazilianPhone } from "@/lib/phone";

export type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
export type AppointmentInsert = Database["public"]["Tables"]["appointments"]["Insert"];
export type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"];

export type AppointmentStatus = "confirmed" | "cancelled" | "completed" | "pending";
export type AppointmentRecord = AppointmentRow;

export type ChangeAppointmentStatusParams = {
  appointmentId: string;
  newStatus: "confirmed" | "cancelled" | "completed";
};

export type ChangeAppointmentStatusResult = {
  appointment_id: string;
  previous_status: string;
  appointment_status: string;
  calendar_slot_id: string | null;
  changed_at: string;
};

/**
 * Retorna todos os agendamentos registrados no sistema (mais recentes primeiro).
 */
export async function listAppointments(
  client: SupabaseClient<Database>,
): Promise<AppointmentRecord[]> {
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AppointmentRecord[];
}

/**
 * Consulta os detalhes de um agendamento específico por ID.
 */
export async function getAppointmentById(
  client: SupabaseClient<Database>,
  appointmentId: string,
): Promise<AppointmentRecord | null> {
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AppointmentRecord | null;
}

/**
 * Atualiza as notas internas de um agendamento.
 */
export async function updateAppointmentInternalNotes(
  client: SupabaseClient<Database>,
  appointmentId: string,
  internalNotes: string,
): Promise<void> {
  const { error } = await client
    .from("appointments")
    .update({ internal_notes: internalNotes, updated_at: new Date().toISOString() })
    .eq("id", appointmentId);

  if (error) {
    throw error;
  }
}

/**
 * Altera o status de um agendamento utilizando a RPC de banco change_appointment_status.
 */
export async function changeAppointmentStatus(
  client: SupabaseClient<Database>,
  params: ChangeAppointmentStatusParams,
): Promise<ChangeAppointmentStatusResult> {
  const { data, error } = await client.rpc("change_appointment_status", {
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

/**
 * Tenta localizar um cliente existente no CRM utilizando o telefone ou e-mail fornecidos no agendamento.
 * 1. Busca por telefone (se informado e com dígitos suficientes).
 * 2. Se não encontrar por telefone, busca por e-mail (se informado).
 * 3. Retorna null se nenhum cliente for encontrado.
 * Nunca cria ou altera registros no banco.
 */
export async function findClientByAppointmentContact(
  client: SupabaseClient<Database>,
  phone?: string | null,
  email?: string | null,
): Promise<ClientRecord | null> {
  const cleanPhone = normalizeBrazilianPhone(phone);
  const cleanEmail = email?.trim().toLowerCase() ?? "";

  // 1. Busca por telefone
  if (cleanPhone) {
    const { data: candidates, error: phoneErr } = await client
      .from("clients")
      .select("*")
      .neq("status", "archived")
      .is("deleted_at", null);

    if (!phoneErr) {
      const phoneMatches = (candidates ?? []).filter(
        (candidate) => normalizeBrazilianPhone(candidate.phone) === cleanPhone,
      );
      if (phoneMatches.length === 1) return phoneMatches[0];
    }
  }

  // 2. Busca por e-mail caso o telefone não traga resultado
  if (cleanEmail.length > 3) {
    const { data: emailMatch, error: emailErr } = await client
      .from("clients")
      .select("*")
      .ilike("email", cleanEmail)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle();

    if (!emailErr && emailMatch) {
      return emailMatch;
    }
  }

  return null;
}
