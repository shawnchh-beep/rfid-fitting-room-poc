# M3 資料結構設計與記錄

依據 [`plans/module_m3_spec.md`](plans/module_m3_spec.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:83)、[`api/bulk-products.js`](api/bulk-products.js:78) 整理。

> 限制聲明：本文件僅針對 M3 模組 商品主檔與批次匯入 所需資料結構，不修改其他模組資料表定義。

## 1. 資料表清單

M3 需要操作與維護的資料表：
- `products`
- `product_translations`
- `inventory_items`

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

## 3. 主鍵 / 外鍵

### 主鍵
- `products.id`
- `inventory_items.id`

### 外鍵
- `product_translations.product_id -> products.id`
- `inventory_items.product_id -> products.id`

### M3 匯入唯一鍵語意
- `products` 在匯入路徑使用 `epc_company_prefix + item_reference` 作 upsert 衝突鍵。
- `product_translations` 使用 `product_id + locale` 作 upsert 衝突鍵。
- `inventory_items` 使用 `epc_data` 作 upsert 衝突鍵。

依據：[`api/bulk-products.js`](api/bulk-products.js:173)、[`api/bulk-products.js`](api/bulk-products.js:207)、[`api/bulk-products.js`](api/bulk-products.js:236)

## 4. 必填欄位

> 以 M3 匯入流程的必要寫入條件為準。

- `products`：`epc_company_prefix`、`item_reference`、`name_en`（由 `name_en` 或 `product_name` 取得）
- `product_translations`：`product_id`、`locale`
- `inventory_items`：`epc_data`、`product_id`、`status`

依據：[`api/bulk-products.js`](api/bulk-products.js:41)、[`api/bulk-products.js`](api/bulk-products.js:225)

## 5. 可為空欄位

- `products`：`description_en`、`sku`、`size`、`color`、`image_url`、`price`
- `product_translations`：`name`、`description`
- `inventory_items`：`sku`

依據：[`api/bulk-products.js`](api/bulk-products.js:68)

## 6. 狀態欄位

- `inventory_items.status`
  - M3 寫入路徑目前固定使用 `ACTIVE`。

依據：[`api/bulk-products.js`](api/bulk-products.js:229)

## 7. 建立時間 / 更新時間

- 本模組引用的凍結稿未強制定義每表 `created_at`、`updated_at`。
- M3 匯入 API 亦未依賴此兩欄位。

> 規格不足已在下方標示，不自行補欄位。

## 8. 是否需要軟刪除

- M3 不新增軟刪除欄位。
- 理由：需求與既有凍結稿未定義匯入刪除策略與資料生命週期規則。

## 9. 資料關聯

- `products 1 - n product_translations`
- `products 1 - n inventory_items`
- 匯入鍵關聯：`epc_data` 對應單件資料，`epc_company_prefix + item_reference` 對應商品主檔。

## 10. 為什麼這樣設計

- M3 核心職責是讓商品主檔能被穩定匯入與覆蓋，不擴展到事件與 session。
- 使用 `prefix + item_reference` 作商品唯一語意，符合現行解碼與 upsert 路徑。
- 多語與單件資料分表，避免商品主檔膨脹並保留前台渲染彈性。

依據：[`plans/module_m3_spec.md`](plans/module_m3_spec.md:1)、[`api/bulk-products.js`](api/bulk-products.js:111)

---

## 充足性檢查

### 是否足以支撐前端頁面需求
- 足以支撐 M3 相關前端需求：商品名稱、SKU、圖片、多語顯示來源。
- 對照頁面流程：[`public/index.html`](public/index.html:75)、[`public/js/main.js`](public/js/main.js:803)

### 是否足以支撐 API 操作
- 足以支撐 [`POST /api/bulk-products`](api/bulk-products.js:78) 的驗證、去重、upsert 路徑。

### 是否足以支撐報表或查詢
- 足以支撐商品維度基礎查詢。
- 不足以單獨支撐事件與轉化報表，該部分屬 M4 M5 M6。

### 哪些地方未來容易擴充失敗
- `products` 的唯一語意依賴 `epc_company_prefix + item_reference`，若未來商品主鍵策略改變將影響匯入邏輯。
- `status` 目前僅見 `ACTIVE` 寫入，狀態機未文件化時擴充容易不一致。
- 缺統一時間戳欄位規範，後續資料治理可能增加補欄位成本。

---

## 影響其他模組風險標示

- 若調整 `products` 唯一鍵策略，將影響 M7 M8 的商品渲染與查詢匹配。
- 若調整 `inventory_items.epc_data` 衝突鍵，將影響 M4 事件對單件追蹤的一致性。
- 若在 M3 擴充未定義狀態枚舉，會影響 M8 展示解讀與後續報表口徑。

