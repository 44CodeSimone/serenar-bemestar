import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Perguntas frequentes — Serenar Massoterapia" },
      {
        name: "description",
        content: "Tire suas dúvidas sobre massagens, agendamentos, formas de pagamento e cuidados antes e depois das sessões no Serenar.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

const FAQS = [
  { q: "Preciso agendar com antecedência?", a: "Sim. Trabalhamos com horários exclusivos para garantir um atendimento sem pressa. Recomendamos reservar com pelo menos 3 dias de antecedência." },
  { q: "Qual a duração de cada sessão?", a: "Depende do serviço: sessões variam de 45 a 90 minutos. Você encontra a duração exata na página de cada ritual." },
  { q: "Como funciona o pagamento?", a: "Aceitamos Pix, transferência e cartões. O valor é combinado por WhatsApp no momento da confirmação, para personalizar cada atendimento." },
  { q: "Posso remarcar minha sessão?", a: "Claro. Pedimos apenas que avise com no mínimo 24 horas de antecedência para reorganizarmos a agenda." },
  { q: "Existe contraindicação para massagens?", a: "Sim. Casos como trombose, febre, infecções ativas e algumas fases da gestação exigem avaliação. Comente sua condição no agendamento — a Mariah orientará com cuidado." },
  { q: "Como é o ambiente do espaço?", a: "Silencioso, com aromas suaves e luz âmbar. Tudo pensado para você chegar e desacelerar imediatamente." },
  { q: "Vocês oferecem pacotes?", a: "Sim, temos pacotes de sessões e cartões-presente. Fale conosco no WhatsApp para conhecer as opções atuais." },
  { q: "Posso levar acompanhante?", a: "Preferimos que a sessão seja um tempo só seu, mas caso precise, avise antes para adequarmos o ambiente." },
];

function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="container-narrow py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-3">Perguntas frequentes</p>
        <h1 className="display-serif text-5xl">
          Dúvidas <span className="italic text-sage">comuns</span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          Não achou sua resposta? A Serená (nossa assistente) ou a Mariah no WhatsApp estarão felizes em ajudar.
        </p>

        <div className="mt-12 space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="rounded-2xl border border-border bg-card">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-serif text-lg text-sage-deep">{item.q}</span>
                  <ChevronDown className={"h-4 w-4 text-gold transition-transform " + (isOpen ? "rotate-180" : "")} />
                </button>
                {isOpen && (
                  <p className="border-t border-border/50 p-5 pt-4 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-14 text-center">
          <Link to="/contato" className="btn-serena-outline">Ainda tenho uma dúvida</Link>
        </div>
      </div>
    </section>
  );
}
