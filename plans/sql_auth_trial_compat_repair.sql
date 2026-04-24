-- Auth / Trial 相容修復 SQL
-- 目的：在既有 v3 user_profiles 結構上，補齊 trial/auth API 需要的欄位與資料表
-- 使用時機：直接執行 plans/sql_auth_trial_step1_auth_and_rls.sql 會出現 column "role" does not exist

begin;

create extension if not exists citext;
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) user_profiles：若不存在則建立；若已存在則補齊 trial/auth 需要的欄位
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext,
  full_name text,
  company_name text,
  job_title text,
  role text default 'guest',
  status text default 'pending_activation',
  trial_requested_at timestamptz,
  trial_expires_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists user_id uuid;
alter table public.user_profiles add column if not exists email citext;
alter table public.user_profiles add column if not exists full_name text;
alter table public.user_profiles add column if not exists company_name text;
alter table public.user_profiles add column if not exists job_title text;
alter table public.user_profiles add column if not exists role text;
alter table public.user_profiles add column if not exists status text;
alter table public.user_profiles add column if not exists trial_requested_at timestamptz;
alter table public.user_profiles add column if not exists trial_expires_at timestamptz;
alter table public.user_profiles add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.user_profiles add column if not exists last_login_at timestamptz;
alter table public.user_profiles add column if not exists created_at timestamptz;
alter table public.user_profiles add column if not exists updated_at timestamptz;

alter table public.user_profiles alter column role set default 'guest';
alter table public.user_profiles alter column status set default 'pending_activation';
alter table public.user_profiles alter column created_at set default now();
alter table public.user_profiles alter column updated_at set default now();

do $$
declare
  v_has_id boolean;
  v_has_display_name boolean;
  v_has_is_active boolean;
  v_has_user_role_bindings boolean;
  v_has_bindings_user_id boolean;
  v_has_bindings_role boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'id'
  ) into v_has_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'display_name'
  ) into v_has_display_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'is_active'
  ) into v_has_is_active;

  v_has_user_role_bindings := to_regclass('public.user_role_bindings') is not null;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_role_bindings'
      and column_name = 'user_id'
  ) into v_has_bindings_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_role_bindings'
      and column_name = 'role'
  ) into v_has_bindings_role;

  if v_has_id then
    execute 'update public.user_profiles set user_id = coalesce(user_id, id) where user_id is null';
  end if;

  if v_has_display_name then
    execute $sql$
      update public.user_profiles
      set full_name = coalesce(nullif(full_name, ''), nullif(display_name, ''))
      where coalesce(full_name, '') = ''
        and coalesce(display_name, '') <> ''
    $sql$;
  end if;

  if v_has_is_active then
    execute $sql$
      update public.user_profiles
      set status = case when is_active = false then 'disabled' else 'active' end
      where coalesce(status, '') = ''
    $sql$;
  end if;

  execute $sql$
    update public.user_profiles up
    set
      email = coalesce(nullif(up.email::text, ''), au.email),
      full_name = coalesce(
        nullif(up.full_name, ''),
        nullif(au.raw_user_meta_data->>'full_name', ''),
        split_part(au.email, '@', 1)
      ),
      company_name = coalesce(up.company_name, nullif(au.raw_user_meta_data->>'company_name', '')),
      job_title = coalesce(up.job_title, nullif(au.raw_user_meta_data->>'job_title', '')),
      role = coalesce(
        nullif(up.role, ''),
        case
          when coalesce(nullif(au.raw_app_meta_data->>'role', ''), '') = 'admin' then 'admin'
          when coalesce(nullif(au.raw_app_meta_data->>'role', ''), '') = 'trial' then 'trial'
          when coalesce(nullif(au.raw_app_meta_data->>'role', ''), '') in ('user', 'store_manager', 'store_clerk') then 'user'
          when coalesce(nullif(au.raw_app_meta_data->>'role', ''), '') = 'guest' then 'guest'
          else null
        end
      ),
      status = coalesce(
        nullif(up.status, ''),
        nullif(au.raw_app_meta_data->>'status', '')
      ),
      created_at = coalesce(up.created_at, now()),
      updated_at = coalesce(up.updated_at, now())
    from auth.users au
    where up.user_id = au.id
  $sql$;

  if v_has_user_role_bindings and v_has_bindings_user_id and v_has_bindings_role then
    execute $sql$
      with role_src as (
        select
          urb.user_id,
          case
            when bool_or(urb.role::text = 'admin') then 'admin'
            when bool_or(urb.role::text in ('store_manager', 'store_clerk', 'user')) then 'user'
            when bool_or(urb.role::text = 'guest') then 'guest'
            else null
          end as mapped_role
        from public.user_role_bindings urb
        group by urb.user_id
      )
      update public.user_profiles up
      set role = role_src.mapped_role
      from role_src
      where up.user_id = role_src.user_id
        and role_src.mapped_role is not null
        and coalesce(up.role, '') = ''
    $sql$;
  end if;
