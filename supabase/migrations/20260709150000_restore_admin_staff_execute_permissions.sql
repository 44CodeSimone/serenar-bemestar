-- Restore EXECUTE permissions required by RLS policies that call these helper functions.
-- These functions are referenced directly by several RLS policies.

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated;
