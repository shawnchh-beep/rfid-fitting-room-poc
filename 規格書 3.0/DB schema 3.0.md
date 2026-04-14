下面直接給你 RFID 試衣間 Demo - DB Schema 初稿 v1.0。
我會用 PostgreSQL / Supabase 友善 的方式來寫，方便你後續直接拿去改成正式 SQL。

這版設計原則：
	•	先支援 demo + simulation + ui manual
	•	結構上保留未來接真實 reader / POS / API 的空間
	•	先以 可開發、可查詢、可做 KPI 為優先
	•	不把「離架偵測」當核心前提

⸻

RFID 試衣間 Demo - DB Schema 初稿 v1.0

⸻

1. Schema 設計總覽

資料表分成 4 層：

A. Master Data
	•	stores
	•	zones
	•	fitting_rooms
	•	product_styles
	•	skus
	•	items

B. Operational Data
	•	fitting_sessions
	•	session_items
	•	events
	•	item_outcomes
	•	transactions
	•	transaction_items

C. Analytics / Rules
	•	alert_rules
	•	alerts
	•	insights
	•	recommendations
	•	kpi_snapshots

D. Optional / Config
	•	system_settings

⸻

2. Enum 建議

先定義 enum，後面資料表會比較乾淨。

⸻

2.1 store_status

create type store_status as enum (
  'active',
  'inactive'
);

2.2 zone_type

create type zone_type as enum (
  'entrance',
  'display_area',
  'fitting_room',
  'checkout',
  'backroom',
  'unknown'
);

2.3 fitting_room_status

create type fitting_room_status as enum (
  'available',
  'occupied',
  'maintenance'
);

2.4 item_status

create type item_status as enum (
  'on_display',
  'in_fitting_room',
  'left_fitting_room',
  'returned_to_floor',
  'moved_to_checkout',
  'sold',
  'unknown'
);

2.5 inventory_status

create type inventory_status as enum (
  'in_stock',
  'sold',
  'unavailable'
);

2.6 session_status

create type session_status as enum (
  'active',
  'completed',
  'abandoned'
);

2.7 session_outcome_type

create type session_outcome_type as enum (
  'converted',
  'non_converted',
  'partial_converted',
  'unknown'
);

2.8 source_type

create type source_type as enum (
  'simulation',
  'ui_manual',
  'integration'
);

2.9 event_type

create type event_type as enum (
  'item_entered_fitting_room',
  'item_added_to_session',
  'item_left_fitting_room',
  'item_returned_to_floor',
  'item_moved_to_checkout',
  'item_sold',
  'session_started',
  'session_completed',
  'session_abandoned',
  'dwell_time_alert',
  'item_left_in_room_alert',
  'long_session_alert',
  'high_interest_low_conversion_alert'
);

2.10 outcome_type

create type outcome_type as enum (
  'returned',
  'checkout',
  'sold',
  'unresolved'
);

2.11 alert_type

create type alert_type as enum (
  'long_dwell',
  'item_left_in_room',
  'long_session',
  'low_conversion_pattern',
  'staff_assist_recommended'
);

2.12 alert_severity

create type alert_severity as enum (
  'info',
  'warning',
  'critical'
);

2.13 alert_status

create type alert_status as enum (
  'open',
  'resolved',
  'dismissed'
);

2.14 scope_type

create type scope_type as enum (
  'store',
  'fitting_room',
  'style',
  'sku',
  'item',
  'session',
  'staff_process'
);

2.15 insight_type

create type insight_type as enum (
  'conversion_risk',
  'size_opportunity',
  'cross_sell_opportunity',
  'store_performance_gap',
  'product_fit_issue',
  'assortment_opportunity'
);

2.16 recommendation_type

create type recommendation_type as enum (
  'improve_merchandising',
  'adjust_size_mix',
  'optimize_staff_assist',
  'improve_pairing_display',
  'investigate_fit_issue'
);

2.17 recommendation_status

create type recommendation_status as enum (
  'open',
  'accepted',
  'dismissed'
);

2.18 kpi_granularity

create type kpi_granularity as enum (
  'realtime',
  'daily',
  'weekly',
  'monthly'
);


⸻

3. Master Data Tables

⸻

3.1 stores

create table stores (
  id uuid primary key default gen_random_uuid(),
  store_code text not null unique,
  store_name text not null,
  store_type text,
  country text,
  city text,
  timezone text default 'Asia/Taipei',
  status store_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


⸻

3.2 zones

create table zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  zone_code text not null,
  zone_name text not null,
  zone_type zone_type not null,
  fitting_room_id uuid null,
  display_order integer default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, zone_code)
);

