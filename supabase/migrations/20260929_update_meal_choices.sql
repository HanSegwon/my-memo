-- Replace meal choices while keeping existing daily records.
alter table public.weight_records
  add column if not exists other_food text;

alter table public.weight_records
  drop column if exists bowel_movements;

alter table public.weight_records
  drop constraint if exists weight_records_breakfast_check,
  drop constraint if exists weight_records_lunch_check,
  drop constraint if exists weight_records_dinner_check;

update public.weight_records
set breakfast = case breakfast
      when '금식' then '미취식'
      when '적게' then '소식'
      when '중간' then '보통'
      when '많이' then '과식'
      else breakfast
    end,
    lunch = case lunch
      when '금식' then '미취식'
      when '적게' then '소식'
      when '중간' then '보통'
      when '많이' then '과식'
      else lunch
    end,
    dinner = case dinner
      when '금식' then '미취식'
      when '적게' then '소식'
      when '중간' then '보통'
      when '많이' then '과식'
      else dinner
    end;

alter table public.weight_records
  add constraint weight_records_breakfast_check
    check (breakfast is null or breakfast in ('미취식', '소식', '보통', '과식')),
  add constraint weight_records_lunch_check
    check (lunch is null or lunch in ('미취식', '소식', '보통', '과식')),
  add constraint weight_records_dinner_check
    check (dinner is null or dinner in ('미취식', '소식', '보통', '과식'));
