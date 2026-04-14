# M7 API 設計記錄

依據 [`plans/module_m7_spec.md`](plans/module_m7_spec.md:1)、[`plans/module_m7_data_structure.md`](plans/module_m7_data_structure.md:1)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:1)、[`public/js/main.js`](public/js/main.js:601) 整理。

## 規格不足先行標示

- 前台角色是否需要登入態控管未定義，現階段僅能依 API 權限矩陣規範。  
- 拖拉衝突多使用者同時操作的一致性策略未獨立文件化。  
- 前台查詢目前為直接讀資料表流程，未有專用查詢 API 規格文件。

---

## API 逐項設計

## API 1

### 1 API 名稱
- Drag Action Sync API

### 2 Method
- `POST`

### 3 路徑
- `/api/rfid-webhook`

### 4 功能說明
- 接收前台拖拉與完成銷售操作事件，寫入標準化事件並回傳同步結果，供看板回滾或重渲染判斷。

### 5 請求參數

#### Body
- `epc_data` string 必填
- `reader_id` string 必填
- `event_type` string 建議由前台映射傳入
- `event_source` string 固定 `demo_drag`
- `from_zone` string 選填建議傳入
- `to_zone` string 選填建議傳入

#### Headers
- `Content-Type: application/json` 必填
- 當 `API_AUTH_ENABLED=true` 時必填：
  - `x-api-token: <API_SHARED_TOKEN>`
  - `x-user-role: demo_operator | analyst_admin | service_backend`

M7 前台映射來源：[`public/js/main.js`](public/js/main.js:662)、[`public/js/main.js`](public/js/main.js:676)

### 6 回應格式

#### 200 Success
```json
{
  "status": "success",
  "product": { "companyPrefix": "...", "itemReference": "..." },
  "event": {
    "event_type": "move_to_checkout",
    "event_source": "demo_drag",
    "from_zone": "fitting_room",
    "to_zone": "checkout",
    "write_mode": "rich"
  },
  "presence": {
    "product_key": "...::...",
    "in_fitting_room": false
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

註記：目前 webhook 的 `405` 使用 `message` 欄位，而 `401` `403` `500` 使用 `error` 欄位；前端需以相容策略解析。

### 8 權限要求
- `demo_operator` 允許
- `analyst_admin` 允許
- `service_backend` 允許
- `viewer` 禁止

補充：
- 當 `API_AUTH_ENABLED=false` 時，不啟用 token/role 驗證。
- 當 `API_AUTH_ENABLED=true` 時，依上述角色矩陣強制驗證。

來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:30)

### 9 驗證規則
- 僅接受 `POST`
- `epc_data` 必須可解碼
- `event_source` 對前台拖拉應為 `demo_drag`
- `event_type` 若未傳則由後端推導，但前台拖拉路徑建議明確傳入
- debounce 規則生效時前台需處理 `ignored` 結果
- 當 `API_AUTH_ENABLED=true` 時，需驗證 `x-api-token` 與 `x-user-role`

來源：[`api/rfid-webhook.js`](api/rfid-webhook.js:25)、[`api/rfid-webhook.js`](api/rfid-webhook.js:305)、[`public/js/main.js`](public/js/main.js:615)

### 10 分頁 / 搜尋 / 排序規則
- 不適用
- M7 寫入 API 無分頁 搜尋 排序。

---

## API 2

### 1 API 名稱
- Product Seed Import API for Board Readiness

### 2 Method
- `POST`

### 3 路徑
- `/api/bulk-products`

### 4 功能說明
- 提供看板運作前的商品資料準備，確保拖拉對象可渲染。

### 5 請求參數
- `rows` array 必填
- 欄位詳見 [`plans/api_spec_v1.md`](plans/api_spec_v1.md:87)

#### Headers
- `Content-Type: application/json` 必填
- 當 `API_AUTH_ENABLED=true` 時必填：
  - `x-api-token: <API_SHARED_TOKEN>`
  - `x-user-role: analyst_admin | service_backend`

### 6 回應格式
- 200 `status=success`，含 `affected` 與 upsert 統計

### 7 錯誤格式
- 405 `Method Not Allowed`
- 400 `rows 不可為空`
- 500 `error`
- 401 `Unauthorized`
- 403 `Forbidden`

### 8 權限要求
- `analyst_admin` 允許
- `service_backend` 允許
- 其他角色禁止

### 9 驗證規則
- `epc_data` 24 碼 Hex
- `name_en` 必填或由 `product_name` fallback
- `price` 可轉數字
- 當 `API_AUTH_ENABLED=true` 時，需驗證 `x-api-token` 與 `x-user-role`

### 10 分頁 / 搜尋 / 排序規則
- 不適用

來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:83)

---

## 額外檢查

### 命名是否一致
- 一致，M7 API 設計沿用 `event_type` `event_source` `from_zone` `to_zone` `epc_data`。

### 是否符合既有欄位命名規則
- 符合 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:7) 的凍結命名口徑。

### 是否足以支撐前端畫面
- 足夠。拖拉同步與資料準備兩支 API 已覆蓋 M7 前台需求。

### 是否有過度設計
- 無。僅採用既有兩支 API，未新增新端點。

### 是否缺少必要 API
- 以 M7 範圍判定不缺少。  
- M7 讀取流程由前端查詢既有資料來源完成，未定義專用查詢 API。
