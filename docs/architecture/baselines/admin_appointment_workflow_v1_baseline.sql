-- SERENAR — Administrative appointment workflow
-- Transactional RPCs for confirming, cancelling and completing appointments.

-- ============================================================
-- 1. Confirm appointment
-- ============================================================

DROP FUNCTION IF EXISTS public.confirm_appointment(uuid);

CREATE FUNCTION public.confirm_appointment(
    p_appointment_id uuid
)
RETURNS TABLE (
    appointment_id uuid,
    appointment_status text,
    calendar_slot_id uuid,
    changed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_appointment public.appointments%ROWTYPE;
    v_changed_at timestamptz := now();
BEGIN
    IF v_user_id IS NULL OR NOT public.is_staff(v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado.';
    END IF;

    SELECT *
      INTO v_appointment
      FROM public.appointments
     WHERE id = p_appointment_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado.';
    END IF;

    IF v_appointment.status <> 'pending' THEN
        RAISE EXCEPTION 'Somente agendamentos pendentes podem ser confirmados.';
    END IF;

    UPDATE public.appointments
       SET status = 'confirmed',
           confirmed_at = v_changed_at,
           cancelled_at = NULL,
           handled_by = v_user_id,
           updated_at = v_changed_at
     WHERE id = p_appointment_id;

    RETURN QUERY
    SELECT
        p_appointment_id,
        'confirmed'::text,
        v_appointment.calendar_slot_id,
        v_changed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_appointment(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.confirm_appointment(uuid)
TO authenticated;


-- ============================================================
-- 2. Cancel appointment and release its calendar slot
-- ============================================================

DROP FUNCTION IF EXISTS public.cancel_appointment(uuid);

CREATE FUNCTION public.cancel_appointment(
    p_appointment_id uuid
)
RETURNS TABLE (
    appointment_id uuid,
    appointment_status text,
    calendar_slot_id uuid,
    changed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_appointment public.appointments%ROWTYPE;
    v_changed_at timestamptz := now();
BEGIN
    IF v_user_id IS NULL OR NOT public.is_staff(v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado.';
    END IF;

    SELECT *
      INTO v_appointment
      FROM public.appointments
     WHERE id = p_appointment_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado.';
    END IF;

    IF v_appointment.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Somente agendamentos pendentes ou confirmados podem ser cancelados.';
    END IF;

    IF v_appointment.calendar_slot_id IS NOT NULL THEN
        UPDATE public.calendar_slots
           SET status = 'open',
               reserved_at = NULL,
               updated_at = v_changed_at,
               updated_by = v_user_id
         WHERE id = v_appointment.calendar_slot_id
           AND deleted_at IS NULL
           AND status = 'reserved';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'O horário vinculado não pôde ser liberado.';
        END IF;
    END IF;

    UPDATE public.appointments
       SET status = 'cancelled',
           cancelled_at = v_changed_at,
           handled_by = v_user_id,
           updated_at = v_changed_at
     WHERE id = p_appointment_id;

    RETURN QUERY
    SELECT
        p_appointment_id,
        'cancelled'::text,
        v_appointment.calendar_slot_id,
        v_changed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_appointment(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid)
TO authenticated;


-- ============================================================
-- 3. Complete confirmed appointment
-- ============================================================

DROP FUNCTION IF EXISTS public.complete_appointment(uuid);

CREATE FUNCTION public.complete_appointment(
    p_appointment_id uuid
)
RETURNS TABLE (
    appointment_id uuid,
    appointment_status text,
    calendar_slot_id uuid,
    changed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_appointment public.appointments%ROWTYPE;
    v_changed_at timestamptz := now();
BEGIN
    IF v_user_id IS NULL OR NOT public.is_staff(v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado.';
    END IF;

    SELECT *
      INTO v_appointment
      FROM public.appointments
     WHERE id = p_appointment_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado.';
    END IF;

    IF v_appointment.status <> 'confirmed' THEN
        RAISE EXCEPTION 'Somente agendamentos confirmados podem ser concluídos.';
    END IF;

    UPDATE public.appointments
       SET status = 'completed',
           handled_by = v_user_id,
           updated_at = v_changed_at
     WHERE id = p_appointment_id;

    RETURN QUERY
    SELECT
        p_appointment_id,
        'completed'::text,
        v_appointment.calendar_slot_id,
        v_changed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_appointment(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid)
TO authenticated;