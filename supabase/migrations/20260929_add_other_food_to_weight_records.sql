-- Add free-text food notes to daily weight records.
alter table public.weight_records
  add column if not exists other_food text;
