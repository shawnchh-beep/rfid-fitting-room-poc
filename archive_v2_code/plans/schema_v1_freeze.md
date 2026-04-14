# RFID Fitting Room Schema v1 凍結稿

依據需求資料模型方向 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:365) 與現有遷移腳本 [`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:1)、[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:1) 收斂。

> 目標：凍結 v1 命名口徑與最小可行資料結構，避免開發中途反覆改表。

## 1. 命名口徑凍結

### 1.1 關鍵命名對照

| 需求語意 | v1 凍結名稱 | 備註 |
|---|---|---|
| product_items | `inventory_items` | 沿用現行表名 |
| epc | `epc_data` | 事件與單件追蹤一致 |
| event_time | `timestamp` | 沿用現行欄位 |
| exited_at | `left_at` | session 結束時間 |
| from zone to zone | `from_zone` `to_zone` | 純文字 zone code |

### 1.2 事件列舉凍結

- `event_type`：`enter_fitting_room`、`exit_fitting_room`、`move_to_checkout`、`sale_completed`、`return_to_sales_floor`、`tag_seen`
- `event_source`：`demo_drag`、`simulator`、`rfid_reader`、`system`

## 2. v1 必要資料表

### 2.1 `products`

用途：商品主檔與前台顯示主資料

必要欄位：
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

### 2.2 `product_translations`

用途：多語文案

必要欄位：
- `product_id`
- `locale`
- `name`
- `description`

### 2.3 `inventory_items`

用途：EPC 單件商品對應

必要欄位：
- `id`
- `epc_data`
- `product_id`
- `sku`
- `status`

### 2.4 `rfid_events`

用途：事件歷史

必要欄位：
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

遷移依據：[`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:5)

### 2.5 `fitting_room_presence`

用途：即時在場快照

必要欄位：
- `product_key`
- `epc_company_prefix`
- `item_reference`
- `entered_at`
- `last_seen_at`
- `last_reader_id`

### 2.6 `fitting_room_sessions`

用途：試穿 session 與轉化判定

必要欄位：
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

遷移依據：[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:4)

## 3. v1 非必要 延後項目

- `zones` 正式主檔與外鍵化
- `item_current_states` 專責即時狀態表
- `reader_id` `antenna_id` 正式主檔關聯
- `ended_by` `is_overstay` 正式欄位

> 延後原因：需求為建議方向但尚未形成最終外鍵策略，避免過早定稿造成遷移返工。

## 4. 遷移基線

執行順序建議：
1. 套用 [`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:1)
2. 套用 [`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:1)
3. 驗證欄位存在與索引
4. 以 smoke 測試送入 `demo_drag` 與 `sale_completed` 事件

## 5. 相容策略

- 若 `rfid_events` 尚未有擴充欄位，API 可 fallback 至舊欄位寫入
- 新欄位存在時，強制寫入 `event_type` 與 `event_source`

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:45)

