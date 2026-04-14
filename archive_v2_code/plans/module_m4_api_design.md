# M4 API 設計記錄

依據 [`plans/module_m4_spec.md`](plans/module_m4_spec.md:1)、[`plans/module_m4_data_structure.md`](plans/module_m4_data_structure.md:1)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`api/rfid-webhook.js`](api/rfid-webhook.js:279) 整理。

## 規格不足先行標示

- `event_type` 在部分邊界轉移情境的優先判定表未獨立文件化。
- 錯誤回應目前以 HTTP 500 聚合，缺更細錯誤碼分類字典。

---

## API 逐項設計

## API 1

### 1 API 名稱
- RFID Webhook Event Intake API

### 2 Method
- `POST`

### 3 路徑
- `/api/rfid-webhook`

### 4 功能說明
- 接收 RFID 或模擬事件，標準化事件欄位，執行 debounce，寫入事件歷史，並同步更新在場快照與 session。

### 5 請求參數

#### Body
- `epc_data` string 必填
- `reader_id` string 必填
- `event_type` string 選填
- `event_source` string 選填
- `from_zone` string 選填
- `to_zone` string 選填

#### Headers
- 當 `API_AUTH_ENABLED=true` 時必填：
  - `x-api-token`
  - `x-user-role`（`demo_operator`、`analyst_admin`、`service_backend` 允許）

來源：[`api/_auth.js`](api/_auth.js:4)、[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:30)

來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:20)

### 6 回應格式

#### 200 Success
```json
{
  "status": "success",
  "product": { "companyPrefix": "...", "itemReference": "..." },
  "event": {
    "event_type": "enter_fitting_room",
    "event_source": "demo_drag",
    "from_zone": "sales_floor",
    "to_zone": "fitting_room",
    "write_mode": "rich"
  },
  "presence": {
    "product_key": "...::...",
    "in_fitting_room": true
  },
  "conversion": null,
  "segmentation_gap_seconds": 30
}
```

#### 200 Debounced
```json
{
  "status": "ignored",
  "reason": "debounced",
  "presence_heartbeat_updated": true,
  "segmentation_gap_seconds": 30
}
```

來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:37)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:61)

### 7 錯誤格式

#### 405
```json
{ "message": "Method Not Allowed" }
```

#### 500
```json
{ "error": "Internal Server Error" }
```

#### 401
```json
{ "error": "Unauthorized" }
```

#### 403
```json
{ "error": "Forbidden" }
```

來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:74)

### 8 權限要求
- `demo_operator` 允許
- `analyst_admin` 允許
- `service_backend` 允許
- `viewer` 禁止

來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:30)

### 9 驗證規則
- 僅接受 `POST`
- `epc_data` 必須可被 SGTIN-96 解碼
- 3 秒內相同 `epc_data + reader_id` 視為 debounced
- `event_type event_source from_zone to_zone` 若缺失可由系統推導或預設
- `rfid_events` 欄位缺失時允許 fallback 舊 schema 寫入

#### 9.1 事件推導優先序決策表

| 條件 | `event_type` 結果 | 說明 |
|---|---|---|
| Body 有傳 `event_type` | 使用 Body 值 | 前端明確指定優先 |
| Body 未傳 且 `to_zone=fitting_room` | `enter_fitting_room` | 依區域推導 |
| Body 未傳 且 `to_zone=checkout` | `move_to_checkout` | 依區域推導 |
| Body 未傳 且 `to_zone=sold` | `sale_completed` | 依區域推導 |
| Body 未傳 且 `to_zone=sales_floor` | `return_to_sales_floor` | 依區域推導 |
| 以上皆不符合 | `tag_seen` | 最後 fallback |

對照實作：[`normalizeEventEnvelope()`](api/rfid-webhook.js:25)

來源：[`api/rfid-webhook.js`](api/rfid-webhook.js:293)、[`api/rfid-webhook.js`](api/rfid-webhook.js:305)、[`api/rfid-webhook.js`](api/rfid-webhook.js:25)、[`api/rfid-webhook.js`](api/rfid-webhook.js:54)

### 10 分頁 搜尋 排序規則
- 不適用
- 本 API 為事件寫入入口，不提供分頁 搜尋 排序。

---

## 額外檢查

### 命名是否一致
- 一致，採 `event_type`、`event_source`、`from_zone`、`to_zone` 命名。

### 是否符合既有欄位命名規則
- 符合凍結口徑：`epc_data`、`timestamp`、`left_at`、`from_zone`、`to_zone`。
- 依據：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:7)

### 是否足以支撐前端畫面
- 足夠。可支撐拖拉同步、事件流更新、在場狀態回饋與銷售完成流程。
- 對照：[`public/js/main.js`](public/js/main.js:696)

### 是否有過度設計
- 無。僅保留單一事件入口 API，並沿用既有相容策略。

### 是否缺少必要 API
- 以 M4 職責判定不缺少。M4 必要能力由 `/api/rfid-webhook` 已完整承接。
