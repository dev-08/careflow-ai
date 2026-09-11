-- ============================================================
-- CareFlow AI patient intake workflow
-- Creates the intake table and transactional submission function.
-- ============================================================


-- ============================================================
-- Patient intake table
-- ============================================================

create table public.patient_intakes (
    id uuid primary key default gen_random_uuid(),

    patient_id uuid not null
        references public.patients(id)
        on delete restrict,

    journey_id uuid not null unique
        references public.care_journeys(id)
        on delete cascade,

    reason_for_care text not null,

    symptoms text[] not null
        default '{}'::text[],

    symptom_duration text,

    urgency_self_rating integer not null
        check (
            urgency_self_rating between 1 and 10
        ),

    additional_notes text,

    consent_to_contact boolean not null,

    status text not null
        default 'SUBMITTED'
        check (
            status in (
                'SUBMITTED',
                'TRIAGE_IN_PROGRESS',
                'TRIAGED',
                'CANCELLED'
            )
        ),

    submitted_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint patient_intakes_reason_required
        check (
            length(trim(reason_for_care)) >= 5
        )
);


create index patient_intakes_patient_id_index
    on public.patient_intakes(patient_id);

create index patient_intakes_journey_id_index
    on public.patient_intakes(journey_id);

create index patient_intakes_status_index
    on public.patient_intakes(status);

create index patient_intakes_submitted_at_index
    on public.patient_intakes(submitted_at desc);


-- ============================================================
-- Transactional intake submission function
-- ============================================================

