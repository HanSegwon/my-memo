-- Health routine exercise records for the Master 3.0 dashboard.
create table if not exists public.health_routine_exercises (
  id uuid primary key default gen_random_uuid(),
  body_part text not null check (body_part in ('upper', 'lower')),
  exercise_name text not null check (char_length(trim(exercise_name)) between 1 and 80),
  repetitions smallint not null check (repetitions between 1 and 99),
  sets smallint not null check (sets between 1 and 9),
  intensity text not null check (intensity in ('easy', 'normal', 'hard')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_routine_exercises_order_idx
  on public.health_routine_exercises (body_part, sort_order, created_at);

create or replace function public.set_health_routine_exercise_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists health_routine_exercises_updated_at
  on public.health_routine_exercises;

create trigger health_routine_exercises_updated_at
before update on public.health_routine_exercises
for each row execute function public.set_health_routine_exercise_updated_at();

alter table public.health_routine_exercises enable row level security;
