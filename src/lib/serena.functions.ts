import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SERVICES } from "./services";
import * as consentsRepo from "./consents.repository";

const SITE_KNOWLEDGE = {
  name: "Serenar",
  tagline: "Massoterapia & Bem-Estar",
  therapist: "Mariah Luz",
  city: "Urubici / SC",

  instagram: "@serenar_massoterapiaebemestar",
  hours: "Segunda a Sexta 9h às 20h, Sábados 9h às 16h.",
} as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

function buildSystemPrompt(userContext?: string) {
  const serviceList = SERVICES.map(
    (s) =>
      `• ${s.name} (${s.duration}) — ${s.short} Benefícios: ${s.benefits.join("; ")}. Contraindicações: ${s.contraindications}`,
  ).join("\n");

  return `Você é a Serenar, recepcionista virtual do espaço ${SITE_KNOWLEDGE.name} — ${SITE_KNOWLEDGE.tagline}.

TOM: você é humana em espírito — acolhedora, elegante, calma, empática, profissional. Nunca robótica. Nunca respostas em listas numeradas a menos que solicitado. Conversa fluida, breve, respiração de spa. Trate a pessoa pelo nome quando souber. Escreva em português brasileiro, natural e caloroso.

O QUE VOCÊ SABE:
- Terapeuta: ${SITE_KNOWLEDGE.therapist}. Local: ${SITE_KNOWLEDGE.city}.
- Horários: ${SITE_KNOWLEDGE.hours}
- Contato: Instagram ${SITE_KNOWLEDGE.instagram}

SERVIÇOS OFERECIDOS:
${serviceList}

REGRAS IMPORTANTES:
1. Nunca faça diagnóstico médico nem prescreva tratamentos. Ao menor sinal de dúvida clínica, sugira gentilmente procurar um profissional de saúde.
2. Se a pessoa pedir para falar com alguém, marcar horário específico ou tratar algo sensível, redirecione gentilmente para o WhatsApp da Mariah. Termine sua resposta com a marcação exata [REDIRECIONAR_WHATSAPP].
3. Se for perguntada sobre preços exatos, diga que os valores são passados no atendimento (WhatsApp) para melhor personalização.
4. Respostas curtas (2 a 5 frases). Sem markdown pesado. Sem emojis excessivos — no máximo um sutil por resposta se combinar.
5. Nunca invente serviços que não estão na lista.
6. Se a pessoa mencionar contraindicações, seja delicada e sugira falar com a Mariah antes.
${userContext ? `\nCONTEXTO DA PESSOA COM VOCÊ: ${userContext}` : ""}`;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 32;
const MAX_MESSAGE_CHARS = 2000;
const MAX_USER_CONTEXT_CHARS = 500;

/** Remove sequences that could break out of / hijack the system prompt. */
function sanitizeForPrompt(input: string, maxLen: number): string {
  return (
    input
      // strip control chars (except common whitespace)
      // eslint-disable-next-line no-control-regex -- Intentional prompt-sanitization range.
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
      // neutralize role/system markers that LLMs treat as delimiters
      .replace(/\b(system|assistant|user)\s*:/gi, "")
      .replace(/<\|[^|>]{0,40}\|>/g, "")
      .replace(/\[REDIRECIONAR_WHATSAPP\]/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLen)
  );
}

/**
 * Sanitiza o contexto do cliente utilizando uma abordagem de STRICT WHITELIST (Allow-List).
 * Rejeita por padrão (Deny All) qualquer propriedade não listada.
 * Constrói e retorna uma nova string contendo APENAS as propriedades explicitamente autorizadas:
 * - firstName
 * - preferredTreatmentStyle
 * - preferredAroma
 * - communicationPreference
 */
function sanitizePersonalizedContext(input?: unknown): string | undefined {
  if (!input) return undefined;

  let parsed: Record<string, unknown> | null = null;

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const obj = JSON.parse(trimmed);
        if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
          parsed = obj as Record<string, unknown>;
        }
      } catch {
        parsed = null;
      }
    }
  } else if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    parsed = input as Record<string, unknown>;
  }

  if (!parsed) {
    return undefined;
  }

  const parts: string[] = [];

  if (typeof parsed.firstName === "string" && parsed.firstName.trim().length > 0) {
    const clean = sanitizeForPrompt(parsed.firstName, 100);
    if (clean) {
      parts.push(`Nome: ${clean}`);
    }
  }

  if (typeof parsed.preferredTreatmentStyle === "string" && parsed.preferredTreatmentStyle.trim().length > 0) {
    const clean = sanitizeForPrompt(parsed.preferredTreatmentStyle, 100);
    if (clean) {
      parts.push(`Estilo de Atendimento: ${clean}`);
    }
  }

  if (typeof parsed.preferredAroma === "string" && parsed.preferredAroma.trim().length > 0) {
    const clean = sanitizeForPrompt(parsed.preferredAroma, 100);
    if (clean) {
      parts.push(`Aroma Preferido: ${clean}`);
    }
  }

  if (typeof parsed.communicationPreference === "string" && parsed.communicationPreference.trim().length > 0) {
    const clean = sanitizeForPrompt(parsed.communicationPreference, 100);
    if (clean) {
      parts.push(`Preferência de Comunicação: ${clean}`);
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("; ");
}

export const serenaChat = createServerFn({ method: "POST" })
  .validator(
    (data: { messages: ChatMessage[]; userContext?: string; clientId?: string }) => {
      if (!data || typeof data !== "object") throw new Error("payload inválido");
      if (!Array.isArray(data.messages)) throw new Error("messages obrigatório");
      if (data.messages.length === 0) throw new Error("messages vazio");
      if (data.messages.length > MAX_MESSAGES) throw new Error("muitas mensagens");

      const cleanMessages: ChatMessage[] = data.messages.map((m) => {
        if (!m || (m.role !== "user" && m.role !== "assistant")) {
          throw new Error("role inválido");
        }
        if (typeof m.content !== "string") throw new Error("content inválido");
        return {
          role: m.role,
          content: sanitizeForPrompt(m.content, MAX_MESSAGE_CHARS),
        };
      });

      const userContext =
        typeof data.userContext === "string" && data.userContext.length > 0
          ? sanitizeForPrompt(data.userContext, MAX_USER_CONTEXT_CHARS)
          : undefined;

      const clientId =
        typeof data.clientId === "string" && isValidUuid(data.clientId)
          ? data.clientId.trim()
          : undefined;

      return { messages: cleanMessages, userContext, clientId };
    },
  )
  .handler(async ({ context, data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    let effectiveUserContext: string | undefined = undefined;

    if (data.clientId) {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

      const supabaseClient =
        (context as unknown as { supabase?: ReturnType<typeof createClient<Database>> })?.supabase ||
        (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
          ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
          : undefined);

      if (supabaseClient) {
        try {
          const hasAiMemoryConsent = await consentsRepo.hasActiveConsentType(
            supabaseClient,
            data.clientId,
            "ai_memory",
          );

          if (hasAiMemoryConsent) {
            // Scenario B: Active ai_memory consent -> Use sanitized context only
            effectiveUserContext = sanitizePersonalizedContext(data.userContext);
          }
          // Scenario A: No active ai_memory consent -> effectiveUserContext stays undefined
        } catch {
          // Failure on consent verification defaults to Scenario A (no personalization)
          effectiveUserContext = undefined;
        }
      }
    }

    const messages = [
      { role: "system", content: buildSystemPrompt(effectiveUserContext) },
      ...data.messages.slice(-16),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.75,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return {
          reply:
            "Estou com muitos pedidos ao mesmo tempo agora. Podemos continuar em instantes — ou, se preferir, fale direto com a Mariah pelo WhatsApp.",
          handoff: true,
        };
      }
      if (res.status === 402) {
        return {
          reply:
            "No momento não consigo responder por aqui. Vou pedir que você chame a Mariah pelo WhatsApp para um atendimento com todo o carinho.",
          handoff: true,
        };
      }
      throw new Error(`AI gateway ${res.status}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const rawReply = json.choices?.[0]?.message?.content?.trim() ?? "";
    const handoff = rawReply.includes("[REDIRECIONAR_WHATSAPP]");
    const reply = rawReply.replace(/\[REDIRECIONAR_WHATSAPP\]/g, "").trim();
    return { reply, handoff };
  });
