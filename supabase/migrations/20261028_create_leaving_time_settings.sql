-- Single-user settings for the leaving-time planner.
create table if not exists public.leaving_time_settings (
  id text primary key check (id = 'default'),
  start_time time without time zone,
  goal_hours smallint not null default 0 check (goal_hours between 0 and 99),
  goal_minutes smallint not null default 0 check (goal_minutes between 0 and 59),
  exclusions jsonb not null default '[]'::jsonb check (jsonb_typeof(exclusions) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.leaving_time_settings enable row level security;
