-- Add an optional working weight to health routine exercises.
alter table public.health_routine_exercises
  add column if not exists weight_kg numeric(5, 2)
  check (weight_kg is null or (weight_kg > 0 and weight_kg <= 999.99));
