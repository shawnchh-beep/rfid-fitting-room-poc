-- Step5 修正：補齊 locale_code enum 與 system_locales
-- 用途：處理 system_locales / locale_code 不存在，並補上 seed 與驗證查詢
-- 執行環境：Supabase SQL Editor（可重複執行）

begin;

-- 1) 建立 locale_code enum（若已存在則補齊缺漏值）
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'locale_code'
  ) then
    create type public.locale_code as enum (
      'en',
      'zh-Hant',
      'zh-Hans'
    );
  else
    alter type public.locale_code add value if not exists 'en';
    alter type public.locale_code add value if not exists 'zh-Hant';
    alter type public.locale_code add value if not exists 'zh-Hans';
  end if;
end
$$;

-- 2) 建立 system_locales
create table if not exists public.system_locales (
  code public.locale_code primary key,
  label text not null,
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_locales_default_single_check
    check ((is_default in (true, false)))
);

-- 3) 補強約束／索引（可重複執行）
create unique index if not exists uq_system_locales_single_default
  on public.system_locales ((is_default))
  where is_default = true;

create index if not exists idx_system_locales_is_enabled
  on public.system_locales (is_enabled);

-- 4) seed（若已存在則更新）
insert into public.system_locales (code, label, is_enabled, is_default)
values
  ('en', 'English', true, true),
  ('zh-Hant', '繁體中文', true, false),
  ('zh-Hans', '简体中文', true, false)
on conflict (code) do update
set
  label = excluded.label,
  is_enabled = excluded.is_enabled,
  is_default = excluded.is_default,
  updated_at = now();

-- 5) 將預設語系統一為 en（避免舊資料有多筆 default）
update public.system_locales
set
  is_default = (code = 'en'::public.locale_code),
  updated_at = now()
where is_default is distinct from (code = 'en'::public.locale_code);

-- 6) 若專案已有 set_updated_at()，則補上 updated_at trigger
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
      where tgname = 'trg_system_locales_updated_at'
    ) then
      execute 'create trigger trg_system_locales_updated_at
               before update on public.system_locales
               for each row execute function public.set_updated_at()';
    end if;
  end if;
end
$$;

commit;

-- 7) 驗證：確認 enum 已存在且含三個值
select
  n.nspname as schema_name,
  t.typname as enum_name,
  e.enumsortorder,
  e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname = 'locale_code'
order by e.enumsortorder;

-- 8) 驗證：確認 system_locales 結構與資料
select
  code,
  label,
  is_enabled,
  is_default,
  created_at,
  updated_at
from public.system_locales
order by code;

-- 9) 驗證：應只會有一筆 default 且為 en
select
  count(*) filter (where is_default) as default_count,
  max(code) filter (where is_default) as default_code
from public.system_locales;
