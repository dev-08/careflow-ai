-- ============================================================
-- AI triage results
-- Stores structured Gemini recommendations for synthetic data.
-- ============================================================

create table public.ai_triage_results (
    id uuid primary key default gen_random_uuid(),

    intake_id uuid not null
        references public.patient_intakes(id)
        on delete cascade,

    journey_id uuid not null
        references public.care_journeys(id)
        on delete cascade,

    model_name text not null,

    prompt_version text not null
        default 'triage-v1',

    urgency_level text not null
        check (
            urgency_level in (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    confidence numeric(5,4) not null
        check (
            confidence >= 0
            and confidence <= 1
        ),

    recommended_state text not null
        check (
            recommended_state in (
                'TRIAGE_PENDING',
                'CLINICIAN_REVIEW'
            )
        ),

    requires_human_review boolean not null,

    summary text not null,

    rationale text not null,

    risk_indicators text[] not null
        default '{}'::text[],

    raw_response jsonb not null
        default '{}'::jsonb,

    attempt_number integer not null
        default 1
        check (attempt_number > 0),

    idempotency_key text not null unique,

    created_at timestamptz not null default now(),

    constraint ai_triage_results_intake_attempt_unique
        unique (intake_id, attempt_number)
);


create index ai_triage_results_intake_index
    on public.ai_triage_results(intake_id);

create index ai_triage_results_journey_index
    on public.ai_triage_results(journey_id);

create index ai_triage_results_created_at_index
    on public.ai_triage_results(created_at desc);