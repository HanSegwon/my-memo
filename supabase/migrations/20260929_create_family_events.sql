-- Master 3.0 집안행사: 음력/양력의 월일을 저장해 매년 반복 표시합니다.
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

create index if not exists family_events_calendar_date_idx
  on public.family_events (event_month, event_day);

alter table public.family_events enable row level security;
