-- RFID Demo Products (50 rows) 匯入腳本
-- 需求：
-- 1) staging table
-- 2) 從 CSV 匯入（psql \copy）
-- 3) 匯入 product_styles / skus
-- 4) 若存在 items 表則 upsert items
-- 5) 驗證查詢
--
-- 建議執行方式（在終端機）：
--   psql "${DATABASE_URL}" -f plans/sql_import_rfid_demo_products_50_ean13_sgtin96.sql
--
-- Supabase Storage（bucket: test_data）匯入模板：
--
-- [A] public bucket（可匿名讀取）
-- 1) 先下載 CSV（可直接替換以下模板變數）
--    export SUPABASE_PROJECT_REF="<project-ref>"
--    export STORAGE_OBJECT_PATH="rfid_demo_products_50_ean13_sgtin96.csv"
--    curl -L \
--      "https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/test_data/${STORAGE_OBJECT_PATH}" \
--      -o /tmp/rfid_demo_products_50_ean13_sgtin96.csv
--
-- 2) 用 psql 執行本檔（可直接替換）
--    psql "${DATABASE_URL}" \
--      -v csv_path="/tmp/rfid_demo_products_50_ean13_sgtin96.csv" \
--      -f plans/sql_import_rfid_demo_products_50_ean13_sgtin96.sql
--
-- [B] private bucket（需授權）
-- 1) 先下載 CSV（可直接替換以下模板變數）
--    export SUPABASE_PROJECT_REF="<project-ref>"
--    export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
--    export STORAGE_OBJECT_PATH="rfid_demo_products_50_ean13_sgtin96.csv"
--    curl -L \
--      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
--      "https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/authenticated/test_data/${STORAGE_OBJECT_PATH}" \
--      -o /tmp/rfid_demo_products_50_ean13_sgtin96.csv
--
-- 2) 用 psql 執行本檔（可直接替換）
--    psql "${DATABASE_URL}" \
--      -v csv_path="/tmp/rfid_demo_products_50_ean13_sgtin96.csv" \
--      -f plans/sql_import_rfid_demo_products_50_ean13_sgtin96.sql
--
-- 備註：若未帶入 -v csv_path，則使用下方預設路徑。

\if :{?csv_path}
\else
\set csv_path '/Users/shawn/Documents/Developer/RFID fitting room/rfid_demo_products_50_ean13_sgtin96.csv'
\endif

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) staging table
-- ------------------------------------------------------------
create table if not exists public.stg_rfid_demo_products_50 (
  product_id text,
  sku_ean13 text,
  epc_sgtin96 text,
  company_prefix text,
  item_reference text,
  serial text,
  product_name text,
  brand text,
  category text,
  color text,
  size text,
  gender text,
  season text,
  price_usd text,
  currency text,
  status text,
  imported_at timestamptz not null default now()
);

truncate table public.stg_rfid_demo_products_50;

commit;

-- ------------------------------------------------------------
-- 2) 從 CSV 匯入（psql \copy）
-- ------------------------------------------------------------
\copy public.stg_rfid_demo_products_50 (
  product_id,
  sku_ean13,
  epc_sgtin96,
  company_prefix,
  item_reference,
  serial,
  product_name,
  brand,
  category,
  color,
  size,
  gender,
  season,
  price_usd,
  currency,
  status
) from :'csv_path'
with (
  format csv,
  header true,
  encoding 'UTF8'
);

begin;

-- ------------------------------------------------------------
-- 3) 匯入 product_styles / skus
-- ------------------------------------------------------------
-- style_code 設計：STYLE-xxxxx（用 product_id 產生，確保唯一）
with src as (
  select
    trim(product_id) as product_id,
    trim(sku_ean13) as sku_ean13,
    upper(trim(epc_sgtin96)) as epc_sgtin96,
    trim(company_prefix) as company_prefix,
    trim(item_reference) as item_reference,
    trim(serial) as serial,
    trim(product_name) as product_name,
    trim(brand) as brand,
    trim(category) as category,
    trim(color) as color,
    trim(size) as size,
    trim(gender) as gender,
    trim(season) as season,
    nullif(trim(price_usd), '')::numeric(12,2) as price_usd,
    coalesce(nullif(trim(currency), ''), 'USD') as currency,
    coalesce(nullif(trim(status), ''), 'active') as status,
    ('STYLE-' || lpad(trim(product_id), 5, '0')) as style_code
  from public.stg_rfid_demo_products_50
), upsert_styles as (
  insert into public.product_styles (
    brand,
    category,
    product_name,
    style_code,
    season,
    gender,
    base_price,
    currency,
    is_active
  )
  select distinct
    s.brand,
    s.category,
    s.product_name,
    s.style_code,
    s.season,
    s.gender,
    s.price_usd,
    s.currency,
    (lower(s.status) = 'active')
  from src s
  on conflict (style_code) do update
    set brand = excluded.brand,
        category = excluded.category,
        product_name = excluded.product_name,
        season = excluded.season,
        gender = excluded.gender,
        base_price = excluded.base_price,
        currency = excluded.currency,
        is_active = excluded.is_active,
        updated_at = now()
  returning id, style_code
)
insert into public.skus (
  style_id,
  sku_code,
  color,
  size,
  product_name,
  price,
  currency,
  is_active
)
select
  ps.id as style_id,
  s.sku_ean13 as sku_code,
  s.color,
  s.size,
  s.product_name,
  s.price_usd as price,
  s.currency,
  (lower(s.status) = 'active')
