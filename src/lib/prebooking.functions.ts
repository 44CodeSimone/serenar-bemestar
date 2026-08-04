import { createServerFn } from "@tanstack/react-start";
import { verifyTurnstileToken } from "@/lib/turnstile.server";

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

export const createProtectedPrebooking = createServerFn({ method: "POST" })
  .validator((input: ProtectedPrebookingInput) => input)
  .handler(async ({ data }) => {
    if (data.website?.trim()) {
      throw new Error(GENERIC_SECURITY_ERROR);
    }

    try {
      await verifyTurnstileToken({ token: data.turnstileToken ?? "" });
    } catch {
      throw new Error(GENERIC_SECURITY_ERROR);
    }
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
