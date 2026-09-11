-- ============================================================
-- CareFlow AI: Initial database schema
-- All patient information used in development must be synthetic.
-- ============================================================

-- Automatically updates the updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- ============================================================
-- Patients
-- Stores basic information about fictional patients.
-- ============================================================

create table public.patients (
    id uuid primary key default gen_random_uuid(),
    first_name text not null,
    last_name text not null,
    email text not null unique,
    date_of_birth date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger patients_set_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();


-- ============================================================
-- Care journeys
-- Represents the current state of a patient's workflow.
-- ============================================================

create table public.care_journeys (
    id uuid primary key default gen_random_uuid(),

    patient_id uuid not null
        references public.patients(id)
        on delete restrict,

    current_state text not null default 'INTAKE_PENDING'
        check (
            current_state in (
                'INTAKE_PENDING',
                'TRIAGE_PENDING',
                'CLINICIAN_REVIEW',
                'APPOINTMENT_SCHEDULED',
                'FOLLOW_UP_REQUIRED',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    version integer not null default 1
        check (version > 0),

    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint completed_journey_requires_date
        check (
            current_state <> 'COMPLETED'
            or completed_at is not null
        )
);

create index care_journeys_patient_id_index
on public.care_journeys(patient_id);

create index care_journeys_current_state_index
on public.care_journeys(current_state);

create trigger care_journeys_set_updated_at
before update on public.care_journeys
for each row
execute function public.set_updated_at();


-- ============================================================
-- Care events
-- Immutable history of everything that happens in a journey.
-- ============================================================

create table public.care_events (
    id uuid primary key default gen_random_uuid(),

    journey_id uuid not null
        references public.care_journeys(id)
        on delete restrict,

    event_type text not null,
    event_version integer not null default 1
        check (event_version > 0),

    actor_type text not null
        check (
            actor_type in (
                'PATIENT',
                'CLINICIAN',
                'AGENT',
                'SYSTEM'
            )
        ),

    actor_id text,
    idempotency_key text not null unique,
    event_data jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index care_events_journey_id_index
on public.care_events(journey_id);

create index care_events_event_type_index
on public.care_events(event_type);

create index care_events_occurred_at_index
on public.care_events(occurred_at);


-- ============================================================
-- Audit logs
-- Records access and actions affecting protected information.
-- ============================================================

create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_type text not null,
    actor_id text,
    action text not null,
    resource_type text not null,
    resource_id uuid,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index audit_logs_resource_index
on public.audit_logs(resource_type, resource_id);

create index audit_logs_created_at_index
on public.audit_logs(created_at);


-- ============================================================
-- Append-only protection
-- Events and audit records cannot be updated or deleted.
-- ============================================================

create or replace function public.prevent_record_modification()
returns trigger
language plpgsql
as $$
begin
    raise exception '% records are append-only', tg_table_name;
end;
$$;

create trigger prevent_care_event_update_or_delete
before update or delete on public.care_events
for each row
execute function public.prevent_record_modification();

create trigger prevent_audit_log_update_or_delete
before update or delete on public.audit_logs
for each row
execute function public.prevent_record_modification();