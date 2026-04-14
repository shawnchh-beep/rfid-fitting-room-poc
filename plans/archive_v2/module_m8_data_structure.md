# M8 資料結構設計與記錄

依據 [`plans/module_m8_spec.md`](plans/module_m8_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:79)、[`public/js/main.js`](public/js/main.js:752) 整理。

> 限制聲明：本文件僅針對 M8 Dashboard 與事件流檢視所需資料結構，不修改其他模組資料表定義。

## 1. 資料表清單

M8 讀取依賴資料表：
- `products`
- `product_translations`
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

### C. `rfid_events`
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

### D. `fitting_room_presence`
- `product_key`
- `epc_company_prefix`
- `item_reference`
- `entered_at`
- `last_seen_at`
- `last_reader_id`

來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:82)

### E. `fitting_room_sessions`
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
- `rfid_events.id`
- `fitting_room_sessions.id`
- `fitting_room_presence.product_key` 作為即時快照鍵

### 外鍵
- `product_translations.product_id -> products.id`

### 關聯補充
- M8 前端匹配常用業務鍵 `product_key` 與事件解碼結果，不完全依賴資料庫外鍵。

## 4. 必填欄位

> 以 M8 查詢與渲染最小需求為準。

- `products`：`id`、`epc_company_prefix`、`item_reference`
- `product_translations`：`product_id`、`locale`
- `rfid_events`：`epc_data`、`reader_id`、`timestamp`
- `fitting_room_presence`：`product_key`、`entered_at`、`last_seen_at`
- `fitting_room_sessions`：`id`、`product_key`、`entered_at`、`converted_to_sale`

參照讀取流程：[`public/js/main.js`](public/js/main.js:851)

## 5. 可為空欄位

- `products`：`description_en`、`sku`、`size`、`color`、`image_url`、`price`
- `product_translations`：`name`、`description`
- `rfid_events`：`event_type`、`event_source`、`from_zone`、`to_zone`、`metadata`
- `fitting_room_presence`：`last_reader_id`
- `fitting_room_sessions`：`left_at`、`duration_seconds`、`sale_time`、`sku`

## 6. 狀態欄位

- `rfid_events.state`
- `rfid_events.event_type`
- `rfid_events.event_source`
- `fitting_room_sessions.converted_to_sale`

## 7. 建立時間 / 更新時間

M8 實際依賴時間欄位：
- `rfid_events.timestamp`
- `fitting_room_presence.entered_at`
- `fitting_room_presence.last_seen_at`
- `fitting_room_sessions.entered_at`
- `fitting_room_sessions.left_at`
- `fitting_room_sessions.sale_time`

> 不新增統一 `created_at` `updated_at`，因現行凍結稿未定義。

## 8. 是否需要軟刪除

- M8 不新增軟刪除欄位。
- Dashboard 為即時檢視，主要依賴現況與事件歷史，不依賴軟刪除語意。

## 9. 資料關聯

- `products` 與 `product_translations` 透過 `product_id` 關聯，提供多語展示。
- `rfid_events` 提供事件歷史與區域遷移顯示來源。
- `fitting_room_presence` 提供試衣間即時在場推導。
- `fitting_room_sessions` 提供 KPI 轉化分母分子資料。
- 前端整併由 `product_key` 與 EPC 解碼匹配完成。

## 10. 為什麼這樣設計

- M8 需要同時滿足即時狀態與歷史可讀性，故同時依賴 presence events sessions 三種資料型態。
- 商品資訊與翻譯分離可支撐多語畫面，不增加事件表負擔。
- 不新增資料表可保持與 M2 凍結邊界一致，避免重複定義。

依據：[`plans/module_m8_spec.md`](plans/module_m8_spec.md:1)、[`public/js/main.js`](public/js/main.js:473)

---

## 充足性檢查

### 是否足以支撐前端頁面需求
- 足以支撐 KPI 顯示、事件流欄位、即時狀態看板。
- 對照：[`public/index.html`](public/index.html:22)、[`public/index.html`](public/index.html:101)

### 是否足以支撐 API 操作
- M8 本身以讀取為主，依賴 M4 M5 M6 寫入結果；現有結構可承接讀取需求。

### 是否足以支撐報表或查詢
- 足以支撐 v1 核心 KPI 與事件流查詢。
- 需求中的排行分析區塊仍未定義完整查詢口徑，僅能部分支撐。

### 哪些地方未來容易擴充失敗
- 若未先定義排行分析口徑就擴充報表，會與既有 KPI 口徑衝突。
- `from_zone` `to_zone` 為文字欄位，未來主檔化需資料遷移。
- `product_key` 匹配策略若變動，前端狀態重建可能失準。

---

## 影響其他模組風險標示

- 若 M8 先改 KPI 計算口徑，會與 M6 轉化邏輯衝突。
- 若 M8 調整事件欄位需求而未同步 M4，事件流顯示會斷裂。
- 若 M8 引入未凍結欄位，將破壞 M2 資料契約邊界。

