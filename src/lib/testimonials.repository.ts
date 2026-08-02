// src/lib/testimonials.repository.ts
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TestimonialRecord = Database["public"]["Tables"]["testimonials"]["Row"];

export type CreateTestimonialParams = Database["public"]["Tables"]["testimonials"]["Insert"];

export type UpdateTestimonialParams = Database["public"]["Tables"]["testimonials"]["Update"];

export async function listPublicTestimonials(limit = 6): Promise<TestimonialRecord[]> {
  const { data, error } = await supabase
    .from("testimonials")
    .select("id,name,text,rating,service,authorized,active,display_order,created_at,updated_at")
    .eq("active", true)
    .eq("authorized", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listAdminTestimonials(): Promise<TestimonialRecord[]> {
  const { data, error } = await supabase
    .from("testimonials")
    .select("id,name,text,rating,service,authorized,active,display_order,created_at,updated_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createTestimonial(
  params: CreateTestimonialParams,
): Promise<TestimonialRecord> {
  const { data, error } = await supabase.from("testimonials").insert(params).select().single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTestimonial(
  testimonialId: string,
  params: UpdateTestimonialParams,
): Promise<TestimonialRecord> {
  const { data, error } = await supabase
    .from("testimonials")
    .update(params)
    .eq("id", testimonialId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteTestimonial(testimonialId: string): Promise<void> {
  const { error } = await supabase
    .from("testimonials")
    .delete()
    .eq("id", testimonialId)
    .select("id")
    .single();

  if (error) {
    throw error;
  }
}
