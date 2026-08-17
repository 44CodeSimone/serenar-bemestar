import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, HeartHandshake, Leaf, Sparkles, Star } from "lucide-react";
import heroImg from "@/assets/hero-ritual.jpg";
import roomImg from "@/assets/spa-room.jpg";
import ritualImg from "@/assets/ritual-flatlay.jpg";
import { listFeaturedPublicServices } from "@/lib/services.repository";
import { listPublicTestimonials, type PublicTestimonial } from "@/lib/testimonials.repository";
import { SITE } from "@/lib/site-config";
import { LeafMark } from "@/components/site/Logo";
import { ManagedImage } from "@/components/site/ManagedImage";
import { WhatsappGroupSection } from "@/components/site/WhatsappGroupSection";
import { TestimonialSubmissionForm } from "@/components/site/TestimonialSubmissionForm";
import {
  absoluteSiteUrl,
  createSeoHead,
  DEFAULT_SOCIAL_IMAGE,
  SEO_PAGE_DEFAULTS,
  resolveSeoPage,
} from "@/lib/seo";
import { loadPublicSeoPage } from "@/lib/seo.repository";

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => {
    const seo = resolveSeoPage("home", loaderData?.seoPage);
    return {
      ...createSeoHead({
        title: seo.title,
        description: seo.description,
        path: seo.path,
        image: seo.socialImageUrl,
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: SITE.name,
            description: SEO_PAGE_DEFAULTS.home.description,
            url: absoluteSiteUrl("/"),
            image: DEFAULT_SOCIAL_IMAGE,
            telephone: SITE.whatsapp.raw,
            email: SITE.email,
            address: {
              "@type": "PostalAddress",
              addressLocality: "Urubici",
              addressRegion: "SC",
              addressCountry: "BR",
            },
            founder: { "@type": "Person", name: SITE.therapist },
            sameAs: [SITE.instagram.url],
          }),
        },
      ],
    };
  },
  ssr: false,
  loader: async () => {
    const [services, testimonials, seoPage] = await Promise.all([
      listFeaturedPublicServices(6),
      listPublicTestimonials(6),
      loadPublicSeoPage("home"),
    ]);

    return { services, testimonials, seoPage };
  },
  component: Home,
});

