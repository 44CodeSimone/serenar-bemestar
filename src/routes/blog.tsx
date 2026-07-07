import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Bem-estar e autocuidado | Serenar" },
      {
        name: "description",
        content: "Artigos sobre massoterapia, autocuidado, respiração, sono e rotinas de bem-estar por Mariah Luz e o time Serenar.",
      },
    ],
  }),
  component: Blog,
});

type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  published_at: string | null;
};

function Blog() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_image_url, category, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      setPosts((data ?? []) as PostRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <section className="container-narrow py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow mb-3">Blog Serenar</p>
        <h1 className="display-serif text-5xl">
          Leituras <span className="italic text-sage">calmas</span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          Reflexões sobre autocuidado, técnicas de respiração, sono reparador e como
          manter a serenidade nos dias corridos.
        </p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-sage-deep" /></div>
      ) : posts.length === 0 ? (
        <div className="mx-auto mt-14 max-w-md rounded-[2rem] border border-border bg-cream/60 p-10 text-center shadow-soft">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush text-gold">
            <Leaf className="h-6 w-6" />
          </div>
          <p className="font-serif text-2xl text-sage-deep">Nossos artigos estão brotando</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Enquanto os primeiros textos florescem, siga o Serenar no Instagram para reflexões diárias sobre bem-estar.
          </p>
          <a
            href="https://instagram.com/serenar_massoterapiaebemestar"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-serena mt-6"
          >
            Seguir no Instagram
          </a>
        </div>
      ) : (
        <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link
              key={p.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={"/blog/$slug" as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              params={{ slug: p.slug } as any}
              className="card-serena flex flex-col overflow-hidden text-left"
            >
              {p.cover_image_url && (
                <div className="-mx-6 -mt-6 mb-4 aspect-video overflow-hidden bg-blush/30">
                  <img src={p.cover_image_url} alt={p.title} className="h-full w-full object-cover" />
                </div>
              )}
              {p.category && <p className="eyebrow">{p.category}</p>}
              <h2 className="mt-2 font-serif text-2xl text-sage-deep">{p.title}</h2>
              {p.excerpt && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>}
              {p.published_at && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {new Date(p.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
