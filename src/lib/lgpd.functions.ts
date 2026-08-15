import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as repo from "@/lib/consents.repository";
import type { ClientConsentRecord, CreateConsentParams } from "@/lib/consents.repository";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Server Function: Obtém todo o histórico de consentimentos de um cliente.
 */
export const getClientConsentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { clientId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Parâmetros de consulta inválidos.");
    }
    const params = input as Record<string, unknown>;
    const clientId = typeof params.clientId === "string" ? params.clientId.trim() : "";

    if (!isValidUuid(clientId)) {
      throw new Error("ID do cliente inválido.");
    }

    return { clientId };
  })
  .handler(async ({ context, data }): Promise<ClientConsentRecord[]> => {
    try {
      return await repo.getClientConsents(context.supabase, data.clientId);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao buscar histórico de consentimentos do cliente.");
    }
  });

/**
 * Server Function: Obtém apenas os consentimentos atualmente ativos de um cliente.
 */
export const getActiveConsentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { clientId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Parâmetros de consulta inválidos.");
    }
    const params = input as Record<string, unknown>;
    const clientId = typeof params.clientId === "string" ? params.clientId.trim() : "";

    if (!isValidUuid(clientId)) {
      throw new Error("ID do cliente inválido.");
    }

    return { clientId };
  })
  .handler(async ({ context, data }): Promise<ClientConsentRecord[]> => {
    try {
      return await repo.getActiveConsents(context.supabase, data.clientId);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao buscar consentimentos ativos do cliente.");
    }
  });

export interface GrantClientConsentInput {
  client_id: string;
  consent_type: string;
  granted: boolean;
  legal_basis: string;
  term_version: string;
  collection_channel: string;
  guardian_id?: string | null;
  term_hash?: string | null;
  evidence_document_id?: string | null;
  expires_at?: string | null;
}

/**
 * Server Function: Registra um novo consentimento LGPD para o cliente.
 */
export const grantClientConsentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): GrantClientConsentInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Dados de consentimento inválidos.");
    }
    const i = input as Record<string, unknown>;

    const clientId = typeof i.client_id === "string" ? i.client_id.trim() : "";
    if (!isValidUuid(clientId)) {
      throw new Error("ID do cliente é obrigatório e deve ser um UUID válido.");
    }

    const consentType = typeof i.consent_type === "string" ? i.consent_type.trim() : "";
    if (!consentType) {
      throw new Error("Tipo de consentimento é obrigatório.");
    }

    if (typeof i.granted !== "boolean") {
      throw new Error("Indicador de concessão (granted) deve ser verdadeiro ou falso.");
    }

    const legalBasis = typeof i.legal_basis === "string" ? i.legal_basis.trim() : "";
    if (!legalBasis) {
      throw new Error("Base legal é obrigatória.");
    }

    const termVersion = typeof i.term_version === "string" ? i.term_version.trim() : "";
    if (!termVersion) {
      throw new Error("Versão do termo é obrigatória.");
    }

    const collectionChannel =
      typeof i.collection_channel === "string" ? i.collection_channel.trim() : "";
    if (!collectionChannel) {
      throw new Error("Canal de coleta é obrigatório.");
    }

    const guardianId =
      typeof i.guardian_id === "string" && i.guardian_id.trim() ? i.guardian_id.trim() : null;
    if (guardianId && !isValidUuid(guardianId)) {
      throw new Error("ID do responsável legal deve ser um UUID válido.");
    }

    const evidenceDocId =
      typeof i.evidence_document_id === "string" && i.evidence_document_id.trim()
        ? i.evidence_document_id.trim()
        : null;
    if (evidenceDocId && !isValidUuid(evidenceDocId)) {
      throw new Error("ID do documento de evidência deve ser um UUID válido.");
    }

    return {
      client_id: clientId,
      consent_type: consentType,
      granted: i.granted,
      legal_basis: legalBasis,
      term_version: termVersion,
      collection_channel: collectionChannel,
      guardian_id: guardianId,
      term_hash: typeof i.term_hash === "string" ? i.term_hash.trim() || null : null,
      evidence_document_id: evidenceDocId,
      expires_at: typeof i.expires_at === "string" ? i.expires_at.trim() || null : null,
    };
  })
  .handler(async ({ context, data }): Promise<ClientConsentRecord> => {
    try {
      const createParams: CreateConsentParams = {
        client_id: data.client_id,
        consent_type: data.consent_type,
        granted: data.granted,
        legal_basis: data.legal_basis,
        term_version: data.term_version,
        collection_channel: data.collection_channel,
        guardian_id: data.guardian_id,
        term_hash: data.term_hash,
        evidence_document_id: data.evidence_document_id,
        expires_at: data.expires_at,
        recorded_by: context.user?.id ?? null,
      };

      return await repo.grantClientConsent(context.supabase, createParams);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao registrar consentimento do cliente.");
    }
  });

export interface RevokeClientConsentInput {
  consentId: string;
  revokedAt?: string | null;
}

/**
 * Server Function: Revoga um consentimento LGPD preenchendo revoked_at.
 */
export const revokeClientConsentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): RevokeClientConsentInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Dados de revogação inválidos.");
    }
    const i = input as Record<string, unknown>;

    const consentId = typeof i.consentId === "string" ? i.consentId.trim() : "";
    if (!isValidUuid(consentId)) {
      throw new Error("ID do consentimento é obrigatório e deve ser um UUID válido.");
    }

    const revokedAt =
      typeof i.revokedAt === "string" && i.revokedAt.trim() ? i.revokedAt.trim() : null;

    return {
      consentId,
      revokedAt,
    };
  })
  .handler(async ({ context, data }): Promise<ClientConsentRecord> => {
    try {
      return await repo.revokeClientConsent(context.supabase, {
        consentId: data.consentId,
        revokedAt: data.revokedAt || undefined,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao revogar consentimento do cliente.");
    }
  });
