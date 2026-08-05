import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE } from "@/lib/site-config";
import { createSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/termos")({
  head: () =>
    createSeoHead({
      title: "Termos de Uso — Serenar",
      description: "Consulte os termos de uso do site Serenar Massoterapia e Bem-Estar.",
      path: "/termos",
    }),
  component: () => (
    <section className="container-narrow max-w-3xl py-16 md:py-24">
      <p className="eyebrow mb-3">Termos</p>
      <h1 className="display-serif text-5xl">Termos de Uso</h1>
      <div className="mt-8 space-y-4 text-muted-foreground">
        <p>
          Ao usar o site do {SITE.name}, você concorda com estes termos. Os conteúdos são
          informativos e não substituem orientação médica.
        </p>
        <p>
          Agendamentos feitos pelo site são pedidos de reserva — a confirmação oficial acontece via
          WhatsApp com {SITE.therapist}.
        </p>
        <p>
          Reservamo-nos o direito de reagendar horários em caso de imprevistos, sempre com aviso
          antecipado.
        </p>
      </div>
      <div className="mt-10">
        <Link to="/" className="btn-serena-outline">
          Voltar
        </Link>
      </div>
    </section>
  ),
});
