import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PublicService = Database["public"]["Tables"]["services"]["Row"];

export async function listPublicServices(): Promise<PublicService[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export function serviceBenefitsToArray(benefits: PublicService["benefits"]): string[] {
  if (!Array.isArray(benefits)) {
    return [];
  }

  return benefits.filter((benefit): benefit is string => typeof benefit === "string");
}

export async function listFeaturedPublicServices(limit = 6): Promise<PublicService[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .eq("featured", true)
    .order("display_order", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
