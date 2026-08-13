import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as repo from "@/lib/clients.repository";
import type {
  ClientRecord,
  ListClientsParams,
  ListClientsResult,
  DuplicateCheckParams,
  DuplicateCheckResult,
} from "@/lib/clients.repository";

function normalizeDigits(val?: string | null): string | null {
  if (!val) return null;
  const digits = val.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function isValidCpf(cpfDigits: string): boolean {
  if (cpfDigits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfDigits)) return false;

  let sum = 0;
  let remainder = 0;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpfDigits.substring(i - 1, i), 10) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpfDigits.substring(9, 10), 10)) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpfDigits.substring(i - 1, i), 10) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpfDigits.substring(10, 11), 10)) return false;

  return true;
}

/**
 * Server Function: Listagem paginada de clientes com busca e filtros.
 */
export const listClientsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): ListClientsParams => {
    if (typeof input !== "object" || input === null) {
      return {};
    }
    const params = input as Record<string, unknown>;
    return {
      page: typeof params.page === "number" ? params.page : undefined,
      pageSize: typeof params.pageSize === "number" ? params.pageSize : undefined,
      search: typeof params.search === "string" ? params.search : undefined,
      status: typeof params.status === "string" ? params.status : undefined,
      includeArchived: typeof params.includeArchived === "boolean" ? params.includeArchived : undefined,
    };
  })
  .handler(async ({ context, data }): Promise<ListClientsResult> => {
    return repo.listClients(context.supabase, data);
  });

/**
 * Server Function: Busca de cliente individual por ID.
 */
export const getClientByIdFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { id: string } => {
    if (typeof input !== "object" || input === null || !("id" in input) || typeof (input as { id: unknown }).id !== "string") {
      throw new Error("ID do cliente é obrigatório.");
    }
    return { id: (input as { id: string }).id };
  })
  .handler(async ({ context, data }): Promise<ClientRecord | null> => {
    return repo.getClientById(context.supabase, data.id);
  });

/**
 * Server Function: Checagem prévia de duplicidades (CPF exato ou Nome + Data Nasc).
 */
export const checkClientDuplicatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): DuplicateCheckParams => {
    if (typeof input !== "object" || input === null) {
      return {};
    }
    const p = input as Record<string, unknown>;
    const rawCpf = typeof p.cpf === "string" ? p.cpf : null;
    return {
      cpf: normalizeDigits(rawCpf),
      fullName: typeof p.fullName === "string" ? p.fullName : undefined,
      birthDate: typeof p.birthDate === "string" ? p.birthDate : undefined,
      motherName: typeof p.motherName === "string" ? p.motherName : undefined,
      excludeId: typeof p.excludeId === "string" ? p.excludeId : undefined,
    };
  })
  .handler(async ({ context, data }): Promise<DuplicateCheckResult> => {
    return repo.findPotentialDuplicateClient(context.supabase, data);
  });

export interface CreateClientInput {
  full_name: string;
  birth_date: string;
  phone: string;
  cpf?: string | null;
  mother_name?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  profession?: string | null;
  source?: string;
  notes?: string | null;
}

/**
 * Server Function: Criação de novo cliente com validação e deduplicação de CPF.
 */
export const createClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): CreateClientInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Dados inválidos para cadastro de cliente.");
    }
    const i = input as Record<string, unknown>;

    const fullName = typeof i.full_name === "string" ? i.full_name.trim() : "";
    const birthDate = typeof i.birth_date === "string" ? i.birth_date.trim() : "";
    const phone = typeof i.phone === "string" ? i.phone.trim() : "";

    if (!fullName || fullName.length < 2) {
      throw new Error("Nome completo é obrigatório e deve conter ao menos 2 caracteres.");
    }
    if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      throw new Error("Data de nascimento válida é obrigatória (AAAA-MM-DD).");
    }
    if (!phone || normalizeDigits(phone)?.length! < 10) {
      throw new Error("Telefone válido com DDD é obrigatório.");
    }

    const rawCpf = typeof i.cpf === "string" ? i.cpf : null;
    const cleanCpf = normalizeDigits(rawCpf);

    if (cleanCpf && !isValidCpf(cleanCpf)) {
      throw new Error("CPF informado é inválido.");
    }

    return {
      full_name: fullName,
      birth_date: birthDate,
      phone: phone,
      cpf: cleanCpf,
      mother_name: typeof i.mother_name === "string" ? i.mother_name.trim() || null : null,
      whatsapp: typeof i.whatsapp === "string" ? i.whatsapp.trim() || null : null,
      email: typeof i.email === "string" ? i.email.trim() || null : null,
      city: typeof i.city === "string" ? i.city.trim() || null : null,
      profession: typeof i.profession === "string" ? i.profession.trim() || null : null,
      source: typeof i.source === "string" && i.source.trim() ? i.source.trim() : "admin",
      notes: typeof i.notes === "string" ? i.notes.trim() || null : null,
    };
  })
  .handler(async ({ context, data }): Promise<ClientRecord> => {
    if (data.cpf) {
      const existingCpf = await repo.findClientByCpf(context.supabase, data.cpf);
      if (existingCpf) {
        throw new Error(
          existingCpf.status === "archived"
            ? "Já existe um cliente arquivado com este CPF. Restaure a ficha em vez de recadastrar."
            : "Já existe um cliente ativo cadastrado com este CPF.",
        );
      }
    }

    return repo.createClient(context.supabase, {
      full_name: data.full_name,
      birth_date: data.birth_date,
      phone: data.phone,
      cpf: data.cpf,
      mother_name: data.mother_name,
      whatsapp: data.whatsapp,
      email: data.email,
      city: data.city,
      profession: data.profession,
      source: data.source || "admin",
      notes: data.notes,
      status: "registered",
    });
  });

