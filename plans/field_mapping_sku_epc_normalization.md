# SKU / EPC / CSV Import 欄位口徑（與現行程式對齊）

## 1) Product 頁 SKU / EPC 解析規則（實作基準）

| 概念 | 主來源 | 備援 | 最終 fallback |
|---|---|---|---|
| SKU | `inventory_items.sku` | `products.sku` | `未知 SKU`（i18n） |
| EPC | `inventory_items.epc_data` | `products.epc_data`（僅在 inventory 空陣列 fallback） | `-` |
| 商品配對鍵 | `products.epc_company_prefix + products.item_reference` | 無 | 無 |

對應程式位置：
- SKU 彙總與 fallback：[`buildSkuSummaryRows()`](public/js/main.js:1646)
- Product 頁查詢欄位：[`fetchAndRenderDashboard()`](public/js/main.js:2328)

> 注意：前端目前**不再讀取** `products.product_sku` 作為顯示 fallback。

## 2) CSV Import 現行行為

### A. 一般 CSV Import（直接 EPC）

- 前端入口：[`handleCsvImport()`](public/js/main.js:2543)
- 前端檢查：必須有 `epc_data` 且為 24 hex；其餘欄位由後端判定。
- 後端正規化：[`normalizeRow()`](api/bulk-products.js:10)
  - 必要：`epc_data`、`name_en` 或 `product_name`
  - 可選：`sku`（若缺值，Product 頁可能顯示未知 SKU）

### B. Grouped CSV Import（EAN13 展開 EPC）

- 前端入口：[`handleGroupedCsvImport()`](public/js/main.js:1402)
- 必要欄位：`sku_ean13, product_name, color, size, quantity, price_usd`
  - 欄位檢查：[`groupedCsvToRows()`](public/js/main.js:1254)
- 展開後送出 payload 會帶 `sku`（由 `sku_ean13` 映射）
  - 對應：[`rows.push({... sku: ean13 ...})`](public/js/main.js:1461)

## 3) 後端落地寫入口徑

後端 `/api/bulk-products` 目前會同步寫入：

- `products.sku`：[`fallbackRows`](api/bulk-products.js:160)
- `inventory_items.sku`：[`inventoryRows`](api/bulk-products.js:223)

此規則已與 Product 頁讀取策略對齊。

## 4) 維運檢核（建議）

1. 先執行回填（歷史資料補齊）：[`plans/sql_backfill_products_inventory_sku_consistency.sql`](plans/sql_backfill_products_inventory_sku_consistency.sql:1)
2. 再執行檢核：[`plans/sql_verify_inventory_items_and_products_epc.sql`](plans/sql_verify_inventory_items_and_products_epc.sql:1)

重點觀察：

- `products_with_sku / products_without_sku`
- `inventory_with_sku / inventory_without_sku`
- unknown-sku 風險樣本是否下降

## 5) 實務建議

- 若希望 Product 頁不出現未知 SKU，CSV 匯入時請視為「`sku` 必填」。
- 若需保持向下相容（允許無 SKU），則維持現況，並接受前端以未知 SKU 顯示。 
