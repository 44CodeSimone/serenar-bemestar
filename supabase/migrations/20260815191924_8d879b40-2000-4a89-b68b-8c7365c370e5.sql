-- Activate a safe default clinical intake form when the installation has no
-- active template. Existing templates and clinical records are never changed.
DO $$
DECLARE
  v_template_id uuid;
  v_staff_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.anamnesis_templates WHERE active = true) THEN
    SELECT id INTO v_staff_id
    FROM auth.users
    WHERE public.is_staff(id)
    ORDER BY created_at
    LIMIT 1;

    IF v_staff_id IS NOT NULL THEN
      INSERT INTO public.anamnesis_templates (
        name, version, description, active, created_by
      )
      VALUES (
        'Anamnese Geral Serenar',
        1,
        'Formulário inicial de saúde e bem-estar para atendimentos de massoterapia.',
        true,
        v_staff_id
      )
      ON CONFLICT (name, version) DO UPDATE
      SET active = true, retired_at = NULL
      RETURNING id INTO v_template_id;

      INSERT INTO public.anamnesis_questions (
        template_id, question_key, label, field_type, options, required, display_order, help_text
      ) VALUES
        (v_template_id, 'queixa_principal', 'Qual é a sua principal queixa ou objetivo para o atendimento?', 'textarea', NULL, true, 10, NULL),
        (v_template_id, 'condicoes_saude', 'Possui alguma condição de saúde diagnosticada?', 'textarea', NULL, false, 20, 'Informe diagnósticos relevantes e acompanhamento médico.'),
        (v_template_id, 'medicamentos', 'Utiliza medicamentos atualmente?', 'textarea', NULL, false, 30, NULL),
        (v_template_id, 'alergias', 'Possui alergias conhecidas?', 'textarea', NULL, false, 40, NULL),
        (v_template_id, 'cirurgias_lesoes', 'Já realizou cirurgias ou possui lesões recentes?', 'textarea', NULL, false, 50, NULL),
        (v_template_id, 'gestante', 'Está gestante ou existe possibilidade de gestação?', 'boolean', NULL, true, 60, NULL),
        (v_template_id, 'pressao_alterada', 'Possui histórico de pressão arterial alterada?', 'boolean', NULL, true, 70, NULL),
        (v_template_id, 'dor_atual', 'Qual a intensidade da dor ou desconforto atual?', 'scale', '{"min":0,"max":10,"minLabel":"Sem dor","maxLabel":"Dor intensa"}'::jsonb, true, 80, NULL),
        (v_template_id, 'areas_evitar', 'Existe alguma área do corpo que não deve ser massageada?', 'textarea', NULL, false, 90, NULL),
        (v_template_id, 'observacoes', 'Há alguma outra informação importante para um atendimento seguro?', 'textarea', NULL, false, 100, NULL)
      ON CONFLICT (template_id, question_key) DO NOTHING;
    END IF;
  END IF;
END
$$;

-- Resolve a unique existing CRM client for new pre-bookings. Formatting is
-- ignored and ambiguous matches deliberately remain unlinked for manual review.
CREATE OR REPLACE FUNCTION public.link_appointment_to_unique_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid;
  v_match_count integer;
  v_phone text := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g');
  v_email text := lower(btrim(COALESCE(NEW.email, '')));
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT min(c.id::text)::uuid, count(DISTINCT c.id)
  INTO v_client_id, v_match_count
  FROM public.clients c
  WHERE c.status <> 'archived'
    AND c.deleted_at IS NULL
    AND (
      (length(v_phone) >= 10 AND right(regexp_replace(c.phone, '\D', '', 'g'), 11) = right(v_phone, 11))
      OR (length(v_email) > 3 AND lower(btrim(COALESCE(c.email, ''))) = v_email)
    );

  IF v_match_count = 1 THEN
    NEW.client_id := v_client_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.link_appointment_to_unique_client() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_link_appointment_to_unique_client ON public.appointments;
CREATE TRIGGER trg_link_appointment_to_unique_client
BEFORE INSERT OR UPDATE OF phone, email, client_id ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.link_appointment_to_unique_client();

WITH unique_matches AS (
  SELECT a.id AS appointment_id, min(c.id::text)::uuid AS client_id
  FROM public.appointments a
  JOIN public.clients c
    ON c.status <> 'archived'
   AND c.deleted_at IS NULL
   AND (
     (
       length(regexp_replace(COALESCE(a.phone, ''), '\D', '', 'g')) >= 10
       AND right(regexp_replace(c.phone, '\D', '', 'g'), 11) = right(regexp_replace(a.phone, '\D', '', 'g'), 11)
     )
     OR (
       length(lower(btrim(COALESCE(a.email, '')))) > 3
       AND lower(btrim(COALESCE(c.email, ''))) = lower(btrim(a.email))
     )
   )
  WHERE a.client_id IS NULL
  GROUP BY a.id
  HAVING count(DISTINCT c.id) = 1
)
UPDATE public.appointments a
SET client_id = matches.client_id,
    updated_at = now()
FROM unique_matches matches
WHERE a.id = matches.appointment_id
  AND a.client_id IS NULL;