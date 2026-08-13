import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AnamnesisTemplateRow = Database["public"]["Tables"]["anamnesis_templates"]["Row"];
export type AnamnesisQuestionRow = Database["public"]["Tables"]["anamnesis_questions"]["Row"];
export type ClientAnamnesisRow = Database["public"]["Tables"]["client_anamneses"]["Row"];
export type AnamnesisAnswerRow = Database["public"]["Tables"]["anamnesis_answers"]["Row"];

export type ClientAnamnesisInsert = Database["public"]["Tables"]["client_anamneses"]["Insert"];
export type AnamnesisAnswerInsert = Database["public"]["Tables"]["anamnesis_answers"]["Insert"];

export interface ClientAnamnesisWithTemplate extends ClientAnamnesisRow {
  template?: {
    name: string;
    version: number;
  } | null;
}

export interface AnamnesisDetailResult {
  anamnesis: ClientAnamnesisRow;
  template: AnamnesisTemplateRow;
  questions: AnamnesisQuestionRow[];
  answers: AnamnesisAnswerRow[];
}

/**
 * Lista todos os modelos de anamnese ativos disponíveis.
 */
export async function listActiveTemplates(
  supabase: SupabaseClient<Database>
): Promise<AnamnesisTemplateRow[]> {
  const { data, error } = await supabase
    .from("anamnesis_templates")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true })
    .order("version", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar modelos de anamnese: ${error.message}`);
  }

  return data || [];
}

/**
 * Obtém um modelo de anamnese e suas perguntas ativas ordenadas por display_order.
 */
export async function getTemplateWithQuestions(
  supabase: SupabaseClient<Database>,
  templateId: string
): Promise<{ template: AnamnesisTemplateRow; questions: AnamnesisQuestionRow[] } | null> {
  const { data: template, error: templateError } = await supabase
    .from("anamnesis_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) {
    throw new Error(`Erro ao buscar modelo de anamnese: ${templateError.message}`);
  }

  if (!template) {
    return null;
  }

  const { data: questions, error: questionsError } = await supabase
    .from("anamnesis_questions")
    .select("*")
    .eq("template_id", templateId)
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (questionsError) {
    throw new Error(`Erro ao buscar perguntas do modelo: ${questionsError.message}`);
  }

  return {
    template,
    questions: questions || [],
  };
}

/**
 * Lista as anamneses vinculadas a um cliente específico (mais recentes primeiro).
 */
export async function listClientAnamneses(
  supabase: SupabaseClient<Database>,
  clientId: string
): Promise<ClientAnamnesisWithTemplate[]> {
  const { data, error } = await supabase
    .from("client_anamneses")
    .select(`
      *,
      template:anamnesis_templates (
        name,
        version
      )
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar histórico de anamneses do cliente: ${error.message}`);
  }

  return (data as unknown as ClientAnamnesisWithTemplate[]) || [];
}

/**
 * Obtém os detalhes completos de uma anamnese (cabeçalho, modelo, perguntas e respostas).
 */
export async function getClientAnamnesisDetail(
  supabase: SupabaseClient<Database>,
  anamnesisId: string
): Promise<AnamnesisDetailResult | null> {
  const { data: anamnesis, error: anamnesisError } = await supabase
    .from("client_anamneses")
    .select("*")
    .eq("id", anamnesisId)
    .maybeSingle();

  if (anamnesisError) {
    throw new Error(`Erro ao buscar registro de anamnese: ${anamnesisError.message}`);
  }

  if (!anamnesis) {
    return null;
  }

  const templateWithQ = await getTemplateWithQuestions(supabase, anamnesis.template_id);
  if (!templateWithQ) {
    throw new Error("Modelo de anamnese vinculado não foi encontrado.");
  }

  const { data: answers, error: answersError } = await supabase
    .from("anamnesis_answers")
    .select("*")
    .eq("anamnesis_id", anamnesisId);

  if (answersError) {
    throw new Error(`Erro ao buscar respostas da anamnese: ${answersError.message}`);
  }

  return {
    anamnesis,
    template: templateWithQ.template,
    questions: templateWithQ.questions,
    answers: answers || [],
  };
}

/**
 * Cria um novo registro de anamnese no status 'draft'.
 */
export async function createDraftAnamnesis(
  supabase: SupabaseClient<Database>,
  payload: {
    client_id: string;
    template_id: string;
    filled_by?: string;
  }
): Promise<ClientAnamnesisRow> {
  const insertData: ClientAnamnesisInsert = {
    client_id: payload.client_id,
    template_id: payload.template_id,
    status: "draft",
    filled_by: payload.filled_by || "professional",
  };

  const { data, error } = await supabase
    .from("client_anamneses")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar rascunho de anamnese: ${error.message}`);
  }

  return data;
}

/**
 * Salva ou atualiza (upsert) um conjunto de respostas para uma anamnese em rascunho.
 */
export async function upsertAnamnesisAnswers(
  supabase: SupabaseClient<Database>,
  answersToUpsert: AnamnesisAnswerInsert[]
): Promise<AnamnesisAnswerRow[]> {
  if (answersToUpsert.length === 0) return [];

  const { data, error } = await supabase
    .from("anamnesis_answers")
    .upsert(answersToUpsert, { onConflict: "anamnesis_id,question_id" })
    .select();

  if (error) {
    throw new Error(`Erro ao salvar respostas da anamnese: ${error.message}`);
  }

  return data || [];
}

/**
 * Atualiza o status e metadados de uma anamnese (conclusão ou revisão).
 */
export async function updateAnamnesisStatus(
  supabase: SupabaseClient<Database>,
  anamnesisId: string,
  status: "completed" | "reviewed",
  extraFields: {
    completed_at?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
  }
): Promise<ClientAnamnesisRow> {
  const updateData: Database["public"]["Tables"]["client_anamneses"]["Update"] = {
    status,
    ...extraFields,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("client_anamneses")
    .update(updateData)
    .eq("id", anamnesisId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar status da anamnese: ${error.message}`);
  }

  return data;
}
