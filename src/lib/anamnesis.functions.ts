import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  listActiveTemplates,
  getTemplateWithQuestions,
  listClientAnamneses,
  getClientAnamnesisDetail,
  createDraftAnamnesis,
  upsertAnamnesisAnswers,
  updateAnamnesisStatus,
  type AnamnesisAnswerInsert,
  type AnamnesisQuestionRow,
} from "@/lib/anamnesis.repository";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * Verifica se um valor de resposta foi efetivamente fornecido.
 */
function isAnswerProvided(answer: unknown): boolean {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (typeof answer === "boolean") return true;
  if (typeof answer === "number") return !isNaN(answer);
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === "object") return Object.keys(answer as object).length > 0;
  return false;
}

/**
 * Validação rigorosa por field_type e opções permitidas.
 */
function validateAnswerValueByFieldType(
  question: AnamnesisQuestionRow,
  answer: unknown,
): { isValid: boolean; errorMessage?: string } {
  if (answer === null || answer === undefined) {
    return { isValid: true };
  }

  const { field_type, label, options } = question;

  // 1. Text & Textarea
  if (field_type === "text" || field_type === "textarea") {
    if (typeof answer !== "string") {
      return {
        isValid: false,
        errorMessage: `A resposta para "${label}" deve ser um texto.`,
      };
    }
    return { isValid: true };
  }

  // 2. Boolean
  if (field_type === "boolean") {
    if (typeof answer !== "boolean") {
      return {
        isValid: false,
        errorMessage: `A resposta para "${label}" deve ser um booleano (verdadeiro/falso).`,
      };
    }
    return { isValid: true };
  }

  // 3. Number & Scale
  if (field_type === "number" || field_type === "scale") {
    if (typeof answer !== "number" || !Number.isFinite(answer)) {
      return {
        isValid: false,
        errorMessage: `A resposta para "${label}" deve ser um número válido.`,
      };
    }
    return { isValid: true };
  }

  // 4. Date
  if (field_type === "date") {
    if (typeof answer !== "string" || isNaN(Date.parse(answer))) {
      return {
        isValid: false,
        errorMessage: `A resposta para "${label}" deve ser uma data válida.`,
      };
    }
    return { isValid: true };
  }

  // Extração de opções válidas caso existam no JSONB `options`
  let allowedOptions: string[] | null = null;
  if (options && typeof options === "object") {
    if (Array.isArray(options)) {
      allowedOptions = options.map(String);
    } else if (
      "choices" in (options as Record<string, unknown>) &&
      Array.isArray((options as Record<string, unknown>).choices)
    ) {
      allowedOptions = ((options as Record<string, unknown>).choices as unknown[]).map(String);
    } else if (
      "values" in (options as Record<string, unknown>) &&
      Array.isArray((options as Record<string, unknown>).values)
    ) {
      allowedOptions = ((options as Record<string, unknown>).values as unknown[]).map(String);
    }
  }

  // 5. Single Choice
  if (field_type === "single_choice") {
    if (typeof answer !== "string") {
      return {
        isValid: false,
        errorMessage: `A resposta para "${label}" deve ser uma opção selecionada (texto).`,
      };
    }
    if (allowedOptions && allowedOptions.length > 0 && !allowedOptions.includes(answer)) {
      return {
        isValid: false,
        errorMessage: `A opção selecionada para "${label}" não figura nas opções permitidas.`,
      };
    }
    return { isValid: true };
  }

  // 6. Multiple Choice
  if (field_type === "multiple_choice") {
    if (!Array.isArray(answer)) {
      return {
        isValid: false,
        errorMessage: `A resposta para "${label}" deve ser uma lista de opções.`,
      };
    }
    for (const item of answer) {
      if (typeof item !== "string") {
        return {
          isValid: false,
          errorMessage: `Os itens selecionados para "${label}" devem ser textos.`,
        };
      }
      if (allowedOptions && allowedOptions.length > 0 && !allowedOptions.includes(item)) {
        return {
          isValid: false,
          errorMessage: `A opção "${item}" selecionada para "${label}" não figura nas opções permitidas.`,
        };
      }
    }
    return { isValid: true };
  }

  return { isValid: true };
}

