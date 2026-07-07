import { createFileRoute } from "@tanstack/react-router";
import { Quote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/depoimentos")({
  ssr: false,
  component: AdminTestimonialsPlaceholder,
});

function AdminTestimonialsPlaceholder() {
  return (
    <div className="p-6 md:p-10">
      <p className="eyebrow mb-2">Conteúdo</p>
      <h1 className="font-serif text-4xl text-sage-deep">Depoimentos</h1>
      <div className="mt-8 rounded-2xl border border-border bg-cream/40 p-8 text-sm text-muted-foreground shadow-soft">
        <Quote className="mb-3 h-6 w-6 text-gold" />
        Em breve você poderá cadastrar, editar e destacar depoimentos de clientes por aqui.
      </div>
    </div>
  );
}
