import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  Activity,
  ClipboardList,
  ShieldCheck,
  FolderOpen,
  Loader2,
  CheckCircle2,
  UserX,
  Sparkles,
  AlertCircle,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  UserPlus,
  PlayCircle,
  CheckCircle,
  XCircle,
  Send,
  Bot,
} from "lucide-react";
import {
  getAppointmentByIdFn,
  resolveAppointmentClientFn,
  convertAppointmentToSessionFn,
} from "@/lib/appointments.functions";
import type { AppointmentRecord } from "@/lib/appointments.repository";
import type { ClientRecord } from "@/lib/clients.repository";
import { listClientSessionsFn } from "@/lib/client-sessions.functions";
import type { ClientSessionRow } from "@/lib/client-sessions.repository";
import { serenaChat } from "@/lib/serena.functions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// Módulos Clínicos Reutilizados
import AdminClientSessions from "@/components/admin/AdminClientSessions";
import AdminClientAnamnesis from "@/components/admin/AdminClientAnamnesis";
import AdminClientDocuments from "@/components/admin/AdminClientDocuments";
import AdminClientConsents from "@/components/admin/AdminClientConsents";

interface CentralAtendimentoViewProps {
  appointmentId: string;
}

type SerenaMsg = { role: "user" | "assistant"; content: string };

