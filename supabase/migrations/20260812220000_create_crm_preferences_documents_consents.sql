-- ============================================================
-- Serenar CRM — Migration 002: Preferences, Documents & Consents
-- Targets: public.client_preferences, public.client_documents, public.client_consents
-- Specification: docs/Arquitetura/CRM/Serenar-CRM-Modelo-Fisico-v1.md
-- Depends On: 20260809160000_create_crm_identity_foundation.sql (clients, guardians)
-- ============================================================

-- ============================================================
-- 1. Table: public.client_preferences
-- Repository for client communication and privacy preferences.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    preference_key text NOT NULL,
    preference_value jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_client_preferences_key_not_empty CHECK (btrim(preference_key) <> ''),
    CONSTRAINT uq_client_preferences_key UNIQUE (client_id, preference_key)
);

-- Comments
COMMENT ON TABLE public.client_preferences IS 'Client communication, privacy, and system preferences.';
COMMENT ON COLUMN public.client_preferences.preference_key IS 'Unique preference identifier per client.';
COMMENT ON COLUMN public.client_preferences.preference_value IS 'Structured JSON payload for preference values.';

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_client_preferences_client_id ON public.client_preferences (client_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_client_preferences_updated ON public.client_preferences;
CREATE TRIGGER trg_client_preferences_updated
    BEFORE UPDATE ON public.client_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 2. Table: public.client_documents
-- Repository of metadata for private documents attached to clients.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    document_type text NOT NULL,
    storage_path text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    file_size integer NOT NULL,
    related_entity_type text,
    related_entity_id uuid,
    uploaded_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz,

    -- Constraints
    CONSTRAINT chk_client_documents_document_type_not_empty CHECK (btrim(document_type) <> ''),
    CONSTRAINT chk_client_documents_storage_path_not_empty CHECK (btrim(storage_path) <> ''),
    CONSTRAINT chk_client_documents_original_filename_not_empty CHECK (btrim(original_filename) <> ''),
    CONSTRAINT chk_client_documents_mime_type_not_empty CHECK (btrim(mime_type) <> ''),
    CONSTRAINT chk_client_documents_file_size_positive CHECK (file_size > 0),
    CONSTRAINT chk_client_documents_related_entity CHECK (
        (related_entity_type IS NULL AND related_entity_id IS NULL) OR
        (related_entity_type IS NOT NULL AND related_entity_id IS NOT NULL AND btrim(related_entity_type) <> '')
    )
);

