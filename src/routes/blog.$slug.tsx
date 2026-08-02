import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { absoluteSiteUrl, createSeoHead } from "@/lib/seo";

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
  head: ({ loaderData, params }) => {
    const p = loaderData?.post as
      | {
          title?: string;
          seo_title?: string;
          seo_description?: string;
          excerpt?: string;
          cover_image_url?: string;
          published_at?: string;
          updated_at?: string;
        }
      | undefined;
    const title = `${p?.seo_title || p?.title || "Post"} | Serenar`;
    const description = p?.seo_description || p?.excerpt || "Artigo do Blog Serenar.";
    const path = `/blog/${encodeURIComponent(params.slug)}`;
    const seo = createSeoHead({
      title,
      description,
      path,
      type: "article",
      image: p?.cover_image_url,
    });

    return {
      ...seo,
      meta: [
        ...seo.meta,
        ...(p?.published_at
          ? [{ property: "article:published_time", content: p.published_at }]
          : []),
        ...(p?.updated_at ? [{ property: "article:modified_time", content: p.updated_at }] : []),
      ],
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: p.title,
                description,
                url: absoluteSiteUrl(path),
                mainEntityOfPage: absoluteSiteUrl(path),
                ...(p.cover_image_url ? { image: p.cover_image_url } : {}),
                ...(p.published_at ? { datePublished: p.published_at } : {}),
                ...(p.updated_at ? { dateModified: p.updated_at } : {}),
                author: { "@type": "Person", name: "Mariah Luz" },
                publisher: { "@type": "Organization", name: "Serenar" },
              }),
            },
          ]
        : [],
    };
  },
  errorComponent: ({ error }) => {
    // Log full detail server-side / to console; never render to the user.
    if (typeof console !== "undefined") console.error("[blog/$slug] load error", error);
    return (
      <div className="container-narrow py-20 text-center text-destructive">
        Não foi possível carregar este post. Tente novamente em instantes.
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="container-narrow py-24 text-center">
      <p className="font-serif text-2xl text-sage-deep">Post não encontrado.</p>
      <Link to="/blog" className="btn-serena-outline mt-6">
        Voltar ao blog
      </Link>
    </div>
  ),
  component: BlogPost,
});

function BlogPost() {
  const { post } = Route.useLoaderData() as {
    post: {
      title: string;
      excerpt: string | null;
      content: string | null;
      cover_image_url: string | null;
      category: string | null;
      published_at: string | null;
    };
  };
  return (
    <article className="container-narrow py-16 md:py-24">
      <Link
        to="/blog"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-sage-deep"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      {post.category && <p className="eyebrow">{post.category}</p>}
      <h1 className="display-serif mt-2 text-4xl md:text-5xl">{post.title}</h1>
      {post.published_at && (
        <p className="mt-3 text-sm text-muted-foreground">
          {new Date(post.published_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt={post.title}
          className="mt-8 aspect-video w-full rounded-2xl object-cover"
        />
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
