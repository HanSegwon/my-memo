-- 경조사비 연락처와 입출금 기록
create table if not exists public.affair_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  relation text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affair_contacts_name_idx
  on public.affair_contacts (name);

create table if not exists public.affair_transactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.affair_contacts(id) on delete cascade,
  flow text not null check (flow in ('expense', 'income')),
  event_date date not null,
  event_name text not null check (char_length(trim(event_name)) between 1 and 100),
  amount numeric(14, 0) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists affair_transactions_contact_date_idx
  on public.affair_transactions (contact_id, event_date desc);

alter table public.affair_contacts enable row level security;
alter table public.affair_transactions enable row level security;