function Home() {
  const { services, testimonials } = Route.useLoaderData();
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container-narrow grid gap-12 py-16 lg:grid-cols-12 lg:items-center lg:gap-16 lg:py-28">
          <div className="lg:col-span-6 space-y-8 animate-fade-up">
            <p className="eyebrow">{SITE.city} · Boutique de bem-estar</p>
            <h1 className="display-serif text-5xl md:text-6xl lg:text-7xl">
              O tempo de <span className="italic text-sage">respirar</span>
              <br />
              começa <span className="gold-underline">aqui</span>.
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              Um espaço pensado para desacelerar. Massoterapia e rituais de autocuidado conduzidos
              com toque humano por {SITE.therapist}.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/agendamento" className="btn-serena">
                Agendar sessão <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/servicos" className="btn-serena-outline">
                Conhecer serviços
              </Link>
            </div>
            <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1 text-gold">
                  {[...Array(5)].map((_, i) => (
                    <Sparkles key={i} className="h-3.5 w-3.5" fill="currentColor" />
                  ))}
                </div>
                <span>+ de 500 clientes acolhidas</span>
              </div>
            </div>
          </div>

          <div className="relative lg:col-span-6">
            <div className="relative overflow-hidden rounded-[2rem] shadow-elegant">
              <ManagedImage
                slotKey="home.hero"
                fallbackSrc={heroImg}
                alt="Ritual de bem-estar preparado com óleos e ervas naturais"
                width={1600}
                height={1280}
                loading="eager"
                fetchPriority="high"
                className="h-[520px] w-full object-cover md:h-[640px]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sage-deep/20 via-transparent to-transparent" />
            </div>
            <div className="absolute -left-6 -bottom-6 hidden max-w-[220px] rounded-2xl border border-border bg-background/95 p-5 shadow-soft backdrop-blur md:block">
              <LeafMark className="h-6 w-6 text-gold" />
              <p className="mt-2 font-serif text-lg leading-snug text-sage-deep">
                Cada sessão é um retorno a si.
              </p>
            </div>
          </div>
        </div>

        {/* subtle gradient background */}
        <div className="absolute inset-x-0 top-0 -z-10 h-[70%] bg-gradient-to-b from-blush/60 via-background to-background" />
      </section>

      {/* BENEFITS */}
      <section className="container-narrow py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="leaf-divider mb-5">
            <Leaf className="h-4 w-4" />
          </div>
          <p className="eyebrow mb-3">Por que Serenar</p>
          <h2 className="display-serif text-4xl md:text-5xl">
            Cuidar de você é <span className="italic text-sage">essencial</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Não é luxo. É a base para uma vida com mais presença, sono, energia e leveza.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <div key={i} className="card-serena text-center">
              <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush text-gold">
                <b.icon className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-2xl text-sage-deep">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section className="bg-cream/60 py-24">
        <div className="container-narrow">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <p className="eyebrow mb-3">Serviços</p>
              <h2 className="display-serif text-4xl md:text-5xl">
                Rituais de <span className="italic text-sage">autocuidado</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                Cada técnica escolhida para atender um momento diferente da sua vida.
              </p>
            </div>
            <Link to="/servicos" className="btn-serena-outline">
              Ver todos os serviços <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((s: Awaited<ReturnType<typeof listFeaturedPublicServices>>[number]) => (
              <article key={s.slug} className="card-serena flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gold">{s.duration}</p>
                    <h3 className="mt-2 font-serif text-2xl text-sage-deep">{s.name}</h3>
                  </div>
                  <LeafMark className="h-6 w-6 text-gold/70" />
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {s.short_description}
                </p>
                <Link
                  to="/agendamento"
                  search={{ service: s.slug }}
                  className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-sage-deep hover:text-gold"
                >
                  Agendar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT / MARIAH */}
      <section className="container-narrow grid gap-12 py-24 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <div className="relative">
            <ManagedImage
              slotKey="home.sobre"
              fallbackSrc={roomImg}
              alt="Ambiente do espaço Serenar"
              width={1400}
              height={1600}
              className="rounded-[2rem] shadow-elegant"
            />
            <div className="absolute -bottom-6 -right-4 hidden rounded-2xl bg-gold px-6 py-4 text-center text-gold-foreground shadow-elegant md:block">
              <p className="font-serif text-3xl">7+</p>
              <p className="text-[10px] uppercase tracking-[0.2em]">anos de dedicação</p>
            </div>
          </div>
        </div>
        <div className="lg:col-span-7 lg:pl-8">
          <p className="eyebrow mb-3">Sobre</p>
          <h2 className="display-serif text-4xl md:text-5xl">
            Um cuidado que <span className="italic text-sage">acolhe</span> antes de tocar
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            No Serenar, cada detalhe é pensado para que você chegue e possa, enfim, se soltar.
            Aromas suaves, música que respira, mãos treinadas para escutar antes de tratar.
          </p>
          <p className="mt-4 text-muted-foreground">
            {SITE.therapist} conduz cada sessão com escuta atenta e técnica apurada, unindo
            massoterapia, aromaterapia e uma visão integral do bem-estar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/sobre" className="btn-serena">
              Conhecer nossa história
            </Link>
            <Link to="/agendamento" className="btn-serena-outline">
              Reservar horário
            </Link>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-blush/60 py-24">
        <div className="container-narrow">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow mb-3">Quem vive, sente</p>
            <h2 className="display-serif text-4xl md:text-5xl">
              Palavras de quem já <span className="italic text-sage">respirou</span> aqui
            </h2>
          </div>
          <div className="mt-14 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.length === 0 ? (
              <div className="card-serena md:col-span-2 lg:col-span-3 text-center">
                <Sparkles className="mx-auto mb-4 h-5 w-5 text-gold" />
                <p className="font-serif text-lg text-sage-deep">
                  Os primeiros depoimentos aparecerão em breve.
                </p>
              </div>
            ) : (
              testimonials.map((t: PublicTestimonial) => {
                const rating = t.rating ?? 0;

                return (
                  <figure
                    key={t.id}
                    className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/80 px-7 py-8 shadow-soft sm:px-8 sm:py-9"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-3 left-5 font-serif text-8xl leading-none text-gold/15 select-none"
                    >
                      “
                    </span>
                    <div
                      className="relative z-10 flex justify-center gap-1.5 text-gold"
                      aria-label={
                        rating > 0 ? `${rating} de 5 estrelas` : "Avaliação não informada"
                      }
                    >
                      {[...Array(5)].map((_, index) => (
                        <Star
                          key={index}
                          className="h-5 w-5"
                          fill={index < rating ? "currentColor" : "none"}
                        />
                      ))}
                    </div>

                    <blockquote className="relative z-10 mt-7 flex-1 text-left font-serif text-[1.125rem] leading-[1.8] tracking-[0.005em] text-sage-deep italic sm:text-[1.1875rem]">
                      {t.text}
                    </blockquote>

                    <figcaption className="relative z-10 mt-8 border-t border-border/60 pt-5 text-center">
                      <span className="block text-base font-semibold text-foreground">
                        {t.name}
                      </span>
                      {t.service ? (
                        <span className="mt-1 block text-xs tracking-wide text-muted-foreground">
                          {t.service}
                        </span>
                      ) : null}
                    </figcaption>
                  </figure>
                );
              })
            )}
          </div>
          <TestimonialSubmissionForm />
        </div>
      </section>

      {/* CTA */}
      <section className="container-narrow py-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-sage-deep p-10 md:p-16">
          <div className="relative z-10 grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="eyebrow text-cream/70">Pronta para começar?</p>
              <h2 className="mt-3 font-serif text-4xl text-cream md:text-5xl">
                Reserve seu momento de <span className="italic text-gold">serenidade</span>
              </h2>
              <p className="mt-4 max-w-md text-cream/80">
                Escolha o ritual, o dia e deixe o resto conosco.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Link
                to="/agendamento"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-8 py-4 text-sm font-medium text-gold-foreground shadow-elegant transition-transform hover:scale-105"
              >
                Agendar agora <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={SITE.whatsapp.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cream/70 hover:text-cream"
              >
                ou fale no WhatsApp {SITE.whatsapp.display}
              </a>
            </div>
          </div>
          <ManagedImage
            slotKey="home.cta"
            fallbackSrc={ritualImg}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-luminosity"
          />
        </div>
      </section>

      <WhatsappGroupSection surface="home" />
    </>
  );
}

const BENEFITS = [
  {
    icon: Sparkles,
    title: "Relaxamento profundo",
    text: "Técnicas que acessam o sistema nervoso parassimpático e devolvem calma real ao corpo.",
  },
  {
    icon: HeartHandshake,
    title: "Escuta acolhedora",
    text: "Cada sessão começa por uma conversa. Você é o centro do atendimento, sempre.",
  },
  {
    icon: Clock,
    title: "Tempo bem gasto",
    text: "Ambiente sem pressa, sem barulho, sem ruído mental. Só você e sua respiração.",
  },
];
