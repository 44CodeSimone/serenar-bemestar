import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

/** Fetch the most recent CMS image for a given slot key. */
export async function fetchSlotImage(key: string): Promise<ManagedImageRecord | null> {
  const { data } = await supabase
    .from("site_images")
    .select("id, storage_path, public_url, alt, tag, caption, created_at")
    .eq("tag", key)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ManagedImageRecord | null) ?? null;
}

/**
 * Hook: returns the CMS image for a slot (or null while loading / when absent).
 * Public components should render the fallback until this resolves.
 */
export function useManagedImage(key: string) {
  const [image, setImage] = useState<ManagedImageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchSlotImage(key).then((img) => {
      if (!alive) return;
      setImage(img);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return { image, loading };
}
