import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Plus,
  Loader2,
  Calendar,
  FileCheck,
  RotateCcw,
  Ban,
  Clock,
  FileText,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  getClientConsentsFn,
  grantClientConsentFn,
  revokeClientConsentFn,
} from "@/lib/lgpd.functions";
import type { ClientConsentRecord } from "@/lib/consents.repository";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminClientConsentsProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Map amigável dos tipos de consentimento LGPD do Serenar CRM
const CONSENT_TYPES = [
  { value: "data_processing", label: "Tratamento de Dados Cadastrais", desc: "Coleta e tratamento de dados cadastrais para identificação e atendimento." },
  { value: "service_authorization", label: "Autorização para Rituais e Atendimentos", desc: "Consentimento para realização das sessões de massoterapia." },
  { value: "guardian_authorization", label: "Autorização de Responsável Legal", desc: "Autorização fornecida pelo responsável legal de menor de idade." },
  { value: "document_storage", label: "Guarda e Armazenamento de Documentos", desc: "Guarda segura de exames, fichas e anexos privados." },
  { value: "ai_memory", label: "Memória de Preferências da IA Serenar", desc: "Autorização para a assistente virtual lembrar preferências do cliente." },
  { value: "marketing", label: "Comunicações Promocionais e Informativos", desc: "Envio de mensagens promocionais, saudações e novidades." },
  { value: "image_use", label: "Uso Específico de Imagem / Fotografia", desc: "Uso autorizado de fotos ou vídeos para acompanhamento." },
  { value: "testimonial_use", label: "Publicação de Depoimentos Autorizados", desc: "Publicação de relatos do cliente no site ou redes sociais." },
] as const;

// Map amigável das bases legais
const LEGAL_BASES = [
  { value: "consent", label: "Consentimento do Titular (Art. 7º, I)" },
  { value: "contract_execution", label: "Execução de Contrato (Art. 7º, V)" },
  { value: "legal_obligation", label: "Obrigação Legal ou Regulatória (Art. 7º, II)" },
  { value: "legitimate_interest", label: "Legítimo Interesse do Controlador (Art. 7º, IX)" },
  { value: "health_protection", label: "Tutela da Saúde / Proteção da Vida (Art. 7º, VIII)" },
  { value: "regular_exercise_rights", label: "Exercício Regular de Direitos (Art. 7º, VI)" },
] as const;

// Map amigável dos canais de coleta
const COLLECTION_CHANNELS = [
  { value: "admin", label: "Painel Administrativo Serenar" },
  { value: "website", label: "Formulário do Website Público" },
  { value: "authenticated_portal", label: "Portal do Cliente Autenticado" },
  { value: "document", label: "Documento Físico Assinado / Digitalizado" },
  { value: "other", label: "Outro Canal Autorizado" },
] as const;

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

function getConsentTypeLabel(type: string): string {
  const item = CONSENT_TYPES.find((c) => c.value === type);
  return item ? item.label : type;
}

function getLegalBasisLabel(basis: string): string {
  const item = LEGAL_BASES.find((b) => b.value === basis);
  return item ? item.label : basis;
}

function getChannelLabel(channel: string): string {
  const item = COLLECTION_CHANNELS.find((c) => c.value === channel);
  return item ? item.label : channel;
}

interface NewConsentFormData {
  consent_type: string;
  granted: boolean;
  legal_basis: string;
  term_version: string;
  collection_channel: string;
  term_hash: string;
  expires_at: string;
}

const EMPTY_FORM: NewConsentFormData = {
  consent_type: "data_processing",
  granted: true,
  legal_basis: "consent",
  term_version: "v1.0",
  collection_channel: "admin",
  term_hash: "",
  expires_at: "",
};

