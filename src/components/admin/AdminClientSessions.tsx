import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  UserX,
  Clock,
  Calendar,
  FileText,
  MessageSquare,
  AlertTriangle,
  ChevronLeft,
  Activity,
  CornerDownRight,
} from "lucide-react";
import { toast } from "sonner";

import {
  listClientSessionsFn,
  getClientSessionFn,
  createClientSessionFn,
  updateClientSessionFn,
  listSessionNotesFn,
  createSessionNoteFn,
} from "@/lib/client-sessions.functions";

import type {
  ClientSessionWithDetails,
  SessionNoteRow,
} from "@/lib/client-sessions.repository";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

function formatDateInput(dateStr?: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  return localISOTime;
}

function SessionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "scheduled":
      return (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-50 text-amber-700 font-medium">
          Agendada
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-sky-600 hover:bg-sky-700 text-white font-medium animate-pulse">
          Em Atendimento
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
          Concluída
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 font-medium border-red-200">
          Cancelada
        </Badge>
      );
    case "no_show":
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-medium">
          Não Compareceu
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function NoteTypeBadge({ type }: { type: string }) {
  switch (type) {
    case "observation":
      return (
        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700 text-[10px]">
          Observação
        </Badge>
      );
    case "evolution":
      return (
        <Badge className="bg-emerald-600 text-white text-[10px]">
          Evolução
        </Badge>
      );
    case "recommendation":
      return (
        <Badge className="bg-indigo-600 text-white text-[10px]">
          Recomendação
        </Badge>
      );
    case "correction":
      return (
        <Badge className="bg-amber-600 text-white text-[10px]">
          Correção
        </Badge>
      );
    case "administrative":
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px]">
          Administrativa
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
  }
}

