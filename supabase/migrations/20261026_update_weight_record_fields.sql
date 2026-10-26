-- Rename the existing free-text food field and add late-night food and aerobic exercise.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weight_records' and column_name = 'other_food'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weight_records' and column_name = 'snack'
  ) then
    alter table public.weight_records rename column other_food to snack;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weight_records' and column_name = 'other_food'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'weight_records' and column_name = 'snack'
  ) then
    update public.weight_records
    set snack = coalesce(snack, other_food)
    where other_food is not null;
  end if;
end $$;

alter table public.weight_records
  add column if not exists snack text,
  add column if not exists late_snack text,
  add column if not exists aerobic_exercise boolean;

-- Values previously displayed as 유산소 were stored as 코어; preserve them as both 코어 and O.
update public.weight_records
set aerobic_exercise = (exercise = '코어')
where aerobic_exercise is null and exercise is not null;
