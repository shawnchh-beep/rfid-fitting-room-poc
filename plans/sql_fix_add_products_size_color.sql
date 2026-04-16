-- Minimal patch: add missing size/color columns on products
-- Safe to re-run due to IF NOT EXISTS.

alter table public.products
  add column if not exists size text,
  add column if not exists color text;

-- Optional quick check:
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'products'
--   and column_name in ('size', 'color')
-- order by column_name;

