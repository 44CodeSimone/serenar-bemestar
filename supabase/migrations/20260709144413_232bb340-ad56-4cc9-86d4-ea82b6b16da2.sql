-- 1) Tighten SECURITY DEFINER helper visibility.
--    handle_new_user is invoked only by the auth trigger; nothing else should call it.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

--    is_admin / is_staff are only used from privileged server functions (via service_role
--    or inside SECURITY DEFINER contexts). Client code no longer calls them directly.
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;

--    has_role is referenced from RLS policies evaluated as the authenticated caller,
--    so authenticated must retain EXECUTE; anon and PUBLIC do not.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2) Replace "WITH CHECK (true)" INSERT policies with meaningful constraints.
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;
CREATE POLICY "Anyone can create appointments"
  ON public.appointments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND char_length(full_name) BETWEEN 1 AND 200
    AND char_length(phone) BETWEEN 1 AND 40
    AND char_length(service) BETWEEN 1 AND 200
    AND (email IS NULL OR char_length(email) <= 320)
    AND (notes IS NULL OR char_length(notes) <= 2000)
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Anyone can create leads" ON public.leads;
CREATE POLICY "Anyone can create leads"
  ON public.leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 200
    AND (email IS NULL OR char_length(email) <= 320)
    AND (phone IS NULL OR char_length(phone) <= 40)
    AND (interest IS NULL OR char_length(interest) <= 500)
    AND (service IS NULL OR char_length(service) <= 200)
    AND (notes IS NULL OR char_length(notes) <= 2000)
    AND status = 'novo'
  );