export default function CentralAtendimentoView({ appointmentId }: CentralAtendimentoViewProps) {
  const navigate = useNavigate();

  // Server Functions
  const fetchAppointment = useServerFn(getAppointmentByIdFn);
  const resolveClient = useServerFn(resolveAppointmentClientFn);
  const fetchSessions = useServerFn(listClientSessionsFn);
  const convertSession = useServerFn(convertAppointmentToSessionFn);
  const fetchSerenaChat = useServerFn(serenaChat);

  // States
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [session, setSession] = useState<ClientSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados dos Modais Clínicos Integrados
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [isAnamnesisOpen, setIsAnamnesisOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isConsentsOpen, setIsConsentsOpen] = useState(false);

  // Estado da Abas Clínicas Inline
  const [activeTab, setActiveTab] = useState("sessions");

  // Estado do Copilot AI Serena
  const [serenaMessages, setSerenaMessages] = useState<SerenaMsg[]>([]);
  const [serenaInput, setSerenaInput] = useState("");
  const [serenaLoading, setSerenaLoading] = useState(false);
  const chatListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      if (!appointmentId) {
        setError("ID do agendamento não fornecido.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Carrega o agendamento
        const apptData = await fetchAppointment({ data: { appointmentId } });
        if (!apptData) {
          setError("Agendamento não localizado no sistema.");
          setLoading(false);
          return;
        }
        setAppointment(apptData);

        // 2. Resolve o cliente no CRM no servidor (prioridade client_id, fallback por contato)
        const resolvedClient = await resolveClient({ data: { appointmentId } }).catch(() => null);
        setClient(resolvedClient);

        // 3. Carrega as sessões clínicas se o cliente for resolvido
        if (resolvedClient) {
          const sessions = await fetchSessions({ data: { clientId: resolvedClient.id } }).catch(() => []);
          const matchedSession = sessions.find((s) => s.appointment_id === apptData.id) ?? null;
          setSession(matchedSession);
        } else {
          setSession(null);
        }

        // Mensagem inicial contextualizada da Serena Copilot
        const patientName = resolvedClient?.full_name ?? apptData.full_name;
        setSerenaMessages([
          {
            role: "assistant",
            content: `Olá! Sou a Serena Copilot. Estou acompanhando o atendimento de **${patientName}** (${apptData.service}). Como posso auxiliar na conduta clínica hoje?`,
          },
        ]);
      } catch (err) {
        console.error("[CentralAtendimentoView] Error loading data:", err);
        setError("Erro ao carregar o contexto completo do atendimento.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [appointmentId, fetchAppointment, resolveClient, fetchSessions]);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [serenaMessages]);

  // Resolução do CRM Status
  const crmStatus: "no_client" | "ready_for_session" | "session_created" = !client
    ? "no_client"
    : session || appointment?.status === "completed"
      ? "session_created"
      : "ready_for_session";

  // Formatação do link do WhatsApp
  const rawPhone = client?.phone ?? appointment?.phone ?? "";
  const cleanPhoneDigits = rawPhone.replace(/\D/g, "");
  const whatsappUrl =
    cleanPhoneDigits.length >= 10
      ? `https://wa.me/55${cleanPhoneDigits}?text=${encodeURIComponent(
          `Olá ${client?.full_name ?? appointment?.full_name ?? ""}, tudo bem? Entramos em contato a respeito do seu agendamento no Serenar Bem-Estar.`,
        )}`
      : null;

  // Envio de mensagem para a Serena Copilot
  const handleSendSerenaMessage = async (textToSend?: string) => {
    const text = (textToSend ?? serenaInput).trim();
    if (!text || serenaLoading) return;

    const newMessages: SerenaMsg[] = [...serenaMessages, { role: "user", content: text }];
    setSerenaMessages(newMessages);
    setSerenaInput("");
    setSerenaLoading(true);

    try {
      const res = await fetchSerenaChat({ data: { messages: newMessages } });
      setSerenaMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      toast.error("Erro ao comunicar com a Serena Copilot.");
    } finally {
      setSerenaLoading(false);
    }
  };

  // Ação recomendada do Next Action Card
  const handleNextAction = async () => {
    if (!appointment) return;

    if (crmStatus === "no_client") {
      const params = new URLSearchParams({
        create: "true",
        name: appointment.full_name,
        phone: appointment.phone ?? "",
        email: appointment.email ?? "",
      });
      window.location.href = `/admin/clientes?${params.toString()}`;
      return;
    }

    if (crmStatus === "ready_for_session") {
      setConverting(true);
      try {
        await convertSession({
          data: {
            appointmentId: appointment.id,
            status: "completed",
          },
        });
        toast.success("Sessão Clínica iniciada e agendamento concluído com sucesso!");
        const updatedAppt = await fetchAppointment({ data: { appointmentId: appointment.id } });
        if (updatedAppt) setAppointment(updatedAppt);
        if (client) {
          const sessions = await fetchSessions({ data: { clientId: client.id } }).catch(() => []);
          const matched = sessions.find((s) => s.appointment_id === appointment.id) ?? null;
          setSession(matched);
        }
      } catch (err) {
        toast.error("Erro ao converter agendamento em sessão clínica.");
      } finally {
        setConverting(false);
      }
      return;
    }

    if (crmStatus === "session_created") {
      if (client) {
        setIsSessionsOpen(true);
      } else {
        toast.info("Sessão já registrada no prontuário do paciente.");
      }
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[65vh] place-items-center p-8">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-sage-deep" />
          <p className="text-sm font-medium">Carregando Workspace Clínico…</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/admin/agenda">
              <ArrowLeft className="h-4 w-4" /> Voltar para a Agenda
            </Link>
          </Button>
        </div>
        <Card className="border-destructive/30 bg-destructive/5 text-destructive shadow-soft">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="h-8 w-8 shrink-0 text-destructive" />
            <div>
              <h2 className="font-serif text-xl font-medium">Atendimento Não Localizado</h2>
              <p className="mt-1 text-sm">{error ?? "O identificador solicitado é inválido ou não existe."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // WORKFLOW PROGRESS STEPS
  const isCancelled = appointment.status === "cancelled";
  const isCompleted = appointment.status === "completed" || Boolean(session);

  const steps = [
    { id: "agendamento", label: "Agendamento", status: isCancelled ? "cancelled" : "completed" },
    {
      id: "cliente",
      label: "Cliente CRM",
      status: isCancelled
        ? "cancelled"
        : client
          ? "completed"
          : crmStatus === "no_client"
            ? "current"
            : "pending",
    },
    {
      id: "sessao",
      label: "Sessão Clínica",
      status: isCancelled
        ? "cancelled"
        : session || isCompleted
          ? "completed"
          : crmStatus === "ready_for_session"
            ? "current"
            : "pending",
    },
    { id: "anamnese", label: "Anamnese", status: isCancelled ? "cancelled" : client ? "completed" : "pending" },
    { id: "documentos", label: "Docs / LGPD", status: isCancelled ? "cancelled" : client ? "completed" : "pending" },
    { id: "concluido", label: "Concluído", status: isCancelled ? "cancelled" : isCompleted ? "completed" : "pending" },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      {/* 1. HEADER DA CENTRAL */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="outline" size="sm" asChild className="gap-2 text-xs">
              <Link to="/admin/agenda">
                <ArrowLeft className="h-3.5 w-3.5" /> Agenda
              </Link>
            </Button>
            <Badge variant="secondary" className="bg-sage/15 text-sage-deep font-medium">
              Central do Atendimento
            </Badge>
            {isCancelled && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3.5 w-3.5" /> Agendamento Cancelado
              </Badge>
            )}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-sage-deep">
            Atendimento · {appointment.full_name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Serviço: <span className="font-medium text-foreground uppercase tracking-wider">{appointment.service}</span>
          </p>
        </div>
      </div>

      {/* 2. WORKFLOW PROGRESS BAR */}
      <Card className="shadow-soft border-border bg-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-serif text-sage-deep uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4 text-gold" /> Etapas do Atendimento Clínico
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {steps.map((st, idx) => {
              const isComp = st.status === "completed";
              const isCurr = st.status === "current";
              const isCanc = st.status === "cancelled";

              return (
                <div
                  key={st.id}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    isCanc
                      ? "border-destructive/20 bg-destructive/5 text-destructive/70"
                      : isComp
                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
                        : isCurr
                          ? "border-sage bg-sage/10 text-sage-deep ring-2 ring-sage/30 font-medium"
                          : "border-border/60 bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-xs font-mono">
                    <span className="opacity-60">0{idx + 1}.</span>
                    {isComp ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    ) : isCanc ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : isCurr ? (
                      <span className="h-2 w-2 rounded-full bg-sage animate-pulse" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span className="text-xs font-medium line-clamp-1">{st.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 3. NEXT ACTION CARD */}
      <Card
        className={`shadow-soft border-2 transition-all ${
          isCancelled
            ? "border-muted bg-muted/20"
            : crmStatus === "no_client"
              ? "border-amber-300 bg-amber-50/40"
              : crmStatus === "ready_for_session"
                ? "border-sky-300 bg-sky-50/40"
                : "border-emerald-300 bg-emerald-50/40"
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-serif text-sage-deep flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold animate-pulse" /> Próxima Ação Operacional
            </CardTitle>
            <Badge
              variant="outline"
              className={
                isCancelled
                  ? "border-destructive text-destructive bg-destructive/10"
                  : crmStatus === "no_client"
                    ? "border-amber-400 bg-amber-100 text-amber-900"
                    : crmStatus === "ready_for_session"
                      ? "border-sky-400 bg-sky-100 text-sky-900"
                      : "border-emerald-400 bg-emerald-100 text-emerald-900"
              }
            >
              {isCancelled
                ? "Agendamento Cancelado"
                : crmStatus === "no_client"
                  ? "Cliente Não Cadastrado"
                  : crmStatus === "ready_for_session"
                    ? "Pronto para Sessão"
                    : "Sessão Criada"}
            </Badge>
          </div>
          <CardDescription className="text-xs text-foreground/80 mt-1">
            {isCancelled
              ? "Este agendamento foi cancelado e está preservado para fins de histórico e auditoria."
              : crmStatus === "no_client"
                ? "O cliente ainda não possui cadastro no CRM. Cadastre-o para habilitar o prontuário e iniciar a sessão clínica."
                : crmStatus === "ready_for_session"
                  ? "O cliente está vinculado ao CRM. Você pode iniciar a sessão clínica e concluir o agendamento."
                  : "A sessão clínica foi iniciada com sucesso. O atendimento encontra-se registrado no CRM."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-3">
          {!isCancelled && (
            <div className="flex items-center justify-end">
              <Button
                onClick={handleNextAction}
                disabled={converting}
                className={`gap-2 font-medium shadow-sm ${
                  crmStatus === "no_client"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : crmStatus === "ready_for_session"
                      ? "bg-sage-deep hover:bg-sage-deep/90 text-white"
                      : "bg-emerald-700 hover:bg-emerald-800 text-white"
                }`}
              >
                {converting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processando…
                  </>
                ) : crmStatus === "no_client" ? (
                  <>
                    <UserPlus className="h-4 w-4" /> Cadastrar Cliente no CRM <ChevronRight className="h-4 w-4" />
                  </>
                ) : crmStatus === "ready_for_session" ? (
                  <>
                    <PlayCircle className="h-4 w-4" /> Iniciar / Converter em Sessão Clínica <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Gerenciar Sessão no Prontuário <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. SUMÁRIO DO PACIENTE E AGENDAMENTO (2 COLUNAS RESPONSIVAS) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* PATIENT SUMMARY */}
        <Card className="shadow-soft border-border">
          <CardHeader className="pb-3 border-b border-border/50 bg-blush/20 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-serif text-sage-deep flex items-center gap-2">
                <User className="h-5 w-5 text-gold" /> Sumário do Paciente
              </CardTitle>
              <CardDescription className="text-xs">Informações cadastrais e contatos</CardDescription>
            </div>
            {client && (
              <Badge variant="outline" className="border-sage/40 text-sage-deep text-xs font-mono">
                CRM Activo
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground">Nome Completo:</span>
              <span className="font-medium text-foreground">{client?.full_name ?? appointment.full_name}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefone:
              </span>
              <span className="font-mono text-foreground">{client?.phone ?? appointment.phone}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> E-mail:
              </span>
              <span className="font-mono text-foreground">
                {client?.email ?? appointment.email ?? "Não informado"}
              </span>
            </div>
            {client?.birth_date && (
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-muted-foreground">Data de Nascimento:</span>
                <span className="font-medium text-foreground">{client.birth_date}</span>
              </div>
            )}
            {client?.city && (
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-muted-foreground">Cidade:</span>
                <span className="font-medium text-foreground">{client.city}</span>
              </div>
            )}

            {/* AÇÕES RÁPIDAS SEGURAS */}
            <div className="pt-3 flex flex-wrap gap-2 justify-end">
              {whatsappUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs"
                >
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                  </a>
                </Button>
              )}
              {client && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-1.5 text-xs border-sage-deep/30 text-sage-deep hover:bg-sage/10"
                >
                  <Link to="/admin/clientes" search={{ search: client.full_name }}>
                    <ExternalLink className="h-3.5 w-3.5" /> Perfil no CRM
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* APPOINTMENT SUMMARY */}
        <Card className="shadow-soft border-border">
          <CardHeader className="pb-3 border-b border-border/50 bg-blush/20">
            <CardTitle className="text-lg font-serif text-sage-deep flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gold" /> Detalhes do Agendamento
            </CardTitle>
            <CardDescription className="text-xs">Parâmetros do atendimento agendado</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Data Solicitada:
              </span>
              <span className="font-medium text-foreground">
                {appointment.preferred_date ?? "A combinar"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Horário Preferencial:
              </span>
              <span className="font-medium text-foreground">
                {appointment.preferred_time ?? "A combinar"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground">Serviço:</span>
              <span className="font-medium text-sage-deep uppercase tracking-wider text-xs">
                {appointment.service}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground">Status do Agendamento:</span>
              <Badge variant="outline" className="capitalize">
                {appointment.status}
              </Badge>
            </div>
            {appointment.notes && (
              <div className="py-1">
                <span className="text-muted-foreground block mb-1 text-xs font-medium">
                  Observações do Paciente:
                </span>
                <p className="text-xs bg-muted/30 p-2.5 rounded border border-border/40 text-foreground/80">
                  {appointment.notes}
                </p>
              </div>
            )}
            <div className="py-1">
              <span className="text-muted-foreground block mb-1 text-xs font-medium">Notas Internas:</span>
              <p className="text-xs bg-muted/40 p-2.5 rounded border border-border/40 text-foreground/80 italic">
                {appointment.internal_notes ?? "Nenhuma observação interna."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. UNIFIED CLINICAL WORKSPACE & AI SERENA COPILOT (GRID 2 COLUNAS) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* COLUNA ESQUERDA: WORKSPACE CLÍNICO EM ABAS (8 COLS) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="shadow-soft border-border">
            <CardHeader className="pb-3 border-b border-border/40 bg-card">
              <CardTitle className="text-xl font-serif text-sage-deep flex items-center gap-2">
                <FileText className="h-5 w-5 text-gold" /> Módulos Clínicos do Prontuário
              </CardTitle>
              <CardDescription className="text-xs">
                Gestão integrada de sessões, anamnese, documentos e termos LGPD
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {client ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-4">
                    <TabsTrigger value="sessions" className="text-xs gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Sessões
                    </TabsTrigger>
                    <TabsTrigger value="anamnesis" className="text-xs gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5" /> Anamnese
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" /> Documentos
                    </TabsTrigger>
                    <TabsTrigger value="lgpd" className="text-xs gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> LGPD
                    </TabsTrigger>
                  </TabsList>

                  {/* ABA 1: SESSÕES CLÍNICAS */}
                  <TabsContent value="sessions" className="space-y-3">
                    <div className="bg-sage/5 p-4 rounded-xl border border-sage/20 flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium text-sage-deep">Histórico de Sessões Clínicas</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session
                            ? "Sessão clínica vinculada a este atendimento encontrada."
                            : "Nenhuma sessão criada para este agendamento específico ainda."}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsSessionsOpen(true)}
                        className="gap-1.5 bg-sage-deep hover:bg-sage-deep/90 text-white text-xs"
                      >
                        <Activity className="h-3.5 w-3.5" /> Abrir Prontuário Completo
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ABA 2: ANAMNESE */}
                  <TabsContent value="anamnesis" className="space-y-3">
                    <div className="bg-gold/5 p-4 rounded-xl border border-gold/20 flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium text-sage-deep">Ficha de Anamnese do Paciente</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Questionários de saúde, histórico e dados fisiológicos preenchidos.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsAnamnesisOpen(true)}
                        className="gap-1.5 bg-gold hover:bg-gold/90 text-white text-xs"
                      >
                        <ClipboardList className="h-3.5 w-3.5" /> Ver / Preencher Anamnese
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ABA 3: DOCUMENTOS */}
                  <TabsContent value="documents" className="space-y-3">
                    <div className="bg-sky-50 p-4 rounded-xl border border-sky-200 flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium text-sky-900">Documentos e Anexos Clínicos</h4>
                        <p className="text-xs text-sky-700 mt-0.5">
                          Upload de exames, laudos e termos digitalizados anexados ao cliente.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsDocumentsOpen(true)}
                        className="gap-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs"
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Gerenciar Anexos
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ABA 4: LGPD */}
                  <TabsContent value="lgpd" className="space-y-3">
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium text-emerald-900">Consentimentos LGPD</h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Termos de privacidade e aceites de tratamento de dados registrados.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsConsentsOpen(true)}
                        className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Termos de Consentimento
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed border-border space-y-3">
                  <UserX className="h-10 w-10 mx-auto text-amber-600/70" />
                  <h3 className="font-serif text-lg text-sage-deep">Cliente Não Vinculado no CRM</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Para acessar prontuários, fichas de anamnese, anexos de documentos e termos LGPD, cadastre o paciente no CRM através do Next Action Card.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleNextAction}
                    className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Cadastrar Cliente no CRM Agora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: AI SERENA COPILOT (4 COLS) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-soft border-sage/30 bg-card flex flex-col h-[520px]">
            <CardHeader className="pb-3 border-b border-border/40 bg-sage/10">
              <CardTitle className="text-base font-serif text-sage-deep flex items-center gap-2">
                <Bot className="h-5 w-5 text-gold animate-bounce" /> Serena AI Copilot
              </CardTitle>
              <CardDescription className="text-xs text-foreground/70">
                Assistente clínica contextualizada para o atendimento de{" "}
                <span className="font-medium text-sage-deep">{client?.full_name ?? appointment.full_name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 flex-1 flex flex-col justify-between overflow-hidden">
              {/* HISTÓRICO DE MENSAGENS */}
              <div ref={chatListRef} className="space-y-3 overflow-y-auto pr-1 flex-1 text-xs mb-3">
                {serenaMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl max-w-[90%] leading-relaxed ${
                      m.role === "user"
                        ? "bg-sage-deep text-white ml-auto"
                        : "bg-muted/50 border border-border/50 text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {serenaLoading && (
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-sage-deep" />
                    <span>Serena pensando…</span>
                  </div>
                )}
              </div>

              {/* SUGESTÕES RÁPIDAS */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() =>
                    handleSendSerenaMessage(
                      `Sugerir conduta pós-atendimento para a sessão de ${appointment.service}`,
                    )
                  }
                  className="text-[11px] bg-sage/10 hover:bg-sage/20 text-sage-deep border border-sage/20 px-2 py-1 rounded-md transition-colors text-left"
                >
                  💡 Conduta para {appointment.service}
                </button>
              </div>

              {/* FORMULÁRIO DE ENVIO */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendSerenaMessage();
                }}
                className="flex items-center gap-1.5 pt-2 border-t border-border/40"
              >
                <Input
                  value={serenaInput}
                  onChange={(e) => setSerenaInput(e.target.value)}
                  placeholder="Perguntar à Serena Copilot…"
                  className="text-xs h-9"
                  disabled={serenaLoading}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={serenaLoading || !serenaInput.trim()}
                  className="h-9 w-9 p-0 shrink-0 bg-sage-deep hover:bg-sage-deep/90 text-white"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RENDERIZAÇÃO DOS MODAIS CLÍNICOS AUTORITATIVOS QUANDO O CLIENTE EXISTIR */}
      {client && (
        <>
          <AdminClientSessions
            clientId={client.id}
            clientName={client.full_name}
            isOpen={isSessionsOpen}
            onOpenChange={setIsSessionsOpen}
          />
          <AdminClientAnamnesis
            clientId={client.id}
            clientName={client.full_name}
            isOpen={isAnamnesisOpen}
            onOpenChange={setIsAnamnesisOpen}
          />
          <AdminClientDocuments
            clientId={client.id}
            clientName={client.full_name}
            isOpen={isDocumentsOpen}
            onOpenChange={setIsDocumentsOpen}
          />
          <AdminClientConsents
            clientId={client.id}
            clientName={client.full_name}
            isOpen={isConsentsOpen}
            onOpenChange={setIsConsentsOpen}
          />
        </>
      )}
    </div>
  );
}