-- Comments
COMMENT ON TABLE public.client_documents IS 'Metadata for private client attachments stored in private buckets.';
COMMENT ON COLUMN public.client_documents.storage_path IS 'Internal storage path in private bucket. Never contains raw CPF or personal name.';
COMMENT ON COLUMN public.client_documents.related_entity_type IS 'Optional polymorphic entity type link (e.g. session, anamnesis).';
COMMENT ON COLUMN public.client_documents.related_entity_id IS 'Optional polymorphic entity UUID link.';

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON public.client_documents (client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_by ON public.client_documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_documents_archived_at ON public.client_documents (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_documents_related_entity ON public.client_documents (related_entity_type, related_entity_id) WHERE related_entity_type IS NOT NULL;


-- ============================================================
-- 3. Table: public.client_consents
-- Append-only historical ledger for LGPD consents.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_consents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    guardian_id uuid REFERENCES public.guardians(id) ON DELETE RESTRICT,
    consent_type text NOT NULL,
    granted boolean NOT NULL,
    legal_basis text NOT NULL,
    term_version text NOT NULL,
    term_hash text,
    collection_channel text NOT NULL,
    evidence_document_id uuid REFERENCES public.client_documents(id) ON DELETE RESTRICT,
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    expires_at timestamptz,
    recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_client_consents_consent_type_not_empty CHECK (btrim(consent_type) <> ''),
    CONSTRAINT chk_client_consents_legal_basis_not_empty CHECK (btrim(legal_basis) <> ''),
    CONSTRAINT chk_client_consents_term_version_not_empty CHECK (btrim(term_version) <> ''),
    CONSTRAINT chk_client_consents_collection_channel_not_empty CHECK (btrim(collection_channel) <> ''),
    CONSTRAINT chk_client_consents_dates CHECK (revoked_at IS NULL OR revoked_at >= granted_at),
    CONSTRAINT chk_client_consents_expiration CHECK (expires_at IS NULL OR expires_at >= granted_at)
);

-- Comments
COMMENT ON TABLE public.client_consents IS 'Append-only historical ledger of LGPD privacy consents and authorizations.';
COMMENT ON COLUMN public.client_consents.evidence_document_id IS 'Optional reference to client_documents for signed consent forms.';
COMMENT ON COLUMN public.client_consents.revoked_at IS 'Timestamp of revocation. Consent records are append-only and never deleted.';

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_client_consents_client_id ON public.client_consents (client_id);
CREATE INDEX IF NOT EXISTS idx_client_consents_guardian_id ON public.client_consents (guardian_id) WHERE guardian_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_consents_evidence_document_id ON public.client_consents (evidence_document_id) WHERE evidence_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_consents_recorded_by ON public.client_consents (recorded_by) WHERE recorded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_consents_active ON public.client_consents (client_id, consent_type) WHERE granted = true AND revoked_at IS NULL;

-- Trigger Function for strict append-only revocation transition
CREATE OR REPLACE FUNCTION public.trg_client_consents_prevent_revocation_tampering()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Immutable ledger check: revoked_at can only transition from NULL -> NOT NULL once
    IF OLD.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Consent revocation timestamp is immutable once recorded.';
    END IF;

    IF NEW.revoked_at IS NULL THEN
        RAISE EXCEPTION 'Consent revocation timestamp cannot be reset to NULL.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_consents_immutable_revocation ON public.client_consents;
CREATE TRIGGER trg_client_consents_immutable_revocation
    BEFORE UPDATE ON public.client_consents
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_client_consents_prevent_revocation_tampering();


-- ============================================================
-- 4. Row Level Security (RLS) & Permissions
-- Uses existing authorization helper functions (public.is_staff).
-- ============================================================

-- Enable RLS on all 3 tables
ALTER TABLE public.client_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_consents ENABLE ROW LEVEL SECURITY;

-- Revoke public/anon access
REVOKE ALL ON public.client_preferences FROM PUBLIC, anon;
REVOKE ALL ON public.client_documents FROM PUBLIC, anon;
REVOKE ALL ON public.client_consents FROM PUBLIC, anon;

-- Grant access to authenticated users (governed strictly by RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO authenticated;
GRANT SELECT, INSERT ON public.client_consents TO authenticated;
GRANT UPDATE (revoked_at) ON public.client_consents TO authenticated;

-- Policies for public.client_preferences
DROP POLICY IF EXISTS "Admins and staff have full access to client_preferences" ON public.client_preferences;
CREATE POLICY "Admins and staff have full access to client_preferences"
    ON public.client_preferences
    FOR ALL
    TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view own preferences" ON public.client_preferences;
CREATE POLICY "Clients can view own preferences"
    ON public.client_preferences
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE clients.id = client_preferences.client_id
              AND clients.auth_user_id = auth.uid()
        )
    );

-- Policies for public.client_documents
DROP POLICY IF EXISTS "Admins and staff have full access to client_documents" ON public.client_documents;
CREATE POLICY "Admins and staff have full access to client_documents"
    ON public.client_documents
    FOR ALL
    TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view own metadata documents" ON public.client_documents;
CREATE POLICY "Clients can view own metadata documents"
    ON public.client_documents
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE clients.id = client_documents.client_id
              AND clients.auth_user_id = auth.uid()
        )
    );

-- Policies for public.client_consents (Append-Only / Non-Destructive)
DROP POLICY IF EXISTS "Admins and staff have full access to client_consents" ON public.client_consents;

DROP POLICY IF EXISTS "Admins and staff can view all consents" ON public.client_consents;
CREATE POLICY "Admins and staff can view all consents"
    ON public.client_consents
    FOR SELECT
    TO authenticated
    USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins and staff can insert consents" ON public.client_consents;
CREATE POLICY "Admins and staff can insert consents"
    ON public.client_consents
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins and staff can update consent revocation and expiration" ON public.client_consents;
DROP POLICY IF EXISTS "Admins and staff can update consent revocation" ON public.client_consents;
CREATE POLICY "Admins and staff can update consent revocation"
    ON public.client_consents
    FOR UPDATE
    TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view own consents" ON public.client_consents;
CREATE POLICY "Clients can view own consents"
    ON public.client_consents
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE clients.id = client_consents.client_id
              AND clients.auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clients can grant own consents" ON public.client_consents;
CREATE POLICY "Clients can grant own consents"
    ON public.client_consents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE clients.id = client_consents.client_id
              AND clients.auth_user_id = auth.uid()
        )
    );
