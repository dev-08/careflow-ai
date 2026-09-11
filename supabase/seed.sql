-- ============================================================
-- CareFlow AI synthetic development data
-- All people and scenarios are fictional.
-- ============================================================


-- Synthetic patient
insert into public.patients (
    id,
    first_name,
    last_name,
    email,
    date_of_birth
)
values (
    '10000000-0000-0000-0000-000000000001',
    'Jordan',
    'Taylor',
    'jordan.taylor@example.test',
    '1995-04-12'
);


-- Patient care journey
insert into public.care_journeys (
    id,
    patient_id,
    current_state,
    version
)
values (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'CLINICIAN_REVIEW',
    3
);


-- Immutable journey events
insert into public.care_events (
    journey_id,
    event_type,
    event_version,
    actor_type,
    actor_id,
    idempotency_key,
    event_data,
    occurred_at
)
values
(
    '20000000-0000-0000-0000-000000000001',
    'INTAKE_SUBMITTED',
    1,
    'PATIENT',
    '10000000-0000-0000-0000-000000000001',
    'seed-intake-submitted-001',
    '{
        "source": "web",
        "reason": "Requested an initial mental-health consultation"
    }'::jsonb,
    now() - interval '2 hours'
),
(
    '20000000-0000-0000-0000-000000000001',
    'TRIAGE_STARTED',
    1,
    'AGENT',
    'care-coordinator-agent',
    'seed-triage-started-001',
    '{
        "agentVersion": "0.1.0",
        "trigger": "INTAKE_SUBMITTED"
    }'::jsonb,
    now() - interval '90 minutes'
),
(
    '20000000-0000-0000-0000-000000000001',
    'CLINICIAN_REVIEW_REQUESTED',
    1,
    'AGENT',
    'care-coordinator-agent',
    'seed-clinician-review-001',
    '{
        "reason": "Agent confidence below automated-processing threshold",
        "confidence": 0.62,
        "requiredAction": "Human review"
    }'::jsonb,
    now() - interval '60 minutes'
);


-- Protected audit entry
insert into public.audit_logs (
    actor_type,
    actor_id,
    action,
    resource_type,
    resource_id,
    details
)
values (
    'SYSTEM',
    'seed-script',
    'SYNTHETIC_JOURNEY_CREATED',
    'care_journey',
    '20000000-0000-0000-0000-000000000001',
    '{
        "environment": "local",
        "containsRealPatientData": false
    }'::jsonb
);


-- ============================================================
-- Additional synthetic patients for dashboard testing
-- ============================================================

insert into public.patients (
    id,
    first_name,
    last_name,
    email,
    date_of_birth
)
values
(
    '10000000-0000-0000-0000-000000000002',
    'Avery',
    'Morgan',
    'avery.morgan@example.test',
    '1988-08-21'
),
(
    '10000000-0000-0000-0000-000000000003',
    'Morgan',
    'Lee',
    'morgan.lee@example.test',
    '1992-02-14'
),
(
    '10000000-0000-0000-0000-000000000004',
    'Casey',
    'Williams',
    'casey.williams@example.test',
    '1985-11-03'
),
(
    '10000000-0000-0000-0000-000000000005',
    'Riley',
    'Johnson',
    'riley.johnson@example.test',
    '1998-06-17'
);


-- ============================================================
-- Additional journeys in different workflow states
-- ============================================================

insert into public.care_journeys (
    id,
    patient_id,
    current_state,
    version
)
values
(
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'INTAKE_PENDING',
    1
),
(
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    'TRIAGE_PENDING',
    2
),
(
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    'APPOINTMENT_SCHEDULED',
    4
),
(
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    'FOLLOW_UP_REQUIRED',
    5
);