import { createServerFn } from "@tanstack/react-start";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const GENERIC_SECURITY_ERROR =
  "Não foi possível validar o envio. Atualize a verificação de segurança e tente novamente.";

type ProtectedPrebookingInput = {
  calendarSlotId: string;
  fullName: string;
  phone: string;
  email?: string;
  serviceId: string;
  notes?: string;
  turnstileToken?: string;
  website?: string;
};

type TurnstileResponse = {
  success?: boolean;
};

function normalizeBrazilianPhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (!/^\d{10,11}$/.test(digits) || /^(\d)\1+$/.test(digits)) {
    throw new Error("Informe um telefone brasileiro válido com DDD.");
  }

  return `55${digits}`;
}

async function validateTurnstileToken(token: string, secret: string): Promise<void> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error("turnstile_unavailable");
    }

    const result = (await response.json()) as TurnstileResponse;

    if (result.success !== true) {
      throw new Error("turnstile_rejected");
    }
  } catch {
    throw new Error(GENERIC_SECURITY_ERROR);
  }
}

export const createProtectedPrebooking = createServerFn({ method: "POST" })
  .validator((input: ProtectedPrebookingInput) => input)
  .handler(async ({ data }) => {
    if (data.website?.trim()) {
      throw new Error(GENERIC_SECURITY_ERROR);
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret || !data.turnstileToken?.trim()) {
      throw new Error(GENERIC_SECURITY_ERROR);
    }

    await validateTurnstileToken(data.turnstileToken, secret);
    const phone = normalizeBrazilianPhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("create_prebooking", {
      p_calendar_slot_id: data.calendarSlotId,
      p_full_name: data.fullName,
      p_phone: phone,
      p_email: data.email || "",
      p_service_id: data.serviceId,
      p_notes: data.notes || "",
    });

    if (error) {
      if (error.message.includes("Horário indisponível")) {
        throw new Error("Horário indisponível.");
      }

      throw new Error("Não foi possível registrar o pedido. Tente novamente.");
    }

    return result;
  });
