
DROP VIEW IF EXISTS public.my_appointments;

CREATE OR REPLACE FUNCTION public.get_my_appointments()
RETURNS TABLE(
  id uuid, full_name text, phone text, email text, service text,
  preferred_date date, preferred_time text, notes text, status text,
  created_at timestamptz, calendar_slot_id uuid, submitted_at timestamptz,
  confirmed_at timestamptz, cancelled_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.full_name, a.phone, a.email, a.service, a.preferred_date, a.preferred_time,
         a.notes, a.status, a.created_at, a.calendar_slot_id, a.submitted_at,
         a.confirmed_at, a.cancelled_at
  FROM public.appointments a
  WHERE a.user_id = auth.uid() AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_my_appointments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_appointments() TO authenticated;
