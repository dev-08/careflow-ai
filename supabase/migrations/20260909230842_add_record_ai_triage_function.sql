create or replace function public.record_ai_triage_result(
    p_journey_id uuid,
    p_expected_version integer,
    p_model_name text,
    p_prompt_version text,
    p_urgency_level text,
    p_confidence numeric,
    p_recommended_state text,
    p_requires_human_review boolean,
    p_summary text,
    p_rationale text,
    p_risk_indicators text[],
    p_raw_response jsonb,
    p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_journey public.care_journeys%rowtype;
    v_intake public.patient_intakes%rowtype;
    v_result_id uuid;
    v_event_id uuid;
    v_attempt_number integer;
begin
    select *
    into v_journey
    from public.care_journeys
    where id = p_journey_id
    for update;

    if not found then
        raise exception 'Care journey not found';
    end if;

    -- Return the original result for duplicate requests.
    select id
    into v_result_id
    from public.ai_triage_results
    where idempotency_key = p_idempotency_key;

    if found then
        return jsonb_build_object(
            'triageResultId', v_result_id,
            'journeyId', v_journey.id,
            'currentState', v_journey.current_state,
            'version', v_journey.version,
            'duplicate', true
        );
    end if;

    if v_journey.version <> p_expected_version then
        raise exception
            'Journey version conflict. Expected %, current version is %',
            p_expected_version,
            v_journey.version;
    end if;

    if v_journey.current_state not in (
        'INTAKE_PENDING',
        'TRIAGE_PENDING'
    ) then
        raise exception
            'Journey cannot be triaged from state %',
            v_journey.current_state;
    end if;

    if p_urgency_level not in (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    ) then
        raise exception 'Invalid urgency level';
    end if;

    if p_confidence < 0 or p_confidence > 1 then
        raise exception 'Confidence must be between 0 and 1';
    end if;

    if p_recommended_state not in (
        'TRIAGE_PENDING',
        'CLINICIAN_REVIEW'
    ) then
        raise exception 'Invalid recommended state';
    end if;

    -- Safety rule: risky results must always go to a clinician.
    if (
        p_requires_human_review = true
        or p_urgency_level in ('HIGH', 'CRITICAL')
        or cardinality(
            coalesce(p_risk_indicators, '{}'::text[])
        ) > 0
    )
    and p_recommended_state <> 'CLINICIAN_REVIEW'
    then
        raise exception
            'High-risk triage must be routed to clinician review';
    end if;

    select *
    into v_intake
    from public.patient_intakes
    where journey_id = p_journey_id
    for update;

    if not found then
        raise exception 'Patient intake not found';
    end if;

    select coalesce(max(attempt_number), 0) + 1
    into v_attempt_number
    from public.ai_triage_results
    where intake_id = v_intake.id;

    insert into public.ai_triage_results (
        intake_id,
        journey_id,
        model_name,
        prompt_version,
        urgency_level,
        confidence,
        recommended_state,
        requires_human_review,
        summary,
        rationale,
        risk_indicators,
        raw_response,
        attempt_number,
        idempotency_key
    )
    values (
        v_intake.id,
        v_journey.id,
        p_model_name,
        p_prompt_version,
        p_urgency_level,
        p_confidence,
        p_recommended_state,
        p_requires_human_review,
        p_summary,
        p_rationale,
        coalesce(p_risk_indicators, '{}'::text[]),
        coalesce(p_raw_response, '{}'::jsonb),
        v_attempt_number,
        p_idempotency_key
    )
    returning id into v_result_id;

    update public.patient_intakes
    set
        status = 'TRIAGED',
        updated_at = now()
    where id = v_intake.id;

    update public.care_journeys
    set
        current_state = p_recommended_state,
        version = version + 1,
        updated_at = now()
    where id = v_journey.id
    returning * into v_journey;

    insert into public.care_events (
        journey_id,
        event_type,
        actor_type,
        actor_id,
        idempotency_key,
        event_data
    )
    values (
        v_journey.id,
        'AI_TRIAGE_COMPLETED',
        'AGENT',
        p_model_name,
        p_idempotency_key,
        jsonb_build_object(
            'triageResultId', v_result_id,
            'urgencyLevel', p_urgency_level,
            'confidence', p_confidence,
            'recommendedState', p_recommended_state,
            'requiresHumanReview', p_requires_human_review,
            'summary', p_summary,
            'rationale', p_rationale,
            'riskIndicators',
                coalesce(p_risk_indicators, '{}'::text[]),
            'promptVersion', p_prompt_version
        )
    )
    returning id into v_event_id;

    insert into public.audit_logs (
        actor_type,
        actor_id,
        action,
        resource_type,
        resource_id,
        details
    )
    values (
        'AGENT',
        p_model_name,
        'AI_TRIAGE_RECORDED',
        'care_journey',
        v_journey.id,
        jsonb_build_object(
            'triageResultId', v_result_id,
            'eventId', v_event_id,
            'newState', v_journey.current_state,
            'newVersion', v_journey.version
        )
    );

    return jsonb_build_object(
        'triageResultId', v_result_id,
        'journeyId', v_journey.id,
        'currentState', v_journey.current_state,
        'version', v_journey.version,
        'eventId', v_event_id,
        'duplicate', false
    );
end;
$$;


revoke all on function public.record_ai_triage_result(
    uuid,
    integer,
    text,
    text,
    text,
    numeric,
    text,
    boolean,
    text,
    text,
    text[],
    jsonb,
    text
) from public, anon, authenticated;


grant execute on function public.record_ai_triage_result(
    uuid,
    integer,
    text,
    text,
    text,
    numeric,
    text,
    boolean,
    text,
    text,
    text[],
    jsonb,
    text
) to service_role;