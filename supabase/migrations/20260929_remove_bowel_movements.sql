-- Remove bowel movement tracking from daily weight records.
alter table public.weight_records
  add column if not exists other_food text;

alter table public.weight_records
  drop column if exists bowel_movements;
