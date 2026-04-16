-- Backfill SKU consistency for product page summary
-- Goal:
--   1) fill public.products.sku from legacy/related sources
--   2) fill public.inventory_items.sku from public.products.sku
-- Safe to run multiple times (idempotent by "only fill blank" strategy)

begin;

-- 0) Ensure canonical columns exist
alter table public.products add column if not exists sku text;
alter table public.inventory_items add column if not exists sku text;

-- 1) Fill products.sku from legacy products.product_sku (only if products.sku is blank)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'product_sku'
  ) then
    execute $sql$
      update public.products p
      set sku = nullif(trim(coalesce(to_jsonb(p)->>'product_sku', '')), '')
      where nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is null
        and nullif(trim(coalesce(to_jsonb(p)->>'product_sku', '')), '') is not null
    $sql$;
  end if;
end $$;

-- 2) Fill products.sku from inventory_items.sku by product_id (only if products.sku is blank)
--    choose one stable candidate by max(i.id)
with latest_item_sku as (
  select distinct on (i.product_id)
    i.product_id,
    nullif(trim(coalesce(i.sku, '')), '') as item_sku
  from public.inventory_items i
  where i.product_id is not null
    and nullif(trim(coalesce(i.sku, '')), '') is not null
  order by i.product_id, i.id desc
)
update public.products p
set sku = lis.item_sku
from latest_item_sku lis
where p.id = lis.product_id
  and nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is null
  and lis.item_sku is not null;

-- 3) Fill inventory_items.sku from products.sku (only if inventory_items.sku is blank)
update public.inventory_items i
set sku = nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '')
from public.products p
where i.product_id = p.id
  and nullif(trim(coalesce(i.sku, '')), '') is null
  and nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is not null;

commit;

-- 4) Verification snapshot
select
  count(*) as products_total,
  count(*) filter (where nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is not null) as products_with_sku,
  count(*) filter (where nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is null) as products_without_sku
from public.products p;

select
  count(*) as inventory_total,
  count(*) filter (where nullif(trim(coalesce(i.sku, '')), '') is not null) as inventory_with_sku,
  count(*) filter (where nullif(trim(coalesce(i.sku, '')), '') is null) as inventory_without_sku
from public.inventory_items i;

-- 5) Unknown-SKU risk sample for product page (top 20)
select
  i.id as inventory_id,
  i.product_id,
  i.sku as item_sku,
  coalesce(to_jsonb(p)->>'sku', null) as product_sku,
  i.epc_data,
  i.status
from public.inventory_items i
left join public.products p on p.id = i.product_id
where nullif(trim(coalesce(i.sku, '')), '') is null
  and nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is null
order by i.id desc
limit 20;

