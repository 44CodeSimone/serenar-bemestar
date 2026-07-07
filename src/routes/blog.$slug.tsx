import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/blog/$slug")({
  ssr: false,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!data) throw notFound();
    return { post: data };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.post as { title?: string; seo_title?: string; seo_description?: string; excerpt?: string; cover_image_url?: string } | undefined;
    return {
      meta: [
        { title: `${p?.seo_title || p?.title || "Post"} | Serenar` },
        { name: "description", content: p?.seo_description || p?.excerpt || "" },
        { property: "og:title", content: p?.seo_title || p?.title || "Post" },
        { property: "og:description", content: p?.seo_description || p?.excerpt || "" },
        ...(p?.cover_image_url ? [{ property: "og:image", content: p.cover_image_url }] : []),
      ],
    };
  },
  errorComponent: ({ error }) => <div className="container-narrow py-20 text-center text-destructive">{String(error)}</div>,
  notFoundComponent: () => (
    <div className="container-narrow py-24 text-center">
      <p className="font-serif text-2xl text-sage-deep">Post não encontrado.</p>
      <Link to="/blog" className="btn-serena-outline mt-6">Voltar ao blog</Link>
    </div>
  ),
  component: BlogPost,
});

function BlogPost() {
  const { post } = Route.useLoaderData() as { post: {
    title: string; excerpt: string | null; content: string | null;
    cover_image_url: string | null; category: string | null; published_at: string | null;
  } };
  return (
    <article className="container-narrow py-16 md:py-24">
      <Link to="/blog" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-sage-deep">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      {post.category && <p className="eyebrow">{post.category}</p>}
      <h1 className="display-serif mt-2 text-4xl md:text-5xl">{post.title}</h1>
      {post.published_at && (
        <p className="mt-3 text-sm text-muted-foreground">
          {new Date(post.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      )}
      {post.cover_image_url && (
        <img src={post.cover_image_url} alt={post.title} className="mt-8 aspect-video w-full rounded-2xl object-cover" />
      )}
      {post.excerpt && <p className="mt-6 text-lg text-muted-foreground">{post.excerpt}</p>}
      {post.content && (
        <div className="prose prose-sage mt-8 max-w-none whitespace-pre-wrap text-foreground">
          {post.content}
        </div>
      )}
    </article>
  );
}
