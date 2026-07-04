
-- 1. Add admin role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Admin check helper
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') $$;

-- ============ SITE SETTINGS ============
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads public settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (is_public = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage settings" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ SERVICES ============
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  short_description text,
  description text,
  duration text,
  price_cents integer,
  price_label text,
  benefits jsonb DEFAULT '[]'::jsonb,
  contraindications text,
  preparation text,
  aftercare text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active services" ON public.services FOR SELECT TO anon, authenticated USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage services" ON public.services FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ TESTIMONIALS ============
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  text text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  service text,
  authorized boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads authorized testimonials" ON public.testimonials FOR SELECT TO anon, authenticated USING ((active = true AND authorized = true) OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage testimonials" ON public.testimonials FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ FAQ ============
CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_items TO authenticated;
GRANT ALL ON public.faq_items TO service_role;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active faq" ON public.faq_items FOR SELECT TO anon, authenticated USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage faq" ON public.faq_items FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ BLOG ============
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text,
  content text,
  cover_image_url text,
  category text,
  tags jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  seo_title text,
  seo_description text,
  seo_keywords text,
  published_at timestamptz,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads published posts" ON public.blog_posts FOR SELECT TO anon, authenticated USING (status = 'published' OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage posts" ON public.blog_posts FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ LEADS ============
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  interest text,
  service text,
  source text NOT NULL DEFAULT 'website',
  status text NOT NULL DEFAULT 'novo',
  consent boolean NOT NULL DEFAULT false,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.leads TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create leads" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read leads" ON public.leads FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage leads" ON public.leads FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete leads" ON public.leads FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ AI KNOWLEDGE ============
CREATE TABLE public.ai_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  content text NOT NULL,
  category text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge TO authenticated;
GRANT ALL ON public.ai_knowledge TO service_role;
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage knowledge" ON public.ai_knowledge FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ APPOINTMENTS: extend admin access ============
CREATE POLICY "Admins read all appointments" ON public.appointments FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete appointments" ON public.appointments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS internal_notes text;

-- ============ TRIGGERS ============
CREATE TRIGGER trg_site_settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_testimonials_updated BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_faq_updated BEFORE UPDATE ON public.faq_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_blog_updated BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ai_knowledge_updated BEFORE UPDATE ON public.ai_knowledge FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ SEED: SERVICES ============
INSERT INTO public.services (slug, name, short_description, description, duration, price_label, benefits, contraindications, preparation, aftercare, display_order, featured) VALUES
('massoterapia', 'Massoterapia', 'Sessão base personalizada conforme sua necessidade.', 'Uma sessão que combina técnicas variadas de acordo com a leitura do seu corpo naquele dia. Ideal para quem busca cuidado sob medida.', '60 min', 'Sob consulta', '["Alívio de tensões","Relaxamento profundo","Melhora da circulação","Sensação de leveza"]'::jsonb, 'Evitar em casos de febre, infecções ativas ou pós-operatório recente sem liberação médica.', 'Chegue 10 minutos antes. Evite refeições pesadas na hora anterior.', 'Beba bastante água e evite grandes esforços nas próximas horas.', 1, true),
('massagem-relaxante', 'Massagem Relaxante', 'Manobras suaves para desacelerar corpo e mente.', 'Toques longos e ritmados que convidam o sistema nervoso ao descanso. Perfeita para dias de estresse acumulado.', '60 min', 'Sob consulta', '["Redução do estresse","Melhora do sono","Sensação de acolhimento","Equilíbrio emocional"]'::jsonb, 'Evitar em quadros febris ou lesões ativas.', 'Roupas confortáveis. Chegue com tempo para se ambientar.', 'Permita-se um momento de silêncio ao final. Hidrate-se.', 2, true),
('massagem-terapeutica', 'Massagem Terapêutica', 'Alívio focado de dores e tensões musculares.', 'Trabalho mais profundo em pontos específicos de tensão. Indicada para dores nas costas, ombros, pescoço e postura.', '60 min', 'Sob consulta', '["Alívio de dores musculares","Melhora postural","Redução de nós de tensão","Mais mobilidade"]'::jsonb, 'Evitar em inflamações agudas, trombose ou lesões recentes.', 'Comunique previamente qualquer dor ou desconforto.', 'Pode haver leve sensibilidade nas 24h seguintes — é normal.', 3, true),
('drenagem-linfatica', 'Drenagem Linfática', 'Movimentos leves que estimulam o sistema linfático.', 'Técnica de manobras ritmadas e suaves para reduzir retenção, inchaço e favorecer a desintoxicação natural do corpo.', '60 min', 'Sob consulta', '["Redução de inchaço","Melhora da circulação","Sensação de leveza","Apoio no pós-operatório (com liberação médica)"]'::jsonb, 'Contraindicada em trombose, infecções agudas, insuficiência cardíaca descompensada e câncer em tratamento sem liberação médica.', 'Hidrate-se bem no dia. Evite roupas apertadas.', 'Continue bebendo água. Caminhadas leves potencializam o efeito.', 4, false),
('massagem-modeladora', 'Massagem Modeladora', 'Trabalho firme para tônus e definição.', 'Manobras vigorosas para estimular a circulação, mobilizar gordura localizada e favorecer o contorno corporal.', '60 min', 'Sob consulta', '["Estímulo circulatório","Auxílio no contorno corporal","Firmeza da pele","Complemento a rotina saudável"]'::jsonb, 'Evitar sobre varizes, feridas ou áreas inflamadas.', 'Alimente-se de forma leve antes da sessão.', 'Hidrate-se e mantenha alimentação equilibrada para melhores resultados.', 5, false),
('spa-dos-pes', 'Spa dos Pés', 'Ritual completo de cuidado para os pés.', 'Escalda-pés aromático, esfoliação, hidratação e massagem relaxante. Um cuidado que reflete no corpo inteiro.', '45 min', 'Sob consulta', '["Alívio do cansaço","Pés hidratados e macios","Sensação de acolhimento","Melhora da circulação"]'::jsonb, 'Evitar em caso de feridas abertas ou infecções nos pés.', 'Não é necessária preparação especial.', 'Use meias confortáveis e evite calçados apertados nas próximas horas.', 6, false),
('massagem-facial', 'Massagem Facial', 'Toques delicados para relaxar e revitalizar.', 'Manobras suaves que estimulam a circulação, aliviam tensões faciais e trazem viço para a pele.', '30 min', 'Sob consulta', '["Relaxamento facial","Viço e luminosidade","Redução de inchaço","Sensação de bem-estar"]'::jsonb, 'Evitar em lesões ativas na pele ou pós-procedimentos estéticos recentes.', 'Chegue sem maquiagem, se possível.', 'Evite exposição solar intensa nas horas seguintes.', 7, false),
('pedras-quentes', 'Massagem com Pedras Quentes', 'Calor terapêutico que dissolve tensões.', 'Pedras basálticas aquecidas deslizam pelo corpo, promovendo relaxamento profundo e alívio de tensões musculares.', '75 min', 'Sob consulta', '["Relaxamento profundo","Alívio de tensões","Melhora da circulação","Sensação de acolhimento térmico"]'::jsonb, 'Evitar em hipertensão descontrolada, gestação, diabetes descompensada ou sensibilidade ao calor.', 'Evite refeições pesadas antes da sessão.', 'Hidrate-se bem. Permita-se descansar após a sessão.', 8, true),
('terapia-capilar', 'Terapia Capilar Relaxante', 'Massagem no couro cabeludo com aromas naturais.', 'Trabalho de digitopressão e manobras no couro cabeludo com óleos aromáticos, aliviando dores de cabeça e tensões.', '30 min', 'Sob consulta', '["Alívio de dores de cabeça","Relaxamento profundo","Estímulo circulatório","Sensação de leveza"]'::jsonb, 'Evitar em couro cabeludo com lesões ativas.', 'Venha com o cabelo limpo, se possível.', 'Evite lavar o cabelo nas próximas 2 horas para prolongar o efeito dos óleos.', 9, false);

-- ============ SEED: SITE SETTINGS ============
INSERT INTO public.site_settings (key, value, is_public) VALUES
('contact', '{"whatsapp":"+5549998177652","whatsapp_display":"(49) 99817-7652","instagram":"@serenar_massoterapiaebemestar","instagram_url":"https://instagram.com/serenar_massoterapiaebemestar","email":"contato@serenar.com.br","address":"Chapecó/SC","hours":"Segunda a Sábado — 9h às 19h"}'::jsonb, true),
('whatsapp_messages', '{"default":"Olá! Vim pelo site do Serenar e gostaria de mais informações sobre os atendimentos.","booking":"Olá Mariah! Gostaria de agendar uma sessão.","from_ai":"Olá Mariah! Estava conversando com a Serená e gostaria de continuar por aqui."}'::jsonb, true),
('hero', '{"eyebrow":"Massoterapia & Bem-estar","title":"Seu momento de pausa, cuidado e bem-estar","subtitle":"Um espaço criado para acolher corpo, mente e emoções com técnica, presença e delicadeza.","cta_primary":"Agendar meu momento","cta_secondary":"Conhecer os rituais"}'::jsonb, true),
('seo', '{"title":"Serenar — Massoterapia & Bem-Estar em Chapecó","description":"Espaço boutique de massoterapia em Chapecó/SC. Rituais de autocuidado com Mariah Luz."}'::jsonb, true);

-- ============ SEED: FAQ ============
INSERT INTO public.faq_items (question, answer, display_order) VALUES
('Como faço para agendar?', 'Você pode preencher o formulário de agendamento no site ou nos chamar diretamente no WhatsApp (49) 99817-7652. A confirmação é sempre feita pessoalmente pela Mariah.', 1),
('Quanto tempo dura cada sessão?', 'Depende do ritual escolhido — variamos entre 30 e 75 minutos. Recomendamos chegar 10 minutos antes para se ambientar.', 2),
('Preciso levar algo?', 'Não é necessário. Nós oferecemos toalhas, óleos e todo o necessário. Venha com roupas confortáveis.', 3),
('Vocês atendem gestantes?', 'Sim, com técnicas adaptadas. Peça avaliação prévia e confirme com sua obstetra antes da primeira sessão.', 4),
('Como funcionam os pacotes?', 'Oferecemos pacotes personalizados de sessões. Fale com a Mariah pelo WhatsApp para conhecer as opções vigentes.', 5);
