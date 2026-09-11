-- ============================================================
-- Temporary read-only policies for synthetic demo data.
-- These policies will be replaced with authenticated access.
-- ============================================================

-- Enable Row Level Security.
alter table public.patients enable row level security;
alter table public.care_journeys enable row level security;
alter table public.care_events enable row level security;
alter table public.audit_logs enable row level security;


-- Allow the API roles to use the public schema.
grant usage on schema public to anon, authenticated;


-- Allow read access only to the three dashboard tables.
grant select on table public.patients to anon, authenticated;
grant select on table public.care_journeys to anon, authenticated;
grant select on table public.care_events to anon, authenticated;


-- Do not grant public access to audit logs.
revoke all on table public.audit_logs from anon, authenticated;


-- Temporary policies for synthetic development data.
create policy "Synthetic patients are readable in development"
on public.patients
for select
to anon, authenticated
using (email like '%@example.test');


create policy "Synthetic care journeys are readable in development"
on public.care_journeys
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.patients
        where patients.id = care_journeys.patient_id
          and patients.email like '%@example.test'
    )
);


create policy "Synthetic care events are readable in development"
on public.care_events
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.care_journeys
        join public.patients
          on patients.id = care_journeys.patient_id
        where care_journeys.id = care_events.journey_id
          and patients.email like '%@example.test'
    )
);