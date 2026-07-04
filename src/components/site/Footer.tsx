import { Link } from "@tanstack/react-router";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "./Logo";
import { SITE } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border/60 bg-cream/60">
      <div className="container-narrow grid gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-2 space-y-5">
          <Logo className="h-16 w-auto" />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {SITE.description}
          </p>
          <div className="flex items-center gap-2 pt-2">
            <a
              href={SITE.instagram.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-sage-deep transition-colors hover:bg-blush"
              aria-label="Instagram"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href={SITE.whatsapp.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-sage-deep transition-colors hover:bg-blush"
              aria-label="WhatsApp"
            >
              <Phone className="h-4 w-4" />
            </a>
            <a
              href={`mailto:${SITE.email}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-sage-deep transition-colors hover:bg-blush"
              aria-label="Email"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-4">Navegue</p>
          <ul className="space-y-2 text-sm">
            {[
              { to: "/sobre", label: "Sobre" },
              { to: "/servicos", label: "Serviços" },
              { to: "/agendamento", label: "Agendamento" },
              { to: "/blog", label: "Blog" },
              { to: "/faq", label: "Perguntas frequentes" },
              { to: "/contato", label: "Contato" },
            ].map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-foreground/70 transition-colors hover:text-sage-deep">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Encontre-nos</p>
          <ul className="space-y-3 text-sm text-foreground/70">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-gold" />
              <span>{SITE.address}</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-gold" />
              <a href={SITE.whatsapp.link} className="hover:text-sage-deep">
                {SITE.whatsapp.display}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Instagram className="mt-0.5 h-4 w-4 text-gold" />
              <a href={SITE.instagram.url} target="_blank" rel="noreferrer" className="hover:text-sage-deep">
                {SITE.instagram.handle}
              </a>
            </li>
          </ul>

          <div className="mt-6">
            <p className="eyebrow mb-3">Horários</p>
            <ul className="space-y-1 text-sm text-foreground/70">
              {SITE.hours.map((h) => (
                <li key={h.day} className="flex justify-between gap-4">
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50">
        <div className="container-narrow flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} {SITE.name}. Feito com cuidado por {SITE.therapist}.</p>
          <div className="flex gap-5">
            <Link to="/politica-privacidade" className="hover:text-sage-deep">Privacidade</Link>
            <Link to="/termos" className="hover:text-sage-deep">Termos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
