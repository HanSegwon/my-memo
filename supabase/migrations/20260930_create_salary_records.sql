-- Master 3.0 연봉추이 월별 기록
create table if not exists public.salary_records (
  income_year smallint not null check (income_year between 2015 and 2200),
  income_month smallint not null check (income_month between 1 and 12),
  monthly_salary numeric(14, 0) check (monthly_salary is null or monthly_salary >= 0),
  base_bonus numeric(14, 0) check (base_bonus is null or base_bonus >= 0),
  extra_bonus numeric(14, 0) check (extra_bonus is null or extra_bonus >= 0),
  is_sample boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (income_year, income_month)
);

create index if not exists salary_records_year_month_idx
  on public.salary_records (income_year, income_month);

alter table public.salary_records enable row level security;

-- 화면 확인용 가상 예시입니다. 이미 입력된 월별 자료는 덮어쓰지 않습니다.
insert into public.salary_records
  (income_year, income_month, monthly_salary, base_bonus, extra_bonus, is_sample)
select
  y.income_year,
  m.income_month,
  case y.income_year
    when 2015 then 2800000
    when 2016 then 3000000
    else 3200000
  end + (m.income_month - 1) * 20000,
  150000,
  case when m.income_month = 7 then 1000000 when m.income_month = 12 then 1300000 else 0 end,
  true
from generate_series(2015, 2017) as y(income_year)
cross join generate_series(1, 12) as m(income_month)
on conflict (income_year, income_month) do nothing;
