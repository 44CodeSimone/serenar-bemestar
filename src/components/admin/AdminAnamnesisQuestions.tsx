import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Pencil, Plus, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type Template = Database["public"]["Tables"]["anamnesis_templates"]["Row"];
type Question = Database["public"]["Tables"]["anamnesis_questions"]["Row"];
type QuestionType =
  | "text"
  | "textarea"
  | "boolean"
  | "number"
  | "date"
  | "single_choice"
  | "multiple_choice"
  | "scale";

type EditorQuestion = Question & {
  isNew?: boolean;
  choicesText: string;
};

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Resposta curta" },
  { value: "textarea", label: "Resposta longa" },
  { value: "boolean", label: "Sim ou não" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "single_choice", label: "Escolher uma opção" },
  { value: "multiple_choice", label: "Escolher várias opções" },
  { value: "scale", label: "Escala de 0 a 10" },
];

function choicesFromOptions(options: Json | null): string {
  if (Array.isArray(options)) return options.map(String).join("\n");
  if (options && typeof options === "object" && !Array.isArray(options)) {
    const choices =
      "choices" in options ? options.choices : "values" in options ? options.values : null;
    if (Array.isArray(choices)) return choices.map(String).join("\n");
  }
  return "";
}

function optionsFromQuestion(question: EditorQuestion): Json | null {
  if (question.field_type === "single_choice" || question.field_type === "multiple_choice") {
    const choices = question.choicesText
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return { choices };
  }
  if (question.field_type === "scale") {
    return { min: 0, max: 10 };
  }
  return null;
}

function toEditorQuestion(question: Question): EditorQuestion {
  return { ...question, choicesText: choicesFromOptions(question.options) };
}

