-- Persist the current smoking cessation start time.
create table if not exists public.smoking_quit_status (
  id smallint primary key default 1 check (id = 1),
  quit_started_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.smoking_quit_status (id)
values (1)
on conflict (id) do nothing;

alter table public.smoking_quit_status enable row level security;
