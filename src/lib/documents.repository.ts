import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ClientDocumentRow = Database["public"]["Tables"]["client_documents"]["Row"];
export type ClientDocumentInsert = Database["public"]["Tables"]["client_documents"]["Insert"];
export type ClientDocumentUpdate = Database["public"]["Tables"]["client_documents"]["Update"];

/**
 * Consulta a lista de metadados de documentos de um cliente.
 * Por padrão, retorna apenas documentos não arquivados (archived_at IS NULL).
 * Ordenados por data de criação descendente (created_at DESC).
 */
export async function listClientDocuments(
  client: SupabaseClient<Database>,
  clientId: string,
  includeArchived = false,
): Promise<ClientDocumentRow[]> {
  let query = client
    .from("client_documents")
    .select("*")
    .eq("client_id", clientId);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Consulta os metadados de um documento específico por ID (UUID).
 */
export async function getClientDocument(
  client: SupabaseClient<Database>,
  documentId: string,
): Promise<ClientDocumentRow | null> {
  const { data, error } = await client
    .from("client_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Cria um novo registro de metadados de documento do cliente.
 */
export async function createClientDocument(
  client: SupabaseClient<Database>,
  payload: ClientDocumentInsert,
): Promise<ClientDocumentRow> {
  const { data, error } = await client
    .from("client_documents")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Realiza o arquivamento lógico de um documento do cliente.
 * Atualiza EXCLUSIVAMENTE a coluna archived_at. Nunca altera outras colunas nem deleta.
 */
export async function archiveClientDocument(
  client: SupabaseClient<Database>,
  documentId: string,
  archivedAt: string = new Date().toISOString(),
): Promise<ClientDocumentRow> {
  const { data, error } = await client
    .from("client_documents")
    .update({ archived_at: archivedAt })
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Consulta documentos não arquivados vinculados a uma entidade relacionada polimórfica (ex: sessão, anamnese).
 * Ordenados por data de criação descendente (created_at DESC).
 */
export async function listDocumentsByEntity(
  client: SupabaseClient<Database>,
  entityType: string,
  entityId: string,
): Promise<ClientDocumentRow[]> {
  const { data, error } = await client
    .from("client_documents")
    .select("*")
    .eq("related_entity_type", entityType)
    .eq("related_entity_id", entityId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}
