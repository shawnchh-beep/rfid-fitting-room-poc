# CSV 匯入 SKU 衝突防呆方案

## 目標
- 在匯入流程中強制檢查同一 `sku` 的產品資訊一致性。
- 若發生衝突，整批匯入中止，不寫入 `products`、`product_translations`、`inventory_items`。
- 此方案僅建檔，不執行程式修改。

## 適用範圍
- 後端 API：`/api/bulk-products`
- 前端匯入入口：一般 CSV 匯入與 Grouped CSV 匯入

## 已確認規則
1. 比對欄位：`name_en`、`size`、`color`、`price`
2. 檔內衝突：同一匯入檔案中，同 `sku` 只要上述欄位任一不一致，整批擋下
3. 資料庫衝突：若 `sku` 已存在且任一欄位不一致，整批擋下
4. 同 `sku` 且資訊完全一致：允許匯入
5. 衝突錯誤建議使用 `409 Conflict`

## 實作設計

### A. 後端檢查流程
目標檔案：`api/bulk-products.js`

1. 正規化完成後，新增「檔內一致性檢查」
   - 以 `sku` 分組
   - 每組比對 `name_en`、`size`、`color`、`price`
   - 產生衝突清單 `conflicts[]`
   - 若有衝突，直接回傳錯誤並中止

2. 新增「資料庫一致性檢查」
   - 先收集本次匯入非空 `sku`
   - 查詢既有 `products` 中相同 `sku` 的既有資料
   - 對照匯入資料與既有資料的 `name_en`、`size`、`color`、`price`
   - 若有衝突，直接回傳錯誤並中止

3. 僅在「無衝突」情況下，進入既有 upsert 流程

### B. 錯誤回應格式
建議回應結構：

```json
{
  "error": "SKU conflict detected",
  "error_code": "SKU_CONFLICT",
  "scope": "in_file | against_db",
  "conflicts": [
    {
      "sku": "SKU-001",
      "fields": {
        "name_en": { "incoming": "A", "existing": "B" },
        "size": { "incoming": "M", "existing": "L" },
        "color": { "incoming": "Black", "existing": "White" },
        "price": { "incoming": 1290, "existing": 1190 }
      }
    }
  ]
}
```

### C. 前端錯誤呈現規劃
目標檔案：`public/js/main.js`

1. 讓錯誤訊息可顯示 `error_code` 與 `conflicts`
2. 在一般 CSV 匯入結果框與 Grouped CSV 匯入結果框輸出可讀內容
3. 若為 `SKU_CONFLICT`，優先顯示：
   - 衝突 SKU
   - 衝突欄位
   - incoming 與 existing 差異

## 資料比對細節
1. 字串欄位 (`name_en`、`size`、`color`)
   - 先 `trim`
   - 空值標準化為 `null`
2. 數值欄位 (`price`)
   - 先轉數字
   - 無值視為 `null`
   - 以數值等值比較，避免字串格式差異造成誤判

## 失敗策略
- 衝突一旦發現，採 fail-fast：直接回應錯誤，不做部分成功

## 驗收條件
1. 同 `sku` 同資訊可重複匯入，流程成功
2. 同 `sku` 不同 `name_en` 會整批失敗，回傳衝突明細
3. 同 `sku` 不同 `size` 會整批失敗，回傳衝突明細
4. 同 `sku` 不同 `color` 會整批失敗，回傳衝突明細
5. 同 `sku` 不同 `price` 會整批失敗，回傳衝突明細
6. 同一檔內相同 `sku` 不一致會整批失敗
7. 非衝突案例下，既有匯入行為維持

## 風險與備註
1. 既有資料可能本身已不一致
   - 先以本次比對規則阻止新衝突擴大
2. 前端目前以文字區塊顯示匯入結果
   - 建議先確保可讀性，再視需要升級成表格化衝突明細

## 不在本次範圍
1. 不修改 DB schema
2. 不新增 migration
3. 不調整產品頁顯示邏輯

