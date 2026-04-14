-- Stage 2-3: 試穿後 10 分鐘成交轉化（session conversion）
-- 對應程式：api/rfid-webhook.js 中 sale_completed 事件會嘗試標記 converted_to_sale

alter table if exists public.fitting_room_sessions
  add column if not exists converted_to_sale boolean not null default false,
  add column if not exists sale_time timestamptz;

create index if not exists idx_frs_converted_to_sale
  on public.fitting_room_sessions (converted_to_sale, entered_at desc);

create index if not exists idx_frs_sale_time
  on public.fitting_room_sessions (sale_time desc);

-- 驗證欄位
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'fitting_room_sessions'
  and column_name in ('converted_to_sale', 'sale_time')
order by column_name;

-- 驗證最近 session
select
  id,
  product_key,
  entered_at,
  left_at,
  converted_to_sale,
  sale_time,
  duration_seconds
from public.fitting_room_sessions
order by entered_at desc
limit 30;

-- v1 轉化率（全期間）
select
  count(*) as total_sessions,
  count(*) filter (where converted_to_sale) as converted_sessions,
  round(
    (count(*) filter (where converted_to_sale)::numeric / nullif(count(*), 0)::numeric) * 100,
    2
  ) as conversion_rate_pct
from public.fitting_room_sessions;

-- v1 轉化率（近 7 天）
select
  date_trunc('day', entered_at) as day,
  count(*) as total_sessions,
  count(*) filter (where converted_to_sale) as converted_sessions,
  round(
    (count(*) filter (where converted_to_sale)::numeric / nullif(count(*), 0)::numeric) * 100,
    2
  ) as conversion_rate_pct
from public.fitting_room_sessions
where entered_at >= now() - interval '7 days'
group by 1
order by 1 desc;

