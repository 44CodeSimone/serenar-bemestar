import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { getAppointmentByIdFn, resolveAppointmentClientFn } from "@/lib/appointments.functions";
import type { AppointmentRecord } from "@/lib/appointments.repository";
import type { ClientRecord } from "@/lib/clients.repository";
import { listClientSessionsFn } from "@/lib/client-sessions.functions";
import type { ClientSessionRow } from "@/lib/client-sessions.repository";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CentralAtendimentoViewProps {
  appointmentId: string;
}

export default function CentralAtendimentoView({ appointmentId }: CentralAtendimentoViewProps) {
  // Server Functions
  const fetchAppointment = useServerFn(getAppointmentByIdFn);
  const resolveClient = useServerFn(resolveAppointmentClientFn);
  const fetchSessions = useServerFn(listClientSessionsFn);

  // States
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [session, setSession] = useState<ClientSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setError("Agendamento não encontrado.");
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
      } catch (err) {
        console.error("[CentralAtendimentoView] Error loading data:", err);
        setError("Erro ao carregar os dados do atendimento.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [appointmentId, fetchAppointment, resolveClient, fetchSessions]);

  // Resolução do CRM Status
  const crmStatus: "no_client" | "ready_for_session" | "session_created" = !client
    ? "no_client"
    : session || appointment?.status === "completed"
      ? "session_created"
      : "ready_for_session";

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-8">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-sage-deep" />
          <p className="text-sm font-medium">Carregando Central do Atendimento…</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="p-6 md:p-10">
        <div className="mb-6">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/admin/agenda">
              <ArrowLeft className="h-4 w-4" /> Voltar para a Agenda
            </Link>
          </Button>
        </div>
        <Card className="border-destructive/30 bg-destructive/5 text-destructive">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="h-8 w-8 shrink-0 text-destructive" />
            <div>
              <h2 className="font-serif text-xl font-medium">Erro ao carregar atendimento</h2>
              <p className="mt-1 text-sm">{error ?? "Agendamento não localizado."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      {/* 1. HEADER DA CENTRAL */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link to="/admin/agenda">
                <ArrowLeft className="h-4 w-4" /> Agenda
              </Link>
            </Button>
            <Badge variant="secondary" className="bg-sage/15 text-sage-deep">
              Central do Atendimento
            </Badge>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-sage-deep">
            Atendimento · {appointment.full_name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            ID Agendamento: {appointment.id}
          </p>
        </div>
      </div>

      {/* 2. SUMÁRIO DO PACIENTE E AGENDAMENTO (2 COLUNAS) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* PATIENT SUMMARY */}
        <Card className="shadow-soft border-border">
          <CardHeader className="pb-3 border-b border-border/50 bg-blush/20">
            <CardTitle className="text-lg font-serif text-sage-deep flex items-center gap-2">
              <User className="h-5 w-5 text-gold" /> Sumário do Paciente
            </CardTitle>
            <CardDescription className="text-xs">Dados de contato e status no CRM</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground">Nome Completo:</span>
              <span className="font-medium text-foreground">{appointment.full_name}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefone:
              </span>
              <span className="font-mono text-foreground">{appointment.phone}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> E-mail:
              </span>
              <span className="font-mono text-foreground">{appointment.email ?? "Não informado"}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/30">
              <span className="text-muted-foreground">CRM Status:</span>
              <span>
                {crmStatus === "no_client" ? (
                  <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900 gap-1">
                    <UserX className="h-3.5 w-3.5 text-amber-600" /> Cliente Não Cadastrado
                  </Badge>
                ) : crmStatus === "session_created" ? (
                  <Badge className="bg-emerald-600 text-white gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sessão Criada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-sky-400 bg-sky-50 text-sky-900 gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-sky-600" /> Pronto para Sessão
                  </Badge>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Client ID:</span>
              <span className="font-mono text-xs text-muted-foreground">
                {client?.id ?? appointment.client_id ?? "Não vinculado"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* APPOINTMENT SUMMARY */}
        <Card className="shadow-soft border-border">
          <CardHeader className="pb-3 border-b border-border/50 bg-blush/20">
            <CardTitle className="text-lg font-serif text-sage-deep flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gold" /> Detalhes do Agendamento
            </CardTitle>
            <CardDescription className="text-xs">Parâmetros do serviço solicitado</CardDescription>
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
            <div className="py-1">
              <span className="text-muted-foreground block mb-1">Notas Internas:</span>
              <p className="text-xs bg-muted/40 p-2 rounded border border-border/40 text-foreground/80 italic">
                {appointment.internal_notes ?? "Nenhuma observação interna."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. WORKFLOW CARD (PLACEHOLDER DE ESTADO CRM) */}
      <Card className="shadow-soft border-sage/30 bg-cream/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-serif text-sage-deep flex items-center gap-2">
            <Activity className="h-5 w-5 text-sage" /> Estado do Workflow CRM
          </CardTitle>
          <CardDescription className="text-xs">
            Orquestração operacional baseada em `crmStatus`
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 text-sm space-y-2">
          <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
            <span className="text-xs font-mono font-medium text-muted-foreground">Current crmStatus:</span>
            <Badge
              variant="outline"
              className={
                crmStatus === "no_client"
                  ? "border-amber-400 bg-amber-50 text-amber-900"
                  : crmStatus === "session_created"
                    ? "bg-emerald-600 text-white"
                    : "border-sky-400 bg-sky-50 text-sky-900"
              }
            >
              {crmStatus}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Ações de transição de workflow (Cadastrar Cliente inline, Iniciar Sessão, Concluir) serão integradas na Sprint 011B.
          </p>
        </CardContent>
      </Card>

      {/* 4. ÁREA CLÍNICA (4 CARDS PLACEHOLDER REUTILIZADOS) */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl text-sage-deep flex items-center gap-2">
          <FileText className="h-5 w-5 text-gold" /> Módulos Clínicos Integrados
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* PLACEHOLDER 1: CLINICAL SESSIONS */}
          <Card className="border-dashed border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif text-sage-deep flex items-center gap-2">
                <Activity className="h-4 w-4 text-sage" /> Sessão Clínica
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground/80">Coming from existing module: client-sessions</p>
              <p>Formulário de relato do paciente, conduta e recomendações da sessão.</p>
            </CardContent>
          </Card>

          {/* PLACEHOLDER 2: ANAMNESIS */}
          <Card className="border-dashed border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif text-sage-deep flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-gold" /> Ficha de Anamnese
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground/80">Coming from existing module: anamnesis</p>
              <p>Questionários preenchidos, dados de saúde e histórico clínico.</p>
            </CardContent>
          </Card>

          {/* PLACEHOLDER 3: DOCUMENTS */}
          <Card className="border-dashed border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif text-sage-deep flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-sky-600" /> Documentos & Anexos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground/80">Coming from existing module: documents</p>
              <p>Upload e gestão de exames, laudos e termos anexados ao prontuário.</p>
            </CardContent>
          </Card>

          {/* PLACEHOLDER 4: LGPD */}
          <Card className="border-dashed border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif text-sage-deep flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Consentimento LGPD
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground/80">Coming from existing module: lgpd</p>
              <p>Registro de termos de privacidade e aceites de consentimento do paciente.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
