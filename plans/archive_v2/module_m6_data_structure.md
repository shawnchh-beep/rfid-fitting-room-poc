# M6 資料結構設計與記錄

依據 [`plans/module_m6_spec.md`](plans/module_m6_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:94)、[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:1)、[`api/rfid-webhook.js`](api/rfid-webhook.js:439) 整理。

> 限制聲明：本文件僅針對 M6 轉化計算與 KPI 引擎所需資料結構，不修改其他模組資料表定義。

## 1. 資料表清單

M6 直接依賴資料表：
- `fitting_room_sessions`
- `rfid_events`

## 2. 每張表的欄位設計

### A. `fitting_room_sessions`
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

### B. `rfid_events`
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

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:64)

## 3. 主鍵 / 外鍵

### 主鍵
- `fitting_room_sessions.id`
- `rfid_events.id`

### 外鍵
- M6 路徑未要求新增資料庫外鍵。
- 轉化判定依 `product_key` 與時間窗口，屬業務鍵關聯。

## 4. 必填欄位

### `fitting_room_sessions`
- `product_key`
- `entered_at`
- `converted_to_sale`

### `rfid_events`
- `epc_data`
- `reader_id`
- `timestamp`

依據：[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:5)、[`api/rfid-webhook.js`](api/rfid-webhook.js:309)

## 5. 可為空欄位

### `fitting_room_sessions`
- `sku`
- `left_at`
- `duration_seconds`
- `sale_time`

### `rfid_events`
- `event_type`
- `event_source`
- `from_zone`
- `to_zone`
- `metadata`

## 6. 狀態欄位

- `fitting_room_sessions.converted_to_sale`：M6 核心狀態欄位
- `rfid_events.event_type`：用於判定 `sale_completed` 觸發路徑

## 7. 建立時間 / 更新時間

M6 依賴時間欄位：
- `fitting_room_sessions.entered_at`
- `fitting_room_sessions.left_at`
- `fitting_room_sessions.sale_time`
- `rfid_events.timestamp`

> 本模組不新增統一 `created_at` `updated_at`，因凍結稿未定義。

## 8. 是否需要軟刪除

- M6 不新增軟刪除欄位。
- 理由：轉化計算依賴歷史 session 與事件，v1 未定義軟刪除口徑，先保持查詢一致性。

## 9. 資料關聯

- 轉化判定主關聯：`fitting_room_sessions.product_key` 對應事件路徑中的同商品鍵
- 觸發來源：`rfid_events.event_type = sale_completed`
- 判定條件：`sale_time - left_at <= 10 分鐘`

依據：[`api/rfid-webhook.js`](api/rfid-webhook.js:227)、[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:304)

## 10. 為什麼這樣設計

- M6 的核心是「以 session 為分母、以轉化標記為分子」的簡化模型。
- 將轉化結果寫回 `fitting_room_sessions` 可避免每次即時計算都重掃全事件。
- 保持 `rfid_events` 作觸發來源，維持事件可追溯性。

依據：[`plans/module_m6_spec.md`](plans/module_m6_spec.md:1)、[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:35)

---

## 充足性檢查

### 是否足以支撐前端頁面需求
- 足以支撐前端 KPI 所需今日試穿 今日成交 今日轉化率。
- 對照：[`public/js/main.js`](public/js/main.js:532)

### 是否足以支撐 API 操作
- 足以支撐 webhook `sale_completed` 觸發轉化標記與回應 conversion 區塊。
- 對照：[`api/rfid-webhook.js`](api/rfid-webhook.js:439)

### 是否足以支撐報表或查詢
- 足以支撐 v1 轉化率基礎查詢與近期間統計。
- 對照：[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:35)

### 哪些地方未來容易擴充失敗
- `product_key` 業務鍵若變更格式，轉化查詢會失效。
- v1 不處理跨商品歸因，若直接擴充多商品模型會牽動分母分子口徑重算。
- 今日統計時區未明文定義，跨時區部署可能產生口徑差異。

---

## 影響其他模組風險標示

- 若調整 `converted_to_sale` 寫回時機，將影響 M8 KPI 顯示一致性。
- 若改動 `sale_completed` 事件判定條件，會影響 M4 事件語意與 M7 操作預期。
- 若導入新歸因模型而未版本化，會影響既有驗收基準 [`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:79)。