注意：zones.fitting_room_id 會和 fitting_rooms 有循環依賴問題。
實作時建議先建 zones，再建 fitting_rooms，最後視需要加 foreign key 或改成只在 fitting_rooms 存 zone_id 即可。
簡化建議：先刪掉 zones.fitting_room_id，只保留 fitting_rooms.zone_id。

比較乾淨的版本如下：

create table zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  zone_code text not null,
  zone_name text not null,
  zone_type zone_type not null,
  display_order integer default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, zone_code)
);


⸻

3.3 fitting_rooms

create table fitting_rooms (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete restrict,
  fitting_room_code text not null,
  fitting_room_name text not null,
  capacity integer default 1,
  status fitting_room_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, fitting_room_code),
  unique(zone_id)
);


⸻

3.4 product_styles

create table product_styles (
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


⸻

3.5 skus

create table skus (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references product_styles(id) on delete cascade,
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


⸻

3.6 items

create table items (
  id uuid primary key default gen_random_uuid(),
  epc text not null unique,
  sku_id uuid not null references skus(id) on delete restrict,
  style_id uuid not null references product_styles(id) on delete restrict,
  serial_no text,
  current_store_id uuid not null references stores(id) on delete restrict,
  current_zone_id uuid references zones(id) on delete restrict,
  current_status item_status not null default 'on_display',
  inventory_status inventory_status not null default 'in_stock',
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

style_id technically 可由 sku_id 反查，但保留冗餘欄位可加快查詢與聚合。

⸻

4. Operational Tables

⸻

4.1 fitting_sessions

create table fitting_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  fitting_room_id uuid not null references fitting_rooms(id) on delete restrict,
  session_status session_status not null default 'active',
  started_at timestamptz not null,
  ended_at timestamptz,
  dwell_seconds integer,
  item_count integer not null default 0,
  converted_item_count integer not null default 0,
  returned_item_count integer not null default 0,
  moved_to_checkout_count integer not null default 0,
  outcome_type session_outcome_type not null default 'unknown',
  created_by source_type not null default 'simulation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


⸻

4.2 session_items

create table session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references fitting_sessions(id) on delete cascade,
  item_id uuid not null references items(id) on delete restrict,
  epc text not null,
  sku_id uuid not null references skus(id) on delete restrict,
  entered_at timestamptz not null,
  exited_at timestamptz,
  item_dwell_seconds integer,
  exit_result outcome_type not null default 'unresolved',
  is_primary_item boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, item_id)
);


⸻

4.3 events

create table events (
  id uuid primary key default gen_random_uuid(),
  event_type event_type not null,
  event_time timestamptz not null,
  store_id uuid not null references stores(id) on delete cascade,
  zone_from_id uuid references zones(id) on delete restrict,
  zone_to_id uuid references zones(id) on delete restrict,
  fitting_room_id uuid references fitting_rooms(id) on delete restrict,
  session_id uuid references fitting_sessions(id) on delete set null,
  item_id uuid references items(id) on delete set null,
  epc text,
  sku_id uuid references skus(id) on delete set null,
  style_id uuid references product_styles(id) on delete set null,
  quantity integer not null default 1,
  source_type source_type not null,
  source_id text,
  confidence_score numeric(5,4),
  raw_payload jsonb,
  created_at timestamptz not null default now()
);


⸻

4.4 item_outcomes

create table item_outcomes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references fitting_sessions(id) on delete cascade,
  item_id uuid not null references items(id) on delete restrict,
  sku_id uuid not null references skus(id) on delete restrict,
  outcome_type outcome_type not null,
  outcome_time timestamptz not null,
  linked_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

linked_transaction_id 先不加 foreign key，因為 transactions 可能晚一點建立。
如果你要一次建完，也可以直接 references。

⸻

4.5 transactions

create table transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  transaction_time timestamptz not null,
  transaction_no text not null unique,
  currency text default 'TWD',
  total_amount numeric(12,2) not null default 0,
  source_type text not null default 'simulation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


⸻

4.6 transaction_items

create table transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  sku_id uuid not null references skus(id) on delete restrict,
  qty integer not null default 1,
  unit_price numeric(12,2) not null,
  line_amount numeric(12,2) not null,
  linked_session_id uuid references fitting_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);


⸻

5. Analytics / Rules Tables

⸻

