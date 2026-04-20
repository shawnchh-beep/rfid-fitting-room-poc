-- One-shot diagnostic: inventory_items RLS + policies + grants
-- Run in Supabase SQL Editor (read-only; no data mutation)

-- 0) Environment identity
select
  current_database() as db_name,
  current_user as sql_user,
  current_schema as schema_name,
  now() as executed_at;

-- 1) Table existence + RLS flags
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  c.relkind as relkind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'inventory_items';

-- 2) Policies on inventory_items
select
  p.schemaname,
  p.tablename,
  p.policyname,
  p.cmd,
  p.roles,
  p.permissive,
  p.qual,
  p.with_check
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'inventory_items'
order by p.policyname;

-- 3) Table-level grants by common Supabase roles
select
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'inventory_items'
  and grantee in ('anon', 'authenticated', 'service_role', 'postgres')
order by grantee, privilege_type;

-- 4) Effective SELECT privilege quick check
select
  has_table_privilege('anon', 'public.inventory_items', 'select') as anon_can_select,
  has_table_privilege('authenticated', 'public.inventory_items', 'select') as authenticated_can_select,
  has_table_privilege('service_role', 'public.inventory_items', 'select') as service_role_can_select,
  has_table_privilege('postgres', 'public.inventory_items', 'select') as postgres_can_select;

-- 5) Data existence sanity
select
  count(*) as inventory_total,
  count(*) filter (where nullif(trim(coalesce(epc_data, '')), '') is not null) as inventory_with_epc,
  count(*) filter (where product_id is not null) as inventory_with_product_id
from public.inventory_items;

-- 6) Top samples (for spot-check)
select
  i.id,
  i.product_id,
  i.sku,
  i.style_no,
  i.item_no,
  i.status,
  i.epc_data
from public.inventory_items i
order by i.id desc
limit 20;

