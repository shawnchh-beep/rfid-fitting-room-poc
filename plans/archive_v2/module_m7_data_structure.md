# M7 資料結構設計與記錄

依據 [`plans/module_m7_spec.md`](plans/module_m7_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`public/js/main.js`](public/js/main.js:473) 整理。

> 限制聲明：本文件僅針對 M7 前台互動看板所需資料結構，不修改其他模組資料表定義。

## 1. 資料表清單

M7 讀取與操作依賴資料表：
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

## 2. 每張表的欄位設計

### A. `products`
- `id`
- `epc_company_prefix`
- `item_reference`
- `name`
- `name_en`
- `description_en`
- `sku`
- `size`
- `color`
- `image_url`
- `price`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:26)

### B. `product_translations`
- `product_id`
- `locale`
- `name`
- `description`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:43)

### C. `inventory_items`
- `id`
- `epc_data`
- `product_id`
- `sku`
- `status`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:53)

### D. `rfid_events`
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

### E. `fitting_room_presence`
- `product_key`
- `epc_company_prefix`
- `item_reference`
- `entered_at`
- `last_seen_at`
- `last_reader_id`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:82)

### F. `fitting_room_sessions`
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

## 3. 主鍵 / 外鍵

### 主鍵
- `products.id`
- `inventory_items.id`
- `rfid_events.id`
- `fitting_room_sessions.id`
- `fitting_room_presence.product_key` 作為 upsert 關鍵

### 外鍵
- `product_translations.product_id -> products.id`
- `inventory_items.product_id -> products.id`

### M7 關聯注意
- 看板狀態匹配主要以 `product_key` 與事件解碼匹配，不是完整外鍵鏈。

## 4. 必填欄位

> 以 M7 畫面渲染與事件同步最小需求為準。

- `products`：`epc_company_prefix`、`item_reference`、`name_en`
- `rfid_events`：`epc_data`、`reader_id`、`timestamp`
- `fitting_room_presence`：`product_key`、`entered_at`、`last_seen_at`
- `fitting_room_sessions`：`product_key`、`entered_at`、`converted_to_sale`

參照：[`public/js/main.js`](public/js/main.js:419)、[`api/rfid-webhook.js`](api/rfid-webhook.js:370)

## 5. 可為空欄位

- `products`：`description_en`、`sku`、`size`、`color`、`image_url`、`price`
- `product_translations`：`name`、`description`
- `inventory_items`：`sku`
- `rfid_events`：`event_type`、`event_source`、`from_zone`、`to_zone`、`metadata`
- `fitting_room_sessions`：`left_at`、`duration_seconds`、`sale_time`

## 6. 狀態欄位

- `inventory_items.status`
- `rfid_events.state`
- `rfid_events.event_type`
- `rfid_events.event_source`
- `fitting_room_sessions.converted_to_sale`

## 7. 建立時間 / 更新時間

M7 實際依賴時間欄位：
- `rfid_events.timestamp`
- `fitting_room_presence.entered_at`
- `fitting_room_presence.last_seen_at`
- `fitting_room_sessions.entered_at`
- `fitting_room_sessions.left_at`

> 不新增 `created_at` `updated_at`，因現有凍結稿未定義統一策略。

## 8. 是否需要軟刪除

- M7 不新增軟刪除欄位。
- 前台狀態由事件與 presence 即時推導，不依賴軟刪除語意。

## 9. 資料關聯

- `products` 與 `product_translations` 透過 `product_id` 關聯
- `products` 與 `inventory_items` 透過 `product_id` 關聯
- `rfid_events.epc_data` 與商品鍵映射推導看板狀態
- `fitting_room_presence.product_key` 提供試衣間在場優先判定
- `fitting_room_sessions` 提供轉化與 KPI 支援

## 10. 為什麼這樣設計

- M7 是前台互動層，需同時讀「商品資訊」與「事件狀態」兩類資料。
- 以 `products + translations` 支撐可讀展示，以 `rfid_events + presence` 支撐即時狀態推導。
- 不在 M7 新增資料表，可避免與 M2 邊界重疊並降低返工。

依據：[`plans/module_m7_spec.md`](plans/module_m7_spec.md:1)、[`public/js/main.js`](public/js/main.js:473)

---

## 充足性檢查

### 是否足以支撐前端頁面需求
- 足以支撐三欄看板、商品卡、圖片、SKU 優先顯示、事件流回饋。
- 對照：[`public/index.html`](public/index.html:20)、[`public/js/main.js`](public/js/main.js:621)

### 是否足以支撐 API 操作
- 足以支撐 M7 透過 [`api/rfid-webhook.js`](api/rfid-webhook.js:279) 進行拖拉與銷售同步。

### 是否足以支撐報表或查詢
- 足以支撐 M7 需要的即時看板查詢。
- 進階報表與排行屬 M8 M6 範圍，不由 M7 單獨完成。

### 哪些地方未來容易擴充失敗
- `product_key` 與 EPC 映射若變更，前台狀態匹配會失準。
- `from_zone to_zone` 目前為文字欄位，未來若外鍵化需調整顯示映射。
- 未定義多人同時拖拉衝突資料策略時，前台狀態一致性容易出問題。

---

## 影響其他模組風險標示

- 若調整 M7 對 `event_type` 映射，將影響 M4 事件一致性與 M6 KPI 計算。
- 若調整 `products` 關鍵欄位命名，將影響 M3 匯入與 M8 展示。
- 若在 M7 增加新狀態欄位而未經 M2 凍結，會破壞模組邊界。

