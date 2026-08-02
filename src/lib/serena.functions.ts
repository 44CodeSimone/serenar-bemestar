import { createServerFn } from "@tanstack/react-start";
import { SERVICES } from "./services";

const SITE_KNOWLEDGE = {
  name: "Serenar",
  tagline: "Massoterapia & Bem-Estar",
  therapist: "Mariah Luz",
  city: "Urubici / SC",

  instagram: "@serenar_massoterapiaebemestar",
  hours: "Segunda a Sexta 9h Ã s 20h, SÃ¡bados 9h Ã s 16h.",
} as const;

function buildSystemPrompt(userContext?: string) {
  const serviceList = SERVICES.map(
    (s) =>
      `â€¢ ${s.name} (${s.duration}) â€” ${s.short} BenefÃ­cios: ${s.benefits.join("; ")}. ContraindicaÃ§Ãµes: ${s.contraindications}`,
  ).join("\n");

  return `VocÃª Ã© a Serenar, recepcionista virtual do espaÃ§o ${SITE_KNOWLEDGE.name} â€” ${SITE_KNOWLEDGE.tagline}.

TOM: vocÃª Ã© humana em espÃ­rito â€” acolhedora, elegante, calma, empÃ¡tica, profissional. Nunca robÃ³tica. Nunca respostas em listas numeradas a menos que solicitado. Conversa fluida, breve, respiraÃ§Ã£o de spa. Trate a pessoa pelo nome quando souber. Escreva em portuguÃªs brasileiro, natural e caloroso.

O QUE VOCÃŠ SABE:
- Terapeuta: ${SITE_KNOWLEDGE.therapist}. Local: ${SITE_KNOWLEDGE.city}.
- HorÃ¡rios: ${SITE_KNOWLEDGE.hours}
- Contato: Instagram ${SITE_KNOWLEDGE.instagram}

SERVIÃ‡OS OFERECIDOS:
${serviceList}

REGRAS IMPORTANTES:
1. Nunca faÃ§a diagnÃ³stico mÃ©dico nem prescreva tratamentos. Ao menor sinal de dÃºvida clÃ­nica, sugira gentilmente procurar um profissional de saÃºde.
2. Se a pessoa pedir para falar com alguÃ©m, marcar horÃ¡rio especÃ­fico ou tratar algo sensÃ­vel, redirecione gentilmente para o WhatsApp da Mariah. Termine sua resposta com a marcaÃ§Ã£o exata [REDIRECIONAR_WHATSAPP].
3. Se for perguntada sobre preÃ§os exatos, diga que os valores sÃ£o passados no atendimento (WhatsApp) para melhor personalizaÃ§Ã£o.
4. Respostas curtas (2 a 5 frases). Sem markdown pesado. Sem emojis excessivos â€” no mÃ¡ximo um sutil por resposta se combinar.
5. Nunca invente serviÃ§os que nÃ£o estÃ£o na lista.
6. Se a pessoa mencionar contraindicaÃ§Ãµes, seja delicada e sugira falar com a Mariah antes.
${userContext ? `\nCONTEXTO DA PESSOA COM VOCÃŠ: ${userContext}` : ""}`;
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

export const serenaChat = createServerFn({ method: "POST" })
  .validator((data: { messages: ChatMessage[]; userContext?: string }) => {
    if (!data || typeof data !== "object") throw new Error("payload invÃ¡lido");
    if (!Array.isArray(data.messages)) throw new Error("messages obrigatÃ³rio");
    if (data.messages.length === 0) throw new Error("messages vazio");
    if (data.messages.length > MAX_MESSAGES) throw new Error("muitas mensagens");
    const cleanMessages: ChatMessage[] = data.messages.map((m) => {
      if (!m || (m.role !== "user" && m.role !== "assistant")) {
        throw new Error("role invÃ¡lido");
      }
      if (typeof m.content !== "string") throw new Error("content invÃ¡lido");
      return {
        role: m.role,
        content: sanitizeForPrompt(m.content, MAX_MESSAGE_CHARS),
      };
    });
    const userContext =
      typeof data.userContext === "string" && data.userContext.length > 0
        ? sanitizeForPrompt(data.userContext, MAX_USER_CONTEXT_CHARS)
        : undefined;
    return { messages: cleanMessages, userContext };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const messages = [
      { role: "system", content: buildSystemPrompt(data.userContext) },
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
            "Estou com muitos pedidos ao mesmo tempo agora. Podemos continuar em instantes â€” ou, se preferir, fale direto com a Mariah pelo WhatsApp.",
          handoff: true,
        };
      }
      if (res.status === 402) {
        return {
          reply:
            "No momento nÃ£o consigo responder por aqui. Vou pedir que vocÃª chame a Mariah pelo WhatsApp para um atendimento com todo o carinho.",
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
