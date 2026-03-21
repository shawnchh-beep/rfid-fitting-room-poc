# M2 模組規格 資料模型與遷移基線

## 1. 模組目標
- 依 v1 凍結口徑建立可執行的資料模型與遷移基線，確保後續模組在同一資料契約上開發。
- 依據 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:1) 與遷移腳本 [`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:1)、[`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:1)。

## 2. 模組邊界
### 做什麼
- 落實 v1 命名口徑凍結：`epc_data`、`timestamp`、`left_at`、`from_zone`、`to_zone`。
- 套用事件模型擴充遷移與轉化欄位遷移。
- 驗證必要欄位與索引存在。
- 驗證相容策略可運作。

### 不做什麼
- 不新增需求書未定義資料域。
- 不納入延後項目 `zones`、`item_current_states`、`ended_by`、`is_overstay`。
- 不變更 API 業務行為與前端流程。

## 3. 涉及角色與權限
- `service_backend`：執行遷移與寫入相容行為。
- `analyst_admin`：驗證遷移結果與資料可讀性。
- 角色口徑依 [`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:7)。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

必要欄位口徑依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24)。

## 5. 涉及 API
- [`api/rfid-webhook.js`](api/rfid-webhook.js:279)
  - 依 `rfid_events` 欄位存在與否採 rich 或 fallback 寫入。
- [`api/bulk-products.js`](api/bulk-products.js:78)
  - 依既有表口徑寫入商品主檔 翻譯與單件資料。

## 6. 涉及頁面
- 本模組不直接開發頁面。
- 間接影響 [`public/js/main.js`](public/js/main.js:752) 的資料讀取與渲染可用性。

## 7. 核心流程
1. 依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:121) 執行遷移順序。
2. 套用 [`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:1)。
3. 套用 [`plans/sql_stage2_conversion.sql`](plans/sql_stage2_conversion.sql:1)。
4. 驗證欄位與索引。
5. 用 `demo_drag` 與 `sale_completed` 事件做 smoke 驗證。
6. 驗證 [`api/rfid-webhook.js`](api/rfid-webhook.js:45) 相容策略未破壞現行流程。

## 8. 業務規則
- 事件欄位口徑以 `event_type`、`event_source`、`from_zone`、`to_zone` 為準。
- 轉化欄位口徑以 `converted_to_sale`、`sale_time` 為準。
- 命名對照固定，避免需求語意與實際欄位再分叉。

依據 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:7)。

## 9. 驗收標準
- 遷移腳本可執行且無阻斷錯誤。
- `rfid_events` 具備擴充欄位與索引。
- `fitting_room_sessions` 具備轉化欄位與索引。
- webhook 仍可回應成功與 debounced 兩種主要路徑。
- 不破壞既有資料讀取流程。

驗收對照：[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:11)。

## 10. 與其他模組的依賴
- 前置依賴：M1 基線治理與規格凍結 [`plans/module_m1_spec.md`](plans/module_m1_spec.md:1)。
- 後續依賴：M3 M4 M5 M6 M7 M8 M9 皆依賴 M2 的資料契約穩定。

---

## 補充 1 規格仍不足
- `zones` 與 `item_current_states` 仍為延後項目，尚無 v1 可執行定稿。
- `reader_id`、`antenna_id` 尚未主檔化與外鍵化。
- `ended_by`、`is_overstay` 未納入本版必要欄位。

以上僅依文件現況指出，依據 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:112)。

## 補充 2 直接開發易返工區
- 在命名口徑未凍結下先寫查詢與報表。
- 在延後項目未定版前先做外鍵化重構。
- 忽略 fallback 相容策略直接改寫舊資料路徑。

## 補充 3 開發前需先確認
- M2 驗證環境是否包含既有舊 schema 資料，以便驗證 fallback。
- 本次是否只執行 v1 必要欄位，不提前納入延後項目。
- 遷移執行順序是否固定採 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:123) 定義。

