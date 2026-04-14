# M5 API 設計記錄

依據 [`plans/module_m5_spec.md`](plans/module_m5_spec.md:1)、[`plans/module_m5_data_structure.md`](plans/module_m5_data_structure.md:1)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`api/rfid-webhook.js`](api/rfid-webhook.js:279) 整理。

## 規格不足先行標示

- M5 的 `ended_by` `is_overstay` 在需求屬建議但 v1 未凍結，故 API 不應提前擴充。
- heartbeat 更新頻率與 segmentation gap 的參數化規格未獨立文件化。

---

## API 逐項設計

## API 1

### 1 API 名稱
- Fitting Presence and Session Lifecycle API

### 2 Method
- `POST`

### 3 路徑
- `/api/rfid-webhook`

### 4 功能說明
- 接收事件後維護 `fitting_room_presence` 與 `fitting_room_sessions`：
  - 試衣間內持續更新在場快照
  - 新試穿段建立 session
  - 離場或非試衣間事件關閉 session

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
  "segmentation_gap_seconds": "FITTING_EXIT_TIMEOUT_MS / 1000"
}
```

#### 200 Debounced
```json
{
  "status": "ignored",
  "reason": "debounced",
  "presence_heartbeat_updated": true,
  "segmentation_gap_seconds": "FITTING_EXIT_TIMEOUT_MS / 1000"
}
```

> 註：`segmentation_gap_seconds` 由後端常數動態計算，對照 [`api/rfid-webhook.js`](api/rfid-webhook.js:9)、[`api/rfid-webhook.js`](api/rfid-webhook.js:365)、[`api/rfid-webhook.js`](api/rfid-webhook.js:470)。

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
- `epc_data` 可解碼為 SGTIN-96
- 3 秒 debounce 規則生效
- 試衣間 reader 路徑需 upsert presence 並依分段規則判定是否開新 session
- 非試衣間 reader 路徑需清除 presence 並關閉開啟 session

來源：[`api/rfid-webhook.js`](api/rfid-webhook.js:305)、[`api/rfid-webhook.js`](api/rfid-webhook.js:387)、[`api/rfid-webhook.js`](api/rfid-webhook.js:427)

### 10 分頁 搜尋 排序規則
- 不適用
- 本 API 為事件寫入與狀態更新入口，不提供分頁 搜尋 排序。

---

## 額外檢查

### 命名是否一致
- 一致，沿用 `product_key`、`entered_at`、`last_seen_at`、`left_at` 命名。

### 是否符合既有欄位命名規則
- 符合凍結口徑：`epc_data` `timestamp` `left_at` `from_zone` `to_zone`。
- 依據：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:7)

### 是否足以支撐前端畫面
- 足夠。可支撐前端試衣間在場判定與看板狀態重建。
- 對照：[`public/js/main.js`](public/js/main.js:455)

### 是否有過度設計
- 無。M5 未新增新 API，僅使用既有 webhook 路徑承載在場與 session 管理。

### 是否缺少必要 API
- 以 M5 職責判定不缺少。單一事件入口已覆蓋在場與 session 生命週期。
