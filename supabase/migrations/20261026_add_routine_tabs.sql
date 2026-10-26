-- 생활루틴 탭을 최대 4개까지 관리하고 이름을 저장합니다.
create table if not exists public.routine_tabs (
  id text primary key,
  title text not null check (char_length(trim(title)) between 1 and 30),
  day_type text not null check (day_type in ('weekday', 'holiday', 'custom')),
  sort_order integer not null unique check (sort_order between 0 and 3),
  created_at timestamptz not null default now()
);

insert into public.routine_tabs (id, title, day_type, sort_order)
values
  ('weekday', '평일 루틴', 'weekday', 0),
  ('holiday', '휴일 루틴', 'holiday', 1)
on conflict (id) do nothing;

alter table public.routine_items
  add column if not exists routine_tab_id text;

update public.routine_items
set routine_tab_id = day_type
where routine_tab_id is null;

alter table public.routine_items
  alter column routine_tab_id set not null;

alter table public.routine_items
  drop constraint if exists routine_items_day_type_check;

alter table public.routine_items
  add constraint routine_items_day_type_check
  check (day_type in ('weekday', 'holiday', 'custom'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'routine_items_routine_tab_id_fkey'
      and conrelid = 'public.routine_items'::regclass
  ) then
    alter table public.routine_items
      add constraint routine_items_routine_tab_id_fkey
      foreign key (routine_tab_id) references public.routine_tabs(id) on delete cascade;
  end if;
end $$;

create index if not exists routine_items_tab_start_time_idx
  on public.routine_items (routine_tab_id, start_time, created_at);

alter table public.routine_tabs enable row level security;
