import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Search,
  UserPlus,
  Edit,
  Eye,
  Archive,
  RotateCcw,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  FileText,
  ClipboardList,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import AdminClientAnamnesis from "@/components/admin/AdminClientAnamnesis";
import AdminClientSessions from "@/components/admin/AdminClientSessions";
import AdminClientDashboard from "@/components/admin/AdminClientDashboard";
import AdminClientConsents from "@/components/admin/AdminClientConsents";
import AdminClientDocuments from "@/components/admin/AdminClientDocuments";
import {
  listClientsFn,
  getClientByIdFn,
  checkClientDuplicatesFn,
  createClientFn,
  updateClientFn,
  archiveClientFn,
  restoreClientFn,
} from "@/lib/clients.functions";
import type { ClientRecord, DuplicateCheckResult } from "@/lib/clients.repository";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Helper de formatação de CPF: 000.000.000-00
function formatCpf(cpf?: string | null): string {
  if (!cpf) return "-";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// Masking parcial de CPF para alertas de duplicidade: 123.***.***-00
function maskCpfPartial(cpf?: string | null): string {
  if (!cpf) return "Não informado";
  const formatted = formatCpf(cpf);
  if (formatted.length !== 14) return formatted;
  return `${formatted.slice(0, 4)}***.***${formatted.slice(11)}`;
}

// Helper de formatação de telefone: (00) 00000-0000 ou (00) 0000-0000
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

// Formatador de data ISO para exibição (DD/MM/AAAA)
function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Mapeamento visual dos badges de status
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
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium"
        >
          Inativo
        </Badge>
      );
    case "archived":
      return (
        <Badge
          variant="destructive"
          className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium"
        >
          Arquivado
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Mapeamento amigável das origens de cadastro
function formatSourceLabel(source?: string | null): string {
  if (!source) return "Administrativo";
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

interface ClientFormData {
  full_name: string;
  birth_date: string;
  phone: string;
  cpf: string;
  mother_name: string;
  whatsapp: string;
  email: string;
  city: string;
  profession: string;
  notes: string;
}

const EMPTY_FORM: ClientFormData = {
  full_name: "",
  birth_date: "",
  phone: "",
  cpf: "",
  mother_name: "",
  whatsapp: "",
  email: "",
  city: "",
  profession: "",
  notes: "",
};

export default function AdminClients() {
  // Chamadas de Server Functions
  const fetchList = useServerFn(listClientsFn);
  const fetchDetail = useServerFn(getClientByIdFn);
  const fetchDuplicates = useServerFn(checkClientDuplicatesFn);
  const executeCreate = useServerFn(createClientFn);
  const executeUpdate = useServerFn(updateClientFn);
  const executeArchive = useServerFn(archiveClientFn);
  const executeRestore = useServerFn(restoreClientFn);

  // Estados de listagem e filtro
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Estados de modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isArchiveAlertOpen, setIsArchiveAlertOpen] = useState(false);
  const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
  const [isDuplicateConfirmOpen, setIsDuplicateConfirmOpen] = useState(false);
  const [isAnamnesisOpen, setIsAnamnesisOpen] = useState(false);
  const [anamnesisClient, setAnamnesisClient] = useState<{ id: string; name: string } | null>(null);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [sessionsClient, setSessionsClient] = useState<{ id: string; name: string } | null>(null);
  const [isConsentsOpen, setIsConsentsOpen] = useState(false);
  const [consentsClient, setConsentsClient] = useState<{ id: string; name: string } | null>(null);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [documentsClient, setDocumentsClient] = useState<{ id: string; name: string } | null>(null);

  const handleOpenAnamnesis = (client: { id: string; full_name: string }) => {
    setAnamnesisClient({ id: client.id, name: client.full_name });
    setIsAnamnesisOpen(true);
  };

  const handleOpenSessions = (client: { id: string; full_name: string }) => {
    setSessionsClient({ id: client.id, name: client.full_name });
    setIsSessionsOpen(true);
  };

  const handleOpenConsents = (client: { id: string; full_name: string }) => {
    setConsentsClient({ id: client.id, name: client.full_name });
    setIsConsentsOpen(true);
  };

  const handleOpenDocuments = (client: { id: string; full_name: string }) => {
    setDocumentsClient({ id: client.id, name: client.full_name });
    setIsDocumentsOpen(true);
  };

  // Formulário e registros selecionados
  const [formData, setFormData] = useState<ClientFormData>(EMPTY_FORM);
  const isFormDirtyRef = useRef(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [targetActionClientId, setTargetActionClientId] = useState<string | null>(null);
  const [targetActionClientName, setTargetActionClientName] = useState<string>("");

  // Estados de carregamento de ações
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [suspectedDuplicates, setSuspectedDuplicates] = useState<ClientRecord[]>([]);

  // Suporte a pré-preenchimento via navegação externa (ex: Agendamentos / Agenda)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "true") {
        setFormData({
          ...EMPTY_FORM,
          full_name: params.get("name") ?? "",
          phone: params.get("phone") ?? "",
          email: params.get("email") ?? "",
        });
        setIsCreateOpen(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  // Debounce na busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Carregar lista de clientes
  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchList({
        data: {
          page,
          pageSize,
          search: debouncedSearch,
          status: statusFilter,
          includeArchived: statusFilter === "archived" || statusFilter === "all",
        },
      });
      setClients(res.data);
      setTotalCount(res.count);
    } catch {
      toast.error("Não foi possível carregar a lista de clientes.");
    } finally {
      setLoading(false);
    }
  }, [fetchList, page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  // Handler de alteração dos inputs de formulário com máscaras
  const handleInputChange = (field: keyof ClientFormData, value: string) => {
    isFormDirtyRef.current = true;
    let formattedValue = value;

    if (field === "cpf") {
      const digits = value.replace(/\D/g, "").slice(0, 11);
      if (digits.length > 9) {
        formattedValue = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
      } else if (digits.length > 6) {
        formattedValue = digits.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      } else if (digits.length > 3) {
        formattedValue = digits.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      } else {
        formattedValue = digits;
      }
    } else if (field === "phone" || field === "whatsapp") {
      const digits = value.replace(/\D/g, "").slice(0, 11);
      if (digits.length > 10) {
        formattedValue = digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
      } else if (digits.length > 6) {
        formattedValue = digits.replace(/(\d{2})(\d{4})(\d{1,4})/, "($1) $2-$3");
      } else if (digits.length > 2) {
        formattedValue = digits.replace(/(\d{2})(\d{1,5})/, "($1) $2");
      } else {
        formattedValue = digits;
      }
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
  };

  // Abrir modal de criação
  const handleOpenCreate = () => {
    isFormDirtyRef.current = false;
    setFormData(EMPTY_FORM);
    setSuspectedDuplicates([]);
    setIsCreateOpen(true);
  };

  // Submissão da criação com deduplicação prévia
  const handleSubmitCreate = async (forceBypassDuplicateCheck = false) => {
    if (!formData.full_name.trim() || formData.full_name.trim().length < 2) {
      toast.error("Informe o nome completo do cliente (mínimo 2 caracteres).");
      return;
    }
    if (!formData.birth_date.trim()) {
      toast.error("Informe a data de nascimento.");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Informe o telefone de contato.");
      return;
    }

    setSubmitting(true);

    try {
      // Se não for submissão forçada e não houver CPF, checar possíveis homônimos por Nome + Data Nasc
      if (!forceBypassDuplicateCheck && !formData.cpf.trim()) {
        const dupCheck: DuplicateCheckResult = await fetchDuplicates({
          data: {
            fullName: formData.full_name.trim(),
            birthDate: formData.birth_date.trim(),
            motherName: formData.mother_name.trim() || undefined,
          },
        });

        if (dupCheck.hasSuspectedMatch && dupCheck.suspectedClients.length > 0) {
          setSuspectedDuplicates(dupCheck.suspectedClients);
          setIsDuplicateConfirmOpen(true);
          setSubmitting(false);
          return;
        }
      }

      await executeCreate({
        data: {
          full_name: formData.full_name,
          birth_date: formData.birth_date,
          phone: formData.phone,
          cpf: formData.cpf || null,
          mother_name: formData.mother_name || null,
          whatsapp: formData.whatsapp || null,
          email: formData.email || null,
          city: formData.city || null,
          profession: formData.profession || null,
          notes: formData.notes || null,
        },
      });

      toast.success("Cliente cadastrado com sucesso!");
      setIsCreateOpen(false);
      setIsDuplicateConfirmOpen(false);
      setFormData(EMPTY_FORM);
      void loadClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar cliente.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de edição com busca de dados completos e remoção de placeholders
  const handleOpenEdit = async (client: ClientRecord) => {
    isFormDirtyRef.current = false;
    setEditingClientId(client.id);

    // Formatação inicial segura (nunca carrega "-" ou placeholders de exibição no estado editável)
    setFormData({
      full_name: client.full_name || "",
      birth_date: client.birth_date || "",
      phone: client.phone ? formatPhone(client.phone) : "",
      cpf: client.cpf ? formatCpf(client.cpf) : "",
      mother_name: client.mother_name || "",
      whatsapp: client.whatsapp ? formatPhone(client.whatsapp) : "",
      email: client.email || "",
      city: client.city || "",
      profession: client.profession || "",
      notes: client.notes || "",
    });
    setIsEditOpen(true);

    // Atualiza o formulário com o registro completo mais recente do banco (apenas se o usuário não começou a editar)
    try {
      const latest = await fetchDetail({ data: { id: client.id } });
      if (latest && !isFormDirtyRef.current) {
        setFormData({
          full_name: latest.full_name || "",
          birth_date: latest.birth_date || "",
          phone: latest.phone ? formatPhone(latest.phone) : "",
          cpf: latest.cpf ? formatCpf(latest.cpf) : "",
          mother_name: latest.mother_name || "",
          whatsapp: latest.whatsapp ? formatPhone(latest.whatsapp) : "",
          email: latest.email || "",
          city: latest.city || "",
          profession: latest.profession || "",
          notes: latest.notes || "",
        });
      }
    } catch {
      // Mantém os dados da linha se falhar a busca individual
    }
  };

  // Submissão da edição com validação rigorosa e sanitização dos campos
  const handleSubmitEdit = async () => {
    if (!editingClientId) return;

    const trimmedName = formData.full_name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      toast.error("Informe o nome completo do cliente (mínimo 2 caracteres).");
      return;
    }

    const trimmedBirthDate = formData.birth_date.trim();
    if (!trimmedBirthDate || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedBirthDate)) {
      toast.error("Informe uma data de nascimento válida (AAAA-MM-DD).");
      return;
    }

    const rawPhoneDigits = formData.phone.replace(/\D/g, "");
    if (!rawPhoneDigits || rawPhoneDigits.length < 10) {
      toast.error("Informe um telefone de contato válido com DDD (mínimo 10 dígitos).");
      return;
    }

    const rawEmail = formData.email.trim();
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      toast.error("Informe um e-mail com formato válido.");
      return;
    }

    const rawCpfDigits = formData.cpf.replace(/\D/g, "");
    if (rawCpfDigits && rawCpfDigits.length !== 11) {
      toast.error("O CPF deve conter exatamente 11 dígitos numéricos.");
      return;
    }

    setSubmitting(true);
    try {
      await executeUpdate({
        data: {
          id: editingClientId,
          full_name: trimmedName,
          birth_date: trimmedBirthDate,
          phone: formData.phone.trim(),
          cpf: rawCpfDigits || null,
          mother_name: formData.mother_name.trim() || null,
          whatsapp: formData.whatsapp.trim() || null,
          email: rawEmail || null,
          city: formData.city.trim() || null,
          profession: formData.profession.trim() || null,
          notes: formData.notes.trim() || null,
        },
      });

      toast.success("Dados do cliente atualizados com sucesso!");
      setIsEditOpen(false);
      setEditingClientId(null);
      void loadClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar cliente.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de detalhes
  const handleOpenDetail = async (client: ClientRecord) => {
    setSelectedClient(client);
    setIsDetailOpen(true);
    try {
      const latest = await fetchDetail({ data: { id: client.id } });
      if (latest) {
        setSelectedClient(latest);
      }
    } catch {
      // Mantém os dados da lista se houver falha no fetch individual
    }
  };

  // Confirmação de arquivamento
  const handleOpenArchiveAlert = (client: ClientRecord) => {
    setTargetActionClientId(client.id);
    setTargetActionClientName(client.full_name);
    setIsArchiveAlertOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!targetActionClientId) return;
    setActionLoading(true);
    try {
      await executeArchive({ data: { id: targetActionClientId } });
      toast.success("Cliente arquivado com sucesso.");
      setIsArchiveAlertOpen(false);
      setTargetActionClientId(null);
      void loadClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao arquivar cliente.";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Confirmação de restauração
  const handleOpenRestoreAlert = (client: ClientRecord) => {
    setTargetActionClientId(client.id);
    setTargetActionClientName(client.full_name);
    setIsRestoreAlertOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!targetActionClientId) return;
    setActionLoading(true);
    try {
      await executeRestore({ data: { id: targetActionClientId } });
      toast.success("Ficha do cliente restaurada como Registrado.");
      setIsRestoreAlertOpen(false);
      setTargetActionClientId(null);
      void loadClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao restaurar cliente.";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="container-narrow py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl text-sage-deep">Clientes</h1>
            <Badge variant="outline" className="border-sage-deep/30 text-sage-deep font-normal">
              Cadastro Central
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão unificada de cadastros, contatos e preferências do Serenar.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="btn-serena gap-2">
          <UserPlus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="border border-border/60 bg-card/60 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por Nome, CPF ou Telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              Status:
            </span>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-44 bg-background">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="registered">Registrado</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Clientes */}
      <Card className="border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-cream/50">
              <TableRow>
                <TableHead className="font-semibold text-sage-deep">Cliente</TableHead>
                <TableHead className="font-semibold text-sage-deep">Contato</TableHead>
                <TableHead className="font-semibold text-sage-deep">Nascimento</TableHead>
                <TableHead className="font-semibold text-sage-deep">Cidade</TableHead>
                <TableHead className="font-semibold text-sage-deep">Origem</TableHead>
                <TableHead className="font-semibold text-sage-deep">Status</TableHead>
                <TableHead className="text-right font-semibold text-sage-deep">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                      <span>Carregando cadastros...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium text-sm">Nenhum cliente encontrado.</p>
                      <p className="text-xs text-muted-foreground">
                        {debouncedSearch
                          ? "Tente ajustar os termos da busca ou os filtros aplicados."
                          : "Clique em 'Novo Cliente' para registrar o primeiro cadastro."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-cream/20 transition-colors">
                    <TableCell className="font-medium">
                      <div>
                        <p className="text-sage-deep font-serif text-base">{client.full_name}</p>
                        {client.cpf && (
                          <p className="text-xs text-muted-foreground font-mono">
                            CPF: {formatCpf(client.cpf)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        <p className="text-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {formatPhone(client.phone)}
                        </p>
                        {client.email && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {client.email}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {formatDateDisplay(client.birth_date)}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">{client.city || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatSourceLabel(client.source)}
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Resumo"
                          onClick={() => handleOpenDetail(client)}
                          className="h-8 w-8 text-sage-deep hover:bg-blush"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Anamnese do Cliente"
                          onClick={() => handleOpenAnamnesis(client)}
                          className="h-8 w-8 text-sage-deep hover:bg-blush"
                        >
                          <ClipboardList className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Atendimentos do Cliente"
                          onClick={() => handleOpenSessions(client)}
                          className="h-8 w-8 text-sage-deep hover:bg-blush"
                        >
                          <Activity className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Consentimentos LGPD do Cliente"
                          onClick={() => handleOpenConsents(client)}
                          className="h-8 w-8 text-sage-deep hover:bg-blush"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Documentos e Anexos do Cliente"
                          onClick={() => handleOpenDocuments(client)}
                          className="h-8 w-8 text-sage-deep hover:bg-blush"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>

                        {client.status !== "archived" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar Ficha"
                              onClick={() => handleOpenEdit(client)}
                              className="h-8 w-8 text-sage-deep hover:bg-blush"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Arquivar Cliente"
                              onClick={() => handleOpenArchiveAlert(client)}
                              className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Restaurar Cliente"
                            onClick={() => handleOpenRestoreAlert(client)}
                            className="h-8 w-8 text-emerald-700 hover:bg-emerald-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Rodapé e Paginação */}
        {!loading && clients.length > 0 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-cream/20 text-xs text-muted-foreground">
            <div>
              Mostrando <span className="font-semibold text-foreground">{clients.length}</span> de{" "}
              <span className="font-semibold text-foreground">{totalCount}</span> registros
            </div>
            <div className="flex items-center gap-2">
              <span>
                Página <strong className="text-foreground">{page}</strong> de{" "}
                <strong className="text-foreground">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Modal: Novo Cliente */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-sage-deep">Novo Cliente</DialogTitle>
            <DialogDescription>
              Preencha os dados cadastrais do cliente para registrar no CRM Serenar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Nome Completo *</label>
              <Input
                placeholder="Ex: Maria da Silva"
                value={formData.full_name}
                onChange={(e) => handleInputChange("full_name", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Data de Nascimento *</label>
              <Input
                type="date"
                value={formData.birth_date}
                onChange={(e) => handleInputChange("birth_date", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Telefone Celular *</label>
              <Input
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">CPF (Opcional)</label>
              <Input
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => handleInputChange("cpf", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">WhatsApp (Opcional)</label>
              <Input
                placeholder="(00) 00000-0000"
                value={formData.whatsapp}
                onChange={(e) => handleInputChange("whatsapp", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">E-mail (Opcional)</label>
              <Input
                type="email"
                placeholder="cliente@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Nome da Mãe (Opcional)
              </label>
              <Input
                placeholder="Nome da mãe"
                value={formData.mother_name}
                onChange={(e) => handleInputChange("mother_name", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Cidade (Opcional)</label>
              <Input
                placeholder="Ex: Urubici / SC"
                value={formData.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Profissão (Opcional)</label>
              <Input
                placeholder="Ex: Professora"
                value={formData.profession}
                onChange={(e) => handleInputChange("profession", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Observações Internas (Opcional)
              </label>
              <Textarea
                placeholder="Preferências, restrições ou anotações cadastrais..."
                rows={3}
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleSubmitCreate(false)}
              disabled={submitting}
              className="btn-serena gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmação de Duplicidades Suspeitas (Sem CPF) */}
      <Dialog open={isDuplicateConfirmOpen} onOpenChange={setIsDuplicateConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center font-serif text-xl text-sage-deep">
              Possível Duplicidade Encontrada
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              Encontramos cliente(s) já cadastrado(s) com o mesmo Nome e Data de Nascimento:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {suspectedDuplicates.map((dup) => (
              <div
                key={dup.id}
                className="p-3 border border-border rounded-xl bg-cream/30 text-xs space-y-1"
              >
                <p className="font-semibold text-sage-deep">{dup.full_name}</p>
                <p className="text-muted-foreground">
                  Nascimento: {formatDateDisplay(dup.birth_date)}
                </p>
                {dup.cpf && (
                  <p className="text-muted-foreground font-mono">CPF: {maskCpfPartial(dup.cpf)}</p>
                )}
                <p className="text-muted-foreground">Telefone: {formatPhone(dup.phone)}</p>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto text-xs"
              onClick={() => setIsDuplicateConfirmOpen(false)}
            >
              Voltar e Revisar
            </Button>
            <Button
              className="w-full sm:w-auto text-xs btn-serena"
              disabled={submitting}
              onClick={() => handleSubmitCreate(true)}
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Criar Ficha Assim Mesmo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Cliente */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-sage-deep">Editar Cliente</DialogTitle>
            <DialogDescription>Atualize as informações cadastrais do cliente.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Nome Completo *</label>
              <Input
                value={formData.full_name}
                onChange={(e) => handleInputChange("full_name", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Data de Nascimento *</label>
              <Input
                type="date"
                value={formData.birth_date}
                onChange={(e) => handleInputChange("birth_date", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Telefone Celular *</label>
              <Input
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">CPF (Opcional)</label>
              <Input
                value={formData.cpf}
                onChange={(e) => handleInputChange("cpf", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">WhatsApp (Opcional)</label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => handleInputChange("whatsapp", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">E-mail (Opcional)</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Nome da Mãe (Opcional)
              </label>
              <Input
                value={formData.mother_name}
                onChange={(e) => handleInputChange("mother_name", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Cidade (Opcional)</label>
              <Input
                value={formData.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Profissão (Opcional)</label>
              <Input
                value={formData.profession}
                onChange={(e) => handleInputChange("profession", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Observações Internas (Opcional)
              </label>
              <Textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitEdit} disabled={submitting} className="btn-serena gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Dashboard / Ficha Consolidada do Cliente */}
      {selectedClient && (
        <AdminClientDashboard
          client={selectedClient}
          isOpen={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onOpenAnamnesis={() => handleOpenAnamnesis(selectedClient)}
          onOpenSessions={() => handleOpenSessions(selectedClient)}
        />
      )}

      {/* AlertDialog: Arquivamento */}
      <AlertDialog open={isArchiveAlertOpen} onOpenChange={setIsArchiveAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl text-sage-deep">
              Arquivar Cliente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                Você está prestes a arquivar a ficha de <strong>{targetActionClientName}</strong>.
              </p>
              <p>
                A ficha deixará de constar na listagem padrão de clientes ativos, mas todo o
                histórico do cliente será totalmente preservado no sistema e poderá ser restaurado a
                qualquer momento.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmArchive}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Arquivar Cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Restauração */}
      <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl text-sage-deep">
              Restaurar Cliente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                Deseja restaurar a ficha arquivada de <strong>{targetActionClientName}</strong>?
              </p>
              <p>
                O cliente retornará ao estado ativo como <strong>Registrado</strong> e voltará a
                figurar nas listagens normais do CRM.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={actionLoading}
              className="btn-serena"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Restaurar Ficha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Modal de Anamnese Integrado */}
      {anamnesisClient && (
        <AdminClientAnamnesis
          clientId={anamnesisClient.id}
          clientName={anamnesisClient.name}
          isOpen={isAnamnesisOpen}
          onOpenChange={setIsAnamnesisOpen}
        />
      )}
      {/* Modal de Sessões Clínicas / Atendimentos Integrado */}
      {sessionsClient && (
        <AdminClientSessions
          clientId={sessionsClient.id}
          clientName={sessionsClient.name}
          isOpen={isSessionsOpen}
          onOpenChange={setIsSessionsOpen}
        />
      )}
      {/* Modal de Consentimentos LGPD Integrado */}
      {consentsClient && (
        <AdminClientConsents
          clientId={consentsClient.id}
          clientName={consentsClient.name}
          isOpen={isConsentsOpen}
          onOpenChange={setIsConsentsOpen}
        />
      )}
      {/* Modal de Documentos do Cliente Integrado */}
      {documentsClient && (
        <AdminClientDocuments
          clientId={documentsClient.id}
          clientName={documentsClient.name}
          isOpen={isDocumentsOpen}
          onOpenChange={setIsDocumentsOpen}
        />
      )}
    </div>
  );
}
