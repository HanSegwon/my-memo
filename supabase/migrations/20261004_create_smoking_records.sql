-- Master 3.0 금연관리 일별 기록
create table if not exists public.smoking_records (
  record_date date primary key,
  regular_count integer check (regular_count is null or regular_count between 0 and 9999),
  electronic_count integer check (electronic_count is null or electronic_count between 0 and 9999),
  updated_at timestamptz not null default now(),
  check (regular_count is not null or electronic_count is not null)
);

alter table public.smoking_records enable row level security;
