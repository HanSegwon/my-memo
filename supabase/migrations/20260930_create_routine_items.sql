-- Master 3.0 생활루틴
create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  start_time time not null,
  end_time time not null,
  title text not null check (char_length(trim(title)) between 1 and 100),
  details text check (details is null or char_length(details) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists routine_items_start_time_idx
  on public.routine_items (start_time, created_at);

alter table public.routine_items enable row level security;
