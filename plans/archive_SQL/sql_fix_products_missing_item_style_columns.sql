-- Fix for errors:
--   - relation "public.products" does not exist
--   - column products.item_no does not exist
-- Safe to run multiple times; will NOT error when tables are missing.

begin;

do $$
declare
  has_products boolean := to_regclass('public.products') is not null;
  has_inventory_items boolean := to_regclass('public.inventory_items') is not null;
  products_has_sku boolean := false;
  inventory_has_sku boolean := false;
  inventory_has_product_id boolean := false;
begin
  if has_products then
    execute 'alter table public.products add column if not exists style_no text';
    execute 'alter table public.products add column if not exists item_no text';
    execute 'create index if not exists products_style_no_idx on public.products(style_no)';
    execute 'create index if not exists products_item_no_idx on public.products(item_no)';

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'sku'
    ) into products_has_sku;

    if products_has_sku then
      execute $sql$
        update public.products p
        set style_no = coalesce(nullif(trim(p.style_no), ''), nullif(trim(p.sku), ''))
        where nullif(trim(p.style_no), '') is null
      $sql$;

      execute $sql$
        update public.products p
        set item_no = coalesce(nullif(trim(p.item_no), ''), nullif(trim(p.sku), ''))
        where nullif(trim(p.item_no), '') is null
      $sql$;
    end if;
  end if;

  if has_inventory_items then
    execute 'alter table public.inventory_items add column if not exists style_no text';
    execute 'alter table public.inventory_items add column if not exists item_no text';
    execute 'create index if not exists inventory_items_style_no_idx on public.inventory_items(style_no)';
    execute 'create index if not exists inventory_items_item_no_idx on public.inventory_items(item_no)';

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'inventory_items' and column_name = 'sku'
    ) into inventory_has_sku;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'inventory_items' and column_name = 'product_id'
    ) into inventory_has_product_id;

    if inventory_has_sku then
      execute $sql$
        update public.inventory_items i
        set item_no = coalesce(nullif(trim(i.item_no), ''), nullif(trim(i.sku), ''))
        where nullif(trim(i.item_no), '') is null
      $sql$;
    end if;

    if has_products and inventory_has_product_id then
      if inventory_has_sku and products_has_sku then
        execute $sql$
          update public.inventory_items i
          set style_no = coalesce(
            nullif(trim(i.style_no), ''),
            nullif(trim(p.style_no), ''),
            nullif(trim(i.sku), ''),
            nullif(trim(p.sku), '')
          )
          from public.products p
          where i.product_id = p.id
            and nullif(trim(i.style_no), '') is null
        $sql$;

        execute $sql$
          update public.inventory_items i
          set item_no = coalesce(
            nullif(trim(i.item_no), ''),
            nullif(trim(i.sku), ''),
            nullif(trim(p.item_no), ''),
            nullif(trim(p.sku), '')
          )
          from public.products p
          where i.product_id = p.id
            and nullif(trim(i.item_no), '') is null
        $sql$;
      else
        execute $sql$
          update public.inventory_items i
          set style_no = coalesce(
            nullif(trim(i.style_no), ''),
            nullif(trim(p.style_no), '')
          )
          from public.products p
          where i.product_id = p.id
            and nullif(trim(i.style_no), '') is null
        $sql$;

        execute $sql$
          update public.inventory_items i
          set item_no = coalesce(
            nullif(trim(i.item_no), ''),
            nullif(trim(p.item_no), '')
          )
          from public.products p
          where i.product_id = p.id
            and nullif(trim(i.item_no), '') is null
        $sql$;
      end if;
    end if;
  end if;
end $$;

commit;

-- Verification (returns 0 rows if tables do not exist; no error)
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('products', 'inventory_items')
  and column_name in ('style_no', 'item_no')
order by table_name, column_name;
