import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const IMAGE_BUCKET = "site-images";
export const MAX_IMAGE_MB = 5;
export const ACCEPTED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

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

export async function signedUrl(path: string, expiresInSeconds = 60 * 60 * 24 * 365) {
  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
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
  if (up.error) throw up.error;
  const url = await signedUrl(path);
  const ins = await supabase
    .from("site_images")
    .insert({
      storage_path: path,
      public_url: url,
      alt,
      tag,
      mime: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (ins.error) throw ins.error;
  return ins.data as SiteImage;
}

export async function deleteSiteImage(img: SiteImage) {
  await supabase.storage.from(IMAGE_BUCKET).remove([img.storage_path]);
  const { error } = await supabase.from("site_images").delete().eq("id", img.id);
  if (error) throw error;
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
