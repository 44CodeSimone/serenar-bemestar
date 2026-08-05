import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SIGNED_IMAGE_CACHE_TTL_MS, signedUrl } from "@/lib/cms";

/**
 * Registry of image "slots" used across the public site.
 * Each slot has a stable key (stored as `tag` in `site_images`) and a
 * human-friendly label shown in the admin CMS.
 *
 * When a slot has an image uploaded via CMS, the public page renders it.
 * Otherwise the page keeps its imported default asset as fallback.
 */
export type ImageSlot = {
  key: string;
  label: string;
  description?: string;
  defaultAlt: string;
};

export const IMAGE_SLOTS: ImageSlot[] = [
  {
    key: "home.hero",
    label: "Home — Hero principal",
    description: "Imagem grande do topo da página inicial.",
    defaultAlt: "Ritual de bem-estar preparado com óleos e ervas naturais",
  },
  {
    key: "home.sobre",
    label: "Home — Seção sobre",
    description: "Foto do ambiente exibida no bloco 'Sobre'.",
    defaultAlt: "Ambiente do espaço Serenar",
  },
  {
    key: "home.cta",
    label: "Home — Fundo do CTA",
    description: "Imagem sutil ao fundo do bloco de agendamento.",
    defaultAlt: "",
  },
  {
    key: "sobre.terapeuta",
    label: "Sobre — Foto da terapeuta",
    description: "Foto principal de Mariah Luz.",
    defaultAlt: "Mariah Luz, massoterapeuta",
  },
  {
    key: "sobre.ambiente",
    label: "Sobre — Ambiente",
    description: "Foto do ambiente na página Sobre.",
    defaultAlt: "Ambiente da sala de atendimento",
  },
  {
    key: "sobre.ritual",
    label: "Sobre — Ritual",
    description: "Foto de detalhe (flatlay) na página Sobre.",
    defaultAlt: "",
  },
];

export type ManagedImageRecord = {
  id: string;
  storage_path: string;
  public_url: string;
  alt: string | null;
  tag: string;
  caption?: string | null;
  created_at: string;
};

type CachedImage = {
  record: ManagedImageRecord | null;
  refreshAt: number;
};

const imageCache = new Map<string, CachedImage>();
const pendingRequests = new Map<string, Promise<ManagedImageRecord | null>>();

export function setManagedImageCache(key: string, record: ManagedImageRecord | null): void {
  imageCache.set(key, { record, refreshAt: Date.now() + SIGNED_IMAGE_CACHE_TTL_MS });
}

export function clearManagedImageCache(): void {
  imageCache.clear();
}

function getCachedImage(key: string): CachedImage | null {
  const cached = imageCache.get(key);
  if (!cached) return null;
  if (cached.refreshAt <= Date.now()) {
    imageCache.delete(key);
    return null;
  }
  return cached;
}

/** Fetch the most recent CMS image for a given slot key. */
export async function fetchSlotImage(key: string): Promise<ManagedImageRecord | null> {
  const cached = getCachedImage(key);
  if (cached) return cached.record;

  const existingPromise = pendingRequests.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from("site_images")
        .select("id, storage_path, public_url, alt, tag, caption, created_at")
        .eq("tag", key)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const record = data
        ? ({
            ...data,
            public_url: await signedUrl(data.storage_path),
          } as ManagedImageRecord)
        : null;
      setManagedImageCache(key, record);
      return record;
    } catch (err) {
      console.error(`Failed to fetch slot image for key: ${key}`, err);
      return null;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Hook: returns the CMS image for a slot (or null while loading / when absent).
 * Public components should render the fallback until this resolves.
 */
export function useManagedImage(key: string) {
  const initialCache = getCachedImage(key);
  const [image, setImage] = useState<ManagedImageRecord | null>(initialCache?.record ?? null);
  const [loading, setLoading] = useState(() => !initialCache);

  useEffect(() => {
    let alive = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadImage() {
      const cached = getCachedImage(key);
      if (!cached) setLoading(true);
      const img = await fetchSlotImage(key);
      if (!alive) return;
      setImage(img);
      setLoading(false);

      const refreshed = getCachedImage(key);
      if (refreshed) {
        const delay = Math.max(0, refreshed.refreshAt - Date.now());
        refreshTimer = setTimeout(() => {
          imageCache.delete(key);
          void loadImage();
        }, delay);
      }
    }

    void loadImage();

    return () => {
      alive = false;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [key]);

  return { image, loading };
}