end;
$$;

update public.user_profiles
set role = 'user'
where role in ('store_manager', 'store_clerk');

update public.user_profiles
set role = 'guest'
where coalesce(btrim(role), '') = '';

update public.user_profiles
set status = 'active'
where coalesce(btrim(status), '') = '';

update public.user_profiles
set created_at = now()
where created_at is null;

update public.user_profiles
set updated_at = now()
where updated_at is null;

create unique index if not exists user_profiles_user_id_uidx
  on public.user_profiles (user_id);

create index if not exists user_profiles_role_idx
  on public.user_profiles(role);

create index if not exists user_profiles_status_idx
  on public.user_profiles(status);

create index if not exists user_profiles_trial_expires_at_idx
  on public.user_profiles(trial_expires_at)
  where trial_expires_at is not null;

create index if not exists user_profiles_email_lower_idx
  on public.user_profiles ((lower(email::text)));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'id'
  ) then
    execute $sql$
      create or replace function public.user_profiles_sync_identity_cols()
      returns trigger
      language plpgsql
      as $f$
      begin
        if new.user_id is null and new.id is not null then
          new.user_id := new.id;
        end if;

        if new.id is null and new.user_id is not null then
          new.id := new.user_id;
        end if;

        return new;
      end;
      $f$;
    $sql$;

    execute 'drop trigger if exists trg_user_profiles_sync_identity_cols on public.user_profiles';
    execute $sql$
      create trigger trg_user_profiles_sync_identity_cols
      before insert or update on public.user_profiles
      for each row execute function public.user_profiles_sync_identity_cols()
    $sql$;
  end if;
end;
$$;

drop trigger if exists trg_user_profiles_set_updated_at on public.user_profiles;
create trigger trg_user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- 2) trial_requests：缺表時建立，已有半套結構時補欄位
create table if not exists public.trial_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company_name text not null,
  job_title text not null,
  email citext not null,
  request_status text not null default 'pending',
  requested_role text not null default 'trial',
  supabase_user_id uuid references auth.users(id) on delete set null,
  trial_expires_at timestamptz,
  resend_provider text default 'resend',
  resend_message_id text,
  error_code text,
  error_message text,
  request_ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trial_requests add column if not exists id uuid;
alter table public.trial_requests add column if not exists full_name text;
alter table public.trial_requests add column if not exists company_name text;
alter table public.trial_requests add column if not exists job_title text;
alter table public.trial_requests add column if not exists email citext;
alter table public.trial_requests add column if not exists request_status text;
alter table public.trial_requests add column if not exists requested_role text;
alter table public.trial_requests add column if not exists supabase_user_id uuid references auth.users(id) on delete set null;
alter table public.trial_requests add column if not exists trial_expires_at timestamptz;
alter table public.trial_requests add column if not exists resend_provider text;
alter table public.trial_requests add column if not exists resend_message_id text;
alter table public.trial_requests add column if not exists error_code text;
alter table public.trial_requests add column if not exists error_message text;
alter table public.trial_requests add column if not exists request_ip inet;
alter table public.trial_requests add column if not exists user_agent text;
alter table public.trial_requests add column if not exists created_at timestamptz;
alter table public.trial_requests add column if not exists updated_at timestamptz;

