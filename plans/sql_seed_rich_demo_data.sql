-- Rich demo seed data for fitting-room PoC
-- 目標：讓 dashboard / fitting-demo 有更豐富的可視化資料（在場、逾時、結帳、成交、近期事件）
-- 特性：可重複執行（idempotent）、盡量相容不同 schema 版本

BEGIN;

-- ------------------------------------------------------------
-- 0) Seed 範圍：使用目前 DB 已存在、且可解 EPC key 的商品
-- ------------------------------------------------------------
DROP TABLE IF EXISTS tmp_demo_products;
CREATE TEMP TABLE tmp_demo_products AS
SELECT
  p.id AS product_id,
  p.epc_company_prefix,
  p.item_reference,
  CONCAT(p.epc_company_prefix, '::', p.item_reference) AS product_key,
  COALESCE(NULLIF(TRIM(p.sku), ''), CONCAT('SKU-', p.id::text)) AS sku,
  COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(p.name_en), ''), CONCAT('Product #', p.id::text)) AS product_name,
  ROW_NUMBER() OVER (ORDER BY p.id) AS rn
FROM public.products p
WHERE NULLIF(TRIM(p.epc_company_prefix), '') IS NOT NULL
  AND NULLIF(TRIM(p.item_reference), '') IS NOT NULL
ORDER BY p.id
LIMIT 12;

DROP TABLE IF EXISTS tmp_demo_inventory;
CREATE TEMP TABLE tmp_demo_inventory AS
SELECT DISTINCT ON (i.product_id)
  i.id AS inventory_id,
  i.product_id,
  i.epc_data,
  COALESCE(NULLIF(TRIM(i.sku), ''), tp.sku) AS sku,
  tp.epc_company_prefix,
  tp.item_reference,
  tp.product_key,
  tp.rn
FROM tmp_demo_products tp
JOIN public.inventory_items i ON i.product_id = tp.product_id
WHERE NULLIF(TRIM(i.epc_data), '') IS NOT NULL
ORDER BY i.product_id, i.id;

-- 若 inventory 太少，直接中止，避免插入半殘 demo 資料
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM tmp_demo_inventory;
  IF v_cnt < 6 THEN
    RAISE EXCEPTION 'rich demo seed requires >= 6 inventory_items mapped from products (current: %)', v_cnt;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1) 先清掉本次 seed 會覆蓋的存在感資料（只限選中的商品）
-- ------------------------------------------------------------
DELETE FROM public.fitting_room_presence fp
WHERE fp.product_key IN (SELECT product_key FROM tmp_demo_inventory);

DELETE FROM public.fitting_room_sessions fs
WHERE fs.product_key IN (SELECT product_key FROM tmp_demo_inventory);

-- rfid_events：優先刪除舊 seed tag；若 schema 無 metadata/event_source，退而刪除同 EPC 且近 72 小時事件
DO $$
DECLARE
  has_metadata boolean;
  has_event_source boolean;
  sql_text text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'metadata'
  ) INTO has_metadata;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'event_source'
  ) INTO has_event_source;

  IF has_metadata THEN
    sql_text := $q$
      DELETE FROM public.rfid_events re
      WHERE re.epc_data IN (SELECT epc_data FROM tmp_demo_inventory)
        AND COALESCE(re.metadata->>'seed_tag', '') = 'rich_demo_v1'
    $q$;
  ELSIF has_event_source THEN
    sql_text := $q$
      DELETE FROM public.rfid_events re
      WHERE re.epc_data IN (SELECT epc_data FROM tmp_demo_inventory)
        AND COALESCE(re.event_source, '') = 'system'
        AND re.timestamp >= (NOW() - INTERVAL '72 hours')
        AND COALESCE(re.event_type, re.state, '') IN (
          'enter_fitting_room',
          'move_to_checkout',
          'sale_completed',
          'left_fitting_room'
        )
    $q$;
  ELSE
    sql_text := $q$
      DELETE FROM public.rfid_events re
      WHERE re.epc_data IN (SELECT epc_data FROM tmp_demo_inventory)
        AND re.timestamp >= (NOW() - INTERVAL '72 hours')
    $q$;
  END IF;

  EXECUTE sql_text;
END $$;

