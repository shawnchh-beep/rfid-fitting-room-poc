-- Minimal RLS fix for public.inventory_items (read-only for dashboard/demo)
-- 목적: allow frontend anon/authenticated to SELECT inventory rows,
-- while keeping write operations restricted.

begin;

-- 1) Ensure RLS is enabled (idempotent)
alter table if exists public.inventory_items enable row level security;

-- 2) Ensure table-level SELECT grants exist
grant select on table public.inventory_items to anon;
grant select on table public.inventory_items to authenticated;

-- 3) Minimal SELECT policies for frontend roles
drop policy if exists inventory_items_select_anon on public.inventory_items;
create policy inventory_items_select_anon
  on public.inventory_items
  for select
  to anon
  using (true);

drop policy if exists inventory_items_select_authenticated on public.inventory_items;
create policy inventory_items_select_authenticated
  on public.inventory_items
  for select
  to authenticated
  using (true);

-- 4) Optional hardening: keep write policy strict (admin only)
-- If you already have stricter write policies, these won't loosen them.
drop policy if exists inventory_items_write_admin on public.inventory_items;
create policy inventory_items_write_admin
  on public.inventory_items
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

commit;

-- Verification
select
  has_table_privilege('anon', 'public.inventory_items', 'select') as anon_can_select,
  has_table_privilege('authenticated', 'public.inventory_items', 'select') as authenticated_can_select;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'inventory_items'
order by policyname;

