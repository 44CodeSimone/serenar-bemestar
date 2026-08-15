import { useEffect, useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ClipboardList,
  Activity,
  Calendar,
  User,
  Clock,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import { listClientAnamnesesFn } from "@/lib/anamnesis.functions";
import { listClientSessionsFn } from "@/lib/client-sessions.functions";
import { getClientByIdFn } from "@/lib/clients.functions";

import type { ClientRecord } from "@/lib/clients.repository";
import type { ClientAnamnesisWithTemplate } from "@/lib/anamnesis.repository";
import type { ClientSessionWithDetails } from "@/lib/client-sessions.repository";

import { Button } from "@/components/ui/button";
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

// Helpers de Formatação
function formatCpf(cpf?: string | null): string {
  if (!cpf) return "Não informado";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatPhone(phone?: string | null): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTimeDisplay(dateStr?: string | null): string {
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

function formatSourceLabel(source?: string | null): string {
  if (!source) return "Painel Admin";
  switch (source) {
    case "admin":
      return "Painel Admin";
    case "website":
      return "Site";
    case "whatsapp":
      return "WhatsApp";
    case "lead_conversion":
      return "Conversão de Lead";
    default:
      return source;
  }
}

function ClientStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "registered":
      return (
        <Badge
          variant="outline"
          className="border-sage-deep/30 bg-sage-deep/10 text-sage-deep font-medium"
        >
          Registrado
        </Badge>
      );
    case "active":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Ativo</Badge>
      );
    case "inactive":
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-medium">
          Inativo
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="destructive" className="bg-slate-200 text-slate-700 font-medium">
          Arquivado
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function AnamnesisStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-50 text-amber-700 text-[10px]"
        >
          Rascunho
        </Badge>
      );
    case "completed":
      return <Badge className="bg-emerald-600 text-white text-[10px]">Concluída</Badge>;
    case "reviewed":
      return <Badge className="bg-indigo-600 text-white text-[10px]">Revisada</Badge>;
    case "superseded":
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-[10px]">
          Substituída
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          {status}
        </Badge>
      );
  }
}

function SessionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "scheduled":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-50 text-amber-700 text-[10px]"
        >
          Agendada
        </Badge>
      );
    case "in_progress":
      return <Badge className="bg-sky-600 text-white text-[10px]">Em Atendimento</Badge>;
    case "completed":
      return <Badge className="bg-emerald-600 text-white text-[10px]">Concluída</Badge>;
    case "cancelled":
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800 text-[10px] border-red-200">
          Cancelada
        </Badge>
      );
    case "no_show":
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-[10px]">
          Não Compareceu
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          {status}
        </Badge>
      );
  }
}

interface TimelineEvent {
  id: string;
  type: "anamnesis" | "session";
  title: string;
  subtitle?: string;
  status: string;
  timestamp: string;
  dateStr: string;
}

export interface AdminClientDashboardProps {
  clientId?: string;
  clientName?: string;
  client?: ClientRecord;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAnamnesis: () => void;
  onOpenSessions: () => void;
}