interface AdminClientSessionsProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminClientSessions({
  clientId,
  clientName,
  isOpen,
  onOpenChange,
}: AdminClientSessionsProps) {
  // Server Functions
  const fetchClientSessions = useServerFn(listClientSessionsFn);
  const fetchSessionDetail = useServerFn(getClientSessionFn);
  const executeCreateSession = useServerFn(createClientSessionFn);
  const executeUpdateSession = useServerFn(updateClientSessionFn);
  const fetchSessionNotes = useServerFn(listSessionNotesFn);
  const executeCreateNote = useServerFn(createSessionNoteFn);

  // Estados de navegação interna e lista
  const [sessionsList, setSessionsList] = useState<ClientSessionWithDetails[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Detalhe da sessão selecionada
  const [activeSession, setActiveSession] = useState<ClientSessionWithDetails | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Notas da sessão
  const [notesList, setNotesList] = useState<SessionNoteRow[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Modais de ações
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [isNoShowAlertOpen, setIsNoShowAlertOpen] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  // Formulário Nova Sessão
  const [newSessionData, setNewSessionData] = useState({
    session_started_at: "",
    duration_minutes: "",
    status: "scheduled",
  });

  // Formulário Conclusão de Sessão
  const [completeFormData, setCompleteFormData] = useState({
    client_report: "",
    professional_summary: "",
    recommendations: "",
    duration_minutes: "",
    session_ended_at: "",
  });

  // Formulário Nova Nota
  const [newNoteData, setNewNoteData] = useState({
    note_type: "evolution",
    content: "",
  });

  // Formulário Correção de Nota
  const [targetNoteToCorrect, setTargetNoteToCorrect] = useState<SessionNoteRow | null>(null);
  const [correctionContent, setCorrectionContent] = useState("");

  // Estado global de submissão
  const [submitting, setSubmitting] = useState(false);

  // Carregar histórico de sessões do cliente
  const loadSessions = useCallback(async () => {
    if (!clientId) return;
    setLoadingList(true);
    try {
      const list = await fetchClientSessions({ data: { clientId } });
      setSessionsList(list);
    } catch {
      toast.error("Erro ao carregar histórico de sessões do cliente.");
    } finally {
      setLoadingList(false);
    }
  }, [clientId, fetchClientSessions]);

  // Limpeza de estado e carga inicial ao abrir ou trocar de cliente
  useEffect(() => {
    if (isOpen && clientId) {
      void loadSessions();
      setSelectedSessionId(null);
      setActiveSession(null);
      setNotesList([]);
      setIsNewModalOpen(false);
      setIsCompleteModalOpen(false);
      setIsCancelAlertOpen(false);
      setIsNoShowAlertOpen(false);
      setIsAddNoteModalOpen(false);
      setIsCorrectionModalOpen(false);
    }
  }, [isOpen, clientId, loadSessions]);

  // Carregar notas da sessão
  const loadNotes = useCallback(
    async (sessionId: string) => {
      setLoadingNotes(true);
      try {
        const notes = await fetchSessionNotes({ data: { sessionId } });
        setNotesList(notes);
      } catch {
        toast.error("Erro ao carregar notas de evolução.");
      } finally {
        setLoadingNotes(false);
      }
    },
    [fetchSessionNotes]
  );

  // Carregar detalhes completos de uma sessão
  const loadSessionDetail = useCallback(
    async (sessionId: string) => {
      setLoadingDetail(true);
      try {
        const session = await fetchSessionDetail({ data: { sessionId } });
        setActiveSession(session);
        setSelectedSessionId(sessionId);
        void loadNotes(sessionId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar sessão.";
        toast.error(msg);
      } finally {
        setLoadingDetail(false);
      }
    },
    [fetchSessionDetail, loadNotes]
  );

  // Abrir modal Nova Sessão
  const handleOpenNewModal = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);

    setNewSessionData({
      session_started_at: localISOTime,
      duration_minutes: "60",
      status: "scheduled",
    });
    setIsNewModalOpen(true);
  };

  // Submeter Nova Sessão (Backend define status inicial "scheduled")
  const handleCreateSession = async () => {
    setSubmitting(true);
    try {
      const dur = newSessionData.duration_minutes ? Number(newSessionData.duration_minutes) : null;
      const startedAt = newSessionData.session_started_at
        ? new Date(newSessionData.session_started_at).toISOString()
        : new Date().toISOString();

      await executeCreateSession({
        data: {
          clientId,
          session_started_at: startedAt,
          duration_minutes: dur,
        },
      });

      toast.success("Sessão clínica agendada com sucesso!");
      setIsNewModalOpen(false);
      void loadSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar sessão clínica.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Iniciar Atendimento (scheduled -> in_progress)
  const handleStartSession = async (session: ClientSessionWithDetails) => {
    setSubmitting(true);
    try {
      await executeUpdateSession({
        data: {
          sessionId: session.id,
          status: "in_progress",
        },
      });
      toast.success("Atendimento iniciado!");
      await loadSessions();
      if (selectedSessionId === session.id) {
        await loadSessionDetail(session.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar atendimento.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de Conclusão de Atendimento
  const handleOpenCompleteModal = (session: ClientSessionWithDetails) => {
    setActiveSession(session);
    setSelectedSessionId(session.id);

    const now = new Date();
    const endedAtStr = session.session_ended_at
      ? formatDateInput(session.session_ended_at)
      : formatDateInput(now.toISOString());

    setCompleteFormData({
      client_report: session.client_report || "",
      professional_summary: session.professional_summary || "",
      recommendations: session.recommendations || "",
      duration_minutes: session.duration_minutes ? String(session.duration_minutes) : "60",
      session_ended_at: endedAtStr,
    });
    setIsCompleteModalOpen(true);
  };

  // Submeter Conclusão de Atendimento
  const handleSubmitComplete = async () => {
    if (!activeSession) return;

    const dur = completeFormData.duration_minutes ? Number(completeFormData.duration_minutes) : null;
    const endedAt = completeFormData.session_ended_at
      ? new Date(completeFormData.session_ended_at).toISOString()
      : new Date().toISOString();

    const startedAt = activeSession.session_started_at;
    if (startedAt && endedAt) {
      const startTime = Date.parse(startedAt);
      const endTime = Date.parse(endedAt);
      if (!isNaN(startTime) && !isNaN(endTime) && endTime < startTime) {
        toast.error("A data de término da sessão não pode ser anterior à data de início.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await executeUpdateSession({
        data: {
          sessionId: activeSession.id,
          status: "completed",
          client_report: completeFormData.client_report || null,
          professional_summary: completeFormData.professional_summary || null,
          recommendations: completeFormData.recommendations || null,
          duration_minutes: dur,
          session_ended_at: endedAt,
        },
      });

      toast.success("Atendimento concluído com sucesso!");
      setIsCompleteModalOpen(false);
      await loadSessions();
      await loadSessionDetail(activeSession.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao concluir atendimento.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmar Cancelamento
  const handleConfirmCancel = async () => {
    if (!activeSession) return;
    setSubmitting(true);
    try {
      await executeUpdateSession({
        data: {
          sessionId: activeSession.id,
          status: "cancelled",
        },
      });
      toast.success("Sessão cancelada.");
      setIsCancelAlertOpen(false);
      await loadSessions();
      await loadSessionDetail(activeSession.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cancelar sessão.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmar No-Show
  const handleConfirmNoShow = async () => {
    if (!activeSession) return;
    setSubmitting(true);
    try {
      await executeUpdateSession({
        data: {
          sessionId: activeSession.id,
          status: "no_show",
        },
      });
      toast.success("Não comparecimento registrado.");
      setIsNoShowAlertOpen(false);
      await loadSessions();
      await loadSessionDetail(activeSession.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar não comparecimento.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submeter Nova Nota de Evolução
  const handleCreateNote = async () => {
    if (!selectedSessionId) return;
    if (!newNoteData.content.trim()) {
      toast.error("Informe o conteúdo da nota.");
      return;
    }
    setSubmitting(true);
    try {
      await executeCreateNote({
        data: {
          sessionId: selectedSessionId,
          note_type: newNoteData.note_type,
          content: newNoteData.content.trim(),
        },
      });

      toast.success("Nota de evolução adicionada!");
      setIsAddNoteModalOpen(false);
      setNewNoteData({ note_type: "evolution", content: "" });
      void loadNotes(selectedSessionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao adicionar nota.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de Correção de Nota
  const handleOpenCorrectionModal = (note: SessionNoteRow) => {
    setTargetNoteToCorrect(note);
    setCorrectionContent("");
    setIsCorrectionModalOpen(true);
  };

  // Submeter Correção de Nota
  const handleSubmitCorrection = async () => {
    if (!selectedSessionId || !targetNoteToCorrect) return;
    if (!correctionContent.trim()) {
      toast.error("Informe o conteúdo da correção.");
      return;
    }
    setSubmitting(true);
    try {
      await executeCreateNote({
        data: {
          sessionId: selectedSessionId,
          note_type: "correction",
          content: correctionContent.trim(),
          supersedes_note_id: targetNoteToCorrect.id,
        },
      });

      toast.success("Nota de correção adicionada!");
      setIsCorrectionModalOpen(false);
      setTargetNoteToCorrect(null);
      setCorrectionContent("");
      void loadNotes(selectedSessionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao adicionar correção.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="font-serif text-2xl text-sage-deep">
                  Atendimentos — {clientName}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Histórico de sessões clínicas, relatórios e notas de evolução do cliente.
                </DialogDescription>
              </div>

              {!selectedSessionId && (
                <Button onClick={handleOpenNewModal} className="btn-serena gap-2 text-xs">
                  <Plus className="h-4 w-4" /> Nova Sessão
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Histórico / Timeline de Sessões */}
          {!selectedSessionId ? (
            <div className="py-4 space-y-4">
              {loadingList ? (
                <div className="h-48 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                  <span>Carregando histórico de atendimentos...</span>
                </div>
              ) : sessionsList.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-2xl bg-cream/20 p-6 text-center">
                  <Activity className="h-10 w-10 text-sage-deep/40" />
                  <p className="font-medium text-sage-deep">
                    Este cliente ainda não possui sessões registradas.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clique em &quot;Nova Sessão&quot; para registrar o primeiro atendimento.
                  </p>
                  <Button onClick={handleOpenNewModal} className="btn-serena gap-2 text-xs mt-2">
                    <Plus className="h-4 w-4" /> Criar Primeira Sessão
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-sage-deep">Timeline de Atendimentos</h3>
                    <span className="text-xs text-muted-foreground">
                      {sessionsList.length} sessão(ões) registrada(s)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {sessionsList.map((session) => (
                      <Card
                        key={session.id}
                        className="hover:border-sage-deep/40 transition-colors shadow-xs border border-border"
                      >
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div
                            className="space-y-1.5 cursor-pointer flex-1"
                            onClick={() => void loadSessionDetail(session.id)}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-serif font-semibold text-base text-sage-deep">
                                {session.service?.name || "Atendimento Clínico"}
                              </span>
                              <SessionStatusBadge status={session.status} />
                              {session.duration_minutes && (
                                <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {session.duration_minutes} min
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-sage-deep" />
                                Início: {formatDateDisplay(session.session_started_at)}
                              </span>
                              {session.session_ended_at && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  Término: {formatDateDisplay(session.session_ended_at)}
                                </span>
                              )}
                            </div>

                            {session.professional_summary && (
                              <p className="text-xs text-muted-foreground line-clamp-2 italic pt-1">
                                &quot;{session.professional_summary}&quot;
                              </p>
                            )}
                          </div>

                          {/* Ações por Status */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {session.status === "scheduled" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleStartSession(session)}
                                  disabled={submitting}
                                  className="text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                                >
                                  {submitting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Play className="h-3.5 w-3.5" />
                                  )}
                                  Iniciar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenCompleteModal(session)}
                                  className="btn-serena text-xs gap-1"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                                </Button>
                              </>
                            )}

                            {session.status === "in_progress" && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenCompleteModal(session)}
                                className="btn-serena text-xs gap-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Concluir Atendimento
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void loadSessionDetail(session.id)}
                              className="text-xs gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" /> Ver Detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Detalhe da Sessão Selecionada */
            <div className="py-2 space-y-4">
              <div className="flex items-center justify-between bg-cream/40 p-3 rounded-xl border border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSessionId(null);
                    setActiveSession(null);
                    setNotesList([]);
                  }}
                  className="gap-1.5 text-xs text-sage-deep hover:bg-blush"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar ao Histórico
                </Button>

                {activeSession && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-sage-deep hidden sm:inline">
                      {activeSession.service?.name || "Atendimento"}
                    </span>
                    <SessionStatusBadge status={activeSession.status} />
                  </div>
                )}
              </div>

              {loadingDetail ? (
                <div className="h-64 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
                  <span>Carregando detalhes da sessão...</span>
                </div>
              ) : activeSession ? (
                <div className="space-y-6">
                  {/* Cartão de Informações Principais */}
                  <Card className="border border-border/80 bg-card/60 shadow-xs">
                    <CardHeader className="py-3 px-4 bg-cream/20 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-sage-deep">
                        Resumo do Atendimento
                      </CardTitle>
                      {activeSession.duration_minutes && (
                        <span className="text-xs text-muted-foreground font-mono">
                          Duração: {activeSession.duration_minutes} min
                        </span>
                      )}
                    </CardHeader>

                    <CardContent className="p-4 text-xs space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-sage-deep" />
                          Início: {formatDateDisplay(activeSession.session_started_at)}
                        </span>
                        {activeSession.session_ended_at && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Término: {formatDateDisplay(activeSession.session_ended_at)}
                          </span>
                        )}
                      </div>

                      {activeSession.client_report && (
                        <div className="p-3 rounded-xl border border-border bg-background space-y-1">
                          <span className="font-semibold text-sage-deep flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" /> Relato do Cliente
                          </span>
                          <p className="text-foreground whitespace-pre-wrap">{activeSession.client_report}</p>
                        </div>
                      )}

                      {activeSession.professional_summary && (
                        <div className="p-3 rounded-xl border border-border bg-background space-y-1">
                          <span className="font-semibold text-sage-deep flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" /> Resumo Profissional
                          </span>
                          <p className="text-foreground whitespace-pre-wrap">{activeSession.professional_summary}</p>
                        </div>
                      )}

                      {activeSession.recommendations && (
                        <div className="p-3 rounded-xl border border-border bg-background space-y-1">
                          <span className="font-semibold text-sage-deep flex items-center gap-1">
                            <Activity className="h-3.5 w-3.5" /> Recomendações
                          </span>
                          <p className="text-foreground whitespace-pre-wrap">{activeSession.recommendations}</p>
                        </div>
                      )}

                      {/* Botões de Ações de Transição */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                        {activeSession.status === "scheduled" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleStartSession(activeSession)}
                              disabled={submitting}
                              className="text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                            >
                              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Iniciar Atendimento
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleOpenCompleteModal(activeSession)}
                              className="btn-serena text-xs gap-1"
                            >
                              Concluir Atendimento
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsCancelAlertOpen(true)}
                              className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Cancelar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsNoShowAlertOpen(true)}
                              className="text-xs text-slate-700 border-slate-300 hover:bg-slate-100"
                            >
                              Não Compareceu
                            </Button>
                          </>
                        )}

                        {activeSession.status === "in_progress" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleOpenCompleteModal(activeSession)}
                              className="btn-serena text-xs gap-1"
                            >
                              Concluir Atendimento
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsCancelAlertOpen(true)}
                              className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Seção Notas de Evolução (Append-Only) */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-sage-deep">Notas de Evolução</h4>
                        <Badge variant="outline" className="text-[10px]">
                          Append-Only
                        </Badge>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setIsAddNoteModalOpen(true)}
                        className="btn-serena gap-1 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar Nota
                      </Button>
                    </div>

                    {loadingNotes ? (
                      <div className="h-32 flex items-center justify-center gap-2 text-muted-foreground text-xs">
                        <Loader2 className="h-4 w-4 animate-spin text-sage-deep" />
                        <span>Carregando notas da sessão...</span>
                      </div>
                    ) : notesList.length === 0 ? (
                      <div className="p-6 border border-dashed border-border rounded-xl bg-cream/10 text-center space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Esta sessão ainda não possui notas de evolução.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {notesList.map((note) => (
                          <div
                            key={note.id}
                            className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                              note.note_type === "correction"
                                ? "bg-amber-50/50 border-amber-200"
                                : "bg-card border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <NoteTypeBadge type={note.note_type} />
                                {note.supersedes_note_id && (
                                  <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                                    <CornerDownRight className="h-3 w-3" /> Correção de nota anterior
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span>{formatDateDisplay(note.created_at)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenCorrectionModal(note)}
                                  className="h-6 px-2 text-[10px] text-sage-deep hover:bg-blush"
                                >
                                  Corrigir
                                </Button>
                              </div>
                            </div>

                            <p className="text-foreground whitespace-pre-wrap pt-0.5">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
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

      {/* Modal: Nova Sessão */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-sage-deep">
              Nova Sessão Clínica
            </DialogTitle>
            <DialogDescription className="text-xs">
              Agende ou registre um novo atendimento para <strong>{clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Data e Hora de Início *</label>
              <Input
                type="datetime-local"
                value={newSessionData.session_started_at}
                onChange={(e) =>
                  setNewSessionData((prev) => ({ ...prev, session_started_at: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Duração Estimada (minutos)</label>
              <Input
                type="number"
                placeholder="Ex: 60"
                value={newSessionData.duration_minutes}
                onChange={(e) =>
                  setNewSessionData((prev) => ({ ...prev, duration_minutes: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSession} disabled={submitting} className="btn-serena text-xs gap-1.5">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Criar Sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Concluir Atendimento */}
      <Dialog open={isCompleteModalOpen} onOpenChange={setIsCompleteModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-sage-deep">
              Concluir Atendimento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha o resumo e observações finais do atendimento de <strong>{clientName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Data/Hora Término</label>
                <Input
                  type="datetime-local"
                  value={completeFormData.session_ended_at}
                  onChange={(e) =>
                    setCompleteFormData((prev) => ({ ...prev, session_ended_at: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Duração Real (minutos)</label>
                <Input
                  type="number"
                  placeholder="Ex: 60"
                  value={completeFormData.duration_minutes}
                  onChange={(e) =>
                    setCompleteFormData((prev) => ({ ...prev, duration_minutes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Relato do Cliente (Opcional)</label>
              <Textarea
                rows={3}
                placeholder="Principais queixas ou relatos informados pelo cliente..."
                value={completeFormData.client_report}
                onChange={(e) =>
                  setCompleteFormData((prev) => ({ ...prev, client_report: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Resumo Profissional (Opcional)</label>
              <Textarea
                rows={3}
                placeholder="Resumo técnico do atendimento e procedimentos realizados..."
                value={completeFormData.professional_summary}
                onChange={(e) =>
                  setCompleteFormData((prev) => ({ ...prev, professional_summary: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Recomendações e Orientações (Opcional)</label>
              <Textarea
                rows={3}
                placeholder="Orientações pós-atendimento e recomendações para o cliente..."
                value={completeFormData.recommendations}
                onChange={(e) =>
                  setCompleteFormData((prev) => ({ ...prev, recommendations: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCompleteModalOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitComplete}
              disabled={submitting}
              className="btn-serena text-xs gap-1.5"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Finalizar e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Nota de Evolução */}
      <Dialog open={isAddNoteModalOpen} onOpenChange={setIsAddNoteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-sage-deep">
              Adicionar Nota de Evolução
            </DialogTitle>
            <DialogDescription className="text-xs">
              Insira um novo registro (append-only) na sessão clínica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Tipo de Nota *</label>
              <Select
                value={newNoteData.note_type}
                onValueChange={(val) => setNewNoteData((prev) => ({ ...prev, note_type: val }))}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="observation">Observação</SelectItem>
                  <SelectItem value="evolution">Evolução</SelectItem>
                  <SelectItem value="recommendation">Recomendação</SelectItem>
                  <SelectItem value="administrative">Administrativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Conteúdo da Nota *</label>
              <Textarea
                rows={4}
                placeholder="Digite os detalhes da anotação..."
                value={newNoteData.content}
                onChange={(e) => setNewNoteData((prev) => ({ ...prev, content: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsAddNoteModalOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={submitting || !newNoteData.content.trim()}
              className="btn-serena text-xs gap-1.5"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Corrigir Nota de Evolução */}
      <Dialog open={isCorrectionModalOpen} onOpenChange={setIsCorrectionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-sage-deep">
              Corrigir Nota de Evolução
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione uma nota de correção sem alterar o registro original.
            </DialogDescription>
          </DialogHeader>

          {targetNoteToCorrect && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 border border-border rounded-xl bg-muted/40 space-y-1">
                <span className="font-semibold text-muted-foreground flex items-center gap-1 text-[11px]">
                  Conteúdo Anterior (Original)
                </span>
                <p className="text-muted-foreground italic whitespace-pre-wrap">
                  {targetNoteToCorrect.content}
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Nova Correção *</label>
                <Textarea
                  rows={4}
                  placeholder="Digite a retificação ou complemento da nota anterior..."
                  value={correctionContent}
                  onChange={(e) => setCorrectionContent(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCorrectionModalOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitCorrection}
              disabled={submitting || !correctionContent.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar Correção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmação de Cancelamento */}
      <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl text-sage-deep">
              Cancelar Sessão?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta ação marcará a sessão clínica como cancelada. O histórico da sessão será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Confirmação de No-Show */}
      <AlertDialog open={isNoShowAlertOpen} onOpenChange={setIsNoShowAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl text-sage-deep">
              Marcar Não Comparecimento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Confirmar que o cliente não compareceu ao atendimento agendado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmNoShow}
              disabled={submitting}
              className="bg-slate-700 text-white hover:bg-slate-800 text-xs"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Confirmar Não Comparecimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default AdminClientSessions;