from src s
join public.product_styles ps
  on ps.style_code = s.style_code
where s.sku_ean13 is not null
  and s.sku_ean13 <> ''
on conflict (sku_code) do update
  set style_id = excluded.style_id,
      color = excluded.color,
      size = excluded.size,
      product_name = excluded.product_name,
      price = excluded.price,
      currency = excluded.currency,
      is_active = excluded.is_active,
      updated_at = now();

-- ------------------------------------------------------------
-- 4) 若存在 items 表則 upsert items
-- ------------------------------------------------------------
do $$
declare
  v_items_exists boolean;
  v_has_serial_no boolean;
  v_has_serial boolean;
  v_has_current_store_id boolean;
  v_store_id uuid;
begin
  select to_regclass('public.items') is not null into v_items_exists;

  if not v_items_exists then
    raise notice 'items table 不存在，略過 items upsert。';
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'items'
      and column_name = 'serial_no'
  ) into v_has_serial_no;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'items'
      and column_name = 'serial'
  ) into v_has_serial;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'items'
      and column_name = 'current_store_id'
  ) into v_has_current_store_id;

  if v_has_current_store_id then
    if to_regclass('public.stores') is null then
      raise notice 'items.current_store_id 存在但 stores 表不存在，略過 items upsert。';
      return;
    end if;

    select id into v_store_id
    from public.stores
    order by created_at nulls last, id
    limit 1;

    if v_store_id is null then
      raise notice 'stores 無資料，無法填入 items.current_store_id，略過 items upsert。';
      return;
    end if;
  end if;

  if v_has_serial_no and v_has_current_store_id then
    insert into public.items (epc, sku_id, style_id, serial_no, current_store_id, is_active)
    select
      upper(trim(st.epc_sgtin96)) as epc,
      sk.id as sku_id,
      ps.id as style_id,
      trim(st.serial) as serial_no,
      v_store_id as current_store_id,
      (lower(trim(st.status)) = 'active') as is_active
    from public.stg_rfid_demo_products_50 st
    join public.skus sk
      on sk.sku_code = trim(st.sku_ean13)
    join public.product_styles ps
      on ps.id = sk.style_id
    where trim(st.epc_sgtin96) <> ''
    on conflict (epc) do update
      set sku_id = excluded.sku_id,
          style_id = excluded.style_id,
          serial_no = excluded.serial_no,
          current_store_id = excluded.current_store_id,
          is_active = excluded.is_active,
          updated_at = now();

  elsif v_has_serial and v_has_current_store_id then
    insert into public.items (epc, sku_id, style_id, serial, current_store_id, is_active)
    select
      upper(trim(st.epc_sgtin96)) as epc,
      sk.id as sku_id,
      ps.id as style_id,
      trim(st.serial) as serial,
      v_store_id as current_store_id,
      (lower(trim(st.status)) = 'active') as is_active
    from public.stg_rfid_demo_products_50 st
    join public.skus sk
      on sk.sku_code = trim(st.sku_ean13)
    join public.product_styles ps
      on ps.id = sk.style_id
    where trim(st.epc_sgtin96) <> ''
    on conflict (epc) do update
      set sku_id = excluded.sku_id,
          style_id = excluded.style_id,
          serial = excluded.serial,
          current_store_id = excluded.current_store_id,
          is_active = excluded.is_active,
          updated_at = now();

  elsif v_has_serial_no and not v_has_current_store_id then
    insert into public.items (epc, sku_id, style_id, serial_no, is_active)
    select
      upper(trim(st.epc_sgtin96)) as epc,
      sk.id as sku_id,
      ps.id as style_id,
      trim(st.serial) as serial_no,
      (lower(trim(st.status)) = 'active') as is_active
    from public.stg_rfid_demo_products_50 st
    join public.skus sk
      on sk.sku_code = trim(st.sku_ean13)
    join public.product_styles ps
      on ps.id = sk.style_id
    where trim(st.epc_sgtin96) <> ''
    on conflict (epc) do update
      set sku_id = excluded.sku_id,
          style_id = excluded.style_id,
          serial_no = excluded.serial_no,
          is_active = excluded.is_active,
          updated_at = now();

  elsif v_has_serial and not v_has_current_store_id then
    insert into public.items (epc, sku_id, style_id, serial, is_active)
    select
      upper(trim(st.epc_sgtin96)) as epc,
      sk.id as sku_id,
      ps.id as style_id,
      trim(st.serial) as serial,
      (lower(trim(st.status)) = 'active') as is_active
    from public.stg_rfid_demo_products_50 st
    join public.skus sk
      on sk.sku_code = trim(st.sku_ean13)
    join public.product_styles ps
      on ps.id = sk.style_id
    where trim(st.epc_sgtin96) <> ''
    on conflict (epc) do update
      set sku_id = excluded.sku_id,
          style_id = excluded.style_id,
          serial = excluded.serial,
          is_active = excluded.is_active,
          updated_at = now();

  else
    insert into public.items (epc, sku_id, style_id, is_active)
    select
      upper(trim(st.epc_sgtin96)) as epc,
      sk.id as sku_id,
      ps.id as style_id,
      (lower(trim(st.status)) = 'active') as is_active
    from public.stg_rfid_demo_products_50 st
    join public.skus sk
      on sk.sku_code = trim(st.sku_ean13)
    join public.product_styles ps
      on ps.id = sk.style_id
    where trim(st.epc_sgtin96) <> ''
    on conflict (epc) do update
      set sku_id = excluded.sku_id,
          style_id = excluded.style_id,
          is_active = excluded.is_active,
          updated_at = now();
  end if;

  raise notice 'items upsert 完成。';
