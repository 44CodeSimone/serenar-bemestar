-- ============================================================
-- Serenar CRM — Migration 004: Clinical Domain (Anamnesis & Sessions)
-- Targets: public.anamnesis_templates, public.anamnesis_questions,
--          public.client_anamneses, public.anamnesis_answers,
--          public.client_sessions, public.session_notes
-- Specification: docs/Arquitetura/CRM/Serenar-CRM-Modelo-Fisico-v1.md (Seção 5.6 a 5.11)
-- Depends On: Migration 001 (clients, guardians), Migration 003 (appointments, services)
-- ============================================================

-- ============================================================
-- 1. Table: public.anamnesis_templates
-- Models and versions of clinical anamnesis forms.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.anamnesis_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    description text NULL,
    active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    retired_at timestamptz NULL,

    -- Constraints
    CONSTRAINT chk_anamnesis_templates_name_not_empty CHECK (btrim(name) <> ''),
    CONSTRAINT chk_anamnesis_templates_version_positive CHECK (version >= 1),
    CONSTRAINT uq_anamnesis_templates_name_version UNIQUE (name, version)
);

COMMENT ON TABLE public.anamnesis_templates IS 'Clinical anamnesis templates and versioning control.';
COMMENT ON COLUMN public.anamnesis_templates.version IS 'Version number. Modifying an active template increments version and sets retired_at on previous version.';
COMMENT ON COLUMN public.anamnesis_templates.retired_at IS 'Timestamp when this version was deactivated in favor of a newer version.';

CREATE INDEX IF NOT EXISTS idx_anamnesis_templates_active ON public.anamnesis_templates (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_anamnesis_templates_created_by ON public.anamnesis_templates (created_by);


-- ============================================================
-- 2. Table: public.anamnesis_questions
-- Individual questions linked to an anamnesis template version.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.anamnesis_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.anamnesis_templates(id) ON DELETE RESTRICT,
    question_key text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    options jsonb NULL,
    required boolean NOT NULL DEFAULT false,
    display_order integer NOT NULL DEFAULT 0,
    help_text text NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_anamnesis_questions_key_not_empty CHECK (btrim(question_key) <> ''),
    CONSTRAINT chk_anamnesis_questions_label_not_empty CHECK (btrim(label) <> ''),
    CONSTRAINT chk_anamnesis_questions_field_type CHECK (
        field_type IN (
            'text',
            'textarea',
            'boolean',
            'number',
            'date',
            'single_choice',
            'multiple_choice',
            'scale'
        )
    ),
    CONSTRAINT uq_anamnesis_questions_template_key UNIQUE (template_id, question_key)
);

COMMENT ON TABLE public.anamnesis_questions IS 'Individual questions bound to a specific anamnesis template version.';
COMMENT ON COLUMN public.anamnesis_questions.question_key IS 'Stable string key identifying this question across versions.';
COMMENT ON COLUMN public.anamnesis_questions.field_type IS 'Input field widget type for rendering.';

CREATE INDEX IF NOT EXISTS idx_anamnesis_questions_template_order ON public.anamnesis_questions (template_id, display_order);


-- ============================================================
-- 3. Table: public.client_anamneses
-- Record of anamnesis filled out for a client.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_anamneses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    template_id uuid NOT NULL REFERENCES public.anamnesis_templates(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'draft',
    filled_by text NOT NULL,
    guardian_id uuid NULL REFERENCES public.guardians(id) ON DELETE RESTRICT,
    completed_at timestamptz NULL,
    reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_client_anamneses_status CHECK (
        status IN ('draft', 'completed', 'reviewed', 'superseded')
    ),
    CONSTRAINT chk_client_anamneses_filled_by CHECK (
        filled_by IN ('client', 'guardian', 'professional')
    )
);

COMMENT ON TABLE public.client_anamneses IS 'Clinical anamnesis record for a client.';
COMMENT ON COLUMN public.client_anamneses.filled_by IS 'Role of the actor who completed the form (client, guardian, or professional).';
COMMENT ON COLUMN public.client_anamneses.guardian_id IS 'Guardian legal link when anamnesis was completed by or for a minor.';

CREATE INDEX IF NOT EXISTS idx_client_anamneses_client_id ON public.client_anamneses (client_id);
CREATE INDEX IF NOT EXISTS idx_client_anamneses_template_id ON public.client_anamneses (template_id);
CREATE INDEX IF NOT EXISTS idx_client_anamneses_status ON public.client_anamneses (status);
CREATE INDEX IF NOT EXISTS idx_client_anamneses_guardian_id ON public.client_anamneses (guardian_id) WHERE guardian_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_client_anamneses_updated ON public.client_anamneses;
CREATE TRIGGER trg_client_anamneses_updated
    BEFORE UPDATE ON public.client_anamneses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 4. Table: public.anamnesis_answers
-- Structured answers stored in JSONB bound to question and anamnesis.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.anamnesis_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anamnesis_id uuid NOT NULL REFERENCES public.client_anamneses(id) ON DELETE RESTRICT,
    question_id uuid NOT NULL REFERENCES public.anamnesis_questions(id) ON DELETE RESTRICT,
    answer jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT uq_anamnesis_answers_anamnesis_question UNIQUE (anamnesis_id, question_id)
);

