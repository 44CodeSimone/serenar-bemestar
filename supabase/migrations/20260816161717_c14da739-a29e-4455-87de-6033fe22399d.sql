CREATE OR REPLACE FUNCTION public.trg_client_consents_protect_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN
    NEW.recorded_by := auth.uid();
    NEW.term_hash := NULL;
    NEW.collection_channel := 'self_service';
    NEW.granted_at := now();
    NEW.revoked_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_consents_protect_attribution ON public.client_consents;
CREATE TRIGGER trg_client_consents_protect_attribution
BEFORE INSERT ON public.client_consents
FOR EACH ROW EXECUTE FUNCTION public.trg_client_consents_protect_attribution();