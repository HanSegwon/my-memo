-- Monthly overtime dashboard: per-day attendance/work durations and the hourly wage setting.
create table if not exists public.overtime_records (
  record_date date primary key,
  worked boolean not null default false,
  attendance text check (attendance is null or char_length(attendance) <= 40),
  weekday_total_minutes smallint check (weekday_total_minutes is null or weekday_total_minutes between 0 and 1439),
  weekday_night_minutes smallint check (weekday_night_minutes is null or weekday_night_minutes between 0 and 1439),
  weekend_total_minutes smallint check (weekend_total_minutes is null or weekend_total_minutes between 0 and 1439),
  weekend_overtime_minutes smallint check (weekend_overtime_minutes is null or weekend_overtime_minutes between 0 and 1439),
  weekend_night_minutes smallint check (weekend_night_minutes is null or weekend_night_minutes between 0 and 1439),
  updated_at timestamptz not null default now()
);

create table if not exists public.overtime_settings (
  id smallint primary key default 1 check (id = 1),
  hourly_wage bigint not null default 26117 check (hourly_wage >= 0),
  updated_at timestamptz not null default now()
);

insert into public.overtime_settings (id)
values (1)
on conflict (id) do nothing;

create index if not exists overtime_records_month_idx
  on public.overtime_records (record_date);

alter table public.overtime_records enable row level security;
alter table public.overtime_settings enable row level security;
