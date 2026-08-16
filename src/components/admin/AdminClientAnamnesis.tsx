import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Plus,
  Save,
  CheckCircle2,
  UserCheck,
  ClipboardList,
  ChevronLeft,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import {
  listActiveAnamnesisTemplatesFn,
  listClientAnamnesesFn,
  getClientAnamnesisFn,
  createClientAnamnesisFn,
  saveAnamnesisAnswersFn,
  completeClientAnamnesisFn,
  reviewClientAnamnesisFn,
} from "@/lib/anamnesis.functions";

import type {
  ClientAnamnesisWithTemplate,
  AnamnesisDetailResult,
  AnamnesisTemplateRow,
  AnamnesisQuestionRow,
} from "@/lib/anamnesis.repository";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnamnesisStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-50 text-amber-700 font-medium"
        >
          Rascunho
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
          Concluída
        </Badge>
      );
    case "reviewed":
      return (
        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">Revisada</Badge>
      );
    case "superseded":
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-medium">
          Substituída
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function parseQuestionOptions(options: unknown): string[] {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map(String);
  }
  if (typeof options === "object") {
    const obj = options as Record<string, unknown>;
    if (Array.isArray(obj.choices)) {
      return obj.choices.map(String);
    }
    if (Array.isArray(obj.values)) {
      return obj.values.map(String);
    }
  }
  return [];
}

