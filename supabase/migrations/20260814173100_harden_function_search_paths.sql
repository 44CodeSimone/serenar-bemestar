-- Migration: Fix mutable search_path on database functions and triggers

-- 1. Trigger function: trg_client_consents_prevent_revocation_tampering
-- Body contains no unqualified schema references, so search_path = '' is 100% safe.
ALTER FUNCTION public.trg_client_consents_prevent_revocation_tampering() SET search_path = '';

-- 2. RPC: create_prebooking
ALTER FUNCTION public.create_prebooking(uuid, text, text, text, uuid, text) SET search_path = public, pg_temp;

-- 3. RPCs: Admin Appointment Workflow Functions
ALTER FUNCTION public.confirm_appointment_by_staff(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_appointment_by_staff(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.complete_appointment_by_staff(uuid, text) SET search_path = public, pg_temp;
