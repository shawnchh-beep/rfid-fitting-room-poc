-- Step8：RLS baseline（user / role / i18n）
-- 用途：在不確定資料表是否已建立的情況下，安全地啟用 RLS 與建立基礎 policy
-- 執行環境：Supabase SQL Editor（可重複執行）

begin;

-- 1) 啟用 RLS（若表存在才處理）
alter table if exists public.user_profiles enable row level security;
alter table if exists public.user_role_bindings enable row level security;
alter table if exists public.product_style_i18n enable row level security;
alter table if exists public.sku_i18n enable row level security;

-- 2) 建立基礎 policy（以存在檢查確保可重複執行）
do $$
begin
  -- 2.1 user_profiles：使用者只能讀取自己的 profile
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_profiles'
      and c.relkind = 'r'
  ) then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'user_profiles'
        and policyname = 'user_profiles_select_self'
    ) then
      execute $sql$
        create policy user_profiles_select_self
        on public.user_profiles
        for select
        to authenticated
        using (id = auth.uid())
      $sql$;
    end if;
  end if;

  -- 2.2 user_role_bindings：admin 可管理（CRUD）
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_role_bindings'
      and c.relkind = 'r'
  ) then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'user_role_bindings'
        and policyname = 'user_role_bindings_admin_manage'
    ) then
      execute $sql$
        create policy user_role_bindings_admin_manage
        on public.user_role_bindings
        for all
        to authenticated
        using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
        with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      $sql$;
    end if;
  end if;

  -- 2.3 i18n：authenticated 可讀 product_style_i18n
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'product_style_i18n'
      and c.relkind = 'r'
  ) then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'product_style_i18n'
        and policyname = 'product_style_i18n_select_authenticated'
    ) then
      execute $sql$
        create policy product_style_i18n_select_authenticated
        on public.product_style_i18n
        for select
        to authenticated
        using (true)
      $sql$;
    end if;
  end if;

  -- 2.4 i18n：authenticated 可讀 sku_i18n
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'sku_i18n'
      and c.relkind = 'r'
  ) then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'sku_i18n'
        and policyname = 'sku_i18n_select_authenticated'
    ) then
      execute $sql$
        create policy sku_i18n_select_authenticated
        on public.sku_i18n
        for select
        to authenticated
        using (true)
      $sql$;
    end if;
  end if;
end
$$;

commit;

-- 3) 驗證查詢

-- 3.1 檢查 RLS 啟用狀態（relrowsecurity）
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'user_profiles',
    'user_role_bindings',
    'product_style_i18n',
    'sku_i18n'
  )
order by c.relname;

-- 3.2 檢查 policy 清單
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'user_profiles',
    'user_role_bindings',
    'product_style_i18n',
    'sku_i18n'
  )
order by tablename, policyname;