/**
 * Server Function: Lista os modelos de anamnese ativos no sistema.
 */
export const listActiveAnamnesisTemplatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await listActiveTemplates(context.supabase);
  });

/**
 * Server Function: Obtém um modelo de anamnese específico com suas perguntas ativas.
 */
export const getAnamnesisTemplateFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { templateId: string }) => {
    if (!isValidUuid(data.templateId)) {
      throw new Error("ID de modelo de anamnese inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const res = await getTemplateWithQuestions(context.supabase, data.templateId);
    if (!res) {
      throw new Error("Modelo de anamnese não encontrado.");
    }
    return res;
  });

/**
 * Server Function: Lista o histórico de anamneses de um cliente.
 */
export const listClientAnamnesesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { clientId: string }) => {
    if (!isValidUuid(data.clientId)) {
      throw new Error("ID de cliente inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    return await listClientAnamneses(context.supabase, data.clientId);
  });

/**
 * Server Function: Obtém os detalhes completos de uma anamnese (cabeçalho, perguntas e respostas).
 */
export const getClientAnamnesisFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { anamnesisId: string }) => {
    if (!isValidUuid(data.anamnesisId)) {
      throw new Error("ID de anamnese inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const detail = await getClientAnamnesisDetail(context.supabase, data.anamnesisId);
    if (!detail) {
      throw new Error("Anamnese não encontrada.");
    }
    return detail;
  });

/**
 * Server Function: Cria um novo rascunho de anamnese para um cliente a partir de um modelo ativo.
 */
export const createClientAnamnesisFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { clientId: string; templateId: string }) => {
    if (!isValidUuid(data.clientId)) {
      throw new Error("ID de cliente inválido.");
    }
    if (!isValidUuid(data.templateId)) {
      throw new Error("ID de modelo de anamnese inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const templateWithQ = await getTemplateWithQuestions(context.supabase, data.templateId);
    if (!templateWithQ || !templateWithQ.template.active) {
      throw new Error("O modelo de anamnese selecionado não está ativo.");
    }

    return await createDraftAnamnesis(context.supabase, {
      client_id: data.clientId,
      template_id: data.templateId,
      filled_by: "professional",
    });
  });

/**
 * Server Function: Salva respostas temporárias em rascunho com validação rigorosa por field_type.
 */
export const saveAnamnesisAnswersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { anamnesisId: string; answers: { questionId: string; answer: unknown }[] }) => {
      if (!isValidUuid(data.anamnesisId)) {
        throw new Error("ID de anamnese inválido.");
      }
      if (!Array.isArray(data.answers)) {
        throw new Error("Payload de respostas deve ser um array.");
      }
      for (const item of data.answers) {
        if (!isValidUuid(item.questionId)) {
          throw new Error("ID de pergunta inválido detectado.");
        }
      }
      return data;
    },
  )
  .handler(async ({ context, data }) => {
    const detail = await getClientAnamnesisDetail(context.supabase, data.anamnesisId);
    if (!detail) {
      throw new Error("Anamnese não encontrada.");
    }

    if (detail.anamnesis.status !== "draft") {
      throw new Error("Esta anamnese já foi concluída e não pode ter suas respostas alteradas.");
    }

    const questionMap = new Map<string, AnamnesisQuestionRow>();
    for (const q of detail.questions) {
      questionMap.set(q.id, q);
    }

    const answersToUpsert: AnamnesisAnswerInsert[] = [];

    for (const item of data.answers) {
      const question = questionMap.get(item.questionId);
      if (!question) {
        throw new Error("A pergunta informada não pertence a este modelo de anamnese.");
      }

      // Validação por field_type caso um valor seja fornecido
      if (item.answer !== null && item.answer !== undefined) {
        const valRes = validateAnswerValueByFieldType(question, item.answer);
        if (!valRes.isValid) {
          throw new Error(valRes.errorMessage || "Valor de resposta inválido.");
        }
      }

      answersToUpsert.push({
        anamnesis_id: data.anamnesisId,
        question_id: item.questionId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        answer: item.answer as any,
      });
    }

    return await upsertAnamnesisAnswers(context.supabase, answersToUpsert);
  });

