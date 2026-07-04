// Configurações centrais do site. Edite aqui para atualizar rapidamente.

export const SITE = {
  name: "Serenar",
  tagline: "Massoterapia & Bem-Estar",
  description:
    "Serenar é um espaço boutique de massoterapia e bem-estar em Chapecó/SC. Massagens terapêuticas, drenagem linfática, pedras quentes e cuidados que devolvem sua serenidade.",
  therapist: "Mariah Luz",
  whatsapp: {
    raw: "+5549998177652",
    display: "+55 49 99817-7652",
    link: "https://wa.me/5549998177652",
  },
  instagram: {
    handle: "@serenar_massoterapiaebemestar",
    url: "https://instagram.com/serenar_massoterapiaebemestar",
  },
  email: "contato@serenar.com.br",
  city: "Chapecó / SC",
  address: "Chapecó, Santa Catarina",
  hours: [
    { day: "Segunda a Sexta", time: "09h — 20h" },
    { day: "Sábado", time: "09h — 16h" },
    { day: "Domingo", time: "Fechado" },
  ],
} as const;

export function waMessage(text: string): string {
  return `${SITE.whatsapp.link}?text=${encodeURIComponent(text)}`;
}
