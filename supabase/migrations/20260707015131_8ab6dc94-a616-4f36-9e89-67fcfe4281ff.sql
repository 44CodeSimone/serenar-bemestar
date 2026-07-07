
-- Tabela de biblioteca de imagens
CREATE TABLE public.site_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  public_url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  tag text NOT NULL DEFAULT 'outros',
  mime text,
  size_bytes integer,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_images TO authenticated;
GRANT ALL ON public.site_images TO service_role;

ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads site images"
  ON public.site_images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage site images"
  ON public.site_images FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_site_images_updated
  BEFORE UPDATE ON public.site_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Configuração inicial do grupo de WhatsApp
INSERT INTO public.site_settings (key, value, is_public)
VALUES (
  'whatsapp_group',
  jsonb_build_object(
    'active', false,
    'title', 'Entre no nosso grupo do WhatsApp',
    'description', 'Receba dicas de autocuidado, novidades e horários especiais direto no seu celular.',
    'cta', 'Entrar no grupo',
    'link', '',
    'show_on_home', true,
    'show_on_contact', true
  ),
  true
) ON CONFLICT (key) DO NOTHING;

-- Políticas de Storage para o bucket site-images
CREATE POLICY "Public read site-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-images');

CREATE POLICY "Admins upload site-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update site-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-images' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'site-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete site-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-images' AND public.is_admin(auth.uid()));
