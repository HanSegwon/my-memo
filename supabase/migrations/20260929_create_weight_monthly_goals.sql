create table if not exists public.weight_monthly_goals (
  goal_month date primary key
    check (extract(day from goal_month) = 1),
  target_weight numeric(5, 2) not null
    check (target_weight > 0 and target_weight <= 500),
  updated_at timestamptz not null default now()
);

alter table public.weight_monthly_goals enable row level security;