/**
 * Server Function: Conclui uma anamnese, validando perguntas obrigatórias e tipos de resposta.
 */
export const completeClientAnamnesisFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: { anamnesisId: string; answers?: { questionId: string; answer: unknown }[] }) => {
      if (!isValidUuid(data.anamnesisId)) {
        throw new Error("ID de anamnese inválido.");
      }
      return data;
    },
  )
  .handler(async ({ context, data }) => {
    const detail = await getClientAnamnesisDetail(context.supabase, data.anamnesisId);
    if (!detail) {
      throw new Error("Anamnese não encontrada.");
    }

    if (detail.anamnesis.status !== "draft") {
      throw new Error("Esta anamnese já foi concluída anteriormente.");
    }

    // Se respostas finais foram enviadas junto na conclusão, salvar antes
    if (data.answers && data.answers.length > 0) {
      const questionMap = new Map<string, AnamnesisQuestionRow>();
      for (const q of detail.questions) {
        questionMap.set(q.id, q);
      }

      const answersToUpsert: AnamnesisAnswerInsert[] = [];

      for (const item of data.answers) {
        const question = questionMap.get(item.questionId);
        if (!question) {
          throw new Error("A pergunta informada não pertence a este modelo de anamnese.");
        }

        if (item.answer !== null && item.answer !== undefined) {
          const valRes = validateAnswerValueByFieldType(question, item.answer);
          if (!valRes.isValid) {
            throw new Error(valRes.errorMessage || "Valor de resposta inválido.");
          }
        }

        answersToUpsert.push({
          anamnesis_id: data.anamnesisId,
          question_id: item.questionId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          answer: item.answer as any,
        });
      }
      await upsertAnamnesisAnswers(context.supabase, answersToUpsert);
    }

    // Re-buscar detalhes atualizados
    const updatedDetail = await getClientAnamnesisDetail(context.supabase, data.anamnesisId);
    if (!updatedDetail) {
      throw new Error("Falha ao recuperar anamnese para validação.");
    }

    const answerMap = new Map<string, unknown>();
    for (const ans of updatedDetail.answers) {
      answerMap.set(ans.question_id, ans.answer);
    }

    // Validar todas as perguntas do modelo
    const missingQuestions: string[] = [];
    for (const q of updatedDetail.questions) {
      const val = answerMap.get(q.id);

      // Verificar obrigatoriedade
      if (q.required && !isAnswerProvided(val)) {
        missingQuestions.push(q.label);
      }

      // Validar tipo caso a resposta esteja presente
      if (val !== undefined && val !== null) {
        const valRes = validateAnswerValueByFieldType(q, val);
        if (!valRes.isValid) {
          throw new Error(valRes.errorMessage || `Resposta inválida para "${q.label}".`);
        }
      }
    }

    if (missingQuestions.length > 0) {
      throw new Error(
        `Existem perguntas obrigatórias sem resposta: ${missingQuestions.join(", ")}.`,
      );
    }

    return await updateAnamnesisStatus(context.supabase, data.anamnesisId, "completed", {
      completed_at: new Date().toISOString(),
    });
  });

/**
 * Server Function: Marca uma anamnese concluída como revisada pela profissional responsável.
 */
export const reviewClientAnamnesisFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { anamnesisId: string }) => {
    if (!isValidUuid(data.anamnesisId)) {
      throw new Error("ID de anamnese inválido.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const detail = await getClientAnamnesisDetail(context.supabase, data.anamnesisId);
    if (!detail) {
      throw new Error("Anamnese não encontrada.");
    }

    if (detail.anamnesis.status === "draft") {
      throw new Error("Uma anamnese em rascunho precisa ser concluída antes de ser revisada.");
    }

    return await updateAnamnesisStatus(context.supabase, data.anamnesisId, "reviewed", {
      reviewed_by: context.user.id,
      reviewed_at: new Date().toISOString(),
    });
  });
