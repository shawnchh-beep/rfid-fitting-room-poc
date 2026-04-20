-- EPC / product_id mapping diagnostics for fitting-demo EPC pool issue
-- Run all statements in order and paste all result sets back.

-- 1) inventory_items overall EPC health
select
  count(*) as inventory_total,
  count(*) filter (where product_id is not null) as inventory_with_product_id,
  count(*) filter (where nullif(trim(coalesce(epc_data, '')), '') is not null) as inventory_non_empty_epc,
  count(*) filter (where nullif(trim(coalesce(epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$') as inventory_valid_24hex_epc,
  count(*) filter (
    where nullif(trim(coalesce(epc_data, '')), '') is not null
      and not (nullif(trim(coalesce(epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$')
  ) as inventory_invalid_epc_format
from public.inventory_items;

-- 2) valid EPC rows grouped by product_id (coverage)
select
  i.product_id,
  count(*) as valid_epc_rows,
  count(distinct i.sku) as sku_count,
  min(i.sku) as sku_sample
from public.inventory_items i
where i.product_id is not null
  and nullif(trim(coalesce(i.epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$'
group by i.product_id
order by valid_epc_rows desc, i.product_id
limit 200;

-- 3) product_id present in products but has zero valid EPC in inventory_items
select
  p.id as product_id,
  coalesce(to_jsonb(p)->>'sku', '') as product_sku,
  coalesce(to_jsonb(p)->>'name_en', to_jsonb(p)->>'name', '') as product_name,
  count(i.id) filter (
    where nullif(trim(coalesce(i.epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$'
  ) as valid_epc_rows,
  count(i.id) as inventory_rows
from public.products p
left join public.inventory_items i
  on i.product_id = p.id
group by p.id, product_sku, product_name
having count(i.id) filter (
  where nullif(trim(coalesce(i.epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$'
) = 0
order by inventory_rows desc, p.id
limit 200;

-- 4) SKU mismatch check: same SKU exists, but product_id mapping may differ
select
  i.sku,
  count(*) as inventory_rows,
  count(*) filter (where nullif(trim(coalesce(i.epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$') as valid_epc_rows,
  count(distinct i.product_id) as distinct_product_ids,
  array_agg(distinct i.product_id) as product_ids
from public.inventory_items i
where nullif(trim(coalesce(i.sku, '')), '') is not null
group by i.sku
having count(distinct i.product_id) > 1
order by distinct_product_ids desc, valid_epc_rows desc
limit 200;

-- 5) sample rows currently unusable by front-end EPC validation
select
  i.id,
  i.product_id,
  i.sku,
  i.status,
  i.epc_data
from public.inventory_items i
where nullif(trim(coalesce(i.epc_data, '')), '') is null
   or not (nullif(trim(coalesce(i.epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$')
order by i.id
limit 200;

