-- Quick check + safe backfill for inventory_items.epc_data
-- Goal: make fitting demo webhook writable (requires valid 24-hex EPC)

-- 1) Current EPC health summary
select
  count(*) as total_rows,
  count(*) filter (where nullif(trim(coalesce(epc_data, '')), '') is null) as missing_epc,
  count(*) filter (where nullif(trim(coalesce(epc_data, '')), '') is not null) as non_empty_epc,
  count(*) filter (where nullif(trim(coalesce(epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$') as valid_24hex_epc,
  count(*) filter (
    where nullif(trim(coalesce(epc_data, '')), '') is not null
      and not (nullif(trim(coalesce(epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$')
  ) as invalid_format_epc
from public.inventory_items;

-- 2) Show invalid / missing samples
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

-- 3) Safe backfill from products JSON payload by product_id
--    Note: some environments do NOT have a physical products.epc_data column.
--    We therefore read via to_jsonb(p)->>'epc_data' to avoid 42703.
--    Only updates rows with missing EPC and only when target EPC is valid 24-hex.
--    Also avoids violating unique constraint on inventory_items.epc_data.
with candidate as (
  select
    i.id as inventory_id,
    upper(trim(coalesce(to_jsonb(p)->>'epc_data', ''))) as candidate_epc
  from public.inventory_items i
  join public.products p on p.id = i.product_id
  where nullif(trim(coalesce(i.epc_data, '')), '') is null
    and nullif(trim(coalesce(to_jsonb(p)->>'epc_data', '')), '') ~ '^[0-9A-Fa-f]{24}$'
), dedup as (
  select
    c.inventory_id,
    c.candidate_epc,
    row_number() over (partition by c.candidate_epc order by c.inventory_id) as rn
  from candidate c
)
update public.inventory_items i
set epc_data = d.candidate_epc,
    updated_at = now()
from dedup d
where i.id = d.inventory_id
  and d.rn = 1
  and not exists (
    select 1
    from public.inventory_items x
    where x.epc_data = d.candidate_epc
      and x.id <> i.id
  );

-- 4) Post-check: duplicates among non-empty EPC
select
  epc_data,
  count(*) as dup_count,
  array_agg(id order by id) as inventory_ids
from public.inventory_items
where nullif(trim(coalesce(epc_data, '')), '') is not null
group by epc_data
having count(*) > 1
order by dup_count desc, epc_data
limit 200;

-- 5) Post-check: webhook readiness (format perspective)
select
  count(*) as total_rows,
  count(*) filter (where nullif(trim(coalesce(epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$') as ready_rows,
  count(*) filter (
    where nullif(trim(coalesce(epc_data, '')), '') is null
       or not (nullif(trim(coalesce(epc_data, '')), '') ~ '^[0-9A-Fa-f]{24}$')
  ) as not_ready_rows
from public.inventory_items;
