import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  ssr: false,
  component: AdminSeoPlaceholder,
});

function AdminSeoPlaceholder() {
  return (
    <div className="p-6 md:p-10">
      <p className="eyebrow mb-2">SEO</p>
      <h1 className="font-serif text-4xl text-sage-deep">Metadados & SEO</h1>
      <div className="mt-8 rounded-2xl border border-border bg-cream/40 p-8 text-sm text-muted-foreground shadow-soft">
        <Search className="mb-3 h-6 w-6 text-gold" />
        Enquanto essa área ganha um editor completo, você pode ajustar o
        <em> título</em> e a <em>descrição</em> da home em <strong>Conteúdo do site → SEO</strong>,
        e os SEO por post em <strong>Blog</strong>.
      </div>
    </div>
  );
}
