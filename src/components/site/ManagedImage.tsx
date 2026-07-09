import { type ImgHTMLAttributes } from "react";
import { useManagedImage } from "@/lib/managed-images";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  slotKey: string;
  fallbackSrc: string;
  alt: string;
};

/**
 * Renders a public-site image managed via the Admin CMS.
 * Falls back to the imported default asset when no CMS image is set.
 * Uses lazy loading by default.
 */
export function ManagedImage({ slotKey, fallbackSrc, alt, loading = "lazy", ...rest }: Props) {
  const { image } = useManagedImage(slotKey);
  const src = image?.public_url ?? fallbackSrc;
  const finalAlt = image?.alt?.trim() || alt;
  return <img src={src} alt={finalAlt} loading={loading} {...rest} />;
}
