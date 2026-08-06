import {
  getAdminSeoPages,
  getPublicSeoPage,
  restoreAdminSeoPage,
  saveAdminSeoPage,
} from "@/lib/seo.functions";
import type { SeoPageInput, SeoPageKey, SeoPageOverride } from "@/lib/seo";

export async function loadPublicSeoPage(page: SeoPageKey): Promise<SeoPageOverride | null> {
  try {
    return await getPublicSeoPage({ data: { page } });
  } catch {
    return null;
  }
}

export async function loadAdminSeoPages(): Promise<Partial<Record<SeoPageKey, SeoPageOverride>>> {
  return getAdminSeoPages();
}

export async function saveSeoPage(page: SeoPageKey, value: SeoPageInput): Promise<SeoPageInput> {
  const result = await saveAdminSeoPage({ data: { page, value } });
  return result.value;
}

export async function restoreSeoPage(page: SeoPageKey): Promise<void> {
  await restoreAdminSeoPage({ data: { page } });
}
