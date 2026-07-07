import { createFileRoute, Link } from "@tanstack/react-router";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { SITE } from "@/lib/site-config";
import { WhatsappGroupSection } from "@/components/site/WhatsappGroupSection";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Serenar Massoterapia | Urubici/SC" },
      {
        name: "description",
        content: "Fale com o Serenar por WhatsApp, Instagram ou email. Estamos em Urubici/SC, prontas para te receber.",
      },
    ],
  }),
  component: Contato,
});

function Contato() {
  return (
    <>
      <section className="container-narrow py-16 md:py-24 text-center">
        <p className="eyebrow mb-3">Vamos conversar</p>
        <h1 className="display-serif text-5xl md:text-6xl">
          Fale com o <span className="italic text-sage">Serenar</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
          Prefere WhatsApp? Instagram? Ou uma primeira visita ao espaço?
          Todos os caminhos são bem-vindos.
        </p>
      </section>

      <section className="container-narrow grid gap-8 pb-24 md:grid-cols-2 lg:grid-cols-4">
        {CONTACTS.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target={c.external ? "_blank" : undefined}
            rel={c.external ? "noopener noreferrer" : undefined}
            className="card-serena flex flex-col items-center text-center transition-transform hover:-translate-y-1"
          >
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush text-gold">
              <c.icon className="h-6 w-6" />
            </div>
            <p className="eyebrow">{c.label}</p>
            <p className="mt-2 font-serif text-lg text-sage-deep">{c.value}</p>
          </a>
        ))}
      </section>

      <section className="bg-blush/40 py-24">
        <div className="container-narrow grid gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-3">Horários</p>
            <h2 className="display-serif text-4xl">Quando <span className="italic text-sage">nos visitar</span></h2>
            <ul className="mt-8 space-y-3">
              {SITE.hours.map((h) => (
                <li key={h.day} className="flex items-center justify-between border-b border-border/60 pb-3 text-sm">
                  <span className="text-foreground">{h.day}</span>
                  <span className="text-muted-foreground">{h.time}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link to="/agendamento" className="btn-serena">Reservar horário</Link>
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3">Localização</p>
            <h2 className="display-serif text-4xl">{SITE.city}</h2>
            <p className="mt-4 text-muted-foreground">
              Estamos em {SITE.address}. O endereço completo é enviado após confirmação de agendamento,
              para preservar a tranquilidade do espaço.
            </p>
            <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-border bg-cream/60 shadow-soft">
              <iframe
                title="Mapa Urubici"
                src="https://www.google.com/maps?q=Urubici+SC&output=embed"
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <WhatsappGroupSection surface="contact" />
    </>
  );
}

const CONTACTS = [
  { icon: Phone, label: "WhatsApp", value: SITE.whatsapp.display, href: SITE.whatsapp.link, external: true },
  { icon: Instagram, label: "Instagram", value: SITE.instagram.handle, href: SITE.instagram.url, external: true },
  { icon: Mail, label: "Email", value: SITE.email, href: `mailto:${SITE.email}`, external: false },
  { icon: MapPin, label: "Localização", value: SITE.city, href: "https://maps.google.com/?q=Urubici+SC", external: true },
];