5.1 alert_rules

create table alert_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  rule_name text not null,
  alert_type alert_type not null,
  scope_type scope_type not null,
  threshold_seconds integer,
  threshold_count integer,
  severity alert_severity not null default 'warning',
  is_active boolean not null default true,
  applies_to_store_id uuid references stores(id) on delete cascade,
  mode text not null default 'demo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


⸻

5.2 alerts

create table alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type alert_type not null,
  severity alert_severity not null,
  store_id uuid not null references stores(id) on delete cascade,
  fitting_room_id uuid references fitting_rooms(id) on delete set null,
  session_id uuid references fitting_sessions(id) on delete set null,
  item_id uuid references items(id) on delete set null,
  sku_id uuid references skus(id) on delete set null,
  title text not null,
  message text not null,
  triggered_at timestamptz not null,
  resolved_at timestamptz,
  status alert_status not null default 'open',
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


⸻

5.3 insights

create table insights (
  id uuid primary key default gen_random_uuid(),
  insight_type insight_type not null,
  scope_type scope_type not null,
  scope_id uuid,
  title text not null,
  summary text not null,
  evidence_data jsonb,
  confidence_level text,
  generated_by text not null default 'rule_engine',
  generated_at timestamptz not null default now(),
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

scope_id 不加 foreign key，因為它可能對應 store / sku / style / session 等不同表。

⸻

5.4 recommendations

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid references insights(id) on delete cascade,
  recommendation_type recommendation_type not null,
  target_scope_type scope_type not null,
  target_scope_id uuid,
  priority text not null default 'medium',
  title text not null,
  description text not null,
  expected_impact text,
  status recommendation_status not null default 'open',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


⸻

5.5 kpi_snapshots

create table kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope_type scope_type not null,
  scope_id uuid,
  date_granularity kpi_granularity not null,
  snapshot_at timestamptz not null,
  try_on_count integer not null default 0,
  session_count integer not null default 0,
  conversion_count integer not null default 0,
  conversion_rate numeric(8,4) not null default 0,
  return_count integer not null default 0,
  return_rate numeric(8,4) not null default 0,
  avg_dwell_seconds integer not null default 0,
  avg_items_per_session numeric(8,2) not null default 0,
  high_interest_low_conversion_flag boolean not null default false,
  extra_metrics jsonb,
  created_at timestamptz not null default now()
);


⸻

6. Optional / Config

⸻

6.1 system_settings

create table system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

可放：
	•	demo mode thresholds
	•	session idle close seconds
	•	default timezone
	•	simulation speed options

⸻

7. Index 建議

這部分很重要，不然 event/query 會很慢。

⸻

7.1 items

create index idx_items_sku_id on items(sku_id);
create index idx_items_style_id on items(style_id);
create index idx_items_current_store_id on items(current_store_id);
create index idx_items_current_zone_id on items(current_zone_id);
create index idx_items_current_status on items(current_status);

7.2 fitting_sessions

create index idx_fitting_sessions_store_id on fitting_sessions(store_id);
create index idx_fitting_sessions_fitting_room_id on fitting_sessions(fitting_room_id);
create index idx_fitting_sessions_status on fitting_sessions(session_status);
create index idx_fitting_sessions_started_at on fitting_sessions(started_at);

7.3 session_items

create index idx_session_items_session_id on session_items(session_id);
create index idx_session_items_item_id on session_items(item_id);
create index idx_session_items_sku_id on session_items(sku_id);
create index idx_session_items_entered_at on session_items(entered_at);

7.4 events

create index idx_events_event_time on events(event_time desc);
create index idx_events_event_type on events(event_type);
create index idx_events_store_id on events(store_id);
create index idx_events_session_id on events(session_id);
create index idx_events_item_id on events(item_id);
create index idx_events_sku_id on events(sku_id);
create index idx_events_fitting_room_id on events(fitting_room_id);

7.5 alerts

create index idx_alerts_store_id on alerts(store_id);
create index idx_alerts_status on alerts(status);
create index idx_alerts_alert_type on alerts(alert_type);
create index idx_alerts_session_id on alerts(session_id);
create index idx_alerts_item_id on alerts(item_id);
create index idx_alerts_triggered_at on alerts(triggered_at desc);
create unique index idx_alerts_dedupe_key_open
on alerts(dedupe_key)
where status = 'open';

7.6 kpi_snapshots