-- ------------------------------------------------------------
-- 2) 建立「有層次」庫存狀態分布（ACTIVE / FITTING_ROOM / CHECKOUT / SOLD）
-- ------------------------------------------------------------
UPDATE public.inventory_items i
SET status = CASE
  WHEN tdi.rn IN (1, 2, 3, 4) THEN 'FITTING_ROOM'
  WHEN tdi.rn IN (5, 6) THEN 'CHECKOUT'
  WHEN tdi.rn IN (7) THEN 'SOLD'
  ELSE 'ACTIVE'
END,
updated_at = NOW()
FROM tmp_demo_inventory tdi
WHERE i.id = tdi.inventory_id;

-- ------------------------------------------------------------
-- 3) 在場資料：4 件在試衣間（其中 2 件長時間停留，可觸發 abnormal）
-- ------------------------------------------------------------
DROP TABLE IF EXISTS tmp_demo_presence_rows;
CREATE TEMP TABLE tmp_demo_presence_rows AS
SELECT
  tdi.product_key,
  tdi.epc_company_prefix,
  tdi.item_reference,
  CASE
    WHEN tdi.rn = 1 THEN NOW() - INTERVAL '22 minutes'
    WHEN tdi.rn = 2 THEN NOW() - INTERVAL '16 minutes'
    WHEN tdi.rn = 3 THEN NOW() - INTERVAL '8 minutes'
    ELSE NOW() - INTERVAL '4 minutes'
  END AS entered_at,
  NOW() - INTERVAL '3 seconds' AS last_seen_at,
  CONCAT('FITTING_ROOM_ANTENNA_', ((tdi.rn - 1) % 3) + 1) AS last_reader_id
FROM tmp_demo_inventory tdi
WHERE tdi.rn IN (1, 2, 3, 4);

DO $$
DECLARE
  has_cp boolean;
  has_item_ref boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_presence' AND column_name = 'epc_company_prefix'
  ) INTO has_cp;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_presence' AND column_name = 'item_reference'
  ) INTO has_item_ref;

  IF has_cp AND has_item_ref THEN
    INSERT INTO public.fitting_room_presence (
      product_key,
      epc_company_prefix,
      item_reference,
      entered_at,
      last_seen_at,
      last_reader_id
    )
    SELECT
      product_key,
      epc_company_prefix,
      item_reference,
      entered_at,
      last_seen_at,
      last_reader_id
    FROM tmp_demo_presence_rows;
  ELSE
    INSERT INTO public.fitting_room_presence (
      product_key,
      entered_at,
      last_seen_at,
      last_reader_id
    )
    SELECT
      product_key,
      entered_at,
      last_seen_at,
      last_reader_id
    FROM tmp_demo_presence_rows;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4) Session 歷史：開啟中 + 已離場 + 轉單，方便 KPI/漏斗展示
-- ------------------------------------------------------------
DROP TABLE IF EXISTS tmp_demo_sessions;
CREATE TEMP TABLE tmp_demo_sessions AS
SELECT
  tdi.product_key,
  tdi.epc_company_prefix,
  tdi.item_reference,
  tdi.sku,
  CASE
    WHEN tdi.rn = 1 THEN NOW() - INTERVAL '22 minutes'
    WHEN tdi.rn = 2 THEN NOW() - INTERVAL '16 minutes'
    WHEN tdi.rn = 3 THEN NOW() - INTERVAL '8 minutes'
    WHEN tdi.rn = 4 THEN NOW() - INTERVAL '4 minutes'
    WHEN tdi.rn = 5 THEN NOW() - INTERVAL '47 minutes'
    WHEN tdi.rn = 6 THEN NOW() - INTERVAL '35 minutes'
    WHEN tdi.rn = 7 THEN NOW() - INTERVAL '62 minutes'
    ELSE NOW() - INTERVAL '19 minutes'
  END AS entered_at,
  CASE
    WHEN tdi.rn IN (1, 2, 3, 4) THEN NULL
    WHEN tdi.rn = 5 THEN NOW() - INTERVAL '25 minutes'
    WHEN tdi.rn = 6 THEN NOW() - INTERVAL '10 minutes'
    WHEN tdi.rn = 7 THEN NOW() - INTERVAL '30 minutes'
    ELSE NOW() - INTERVAL '7 minutes'
  END AS left_at,
  CASE
    WHEN tdi.rn IN (1, 2, 3, 4) THEN NULL
    WHEN tdi.rn = 5 THEN 22 * 60
    WHEN tdi.rn = 6 THEN 25 * 60
    WHEN tdi.rn = 7 THEN 32 * 60
    ELSE 12 * 60
  END AS duration_seconds,
  (tdi.rn IN (6, 7)) AS converted_to_sale,
  CASE
    WHEN tdi.rn = 6 THEN NOW() - INTERVAL '9 minutes'
    WHEN tdi.rn = 7 THEN NOW() - INTERVAL '28 minutes'
    ELSE NULL
  END AS sale_time
