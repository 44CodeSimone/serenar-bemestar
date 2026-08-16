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
  state: "loading" | "empty" | "error";
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
 * Renders a neutral placeholder while the CMS image is still unknown and
 * keeps a neutral space until a CMS image is available. Imported defaults are
 * intentionally not rendered so visitors never see a generic image first.
 * Uses lazy loading by default.
 */
export function ManagedImage({
  slotKey,
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
  const [configuredImageFailed, setConfiguredImageFailed] = useState(false);

  useEffect(() => {
    setConfiguredImageFailed(false);
  }, [image?.public_url]);

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

  if ((error && !image) || configuredImageFailed) {
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

  if (!image?.public_url) {
    return (
      <ImagePlaceholder
        className={className}
        style={style}
        width={width}
        height={height}
        state="empty"
      />
    );
  }

  const src = image.public_url;
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
        setConfiguredImageFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