create index idx_kpi_snapshots_scope on kpi_snapshots(scope_type, scope_id);
create index idx_kpi_snapshots_snapshot_at on kpi_snapshots(snapshot_at desc);
create index idx_kpi_snapshots_granularity on kpi_snapshots(date_granularity);


⸻

8. updated_at 自動更新建議

如果你用 PostgreSQL / Supabase，建議加 trigger。

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

然後套到所有有 updated_at 的表，例如：

create trigger trg_stores_updated_at
before update on stores
for each row execute function set_updated_at();

create trigger trg_zones_updated_at
before update on zones
for each row execute function set_updated_at();

create trigger trg_fitting_rooms_updated_at
before update on fitting_rooms
for each row execute function set_updated_at();

create trigger trg_product_styles_updated_at
before update on product_styles
for each row execute function set_updated_at();

create trigger trg_skus_updated_at
before update on skus
for each row execute function set_updated_at();

create trigger trg_items_updated_at
before update on items
for each row execute function set_updated_at();

create trigger trg_fitting_sessions_updated_at
before update on fitting_sessions
for each row execute function set_updated_at();

create trigger trg_session_items_updated_at
before update on session_items
for each row execute function set_updated_at();

create trigger trg_item_outcomes_updated_at
before update on item_outcomes
for each row execute function set_updated_at();

create trigger trg_transactions_updated_at
before update on transactions
for each row execute function set_updated_at();

create trigger trg_alert_rules_updated_at
before update on alert_rules
for each row execute function set_updated_at();

create trigger trg_alerts_updated_at
before update on alerts
for each row execute function set_updated_at();

create trigger trg_recommendations_updated_at
before update on recommendations
for each row execute function set_updated_at();

create trigger trg_system_settings_updated_at
before update on system_settings
for each row execute function set_updated_at();


⸻

9. 最小可用版本 MVP 建議

如果你想先快速起來，不要一次全建完，建議第一批先做：

必做表
	•	stores
	•	zones
	•	fitting_rooms
	•	product_styles
	•	skus
	•	items
	•	fitting_sessions
	•	session_items
	•	events
	•	alerts

這批就可以支撐：
	•	Live Store
	•	基本 Session
	•	停留警示
	•	Event feed

第二批再做
	•	item_outcomes
	•	transactions
	•	transaction_items
	•	alert_rules
	•	kpi_snapshots

第三批再做
	•	insights
	•	recommendations
	•	system_settings

⸻

10. 幾個實務修正建議

⸻

10.1 scope_id 不要太早強制 foreign key

像 insights.scope_id、recommendations.target_scope_id，因為會跨很多表，先不要硬綁，不然很難維護。

⸻

10.2 events.raw_payload 一定要留

這個很重要。
之後不管是：
	•	simulation
	•	ui manual
	•	真 reader input

都可以保留原始資料，方便 debug。

⸻

10.3 items.current_status 是快取欄位

嚴格來說，item 當前狀態可由 event 推導。
但實務上保留 current_status 會讓 UI 快很多。

⸻

10.4 session_items 是核心表

這張表很重要，因為它同時承接：
	•	entered_at
	•	exited_at
	•	dwell
	•	exit_result

後面很多 KPI 都會直接從這張表算。

⸻

11. 建議第一版 seed data 結構

你後續要做 demo，至少要先塞這些資料：

stores
	•	1 間 demo store

zones
	•	entrance
	•	display area A
	•	display area B
	•	fitting room 1~4
	•	checkout
	•	backroom

fitting_rooms
	•	4 個 fitting room

product_styles
	•	8~12 個款式

skus
	•	每款 2~4 個尺寸 / 顏色
	•	總數約 20~30 個 SKU

items
	•	每個 SKU 2~4 件 item
	•	總數約 60~100 件

這樣畫面才會像真的店。

⸻

12. 我對這版 schema 的直接評語

這版已經足夠支撐：
	•	Live Store 互動畫面
	•	Fitting Session 管理
	•	商品進出試衣間時間
	•	dwell time 警示
	•	商品回架 / 去 checkout / sold
	•	Overview KPI 聚合
	•	後續 AI insights 擴充

但還沒做的兩個重點是：
	1.	KPI 定義如何從這些表計算
	2.	Event engine 寫入時的流程規格

這兩個如果不定清楚，後面還是會亂。

⸻

我建議你下一步直接接這兩份其中一個：

A. 寫成「可直接執行的 PostgreSQL SQL 建表稿」
也就是我幫你整理成一份完整建表 SQL，可直接貼到 Supabase 跑

或