interface AdminClientAnamnesisProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminClientAnamnesis({
  clientId,
  clientName,
  isOpen,
  onOpenChange,
}: AdminClientAnamnesisProps) {
  // Chamadas de Server Functions
  const fetchActiveTemplates = useServerFn(listActiveAnamnesisTemplatesFn);
  const fetchClientAnamneses = useServerFn(listClientAnamnesesFn);
  const fetchAnamnesisDetail = useServerFn(getClientAnamnesisFn);
  const executeCreateAnamnesis = useServerFn(createClientAnamnesisFn);
  const executeSaveAnswers = useServerFn(saveAnamnesisAnswersFn);
  const executeCompleteAnamnesis = useServerFn(completeClientAnamnesisFn);
  const executeReviewAnamnesis = useServerFn(reviewClientAnamnesisFn);

  // Estados de navegação interna e lista
  const [anamnesesList, setAnamnesesList] = useState<ClientAnamnesisWithTemplate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedAnamnesisId, setSelectedAnamnesisId] = useState<string | null>(null);

  // Estados de detalhe/edição
  const [activeDetail, setActiveDetail] = useState<AnamnesisDetailResult | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, unknown>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Estados de criação de nova anamnese
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [templates, setTemplates] = useState<AnamnesisTemplateRow[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Estado global de submissão de ações
  const [submitting, setSubmitting] = useState(false);

  // Carregar histórico de anamneses do cliente
  const loadHistory = useCallback(async () => {
    if (!clientId) return;
    setLoadingList(true);
    try {
      const list = await fetchClientAnamneses({ data: { clientId } });
      setAnamnesesList(list);
    } catch {
      toast.error("Erro ao carregar histórico de anamneses do cliente.");
    } finally {
      setLoadingList(false);
    }
  }, [clientId, fetchClientAnamneses]);

  // Efeito ao abrir o modal principal
  useEffect(() => {
    if (isOpen && clientId) {
      void loadHistory();
      setSelectedAnamnesisId(null);
      setActiveDetail(null);
      setAnswersMap({});
    }
  }, [isOpen, clientId, loadHistory]);

  // Carregar detalhe de uma anamnese específica
  const loadAnamnesisDetail = useCallback(
    async (anamnesisId: string) => {
      setLoadingDetail(true);
      try {
        const detail = await fetchAnamnesisDetail({ data: { anamnesisId } });
        setActiveDetail(detail);
        setSelectedAnamnesisId(anamnesisId);

        // Preencher mapa inicial de respostas
        const initialAnswers: Record<string, unknown> = {};
        if (detail && detail.answers) {
          detail.answers.forEach((ans) => {
            initialAnswers[ans.question_id] = ans.answer;
          });
        }
        setAnswersMap(initialAnswers);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar detalhes da anamnese.";
        toast.error(msg);
      } finally {
        setLoadingDetail(false);
      }
    },
    [fetchAnamnesisDetail],
  );

  // Abrir modal de seleção de modelo para Nova Anamnese
  const handleOpenNewModal = async () => {
    setLoadingTemplates(true);
    setIsNewModalOpen(true);
    setSelectedTemplateId("");
    try {
      const activeList = await fetchActiveTemplates();
      setTemplates(activeList);
      if (activeList.length > 0) {
        setSelectedTemplateId(activeList[0].id);
      }
    } catch {
      toast.error("Erro ao listar modelos de anamnese ativos.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Criar nova anamnese
  const handleCreateAnamnesis = async () => {
    if (!selectedTemplateId) {
      toast.error("Selecione um modelo de anamnese.");
      return;
    }
    setSubmitting(true);
    try {
      const newAnamnesis = await executeCreateAnamnesis({
        data: {
          clientId,
          templateId: selectedTemplateId,
        },
      });

      toast.success("Novo rascunho de anamnese criado!");
      setIsNewModalOpen(false);
      await loadHistory();
      await loadAnamnesisDetail(newAnamnesis.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar anamnese.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Atualizar resposta de uma pergunta no mapa local
  const handleAnswerChange = (questionId: string, value: unknown) => {
    setAnswersMap((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // Converte o estado local em payload de respostas
  const getAnswersPayload = () => {
    return Object.entries(answersMap).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));
  };

  // Salvar Rascunho
  const handleSaveDraft = async () => {
    if (!selectedAnamnesisId) return;
    setSubmitting(true);
    try {
      await executeSaveAnswers({
        data: {
          anamnesisId: selectedAnamnesisId,
          answers: getAnswersPayload(),
        },
      });
      toast.success("Rascunho salvo com sucesso!");
      void loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar rascunho.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Concluir Anamnese
  const handleCompleteAnamnesis = async () => {
    if (!selectedAnamnesisId) return;
    setSubmitting(true);
    try {
      await executeCompleteAnamnesis({
        data: {
          anamnesisId: selectedAnamnesisId,
          answers: getAnswersPayload(),
        },
      });
      toast.success("Anamnese concluída com sucesso!");
      await loadHistory();
      await loadAnamnesisDetail(selectedAnamnesisId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao concluir anamnese.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Marcar como Revisada
  const handleReviewAnamnesis = async () => {
    if (!selectedAnamnesisId) return;
    setSubmitting(true);
    try {
      await executeReviewAnamnesis({
        data: {
          anamnesisId: selectedAnamnesisId,
        },
      });
      toast.success("Anamnese marcada como revisada!");
      await loadHistory();
      await loadAnamnesisDetail(selectedAnamnesisId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao marcar como revisada.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = activeDetail?.anamnesis.status !== "draft";

  // Renderizar um campo de pergunta individual
  const renderQuestionField = (q: AnamnesisQuestionRow) => {
    const rawVal = answersMap[q.id];
    const options = parseQuestionOptions(q.options);

    switch (q.field_type) {
      case "text":
        return (
          <Input
            value={typeof rawVal === "string" ? rawVal : ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            disabled={isReadOnly}
            placeholder="Digite a resposta..."
            className="bg-background"
          />
        );

      case "textarea":
        return (
          <Textarea
            value={typeof rawVal === "string" ? rawVal : ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            disabled={isReadOnly}
            rows={3}
            placeholder="Digite os detalhes..."
            className="bg-background"
          />
        );

      case "boolean":
        return (
          <RadioGroup
            value={rawVal === true ? "true" : rawVal === false ? "false" : ""}
            onValueChange={(val) => handleAnswerChange(q.id, val === "true")}
            disabled={isReadOnly}
            className="flex items-center gap-6 pt-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id={`q_${q.id}_yes`} />
              <label htmlFor={`q_${q.id}_yes`} className="text-sm font-medium cursor-pointer">
                Sim
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id={`q_${q.id}_no`} />
              <label htmlFor={`q_${q.id}_no`} className="text-sm font-medium cursor-pointer">
                Não
              </label>
            </div>
          </RadioGroup>
        );

      case "number":
      case "scale":
        return (
          <Input
            type="number"
            value={typeof rawVal === "number" ? rawVal : ((rawVal as string | undefined) ?? "")}
            onChange={(e) =>
              handleAnswerChange(q.id, e.target.value === "" ? null : Number(e.target.value))
            }
            disabled={isReadOnly}
            placeholder={
              q.field_type === "scale" ? "Informe uma nota/escala" : "Informe o valor numérico"
            }
            className="bg-background max-w-xs"
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={typeof rawVal === "string" ? rawVal : ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            disabled={isReadOnly}
            className="bg-background max-w-xs"
          />
        );

      case "single_choice":
        if (options.length > 0) {
          return (
            <Select
              value={typeof rawVal === "string" ? rawVal : ""}
              onValueChange={(val) => handleAnswerChange(q.id, val)}
              disabled={isReadOnly}
            >
              <SelectTrigger className="bg-background max-w-md">
                <SelectValue placeholder="Selecione uma opção..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            value={typeof rawVal === "string" ? rawVal : ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            disabled={isReadOnly}
            placeholder="Digite a resposta..."
            className="bg-background"
          />
        );

      case "multiple_choice":
        if (options.length > 0) {
          const currentArr: string[] = Array.isArray(rawVal) ? (rawVal as string[]) : [];
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {options.map((opt) => {
                const checked = currentArr.includes(opt);
                return (
                  <div key={opt} className="flex items-center space-x-2">
                    <Checkbox
                      id={`q_${q.id}_${opt}`}
                      checked={checked}
                      disabled={isReadOnly}
                      onCheckedChange={(isCheck) => {
                        if (isCheck) {
                          handleAnswerChange(q.id, [...currentArr, opt]);
                        } else {
                          handleAnswerChange(
                            q.id,
                            currentArr.filter((item) => item !== opt),
                          );
                        }
                      }}
                    />
                    <label
                      htmlFor={`q_${q.id}_${opt}`}
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      {opt}
                    </label>
                  </div>
                );
              })}
            </div>
          );
        }
        return (
          <Input
            value={typeof rawVal === "string" ? rawVal : ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            disabled={isReadOnly}
            placeholder="Digite as opções separadas por vírgula..."
            className="bg-background"
          />
        );

      default:
        return (
          <Input
            value={typeof rawVal === "string" ? String(rawVal) : ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            disabled={isReadOnly}
            className="bg-background"
          />
        );
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="font-serif text-2xl text-sage-deep">
                    Anamnese — {clientName}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  Histórico e preenchimento de formulários de saúde e bem-estar do cliente.
                </DialogDescription>
              </div>

              {!selectedAnamnesisId && (
                <Button onClick={handleOpenNewModal} className="btn-serena gap-2 text-xs">
                  <Plus className="h-4 w-4" /> Nova Anamnese
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Se nenhuma anamnese estiver selecionada, exibir Histórico */}
          {!selectedAnamnesisId ? (
            <div className="py-4 space-y-4">
              {loadingList ? (
                <div className="h-48 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                  <span>Carregando histórico de anamneses...</span>
                </div>
              ) : anamnesesList.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-2xl bg-cream/20 p-6 text-center">
                  <ClipboardList className="h-10 w-10 text-sage-deep/40" />
                  <p className="font-medium text-sage-deep">
                    Este cliente ainda não possui anamneses registradas.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clique em &quot;Nova Anamnese&quot; para iniciar o primeiro preenchimento.
                  </p>
                  <Button onClick={handleOpenNewModal} className="btn-serena gap-2 text-xs mt-2">
                    <Plus className="h-4 w-4" /> Criar Primeira Anamnese
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-sage-deep">Histórico de Anamneses</h3>
                    <span className="text-xs text-muted-foreground">
                      {anamnesesList.length} registro(s) encontrado(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {anamnesesList.map((item) => (
                      <Card
                        key={item.id}
                        className="hover:border-sage-deep/40 transition-colors shadow-xs cursor-pointer border border-border"
                        onClick={() => void loadAnamnesisDetail(item.id)}
                      >
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-serif font-semibold text-base text-sage-deep">
                                {item.template?.name || "Anamnese"}
                              </p>
                              {item.template?.version && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  v{item.template.version}
                                </Badge>
                              )}
                              <AnamnesisStatusBadge status={item.status} />
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-sage-deep" />
                                Criada: {formatDateDisplay(item.created_at)}
                              </span>
                              {item.completed_at && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  Concluída: {formatDateDisplay(item.completed_at)}
                                </span>
                              )}
                              {item.reviewed_at && (
                                <span className="flex items-center gap-1">
                                  <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                                  Revisada: {formatDateDisplay(item.reviewed_at)}
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1 self-end sm:self-center"
                          >
                            <FileText className="h-3.5 w-3.5" /> Abrir Formulário
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Formulário / Detalhes de Anamnese Selecionada */
            <div className="py-2 space-y-4">
              <div className="flex items-center justify-between bg-cream/40 p-3 rounded-xl border border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedAnamnesisId(null);
                    setActiveDetail(null);
                  }}
                  className="gap-1.5 text-xs text-sage-deep hover:bg-blush"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar ao Histórico
                </Button>

                {activeDetail && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-sage-deep hidden sm:inline">
                      {activeDetail.template.name} (v{activeDetail.template.version})
                    </span>
                    <AnamnesisStatusBadge status={activeDetail.anamnesis.status} />
                  </div>
                )}
              </div>

              {loadingDetail ? (
                <div className="h-64 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
                  <span>Carregando perguntas e respostas...</span>
                </div>
              ) : activeDetail ? (
                <div className="space-y-6">
                  {/* Cabeçalho de informações */}
                  <Card className="border border-border/80 bg-card/60 shadow-xs">
                    <CardHeader className="py-3 px-4 bg-cream/20">
                      <CardTitle className="text-sm font-semibold text-sage-deep flex items-center justify-between">
                        <span>{activeDetail.template.name}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {activeDetail.questions.length} Pergunta(s)
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-xs space-y-2">
                      {activeDetail.template.description && (
                        <p className="text-muted-foreground italic">
                          {activeDetail.template.description}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-muted-foreground border-t border-border/60">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Criada:{" "}
                          {formatDateDisplay(activeDetail.anamnesis.created_at)}
                        </span>
                        {activeDetail.anamnesis.completed_at && (
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Concluída:{" "}
                            {formatDateDisplay(activeDetail.anamnesis.completed_at)}
                          </span>
                        )}
                        {activeDetail.anamnesis.reviewed_at && (
                          <span className="flex items-center gap-1 text-indigo-700 font-medium">
                            <UserCheck className="h-3.5 w-3.5" /> Revisada:{" "}
                            {formatDateDisplay(activeDetail.anamnesis.reviewed_at)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lista de Perguntas Dinâmicas */}
                  <div className="space-y-4">
                    {activeDetail.questions.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-6">
                        Nenhuma pergunta cadastrada para este modelo de anamnese.
                      </p>
                    ) : (
                      activeDetail.questions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="p-4 rounded-xl border border-border bg-card space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                              <span className="text-xs font-mono text-muted-foreground">
                                #{idx + 1}
                              </span>
                              <span>{q.label}</span>
                              {q.required && (
                                <span className="text-red-500 font-bold" title="Campo Obrigatório">
                                  *
                                </span>
                              )}
                            </label>

                            {q.required && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-red-200 bg-red-50 text-red-700 shrink-0"
                              >
                                Obrigatório
                              </Badge>
                            )}
                          </div>

                          <div className="pt-1">{renderQuestionField(q)}</div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Barra de Ações Rápidas do Formulário */}
                  <div className="sticky bottom-0 bg-background/95 backdrop-blur-xs p-4 rounded-xl border border-border shadow-md flex flex-wrap items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAnamnesisId(null);
                        setActiveDetail(null);
                      }}
                      className="text-xs"
                    >
                      Voltar ao Histórico
                    </Button>

                    <div className="flex items-center gap-2 flex-wrap">
                      {activeDetail.anamnesis.status === "draft" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSaveDraft}
                            disabled={submitting}
                            className="gap-1.5 text-xs border-sage-deep/30 text-sage-deep hover:bg-cream"
                          >
                            {submitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Salvar Rascunho
                          </Button>

                          <Button
                            size="sm"
                            onClick={handleCompleteAnamnesis}
                            disabled={submitting}
                            className="btn-serena gap-1.5 text-xs"
                          >
                            {submitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Concluir Anamnese
                          </Button>
                        </>
                      )}

                      {activeDetail.anamnesis.status === "completed" && (
                        <Button
                          size="sm"
                          onClick={handleReviewAnamnesis}
                          disabled={submitting}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs font-medium"
                        >
                          {submitting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5" />
                          )}
                          Marcar como Revisada
                        </Button>
                      )}

                      {(activeDetail.anamnesis.status === "reviewed" ||
                        activeDetail.anamnesis.status === "superseded") && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 italic">
                          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          Esta anamnese está em modo somente leitura.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Escolher Modelo para Nova Anamnese */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-sage-deep">Nova Anamnese</DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o modelo de anamnese ativo para o cliente <strong>{clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            {loadingTemplates ? (
              <div className="h-24 flex items-center justify-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="h-4 w-4 animate-spin text-sage-deep" />
                <span>Carregando modelos ativos...</span>
              </div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum modelo de anamnese ativo encontrado no sistema.
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Modelo de Anamnese</label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione o modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name} (v{tpl.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsNewModalOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateAnamnesis}
              disabled={submitting || !selectedTemplateId}
              className="btn-serena gap-2 text-xs"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Iniciar Preenchimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AdminClientAnamnesis;
