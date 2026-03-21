# RFID Fitting Room API 規格 v1 最小版

依據 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:1) 與現行實作 [`api/rfid-webhook.js`](api/rfid-webhook.js:279)、[`api/bulk-products.js`](api/bulk-products.js:78) 整理。

> 範圍限制：僅涵蓋 v1 核心 API。未出現在需求或現行程式之欄位，不納入本版規格。

## 1. 共通規格

- Base URL：同部署站點
- Content-Type：`application/json`
- 認證：
  - API 端內部透過 Supabase Service Role 寫資料，程式證據見 [`api/rfid-webhook.js`](api/rfid-webhook.js:4)、[`api/bulk-products.js`](api/bulk-products.js:3)
  - 當 `API_AUTH_ENABLED=true` 時，寫入 API 需帶以下 Header：
    - `x-api-token`：需等於 `API_SHARED_TOKEN`
    - `x-user-role`：`demo_operator`、`analyst_admin`、`service_backend`
  - 驗證程式依據：[`api/_auth.js`](api/_auth.js:4)
- 時間欄位：ISO 8601 `timestamptz`

## 2. `POST /api/rfid-webhook`

來源：[`api/rfid-webhook.js`](api/rfid-webhook.js:279)

### 2.1 Request Body

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---:|---|
| `epc_data` | string | 是 | 24 碼 Hex EPC，系統將解碼 SGTIN-96 |
| `reader_id` | string | 是 | 來源 reader，如 `FITTING_ROOM_ANTENNA_1` |
| `event_type` | string | 否 | 若未提供，系統依 `to_zone` 或 `reader_id` 推導 |
| `event_source` | string | 否 | 若未提供，預設 `simulator` |
| `from_zone` | string | 否 | 來源區域 |
| `to_zone` | string | 否 | 目標區域，若未提供以 `reader_id` 推導 |

### 2.2 事件語意

- 業務事件值：`enter_fitting_room`、`exit_fitting_room`、`move_to_checkout`、`sale_completed`、`return_to_sales_floor`
- 感測事件值：`tag_seen` 等（由系統推導）
- `event_source` 建議值：`demo_drag`、`simulator`、`rfid_reader`、`system`（欄位約束見 [`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:21)）

### 2.3 Response 200 Success

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

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:455)

### 2.4 Response 200 Debounced

```json
{
  "status": "ignored",
  "reason": "debounced",
  "presence_heartbeat_updated": true,
  "segmentation_gap_seconds": 30
}
```

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:361)

### 2.5 Error Codes

| HTTP | 條件 | 回應 |
|---:|---|---|
| 405 | 非 `POST` | `{ "message": "Method Not Allowed" }` |
| 401 | 啟用授權且缺少或錯誤 token | `{ "error": "Unauthorized" }` |
| 403 | 啟用授權且角色不允許 | `{ "error": "Forbidden" }` |
| 500 | 解碼失敗、DB 操作失敗、未預期例外 | `{ "error": "Internal Server Error" }` |

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:280)、[`api/rfid-webhook.js`](api/rfid-webhook.js:474)

## 3. `POST /api/bulk-products`

來源：[`api/bulk-products.js`](api/bulk-products.js:78)

### 3.1 Request Body

```json
{
  "rows": [
    {
      "epc_data": "3034257BF7194E4000001A85",
      "name_en": "Classic Tee",
      "product_name": "Classic Tee",
      "description_en": "...",
      "name_zh_hant": "...",
      "description_zh_hant": "...",
      "name_zh_hans": "...",
      "description_zh_hans": "...",
      "name_ja": "...",
      "description_ja": "...",
      "sku": "SKU-001",
      "size": "M",
      "color": "Black",
      "image_url": "https://...",
      "price": 999
    }
  ]
}
```

> 規則：
> - `epc_data` 必須為 24 碼 Hex
> - `name_en` 不可空（舊格式可用 `product_name`）
> - `price` 若有值必須可轉數字

參照：[`api/bulk-products.js`](api/bulk-products.js:37)、[`api/bulk-products.js`](api/bulk-products.js:41)、[`api/bulk-products.js`](api/bulk-products.js:45)

### 3.2 Response 200 Success

```json
{
  "status": "success",
  "message": "已處理 N 筆資料（唯一商品鍵 M）",
  "mode": "upsert_prefix_item",
  "duplicates_merged": [],
  "affected": 0,
  "translation_rows_upserted": 0,
  "inventory_items_upserted": 0,
  "items": [],
  "debug": {
    "targetSupabaseHost": "..."
  }
}
```

參照：[`api/bulk-products.js`](api/bulk-products.js:249)

### 3.3 Error Codes

| HTTP | 條件 | 回應 |
|---:|---|---|
| 405 | 非 `POST` | `{ "error": "Method Not Allowed" }` |
| 400 | `rows` 為空 | `{ "error": "rows 不可為空" }` |
| 401 | 啟用授權且缺少或錯誤 token | `{ "error": "Unauthorized" }` |
| 403 | 啟用授權且角色不允許 | `{ "error": "Forbidden" }` |
| 500 | 資料驗證失敗、DB 操作失敗、未預期例外 | `{ "error": "..." }` |

參照：[`api/bulk-products.js`](api/bulk-products.js:79)、[`api/bulk-products.js`](api/bulk-products.js:93)、[`api/bulk-products.js`](api/bulk-products.js:262)

## 4. 非功能性約束

- Debounce 規則：同 `epc_data + reader_id` 3 秒內不重複寫入，參照 [`api/rfid-webhook.js`](api/rfid-webhook.js:305)
- Conversion 規則：`sale_completed` 時嘗試套用 session 10 分鐘轉化窗口，參照 [`api/rfid-webhook.js`](api/rfid-webhook.js:439)

## 5. 未納入本版的項目

- OpenAPI 文件檔與 schema 驗證器
- API 版本號策略
- 外部 RFID Reader 硬體簽章與回放防護

上述項目未於需求書定稿，故不在本最小版範圍。

