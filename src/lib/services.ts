export type Service = {
  slug: string;
  name: string;
  short: string;
  description: string;
  benefits: string[];
  duration: string;
  price: string;
  contraindications: string;
  preparation: string;
  aftercare: string;
};

export const SERVICES: Service[] = [
  {
    slug: "massagem-relaxante",
    name: "Massagem Relaxante",
    short: "Alívio profundo do estresse com movimentos suaves e envolventes.",
    description:
      "Sessão pensada para desacelerar corpo e mente. Manobras longas e cadenciadas, óleos essenciais e uma atmosfera de silêncio para você reencontrar o próprio ritmo.",
    benefits: [
      "Reduz o estresse e a ansiedade",
      "Melhora a qualidade do sono",
      "Alivia tensões musculares leves",
      "Equilibra o sistema nervoso",
    ],
    duration: "60 min",
    price: "A consultar",
    contraindications: "Febre, infecções de pele, gestantes no 1º trimestre (consulte).",
    preparation: "Chegue 10 minutos antes. Evite refeições pesadas e cafeína.",
    aftercare: "Beba bastante água e evite esforços intensos nas horas seguintes.",
  },
  {
    slug: "massagem-terapeutica",
    name: "Massagem Terapêutica",
    short: "Foco em pontos de tensão e dores crônicas de pescoço, ombros e coluna.",
    description:
      "Combinação de técnicas de deslizamento, amassamento profundo e liberação miofascial para tratar dores localizadas e devolver mobilidade.",
    benefits: [
      "Alivia dores musculares crônicas",
      "Melhora postura e mobilidade",
      "Reduz nódulos e pontos-gatilho",
      "Auxilia na recuperação física",
    ],
    duration: "60 – 90 min",
    price: "A consultar",
    contraindications: "Trombose, fraturas recentes, lesões agudas. Consulte sempre um médico.",
    preparation: "Comente onde estão suas dores. Traga exames se houver.",
    aftercare: "Alongamentos suaves, hidratação e sono reparador.",
  },
  {
    slug: "drenagem-linfatica",
    name: "Drenagem Linfática",
    short: "Movimentos leves que estimulam a circulação e desincham o corpo.",
    description:
      "Toque delicado e rítmico que ativa o sistema linfático, reduz retenção de líquidos e traz sensação imediata de leveza.",
    benefits: [
      "Reduz inchaço e retenção",
      "Melhora circulação",
      "Auxilia no pós-operatório (com liberação médica)",
      "Sensação de leveza e bem-estar",
    ],
    duration: "60 – 90 min",
    price: "A consultar",
    contraindications: "Trombose, infecções ativas, insuficiência cardíaca ou renal descompensada.",
    preparation: "Hidrate-se bem no dia anterior. Roupas confortáveis.",
    aftercare: "Continue a hidratação. Caminhadas leves potencializam o efeito.",
  },
  {
    slug: "massagem-modeladora",
    name: "Massagem Modeladora",
    short: "Manobras firmes para contorno corporal e redução de medidas.",
    description:
      "Amassamento profundo e movimentos vigorosos que estimulam a quebra de gordura localizada e definem o contorno corporal.",
    benefits: [
      "Auxilia na redução de medidas",
      "Melhora aspecto da celulite",
      "Tonifica a musculatura",
      "Complementa rotinas saudáveis",
    ],
    duration: "60 min",
    price: "A consultar",
    contraindications: "Varizes acentuadas, gestação, doenças de pele na região.",
    preparation: "Ideal em conjunto com alimentação equilibrada e exercícios.",
    aftercare: "Hidratação e continuidade das sessões para melhores resultados.",
  },
  {
    slug: "spa-dos-pes",
    name: "Spa dos Pés",
    short: "Ritual de cuidado, esfoliação e reflexologia para pés cansados.",
    description:
      "Escalda-pés aromático, esfoliação, hidratação profunda e reflexologia. Um momento de rendição total.",
    benefits: [
      "Alivia cansaço e peso nas pernas",
      "Estimula pontos reflexos",
      "Renova a pele dos pés",
      "Sensação de reset completo",
    ],
    duration: "45 min",
    price: "A consultar",
    contraindications: "Feridas abertas, micoses ativas.",
    preparation: "Nenhuma preparação especial.",
    aftercare: "Aproveite o restinho do dia com tranquilidade.",
  },
  {
    slug: "massagem-facial",
    name: "Massagem Facial",
    short: "Lifting natural, drenagem e relaxamento das expressões faciais.",
    description:
      "Manobras específicas para o rosto, com óleos naturais, que tonificam, drenam e devolvem luminosidade à pele.",
    benefits: [
      "Reduz inchaço facial",
      "Suaviza linhas de expressão",
      "Melhora oxigenação da pele",
      "Relaxa mandíbula e olhar",
    ],
    duration: "45 min",
    price: "A consultar",
    contraindications: "Pele com acne inflamada, dermatites ativas.",
    preparation: "Chegue sem maquiagem se possível.",
    aftercare: "Evite sol direto nas próximas horas. Reforce a hidratação.",
  },
  {
    slug: "pedras-quentes",
    name: "Pedras Quentes",
    short: "Calor terapêutico das pedras vulcânicas que dissolve tensões.",
    description:
      "Pedras aquecidas deslizam sobre o corpo, promovendo relaxamento muscular profundo e uma sensação envolvente de aconchego.",
    benefits: [
      "Relaxamento muscular profundo",
      "Melhora circulação",
      "Sensação de conforto e aquecimento",
      "Ideal para dias frios ou de fadiga",
    ],
    duration: "75 min",
    price: "A consultar",
    contraindications: "Hipertensão descompensada, gestação, alterações de sensibilidade.",
    preparation: "Evite refeições pesadas antes.",
    aftercare: "Hidrate-se e permita-se descansar.",
  },
  {
    slug: "terapia-capilar-relaxante",
    name: "Terapia Capilar Relaxante",
    short: "Massagem do couro cabeludo que acalma a mente e nutre os fios.",
    description:
      "Massagem do couro cabeludo com óleos nutritivos, aromaterapia e movimentos lentos que induzem à meditação.",
    benefits: [
      "Alivia dores de cabeça tensionais",
      "Reduz queda por estresse",
      "Nutre e fortalece os fios",
      "Induz a um estado meditativo",
    ],
    duration: "45 min",
    price: "A consultar",
    contraindications: "Feridas ou dermatites no couro cabeludo.",
    preparation: "Cabelo pode ser lavado após a sessão.",
    aftercare: "Aproveite a leveza. Sono especialmente reparador.",
  },
];

export function findService(slug: string) {
  return SERVICES.find((s) => s.slug === slug);
}
