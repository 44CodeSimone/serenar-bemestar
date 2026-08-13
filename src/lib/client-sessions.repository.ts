import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ClientSessionRow = Database["public"]["Tables"]["client_sessions"]["Row"];
export type ClientSessionInsert = Database["public"]["Tables"]["client_sessions"]["Insert"];
export type ClientSessionUpdate = Database["public"]["Tables"]["client_sessions"]["Update"];

export type SessionNoteRow = Database["public"]["Tables"]["session_notes"]["Row"];
export type SessionNoteInsert = Database["public"]["Tables"]["session_notes"]["Insert"];

export interface ClientSessionWithDetails extends ClientSessionRow {
  service?: {
    id: string;
    name: string;
  } | null;
  appointment?: {
    id: string;
    preferred_date: string | null;
  } | null;
}

/**
 * Lista as sessões clínicas vinculadas a um cliente específico (mais recentes primeiro).
 */
export async function listClientSessions(
  supabase: SupabaseClient<Database>,
  clientId: string
): Promise<ClientSessionWithDetails[]> {
  const { data, error } = await supabase
    .from("client_sessions")
    .select(`
      *,
      service:services (
        id,
        name
      ),
      appointment:appointments (
        id,
        preferred_date
      )
    `)
    .eq("client_id", clientId)
    .order("session_started_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar sessões clínicas do cliente: ${error.message}`);
  }

  return (data as unknown as ClientSessionWithDetails[]) || [];
}

/**
 * Obtém os detalhes completos de uma sessão clínica específica por ID.
 */
export async function getClientSessionById(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<ClientSessionWithDetails | null> {
  const { data, error } = await supabase
    .from("client_sessions")
    .select(`
      *,
      service:services (
        id,
        name
      ),
      appointment:appointments (
        id,
        preferred_date
      )
    `)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar sessão clínica: ${error.message}`);
  }

  return (data as unknown as ClientSessionWithDetails) || null;
}

/**
 * Cria uma nova sessão clínica no banco de dados.
 */
export async function createClientSession(
  supabase: SupabaseClient<Database>,
  payload: ClientSessionInsert
): Promise<ClientSessionRow> {
  const { data, error } = await supabase
    .from("client_sessions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar sessão clínica: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza os dados de uma sessão clínica existente.
 */
export async function updateClientSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  payload: ClientSessionUpdate
): Promise<ClientSessionRow> {
  const updateData: ClientSessionUpdate = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("client_sessions")
    .update(updateData)
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar sessão clínica: ${error.message}`);
  }

  return data;
}

/**
 * Insere uma nova nota de evolução (append-only) para uma sessão clínica.
 */
export async function insertSessionNote(
  supabase: SupabaseClient<Database>,
  payload: SessionNoteInsert
): Promise<SessionNoteRow> {
  const { data, error } = await supabase
    .from("session_notes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao registrar nota de evolução: ${error.message}`);
  }

  return data;
}

/**
 * Lista o histórico de notas de evolução de uma sessão clínica (ordenadas cronologicamente).
 */
export async function listSessionNotes(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<SessionNoteRow[]> {
  const { data, error } = await supabase
    .from("session_notes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar notas da sessão: ${error.message}`);
  }

  return data || [];
}
