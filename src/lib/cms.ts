import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const IMAGE_BUCKET = "site-images";
export const MAX_IMAGE_MB = 5;
export const ACCEPTED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
export const SIGNED_IMAGE_URL_TTL_SECONDS = 60 * 60;
export const SIGNED_IMAGE_CACHE_TTL_MS = 50 * 60 * 1000;

export type SiteImage = {
  id: string;
  storage_path: string;
  public_url: string;
  alt: string;
  tag: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

export async function signedUrl(
  path: string,
  expiresInSeconds = SIGNED_IMAGE_URL_TTL_SECONDS,
): Promise<string> {
  if (!path.trim()) throw new Error("Caminho da imagem inválido.");

  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error("Não foi possível autorizar o acesso à imagem.");
  }
  return data.signedUrl;
}

async function rollbackUploadedImage(path: string): Promise<void> {
  const rollback = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  if (rollback.error) {
    throw new Error("Falha ao concluir o upload e limpar o arquivo enviado.");
  }
}

export class StorageCleanupPendingError extends Error {
  constructor(public readonly storagePath: string) {
    super("O registro foi removido, mas a limpeza do arquivo no Storage ficou pendente.");
    this.name = "StorageCleanupPendingError";
  }
}

export async function uploadSiteImage(file: File, alt: string, tag: string): Promise<SiteImage> {
  if (!ACCEPTED_IMAGE_MIMES.includes(file.type)) {
    throw new Error("Formato não aceito. Use JPG, PNG ou WEBP.");
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`A imagem deve ter até ${MAX_IMAGE_MB} MB.`);
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${tag}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (up.error) throw new Error("Não foi possível enviar a imagem.");

  try {
    const url = await signedUrl(path);
    const ins = await supabase
      .from("site_images")
      .insert({
        storage_path: path,
        // Compatibility field: storage_path is the permanent source of truth.
        // Temporary signed URLs are generated only when the image is read.
        public_url: "",
        alt,
        tag,
        mime: file.type,
        size_bytes: file.size,
      })
      .select()
      .single();
    if (ins.error) throw ins.error;
    return { ...(ins.data as SiteImage), public_url: url };
  } catch {
    await rollbackUploadedImage(path);
    throw new Error("Não foi possível concluir o upload da imagem.");
  }
}

export async function deleteSiteImage(img: Pick<SiteImage, "id" | "storage_path">): Promise<void> {
  const databaseResult = await supabase
    .from("site_images")
    .delete()
    .eq("id", img.id)
    .select("id")
    .single();
  if (databaseResult.error || databaseResult.data?.id !== img.id) {
    throw new Error("Não foi possível excluir o registro da imagem.");
  }

  const storageResult = await supabase.storage.from(IMAGE_BUCKET).remove([img.storage_path]);
  if (storageResult.error) {
    throw new StorageCleanupPendingError(img.storage_path);
  }
}

/** Hook para ler uma chave de site_settings publicamente. */
export function useSiteSetting<T = Record<string, unknown>>(key: string) {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setValue((data?.value as T) ?? null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return { value, loading };
}