FROM tmp_demo_inventory tdi
WHERE tdi.rn <= 9;

DO $$
DECLARE
  has_left_at boolean;
  has_exited_at boolean;
  has_cp boolean;
  has_item_ref boolean;
  has_sku boolean;
  has_duration boolean;
  has_sale_time boolean;
  sql_text text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'left_at'
  ) INTO has_left_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'exited_at'
  ) INTO has_exited_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'epc_company_prefix'
  ) INTO has_cp;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'item_reference'
  ) INTO has_item_ref;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'sku'
  ) INTO has_sku;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'duration_seconds'
  ) INTO has_duration;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'sale_time'
  ) INTO has_sale_time;

  sql_text := 'INSERT INTO public.fitting_room_sessions ('
    || 'product_key, entered_at, converted_to_sale'
    || CASE WHEN has_cp THEN ', epc_company_prefix' ELSE '' END
    || CASE WHEN has_item_ref THEN ', item_reference' ELSE '' END
    || CASE WHEN has_sku THEN ', sku' ELSE '' END
    || CASE WHEN has_left_at THEN ', left_at' WHEN has_exited_at THEN ', exited_at' ELSE '' END
    || CASE WHEN has_duration THEN ', duration_seconds' ELSE '' END
    || CASE WHEN has_sale_time THEN ', sale_time' ELSE '' END
    || ') SELECT '
    || 'product_key, entered_at, converted_to_sale'
    || CASE WHEN has_cp THEN ', epc_company_prefix' ELSE '' END
    || CASE WHEN has_item_ref THEN ', item_reference' ELSE '' END
    || CASE WHEN has_sku THEN ', sku' ELSE '' END
    || CASE WHEN has_left_at OR has_exited_at THEN ', left_at' ELSE '' END
    || CASE WHEN has_duration THEN ', duration_seconds' ELSE '' END
    || CASE WHEN has_sale_time THEN ', sale_time' ELSE '' END
    || ' FROM tmp_demo_sessions';

  EXECUTE sql_text;
END $$;

-- ------------------------------------------------------------
-- 5) 建立近期事件流（進房、離房、到結帳、成交）
-- ------------------------------------------------------------
DROP TABLE IF EXISTS tmp_demo_events;
CREATE TEMP TABLE tmp_demo_events (
  epc_data text,
  reader_id text,
  ts timestamptz,
  event_type text,
  event_source text,
  from_zone text,
  to_zone text,
  state text,
  metadata jsonb
);

-- 目前在試衣間的 4 件：都有 enter，其中 2 件時間較久
INSERT INTO tmp_demo_events (epc_data, reader_id, ts, event_type, event_source, from_zone, to_zone, state, metadata)
SELECT
  tdi.epc_data,
  CONCAT('FITTING_ROOM_ANTENNA_', ((tdi.rn - 1) % 3) + 1),
  NOW() - CASE
    WHEN tdi.rn = 1 THEN INTERVAL '22 minutes'
    WHEN tdi.rn = 2 THEN INTERVAL '16 minutes'
    WHEN tdi.rn = 3 THEN INTERVAL '8 minutes'
    ELSE INTERVAL '4 minutes'
  END,
  'enter_fitting_room',
  'system',
  'sales_floor',
  'fitting_room',
  'fitting_room',
  jsonb_build_object('seed_tag', 'rich_demo_v1', 'scenario', 'active_fitting', 'rn', tdi.rn)
FROM tmp_demo_inventory tdi
WHERE tdi.rn IN (1, 2, 3, 4);

