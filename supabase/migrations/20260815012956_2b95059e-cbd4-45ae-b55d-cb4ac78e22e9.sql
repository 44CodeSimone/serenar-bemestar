
-- 1. appointments: remove full-row customer access; expose a restricted view instead
DROP POLICY IF EXISTS "Users see own appointments" ON public.appointments;

CREATE OR REPLACE VIEW public.my_appointments
WITH (security_invoker = false) AS
SELECT id, user_id, full_name, phone, email, service, preferred_date, preferred_time,
       notes, status, source, created_at, updated_at, calendar_slot_id,
       submitted_at, confirmed_at, cancelled_at, client_id, service_id
FROM public.appointments
WHERE user_id = auth.uid();

REVOKE ALL ON public.my_appointments FROM anon;
GRANT SELECT ON public.my_appointments TO authenticated;

-- 2. clients: block self-service edits of staff-only columns
CREATE OR REPLACE FUNCTION public.trg_clients_protect_staff_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN
    NEW.status := OLD.status;
    NEW.source := OLD.source;
    NEW.notes := OLD.notes;
    NEW.auth_user_id := OLD.auth_user_id;
    NEW.cpf := OLD.cpf;
    NEW.deleted_at := OLD.deleted_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_protect_staff_columns ON public.clients;
CREATE TRIGGER trg_clients_protect_staff_columns
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.trg_clients_protect_staff_columns();

-- 3. client_consents: prevent attribution spoofing on self-granted consents
DROP POLICY IF EXISTS "Clients can grant own consents" ON public.client_consents;
CREATE POLICY "Clients can grant own consents"
ON public.client_consents FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_consents.client_id AND c.auth_user_id = auth.uid()
  )
  AND (recorded_by IS NULL OR recorded_by = auth.uid())
  AND (
    evidence_document_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.client_documents d
      WHERE d.id = client_consents.evidence_document_id
        AND d.client_id = client_consents.client_id
    )
  )
);

-- 4. storage: only serve site-images files flagged public
DROP POLICY IF EXISTS "Public read site-images" ON storage.objects;
CREATE POLICY "Public read site-images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'site-images'
  AND EXISTS (
    SELECT 1 FROM public.site_images si
    WHERE si.storage_path = storage.objects.name AND si.is_public = true
  )
);