export function AdminClientDashboard({
  clientId,
  clientName,
  client,
  isOpen,
  onOpenChange,
  onOpenAnamnesis,
  onOpenSessions,
}: AdminClientDashboardProps) {
  const targetClientId = client?.id || clientId;
  const initialName = client?.full_name || clientName || "Cliente";

  // Server Functions
  const fetchClientById = useServerFn(getClientByIdFn);
  const fetchAnamneses = useServerFn(listClientAnamnesesFn);
  const fetchSessions = useServerFn(listClientSessionsFn);

  // Estados de dados
  const [clientRecord, setClientRecord] = useState<ClientRecord | null>(client || null);
  const [anamneses, setAnamneses] = useState<ClientAnamnesisWithTemplate[]>([]);
  const [sessions, setSessions] = useState<ClientSessionWithDetails[]>([]);

  // Estados de carregamento independentes por bloco
  const [loadingClient, setLoadingClient] = useState(false);
  const [loadingAnamneses, setLoadingAnamneses] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Reset imediato ao trocar de cliente ou fechar modal
  useEffect(() => {
    if (!isOpen) {
      setAnamneses([]);
      setSessions([]);
      setClientRecord(null);
      return;
    }

    // Se mudou o clientId, limpa dados anteriores imediatamente
    setAnamneses([]);
    setSessions([]);
    setClientRecord(client || null);

    if (!targetClientId) return;

    // Se não veio o objeto client completo ou se precisamos reidratar
    if (!client) {
      setLoadingClient(true);
      void fetchClientById({ data: { id: targetClientId } })
        .then((res) => {
          if (res) setClientRecord(res);
        })
        .catch(() => {
          toast.error("Erro ao carregar dados cadastrais do cliente.");
        })
        .finally(() => {
          setLoadingClient(false);
        });
    }

    // Carregar Anamneses
    setLoadingAnamneses(true);
    void fetchAnamneses({ data: { clientId: targetClientId } })
      .then((data) => setAnamneses(data))
      .catch(() => toast.error("Erro ao carregar anamneses do cliente."))
      .finally(() => setLoadingAnamneses(false));

    // Carregar Sessões
    setLoadingSessions(true);
    void fetchSessions({ data: { clientId: targetClientId } })
      .then((data) => setSessions(data))
      .catch(() => toast.error("Erro ao carregar atendimentos do cliente."))
      .finally(() => setLoadingSessions(false));
  }, [isOpen, targetClientId, client, fetchClientById, fetchAnamneses, fetchSessions]);

  // Derivações de Última Anamnese e Última Sessão
  const latestAnamnesis = useMemo(() => {
    return anamneses.length > 0 ? anamneses[0] : null;
  }, [anamneses]);

  const latestSession = useMemo(() => {
    return sessions.length > 0 ? sessions[0] : null;
  }, [sessions]);

  // Data da última atividade consolidada
  const lastActivityDate = useMemo(() => {
    const dates: number[] = [];
    if (latestAnamnesis?.created_at) dates.push(Date.parse(latestAnamnesis.created_at));
    if (latestSession?.session_started_at) dates.push(Date.parse(latestSession.session_started_at));

    if (dates.length === 0) return null;
    const maxTs = Math.max(...dates);
    return isNaN(maxTs) ? null : new Date(maxTs).toISOString();
  }, [latestAnamnesis, latestSession]);

  // Timeline consolidada ordenada por timestamp decrescente (Sem notas clínicas completas)
  const consolidatedTimeline = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    // Eventos de Anamnese (criada, concluída, revisada)
    anamneses.forEach((an) => {
      const templateName = an.template?.name || "Anamnese";
      const versionStr = an.template?.version ? ` (v${an.template.version})` : "";

      events.push({
        id: `an_created_${an.id}`,
        type: "anamnesis",
        title: `Anamnese Criada: ${templateName}`,
        subtitle: `Versão${versionStr}`,
        status: "draft",
        timestamp: an.created_at,
        dateStr: formatDateTimeDisplay(an.created_at),
      });

      if (an.completed_at) {
        events.push({
          id: `an_completed_${an.id}`,
          type: "anamnesis",
          title: `Anamnese Concluída: ${templateName}`,
          subtitle: `Formulário finalizado`,
          status: "completed",
          timestamp: an.completed_at,
          dateStr: formatDateTimeDisplay(an.completed_at),
        });
      }

      if (an.reviewed_at) {
        events.push({
          id: `an_reviewed_${an.id}`,
          type: "anamnesis",
          title: `Anamnese Revisada: ${templateName}`,
          subtitle: `Revisão clínica efetuada`,
          status: "reviewed",
          timestamp: an.reviewed_at,
          dateStr: formatDateTimeDisplay(an.reviewed_at),
        });
      }
    });

    // Eventos de Sessões (agendada, em atendimento, concluída, cancelada, no-show)
    sessions.forEach((se) => {
      const serviceName = se.service?.name || "Atendimento Clínico";
      const durationStr = se.duration_minutes ? `${se.duration_minutes} min` : undefined;

      let eventTitle = `Sessão Registrada: ${serviceName}`;
      if (se.status === "scheduled") eventTitle = `Sessão Agendada: ${serviceName}`;
      else if (se.status === "in_progress") eventTitle = `Atendimento em Andamento: ${serviceName}`;
      else if (se.status === "completed") eventTitle = `Sessão Concluída: ${serviceName}`;
      else if (se.status === "cancelled") eventTitle = `Sessão Cancelada: ${serviceName}`;
      else if (se.status === "no_show") eventTitle = `Não Compareceu (No-show): ${serviceName}`;

      events.push({
        id: `se_${se.id}`,
        type: "session",
        title: eventTitle,
        subtitle: durationStr,
        status: se.status,
        timestamp: se.session_ended_at || se.session_started_at,
        dateStr: formatDateTimeDisplay(se.session_started_at),
      });
    });

    return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [anamneses, sessions]);

  const activeName = clientRecord?.full_name || initialName;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-6">
        {/* Cabeçalho */}
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="font-serif text-2xl text-sage-deep">
                  Ficha do Cliente — {activeName}
                </DialogTitle>
                {clientRecord?.status && <ClientStatusBadge status={clientRecord.status} />}
              </div>
              <DialogDescription className="text-xs">
                Visão consolidada com resumo cadastral, métricas clínicas e linha do tempo
                operacional.
              </DialogDescription>
            </div>

            {/* Ações Rápidas do Cabeçalho */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onOpenAnamnesis();
                }}
                className="btn-serena text-xs gap-1.5"
              >
                <ClipboardList className="h-4 w-4" /> Ver Anamneses
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onOpenSessions();
                }}
                variant="outline"
                className="text-xs gap-1.5 border-sage-deep/30 text-sage-deep hover:bg-cream"
              >
                <Activity className="h-4 w-4" /> Ver Atendimentos
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Seção 1: Resumo Cadastral */}
          <Card className="border border-border bg-cream/30 shadow-xs">
            <CardHeader className="py-3 px-4 bg-cream/50">
              <CardTitle className="text-sm font-serif font-semibold text-sage-deep flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-sage-deep" /> Resumo Cadastral
                </span>
                <span className="text-xs font-sans font-normal text-muted-foreground">
                  Origem: {formatSourceLabel(clientRecord?.source)}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4">
              {loadingClient ? (
                <div className="h-20 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-sage-deep" />
                  <span>Carregando dados cadastrais...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-sage-deep" /> Nome Completo
                    </span>
                    <p className="font-semibold text-sage-deep text-sm">{activeName}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-sage-deep" /> CPF
                    </span>
                    <p className="font-mono text-foreground font-medium">
                      {clientRecord?.cpf ? formatCpf(clientRecord.cpf) : "Não informado"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-sage-deep" /> Nascimento
                    </span>
                    <p className="text-foreground font-medium">
                      {formatDateDisplay(clientRecord?.birth_date)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-sage-deep" /> Telefone
                    </span>
                    <p className="text-foreground font-medium">
                      {clientRecord?.phone ? formatPhone(clientRecord.phone) : "-"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-sage-deep" /> WhatsApp
                    </span>
                    <p className="text-foreground font-medium">
                      {clientRecord?.whatsapp
                        ? formatPhone(clientRecord.whatsapp)
                        : "Não informado"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-sage-deep" /> E-mail
                    </span>
                    <p className="text-foreground font-medium truncate">
                      {clientRecord?.email || "Não informado"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-sage-deep" /> Cidade
                    </span>
                    <p className="text-foreground font-medium">
                      {clientRecord?.city || "Não informada"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5 text-sage-deep" /> Profissão
                    </span>
                    <p className="text-foreground font-medium">
                      {clientRecord?.profession || "Não informada"}
                    </p>
                  </div>

                  {clientRecord?.notes && (
                    <div className="sm:col-span-2 md:col-span-4 pt-2 border-t border-border/60">
                      <span className="text-muted-foreground font-medium">
                        Observações Internas:
                      </span>
                      <p className="text-foreground italic mt-0.5 whitespace-pre-wrap">
                        {clientRecord.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seção 2: Cards Principais de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Anamneses */}
            <Card className="border border-border shadow-xs hover:border-sage-deep/40 transition-colors">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Total de Anamneses
                </CardTitle>
                <ClipboardList className="h-4 w-4 text-sage-deep" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {loadingAnamneses ? (
                  <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                ) : (
                  <div className="text-2xl font-serif font-bold text-sage-deep">
                    {anamneses.length}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground pt-1">Formulários cadastrados</p>
              </CardContent>
            </Card>

            {/* Card 2: Última Anamnese */}
            <Card className="border border-border shadow-xs hover:border-sage-deep/40 transition-colors">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Última Anamnese
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {loadingAnamneses ? (
                  <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                ) : latestAnamnesis ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate max-w-[120px]">
                        {latestAnamnesis.template?.name || "Anamnese"}
                      </span>
                      {latestAnamnesis.template?.version && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          v{latestAnamnesis.template.version}
                        </span>
                      )}
                      <AnamnesisStatusBadge status={latestAnamnesis.status} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Data: {formatDateDisplay(latestAnamnesis.created_at)}
                    </p>
                    {latestAnamnesis.reviewed_at && (
                      <p className="text-[10px] text-indigo-700 font-medium">
                        Revisada em: {formatDateDisplay(latestAnamnesis.reviewed_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-1">Nenhum registro</p>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Total de Sessões */}
            <Card className="border border-border shadow-xs hover:border-sage-deep/40 transition-colors">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Total de Sessões
                </CardTitle>
                <Activity className="h-4 w-4 text-sage-deep" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {loadingSessions ? (
                  <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                ) : (
                  <div className="text-2xl font-serif font-bold text-sage-deep">
                    {sessions.length}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground pt-1">Atendimentos registrados</p>
              </CardContent>
            </Card>

            {/* Card 4: Último Atendimento */}
            <Card className="border border-border shadow-xs hover:border-sage-deep/40 transition-colors">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Último Atendimento
                </CardTitle>
                <Clock className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {loadingSessions ? (
                  <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                ) : latestSession ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate max-w-[120px]">
                        {latestSession.service?.name || "Atendimento"}
                      </span>
                      <SessionStatusBadge status={latestSession.status} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTimeDisplay(latestSession.session_started_at)}
                    </p>
                    {latestSession.duration_minutes && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Duração: {latestSession.duration_minutes} min
                      </p>
                    )}
                    {latestSession.professional_summary && (
                      <p className="text-[10px] text-foreground/80 italic line-clamp-1">
                        &quot;{latestSession.professional_summary}&quot;
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-1">Nenhum registro</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Seção 3: Status Clínico Resumido & Timeline Consolidada */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bloco Status Clínico Resumido */}
            <Card className="md:col-span-1 border border-border bg-card shadow-xs">
              <CardHeader className="py-3 px-4 bg-cream/20">
                <CardTitle className="text-xs font-semibold text-sage-deep flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Status Clínico Resumido
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Possui Anamnese?</span>
                  {loadingAnamneses ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-sage-deep" />
                  ) : anamneses.length > 0 ? (
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      Sim ({anamneses.length})
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-300 text-amber-700 bg-amber-50"
                    >
                      Não
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Possui Atendimento?</span>
                  {loadingSessions ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-sage-deep" />
                  ) : sessions.length > 0 ? (
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      Sim ({sessions.length})
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-300 text-amber-700 bg-amber-50"
                    >
                      Não
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground">Última Atividade:</span>
                  <span className="font-semibold text-foreground">
                    {lastActivityDate ? formatDateDisplay(lastActivityDate) : "Nenhuma"}
                  </span>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      onOpenAnamnesis();
                    }}
                    variant="outline"
                    className="w-full justify-between text-xs border-sage-deep/30 text-sage-deep hover:bg-cream"
                  >
                    <span>Ver Anamneses</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      onOpenSessions();
                    }}
                    variant="outline"
                    className="w-full justify-between text-xs border-sage-deep/30 text-sage-deep hover:bg-cream"
                  >
                    <span>Ver Atendimentos</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bloco Timeline Resumida */}
            <Card className="md:col-span-2 border border-border bg-card shadow-xs">
              <CardHeader className="py-3 px-4 bg-cream/20 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-sage-deep flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Timeline Resumida de Eventos
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">
                  {consolidatedTimeline.length} evento(s)
                </span>
              </CardHeader>

              <CardContent className="p-4">
                {loadingAnamneses || loadingSessions ? (
                  <div className="h-44 flex items-center justify-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="h-4 w-4 animate-spin text-sage-deep" />
                    <span>Carregando linha do tempo...</span>
                  </div>
                ) : consolidatedTimeline.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center gap-1.5 text-center p-4 border border-dashed border-border rounded-xl bg-cream/10">
                    <AlertCircle className="h-6 w-6 text-muted-foreground/50" />
                    <p className="text-xs font-medium text-sage-deep">
                      Este cliente ainda não possui anamnese nem atendimentos.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Utilize as ações rápidas para criar uma anamnese ou agendar um atendimento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {consolidatedTimeline.map((evt) => (
                      <div
                        key={evt.id}
                        className="flex items-start gap-3 p-2.5 rounded-xl border border-border/70 hover:bg-cream/20 transition-colors text-xs"
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                            evt.type === "anamnesis"
                              ? "bg-sage-deep/10 text-sage-deep"
                              : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {evt.type === "anamnesis" ? (
                            <ClipboardList className="h-4 w-4" />
                          ) : (
                            <Activity className="h-4 w-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-foreground truncate">{evt.title}</p>
                            {evt.type === "anamnesis" ? (
                              <AnamnesisStatusBadge status={evt.status} />
                            ) : (
                              <SessionStatusBadge status={evt.status} />
                            )}
                          </div>
                          {evt.subtitle && (
                            <p className="text-[11px] text-muted-foreground">{evt.subtitle}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {evt.dateStr}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rodapé com Ações Rápidas */}
        <DialogFooter className="pt-4 border-t border-border flex items-center justify-between sm:justify-between w-full gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => {
                onOpenChange(false);
                onOpenAnamnesis();
              }}
              size="sm"
              className="btn-serena text-xs gap-1"
            >
              Ver Anamneses <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                onOpenSessions();
              }}
              size="sm"
              variant="outline"
              className="text-xs gap-1 border-sage-deep/30 text-sage-deep hover:bg-cream"
            >
              Ver Atendimentos <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AdminClientDashboard;
