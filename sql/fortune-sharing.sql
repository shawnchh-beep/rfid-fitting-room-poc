alter table readings
add column if not exists share_token text,
add column if not exists ref_source text,
add column if not exists ref_medium text,
add column if not exists ref_campaign text,
add column if not exists referrer text;

create unique index if not exists readings_share_token_key
on readings (share_token)
where share_token is not null;

create index if not exists readings_ref_source_idx on readings(ref_source);
create index if not exists readings_ip_hash_created_at_idx on readings(ip_hash, created_at desc);

create table if not exists share_events (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid references readings(id) on delete cascade,
  platform text not null,
  action text not null default 'click',
  ip_hash text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists share_events_reading_id_idx on share_events(reading_id);
create index if not exists share_events_created_at_idx on share_events(created_at desc);
create index if not exists share_events_platform_idx on share_events(platform);
create index if not exists share_events_ip_hash_created_at_idx on share_events(ip_hash, created_at desc);
