-- 생활루틴의 대표 루틴을 0개 또는 1개만 지정할 수 있도록 설정합니다.
alter table public.routine_tabs
  add column if not exists is_featured boolean not null default false;

create unique index if not exists routine_tabs_one_featured_idx
  on public.routine_tabs (is_featured)
  where is_featured;

create or replace function public.set_featured_routine_tab(target_tab_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_tab_id is not null and not exists (
    select 1 from public.routine_tabs where id = target_tab_id
  ) then
    raise exception 'Routine tab not found';
  end if;

  update public.routine_tabs set is_featured = false where is_featured;

  if target_tab_id is not null then
    update public.routine_tabs set is_featured = true where id = target_tab_id;
  end if;
end;
$$;

revoke all on function public.set_featured_routine_tab(text) from public;
grant execute on function public.set_featured_routine_tab(text) to service_role;
