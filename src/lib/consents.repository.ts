import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ClientConsentRecord = Database["public"]["Tables"]["client_consents"]["Row"];
export type CreateConsentParams = Database["public"]["Tables"]["client_consents"]["Insert"];
export type RevokeConsentParams = {
  consentId: string;
  revokedAt?: string;
};

/**
 * Retorna todos os registros de consentimento de um cliente.
 * Ordenado dos mais recentes para os mais antigos (newest first).
 */
export async function getClientConsents(
  client: SupabaseClient<Database>,
  clientId: string,
): Promise<ClientConsentRecord[]> {
  const { data, error } = await client
    .from("client_consents")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Retorna apenas os consentimentos ativos de um cliente:
 * granted = true AND revoked_at IS NULL.
 */
export async function getActiveConsents(
  client: SupabaseClient<Database>,
  clientId: string,
): Promise<ClientConsentRecord[]> {
  const { data, error } = await client
    .from("client_consents")
    .select("*")
    .eq("client_id", clientId)
    .eq("granted", true)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Insere um novo registro de consentimento no ledger (Append-Only).
 * Nunca sobrescreve registros anteriores.
 */
export async function grantClientConsent(
  client: SupabaseClient<Database>,
  params: CreateConsentParams,
): Promise<ClientConsentRecord> {
  const { data, error } = await client
    .from("client_consents")
    .insert(params)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Revoga um consentimento existente preenchendo revoked_at.
 * Nunca executa DELETE nem altera o histórico de concessão.
 */
export async function revokeClientConsent(
  client: SupabaseClient<Database>,
  params: RevokeConsentParams,
): Promise<ClientConsentRecord> {
  const revokedAt = params.revokedAt ?? new Date().toISOString();

  const { data, error } = await client
    .from("client_consents")
    .update({ revoked_at: revokedAt })
    .eq("id", params.consentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Verifica se um cliente possui consentimento ativo para uma finalidade específica (ex: 'ai_memory').
 * Condição de ativo: granted = true AND revoked_at IS NULL.
 */
export async function hasActiveConsentType(
  client: SupabaseClient<Database>,
  clientId: string,
  consentType: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("client_consents")
    .select("id")
    .eq("client_id", clientId)
    .eq("consent_type", consentType)
    .eq("granted", true)
    .is("revoked_at", null)
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.length ?? 0) > 0;
}
