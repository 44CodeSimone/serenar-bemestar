const OFFICIAL_SITE_URL = "https://serenarbemestar.life";

export const DEFAULT_SOCIAL_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/yHzyaPQ07sbGc5SzgYFWhTB3yvP2/social-images/social-1783179174591-Serenar.webp";

function resolveSiteUrl(): string {
  const configuredUrl = import.meta.env.VITE_SITE_URL?.trim();

  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);

      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.origin;
      }
    } catch {
      // Invalid configuration falls back to the official production domain.
    }
  }

  return OFFICIAL_SITE_URL;
}

export const SITE_URL = resolveSiteUrl();

export function absoluteSiteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

type SeoHeadOptions = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string | null;
};

export function createSeoHead({
  title,
  description,
  path,
  type = "website",
  image,
}: SeoHeadOptions) {
  const canonical = absoluteSiteUrl(path);
  const socialImage = image || DEFAULT_SOCIAL_IMAGE;

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: canonical },
      { property: "og:image", content: socialImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:url", content: canonical },
      { name: "twitter:image", content: socialImage },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}