B. 做「KPI 定義表 v1.0」
把首頁、商品機會頁、AI 頁面的數字全部定清楚。

⸻

13. v3.1 增補：多語言與登入系統

以下為在不破壞既有結構下，新增的最小可行 schema。

13.1 多語言與語系設定

```sql
create type locale_code as enum (
  'en',
  'zh-Hant',
  'zh-Hans'
);
```

> 預設語言：`en`

若需要集中管理語系，可新增語系設定表：

```sql
create table system_locales (
  code locale_code primary key,
  label text not null,
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_locales_default_single_check
    check ((is_default in (true, false)))
);

insert into system_locales (code, label, is_enabled, is_default)
values
  ('en', 'English', true, true),
  ('zh-Hant', '繁體中文', true, false),
  ('zh-Hans', '简体中文', true, false);
```

13.2 多語言內容資料表

將可翻譯欄位拆成主表（預設英文）+ i18n 子表：

```sql
create table product_style_i18n (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references product_styles(id) on delete cascade,
  locale locale_code not null,
  name text not null,
  short_description text,
  long_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(style_id, locale)
);

create table sku_i18n (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references skus(id) on delete cascade,
  locale locale_code not null,
  display_name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sku_id, locale)
);
```

建議規則：
- `product_styles`、`skus` 主表保留英文欄位作為 fallback。
- UI 讀取語系優先順序：`使用者偏好語言 -> en`。

13.3 登入與角色管理

```sql
create type app_role as enum (
  'admin',
  'store_clerk',
  'store_manager',
  'guest'
);
```

> 角色對應：
> - 管理員：`admin`
> - 店員：`store_clerk`
> - 店經理：`store_manager`
> - 訪客帳號：`guest`

若採 Supabase Auth（建議），可建立使用者 profile 與角色映射：

```sql
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  preferred_locale locale_code not null default 'en',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_role_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  role app_role not null,
  store_id uuid null references stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, role, store_id)
);
```

13.4 RLS/授權建議

- `guest`：僅可讀取公開 demo 資料（不可寫入 events / outcomes / alerts）。
- `store_clerk`：可讀門市資料、可寫入營運流程事件。
- `store_manager`：含店員權限，另可讀取 KPI 與管理類設定。
- `admin`：全域管理。

RLS 建議採「從 JWT claim 解析 role + store scope」策略，避免將授權邏輯散落在 API。

⸻

14. SGTIN-96 解碼規則（v3 固定規格）

14.1 EPC 格式與驗證

- 輸入必須為 **24 碼 Hex**（96 bits）。
- Header 固定驗證為 `00110000`（十進位 `48` / Hex `0x30`，SGTIN-96）。
- 解析欄位：
  - Header：8 bits（bit 0-7）
  - Filter：3 bits（bit 8-10）
  - Partition：3 bits（bit 11-13）
  - Company Prefix：依 partition 決定 bit 長度
  - Item Reference：依 partition 決定 bit 長度
  - Serial：38 bits（bit 58-95）

14.2 Partition 對照表（GS1）

| Partition | Company Prefix Bits | Company Prefix Digits | Item Reference Bits | Item Reference Digits |
|---|---:|---:|---:|---:|
| 0 | 40 | 12 | 4 | 1 |
| 1 | 37 | 11 | 7 | 2 |
| 2 | 34 | 10 | 10 | 3 |
| 3 | 30 | 9 | 14 | 4 |
| 4 | 27 | 8 | 17 | 5 |
| 5 | 24 | 7 | 20 | 6 |
| 6 | 20 | 6 | 24 | 7 |

14.3 輸出欄位規範

- `companyPrefix`：十進位字串，需依 partition 對應 digit 數左補零。
- `itemReference`：十進位字串，需依 partition 對應 digit 數左補零。
- `serial`：十進位字串。
- `partition`：0~6。
- `filter`：0~7。
- `header`：固定 48。

14.4 DB 對應建議

- `items.epc`：保留原始 24 碼 Hex（大寫或小寫需在 API 正規化）。
- 可查詢欄位：
  - `epc_company_prefix`（text）
  - `item_reference`（text）
  - `epc_serial`（text）
  - `epc_partition`（smallint）
  - `epc_filter`（smallint）

14.5 實作一致性要求

- 所有 API 僅可使用共用解碼模組 [`decodeSGTIN96()`](api/sgtin96.js:20)。
- 不得在其他模組維護獨立 partition 切分邏輯。
- 匯入流程與 webhook 流程必須使用同一解碼輸出。