function friendlyError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminAnamnesisQuestions() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [questions, setQuestions] = useState<EditorQuestion[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [dirty, setDirty] = useState(false);

  const activeTemplate = useMemo(() => templates.find((item) => item.active) ?? null, [templates]);
  const isDraft = Boolean(template && !template.active && !template.retired_at);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: templateRows, error: templateError } = await supabase
        .from("anamnesis_templates")
        .select("*")
        .order("version", { ascending: false });
      if (templateError) throw templateError;

      const allTemplates = templateRows ?? [];
      const draft = allTemplates.find((item) => !item.active && !item.retired_at);
      const active = allTemplates.find((item) => item.active);
      const selected = draft ?? active ?? allTemplates[0] ?? null;
      setTemplates(allTemplates);
      setTemplate(selected);
      setDescription(selected?.description ?? "");

      if (!selected) {
        setQuestions([]);
        return;
      }

      let questionsQuery = supabase
        .from("anamnesis_questions")
        .select("*")
        .eq("template_id", selected.id)
        .order("display_order", { ascending: true });
      if (selected.active) questionsQuery = questionsQuery.eq("active", true);
      const { data: questionRows, error: questionError } = await questionsQuery;
      if (questionError) throw questionError;
      setQuestions((questionRows ?? []).map(toEditorQuestion));
      setDirty(false);
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível carregar as perguntas."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function changeQuestion(id: string, patch: Partial<EditorQuestion>) {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...patch } : question)),
    );
    setDirty(true);
  }

  async function startEditing() {
    if (!activeTemplate || working) return;
    setWorking(true);
    let createdDraftId: string | null = null;
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente.");

      const nextVersion = Math.max(...templates.map((item) => item.version), 0) + 1;
      const { data: draft, error: draftError } = await supabase
        .from("anamnesis_templates")
        .insert({
          name: activeTemplate.name,
          version: nextVersion,
          description: activeTemplate.description,
          active: false,
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (draftError) throw draftError;
      createdDraftId = draft.id;

      const { data: sourceQuestions, error: sourceError } = await supabase
        .from("anamnesis_questions")
        .select("*")
        .eq("template_id", activeTemplate.id)
        .eq("active", true)
        .order("display_order", { ascending: true });
      if (sourceError) throw sourceError;

      if ((sourceQuestions ?? []).length > 0) {
        const { error: cloneError } = await supabase.from("anamnesis_questions").insert(
          (sourceQuestions ?? []).map((question) => ({
            template_id: draft.id,
            question_key: question.question_key,
            label: question.label,
            field_type: question.field_type,
            options: question.options,
            required: question.required,
            display_order: question.display_order,
            help_text: question.help_text,
            active: true,
          })),
        );
        if (cloneError) throw cloneError;
      }

      toast.success("Cópia para edição criada. As anamneses antigas continuam intactas.");
      await load();
    } catch (error) {
      if (createdDraftId) {
        await supabase
          .from("anamnesis_templates")
          .update({ retired_at: new Date().toISOString() })
          .eq("id", createdDraftId)
          .eq("active", false);
      }
      toast.error(friendlyError(error, "Não foi possível iniciar a edição."));
    } finally {
      setWorking(false);
    }
  }

  function addQuestion() {
    if (!template || !isDraft) return;
    const nextOrder = Math.max(...questions.map((item) => item.display_order), 0) + 10;
    setQuestions((current) => [
      ...current,
      {
        id: `new-${crypto.randomUUID()}`,
        template_id: template.id,
        question_key: `pergunta_${Date.now()}`,
        label: "",
        field_type: "textarea",
        options: null,
        required: false,
        display_order: nextOrder,
        help_text: null,
        active: true,
        created_at: new Date().toISOString(),
        choicesText: "",
        isNew: true,
      },
    ]);
    setDirty(true);
  }

  async function saveDraft(showSuccess = true): Promise<boolean> {
    if (!template || !isDraft || working) return false;
    const activeQuestions = questions.filter((item) => item.active);
    if (activeQuestions.length === 0) {
      toast.error("Mantenha pelo menos uma pergunta ativa.");
      return false;
    }
    if (activeQuestions.some((item) => !item.label.trim())) {
      toast.error("Preencha o texto de todas as perguntas ativas.");
      return false;
    }
    if (
      activeQuestions.some(
        (item) =>
          (item.field_type === "single_choice" || item.field_type === "multiple_choice") &&
          !item.choicesText.trim(),
      )
    ) {
      toast.error("Informe as opções das perguntas de escolha.");
      return false;
    }

    setWorking(true);
    try {
      const { error: templateError } = await supabase
        .from("anamnesis_templates")
        .update({ description: description.trim() || null })
        .eq("id", template.id)
        .eq("active", false);
      if (templateError) throw templateError;

      for (const question of questions) {
        const values = {
          label: question.label.trim(),
          field_type: question.field_type,
          options: optionsFromQuestion(question),
          required: question.required,
          display_order: question.display_order,
          help_text: question.help_text?.trim() || null,
          active: question.active,
        };
        if (question.isNew) {
          const { error } = await supabase.from("anamnesis_questions").upsert(
            {
              ...values,
              template_id: template.id,
              question_key: question.question_key,
            },
            { onConflict: "template_id,question_key" },
          );
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("anamnesis_questions")
            .update(values)
            .eq("id", question.id)
            .eq("template_id", template.id);
          if (error) throw error;
        }
      }

      setDirty(false);
      if (showSuccess) toast.success("Rascunho salvo.");
      await load();
      return true;
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível salvar o rascunho."));
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function publish() {
    if (!template || !isDraft || working) return;
    if (
      !confirm(
        "Publicar esta versão? Ela será usada nas próximas anamneses. As anteriores continuarão intactas.",
      )
    ) {
      return;
    }
    const saved = await saveDraft(false);
    if (!saved) return;

    setWorking(true);
    const publishedAt = new Date().toISOString();
    try {
      const { error: activateError } = await supabase
        .from("anamnesis_templates")
        .update({ active: true, retired_at: null })
        .eq("id", template.id)
        .eq("active", false);
      if (activateError) throw activateError;

      const { error: retireError } = await supabase
        .from("anamnesis_templates")
        .update({ active: false, retired_at: publishedAt })
        .eq("name", template.name)
        .neq("id", template.id)
        .eq("active", true);
      if (retireError) {
        await supabase
          .from("anamnesis_templates")
          .update({ active: false, retired_at: null })
          .eq("id", template.id);
        throw retireError;
      }

      toast.success(`Versão ${template.version} publicada para as próximas anamneses.`);
      await load();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível publicar a nova versão."));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow mb-2">Configuração clínica</p>
          <h1 className="font-serif text-4xl text-sage-deep">Perguntas da anamnese</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Edite o formulário usado nas próximas anamneses. Os formulários já criados e suas
            respostas não serão alterados.
          </p>
        </div>
        {!loading && template && !isDraft && (
          <button onClick={startEditing} disabled={working} className="btn-serena gap-2">
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
            Editar perguntas
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-sage-deep" />
        </div>
      ) : !template ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-9 w-9 text-sage-deep/50" />
          <p className="text-sm text-muted-foreground">Nenhum modelo de anamnese foi encontrado.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-serif text-xl text-sage-deep">{template.name}</p>
                <p className="text-xs text-muted-foreground">
                  Versão {template.version} · {isDraft ? "Rascunho em edição" : "Versão publicada"}
                </p>
              </div>
              {isDraft && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  Ainda não publicada
                </span>
              )}
            </div>
            <label className="mt-4 block text-xs font-medium text-foreground/70">
              Descrição do formulário
              <textarea
                value={description}
                disabled={!isDraft || working}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setDirty(true);
                }}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
              />
            </label>
          </div>

          <div className="space-y-4">
            {questions.map((question, index) => {
              const usesChoices =
                question.field_type === "single_choice" ||
                question.field_type === "multiple_choice";
              return (
                <div
                  key={question.id}
                  className={`rounded-2xl border bg-card p-4 shadow-soft ${
                    question.active ? "border-border" : "border-border opacity-60"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pergunta {index + 1}
                    </span>
                    {isDraft && (
                      <button
                        type="button"
                        onClick={() => changeQuestion(question.id, { active: !question.active })}
                        disabled={working}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-sage-deep"
                      >
                        <X className="h-3.5 w-3.5" />
                        {question.active ? "Retirar da nova versão" : "Restaurar"}
                      </button>
                    )}
                  </div>

                  <label className="block text-xs font-medium text-foreground/70">
                    Texto da pergunta
                    <textarea
                      value={question.label}
                      disabled={!isDraft || working || !question.active}
                      onChange={(event) =>
                        changeQuestion(question.id, { label: event.target.value })
                      }
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                    />
                  </label>

                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_120px]">
                    <label className="text-xs font-medium text-foreground/70">
                      Tipo de resposta
                      <select
                        value={question.field_type}
                        disabled={!isDraft || working || !question.active}
                        onChange={(event) =>
                          changeQuestion(question.id, { field_type: event.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      >
                        {QUESTION_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-foreground/70">
                      Ordem
                      <input
                        type="number"
                        value={question.display_order}
                        disabled={!isDraft || working || !question.active}
                        onChange={(event) =>
                          changeQuestion(question.id, { display_order: Number(event.target.value) })
                        }
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="mt-6 inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={question.required}
                        disabled={!isDraft || working || !question.active}
                        onChange={(event) =>
                          changeQuestion(question.id, { required: event.target.checked })
                        }
                      />
                      Obrigatória
                    </label>
                  </div>

                  {usesChoices && question.active && (
                    <label className="mt-3 block text-xs font-medium text-foreground/70">
                      Opções — uma por linha
                      <textarea
                        value={question.choicesText}
                        disabled={!isDraft || working}
                        onChange={(event) =>
                          changeQuestion(question.id, { choicesText: event.target.value })
                        }
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                      />
                    </label>
                  )}

                  <label className="mt-3 block text-xs font-medium text-foreground/70">
                    Orientação opcional para a Mariah
                    <input
                      value={question.help_text ?? ""}
                      disabled={!isDraft || working || !question.active}
                      onChange={(event) =>
                        changeQuestion(question.id, { help_text: event.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {isDraft && (
            <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 p-4 shadow-md backdrop-blur-sm">
              <button onClick={addQuestion} disabled={working} className="btn-serena-outline gap-2">
                <Plus className="h-4 w-4" /> Nova pergunta
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void saveDraft()}
                  disabled={working || !dirty}
                  className="btn-serena-outline gap-2"
                >
                  {working ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar rascunho
                </button>
                <button onClick={publish} disabled={working} className="btn-serena gap-2">
                  {working ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Publicar para novas anamneses
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