COMMENT ON TABLE public.anamnesis_answers IS 'Historical clinical answers for an anamnesis.';
COMMENT ON COLUMN public.anamnesis_answers.answer IS 'Structured JSON payload holding answer value.';

CREATE INDEX IF NOT EXISTS idx_anamnesis_answers_anamnesis_id ON public.anamnesis_answers (anamnesis_id);
CREATE INDEX IF NOT EXISTS idx_anamnesis_answers_question_id ON public.anamnesis_answers (question_id);

DROP TRIGGER IF EXISTS trg_anamnesis_answers_updated ON public.anamnesis_answers;
CREATE TRIGGER trg_anamnesis_answers_updated
    BEFORE UPDATE ON public.anamnesis_answers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 5. Table: public.client_sessions
-- Operational and clinical record of a service session.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    appointment_id uuid NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
    service_id uuid NULL REFERENCES public.services(id) ON DELETE SET NULL,
    professional_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    session_started_at timestamptz NOT NULL DEFAULT now(),
    session_ended_at timestamptz NULL,
    duration_minutes integer NULL,
    status text NOT NULL DEFAULT 'scheduled',
    client_report text NULL,
    professional_summary text NULL,
    recommendations text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_client_sessions_status CHECK (
        status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')
    ),
    CONSTRAINT chk_client_sessions_duration_positive CHECK (
        duration_minutes IS NULL OR duration_minutes > 0
    )
);

COMMENT ON TABLE public.client_sessions IS 'Clinical session history for a client.';
COMMENT ON COLUMN public.client_sessions.professional_user_id IS 'Therapist/Staff user responsible for conducting the session.';

CREATE INDEX IF NOT EXISTS idx_client_sessions_client_id ON public.client_sessions (client_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_appointment_id ON public.client_sessions (appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_sessions_service_id ON public.client_sessions (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_sessions_professional ON public.client_sessions (professional_user_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_status ON public.client_sessions (status);

DROP TRIGGER IF EXISTS trg_client_sessions_updated ON public.client_sessions;
CREATE TRIGGER trg_client_sessions_updated
    BEFORE UPDATE ON public.client_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 6. Table: public.session_notes
-- Append-only clinical evolution notes linked to a session.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.client_sessions(id) ON DELETE RESTRICT,
    note_type text NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    supersedes_note_id uuid NULL REFERENCES public.session_notes(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_session_notes_content_not_empty CHECK (btrim(content) <> ''),
    CONSTRAINT chk_session_notes_type CHECK (
        note_type IN ('observation', 'evolution', 'recommendation', 'correction', 'administrative')
    )
);

COMMENT ON TABLE public.session_notes IS 'Append-only clinical evolution notes. Corrections create new notes referencing supersedes_note_id.';
COMMENT ON COLUMN public.session_notes.supersedes_note_id IS 'Points to previous note if this note is a correction or revision, preserving audit trail.';

CREATE INDEX IF NOT EXISTS idx_session_notes_session_id ON public.session_notes (session_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_created_by ON public.session_notes (created_by);
CREATE INDEX IF NOT EXISTS idx_session_notes_supersedes ON public.session_notes (supersedes_note_id) WHERE supersedes_note_id IS NOT NULL;


-- ============================================================
-- 7. Row Level Security (RLS) & Grants
-- Domain restriction: Clinical records managed by staff/admin.
-- Strict Append-only rules for clinical notes and no physical DELETE on clinical history.
-- ============================================================

ALTER TABLE public.anamnesis_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.anamnesis_templates FROM PUBLIC, anon;
REVOKE ALL ON public.anamnesis_questions FROM PUBLIC, anon;
REVOKE ALL ON public.client_anamneses FROM PUBLIC, anon;
REVOKE ALL ON public.anamnesis_answers FROM PUBLIC, anon;
REVOKE ALL ON public.client_sessions FROM PUBLIC, anon;
REVOKE ALL ON public.session_notes FROM PUBLIC, anon;

-- Specific GRANTs (No DELETE granted on clinical history tables)
GRANT SELECT, INSERT, UPDATE ON public.anamnesis_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.anamnesis_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_anamneses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.anamnesis_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_sessions TO authenticated;

-- session_notes is strictly Append-Only (No UPDATE, No DELETE granted)
GRANT SELECT, INSERT ON public.session_notes TO authenticated;

-- RLS Policies
CREATE POLICY "Staff manage anamnesis_templates" ON public.anamnesis_templates
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff manage anamnesis_questions" ON public.anamnesis_questions
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff manage client_anamneses" ON public.client_anamneses
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff manage anamnesis_answers" ON public.anamnesis_answers
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff manage client_sessions" ON public.client_sessions
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));

-- session_notes append-only policies
CREATE POLICY "Staff read session_notes" ON public.session_notes
    FOR SELECT TO authenticated
    USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert session_notes" ON public.session_notes
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff(auth.uid()));