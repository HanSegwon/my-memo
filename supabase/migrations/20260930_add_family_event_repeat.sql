-- 집안행사에 기준 연도와 매년 반복 여부 추가
-- 기존 행사는 기존 동작과 동일하게 매년 반복으로 유지합니다.
create table if not exists public.family_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 100),
  event_month smallint not null check (event_month between 1 and 12),
  event_day smallint not null check (event_day between 1 and 31),
  calendar_type text not null default 'solar'
    check (calendar_type in ('solar', 'lunar')),
  is_leap_month boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.family_events
  add column if not exists event_year smallint;

update public.family_events
set event_year = extract(year from current_date)::smallint
where event_year is null;

alter table public.family_events
  alter column event_year set default extract(year from current_date)::smallint,
  alter column event_year set not null;

alter table public.family_events
  add column if not exists repeat_yearly boolean not null default true;

create index if not exists family_events_calendar_date_idx
  on public.family_events (event_month, event_day);

alter table public.family_events enable row level security;
