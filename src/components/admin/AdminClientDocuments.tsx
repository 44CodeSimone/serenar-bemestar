import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Upload,
  Eye,
  Archive,
  Loader2,
  Calendar,
  RotateCcw,
  FileCheck,
  File,
  AlertTriangle,
  Plus,
  Ban,
  CheckCircle2,
  HardDrive,
  FileType,
} from "lucide-react";
import { toast } from "sonner";

import {
  listClientDocumentsFn,
  uploadClientDocumentFn,
  getSignedDocumentUrlFn,
  archiveClientDocumentFn,
} from "@/lib/documents.functions";
import type { ClientDocumentRow } from "@/lib/documents.repository";

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

interface AdminClientDocumentsProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DOCUMENT_TYPES = [
  { value: "identification", label: "Documento de Identificação (RG / CPF)", desc: "Cópia digitalizada do documento de identidade civil." },
  { value: "consent_evidence", label: "Evidência de Consentimento LGPD", desc: "Termo assinado físico ou digital de consentimento de privacidade." },
  { value: "clinical_attachment", label: "Anexo de Atendimento / Sessão", desc: "Arquivos vinculados a atendimentos ou evoluções de massoterapia." },
  { value: "external_exam", label: "Exame Externo / Laudo Médico", desc: "Exames de imagem, relatórios médicos ou atestados trazidos pelo cliente." },
  { value: "other", label: "Outro Documento Anexo", desc: "Comprovantes residenciais ou documentos gerais do cliente." },
] as const;

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

function getDocumentTypeLabel(type: string): string {
  const item = DOCUMENT_TYPES.find((d) => d.value === type);
  return item ? item.label : type;
}