-- 2 件移到 checkout（對應 checkout panel）
INSERT INTO tmp_demo_events (epc_data, reader_id, ts, event_type, event_source, from_zone, to_zone, state, metadata)
SELECT
  tdi.epc_data,
  'CHECKOUT_ANTENNA_1',
  NOW() - CASE WHEN tdi.rn = 5 THEN INTERVAL '25 minutes' ELSE INTERVAL '10 minutes' END,
  'move_to_checkout',
  'system',
  'fitting_room',
  'checkout',
  'checkout',
  jsonb_build_object('seed_tag', 'rich_demo_v1', 'scenario', 'checkout_queue', 'rn', tdi.rn)
FROM tmp_demo_inventory tdi
WHERE tdi.rn IN (5, 6);

-- 1 件成交（sale_completed）
INSERT INTO tmp_demo_events (epc_data, reader_id, ts, event_type, event_source, from_zone, to_zone, state, metadata)
SELECT
  tdi.epc_data,
  'SOLD_ANTENNA_1',
  NOW() - INTERVAL '28 minutes',
  'sale_completed',
  'system',
  'checkout',
  'sold',
  'sold',
  jsonb_build_object('seed_tag', 'rich_demo_v1', 'scenario', 'converted_sale', 'rn', tdi.rn)
FROM tmp_demo_inventory tdi
WHERE tdi.rn = 7;

-- 2 件離開試衣間回到銷售層（形成完整路徑）
INSERT INTO tmp_demo_events (epc_data, reader_id, ts, event_type, event_source, from_zone, to_zone, state, metadata)
SELECT
  tdi.epc_data,
  CONCAT('RACK_ANTENNA_', ((tdi.rn - 7) % 2) + 1),
  NOW() - CASE WHEN tdi.rn = 8 THEN INTERVAL '12 minutes' ELSE INTERVAL '7 minutes' END,
  'left_fitting_room',
  'system',
  'fitting_room',
  'sales_floor',
  'sales_floor',
  jsonb_build_object('seed_tag', 'rich_demo_v1', 'scenario', 'return_to_floor', 'rn', tdi.rn)
FROM tmp_demo_inventory tdi
WHERE tdi.rn IN (8, 9);

DO $$
DECLARE
  has_event_type boolean;
  has_event_source boolean;
  has_from_zone boolean;
  has_to_zone boolean;
  has_metadata boolean;
  has_state boolean;
  sql_text text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'event_type'
  ) INTO has_event_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'event_source'
  ) INTO has_event_source;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'from_zone'
  ) INTO has_from_zone;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'to_zone'
  ) INTO has_to_zone;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'metadata'
  ) INTO has_metadata;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'state'
  ) INTO has_state;

  sql_text := 'INSERT INTO public.rfid_events ('
    || 'epc_data, reader_id, timestamp'
    || CASE WHEN has_state THEN ', state' ELSE '' END
    || CASE WHEN has_event_type THEN ', event_type' ELSE '' END
    || CASE WHEN has_event_source THEN ', event_source' ELSE '' END
    || CASE WHEN has_from_zone THEN ', from_zone' ELSE '' END
    || CASE WHEN has_to_zone THEN ', to_zone' ELSE '' END
    || CASE WHEN has_metadata THEN ', metadata' ELSE '' END
    || ') SELECT '
    || 'epc_data, reader_id, ts'
    || CASE WHEN has_state THEN ', state' ELSE '' END
    || CASE WHEN has_event_type THEN ', event_type' ELSE '' END
    || CASE WHEN has_event_source THEN ', event_source' ELSE '' END
    || CASE WHEN has_from_zone THEN ', from_zone' ELSE '' END
    || CASE WHEN has_to_zone THEN ', to_zone' ELSE '' END
    || CASE WHEN has_metadata THEN ', metadata' ELSE '' END
    || ' FROM tmp_demo_events';

  EXECUTE sql_text;
END $$;

COMMIT;

-- ------------------------------------------------------------
-- 6) Verification：執行後立即檢查
-- ------------------------------------------------------------

-- 0. rfid_events constraint 診斷（確認 event_source 白名單）
SELECT
  c.conname,
  pg_get_constraintdef(c.oid) AS constraint_def
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'rfid_events'
  AND c.contype = 'c'
ORDER BY c.conname;

