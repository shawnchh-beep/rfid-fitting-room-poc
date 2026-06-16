create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  topic text not null,
  method text not null,
  result_key text not null,
  result_title text not null,
  result_text text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists readings_created_at_idx
  on public.readings (created_at desc);

create index if not exists readings_ip_hash_created_at_idx
  on public.readings (ip_hash, created_at desc);

create index if not exists readings_topic_created_at_idx
  on public.readings (topic, created_at desc);

create index if not exists readings_method_created_at_idx
  on public.readings (method, created_at desc);

select
  date(created_at) as day,
  count(*) as total_readings,
  count(distinct ip_hash) as unique_users
from public.readings
group by day
order by day desc;
