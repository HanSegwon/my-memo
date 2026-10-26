-- 기존 데이터베이스도 생활루틴 탭을 최대 4개까지 허용합니다.
alter table public.routine_tabs
  drop constraint if exists routine_tabs_sort_order_check;

alter table public.routine_tabs
  add constraint routine_tabs_sort_order_check
  check (sort_order between 0 and 3);
