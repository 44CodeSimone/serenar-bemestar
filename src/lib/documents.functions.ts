import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as docsRepo from "@/lib/documents.repository";
import type { ClientDocumentRow } from "@/lib/documents.repository";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

function base64ToBuffer(base64Data: string): Buffer {
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(cleanBase64, "base64");
}

function getFileExtension(filename: string, mimeType: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    return match[1].toLowerCase();
  }
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export interface UploadDocumentInput {
  clientId: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  fileBase64: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export interface SignedUrlResult {
  signedUrl: string;
  originalFilename: string;
  mimeType: string;
}

/**
 * Server Function: Lista os metadados de documentos de um cliente.
 */
export const listClientDocumentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: unknown): { clientId: string; includeArchived?: boolean } => {
      if (typeof input !== "object" || input === null) {
        throw new Error("Parâmetros de consulta inválidos.");
      }
      const params = input as Record<string, unknown>;
      const clientId = typeof params.clientId === "string" ? params.clientId.trim() : "";
      const includeArchived = Boolean(params.includeArchived);

      if (!isValidUuid(clientId)) {
        throw new Error("ID do cliente inválido.");
      }

      return { clientId, includeArchived };
    },
  )
  .handler(async ({ context, data }): Promise<ClientDocumentRow[]> => {
    try {
      return await docsRepo.listClientDocuments(
        context.supabase,
        data.clientId,
        data.includeArchived,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao buscar a lista de documentos do cliente.");
    }
  });

/**
 * Server Function: Realiza o upload de um documento privado para o Storage e registra metadados no repositório.
 */
export const uploadClientDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): UploadDocumentInput => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Payload de upload inválido.");
    }
    const params = input as Record<string, unknown>;

    const clientId = typeof params.clientId === "string" ? params.clientId.trim() : "";
    if (!isValidUuid(clientId)) {
      throw new Error("ID do cliente inválido.");
    }

    const documentType = typeof params.documentType === "string" ? params.documentType.trim() : "";
    if (!documentType) {
      throw new Error("Tipo de documento não informado.");
    }

    const originalFilename = typeof params.originalFilename === "string" ? params.originalFilename.trim() : "";
    if (!originalFilename) {
      throw new Error("Nome do arquivo original não informado.");
    }

    const mimeType = typeof params.mimeType === "string" ? params.mimeType.trim().toLowerCase() : "";
    if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
      throw new Error(
        `Tipo de arquivo não permitido (${mimeType}). Formatos aceitos: PDF, JPEG, PNG e WEBP.`,
      );
    }

    const fileSizeBytes = typeof params.fileSizeBytes === "number" ? params.fileSizeBytes : 0;
    if (fileSizeBytes <= 0) {
      throw new Error("Tamanho do arquivo inválido.");
    }
    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error("Tamanho do arquivo excede o limite máximo permitido de 10 MB.");
    }

    const fileBase64 = typeof params.fileBase64 === "string" ? params.fileBase64.trim() : "";
    if (!fileBase64) {
      throw new Error("Conteúdo do arquivo não fornecido.");
    }

    const relatedEntityType =
      typeof params.relatedEntityType === "string" && params.relatedEntityType.trim().length > 0
        ? params.relatedEntityType.trim()
        : null;

    const relatedEntityId =
      typeof params.relatedEntityId === "string" && isValidUuid(params.relatedEntityId)
        ? params.relatedEntityId.trim()
        : null;

    if (relatedEntityType && !relatedEntityId) {
      throw new Error("ID da entidade relacionada inválido.");
    }

    return {
      clientId,
      documentType,
      originalFilename,
      mimeType,
      fileSizeBytes,
      fileBase64,
      relatedEntityType,
      relatedEntityId,
    };
  })
  .handler(async ({ context, data }): Promise<ClientDocumentRow> => {
    try {
      const documentId = crypto.randomUUID();
      const ext = getFileExtension(data.originalFilename, data.mimeType);

      // Formato seguro do path no Storage privado: client_id/document_type/document_id.ext
      const storagePath = `${data.clientId}/${data.documentType}/${documentId}.${ext}`;
      const fileBuffer = base64ToBuffer(data.fileBase64);

      // Upload exclusivo para o bucket privado client-documents via SDK do Storage
      const { error: storageError } = await context.supabase.storage
        .from("client-documents")
        .upload(storagePath, fileBuffer, {
          contentType: data.mimeType,
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Falha ao salvar arquivo no Storage: ${storageError.message}`);
      }

      // Registro de metadados via Repositório (Zero acesso direto a tabelas na Server Function)
      return await docsRepo.createClientDocument(context.supabase, {
        id: documentId,
        client_id: data.clientId,
        document_type: data.documentType,
        storage_path: storagePath,
        original_filename: data.originalFilename,
        mime_type: data.mimeType,
        file_size: data.fileSizeBytes,
        related_entity_type: data.relatedEntityType ?? null,
        related_entity_id: data.relatedEntityId ?? null,
        uploaded_by: context.user.id,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao realizar o upload do documento do cliente.");
    }
  });

/**
 * Server Function: Gera uma URL assinada temporária (TTL 60min) para visualização/download de um documento privado.
 */
export const getSignedDocumentUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { documentId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Parâmetros inválidos.");
    }
    const params = input as Record<string, unknown>;
    const documentId = typeof params.documentId === "string" ? params.documentId.trim() : "";

    if (!isValidUuid(documentId)) {
      throw new Error("ID do documento inválido.");
    }

    return { documentId };
  })
  .handler(async ({ context, data }): Promise<SignedUrlResult> => {
    try {
      // 1. Busca metadados via repositório
      const doc = await docsRepo.getClientDocument(context.supabase, data.documentId);
      if (!doc) {
        throw new Error("Documento não encontrado.");
      }
      if (doc.archived_at) {
        throw new Error("Documento arquivado. Visualização não disponível.");
      }

      // 2. Gera a Signed URL com expiração de 60 minutos (3600 segundos)
      const { data: signedData, error: signedError } = await context.supabase.storage
        .from("client-documents")
        .createSignedUrl(doc.storage_path, 3600);

      if (signedError || !signedData?.signedUrl) {
        throw new Error(
          `Falha ao gerar URL temporária de visualização: ${signedError?.message || "Erro desconhecido"}`,
        );
      }

      return {
        signedUrl: signedData.signedUrl,
        originalFilename: doc.original_filename,
        mimeType: doc.mime_type,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao solicitar acesso ao documento.");
    }
  });

/**
 * Server Function: Realiza o arquivamento lógico de um documento do cliente.
 * Atualiza exclusivamente archived_at no repositório. Nunca exclui o arquivo ou registro.
 */
export const archiveClientDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown): { documentId: string } => {
    if (typeof input !== "object" || input === null) {
      throw new Error("Parâmetros inválidos.");
    }
    const params = input as Record<string, unknown>;
    const documentId = typeof params.documentId === "string" ? params.documentId.trim() : "";

    if (!isValidUuid(documentId)) {
      throw new Error("ID do documento inválido.");
    }

    return { documentId };
  })
  .handler(async ({ context, data }): Promise<ClientDocumentRow> => {
    try {
      const doc = await docsRepo.getClientDocument(context.supabase, data.documentId);
      if (!doc) {
        throw new Error("Documento não encontrado.");
      }

      return await docsRepo.archiveClientDocument(context.supabase, data.documentId);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error("Erro ao arquivar documento do cliente.");
    }
  });
