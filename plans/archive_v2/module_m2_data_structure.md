# M2 資料結構設計與記錄

依據 [`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:1)、[`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:1)、[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:1) 整理。

> 限制聲明：本文件僅針對 M2 模組所需資料結構，不修改其他模組邏輯邊界。

## 1. 資料表清單

M2 需確認與凍結以下資料表結構：
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

### 外鍵
- `product_translations.product_id -> products.id`
- `inventory_items.product_id -> products.id`

### M2 注意
- `fitting_room_presence.product_key` 與 `fitting_room_sessions.product_key` 為業務鍵，不是正式外鍵。
- `from_zone` `to_zone` 在 v1 為文字欄位，不外鍵到 `zones`（延後項）。

依據：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:112)

## 4. 必填欄位

> 以 M2 凍結語意與現有 API 寫入必需欄位為主。

- `products`：`id`、`epc_company_prefix`、`item_reference`、`name_en`
- `product_translations`：`product_id`、`locale`
- `inventory_items`：`id`、`epc_data`、`product_id`、`status`
- `rfid_events`：`id`、`epc_data`、`reader_id`、`timestamp`
- `fitting_room_presence`：`product_key`、`entered_at`、`last_seen_at`
- `fitting_room_sessions`：`id`、`product_key`、`entered_at`、`converted_to_sale`

參照寫入路徑：[`api/bulk-products.js`](api/bulk-products.js:158)、[`api/rfid-webhook.js`](api/rfid-webhook.js:370)

## 5. 可為空欄位

- `products`：`description_en`、`sku`、`size`、`color`、`image_url`、`price`
- `product_translations`：`name`、`description`
- `inventory_items`：`sku`
- `rfid_events`：`event_type`、`event_source`、`from_zone`、`to_zone`、`metadata`（舊環境相容）
- `fitting_room_sessions`：`left_at`、`duration_seconds`、`sale_time`

依據相容策略：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:129)

## 6. 狀態欄位

- `inventory_items.status`：單件狀態欄位
- `rfid_events.state`：事件狀態欄位（現行保留）
- `rfid_events.event_type`：事件語意狀態
- `fitting_room_sessions.converted_to_sale`：轉化狀態

## 7. 建立時間 / 更新時間

- 需求與既有凍結稿未統一要求每表 `created_at`、`updated_at`。
- 本模組僅沿用既有時間欄位：
  - `rfid_events.timestamp`
  - `fitting_room_presence.entered_at`、`last_seen_at`
  - `fitting_room_sessions.entered_at`、`left_at`、`sale_time`

> 規格不足已在下方風險段落標示。

## 8. 是否需要軟刪除

- M2 不新增軟刪除欄位。
- 理由：v1 凍結稿未定義統一軟刪除策略，若先加會影響查詢與 API 行為。

## 9. 資料關聯

- 商品主檔關聯：`products 1 - n product_translations`
- 商品主檔關聯：`products 1 - n inventory_items`
- 事件與單件關聯：`rfid_events.epc_data` 對應 `inventory_items.epc_data`
- 在場與 session 關聯：`fitting_room_presence.product_key` 對應 `fitting_room_sessions.product_key`

> 後兩者在 v1 以業務鍵關聯，不是 DB 外鍵強制。

## 10. 為什麼這樣設計

- 符合 M2 任務：先凍結最小可行資料契約，支撐事件、在場、session、轉化鏈路。
- 保留舊 schema 相容，降低部署切換風險。
- 不提前導入延後項 `zones` 與外鍵化，避免在需求未定稿前過度設計。

依據：[`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:112)

---

## 充足性檢查

### 是否足以支撐前端頁面需求
- 足以支撐 v1 前端看板與 KPI 所需讀取。
- 依據讀取流程：[`public/js/main.js`](public/js/main.js:851)

### 是否足以支撐 API 操作
- 足以支撐目前兩支核心 API：
  - [`api/bulk-products.js`](api/bulk-products.js:78)
  - [`api/rfid-webhook.js`](api/rfid-webhook.js:279)

### 是否足以支撐報表或查詢
- 足以支撐 v1 基本查詢與轉化率。
- 進階分析如排行與多維報表仍屬未定義或延後項。

### 哪些地方未來容易擴充失敗
- `zones` 未外鍵化，未來若導入 zone 主檔需資料回填與欄位遷移。
- `product_key` 業務鍵關聯若格式調整，會連動 presence sessions 查詢。
- 未統一 `created_at updated_at`，後續審計查詢可能口徑不一致。

---

## 影響其他模組風險標示

- 若在 M2 先行加入延後欄位 `ended_by` `is_overstay`，將影響 M5 M6 邏輯與驗收口徑。
- 若在 M2 強制外鍵化 `from_zone to_zone`，將影響 M4 事件寫入相容路徑。
- 若在 M2 改動 `epc_data` 命名口徑，將直接影響 M3 M4 M7 M8。

