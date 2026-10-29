-- Monthly snapshots for fixed expenses. Each month is independent after its first copy.
create table if not exists public.fixed_expense_months (
  month_start date primary key check (extract(day from month_start) = 1),
  created_at timestamptz not null default now()
);

create table if not exists public.fixed_expense_categories (
  id uuid primary key default gen_random_uuid(),
  month_start date not null references public.fixed_expense_months(month_start) on delete cascade,
  name text not null default '새 카테고리' check (char_length(trim(name)) between 1 and 40),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.fixed_expense_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.fixed_expense_categories(id) on delete cascade,
  expense_name text not null default '지출항목' check (char_length(trim(expense_name)) between 1 and 60),
  due_day smallint not null default 21 check (due_day between 1 and 31),
  fixed_amount bigint not null default 100000 check (fixed_amount >= 0),
  actual_amount bigint check (actual_amount is null or actual_amount >= 0),
  is_paid boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists fixed_expense_categories_month_order_idx
  on public.fixed_expense_categories (month_start, sort_order, created_at);
create index if not exists fixed_expense_items_category_order_idx
  on public.fixed_expense_items (category_id, sort_order, created_at);

alter table public.fixed_expense_months enable row level security;
alter table public.fixed_expense_categories enable row level security;
alter table public.fixed_expense_items enable row level security;
