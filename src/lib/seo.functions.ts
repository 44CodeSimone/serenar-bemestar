import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  SEO_PAGE_KEYS,
  isSeoPageKey,
  type SeoPageInput,
  type SeoPageKey,
  type SeoPageOverride,
} from "@/lib/seo";

const SEO_SETTING_KEY = "seo_pages";
const GENERIC_SEO_ERROR = "Não foi possível atualizar o SEO. Tente novamente.";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePageInput(input: unknown): { page: SeoPageKey } {
  if (!isRecord(input) || !isSeoPageKey(input.page)) {
    throw new Error(GENERIC_SEO_ERROR);
  }

  return { page: input.page };
}

function normalizeSocialImageUrl(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 500) throw new Error(GENERIC_SEO_ERROR);

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" || url.pathname.includes("/storage/v1/object/sign/")) {
      throw new Error(GENERIC_SEO_ERROR);
    }
    return url.toString();
  } catch {
    throw new Error(GENERIC_SEO_ERROR);
  }
}

function validateSaveInput(input: unknown): { page: SeoPageKey; value: SeoPageInput } {
  if (!isRecord(input) || !isSeoPageKey(input.page) || !isRecord(input.value)) {
    throw new Error(GENERIC_SEO_ERROR);
  }

  const { title, description, socialImageUrl } = input.value;
  if (
    typeof title !== "string" ||
    typeof description !== "string" ||
    (socialImageUrl !== undefined && socialImageUrl !== null && typeof socialImageUrl !== "string")
  ) {
    throw new Error(GENERIC_SEO_ERROR);
  }

  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();
  if (
    normalizedTitle.length < 10 ||
    normalizedTitle.length > 70 ||
    normalizedDescription.length < 30 ||
    normalizedDescription.length > 180
  ) {
    throw new Error(GENERIC_SEO_ERROR);
  }

  return {
    page: input.page,
    value: {
      title: normalizedTitle,
      description: normalizedDescription,
      socialImageUrl: normalizeSocialImageUrl(socialImageUrl ?? ""),
    },
  };
}

function parseStoredOverride(value: unknown): SeoPageOverride | null {
  if (!isRecord(value)) return null;

  const result: SeoPageOverride = {};
  if (typeof value.title === "string") {
    const title = value.title.trim();
    if (title.length >= 10 && title.length <= 70) result.title = title;
  }
  if (typeof value.description === "string") {
    const description = value.description.trim();
    if (description.length >= 30 && description.length <= 180) result.description = description;
  }
  if (typeof value.socialImageUrl === "string") {
    try {
      result.socialImageUrl = normalizeSocialImageUrl(value.socialImageUrl);
    } catch {
      // Invalid persisted URLs are ignored so public pages keep their safe fallback.
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function parseStoredPages(value: unknown): Partial<Record<SeoPageKey, SeoPageOverride>> {
  if (!isRecord(value) || !isRecord(value.pages)) return {};

  const pages: Partial<Record<SeoPageKey, SeoPageOverride>> = {};
  for (const page of SEO_PAGE_KEYS) {
    const parsed = parseStoredOverride(value.pages[page]);
    if (parsed) pages[page] = parsed;
  }
  return pages;
}

async function requireAdmin(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (error || !data) throw new Error(GENERIC_SEO_ERROR);
}

export const getPublicSeoPage = createServerFn({ method: "GET" })
  .validator(validatePageInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", SEO_SETTING_KEY)
      .eq("is_public", true)
      .maybeSingle();

    if (result.error || !result.data) return null;
    return parseStoredPages(result.data.value)[data.page] ?? null;
  });

export const getAdminSeoPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", SEO_SETTING_KEY)
      .maybeSingle();

    if (result.error) throw new Error(GENERIC_SEO_ERROR);
    return parseStoredPages(result.data?.value);
  });

export const saveAdminSeoPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateSaveInput)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const current = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", SEO_SETTING_KEY)
      .maybeSingle();
    if (current.error) throw new Error(GENERIC_SEO_ERROR);

    const currentValue = isRecord(current.data?.value) ? current.data.value : {};
    const currentPages = isRecord(currentValue.pages) ? currentValue.pages : {};
    const nextValue = {
      ...currentValue,
      pages: {
        ...currentPages,
        [data.page]: data.value,
      },
    };

    const saved = await supabaseAdmin
      .from("site_settings")
      .upsert(
        {
          key: SEO_SETTING_KEY,
          value: nextValue as Json,
          is_public: true,
          updated_by: context.userId,
        },
        { onConflict: "key" },
      )
      .select("key")
      .single();
    if (saved.error || saved.data?.key !== SEO_SETTING_KEY) {
      throw new Error(GENERIC_SEO_ERROR);
    }

    return { ok: true as const, value: data.value };
  });

export const restoreAdminSeoPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validatePageInput)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const current = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", SEO_SETTING_KEY)
      .maybeSingle();
    if (current.error) throw new Error(GENERIC_SEO_ERROR);
    if (!current.data) return { ok: true as const };

    const currentValue = isRecord(current.data.value) ? current.data.value : {};
    const currentPages = isRecord(currentValue.pages) ? { ...currentValue.pages } : {};
    delete currentPages[data.page];

    const saved = await supabaseAdmin
      .from("site_settings")
      .update({
        value: { ...currentValue, pages: currentPages } as Json,
        updated_by: context.userId,
      })
      .eq("key", SEO_SETTING_KEY)
      .select("key")
      .single();
    if (saved.error || saved.data?.key !== SEO_SETTING_KEY) {
      throw new Error(GENERIC_SEO_ERROR);
    }

    return { ok: true as const };
  });