-- A. 本次 seed 取樣商品/件數
SELECT
  (SELECT COUNT(*) FROM tmp_demo_products) AS demo_products_count,
  (SELECT COUNT(*) FROM tmp_demo_inventory) AS demo_inventory_count;

-- B. 庫存狀態分布（預期：FITTING_ROOM >= 4, CHECKOUT >= 2, SOLD >= 1）
SELECT
  i.status,
  COUNT(*) AS cnt
FROM public.inventory_items i
JOIN tmp_demo_inventory tdi ON tdi.inventory_id = i.id
GROUP BY i.status
ORDER BY cnt DESC, i.status;

-- C. 試衣間在場（預期 4）
SELECT COUNT(*) AS fitting_presence_count
FROM public.fitting_room_presence fp
WHERE fp.product_key IN (SELECT product_key FROM tmp_demo_inventory);

-- D. 今日 session（開啟中/已離場/成交）
DROP TABLE IF EXISTS tmp_demo_verify_sessions;
CREATE TEMP TABLE tmp_demo_verify_sessions (
  total_sessions bigint,
  open_sessions bigint,
  closed_sessions bigint,
  converted_sessions bigint
);

DO $$
DECLARE
  has_left_at boolean;
  has_exited_at boolean;
  left_col text;
  sql_text text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'left_at'
  ) INTO has_left_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fitting_room_sessions' AND column_name = 'exited_at'
  ) INTO has_exited_at;

  left_col := CASE
    WHEN has_left_at THEN 'left_at'
    WHEN has_exited_at THEN 'exited_at'
    ELSE 'NULL'
  END;

  sql_text := 'INSERT INTO tmp_demo_verify_sessions '
    || 'SELECT '
    || 'COUNT(*) AS total_sessions, '
    || 'SUM(CASE WHEN ' || left_col || ' IS NULL THEN 1 ELSE 0 END) AS open_sessions, '
    || 'SUM(CASE WHEN ' || left_col || ' IS NOT NULL THEN 1 ELSE 0 END) AS closed_sessions, '
    || 'SUM(CASE WHEN converted_to_sale THEN 1 ELSE 0 END) AS converted_sessions '
    || 'FROM public.fitting_room_sessions fs '
    || 'WHERE fs.product_key IN (SELECT product_key FROM tmp_demo_inventory)';

  EXECUTE sql_text;
END $$;

SELECT * FROM tmp_demo_verify_sessions;

-- E. 近 2 小時事件（預期可看到 enter / left / checkout / sale）
DROP TABLE IF EXISTS tmp_demo_verify_events;
CREATE TEMP TABLE tmp_demo_verify_events (
  event_kind text,
  cnt bigint
);

DO $$
DECLARE
  has_event_type boolean;
  has_state boolean;
  event_expr text;
  sql_text text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'event_type'
  ) INTO has_event_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rfid_events' AND column_name = 'state'
  ) INTO has_state;

  event_expr := CASE
    WHEN has_event_type AND has_state THEN 'COALESCE(event_type, state, ''unknown'')'
    WHEN has_event_type THEN 'COALESCE(event_type, ''unknown'')'
    WHEN has_state THEN 'COALESCE(state, ''unknown'')'
    ELSE '''unknown'''
  END;

  sql_text := 'INSERT INTO tmp_demo_verify_events '
    || 'SELECT ' || event_expr || ' AS event_kind, COUNT(*) AS cnt '
    || 'FROM public.rfid_events re '
    || 'WHERE re.epc_data IN (SELECT epc_data FROM tmp_demo_inventory) '
    || 'AND re.timestamp >= (NOW() - INTERVAL ''2 hours'') '
    || 'GROUP BY ' || event_expr || ' '
    || 'ORDER BY cnt DESC, event_kind';

  EXECUTE sql_text;
END $$;

SELECT * FROM tmp_demo_verify_events;

-- ------------------------------------------------------------
-- 預期畫面（人工檢查）
-- 1) Dashboard：abnormal/active KPI 不為 0，且可見 fitting 與 checkout 分布
-- 2) Fitting Demo：
--    - Rooms 至少 4 件（其中 2 件停留時間較長）
--    - Checkout 有 2 筆待結帳
--    - Recent Events 可看到 enter_fitting_room / move_to_checkout / sale_completed / left_fitting_room
-- ------------------------------------------------------------
