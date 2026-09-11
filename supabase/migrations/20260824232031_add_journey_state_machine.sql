-- ============================================================
-- CareFlow AI journey state machine
-- Changes journey state, records an event, and writes an audit
-- record inside one database transaction.
-- ============================================================

create or replace function public.transition_care_journey(
    p_journey_id uuid,
    p_expected_version integer,
    p_target_state text,
    p_event_type text,
    p_actor_type text,
    p_actor_id text,
    p_idempotency_key text,
    p_event_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_journey public.care_journeys%rowtype;
    v_existing_event_id uuid;
begin
    -- Lock the journey so two requests cannot update it simultaneously.
    select *
    into v_journey
    from public.care_journeys
    where id = p_journey_id
    for update;

    if not found then
        raise exception 'Care journey not found';
    end if;


    -- Return safely when the same request has already been processed.
    select id
    into v_existing_event_id
    from public.care_events
    where idempotency_key = p_idempotency_key;

    if v_existing_event_id is not null then
        return jsonb_build_object(
            'journeyId', v_journey.id,
            'currentState', v_journey.current_state,
            'version', v_journey.version,
            'eventId', v_existing_event_id,
            'duplicate', true
        );
    end if;


    -- Optimistic concurrency check.
    if v_journey.version <> p_expected_version then
        raise exception
            'Journey version conflict. Expected %, but current version is %',
            p_expected_version,
            v_journey.version;
    end if;


    -- Validate permitted state transitions.
    if not (
        (
            v_journey.current_state = 'INTAKE_PENDING'
            and p_target_state in ('TRIAGE_PENDING', 'CANCELLED')
        )
        or
        (
            v_journey.current_state = 'TRIAGE_PENDING'
            and p_target_state in ('CLINICIAN_REVIEW', 'APPOINTMENT_SCHEDULED', 'CANCELLED')
        )
        or
        (
            v_journey.current_state = 'CLINICIAN_REVIEW'
            and p_target_state in ('APPOINTMENT_SCHEDULED', 'FOLLOW_UP_REQUIRED', 'CANCELLED')
        )
        or
        (
            v_journey.current_state = 'APPOINTMENT_SCHEDULED'
            and p_target_state in ('FOLLOW_UP_REQUIRED', 'COMPLETED', 'CANCELLED')
        )
        or
        (
            v_journey.current_state = 'FOLLOW_UP_REQUIRED'
            and p_target_state in ('CLINICIAN_REVIEW', 'APPOINTMENT_SCHEDULED', 'COMPLETED', 'CANCELLED')
        )
    ) then
        raise exception
            'Invalid transition from % to %',
            v_journey.current_state,
            p_target_state;
    end if;


    -- Add the immutable event first.
    insert into public.care_events (
        journey_id,
        event_type,
        actor_type,
        actor_id,
        idempotency_key,
        event_data
    )
    values (
        p_journey_id,
        p_event_type,
        p_actor_type,
        p_actor_id,
        p_idempotency_key,
        p_event_data
    )
    returning id into v_existing_event_id;


    -- Update the materialized current state.
    update public.care_journeys
    set
        current_state = p_target_state,
        version = version + 1,
        completed_at = case
            when p_target_state = 'COMPLETED' then now()
            else completed_at
        end
    where id = p_journey_id
    returning * into v_journey;


    -- Record the action in the protected audit log.
    insert into public.audit_logs (
        actor_type,
        actor_id,
        action,
        resource_type,
        resource_id,
        details
    )
    values (
        p_actor_type,
        p_actor_id,
        'JOURNEY_STATE_TRANSITIONED',
        'care_journey',
        p_journey_id,
        jsonb_build_object(
            'targetState', p_target_state,
            'eventType', p_event_type,
            'newVersion', v_journey.version
        )
    );


    return jsonb_build_object(
        'journeyId', v_journey.id,
        'currentState', v_journey.current_state,
        'version', v_journey.version,
        'eventId', v_existing_event_id,
        'duplicate', false
    );
end;
$$;


-- This operation must never be called using the browser's
-- public Supabase key.
revoke all on function public.transition_care_journey(
    uuid,
    integer,
    text,
    text,
    text,
    text,
    text,
    jsonb
) from public, anon, authenticated;

grant execute on function public.transition_care_journey(
    uuid,
    integer,
    text,
    text,
    text,
    text,
    text,
    jsonb
) to service_role;