function getMimeBadge(mime: string) {
  if (mime.includes("pdf")) {
    return (
      <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 font-mono text-[10px]">
        PDF
      </Badge>
    );
  }
  if (mime.includes("jpeg") || mime.includes("jpg")) {
    return (
      <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-700 font-mono text-[10px]">
        JPG
      </Badge>
    );
  }
  if (mime.includes("png")) {
    return (
      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 font-mono text-[10px]">
        PNG
      </Badge>
    );
  }
  if (mime.includes("webp")) {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 font-mono text-[10px]">
        WEBP
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">{mime}</Badge>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export default function AdminClientDocuments({
  clientId,
  clientName,
  isOpen,
  onOpenChange,
}: AdminClientDocumentsProps) {
  // TanStack Start Server Functions
  const fetchDocuments = useServerFn(listClientDocumentsFn);
  const uploadDocument = useServerFn(uploadClientDocumentFn);
  const getSignedUrl = useServerFn(getSignedDocumentUrlFn);
  const archiveDocument = useServerFn(archiveClientDocumentFn);

  // Estados de dados e interface
  const [documents, setDocuments] = useState<ClientDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  // Formulário de upload
  const [documentType, setDocumentType] = useState<string>("identification");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Estado do modal de confirmação de arquivamento
  const [targetArchiveDoc, setTargetArchiveDoc] = useState<ClientDocumentRow | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Carregar lista de documentos do cliente
  const loadDocuments = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await fetchDocuments({
        data: { clientId, includeArchived },
      });
      setDocuments(res);
    } catch {
      toast.error("Erro ao carregar a lista de documentos do cliente.");
    } finally {
      setLoading(false);
    }
  }, [fetchDocuments, clientId, includeArchived]);

  useEffect(() => {
    if (isOpen && clientId) {
      void loadDocuments();
      setIsFormOpen(false);
      setSelectedFile(null);
    }
  }, [isOpen, clientId, loadDocuments]);

  // Handler de alteração no seletor de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      if (!ALLOWED_MIMES.includes(file.type.toLowerCase())) {
        toast.error(`Tipo de arquivo não suportado (${file.type}). Formatos aceitos: PDF, JPEG, PNG e WEBP.`);
        e.target.value = "";
        setSelectedFile(null);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error("O arquivo excede o limite máximo permitido de 10 MB.");
        e.target.value = "";
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
    }
  };

  // Submissão do upload de documento
  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error("Selecione um arquivo para realizar o upload.");
      return;
    }
    if (!documentType) {
      toast.error("Selecione a categoria do documento.");
      return;
    }

    setSubmitting(true);

    try {
      const fileBase64 = await fileToBase64(selectedFile);

      await uploadDocument({
        data: {
          clientId,
          documentType,
          originalFilename: selectedFile.name,
          mimeType: selectedFile.type.toLowerCase(),
          fileSizeBytes: selectedFile.size,
          fileBase64,
        },
      });

      toast.success("Documento enviado e armazenado com sucesso!");
      setIsFormOpen(false);
      setSelectedFile(null);
      await loadDocuments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao realizar upload do documento.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Visualizar / Baixar documento via Signed URL segura
  const handleViewDocument = async (doc: ClientDocumentRow) => {
    setViewingDocId(doc.id);
    try {
      const res = await getSignedUrl({
        data: { documentId: doc.id },
      });

      if (res.signedUrl) {
        window.open(res.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Não foi possível gerar a URL de visualização.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao obter acesso ao documento.";
      toast.error(msg);
    } finally {
      setViewingDocId(null);
    }
  };

  // Confirmar arquivamento lógico do documento
  const handleConfirmArchive = async () => {
    if (!targetArchiveDoc) return;
    setArchiving(true);

    try {
      await archiveDocument({
        data: { documentId: targetArchiveDoc.id },
      });

      toast.success("Documento arquivado com sucesso. O arquivo foi mantido de forma segura.");
      setTargetArchiveDoc(null);
      await loadDocuments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao arquivar o documento.";
      toast.error(msg);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-sage-deep" />
                <div>
                  <DialogTitle className="font-serif text-2xl text-sage-deep">
                    Documentos e Anexos do Cliente
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Cliente: <strong className="text-foreground font-semibold">{clientName}</strong> — Armazenamento seguro de exames, identidades e termos.
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIncludeArchived((prev) => !prev)}
                  className="text-xs border-border hover:bg-cream/50"
                >
                  {includeArchived ? "Ocultar Arquivados" : "Mostrar Arquivados"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadDocuments()}
                  disabled={loading}
                  className="gap-1.5 text-xs border-sage-deep/30 text-sage-deep hover:bg-blush"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Form / Card de Upload de Novo Documento */}
          {isFormOpen ? (
            <Card className="border border-sage-deep/30 bg-cream/30 shadow-xs mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif text-sage-deep flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Anexar Novo Documento Privado
                  </span>
                  <Badge variant="outline" className="border-sage-deep/30 text-sage-deep text-[11px]">
                    Bucket Privado 100% Criptografado
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitUpload} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Categoria / Tipo de Documento */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-sage-deep">
                        Categoria do Documento *
                      </label>
                      <Select
                        value={documentType}
                        onValueChange={(val) => setDocumentType(val)}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((dt) => (
                            <SelectItem key={dt.value} value={dt.value}>
                              <span className="font-medium text-xs">{dt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        {DOCUMENT_TYPES.find((d) => d.value === documentType)?.desc}
                      </p>
                    </div>

                    {/* Seleção do Arquivo no Computador */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-sage-deep">
                        Arquivo * (PDF, JPG, PNG, WEBP — máx 10 MB)
                      </label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileChange}
                        className="bg-background text-xs cursor-pointer file:cursor-pointer file:text-sage-deep file:font-medium"
                      />
                      {selectedFile && (
                        <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                          <FileCheck className="h-3.5 w-3.5" /> Arquivo selecionado: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsFormOpen(false);
                        setSelectedFile(null);
                      }}
                      disabled={submitting}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submitting || !selectedFile}
                      className="btn-serena gap-1.5"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Fazer Upload Seguro
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-sage-deep/30 bg-cream/50 text-sage-deep text-xs font-medium">
                  {documents.length} {documents.length === 1 ? "documento anexo" : "documentos anexos"}
                </Badge>
              </div>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="btn-serena gap-1.5 text-xs"
              >
                <Plus className="h-4 w-4" /> Anexar Documento
              </Button>
            </div>
          )}

          {/* Tabela de Documentos Anexados */}
          <Card className="border border-border shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-cream/40">
                  <TableRow>
                    <TableHead className="font-semibold text-sage-deep">Status</TableHead>
                    <TableHead className="font-semibold text-sage-deep">Nome do Arquivo / Categoria</TableHead>
                    <TableHead className="font-semibold text-sage-deep">Formato / Tamanho</TableHead>
                    <TableHead className="font-semibold text-sage-deep">Data de Envio</TableHead>
                    <TableHead className="text-right font-semibold text-sage-deep">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
                          <span>Carregando documentos do cliente...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-36 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <File className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-medium text-sm">Nenhum documento cadastrado para este cliente.</p>
                          <p className="text-xs text-muted-foreground">
                            Clique em "Anexar Documento" para salvar PDFs, fotos de exames ou termos digitais.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => {
                      const isArchived = Boolean(doc.archived_at);

                      return (
                        <TableRow key={doc.id} className="hover:bg-cream/20 transition-colors">
                          <TableCell>
                            {isArchived ? (
                              <Badge variant="destructive" className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium text-[11px] gap-1">
                                <Ban className="h-3 w-3" /> Arquivado
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Ativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              <p className="text-sage-deep font-serif text-sm flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-sage-deep/70" />
                                {doc.original_filename}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {getDocumentTypeLabel(doc.document_type)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              {getMimeBadge(doc.mime_type)}
                              <span className="text-muted-foreground font-mono text-[11px]">
                                {formatFileSize(doc.file_size)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-foreground">
                            <div className="space-y-0.5">
                              <p className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {formatDateTimeDisplay(doc.created_at)}
                              </p>
                              {doc.archived_at && (
                                <p className="text-muted-foreground text-[11px] italic">
                                  Arquivado em: {formatDateTimeDisplay(doc.archived_at)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!isArchived && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Visualizar / Abrir Documento Privado"
                                  onClick={() => handleViewDocument(doc)}
                                  disabled={viewingDocId === doc.id}
                                  className="h-8 w-8 text-sage-deep hover:bg-blush"
                                >
                                  {viewingDocId === doc.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-sage-deep" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              )}

                              {!isArchived ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Arquivar Documento"
                                  onClick={() => setTargetArchiveDoc(doc)}
                                  className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic px-2">
                                  Arquivado
                                </span>
                              )}
                            </div>
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

      {/* AlertDialog: Confirmação de Arquivamento de Documento */}
      <AlertDialog
        open={Boolean(targetArchiveDoc)}
        onOpenChange={(open) => {
          if (!open) setTargetArchiveDoc(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-slate-800 mb-1">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <AlertDialogTitle className="font-serif text-xl">
                Arquivar Documento?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-foreground space-y-2">
              <p>
                Deseja arquivar o documento <strong>{targetArchiveDoc?.original_filename}</strong> do cliente <strong>{clientName}</strong>?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-[11px] space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5 text-amber-700" /> Preservação de Dados de Saúde:
                </p>
                <p>
                  O arquivo e os metadados <strong>NUNCA serão excluídos</strong>. O documento apenas deixará de figurar nas consultas ativas normais do sistema.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmArchive}
              disabled={archiving}
              className="bg-slate-700 hover:bg-slate-800 text-white font-medium gap-1.5"
            >
              {archiving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Arquivamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
