-- SKU 單一口徑遷移：固定使用 products.sku
-- 執行環境：Supabase SQL Editor
-- 注意：此檔包含「遷移」與「刪欄」兩段，請先跑 A，再確認，再跑 B。

-- ========================================
-- A) 資料遷移（不刪欄）
-- ========================================
begin;

-- A0. 確保必要欄位存在（避免 42703）
alter table public.products add column if not exists sku text;
alter table public.inventory_items add column if not exists sku text;

-- A1. 若 product_sku 存在，回填到 products.sku（僅填補空值）
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
      update public.products
      set sku = nullif(trim(product_sku), '')
      where nullif(trim(coalesce(sku, '')), '') is null
        and nullif(trim(coalesce(product_sku, '')), '') is not null
    $sql$;
  end if;
end $$;

-- A2. 將 products.sku 回填到 inventory_items.sku（僅填補空值）
update public.inventory_items i
set sku = nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '')
from public.products p
where i.product_id = p.id
  and nullif(trim(coalesce(i.sku, '')), '') is null
  and nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is not null;

commit;

-- A3. 遷移結果檢查
select
  count(*) as products_total,
  count(*) filter (where nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is not null) as products_with_sku,
  count(*) filter (where nullif(trim(coalesce(to_jsonb(p)->>'sku', '')), '') is null) as products_without_sku
from public.products p;

select
  count(*) as inventory_total,
  count(*) filter (where nullif(trim(coalesce(sku, '')), '') is not null) as inventory_with_sku,
  count(*) filter (where nullif(trim(coalesce(sku, '')), '') is null) as inventory_without_sku
from public.inventory_items;

-- ========================================
-- B) 刪除 product_sku（確認 A 完成後再執行）
-- ========================================
-- 安全檢查：若仍有僅存在 product_sku 的資料，直接中止。
do $$
declare
  v_remaining integer;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'product_sku'
  ) then
    select count(*)
      into v_remaining
    from public.products
    where nullif(trim(coalesce(to_jsonb(public.products)->>'sku', '')), '') is null
      and nullif(trim(coalesce(to_jsonb(public.products)->>'product_sku', '')), '') is not null;

    if v_remaining > 0 then
      raise exception 'Abort drop: % rows still depend on product_sku', v_remaining;
    end if;
  end if;
end $$;

alter table public.products drop column if exists product_sku;

-- B2. 刪欄後確認
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name in ('sku', 'product_sku')
order by column_name;