create or replace function public.submit_patient_intake(
    p_first_name text,
    p_last_name text,
    p_email text,
    p_date_of_birth date,
    p_reason_for_care text,
    p_symptoms text[],
    p_symptom_duration text,
    p_urgency_self_rating integer,
    p_additional_notes text,
    p_consent_to_contact boolean,
    p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_patient_id uuid;
    v_journey_id uuid;
    v_intake_id uuid;
    v_event_id uuid;

    v_existing_event_id uuid;
    v_existing_journey_id uuid;
    v_existing_intake_id uuid;
    v_existing_journey public.care_journeys%rowtype;
begin
    -- ========================================================
    -- Input validation
    -- ========================================================

    if nullif(trim(p_first_name), '') is null then
        raise exception 'First name is required';
    end if;

    if nullif(trim(p_last_name), '') is null then
        raise exception 'Last name is required';
    end if;

    if nullif(trim(p_email), '') is null then
        raise exception 'Email is required';
    end if;

    if p_date_of_birth is null then
        raise exception 'Date of birth is required';
    end if;

    if p_date_of_birth > current_date then
        raise exception
            'Date of birth cannot be in the future';
    end if;

    if nullif(trim(p_reason_for_care), '') is null
       or length(trim(p_reason_for_care)) < 5 then
        raise exception
            'Reason for care must contain at least 5 characters';
    end if;

    if p_urgency_self_rating is null
       or p_urgency_self_rating not between 1 and 10 then
        raise exception
            'Urgency rating must be between 1 and 10';
    end if;

    if p_consent_to_contact is not true then
        raise exception
            'Consent to contact is required';
    end if;

    if nullif(trim(p_idempotency_key), '') is null then
        raise exception
            'Idempotency key is required';
    end if;


    -- ========================================================
    -- Idempotency check
    -- ========================================================

    select
        event.id,
        event.journey_id,
        intake.id
    into
        v_existing_event_id,
        v_existing_journey_id,
        v_existing_intake_id
    from public.care_events event
    left join public.patient_intakes intake
        on intake.journey_id = event.journey_id
    where event.idempotency_key = p_idempotency_key
    limit 1;

    if found then
        select *
        into v_existing_journey
        from public.care_journeys
        where id = v_existing_journey_id;

        return jsonb_build_object(
            'patientId', v_existing_journey.patient_id,
            'intakeId', v_existing_intake_id,
            'journeyId', v_existing_journey.id,
            'currentState', v_existing_journey.current_state,
            'version', v_existing_journey.version,
            'eventId', v_existing_event_id,
            'duplicate', true
        );
    end if;


    -- ========================================================
    -- Find or create the synthetic patient
    -- ========================================================

    select id
    into v_patient_id
    from public.patients
    where lower(email) = lower(trim(p_email))
    limit 1;

    if v_patient_id is null then
        v_patient_id := gen_random_uuid();

        insert into public.patients (
            id,
            first_name,
            last_name,
            email,
            date_of_birth
        )
        values (
            v_patient_id,
            trim(p_first_name),
            trim(p_last_name),
            lower(trim(p_email)),
            p_date_of_birth
        );
    end if;


    -- ========================================================
    -- Create the care journey
    -- ========================================================

    v_journey_id := gen_random_uuid();

    insert into public.care_journeys (
        id,
        patient_id,
        current_state,
        version
    )
    values (
        v_journey_id,
        v_patient_id,
        'INTAKE_PENDING',
        1
    );


    -- ========================================================
    -- Create the intake record
    -- ========================================================

    insert into public.patient_intakes (
        patient_id,
        journey_id,
        reason_for_care,
        symptoms,
        symptom_duration,
        urgency_self_rating,
        additional_notes,
        consent_to_contact,
        status
    )
    values (
        v_patient_id,
        v_journey_id,
        trim(p_reason_for_care),
        coalesce(p_symptoms, '{}'::text[]),
        nullif(trim(p_symptom_duration), ''),
        p_urgency_self_rating,
        nullif(trim(p_additional_notes), ''),
        p_consent_to_contact,
        'SUBMITTED'
    )
    returning id into v_intake_id;


    -- ========================================================
    -- Create the immutable initial event
    -- ========================================================

    insert into public.care_events (
        journey_id,
        event_type,
        actor_type,
        actor_id,
        idempotency_key,
        event_data
    )
    values (
        v_journey_id,
        'INTAKE_SUBMITTED',
        'PATIENT',
        v_patient_id::text,
        p_idempotency_key,
        jsonb_build_object(
            'intakeId', v_intake_id,
            'reasonForCare', trim(p_reason_for_care),
            'symptoms', coalesce(
                p_symptoms,
                '{}'::text[]
            ),
            'symptomDuration',
                nullif(trim(p_symptom_duration), ''),
            'urgencySelfRating',
                p_urgency_self_rating,
            'source',
                'careflow-intake-form'
        )
    )
    returning id into v_event_id;


    -- ========================================================
    -- Create the audit record
    -- ========================================================

    insert into public.audit_logs (
        actor_type,
        actor_id,
        action,
        resource_type,
        resource_id,
        details
    )
    values (
        'PATIENT',
        v_patient_id::text,
        'PATIENT_INTAKE_SUBMITTED',
        'care_journey',
        v_journey_id,
        jsonb_build_object(
            'intakeId', v_intake_id,
            'initialState', 'INTAKE_PENDING',
            'containsRealPatientData', false
        )
    );


    -- ========================================================
    -- Return the transaction result
    -- ========================================================

    return jsonb_build_object(
        'patientId', v_patient_id,
        'intakeId', v_intake_id,
        'journeyId', v_journey_id,
        'currentState', 'INTAKE_PENDING',
        'version', 1,
        'eventId', v_event_id,
        'duplicate', false
    );
end;
$$;


-- ============================================================
-- Function permissions
-- Only the server-side service role may execute this operation.
-- ============================================================

revoke all on function public.submit_patient_intake(
    text,
    text,
    text,
    date,
    text,
    text[],
    text,
    integer,
    text,
    boolean,
    text
) from public, anon, authenticated;

grant execute on function public.submit_patient_intake(
    text,
    text,
    text,
    date,
    text,
    text[],
    text,
    integer,
    text,
    boolean,
    text
) to service_role;