export default function AdminClientConsents({
  clientId,
  clientName,
  isOpen,
  onOpenChange,
}: AdminClientConsentsProps) {
  // TanStack Start Server Functions
  const fetchConsents = useServerFn(getClientConsentsFn);
  const grantConsent = useServerFn(grantClientConsentFn);
  const revokeConsent = useServerFn(revokeClientConsentFn);

  // Estados de dados e interface
  const [consents, setConsents] = useState<ClientConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<NewConsentFormData>(EMPTY_FORM);

  // Estado do modal de confirmação de revogação
  const [targetRevokeConsent, setTargetRevokeConsent] = useState<ClientConsentRecord | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Carregar histórico completo de consentimentos do cliente
  const loadConsents = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await fetchConsents({ data: { clientId } });
      setConsents(res);
    } catch {
      toast.error("Erro ao carregar os consentimentos LGPD do cliente.");
    } finally {
      setLoading(false);
    }
  }, [fetchConsents, clientId]);

  useEffect(() => {
    if (isOpen && clientId) {
      void loadConsents();
      setIsFormOpen(false);
      setFormData(EMPTY_FORM);
    }
  }, [isOpen, clientId, loadConsents]);

  // Handler para submeter novo consentimento (Append-Only)
  const handleSubmitGrant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.consent_type) {
      toast.error("Selecione o tipo de consentimento.");
      return;
    }
    if (!formData.legal_basis) {
      toast.error("Selecione a base legal.");
      return;
    }
    if (!formData.term_version.trim()) {
      toast.error("Informe a versão do termo.");
      return;
    }

    setSubmitting(true);

    try {
      await grantConsent({
        data: {
          client_id: clientId,
          consent_type: formData.consent_type,
          granted: formData.granted,
          legal_basis: formData.legal_basis,
          term_version: formData.term_version.trim(),
          collection_channel: formData.collection_channel,
          term_hash: formData.term_hash.trim() || null,
          expires_at: formData.expires_at.trim() || null,
        },
      });

      toast.success("Novo consentimento LGPD registrado com sucesso!");
      setIsFormOpen(false);
      setFormData(EMPTY_FORM);
      await loadConsents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar consentimento.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handler para confirmar a revogação de um consentimento ativo
  const handleConfirmRevoke = async () => {
    if (!targetRevokeConsent) return;
    setRevoking(true);

    try {
      await revokeConsent({
        data: {
          consentId: targetRevokeConsent.id,
        },
      });

      toast.success("Consentimento revogado com sucesso. O histórico foi preservado (Append-Only).");
      setTargetRevokeConsent(null);
      await loadConsents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao revogar consentimento.";
      toast.error(msg);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-sage-deep" />
                <div>
                  <DialogTitle className="font-serif text-2xl text-sage-deep">
                    Gestão de Consentimentos LGPD
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Cliente: <strong className="text-foreground font-semibold">{clientName}</strong> — Histórico imutável de termos e autorizações de privacidade.
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadConsents()}
                disabled={loading}
                className="gap-1.5 text-xs border-sage-deep/30 text-sage-deep hover:bg-blush"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </DialogHeader>

          {/* Painel do Formulário de Novo Consentimento */}
          {isFormOpen ? (
            <Card className="border border-sage-deep/30 bg-cream/30 shadow-xs mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif text-sage-deep flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Registrar Novo Consentimento LGPD
                  </span>
                  <Badge variant="outline" className="border-sage-deep/30 text-sage-deep text-[11px]">
                    Append-Only Ledger
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitGrant} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tipo de Consentimento */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-sage-deep">
                        Tipo de Consentimento *
                      </label>
                      <Select
                        value={formData.consent_type}
                        onValueChange={(val) => setFormData((prev) => ({ ...prev, consent_type: val }))}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {CONSENT_TYPES.map((ct) => (
                            <SelectItem key={ct.value} value={ct.value}>
                              <div className="py-0.5">
                                <p className="font-medium text-xs">{ct.label}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        {CONSENT_TYPES.find((c) => c.value === formData.consent_type)?.desc}
                      </p>
                    </div>

                    {/* Estado do Consentimento (Concedido / Negado) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-sage-deep">
                        Decisão do Titular *
                      </label>
                      <Select
                        value={formData.granted ? "true" : "false"}
                        onValueChange={(val) => setFormData((prev) => ({ ...prev, granted: val === "true" }))}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">
                            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Concedido (Opt-In)
                            </span>
                          </SelectItem>
                          <SelectItem value="false">
                            <span className="text-amber-700 font-medium flex items-center gap-1.5">
                              <XCircle className="h-3.5 w-3.5" /> Recusado / Negado (Opt-Out)
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Base Legal */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-sage-deep">
                        Base Legal (LGPD) *
                      </label>
                      <Select
                        value={formData.legal_basis}
                        onValueChange={(val) => setFormData((prev) => ({ ...prev, legal_basis: val }))}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione a base legal" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEGAL_BASES.map((lb) => (
                            <SelectItem key={lb.value} value={lb.value}>
                              <span className="text-xs">{lb.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Canal de Coleta */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-sage-deep">
                        Canal de Coleta *
                      </label>
                      <Select
                        value={formData.collection_channel}
                        onValueChange={(val) => setFormData((prev) => ({ ...prev, collection_channel: val }))}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione o canal" />
                        </SelectTrigger>
                        <SelectContent>
                          {COLLECTION_CHANNELS.map((cc) => (
                            <SelectItem key={cc.value} value={cc.value}>
                              <span className="text-xs">{cc.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Versão do Termo */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-sage-deep">
                        Versão do Termo *
                      </label>
                      <Input
                        value={formData.term_version}
                        onChange={(e) => setFormData((prev) => ({ ...prev, term_version: e.target.value }))}
                        placeholder="Ex: v1.0, v2026-08"
                        className="bg-background text-xs"
                      />
                    </div>

                    {/* Hash de Integridade (Opcional) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Hash do Termo (Opcional)
                      </label>
                      <Input
                        value={formData.term_hash}
                        onChange={(e) => setFormData((prev) => ({ ...prev, term_hash: e.target.value }))}
                        placeholder="Hash SHA-256 de integridade"
                        className="bg-background text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFormOpen(false)}
                      disabled={submitting}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submitting}
                      className="btn-serena gap-1.5"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Salvar Consentimento
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-sage-deep/30 bg-cream/50 text-sage-deep text-xs font-medium">
                  {consents.length} {consents.length === 1 ? "registro histórico" : "registros históricos"}
                </Badge>
              </div>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="btn-serena gap-1.5 text-xs"
              >
                <Plus className="h-4 w-4" /> Novo Consentimento
              </Button>
            </div>
          )}

          {/* Lista de Registros de Consentimentos */}
          <Card className="border border-border shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-cream/40">
                  <TableRow>
                    <TableHead className="font-semibold text-sage-deep">Status</TableHead>
                    <TableHead className="font-semibold text-sage-deep">Tipo de Consentimento</TableHead>
                    <TableHead className="font-semibold text-sage-deep">Base Legal</TableHead>
                    <TableHead className="font-semibold text-sage-deep">Versão / Canal</TableHead>
                    <TableHead className="font-semibold text-sage-deep">Datas</TableHead>
                    <TableHead className="text-right font-semibold text-sage-deep">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                          <span>Carregando consentimentos LGPD...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : consents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-36 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Shield className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-medium text-sm">Nenhum consentimento LGPD registrado.</p>
                          <p className="text-xs text-muted-foreground">
                            Clique em "Novo Consentimento" para registrar a primeira autorização deste cliente.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    consents.map((consent) => {
                      const isRevoked = Boolean(consent.revoked_at);
                      const isActive = consent.granted && !isRevoked;

                      return (
                        <TableRow key={consent.id} className="hover:bg-cream/20 transition-colors">
                          <TableCell>
                            {isActive ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Ativo
                              </Badge>
                            ) : isRevoked ? (
                              <Badge variant="destructive" className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-300 font-medium text-[11px] gap-1">
                                <Ban className="h-3 w-3" /> Revogado
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-medium text-[11px] gap-1">
                                <XCircle className="h-3 w-3" /> Recusado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              <p className="text-sage-deep text-sm font-serif">
                                {getConsentTypeLabel(consent.consent_type)}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {consent.consent_type}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-foreground">
                            {getLegalBasisLabel(consent.legal_basis)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>
                              <p className="font-medium text-foreground">
                                {consent.term_version}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {getChannelLabel(consent.collection_channel)}
                              </p>
                              {consent.evidence_document_id && (
                                <Badge variant="outline" className="mt-1 text-[10px] border-indigo-200 text-indigo-700 bg-indigo-50 flex items-center gap-1 w-fit">
                                  <FileCheck className="h-3 w-3" /> Com Evidência
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="space-y-0.5">
                              <p className="text-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                Aceite: {formatDateTimeDisplay(consent.granted_at)}
                              </p>
                              {consent.revoked_at && (
                                <p className="text-rose-700 font-medium flex items-center gap-1">
                                  <Ban className="h-3 w-3 text-rose-500" />
                                  Revogado: {formatDateTimeDisplay(consent.revoked_at)}
                                </p>
                              )}
                              {consent.expires_at && (
                                <p className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  Expira: {formatDateTimeDisplay(consent.expires_at)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isActive ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTargetRevokeConsent(consent)}
                                className="h-8 text-xs border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 gap-1.5"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" /> Revogar
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                {isRevoked ? "Revogado" : "Inativo"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmação de Revogação de Consentimento */}
      <AlertDialog
        open={Boolean(targetRevokeConsent)}
        onOpenChange={(open) => {
          if (!open) setTargetRevokeConsent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-700 mb-1">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle className="font-serif text-xl">
                Revogar Consentimento LGPD?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-foreground space-y-2">
              <p>
                Você está prestes a revogar a autorização para{" "}
                <strong>
                  {targetRevokeConsent ? getConsentTypeLabel(targetRevokeConsent.consent_type) : ""}
                </strong>{" "}
                de <strong>{clientName}</strong>.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-[11px] space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-700" /> Em conformidade com o modelo Append-Only:
                </p>
                <p>
                  O registro histórico de concessão não será excluído. O sistema apenas gravará a data e hora de revogação (`revoked_at`) de forma imutável.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRevoke}
              disabled={revoking}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium gap-1.5"
            >
              {revoking && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Revogação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
