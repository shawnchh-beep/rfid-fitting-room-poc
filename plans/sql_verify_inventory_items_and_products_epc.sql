-- Verify data availability for Product page source (schema-agnostic)
-- Supabase SQL Editor (read-only)

-- 0) products 欄位快照（先看目前 schema）
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
order by ordinal_position;

-- 1) products: 總筆數 + 兩種 EPC 來源可用率
-- - 舊欄位口徑：epc_data
-- - 現行口徑：epc_company_prefix + item_reference
select
  count(*) as products_total,
  count(*) filter (
    where nullif(trim(coalesce(to_jsonb(p)->>'epc_data', '')), '') is not null
  ) as products_with_epc_data,
  count(*) filter (
    where nullif(trim(coalesce(to_jsonb(p)->>'epc_company_prefix', '')), '') is not null
      and nullif(trim(coalesce(to_jsonb(p)->>'item_reference', '')), '') is not null
  ) as products_with_prefix_item,
  count(*) filter (
    where nullif(trim(coalesce(to_jsonb(p)->>'epc_data', '')), '') is null
      and (
        nullif(trim(coalesce(to_jsonb(p)->>'epc_company_prefix', '')), '') is null
        or nullif(trim(coalesce(to_jsonb(p)->>'item_reference', '')), '') is null
      )
  ) as products_without_epc_identity
from public.products p;

-- 2) inventory_items: total rows and epc_data availability
select
  count(*) as inventory_total,
  count(*) filter (
    where nullif(trim(coalesce(to_jsonb(i)->>'epc_data', '')), '') is not null
  ) as inventory_with_epc,
  count(*) filter (
    where nullif(trim(coalesce(to_jsonb(i)->>'epc_data', '')), '') is null
  ) as inventory_without_epc
from public.inventory_items i;

-- 3) inventory_items linked to products
select
  count(*) as inventory_total,
  count(*) filter (where p.id is not null) as inventory_linked_products,
  count(*) filter (where p.id is null) as inventory_orphan_rows
from public.inventory_items i
left join public.products p on p.id = i.product_id;

-- 4) quick sample: products missing both EPC identity forms
select
  p.id,
  coalesce(to_jsonb(p)->>'sku', '') as sku,
  coalesce(to_jsonb(p)->>'name', '') as name,
  to_jsonb(p)->>'epc_data' as epc_data,
  to_jsonb(p)->>'epc_company_prefix' as epc_company_prefix,
  to_jsonb(p)->>'item_reference' as item_reference
from public.products p
where nullif(trim(coalesce(to_jsonb(p)->>'epc_data', '')), '') is null
  and (
    nullif(trim(coalesce(to_jsonb(p)->>'epc_company_prefix', '')), '') is null
    or nullif(trim(coalesce(to_jsonb(p)->>'item_reference', '')), '') is null
  )
order by p.id desc
limit 20;

-- 5) quick sample: inventory_items EPC and sku
select
  i.id,
  i.product_id,
  i.sku,
  i.epc_data,
  i.status,
  coalesce(to_jsonb(p)->>'name', '') as product_name,
  coalesce(to_jsonb(p)->>'sku', '') as product_sku,
  to_jsonb(p)->>'epc_company_prefix' as epc_company_prefix,
  to_jsonb(p)->>'item_reference' as item_reference
from public.inventory_items i
left join public.products p on p.id = i.product_id
order by i.id desc
limit 20;
