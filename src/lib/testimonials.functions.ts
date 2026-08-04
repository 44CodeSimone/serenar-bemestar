import { createServerFn } from "@tanstack/react-start";
import { verifyTurnstileToken } from "@/lib/turnstile.server";

const GENERIC_SUBMISSION_ERROR =
  "Não foi possível enviar seu depoimento. Revise os dados e tente novamente.";

type PublicTestimonialInput = {
  name: string;
  service?: string | null;
  text: string;
  rating: number;
  turnstileToken: string;
  website?: string;
};

function validatePublicTestimonialInput(input: unknown): PublicTestimonialInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(GENERIC_SUBMISSION_ERROR);
  }

  const { name, service, text, rating, turnstileToken, website } = Object.fromEntries(
    Object.entries(input),
  );

  if (
    typeof name !== "string" ||
    (service !== undefined && service !== null && typeof service !== "string") ||
    typeof text !== "string" ||
    typeof rating !== "number" ||
    typeof turnstileToken !== "string" ||
    !turnstileToken.trim() ||
    (website !== undefined && typeof website !== "string")
  ) {
    throw new Error(GENERIC_SUBMISSION_ERROR);
  }

  return {
    name,
    service: service ?? null,
    text,
    rating,
    turnstileToken,
    website,
  };
}

function normalizePublicTestimonial(input: PublicTestimonialInput) {
  const name = input.name.trim();
  const service = input.service?.trim() || null;
  const text = input.text.trim();
  const rating = Number(input.rating);

  if (
    name.length < 2 ||
    name.length > 100 ||
    (service !== null && service.length > 120) ||
    text.length < 10 ||
    text.length > 2000 ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    throw new Error(GENERIC_SUBMISSION_ERROR);
  }

  return { name, service, text, rating };
}

export const createPendingTestimonial = createServerFn({ method: "POST" })
  .validator(validatePublicTestimonialInput)
  .handler(async ({ data }) => {
    if (data.website?.trim()) {
      throw new Error(GENERIC_SUBMISSION_ERROR);
    }

    const testimonial = normalizePublicTestimonial(data);

    try {
      await verifyTurnstileToken({
        token: data.turnstileToken,
        expectedAction: "testimonial",
      });
    } catch {
      throw new Error(GENERIC_SUBMISSION_ERROR);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("testimonials").insert({
      ...testimonial,
      active: false,
      authorized: false,
      display_order: 0,
    });

    if (error) {
      throw new Error(GENERIC_SUBMISSION_ERROR);
    }

    return { ok: true as const };
  });
