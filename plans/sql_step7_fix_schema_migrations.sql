-- Step7 修正：補齊 schema_migrations 與 bootstrap migration 紀錄
-- 用途：處理 schema_migrations 不存在、缺少 note 欄位或缺少 version 唯一性
-- 執行環境：Supabase SQL Editor（可重複執行）

begin;

-- 1) 建立 schema_migrations（若不存在）
create table if not exists public.schema_migrations (
  version text not null,
  note text,
  applied_at timestamptz not null default now()
);

-- 1.1) 舊結構兼容：若缺少 note 欄位則補上
alter table if exists public.schema_migrations
  add column if not exists note text;

-- 2) 補 unique index/version（若舊資料有重複 version，先去重再建唯一索引）
with dedup as (
  select
    ctid,
    row_number() over (
      partition by version
      order by applied_at desc, ctid desc
    ) as rn
  from public.schema_migrations
)
delete from public.schema_migrations m
using dedup d
where m.ctid = d.ctid
  and d.rn > 1;

create unique index if not exists uq_schema_migrations_version
  on public.schema_migrations (version);

-- 3) 寫入/更新 db3.0-auth-i18n-bootstrap migration 紀錄
--    使用 version + note；若 version 已存在則更新 note，避免再次報 42703
insert into public.schema_migrations (version, note)
values ('db3.0-auth-i18n-bootstrap', 'bootstrap auth + i18n schema for DB 3.0')
on conflict (version) do update
set note = excluded.note;

commit;

-- 4) 驗證查詢：確認表、索引與 migration 紀錄

-- 4.1 驗證 schema_migrations 表存在
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'schema_migrations';

-- 4.2 驗證 version 唯一索引存在
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'schema_migrations'
  and indexname = 'uq_schema_migrations_version';

-- 4.3 驗證 migration 紀錄已寫入
select
  version,
  note,
  applied_at
from public.schema_migrations
where version = 'db3.0-auth-i18n-bootstrap';
