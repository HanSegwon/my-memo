alter table public.fixed_expense_months
  drop constraint if exists fixed_expense_months_month_start_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fixed_expense_months_first_day_check'
      and conrelid = 'public.fixed_expense_months'::regclass
  ) then
    alter table public.fixed_expense_months
      add constraint fixed_expense_months_first_day_check check (extract(day from month_start) = 1);
  end if;
end;
$$;
