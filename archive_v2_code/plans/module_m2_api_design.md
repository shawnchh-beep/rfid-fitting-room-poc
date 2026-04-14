# M2 API 設計記錄

依據 [`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)、[`plans/module_m2_data_structure.md`](plans/module_m2_data_structure.md:1)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:1) 整理。

> 結論先行：M2 為資料模型與遷移基線模組，**不新增業務 API**。  
> M2 僅要求既有 API 在新舊 schema 上保持相容可用。

## M2 API 清單

- 無新增 API
- 受 M2 影響需驗證相容性的既有 API：
  - [`POST /api/rfid-webhook`](api/rfid-webhook.js:279)
  - [`POST /api/bulk-products`](api/bulk-products.js:78)

---

## 逐項輸出

### 1 API 名稱
- 無（M2 不定義新 API）

### 2 Method
- 無

### 3 路徑
- 無

### 4 功能說明
- M2 功能是資料結構凍結與遷移，不承擔新增 API 的業務職責。

### 5 請求參數
- 無

### 6 回應格式
- 無

### 7 錯誤格式
- 無

### 8 權限要求
- M2 不新增 API 權限。
- 沿用既有 API 權限矩陣：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:26)

### 9 驗證規則
- M2 不新增驗證規則。
- 既有規則仍由 API 實作維持：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:20)

### 10 分頁 搜尋 排序規則
- 不適用（M2 無新增 API）

---

## 額外檢查

### 命名是否一致
- 一致。M2 僅凍結並驗證既有命名，未引入新命名。

### 是否符合既有欄位命名規則
- 符合。沿用凍結口徑 `epc_data`、`timestamp`、`left_at`、`from_zone`、`to_zone`。參照 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:7)

### 是否足以支撐前端畫面
- 足夠。M2 透過確保既有 API 與 schema 相容，間接支撐前端查詢與渲染。

### 是否有過度設計
- 無。M2 採零新增 API，符合模組責任。

### 是否缺少必要 API
- 以 M2 職責判定無缺少。  
- M2 需要的是「遷移驗證流程」，不是新增 API 功能。

---

## 規格不足先行標示

- M2 對「遷移後驗證檢查點」目前多在 SQL 文件描述，缺一份專用 migration checklist 文件。  
- 此為流程文件不足，不是 API 功能缺口。

