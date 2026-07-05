import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf } from "lucide-react";

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

function Blog() {
  return (
    <section className="container-narrow py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow mb-3">Blog Serenar</p>
        <h1 className="display-serif text-5xl">
          Leituras <span className="italic text-sage">calmas</span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          Em breve: reflexões sobre autocuidado, técnicas de respiração, sono reparador
          e como manter a serenidade nos dias corridos.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-md rounded-[2rem] border border-border bg-cream/60 p-10 text-center shadow-soft">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush text-gold">
          <Leaf className="h-6 w-6" />
        </div>
        <p className="font-serif text-2xl text-sage-deep">Nossos artigos estão brotando</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Enquanto os primeiros textos florescem, siga o Serenar no Instagram para
          reflexões diárias sobre bem-estar.
        </p>
        <a
          href="https://instagram.com/serenar_massoterapiaebemestar"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-serena mt-6"
        >
          Seguir no Instagram
        </a>
        <div className="mt-6">
          <Link to="/servicos" className="text-sm text-muted-foreground hover:text-sage-deep">
            Enquanto isso, conheça nossos serviços →
          </Link>
        </div>
      </div>
    </section>
  );
}
