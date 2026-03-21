# M3 API 設計記錄

依據 [`plans/module_m3_spec.md`](plans/module_m3_spec.md:1)、[`plans/module_m3_data_structure.md`](plans/module_m3_data_structure.md:1)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:83)、[`api/bulk-products.js`](api/bulk-products.js:78) 整理。

## 規格不足先行標示

- CSV 欄位中哪些為強制欄位與選填欄位，雖有現行程式規則，但尚無獨立欄位版控文件。
- 錯誤碼目前以 HTTP + 文字訊息為主，缺機器可判讀的細分類錯誤碼字典。

---

## API 逐項設計

## API 1

### 1 API 名稱
- Bulk Products Import API

### 2 Method
- `POST`

### 3 路徑
- `/api/bulk-products`

### 4 功能說明
- 接收商品批次 rows，完成資料正規化 驗證 去重，並 upsert 到 `products` `product_translations` `inventory_items`。

### 5 請求參數

#### Body
- `rows` array 必填

#### Headers
- 當 `API_AUTH_ENABLED=true` 時必填：
  - `x-api-token`
  - `x-user-role`（僅 `analyst_admin`、`service_backend` 允許）

來源：[`api/_auth.js`](api/_auth.js:4)、[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:30)

每列支援欄位：
- `epc_data`
- `name_en`
- `product_name`
- `description_en`
- `name_zh_hant`
- `description_zh_hant`
- `name_zh_hans`
- `description_zh_hans`
- `name_ja`
- `description_ja`
- `sku`
- `size`
- `color`
- `image_url`
- `price`

來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:87)

### 6 回應格式

#### 200
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
  "debug": { "targetSupabaseHost": "..." }
}
```

來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:120)

### 7 錯誤格式

#### 405
```json
{ "error": "Method Not Allowed" }
```

#### 400
```json
{ "error": "rows 不可為空" }
```

#### 500
```json
{ "error": "..." }
```

#### 401
```json
{ "error": "Unauthorized" }
```

#### 403
```json
{ "error": "Forbidden" }
```

來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:140)

### 8 權限要求
- `analyst_admin` 允許
- `service_backend` 允許
- `demo_operator` `viewer` 禁止

來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:30)

### 9 驗證規則
- `rows` 不可為空
- `epc_data` 必須 24 碼 Hex
- `name_en` 不可空（可由 `product_name` fallback）
- `price` 若有值需可轉數字
- 同商品鍵 `epc_company_prefix item_reference` 重複時採最後一筆覆蓋

來源：[`api/bulk-products.js`](api/bulk-products.js:37)、[`api/bulk-products.js`](api/bulk-products.js:41)、[`api/bulk-products.js`](api/bulk-products.js:45)、[`api/bulk-products.js`](api/bulk-products.js:119)

### 10 分頁 搜尋 排序規則
- 不適用
- 本 API 為批次寫入端點，不提供分頁 搜尋 排序。

---

## 額外檢查

### 命名是否一致
- 一致，沿用既有命名：`epc_data`、`name_en`、`item_reference`、`translation_rows_upserted`。

### 是否符合既有欄位命名規則
- 符合 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:7) 的凍結命名口徑。

### 是否足以支撐前端畫面
- 足夠支撐 M3 範圍：前端可透過匯入取得商品與多語資料，再供看板渲染使用。

### 是否有過度設計
- 無。僅保留一支既有匯入 API，未新增新能力。

### 是否缺少必要 API
- 以 M3 模組職責判定不缺少。M3 的必要能力已由 `/api/bulk-products` 覆蓋。
