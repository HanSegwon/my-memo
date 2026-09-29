-- 자녀학원 일정 카드 색상 선택과 08:00~22:00 입력 범위 지원
alter table public.children_academy_schedules
  add column if not exists color text not null default 'blue';

alter table public.children_academy_schedules
  drop constraint if exists children_academy_schedules_color_check;

alter table public.children_academy_schedules
  add constraint children_academy_schedules_color_check
  check (color in ('blue', 'mint', 'lavender', 'peach', 'yellow', 'rose', 'sky', 'sage'));

alter table public.children_academy_schedules
  drop constraint if exists children_academy_schedules_check;

alter table public.children_academy_schedules
  drop constraint if exists children_academy_schedules_check1;

alter table public.children_academy_schedules
  drop constraint if exists children_academy_schedules_start_time_check;

alter table public.children_academy_schedules
  add constraint children_academy_schedules_start_time_check
  check (start_time >= time '08:00' and start_time < time '22:00');

alter table public.children_academy_schedules
  drop constraint if exists children_academy_schedules_end_time_check;

alter table public.children_academy_schedules
  add constraint children_academy_schedules_end_time_check
  check (end_time > start_time and end_time <= time '22:00');
