select to_regclass('public.ai_triage_results');

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ai_triage_results'
order by ordinal_position;

notify pgrst, 'reload schema';


select has_table_privilege(
    'service_role',
    'public.ai_triage_results',
    'SELECT'
);


grant select
on table
    public.care_journeys,
    public.patient_intakes
to service_role;

notify pgrst, 'reload schema';

grant usage
on schema public
to service_role;

grant select
on table public.ai_triage_results
to service_role;

notify pgrst, 'reload schema';

select
    has_table_privilege(
        'service_role',
        'public.ai_triage_results',
        'SELECT'
    ) as can_read_triage_results,

    has_table_privilege(
        'service_role',
        'public.care_journeys',
        'SELECT'
    ) as can_read_journeys,

    has_table_privilege(
        'service_role',
        'public.patient_intakes',
        'SELECT'
    ) as can_read_intakes;



    grant usage
on schema public
to service_role;

grant select
on table
    public.ai_triage_results,
    public.care_journeys,
    public.patient_intakes
to service_role;






select id, current_state, version
from public.care_journeys
where id = 'd381fe01-6b2a-42ba-a19d-9d1ea990115f';


select
    r.urgency_level,
    r.confidence,
    r.recommended_state,
    r.requires_human_review,
    r.summary,
    r.risk_indicators,
    j.current_state,
    j.version,
    i.status as intake_status
from public.ai_triage_results r
join public.care_journeys j
    on j.id = r.journey_id
join public.patient_intakes i
    on i.id = r.intake_id
where r.journey_id =
    'd381fe01-6b2a-42ba-a19d-9d1ea990115f'
order by r.created_at desc
limit 1;




select
    id,
    email,
    created_at,
    last_sign_in_at
from auth.users
order by created_at;\

clinician@careflow.test



update auth.users
set
    encrypted_password = extensions.crypt(
        'test@1234',
        extensions.gen_salt('bf')
    ),
    updated_at = now()
where email = 'clinician@careflow.test'
returning id, email;


select id, current_state, version
from public.care_journeys
where id = 'd381fe01-6b2a-42ba-a19d-9d1ea990115f';




select
    has_table_privilege(
        'service_role',
        'public.patients',
        'SELECT'
    ) as can_read_patients,

    has_table_privilege(
        'service_role',
        'public.care_events',
        'SELECT'
    ) as can_read_events,

    has_table_privilege(
        'service_role',
        'public.ai_triage_results',
        'SELECT'
    ) as can_read_triage;



    grant select
on table
    public.patients,
    public.care_events,
    public.ai_triage_results
to service_role;

notify pgrst, 'reload schema';


select
    j.id as journey_id,
    j.current_state,
    j.version,
    j.created_at,
    p.first_name,
    p.last_name,
    p.email
from public.care_journeys j
join public.patients p
    on p.id = j.patient_id
order by j.created_at desc
limit 10;