-- Master 3.0 체중관리 기록 및 간헐적 단식 설정
create table if not exists public.weight_settings (
  id smallint primary key default 1 check (id = 1),
  fasting_frequency text not null default 'weekly'
    check (fasting_frequency in ('weekly', 'biweekly')),
  fasting_weekdays integer[] not null default '{}'::integer[]
    check (fasting_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]),
  fasting_anchor_date date not null default current_date,
  updated_at timestamptz not null default now()
);

insert into public.weight_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.weight_records (
  record_date date primary key,
  weight_kg numeric(5, 2)
    check (weight_kg is null or (weight_kg > 0 and weight_kg <= 500)),
  exercise text
    check (exercise is null or exercise in ('상체', '하체', '코어', '휴식')),
  breakfast text
    check (breakfast is null or breakfast in ('미취식', '소식', '보통', '과식')),
  lunch text
    check (lunch is null or lunch in ('미취식', '소식', '보통', '과식')),
  dinner text
    check (dinner is null or dinner in ('미취식', '소식', '보통', '과식')),
  other_food text,
  updated_at timestamptz not null default now()
);

alter table public.weight_settings enable row level security;
alter table public.weight_records enable row level security;
