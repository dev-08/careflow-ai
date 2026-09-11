-- Staff roles used for application authorization.
create table public.staff_profiles (
    user_id uuid primary key
        references auth.users(id) on delete cascade,

    display_name text not null,

    role text not null
        check (role in ('CLINICIAN', 'ADMIN')),

    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- Staff profiles must not be publicly accessible.
alter table public.staff_profiles enable row level security;

revoke all
on table public.staff_profiles
from anon, authenticated;


-- Authenticated users may only read their own profile.
grant select
on table public.staff_profiles
to authenticated;

create policy "Staff can read their own profile"
on public.staff_profiles
for select
to authenticated
using (
    auth.uid() = user_id
);