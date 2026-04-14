# M9 API 設計記錄

依據 [`plans/module_m9_spec.md`](plans/module_m9_spec.md:1)、[`plans/module_m9_data_structure.md`](plans/module_m9_data_structure.md:1)、[`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:9)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:1) 整理。

## 規格不足先行標示

- M9 無獨立運維 API 契約文件，僅有 runbook 操作流程。  
- 部署回滾觸發條件與 API 級健康檢查端點未定義。  
- smoke 測試資料與可重跑腳本未形成 API 化規範。

---

## M9 API 設計結論

> M9 為部署與運維驗證模組，依既定規格 **不新增 API 端點**。  
> M9 只驗證既有 API 在部署環境可正常運作。

---

## 逐項輸出

### 1 API 名稱
- 無新增 API（M9 不定義新端點）

### 2 Method
- 無

### 3 路徑
- 無

### 4 功能說明
- M9 職責是部署後驗證，不承擔新業務 API 設計。

### 5 請求參數
- 無

### 6 回應格式
- 無

### 7 錯誤格式
- 無

### 8 權限要求
- M9 不新增 API 權限。
- 既有 API 權限沿用：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:26)

### 9 驗證規則
- M9 不新增 API 驗證規則。
- 僅驗證既有 API 規則在部署環境是否成立。

### 10 分頁 / 搜尋 / 排序規則
- 不適用（M9 無新增 API）

---

## M9 依賴驗證的既有 API（非新增）

1. [`POST /api/bulk-products`](api/bulk-products.js:78)
   - 驗證商品匯入路徑是否可用

2. [`POST /api/rfid-webhook`](api/rfid-webhook.js:279)
   - 驗證事件寫入與 debounced 路徑是否可用

依據：[`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:58)

---

## 額外檢查

### 命名是否一致
- 一致。M9 不新增 API 命名，不引入新詞彙。

### 是否符合既有欄位命名規則
- 符合。M9 只驗證既有 API 與資料欄位，不更改命名。

### 是否足以支撐前端畫面
- 足夠。M9 透過驗證既有 API 可用性確保前端在部署環境可運作。

### 是否有過度設計
- 無。M9 維持零新增端點，符合模組邊界。

### 是否缺少必要 API
- 以既定 M9 範圍判定不缺少必要 API。  
- 若未來要自動化健康檢查，可能需要新端點，但目前不在既定規格內。

