import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import therapistImg from "@/assets/therapist.jpg";
import roomImg from "@/assets/spa-room.jpg";
import ritualImg from "@/assets/ritual-flatlay.jpg";
import { SITE } from "@/lib/site-config";
import { ManagedImage } from "@/components/site/ManagedImage";
import { createSeoHead, resolveSeoPage } from "@/lib/seo";
import { loadPublicSeoPage } from "@/lib/seo.repository";

export const Route = createFileRoute("/sobre")({
  loader: async () => ({ seoPage: await loadPublicSeoPage("sobre") }),
  head: ({ loaderData }) => {
    const seo = resolveSeoPage("sobre", loaderData?.seoPage);
    return createSeoHead({
      title: seo.title,
      description: seo.description,
      path: seo.path,
      image: seo.socialImageUrl,
    });
  },
  component: Sobre,
});

function Sobre() {
  return (
    <>
      <section className="container-narrow py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow mb-3">Nossa história</p>
          <h1 className="display-serif text-5xl md:text-6xl">
            Um espaço nasceu do <span className="italic text-sage">desejo de acolher</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            O Serenar surgiu como resposta a um tempo acelerado. Um convite para que cada pessoa
            pudesse ter, ao menos uma hora do seu dia, dedicada ao próprio corpo — sem culpa, sem
            pressa.
          </p>
        </div>
      </section>

      <section className="container-narrow grid gap-12 py-12 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <ManagedImage
            slotKey="sobre.terapeuta"
            fallbackSrc={therapistImg}
            alt={`${SITE.therapist}, massoterapeuta`}
            width={1200}
            height={1500}
            className="rounded-[2rem] shadow-elegant"
          />
        </div>
        <div className="lg:col-span-7 lg:pl-6">
          <p className="eyebrow mb-3">A terapeuta</p>
          <h2 className="display-serif text-4xl md:text-5xl">{SITE.therapist}</h2>
          <p className="mt-6 leading-relaxed text-muted-foreground">
            Mariah acredita que o toque é uma das formas mais antigas e legítimas de cuidado.
            Formada em massoterapia e em constante estudo, ela une técnica, aromaterapia, escuta
            ativa e uma sensibilidade rara.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Antes de cada sessão, há uma conversa. Antes de cada toque, há atenção plena. É esse
            cuidado que faz o Serenar ser mais do que um espaço de massagens — é um pequeno refúgio.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { n: "500+", l: "clientes atendidas" },
              { n: "7+", l: "anos de prática" },
              { n: "8", l: "rituais autorais" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl border border-border bg-cream/60 p-4 text-center"
              >
                <p className="font-serif text-3xl text-sage-deep">{s.n}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-narrow py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="leaf-divider mb-5">
            <Leaf className="h-4 w-4" />
          </div>
          <p className="eyebrow mb-3">Nossos valores</p>
          <h2 className="display-serif text-4xl md:text-5xl">
            O que sustenta cada <span className="italic text-sage">sessão</span>
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="card-serena text-center">
              <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush text-gold">
                <v.icon className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-2xl text-sage-deep">{v.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blush/50 py-16 sm:py-20 lg:py-24">
        <div className="container-narrow">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-3">O ambiente</p>
            <h2 className="display-serif text-4xl md:text-5xl">
              Silêncio, luz suave, aromas <span className="italic text-sage">naturais</span>
            </h2>
            <p className="mt-6 leading-relaxed text-muted-foreground">
              Cada detalhe do espaço foi pensado para que os sentidos se acalmem à porta: tecidos
              naturais, plantas vivas, iluminação âmbar, óleos essenciais de qualidade terapêutica.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:mt-12 sm:gap-6 md:grid-cols-2 lg:gap-8">
            <ManagedImage
              slotKey="sobre.ambiente"
              fallbackSrc={roomImg}
              alt="Ambiente da sala de atendimento"
              width={1400}
              height={1050}
              className="aspect-[4/3] h-full w-full rounded-[1.5rem] object-cover shadow-elegant sm:rounded-[2rem]"
            />
            <ManagedImage
              slotKey="sobre.ritual"
              fallbackSrc={ritualImg}
              alt=""
              aria-hidden
              width={1400}
              height={1050}
              className="aspect-[4/3] h-full w-full rounded-[1.5rem] object-cover object-[center_40%] shadow-elegant sm:rounded-[2rem]"
            />
          </div>
        </div>
      </section>

      <section className="container-narrow py-24 text-center">
        <h2 className="display-serif text-4xl md:text-5xl">
          Quer conhecer <span className="italic text-sage">pessoalmente</span>?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          Reserve seu horário ou venha para uma primeira conversa. Estamos em {SITE.city}.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/agendamento" className="btn-serena">
            Agendar sessão
          </Link>
          <Link to="/contato" className="btn-serena-outline">
            Ver endereço
          </Link>
        </div>
      </section>
    </>
  );
}

const VALUES = [
  {
    icon: HeartHandshake,
    title: "Escuta antes do toque",
    text: "Cada corpo carrega uma história. Ouvir é parte do tratamento.",
  },
  {
    icon: ShieldCheck,
    title: "Técnica com consciência",
    text: "Formação sólida e estudo constante, aplicados com respeito ao seu limite.",
  },
  {
    icon: Sparkles,
    title: "Beleza como cuidado",
    text: "Um ambiente belo é um convite à presença. Cuidamos disso por você.",
  },
];
