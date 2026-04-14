# M6 API 設計記錄

依據 [`plans/module_m6_spec.md`](plans/module_m6_spec.md:1)、[`plans/module_m6_data_structure.md`](plans/module_m6_data_structure.md:1)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`api/rfid-webhook.js`](api/rfid-webhook.js:439) 整理。

## 規格不足先行標示

- 今日 KPI 的時區口徑未在需求文件明確定義。  
- conversion `reason` 的對外錯誤字典未獨立文件化。  
- 目前無獨立「查詢型 KPI API」規格，僅由前端直接讀資料表計算。

---

## API 逐項設計

## API 1

### 1 API 名稱
- Sale Conversion Marking API

### 2 Method
- `POST`

### 3 路徑
- `/api/rfid-webhook`

### 4 功能說明
- 在事件為 `sale_completed` 時，依 v1 轉化規則嘗試將符合條件的 session 標記為已轉化，並回傳 conversion 結果。

### 5 請求參數

#### Body
- `epc_data` string 必填
- `reader_id` string 必填
- `event_type` string 選填
- `event_source` string 選填
- `from_zone` string 選填
- `to_zone` string 選填

> M6 關鍵：需可形成 `event_type = sale_completed` 的請求。

來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:20)

### 6 回應格式

#### 200 Success 含 conversion
```json
{
  "status": "success",
  "product": { "companyPrefix": "...", "itemReference": "..." },
  "event": {
    "event_type": "sale_completed",
    "event_source": "demo_drag",
    "from_zone": "checkout",
    "to_zone": "sold",
    "write_mode": "rich"
  },
  "presence": {
    "product_key": "...::...",
    "in_fitting_room": false
  },
  "conversion": {
    "converted": true,
    "skipped": false,
    "reason": "ok",
    "window_minutes": 10,
    "session_id": "..."
  },
  "segmentation_gap_seconds": 30
}
```

#### 200 Success 但不轉化
`conversion` 仍存在，`converted=false`，`reason` 為 `no_session_in_window` 等。

來源：[`api/rfid-webhook.js`](api/rfid-webhook.js:446)

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
- 轉化判定僅在 `event_type = sale_completed` 路徑執行
- 目標 session 必須
  - 同一 `product_key`
  - 已有 `left_at`
  - 未被標記 `converted_to_sale`
  - 且 `sale_time - left_at <= 10 分鐘`
- 若 schema 尚未就緒，可回 skipped reason，不阻斷主流程

來源：[`api/rfid-webhook.js`](api/rfid-webhook.js:227)、[`api/rfid-webhook.js`](api/rfid-webhook.js:247)、[`api/rfid-webhook.js`](api/rfid-webhook.js:270)

### 10 分頁 / 搜尋 / 排序規則
- 不適用
- M6 使用事件寫入 API 觸發轉化，不提供獨立查詢型 API 的分頁 搜尋 排序。

---

## 額外檢查

### 命名是否一致
- 一致，沿用 `converted_to_sale`、`sale_time`、`event_type`、`product_key`。

### 是否符合既有欄位命名規則
- 符合 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:7) 的凍結命名。

### 是否足以支撐前端畫面
- 足夠支撐 M6 相關前端 KPI 顯示與銷售完成後轉化回饋。  
- 前端 KPI 來源仍為資料查詢計算，非新增 API。

### 是否有過度設計
- 無。未新增新端點，只在既有 webhook 路徑定義 M6 所需行為。

### 是否缺少必要 API
- 以 M6 模組職責判定不缺少。  
- 若未來要降低前端聚合成本，可能需要獨立 KPI 查詢 API，但目前不在既定規格內。
