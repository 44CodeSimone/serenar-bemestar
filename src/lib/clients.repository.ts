import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sameBrazilianPhone } from "@/lib/phone";

export type ClientRecord = Database["public"]["Tables"]["clients"]["Row"];
export type CreateClientParams = Database["public"]["Tables"]["clients"]["Insert"];
export type UpdateClientParams = Database["public"]["Tables"]["clients"]["Update"];

export interface ListClientsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  includeArchived?: boolean;
}

export interface ListClientsResult {
  data: ClientRecord[];
  count: number;
  page: number;
  pageSize: number;
}

export interface DuplicateCheckParams {
  cpf?: string | null;
  fullName?: string;
  birthDate?: string;
  motherName?: string | null;
  excludeId?: string;
}

export interface DuplicateCheckResult {
  hasExactCpfMatch: boolean;
  cpfMatchClient?: ClientRecord | null;
  hasSuspectedMatch: boolean;
  suspectedClients: ClientRecord[];
}

/**
 * Consulta paginada de clientes com busca e filtro por status.
 */
export async function listClients(
  client: SupabaseClient<Database>,
  params: ListClientsParams,
): Promise<ListClientsResult> {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client.from("clients").select("*", { count: "exact" });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  } else if (!params.includeArchived) {
    query = query.neq("status", "archived");
  }

  if (params.search?.trim()) {
    const cleanSearch = params.search.trim().replace(/[,()\\'"]/g, "");
    if (cleanSearch) {
      query = query.or(
        `full_name.ilike.%${cleanSearch}%,cpf.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%`,
      );
    }
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    data: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Busca cliente por ID primário (UUID).
 */
export async function getClientById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<ClientRecord | null> {
  const { data, error } = await client.from("clients").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Busca cliente por CPF normalizado (11 dígitos).
 */
export async function findClientByCpf(
  client: SupabaseClient<Database>,
  cpf: string,
  excludeId?: string,
): Promise<ClientRecord | null> {
  let query = client.from("clients").select("*").eq("cpf", cpf);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Busca cliente por e-mail (case-insensitive).
 */
export async function findClientByEmail(
  client: SupabaseClient<Database>,
  email: string,
  excludeId?: string,
): Promise<ClientRecord | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const escapedEmailPattern = cleanEmail.replace(/[\\%_]/g, "\\$&");

  let query = client
    .from("clients")
    .select("*")
    .ilike("email", escapedEmailPattern)
    .neq("status", "archived");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Busca cliente por número de telefone ou WhatsApp usando a normalização segura de telefones brasileiros.
 */
export async function findClientByPhone(
  client: SupabaseClient<Database>,
  phone: string,
  excludeId?: string,
): Promise<ClientRecord | null> {
  if (!phone || !phone.trim()) return null;

  let query = client.from("clients").select("*").neq("status", "archived");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data: candidates, error } = await query;

  if (error) {
    throw error;
  }

  if (!candidates || candidates.length === 0) return null;

  const match = candidates.find(
    (candidate) =>
      sameBrazilianPhone(candidate.phone, phone) || sameBrazilianPhone(candidate.whatsapp, phone),
  );

  return match ?? null;
}

/**
 * Consulta de duplicidades potenciais por CPF exato ou por Nome + Data de Nascimento.
 */
export async function findPotentialDuplicateClient(
  client: SupabaseClient<Database>,
  params: DuplicateCheckParams,
): Promise<DuplicateCheckResult> {
  if (params.cpf?.trim()) {
    const cpfMatch = await findClientByCpf(client, params.cpf.trim(), params.excludeId);
    if (cpfMatch) {
      return {
        hasExactCpfMatch: true,
        cpfMatchClient: cpfMatch,
        hasSuspectedMatch: false,
        suspectedClients: [],
      };
    }
  }

  if (params.fullName?.trim() && params.birthDate?.trim()) {
    let query = client
      .from("clients")
      .select("*")
      .ilike("full_name", params.fullName.trim())
      .eq("birth_date", params.birthDate.trim());

    if (params.excludeId) {
      query = query.neq("id", params.excludeId);
    }

    const { data: suspectedMatches, error } = await query.limit(5);

    if (error) {
      throw error;
    }

    const matches = suspectedMatches ?? [];
    return {
      hasExactCpfMatch: false,
      cpfMatchClient: null,
      hasSuspectedMatch: matches.length > 0,
      suspectedClients: matches,
    };
  }

  return {
    hasExactCpfMatch: false,
    cpfMatchClient: null,
    hasSuspectedMatch: false,
    suspectedClients: [],
  };
}

/**
 * Cria um novo registro de cliente.
 */
export async function createClient(
  client: SupabaseClient<Database>,
  params: CreateClientParams,
): Promise<ClientRecord> {
  const { data, error } = await client.from("clients").insert(params).select().single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Atualiza campos cadastrais de um cliente existente.
 */
export async function updateClient(
  client: SupabaseClient<Database>,
  id: string,
  params: UpdateClientParams,
): Promise<ClientRecord> {
  const { data, error } = await client
    .from("clients")
    .update(params)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Executa soft-delete de cliente (status = 'archived', deleted_at = now()).
 */
export async function archiveClient(
  client: SupabaseClient<Database>,
  id: string,
): Promise<ClientRecord> {
  const now = new Date().toISOString();
  return updateClient(client, id, {
    status: "archived",
    deleted_at: now,
  });
}

/**
 * Restaura um cliente arquivado.
 * Regra congelada da Sprint 002: status = 'registered', deleted_at = null.
 */
export async function restoreClient(
  client: SupabaseClient<Database>,
  id: string,
): Promise<ClientRecord> {
  return updateClient(client, id, {
    status: "registered",
    deleted_at: null,
  });
}
