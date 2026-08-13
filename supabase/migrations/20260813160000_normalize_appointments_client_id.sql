-- ============================================================
-- Serenar CRM — Technical Debt Cleanup
-- Migration: Add nullable client_id FK to appointments with deterministic backfill
-- Targets: public.appointments
-- Specification: docs/Arquitetura/CRM/Serenar-CRM-Modelo-Fisico-v1.md
-- ============================================================

-- 1. Add nullable client_id column to public.appointments
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2. Column comment
COMMENT ON COLUMN public.appointments.client_id IS 'Optional reference to central CRM client. Preserves text snapshots if NULL.';

-- 3. Partial B-Tree performance index
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments (client_id) WHERE client_id IS NOT NULL;

-- ============================================================
-- 4. Deterministic Safe Backfill
-- Populates client_id ONLY when candidate client match is 100% unambiguous.
-- ============================================================

WITH
-- Normalize phone numbers to digits only and emails to lower(trim(email)) for non-deleted clients
normalized_clients AS (
    SELECT
        id,
        regexp_replace(phone, '\D', '', 'g') AS clean_phone,
        NULLIF(lower(trim(email)), '') AS clean_email
    FROM public.clients
    WHERE deleted_at IS NULL
),

-- Identify phone numbers that uniquely match exactly 1 client
unique_phone_clients AS (
    SELECT
        clean_phone,
        MAX(id) AS client_id
    FROM normalized_clients
    WHERE clean_phone <> ''
    GROUP BY clean_phone
    HAVING COUNT(*) = 1
),

-- Identify emails that uniquely match exactly 1 client
unique_email_clients AS (
    SELECT
        clean_email,
        MAX(id) AS client_id
    FROM normalized_clients
    WHERE clean_email IS NOT NULL AND clean_email <> ''
    GROUP BY clean_email
    HAVING COUNT(*) = 1
),

-- Evaluate each appointment requiring backfill, preserving clean_phone and clean_email
unbound_appointments AS (
    SELECT
        a.id AS appointment_id,
        regexp_replace(a.phone, '\D', '', 'g') AS clean_phone,
        NULLIF(lower(trim(a.email)), '') AS clean_email
    FROM public.appointments a
    WHERE a.client_id IS NULL
),

-- Resolve candidate matches per appointment while preserving contact field presence
appointment_candidates AS (
    SELECT
        ua.appointment_id,
        ua.clean_phone,
        ua.clean_email,
        up.client_id AS phone_client_id,
        ue.client_id AS email_client_id
    FROM unbound_appointments ua
    LEFT JOIN unique_phone_clients up ON ua.clean_phone = up.clean_phone AND ua.clean_phone <> ''
    LEFT JOIN unique_email_clients ue ON ua.clean_email = ue.clean_email AND ua.clean_email IS NOT NULL
),

-- Determine unambiguous unique candidate matches strictly:
-- 1. Only phone present on appointment: phone_client_id must be unique.
-- 2. Only email present on appointment: email_client_id must be unique.
-- 3. Both phone and email present: BOTH must be unique AND BOTH must resolve to the SAME client_id.
-- 4. Any ambiguity or conflict between fields => NULL.
safe_matches AS (
    SELECT
        appointment_id,
        CASE
            -- Only phone present on appointment
            WHEN clean_phone <> '' AND clean_email IS NULL AND phone_client_id IS NOT NULL THEN phone_client_id
            -- Only email present on appointment
            WHEN clean_email IS NOT NULL AND (clean_phone IS NULL OR clean_phone = '') AND email_client_id IS NOT NULL THEN email_client_id
            -- Both phone and email present: BOTH must resolve uniquely to the EXACT SAME client
            WHEN clean_phone <> '' AND clean_email IS NOT NULL AND phone_client_id IS NOT NULL AND email_client_id IS NOT NULL AND phone_client_id = email_client_id THEN phone_client_id
            -- Any ambiguity, mismatch or conflict => NULL
            ELSE NULL
        END AS resolved_client_id
    FROM appointment_candidates
)

-- Execute deterministic backfill ONLY for safe, 100% unambiguous matches
UPDATE public.appointments a
SET client_id = sm.resolved_client_id
FROM safe_matches sm
WHERE a.id = sm.appointment_id
  AND a.client_id IS NULL
  AND sm.resolved_client_id IS NOT NULL;
