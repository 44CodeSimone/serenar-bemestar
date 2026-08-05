-- The public booking form now reaches this RPC through a protected server
-- function after Turnstile, honeypot and phone validation.
REVOKE EXECUTE ON FUNCTION public.create_prebooking(
  uuid,
  text,
  text,
  text,
  uuid,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_prebooking(
  uuid,
  text,
  text,
  text,
  uuid,
  text
) TO service_role;
