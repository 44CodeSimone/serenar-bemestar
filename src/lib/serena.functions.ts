import { createServerFn } from "@tanstack/react-start";
import { SERVICES } from "./services";

const SITE_KNOWLEDGE = {
  name: "Serenar",
  tagline: "Massoterapia & Bem-Estar",
  therapist: "Mariah Luz",
  city: "Urubici / SC",
  
  instagram: "@serenar_massoterapiaebemestar",
  hours: "Segunda a Sexta 9h às 20h, Sábados 9h às 16h.",
} as const;

function buildSystemPrompt(userContext?: string) {
  const serviceList = SERVICES.map(
    (s) => `• ${s.name} (${s.duration}) — ${s.short} Benefícios: ${s.benefits.join("; ")}. Contraindicações: ${s.contraindications}`,
  ).join("\n");

  return `Você é a Serená, recepcionista virtual do espaço ${SITE_KNOWLEDGE.name} — ${SITE_KNOWLEDGE.tagline}.

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

export const serenaChat = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ChatMessage[]; userContext?: string }) => {
    if (!Array.isArray(data?.messages)) throw new Error("messages obrigatório");
    return data;
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
