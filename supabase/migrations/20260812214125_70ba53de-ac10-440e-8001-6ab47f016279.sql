-- ============================================================
-- Serenar CRM — Migration 001: CRM Identity Foundation
-- Targets: public.clients, public.guardians, public.client_guardians
-- Specification: docs/Arquitetura/CRM/Serenar-CRM-Modelo-Fisico-v1.md
-- ============================================================

-- ============================================================
-- 1. Table: public.clients
-- Central identity and registration record of patients/clients.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    cpf text,
    birth_date date NOT NULL,
    mother_name text,
    phone text NOT NULL,
    whatsapp text,
    email text,
    city text,
    profession text,
    status text NOT NULL DEFAULT 'registered',
    source text NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,

    -- Constraints
    CONSTRAINT chk_clients_status CHECK (status IN ('registered', 'active', 'inactive', 'archived')),
    CONSTRAINT chk_clients_cpf_length CHECK (cpf IS NULL OR cpf ~ '^\d{11}$'),
    CONSTRAINT chk_clients_full_name_not_empty CHECK (btrim(full_name) <> ''),
    CONSTRAINT chk_clients_phone_not_empty CHECK (btrim(phone) <> ''),
    CONSTRAINT chk_clients_source_not_empty CHECK (btrim(source) <> '')
);

-- Comments
COMMENT ON TABLE public.clients IS 'Central CRM identity record for Serenar clients/patients.';
COMMENT ON COLUMN public.clients.auth_user_id IS 'Optional link to auth.users for authenticated clients.';
COMMENT ON COLUMN public.clients.cpf IS 'Normalized 11-digit CPF. Unique when informed.';

-- Partial Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_cpf
    ON public.clients (cpf)
    WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_auth_user
    ON public.clients (auth_user_id)
    WHERE auth_user_id IS NOT NULL;

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients (full_name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients (phone);
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients (deleted_at) WHERE deleted_at IS NOT NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_clients_updated ON public.clients;
CREATE TRIGGER trg_clients_updated
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 2. Table: public.guardians
-- Repository of legal guardians/representatives for patients.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guardians (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    cpf text NOT NULL,
    phone text NOT NULL,
    whatsapp text,
    email text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,

    -- Constraints
    CONSTRAINT chk_guardians_cpf_length CHECK (cpf ~ '^\d{11}$'),
    CONSTRAINT chk_guardians_full_name_not_empty CHECK (btrim(full_name) <> ''),
    CONSTRAINT chk_guardians_phone_not_empty CHECK (btrim(phone) <> '')
);

-- Comments
COMMENT ON TABLE public.guardians IS 'Legal guardians and representatives for minor patients.';
COMMENT ON COLUMN public.guardians.cpf IS 'Normalized 11-digit CPF. Globally unique.';

-- Global Unique Index on Guardian CPF
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardians_cpf
    ON public.guardians (cpf);

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_guardians_full_name ON public.guardians (full_name);
CREATE INDEX IF NOT EXISTS idx_guardians_phone ON public.guardians (phone);
CREATE INDEX IF NOT EXISTS idx_guardians_deleted_at ON public.guardians (deleted_at) WHERE deleted_at IS NOT NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_guardians_updated ON public.guardians;
CREATE TRIGGER trg_guardians_updated
    BEFORE UPDATE ON public.guardians
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 3. Table: public.client_guardians
-- Junction table for N:N client-guardian legal links.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_guardians (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    guardian_id uuid NOT NULL REFERENCES public.guardians(id) ON DELETE RESTRICT,
    relationship text NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    legal_authority_confirmed boolean NOT NULL DEFAULT false,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_until timestamptz,
    authorization_granted_at timestamptz,
    authorization_version text,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_client_guardians_relationship CHECK (relationship IN ('mother', 'father', 'tutor', 'guardian', 'other')),
    CONSTRAINT chk_client_guardians_validity CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

-- Comments
COMMENT ON TABLE public.client_guardians IS 'N:N relationship linking clients to their legal guardians.';

-- Partial Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_guardians_active_link
    ON public.client_guardians (client_id, guardian_id)
    WHERE revoked_at IS NULL AND valid_until IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_guardians_primary_active
    ON public.client_guardians (client_id)
    WHERE is_primary = true AND revoked_at IS NULL AND valid_until IS NULL;

-- Foreign Key B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_client_guardians_client_id ON public.client_guardians (client_id);
CREATE INDEX IF NOT EXISTS idx_client_guardians_guardian_id ON public.client_guardians (guardian_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_client_guardians_updated ON public.client_guardians;
CREATE TRIGGER trg_client_guardians_updated
    BEFORE UPDATE ON public.client_guardians
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 4. Row Level Security (RLS) & Permissions
-- Uses existing authorization helper functions (public.is_staff).
-- ============================================================

-- Enable RLS on all 3 tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_guardians ENABLE ROW LEVEL SECURITY;

-- Revoke public/anon access
REVOKE ALL ON public.clients FROM PUBLIC, anon;
REVOKE ALL ON public.guardians FROM PUBLIC, anon;
REVOKE ALL ON public.client_guardians FROM PUBLIC, anon;

-- Grant access to authenticated users (governed strictly by RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardians TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_guardians TO authenticated;

-- Policies for public.clients
DROP POLICY IF EXISTS "Admins and staff have full access to clients" ON public.clients;
CREATE POLICY "Admins and staff have full access to clients"
    ON public.clients
    FOR ALL
    TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view own record" ON public.clients;
CREATE POLICY "Clients can view own record"
    ON public.clients
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Clients can update own profile fields" ON public.clients;
CREATE POLICY "Clients can update own profile fields"
    ON public.clients
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- Policies for public.guardians
DROP POLICY IF EXISTS "Admins and staff have full access to guardians" ON public.guardians;
CREATE POLICY "Admins and staff have full access to guardians"
    ON public.guardians
    FOR ALL
    TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

-- Policies for public.client_guardians
DROP POLICY IF EXISTS "Admins and staff have full access to client_guardians" ON public.client_guardians;
CREATE POLICY "Admins and staff have full access to client_guardians"
    ON public.client_guardians
    FOR ALL
    TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

-- GRANT service_role full access (edge functions / admin operations)
GRANT ALL ON public.clients TO service_role;
GRANT ALL ON public.guardians TO service_role;
GRANT ALL ON public.client_guardians TO service_role;