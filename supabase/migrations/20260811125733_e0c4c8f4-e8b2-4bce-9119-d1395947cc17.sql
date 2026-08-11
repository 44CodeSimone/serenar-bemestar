ALTER TABLE public.site_images ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Public reads site images" ON public.site_images;

CREATE POLICY "Public reads published site images"
ON public.site_images
FOR SELECT
TO anon, authenticated
USING (is_public = true);

REVOKE SELECT ON public.site_images FROM anon;
REVOKE SELECT ON public.site_images FROM authenticated;

GRANT SELECT (id, storage_path, alt, tag, caption, created_at, is_public) ON public.site_images TO anon;
GRANT SELECT ON public.site_images TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_images TO authenticated;
GRANT ALL ON public.site_images TO service_role;