-- 할 일 메모의 완료 상태를 저장합니다.
alter table public.memos
  add column if not exists is_completed boolean not null default false,
  add column if not exists completed_at timestamptz;

create index if not exists memos_completed_at_idx
  on public.memos (completed_at)
  where is_completed = true;
