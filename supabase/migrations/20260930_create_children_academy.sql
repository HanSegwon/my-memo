-- 자녀별 월~금 학교·학원 시간표
create table if not exists public.children_academy_schedules (
  id uuid primary key default gen_random_uuid(),
  child_name text not null check (child_name in ('한유준', '한이준')),
  weekday smallint not null check (weekday between 1 and 5),
  title text not null check (char_length(trim(title)) between 1 and 100),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time >= time '09:00' and start_time < time '20:00'),
  check (end_time > start_time and end_time <= time '20:00'),
  check (extract(minute from start_time)::integer % 10 = 0),
  check (extract(minute from end_time)::integer % 10 = 0)
);

create index if not exists children_academy_child_weekday_time_idx
  on public.children_academy_schedules (child_name, weekday, start_time);

alter table public.children_academy_schedules enable row level security;
