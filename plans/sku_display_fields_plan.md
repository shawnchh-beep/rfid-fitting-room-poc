# Product 頁 SKU 展示產品欄位資訊方案

## 目標
- 在 Product 頁的 SKU 摘要列新增顯示欄位：產品名稱、尺寸、顏色。
- 僅調整「上方 SKU 摘要列」，不改展開後明細表。

## 適用範圍
- 前端主檔：`public/js/main.js`
- 樣式檔：`public/css/style.css`

## 已確認需求
1. 新增欄位位置：SKU 摘要列（每個 SKU 一列）
2. 新增欄位內容：產品名稱、尺寸、顏色
3. 規則：同一 SKU 不應有多個值，若發現多值視為錯誤
4. 錯誤呈現：頁面內紅色警示區塊列出衝突 SKU，摘要列仍顯示

## 實作設計

### A. 資料彙整層
目標函式：`buildSkuSummaryRows`（`public/js/main.js`）

1. 在每個 SKU bucket 聚合下列欄位：
   - `productName`
   - `size`
   - `color`
2. 建立每個欄位的候選值集合（去空白、標準化）
3. 產生彙整結果：
   - 單值：直接顯示該值
   - 多值：標記為衝突並收斂為 `ERROR`
4. 建立衝突清單：
   - `conflicts[]` 內容包含 `sku`、衝突欄位與候選值

### B. 畫面渲染層
目標函式：`renderProductSkuSummary`（`public/js/main.js`）

1. 摘要列欄位改為：
   - SKU
   - 產品名稱
   - 尺寸
   - 顏色
   - 庫存數量
   - 已銷售數量
   - 總件數
2. 在摘要列表上方新增紅色警示區塊：
   - 有衝突時顯示
   - 列出衝突 SKU 與欄位
   - 無衝突時隱藏
3. 展開明細表維持現狀：
   - 仍顯示 item 編號、EPC、目前位置

### C. i18n 文案
目標區塊：`I18N`（`public/js/main.js`）

新增建議鍵值：
- `product.summary.productName`
- `product.summary.size`
- `product.summary.color`
- `product.summary.conflictTitle`
- `product.summary.conflictItem`
- `product.summary.errorValue`

語系覆蓋：
- `en`
- `zh-Hant`
- `zh-Hans`
- `ja`

### D. 樣式調整
目標樣式：`.product-sku-head`、`.product-sku-summary-row`（`public/css/style.css`）

1. 調整 `grid-template-columns` 以支援 7 欄
2. 針對小螢幕補強可讀性：
   - 欄寬比例優先給 SKU 與產品名稱
   - 避免欄位重疊
3. 新增警示區塊樣式：
   - 紅底或淡紅底
   - 明確對比與易讀性

## 驗收條件
1. SKU 摘要列新增 3 欄且顯示正確
2. 若同 SKU 存在多個產品名稱/尺寸/顏色，頁面顯示紅色衝突警示區塊
3. 衝突時摘要列仍正常顯示
4. 展開明細表內容與互動不變
5. Refresh、語系切換、既有排序行為不受影響

## 非本次範圍
1. 不修改後端 API
2. 不調整資料庫 schema
3. 不改 CSV 匯入規則

