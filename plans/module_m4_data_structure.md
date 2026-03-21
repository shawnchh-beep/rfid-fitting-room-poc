# M4 資料結構設計與記錄

依據 [`plans/module_m4_spec.md`](plans/module_m4_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:64)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`api/rfid-webhook.js`](api/rfid-webhook.js:279) 整理。

> 限制聲明：本文件僅針對 M4 事件接收與標準化所需資料結構，不改動其他模組資料表定義。

## 1. 資料表清單

M4 直接依賴資料表：
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

## 2. 每張表的欄位設計

### A. `rfid_events`
- `id`
- `epc_data`
- `reader_id`
- `state`
- `timestamp`
- `event_type`
- `event_source`
- `from_zone`
- `to_zone`
- `metadata`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:64)、[`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:5)

### B. `fitting_room_presence`
- `product_key`
- `epc_company_prefix`
- `item_reference`
- `entered_at`
- `last_seen_at`
- `last_reader_id`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:82)

### C. `fitting_room_sessions`
- `id`
- `product_key`
- `epc_company_prefix`
- `item_reference`
- `sku`
- `entered_at`
- `left_at`
- `duration_seconds`
- `converted_to_sale`
- `sale_time`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:94)、[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:4)

## 3. 主鍵 / 外鍵

### 主鍵
- `rfid_events.id`
- `fitting_room_sessions.id`
- `fitting_room_presence.product_key` 作為 onConflict 業務主鍵使用

### 外鍵
- M4 路徑內未要求新增外鍵。
- `product_key` 關聯採業務鍵，不是資料庫外鍵。

依據：[`api/rfid-webhook.js`](api/rfid-webhook.js:136)

## 4. 必填欄位

### `rfid_events`
- `epc_data`
- `reader_id`
- `timestamp`
- `state`

### `fitting_room_presence`
- `product_key`
- `entered_at`
- `last_seen_at`

### `fitting_room_sessions`
- `product_key`
- `entered_at`
- `converted_to_sale`

參照寫入路徑：[`api/rfid-webhook.js`](api/rfid-webhook.js:370)、[`api/rfid-webhook.js`](api/rfid-webhook.js:125)、[`api/rfid-webhook.js`](api/rfid-webhook.js:213)

## 5. 可為空欄位

### `rfid_events`
- `event_type`
- `event_source`
- `from_zone`
- `to_zone`
- `metadata`

### `fitting_room_presence`
- `last_reader_id`

### `fitting_room_sessions`
- `sku`
- `left_at`
- `duration_seconds`
- `sale_time`

相容說明：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:129)

## 6. 狀態欄位

- `rfid_events.state`：現行事件狀態欄位
- `rfid_events.event_type`：事件語意狀態
- `rfid_events.event_source`：事件來源狀態
- `fitting_room_sessions.converted_to_sale`：轉化狀態

## 7. 建立時間 / 更新時間

M4 依賴時間欄位如下：
- `rfid_events.timestamp`
- `fitting_room_presence.entered_at`
- `fitting_room_presence.last_seen_at`
- `fitting_room_sessions.entered_at`
- `fitting_room_sessions.left_at`
- `fitting_room_sessions.sale_time`

> 未新增統一 `created_at` `updated_at`，因凍結稿未定義。

## 8. 是否需要軟刪除

- M4 不新增軟刪除欄位。
- `fitting_room_presence` 使用刪除表示離場快照清除：[`api/rfid-webhook.js`](api/rfid-webhook.js:153)

## 9. 資料關聯

- `rfid_events.epc_data` 提供事件追蹤鍵
- `fitting_room_presence.product_key` 與 `fitting_room_sessions.product_key` 構成在場與 session 關聯
- `rfid_events` 作為 M4 主事件來源，presence 與 sessions 為衍生快照與期間資料

## 10. 為什麼這樣設計

- M4 核心是事件標準化與寫入，不應擴充到商品主檔或分析模型。
- 使用 `rfid_events` 承接標準事件欄位，並以 presence sessions 保存即時與期間狀態，符合現有 webhook 流程。
- 保持 legacy fallback 可在舊 schema 環境持續運作，降低遷移中斷風險。

依據：[`api/rfid-webhook.js`](api/rfid-webhook.js:45)

---

## 充足性檢查

### 是否足以支撐前端頁面需求
- 足以支撐前端拖拉與事件流顯示所需事件欄位。
- 對照：[`public/js/main.js`](public/js/main.js:662)、[`public/js/main.js`](public/js/main.js:813)

### 是否足以支撐 API 操作
- 足以支撐 [`api/rfid-webhook.js`](api/rfid-webhook.js:279) 的標準化、debounce、寫入、回應。

### 是否足以支撐報表或查詢
- 足以支撐 M4 範圍內事件查詢與基本追蹤。
- 進階轉化與 KPI 聚合依賴 M5 M6，不屬 M4 單獨完成項。

### 哪些地方未來容易擴充失敗
- `from_zone` `to_zone` 目前為文字欄位，未來若主檔化需遷移映射。
- `product_key` 屬業務鍵，若格式調整將影響 presence session 關聯查詢。
- `event_type` 推導規則若多入口不一致，事件語意會分叉。

---

## 影響其他模組風險標示

- 若在 M4 改動 `event_type` 命名或推導口徑，會影響 M6 KPI 與 M8 事件流可讀性。
- 若在 M4 取消 legacy fallback，可能影響 M9 部署驗證在舊環境的可用性。
- 若在 M4 變更 `product_key` 關聯策略，將直接影響 M5 session 管理。