export interface UpdateClientInput {
  id: string;
  full_name?: string;
  birth_date?: string;
  phone?: string;
  cpf?: string | null;
  mother_name?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  profession?: string | null;
  notes?: string | null;
}

/**
 * Server Function: Atualização de campos cadastrais permitidos.
 */
export const updateClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): UpdateClientInput => {
    if (typeof input !== "object" || input === null || !("id" in input) || typeof (input as { id: unknown }).id !== "string") {
      throw new Error("ID do cliente é obrigatório para atualização.");
    }
    const i = input as Record<string, unknown>;

    const payload: UpdateClientInput = { id: i.id as string };

    if (typeof i.full_name === "string") {
      const fn = i.full_name.trim();
      if (fn.length < 2) throw new Error("Nome completo inválido.");
      payload.full_name = fn;
    }
    if (typeof i.birth_date === "string") {
      const bd = i.birth_date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) throw new Error("Data de nascimento inválida.");
      payload.birth_date = bd;
    }
    if (typeof i.phone === "string") {
      const ph = i.phone.trim();
      if (normalizeDigits(ph)?.length! < 10) throw new Error("Telefone inválido.");
      payload.phone = ph;
    }
    if (i.cpf !== undefined) {
      const cleanCpf = normalizeDigits(typeof i.cpf === "string" ? i.cpf : null);
      if (cleanCpf && !isValidCpf(cleanCpf)) throw new Error("CPF informado é inválido.");
      payload.cpf = cleanCpf;
    }
    if (i.mother_name !== undefined) {
      payload.mother_name = typeof i.mother_name === "string" ? i.mother_name.trim() || null : null;
    }
    if (i.whatsapp !== undefined) {
      payload.whatsapp = typeof i.whatsapp === "string" ? i.whatsapp.trim() || null : null;
    }
    if (i.email !== undefined) {
      payload.email = typeof i.email === "string" ? i.email.trim() || null : null;
    }
    if (i.city !== undefined) {
      payload.city = typeof i.city === "string" ? i.city.trim() || null : null;
    }
    if (i.profession !== undefined) {
      payload.profession = typeof i.profession === "string" ? i.profession.trim() || null : null;
    }
    if (i.notes !== undefined) {
      payload.notes = typeof i.notes === "string" ? i.notes.trim() || null : null;
    }

    return payload;
  })
  .handler(async ({ context, data }): Promise<ClientRecord> => {
    if (data.cpf) {
      const existingCpf = await repo.findClientByCpf(context.supabase, data.cpf, data.id);
      if (existingCpf) {
        throw new Error("Já existe outro cliente cadastrado com este CPF.");
      }
    }

    const { id, ...updateFields } = data;
    return repo.updateClient(context.supabase, id, updateFields);
  });

/**
 * Server Function: Soft delete / Arquivamento de cliente.
 */
export const archiveClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { id: string } => {
    if (typeof input !== "object" || input === null || !("id" in input) || typeof (input as { id: unknown }).id !== "string") {
      throw new Error("ID do cliente é obrigatório para arquivamento.");
    }
    return { id: (input as { id: string }).id };
  })
  .handler(async ({ context, data }): Promise<ClientRecord> => {
    return repo.archiveClient(context.supabase, data.id);
  });

/**
 * Server Function: Restauração de cliente arquivado (status = 'registered', deleted_at = null).
 */
export const restoreClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { id: string } => {
    if (typeof input !== "object" || input === null || !("id" in input) || typeof (input as { id: unknown }).id !== "string") {
      throw new Error("ID do cliente é obrigatório para restauração.");
    }
    return { id: (input as { id: string }).id };
  })
  .handler(async ({ context, data }): Promise<ClientRecord> => {
    return repo.restoreClient(context.supabase, data.id);
  });
