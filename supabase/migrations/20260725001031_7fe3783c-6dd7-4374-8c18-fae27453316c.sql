-- =====================================================================
-- Serenar — Fluxo administrativo de agendamentos
-- RPC única: change_appointment_status(uuid, text)
-- Substitui confirm_appointment / cancel_appointment / complete_appointment
-- =====================================================================

DROP FUNCTION IF EXISTS public.confirm_appointment(uuid);
DROP FUNCTION IF EXISTS public.cancel_appointment(uuid);
DROP FUNCTION IF EXISTS public.complete_appointment(uuid);
DROP FUNCTION IF EXISTS public.change_appointment_status(uuid, text);

CREATE FUNCTION public.change_appointment_status(
    p_appointment_id uuid,
    p_new_status text
)
RETURNS TABLE(
    appointment_id uuid,
    previous_status text,
    appointment_status text,
    calendar_slot_id uuid,
    changed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_appointment public.appointments%ROWTYPE;
    v_new_status text := lower(btrim(coalesce(p_new_status, '')));
    v_changed_at timestamp with time zone := now();
BEGIN
    -- Autorização: apenas equipe (admin/owner)
    IF v_user_id IS NULL OR NOT public.is_staff(v_user_id) THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    IF v_new_status NOT IN ('confirmed', 'cancelled', 'completed') THEN
        RAISE EXCEPTION 'Status inválido.';
    END IF;

    -- Bloqueia o agendamento para evitar transições concorrentes
    SELECT * INTO v_appointment
    FROM public.appointments
    WHERE id = p_appointment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado.';
    END IF;

    -- Transições permitidas:
    --   pending   -> confirmed
    --   pending   -> cancelled
    --   confirmed -> completed
    --   confirmed -> cancelled
    IF NOT (
        (v_appointment.status = 'pending'   AND v_new_status IN ('confirmed', 'cancelled'))
        OR (v_appointment.status = 'confirmed' AND v_new_status IN ('completed', 'cancelled'))
    ) THEN
        RAISE EXCEPTION 'Transição de status não permitida: % -> %.', v_appointment.status, v_new_status;
    END IF;

    UPDATE public.appointments a
    SET status       = v_new_status,
        handled_by   = v_user_id,
        confirmed_at = CASE WHEN v_new_status = 'confirmed' THEN v_changed_at ELSE a.confirmed_at END,
        cancelled_at = CASE WHEN v_new_status = 'cancelled' THEN v_changed_at ELSE a.cancelled_at END,
        updated_at   = v_changed_at
    WHERE a.id = v_appointment.id;

    -- Cancelamento libera o horário reservado na agenda
    IF v_new_status = 'cancelled' AND v_appointment.calendar_slot_id IS NOT NULL THEN
        UPDATE public.calendar_slots
        SET status      = 'open',
            reserved_at = NULL,
            updated_at  = v_changed_at,
            updated_by  = v_user_id
        WHERE id = v_appointment.calendar_slot_id
          AND status = 'reserved'
          AND deleted_at IS NULL;
    END IF;

    RETURN QUERY
    SELECT v_appointment.id,
           v_appointment.status,
           v_new_status,
           v_appointment.calendar_slot_id,
           v_changed_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.change_appointment_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_appointment_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_appointment_status(uuid, text) TO service_role;

COMMENT ON FUNCTION public.change_appointment_status(uuid, text) IS
'Fluxo administrativo de agendamentos. Transições permitidas: pending->confirmed, pending->cancelled, confirmed->completed, confirmed->cancelled. Cancelamento libera o calendar_slot reservado. Restrita à equipe (is_staff).';