exception
  when undefined_column then
    raise notice 'items 欄位結構與預期不一致，已略過 items upsert。';
  when undefined_table then
    raise notice 'items 或其依賴表不存在，已略過 items upsert。';
end
$$;

commit;

-- ------------------------------------------------------------
-- 5) 驗證查詢
-- ------------------------------------------------------------

-- A. staging 匯入筆數
select
  'staging_rows' as check_name,
  count(*) as row_count
from public.stg_rfid_demo_products_50;

-- B. product_styles / skus 筆數（由本批資料可對應到的唯一鍵）
with expected as (
  select
    count(distinct ('STYLE-' || lpad(trim(product_id), 5, '0'))) as expected_styles,
    count(distinct trim(sku_ean13)) as expected_skus
  from public.stg_rfid_demo_products_50
), actual as (
  select
    (select count(*) from public.product_styles ps
      where ps.style_code in (
        select distinct ('STYLE-' || lpad(trim(product_id), 5, '0'))
        from public.stg_rfid_demo_products_50
      )) as actual_styles,
    (select count(*) from public.skus sk
      where sk.sku_code in (
        select distinct trim(sku_ean13)
        from public.stg_rfid_demo_products_50
      )) as actual_skus
)
select
  e.expected_styles,
  a.actual_styles,
  e.expected_skus,
  a.actual_skus
from expected e
cross join actual a;

-- C. items 是否已匯入（若 items 表存在）
do $$
declare
  v_items_exists boolean;
  v_cnt bigint;
begin
  select to_regclass('public.items') is not null into v_items_exists;
  if v_items_exists then
    select count(*) into v_cnt
    from public.items i
    where i.epc in (
      select upper(trim(epc_sgtin96))
      from public.stg_rfid_demo_products_50
      where trim(epc_sgtin96) <> ''
    );
    raise notice 'items matched by EPC: %', v_cnt;
  else
    raise notice 'items table 不存在，略過 items 驗證。';
  end if;
end
$$;

-- D. 抽樣檢查（前 10 筆）
select
  st.product_id,
  st.sku_ean13,
  st.epc_sgtin96,
  ps.style_code,
  sk.id as sku_id,
  ps.id as style_id
from public.stg_rfid_demo_products_50 st
left join public.skus sk
  on sk.sku_code = trim(st.sku_ean13)
left join public.product_styles ps
  on ps.id = sk.style_id
order by st.product_id::int
limit 10;
