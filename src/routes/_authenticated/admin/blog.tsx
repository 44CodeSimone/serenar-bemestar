import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/blog")({
  ssr: false,
  component: AdminBlog,
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  category: string | null;
  tags: unknown;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  published_at: string | null;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function AdminBlog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Post | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    setPosts((data ?? []) as Post[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function newPost() {
    setEditing({
      id: "",
      slug: "",
      title: "",
      excerpt: "",
      content: "",
      cover_image_url: "",
      category: "",
      tags: [],
      status: "draft",
      seo_title: "",
      seo_description: "",
      seo_keywords: "",
      published_at: null,
    });
  }

  async function save(p: Post) {
    setMsg(null);
    const payload = {
      slug: p.slug || slugify(p.title),
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      cover_image_url: p.cover_image_url,
      category: p.category,
      tags: (p.tags ?? []) as never,
      status: p.status,
      seo_title: p.seo_title,
      seo_description: p.seo_description,
      seo_keywords: p.seo_keywords,
      published_at: p.status === "published" ? (p.published_at ?? new Date().toISOString()) : p.published_at,
    };
    if (!payload.title.trim()) return setMsg("Título é obrigatório.");
    if (p.id) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", p.id);
      if (error) return setMsg(`Erro: ${error.message}`);
    } else {
      const { data, error } = await supabase.from("blog_posts").insert(payload).select().single();
      if (error) return setMsg(`Erro: ${error.message}`);
      setEditing({ ...(data as Post) });
    }
    setMsg("Post salvo.");
    await load();
  }

  async function togglePublish(p: Post) {
    const status = p.status === "published" ? "draft" : "published";
    await supabase.from("blog_posts").update({
      status,
      published_at: status === "published" ? (p.published_at ?? new Date().toISOString()) : p.published_at,
    }).eq("id", p.id);
    await load();
  }

  async function remove(p: Post) {
    if (!confirm(`Excluir o post "${p.title}"?`)) return;
    await supabase.from("blog_posts").delete().eq("id", p.id);
    if (editing?.id === p.id) setEditing(null);
    await load();
  }

  if (editing) {
    return (
      <div className="p-6 md:p-10">
        <button onClick={() => setEditing(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-sage-deep">
          <ArrowLeft className="h-4 w-4" /> Voltar para lista
        </button>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-3xl text-sage-deep">{editing.id ? "Editar post" : "Novo post"}</h1>
          <button onClick={() => save(editing)} className="btn-serena"><Save className="h-4 w-4" /> Salvar</button>
        </div>
        {msg && <p className="mb-6 rounded-xl bg-blush px-4 py-2 text-sm text-sage-deep">{msg}</p>}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Field label="Título" value={editing.title} onChange={(v) => setEditing({ ...editing, title: v, slug: editing.slug || slugify(v) })} />
            <Field label="Slug (URL)" value={editing.slug} onChange={(v) => setEditing({ ...editing, slug: slugify(v) })} />
            <Field label="Resumo" value={editing.excerpt ?? ""} onChange={(v) => setEditing({ ...editing, excerpt: v })} textarea />
            <Field label="Conteúdo (aceita Markdown)" value={editing.content ?? ""} onChange={(v) => setEditing({ ...editing, content: v })} rows={16} />
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-cream/40 p-4">
              <label className="block text-xs uppercase tracking-wider text-muted-foreground">Status</label>
              <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
              </select>
              <label className="mt-3 block text-xs uppercase tracking-wider text-muted-foreground">Data de publicação</label>
              <input
                type="datetime-local"
                value={editing.published_at ? editing.published_at.slice(0, 16) : ""}
                onChange={(e) => setEditing({ ...editing, published_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <Field label="URL da imagem de capa" value={editing.cover_image_url ?? ""} onChange={(v) => setEditing({ ...editing, cover_image_url: v })} />
            {editing.cover_image_url && (
              <img src={editing.cover_image_url} alt="capa" className="aspect-video w-full rounded-xl object-cover" />
            )}
            <Field label="Categoria" value={editing.category ?? ""} onChange={(v) => setEditing({ ...editing, category: v })} />
            <Field
              label="Tags (separadas por vírgula)"
              value={Array.isArray(editing.tags) ? (editing.tags as string[]).join(", ") : ""}
              onChange={(v) => setEditing({ ...editing, tags: v.split(",").map((t) => t.trim()).filter(Boolean) })}
            />
            <Field label="SEO — título" value={editing.seo_title ?? ""} onChange={(v) => setEditing({ ...editing, seo_title: v })} />
            <Field label="SEO — descrição" value={editing.seo_description ?? ""} onChange={(v) => setEditing({ ...editing, seo_description: v })} textarea />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">Conteúdo</p>
          <h1 className="font-serif text-4xl text-sage-deep">Blog</h1>
        </div>
        <button onClick={newPost} className="btn-serena"><Plus className="h-4 w-4" /> Novo post</button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-sage-deep" /></div>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum post criado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Publicação</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(p)} className="text-left font-medium text-sage-deep hover:underline">{p.title}</button>
                    <p className="text-xs text-muted-foreground">/{p.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2 py-0.5 text-xs " + (p.status === "published" ? "bg-sage/20 text-sage-deep" : "bg-blush text-gold")}>
                      {p.status === "published" ? "Publicado" : "Rascunho"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => togglePublish(p)} className="text-xs text-sage-deep hover:opacity-70">
                        {p.status === "published" ? <><EyeOff className="mr-1 inline h-3.5 w-3.5" />Despublicar</> : <><Eye className="mr-1 inline h-3.5 w-3.5" />Publicar</>}
                      </button>
                      <button onClick={() => remove(p)} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, textarea, rows,
}: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {textarea || rows ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows ?? 3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage" />
      )}
    </label>
  );
}
