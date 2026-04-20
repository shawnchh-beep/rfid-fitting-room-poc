-- Step4 修正：補齊缺少的父表 product_styles / skus
-- 用途：當後續建立 items 等子表時，因父表不存在而報錯
-- 執行環境：Supabase SQL Editor（可重複執行）

begin;

-- 1) UUID 產生函式（Supabase 通常已啟用；保險起見）
create extension if not exists pgcrypto;

-- 2) 建立 product_styles（父表）
create table if not exists public.product_styles (
  id uuid primary key default gen_random_uuid(),
  brand text,
  category text,
  product_name text not null,
  style_code text not null unique,
  season text,
  gender text,
  launch_date date,
  image_url text,
  base_price numeric(12,2),
  currency text default 'TWD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) 建立 skus（父表；其本身依賴 product_styles）
create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.product_styles(id) on delete cascade,
  sku_code text not null unique,
  color text,
  size text,
  product_name text not null,
  price numeric(12,2),
  currency text default 'TWD',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) 補強索引（若已存在則略過）
create index if not exists idx_product_styles_style_code
  on public.product_styles(style_code);

create index if not exists idx_product_styles_is_active
  on public.product_styles(is_active);

create index if not exists idx_skus_style_id
  on public.skus(style_id);

create index if not exists idx_skus_sku_code
  on public.skus(sku_code);

create index if not exists idx_skus_is_active
  on public.skus(is_active);

-- 5) 若專案已有 set_updated_at()，則補上 updated_at trigger
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  ) then
    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_product_styles_updated_at'
    ) then
      execute 'create trigger trg_product_styles_updated_at
               before update on public.product_styles
               for each row execute function public.set_updated_at()';
    end if;

    if not exists (
      select 1 from pg_trigger
      where tgname = 'trg_skus_updated_at'
    ) then
      execute 'create trigger trg_skus_updated_at
               before update on public.skus
               for each row execute function public.set_updated_at()';
    end if;
  end if;
end
$$;

commit;

-- 6) 驗證：確認兩張父表已存在
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('product_styles', 'skus')
order by table_name;

-- 7) 驗證：確認 skus.style_id 已正確指向 product_styles.id
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name = 'skus'
  and kcu.column_name = 'style_id';