alter table public.trial_requests alter column id set default gen_random_uuid();
alter table public.trial_requests alter column request_status set default 'pending';
alter table public.trial_requests alter column requested_role set default 'trial';
alter table public.trial_requests alter column resend_provider set default 'resend';
alter table public.trial_requests alter column created_at set default now();
alter table public.trial_requests alter column updated_at set default now();

update public.trial_requests
set request_status = 'pending'
where coalesce(btrim(request_status), '') = '';

update public.trial_requests
set requested_role = 'trial'
where coalesce(btrim(requested_role), '') = '';

update public.trial_requests
set resend_provider = 'resend'
where coalesce(btrim(resend_provider), '') = '';

update public.trial_requests
set created_at = now()
where created_at is null;

update public.trial_requests
set updated_at = now()
where updated_at is null;

create index if not exists trial_requests_email_status_idx
  on public.trial_requests ((lower(email::text)), request_status);

create index if not exists trial_requests_created_at_idx
  on public.trial_requests (created_at desc);

drop trigger if exists trg_trial_requests_set_updated_at on public.trial_requests;
create trigger trg_trial_requests_set_updated_at
before update on public.trial_requests
for each row execute function public.set_updated_at();

-- 3) auth_audit_logs：缺表時建立，已有半套結構時補欄位
create table if not exists public.auth_audit_logs (
  id bigint generated by default as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  result text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.auth_audit_logs add column if not exists id bigint generated by default as identity;
alter table public.auth_audit_logs add column if not exists actor_user_id uuid references auth.users(id) on delete set null;
alter table public.auth_audit_logs add column if not exists target_user_id uuid references auth.users(id) on delete set null;
alter table public.auth_audit_logs add column if not exists action text;
alter table public.auth_audit_logs add column if not exists entity_type text;
alter table public.auth_audit_logs add column if not exists entity_id text;
alter table public.auth_audit_logs add column if not exists result text;
alter table public.auth_audit_logs add column if not exists metadata jsonb;
alter table public.auth_audit_logs add column if not exists created_at timestamptz;

alter table public.auth_audit_logs alter column metadata set default '{}'::jsonb;
alter table public.auth_audit_logs alter column created_at set default now();

update public.auth_audit_logs
set metadata = '{}'::jsonb
where metadata is null;

update public.auth_audit_logs
set created_at = now()
where created_at is null;

create index if not exists auth_audit_logs_created_at_idx
  on public.auth_audit_logs(created_at desc);

create index if not exists auth_audit_logs_action_idx
  on public.auth_audit_logs(action);

-- 4) RLS helper function：供現有 policy 或後續 baseline 補跑使用
create or replace function public.current_user_is_active()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.user_id = auth.uid()
      and coalesce(up.status, 'active') = 'active'
      and (
        coalesce(up.role, 'guest') <> 'trial'
        or up.trial_expires_at is null
        or up.trial_expires_at > now()
      )
  );
$$;

commit;

-- Smoke checks
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('user_profiles', 'trial_requests', 'auth_audit_logs')
order by table_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_profiles'
  and column_name in (
    'id',
    'user_id',
    'email',
    'full_name',
    'company_name',
    'job_title',
    'role',
    'status',
    'trial_requested_at',
    'trial_expires_at',
    'created_at',
    'updated_at'
  )
order by column_name;

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('user_profiles', 'trial_requests', 'auth_audit_logs')
order by tablename, indexname;
