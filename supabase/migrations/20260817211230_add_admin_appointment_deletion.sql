-- Exclusao administrativa de agendamentos.
-- A operacao e atomica: se houver um horario ainda reservado, ele e liberado
-- antes da exclusao. Registros clinicos relacionados preservam seu historico
-- por meio da FK existente ON DELETE SET NULL.

CREATE OR REPLACE FUNCTION public.delete_appointment_admin(
    p_appointment_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_appointment public.appointments%ROWTYPE;
    v_changed_at timestamp with time zone := now();
BEGIN
    IF v_user_id IS NULL OR NOT public.is_staff(v_user_id) THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    SELECT * INTO v_appointment
    FROM public.appointments
    WHERE id = p_appointment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento nao encontrado.';
    END IF;

    IF v_appointment.calendar_slot_id IS NOT NULL THEN
        UPDATE public.calendar_slots
        SET status      = 'open',
            reserved_at = NULL,
            updated_at  = v_changed_at,
            updated_by  = v_user_id
        WHERE id = v_appointment.calendar_slot_id
          AND status = 'reserved'
          AND deleted_at IS NULL;
    END IF;

    DELETE FROM public.appointments
    WHERE id = v_appointment.id;

    RETURN v_appointment.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_appointment_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_appointment_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_appointment_admin(uuid) TO service_role;

COMMENT ON FUNCTION public.delete_appointment_admin(uuid) IS
'Exclui um agendamento somente para equipe autenticada e libera eventual horario reservado.';
