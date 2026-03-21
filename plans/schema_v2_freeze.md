# RFID Fitting Room Schema v2 凍結稿

## 0. 版本資訊
- 來源：[`plans/archive_v1/schema_v1_freeze.md`](plans/archive_v1/schema_v1_freeze.md)
- 依據：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)、[`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
- 狀態：草案 v2.0

## 1. 命名口徑凍結
- 核心命名
  - 事件時間：`timestamp`
  - EPC 原始值：`epc_data`
  - 區域欄位：`from_zone`、`to_zone`
  - Session 欄位：`entered_at`、`left_at`、`duration_seconds`
  - 轉化欄位：`converted_to_sale`、`sale_time`
- 狀態與事件語意
  - `left_fitting_room` 僅作事件或 session 結束語意，不作 `current_status`
  - `checkout` 為未完成交易狀態
  - `sold` 為完成交易最終狀態
- 角色命名
  - 前台角色：`trial`、`user`、`admin`
  - 系統角色：`service_backend`

## 2. v2 必要資料表
### 2.1 `products`
- 用途：商品主檔
- 主要欄位：`id`、`sku`、`name`、`price`、`image_url`、`epc_company_prefix`、`item_reference`

### 2.2 `product_translations`
- 用途：多語商品名稱
- 主要欄位：`product_id`、`lang`、`name`

### 2.3 `inventory_items`
- 用途：單件 EPC 與商品關聯
- 主要欄位：`epc_data`、`product_id`、`status`

### 2.4 `rfid_events`
- 用途：事件歷史主表
- 主要欄位：`epc_data`、`reader_id`、`event_type`、`event_source`、`from_zone`、`to_zone`、`timestamp`

### 2.5 `fitting_room_presence`
- 用途：試衣間即時在場快照
- 主要欄位：`product_key`、`entered_at`、`last_seen_at`

### 2.6 `fitting_room_sessions`
- 用途：試穿 session 歷史與轉化追蹤
- 主要欄位：`product_key`、`entered_at`、`left_at`、`duration_seconds`、`converted_to_sale`、`sale_time`

### 2.7 補貨建議計算輸入欄位
- `sold_7d` 來源：近 7 日成交事件聚合
- `current_stock` 來源：當前可用庫存
- 公式：`recommended_restock_qty = max(0, sold_7d * 1.2 - current_stock)`

## 3. v2 延後項目
- `zones` 主檔化
- `item_current_states` 獨立快照表
- session 額外欄位完整化
  - `ended_by`
  - `is_overstay`
- 補貨風險等級分層門檻正式欄位

## 4. 遷移基線
- 先確認 v1 表結構可被 v2 流程讀寫
- 若有舊欄位仍被使用，採漸進式遷移策略
- 遷移順序建議
  1. 核心事件與 session 相關欄位
  2. 商品與翻譯欄位對齊
  3. 匯入與 dashboard 所需索引
- 既有 SQL 參考
  - [`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql)
  - [`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql)

## 5. 相容策略
- API 回應錯誤鍵名相容
  - `error` 與 `message` 皆視為錯誤訊息來源
- 舊角色到新角色策略
  - v2 主角色以 `trial`、`user`、`admin` 為準
  - `service_backend` 保留系統內部使用
- 舊資料語意相容
  - 歷史事件中若存在離場語意，映射為事件層，不映射為 `current_status`
- 前後端相容
  - 不新增讀取 API，維持 Supabase 查詢路徑
