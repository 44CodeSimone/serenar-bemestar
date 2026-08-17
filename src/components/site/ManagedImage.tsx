import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { useManagedImage } from "@/lib/managed-images";
import { cn } from "@/lib/utils";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  slotKey: string;
  fallbackSrc: string;
  alt: string;
};

function ImagePlaceholder({
  className,
  style,
  width,
  height,
  state,
}: Pick<Props, "className" | "style" | "width" | "height"> & {
  state: "loading" | "error";
}) {
  return (
    <div
      aria-busy={state === "loading" ? "true" : undefined}
      data-managed-image-state={state}
      className={cn("bg-cream/60", state === "loading" && "animate-pulse", className)}
      style={{
        ...style,
        ...(width && height ? { aspectRatio: `${width}/${height}` } : {}),
      }}
    />
  );
}

/**
 * Renders a public-site image managed via the Admin CMS.
 * Keeps the imported fallback hidden while the CMS lookup is still pending,
 * then uses it only when the lookup confirms that the slot is not configured.
 * Uses lazy loading by default.
 */
export function ManagedImage({
  slotKey,
  fallbackSrc,
  alt,
  loading = "lazy",
  className,
  style,
  width,
  height,
  onError,
  ...rest
}: Props) {
  const { image, loading: isLoading, error } = useManagedImage(slotKey);
  const src = image?.public_url ?? fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  if (isLoading && !image) {
    return (
      <ImagePlaceholder
        className={className}
        style={style}
        width={width}
        height={height}
        state="loading"
      />
    );
  }

  if ((error && !image) || failedSrc === src) {
    return (
      <ImagePlaceholder
        className={className}
        style={style}
        width={width}
        height={height}
        state="error"
      />
    );
  }

  const finalAlt = image?.alt?.trim() || alt;
  return (
    <img
      src={src}
      alt={finalAlt}
      width={width}
      height={height}
      loading={loading}
      className={className}
      style={style}
      onError={(event) => {
        setFailedSrc(src);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
