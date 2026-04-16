-- Fix: allow dashboard/product page to read inventory_items when RLS is enabled
-- Safe to run multiple times

do $$
declare
  v_rls_enabled boolean := false;
begin
  select c.relrowsecurity
    into v_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'inventory_items'
  limit 1;

  if coalesce(v_rls_enabled, false) then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'inventory_items'
        and policyname = 'inventory_items_select_authenticated'
    ) then
      execute $sql$
        create policy inventory_items_select_authenticated
        on public.inventory_items
        for select
        to authenticated
        using (true)
      $sql$;
    end if;
  end if;
end $$;

-- verification
select
  c.relrowsecurity as rls_enabled,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'inventory_items'
      and p.policyname = 'inventory_items_select_authenticated'
  ) as has_select_policy
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'inventory_items';

