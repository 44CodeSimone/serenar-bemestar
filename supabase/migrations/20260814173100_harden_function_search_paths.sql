-- Migration: Fix mutable search_path on database functions and triggers

-- 1. Trigger function: trg_client_consents_prevent_revocation_tampering
-- Body contains no unqualified schema references, so search_path = '' is 100% safe.
ALTER FUNCTION public.trg_client_consents_prevent_revocation_tampering() SET search_path = '';
