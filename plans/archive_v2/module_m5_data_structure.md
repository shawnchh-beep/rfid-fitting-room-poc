# M5 資料結構設計與記錄

依據 [`plans/module_m5_spec.md`](plans/module_m5_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:82)、[`api/rfid-webhook.js`](api/rfid-webhook.js:114) 整理。

> 限制聲明：本文件僅針對 M5 在場快照與 Session 管理所需資料結構，不修改其他模組資料表定義。

## 1. 資料表清單

M5 直接依賴資料表：
- `fitting_room_presence`
- `fitting_room_sessions`

M5 間接使用觸發來源：
- `rfid_events`

## 2. 每張表的欄位設計

### A. `fitting_room_presence`
- `product_key`
- `epc_company_prefix`
- `item_reference`
- `entered_at`
- `last_seen_at`
- `last_reader_id`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:82)

### B. `fitting_room_sessions`
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

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:94)

### C. `rfid_events` 間接欄位
- `epc_data`
- `reader_id`
- `timestamp`
- `event_type`
- `event_source`
- `from_zone`
- `to_zone`

用途：驅動 M5 開關 session 與更新在場快照。

## 3. 主鍵 / 外鍵

### 主鍵
- `fitting_room_presence.product_key`（upsert conflict key）
- `fitting_room_sessions.id`

### 外鍵
- M5 路徑未要求新增資料庫外鍵。
- `product_key` 關聯採業務鍵，不是 DB 外鍵約束。

依據：[`api/rfid-webhook.js`](api/rfid-webhook.js:136)

## 4. 必填欄位

### `fitting_room_presence`
- `product_key`
- `entered_at`
- `last_seen_at`

### `fitting_room_sessions`
- `product_key`
- `entered_at`
- `converted_to_sale`

依據寫入路徑：[`api/rfid-webhook.js`](api/rfid-webhook.js:125)、[`api/rfid-webhook.js`](api/rfid-webhook.js:213)、[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:5)

## 5. 可為空欄位

### `fitting_room_presence`
- `last_reader_id`

### `fitting_room_sessions`
- `sku`
- `left_at`
- `duration_seconds`
- `sale_time`

## 6. 狀態欄位

- `fitting_room_sessions.converted_to_sale`：session 轉化狀態
- `fitting_room_presence` 無獨立狀態欄位，狀態由是否存在該 `product_key` 與時間欄位推導

## 7. 建立時間 / 更新時間

M5 依賴時間欄位：
- `fitting_room_presence.entered_at`
- `fitting_room_presence.last_seen_at`
- `fitting_room_sessions.entered_at`
- `fitting_room_sessions.left_at`
- `fitting_room_sessions.sale_time`

> 本模組不新增統一 `created_at` `updated_at`，因凍結稿未定義。

## 8. 是否需要軟刪除

- M5 不新增軟刪除欄位。
- `fitting_room_presence` 以刪除快照表示離開試衣間，不保留軟刪除標記。

依據：[`api/rfid-webhook.js`](api/rfid-webhook.js:153)

## 9. 資料關聯

- `fitting_room_presence.product_key` 對應 `fitting_room_sessions.product_key`
- `rfid_events` 事件流驅動 presence 與 sessions 的開關行為
- 關聯核心為 `product_key` 與 EPC 解碼後的 `epc_company_prefix item_reference`

## 10. 為什麼這樣設計

- M5 需同時處理「即時在場」與「期間 session」，分表可避免即時資料與歷史期間資料互相污染。
- 使用 `product_key` 作業務鍵，可直接從 EPC 解碼映射到在場與 session 流程。
- 保持 v1 最小欄位集合，不提前導入 `ended_by is_overstay` 延後項，避免跨模組返工。

依據：[`plans/module_m5_spec.md`](plans/module_m5_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:112)

---

## 充足性檢查

### 是否足以支撐前端頁面需求
- 足以支撐前端以 presence 推導商品是否在試衣間、是否離場。
- 對照：[`public/js/main.js`](public/js/main.js:455)

### 是否足以支撐 API 操作
- 足以支撐 webhook 路徑的 upsert presence open close session。
- 對照：[`api/rfid-webhook.js`](api/rfid-webhook.js:387)

### 是否足以支撐報表或查詢
- 足以支撐 M5 範圍的停留時長與 session 基礎查詢。
- 轉化率聚合與 KPI 屬 M6，非 M5 單模組完成項。

### 哪些地方未來容易擴充失敗
- `product_key` 若未有統一格式治理，跨表關聯會失效。
- 未納入 `ended_by is_overstay`，後續若直接加會牽動查詢口徑。
- presence 以刪除表示離場，若未定義審計策略，追溯需求可能不足。

---

## 影響其他模組風險標示

- 若在 M5 變更 `product_key` 邏輯，將直接影響 M4 事件鏈路與 M6 轉化判定。
- 若在 M5 先行加入延後欄位 `ended_by is_overstay`，會影響 M6 M8 驗收口徑一致性。
- 若把 presence 改成保留歷史不刪除，將影響 M8 前端狀態推導邏輯。

