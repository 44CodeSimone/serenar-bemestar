import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPTED_IMAGE_MIMES,
  MAX_IMAGE_MB,
  deleteSiteImage,
  uploadSiteImage,
  type SiteImage,
} from "@/lib/cms";

export const Route = createFileRoute("/_authenticated/admin/imagens")({
  ssr: false,
  component: AdminImages,
});

const TAGS = ["hero", "servico", "sobre", "blog", "galeria", "outros"];

function AdminImages() {
  const [items, setItems] = useState<SiteImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [alt, setAlt] = useState("");
  const [tag, setTag] = useState("outros");
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("site_images")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as SiteImage[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function onUpload(file: File) {
    setUploading(true);
    setMsg(null);
    try {
      await uploadSiteImage(file, alt, tag);
      setAlt("");
      setMsg({ tone: "ok", text: "Imagem enviada com sucesso." });
      await load();
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Falha no upload." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(img: SiteImage) {
    if (!confirm("Excluir esta imagem? Ela deixará de estar disponível no site.")) return;
    try {
      await deleteSiteImage(img);
      setMsg({ tone: "ok", text: "Imagem excluída." });
      await load();
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Falha ao excluir." });
    }
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setMsg({ tone: "ok", text: "Link copiado." });
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6">
        <p className="eyebrow mb-2">Biblioteca</p>
        <h1 className="font-serif text-4xl text-sage-deep">Imagens do site</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Envie fotos para usar no site. Formatos aceitos: JPG, PNG, WEBP. Tamanho máximo: {MAX_IMAGE_MB} MB.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-border bg-cream/40 p-5 shadow-soft">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Texto alternativo (alt)</label>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Descreva a imagem (para acessibilidade e SEO)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Categoria</label>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
            >
              {TAGS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGE_MIMES.join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="btn-serena"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Enviar imagem</>}
          </button>
          {msg && (
            <span className={"text-sm " + (msg.tone === "ok" ? "text-sage-deep" : "text-destructive")}>{msg.text}</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-sage-deep" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma imagem enviada ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((img) => (
            <div key={img.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="aspect-video overflow-hidden bg-blush/30">
                {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
                <img src={img.public_url} alt={img.alt || "imagem"} className="h-full w-full object-cover" />
              </div>
              <div className="p-3">
                <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{img.tag}</p>
                <p className="mt-1 line-clamp-2 text-sm text-foreground">{img.alt || <em className="text-muted-foreground">sem descrição</em>}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={() => copy(img.public_url)} className="inline-flex items-center gap-1 text-xs text-sage-deep hover:opacity-70">
                    <Copy className="h-3.5 w-3.5" /> Copiar link
                  </button>
                  <button onClick={() => onDelete(img)} className="inline-flex items-center gap-1 text-xs text-destructive hover:opacity-70">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
