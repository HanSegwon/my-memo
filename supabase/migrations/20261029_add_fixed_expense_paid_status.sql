alter table public.fixed_expense_items
  add column if not exists is_paid boolean not null default false;
