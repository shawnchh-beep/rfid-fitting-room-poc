-- Step9：DB 3.0 遷移後 smoke test（唯讀）
-- 用途：驗證關鍵表、enum、RLS/policy、migration 記錄是否就緒
-- 執行環境：Supabase SQL Editor（不寫入資料）

-- 1) 檢查關鍵表存在
with expected_tables(table_name) as (
  values
    ('stores'),
    ('product_styles'),
    ('skus'),
    ('system_locales'),
    ('user_profiles'),
    ('user_role_bindings'),
    ('product_style_i18n'),
    ('sku_i18n'),
    ('schema_migrations')
)
select
  et.table_name,
  to_regclass(format('public.%I', et.table_name)) is not null as exists_in_public
from expected_tables et
order by et.table_name;

-- 2) 檢查 enum 值：locale_code
with expected(enum_value) as (
  values ('en'), ('zh-Hant'), ('zh-Hans')
),
actual(enum_value) as (
  select e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'locale_code'
)
select
  'locale_code' as enum_name,
  (select count(*) from expected) as expected_count,
  (select count(*) from actual) as actual_count,
  coalesce((
    select string_agg(enum_value, ', ' order by enum_value)
    from (
      select enum_value from expected
      except
      select enum_value from actual
    ) m
  ), '') as missing_values,
  coalesce((
    select string_agg(enum_value, ', ' order by enum_value)
    from (
      select enum_value from actual
      except
      select enum_value from expected
    ) x
  ), '') as extra_values;

-- 2) 檢查 enum 值：app_role
with expected(enum_value) as (
  values ('admin'), ('store_clerk'), ('store_manager'), ('guest')
),
actual(enum_value) as (
  select e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'app_role'
)
select
  'app_role' as enum_name,
  (select count(*) from expected) as expected_count,
  (select count(*) from actual) as actual_count,
  coalesce((
    select string_agg(enum_value, ', ' order by enum_value)
    from (
      select enum_value from expected
      except
      select enum_value from actual
    ) m
  ), '') as missing_values,
  coalesce((
    select string_agg(enum_value, ', ' order by enum_value)
    from (
      select enum_value from actual
      except
      select enum_value from expected
    ) x
  ), '') as extra_values;

-- 3) 檢查 RLS 與 policy 數量
with rls_targets(table_name) as (
  values
    ('user_profiles'),
    ('user_role_bindings'),
    ('product_style_i18n'),
    ('sku_i18n')
),
rls_state as (
  select
    r.table_name,
    coalesce(c.relrowsecurity, false) as rls_enabled
  from rls_targets r
  left join pg_class c
    on c.relname = r.table_name
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
),
policy_targets(table_name, policy_name) as (
  values
    ('user_profiles', 'user_profiles_select_self'),
    ('user_role_bindings', 'user_role_bindings_admin_manage'),
    ('product_style_i18n', 'product_style_i18n_select_authenticated'),
    ('sku_i18n', 'sku_i18n_select_authenticated')
),
policy_state as (
  select
    pt.table_name,
    pt.policy_name,
    exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = pt.table_name
        and p.policyname = pt.policy_name
    ) as policy_exists
  from policy_targets pt
)
select
  (select count(*) from rls_targets) as expected_rls_table_count,
  (select count(*) from rls_state where rls_enabled) as actual_rls_enabled_count,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename in (
    'user_profiles', 'user_role_bindings', 'product_style_i18n', 'sku_i18n'
  )) as actual_policy_count_on_targets,
  (select count(*) from policy_targets) as expected_named_policy_count,
  (select count(*) from policy_state where policy_exists) as actual_named_policy_count;

-- 4) 檢查 migration 記錄包含 db3.0-auth-i18n-bootstrap
select
  exists (
    select 1
    from public.schema_migrations
    where version = 'db3.0-auth-i18n-bootstrap'
  ) as has_db30_auth_i18n_bootstrap;

-- 5) PASS/FAIL 摘要（唯讀）
with expected_tables(table_name) as (
  values
    ('stores'),
    ('product_styles'),
    ('skus'),
    ('system_locales'),
    ('user_profiles'),
    ('user_role_bindings'),
    ('product_style_i18n'),
    ('sku_i18n'),
    ('schema_migrations')
),
table_check as (
  select
    count(*) as expected_count,
    count(*) filter (
      where to_regclass(format('public.%I', table_name)) is not null
    ) as present_count
  from expected_tables
),
expected_locale(enum_value) as (
  values ('en'), ('zh-Hant'), ('zh-Hans')
),
actual_locale(enum_value) as (
  select e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'locale_code'
),
locale_check as (
  select
    not exists (
      select enum_value from expected_locale
      except
      select enum_value from actual_locale
    )
    and not exists (
      select enum_value from actual_locale
      except
      select enum_value from expected_locale
    ) as pass
),
expected_role(enum_value) as (
  values ('admin'), ('store_clerk'), ('store_manager'), ('guest')
),
actual_role(enum_value) as (
  select e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'app_role'
),
role_check as (
  select
    not exists (
      select enum_value from expected_role
      except
      select enum_value from actual_role
    )
    and not exists (
      select enum_value from actual_role
      except
      select enum_value from expected_role
    ) as pass
),
rls_targets(table_name) as (
  values
    ('user_profiles'),
    ('user_role_bindings'),
    ('product_style_i18n'),
    ('sku_i18n')
),
rls_check as (
  select
    count(*) as expected_count,
    count(*) filter (where c.relrowsecurity) as enabled_count
  from rls_targets r
  left join pg_class c
    on c.relname = r.table_name
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
),
policy_targets(table_name, policy_name) as (
  values
    ('user_profiles', 'user_profiles_select_self'),
    ('user_role_bindings', 'user_role_bindings_admin_manage'),
    ('product_style_i18n', 'product_style_i18n_select_authenticated'),
    ('sku_i18n', 'sku_i18n_select_authenticated')
),
policy_check as (
  select
    count(*) as expected_count,
    count(*) filter (
      where exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = pt.table_name
          and p.policyname = pt.policy_name
      )
    ) as present_count
  from policy_targets pt
),
migration_check as (
  select
    exists (
      select 1
      from public.schema_migrations
      where version = 'db3.0-auth-i18n-bootstrap'
    ) as pass
)
select
  case
    when
      tc.present_count = tc.expected_count
      and lc.pass
      and rc.pass
      and rlc.enabled_count = rlc.expected_count
      and pc.present_count = pc.expected_count
      and mc.pass
    then 'PASS'
    else 'FAIL'
  end as smoke_status,
  tc.present_count || '/' || tc.expected_count as table_check,
  case when lc.pass then 'PASS' else 'FAIL' end as locale_code_check,
  case when rc.pass then 'PASS' else 'FAIL' end as app_role_check,
  rlc.enabled_count || '/' || rlc.expected_count as rls_check,
  pc.present_count || '/' || pc.expected_count as named_policy_check,
  case when mc.pass then 'PASS' else 'FAIL' end as migration_check
from table_check tc
cross join locale_check lc
cross join role_check rc
cross join rls_check rlc
cross join policy_check pc
cross join migration_check mc;
