-- Stage 2-1: RFID 事件模型擴充（向下相容）
-- 目的：補齊 event_type / event_source / from_zone / to_zone / metadata
-- 備註：現有程式已具備 fallback，若欄位不存在會寫入舊欄位模式。

alter table if exists public.rfid_events
  add column if not exists event_type text,
  add column if not exists event_source text,
  add column if not exists from_zone text,
  add column if not exists to_zone text,
  add column if not exists metadata jsonb;

create index if not exists idx_rfid_events_event_type
  on public.rfid_events (event_type);

create index if not exists idx_rfid_events_event_source
  on public.rfid_events (event_source);

create index if not exists idx_rfid_events_to_zone_timestamp
  on public.rfid_events (to_zone, timestamp desc);

-- 建議值（可選）
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_rfid_events_event_source'
  ) then
    alter table public.rfid_events
      add constraint chk_rfid_events_event_source
      check (event_source is null or event_source in ('demo_drag', 'simulator', 'rfid_reader', 'system'));
  end if;
end $$;

-- 驗證欄位
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'rfid_events'
  and column_name in ('event_type', 'event_source', 'from_zone', 'to_zone', 'metadata')
order by column_name;

-- 驗證最近資料
select id, epc_data, reader_id, event_type, event_source, from_zone, to_zone, timestamp
from public.rfid_events
order by timestamp desc
limit 20;

