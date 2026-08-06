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

export const SEO_PAGE_KEYS = [
  "home",
  "sobre",
  "servicos",
  "faq",
  "contato",
  "politica-privacidade",
  "termos",
  "blog",
] as const;

export type SeoPageKey = (typeof SEO_PAGE_KEYS)[number];

export type SeoPageOverride = {
  title?: string;
  description?: string;
  socialImageUrl?: string | null;
};

export type SeoPageInput = {
  title: string;
  description: string;
  socialImageUrl: string | null;
};

export type SeoPageDefinition = SeoPageInput & {
  label: string;
  path: string;
};

export type SeoPageResolved = SeoPageDefinition & {
  isCustom: boolean;
};

export const SEO_PAGE_DEFAULTS: Record<SeoPageKey, SeoPageDefinition> = {
  home: {
    label: "Home",
    path: "/",
    title: "Serenar — Massoterapia & Bem-Estar em Urubici/SC",
    description:
      "Massoterapia boutique em Urubici, Santa Catarina. Massagens terapêuticas, relaxantes, drenagem linfática e rituais de autocuidado com Mariah Luz.",
    socialImageUrl: null,
  },
  sobre: {
    label: "Sobre",
    path: "/sobre",
    title: "Sobre a Serenar — Mariah Luz | Massoterapia em Urubici",
    description:
      "Conheça o espaço Serenar e a história de Mariah Luz, dedicada ao bem-estar, ao toque humano e à massoterapia como ato de cuidado em Urubici.",
    socialImageUrl: null,
  },
  servicos: {
    label: "Serviços",
    path: "/servicos",
    title: "Serviços — Massoterapia e rituais de bem-estar | Serenar",
    description:
      "Massagem relaxante, terapêutica, drenagem linfática, pedras quentes, spa dos pés e mais. Conheça os rituais do Serenar em Urubici/SC.",
    socialImageUrl: null,
  },
  faq: {
    label: "FAQ",
    path: "/faq",
    title: "Perguntas frequentes — Serenar Massoterapia",
    description:
      "Tire suas dúvidas sobre massagens, agendamentos, pagamentos e cuidados antes e depois das sessões no Serenar.",
    socialImageUrl: null,
  },
  contato: {
    label: "Contato",
    path: "/contato",
    title: "Contato — Serenar Massoterapia | Urubici/SC",
    description:
      "Fale com o Serenar por WhatsApp, Instagram ou email. Estamos em Urubici, Santa Catarina, prontas para receber você.",
    socialImageUrl: null,
  },
  "politica-privacidade": {
    label: "Política de Privacidade",
    path: "/politica-privacidade",
    title: "Política de Privacidade — Serenar",
    description: "Como o Serenar coleta, usa e protege seus dados pessoais conforme a LGPD.",
    socialImageUrl: null,
  },
  termos: {
    label: "Termos de Uso",
    path: "/termos",
    title: "Termos de Uso — Serenar",
    description: "Consulte os termos de uso do site Serenar Massoterapia e Bem-Estar.",
    socialImageUrl: null,
  },
  blog: {
    label: "Blog",
    path: "/blog",
    title: "Blog — Bem-estar e autocuidado | Serenar",
    description:
      "Artigos sobre massoterapia, autocuidado, respiração, sono e rotinas de bem-estar por Mariah Luz e o Serenar.",
    socialImageUrl: null,
  },
};

export function isSeoPageKey(value: unknown): value is SeoPageKey {
  return typeof value === "string" && SEO_PAGE_KEYS.includes(value as SeoPageKey);
}

export function resolveSeoPage(
  page: SeoPageKey,
  override?: SeoPageOverride | null,
): SeoPageResolved {
  const fallback = SEO_PAGE_DEFAULTS[page];

  return {
    ...fallback,
    title: override?.title || fallback.title,
    description: override?.description || fallback.description,
    socialImageUrl: override?.socialImageUrl || fallback.socialImageUrl,
    isCustom: Boolean(override),
  };
}

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
