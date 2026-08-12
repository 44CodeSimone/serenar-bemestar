-- ============================================================
-- Serenar CRM — Migration 003: Integrate CRM Appointments & Leads
-- Targets: public.appointments, public.leads
-- Specification: docs/Arquitetura/CRM/Serenar-CRM-Modelo-Fisico-v1.md
-- Depends On:
--   - 20260809160000_create_crm_identity_foundation.sql (clients)
--   - 20260704023300_a9cff008-480f-4510-a020-ec717f2a5124.sql (appointments)
--   - 20260704151539_eb780685-47dd-42b8-b261-3ddde514db56.sql (services, leads)
-- ============================================================

-- ============================================================
-- 1. Table: public.appointments
-- Add optional foreign keys to clients and services while preserving
-- all existing textual snapshot columns (full_name, phone, service, etc.).
-- ============================================================

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

-- Column Comments
COMMENT ON COLUMN public.appointments.client_id IS 'Optional reference to central CRM client. Preserves text snapshots if NULL.';
COMMENT ON COLUMN public.appointments.service_id IS 'Optional reference to service catalog entry. Preserves text service name if NULL.';

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON public.appointments (service_id) WHERE service_id IS NOT NULL;


-- ============================================================
-- 2. Table: public.leads
-- Add optional foreign key to converted client in CRM to track lead conversion.
-- ============================================================

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS converted_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Column Comments
COMMENT ON COLUMN public.leads.converted_client_id IS 'Optional reference to converted CRM client record. Unique when informed.';

-- Partial Unique Index (Prevents multiple lead conversions to different clients or re-conversions)
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_converted_client ON public.leads (converted_client_id) WHERE converted_client_id IS NOT NULL;

-- B-Tree Performance Index
CREATE INDEX IF NOT EXISTS idx_leads_converted_client_id ON public.leads (converted_client_id) WHERE converted_client_id IS NOT NULL;
