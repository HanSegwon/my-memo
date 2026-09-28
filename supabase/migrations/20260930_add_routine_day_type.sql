-- 생활루틴을 평일/휴일로 나누기 위한 분류 열입니다.
-- 기존 생활루틴은 평일 루틴으로 유지됩니다.
alter table public.routine_items
  add column if not exists day_type text not null default 'weekday';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'routine_items_day_type_check'
      and conrelid = 'public.routine_items'::regclass
  ) then
    alter table public.routine_items
      add constraint routine_items_day_type_check
      check (day_type in ('weekday', 'holiday'));
  end if;
end $$;

create index if not exists routine_items_day_type_start_time_idx
  on public.routine_items (day_type, start_time, created_at);
