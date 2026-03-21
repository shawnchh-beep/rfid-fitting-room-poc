# M1 API 設計記錄

依據 [`plans/module_m1_spec.md`](plans/module_m1_spec.md:1)、[`plans/module_m1_data_structure.md`](plans/module_m1_data_structure.md:1)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:1) 整理。

> 結論先行：M1 模組為治理與規格凍結層，**不新增業務 API**。  
> M1 僅凍結既有 API 契約，供後續模組遵循。

## M1 API 清單

- 無新增 API

---

## 逐項輸出

### 1 API 名稱
- 無（M1 不定義新 API）

### 2 Method
- 無

### 3 路徑
- 無

### 4 功能說明
- M1 功能為凍結規格，不提供業務操作端點。

### 5 請求參數
- 無

### 6 回應格式
- 無

### 7 錯誤格式
- 無

### 8 權限要求
- M1 不新增 API 權限。
- 僅凍結既有 API 權限基線：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:26)

### 9 驗證規則
- M1 不新增請求驗證規則。
- 僅凍結既有 API 驗證規則：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:20)

### 10 分頁 搜尋 排序規則
- 不適用（M1 無 API）

---

## 額外檢查

### 命名是否一致
- 一致。M1 不新增 API，故不引入新命名。

### 是否符合既有欄位命名規則
- 符合。M1 只引用既有命名凍結：`epc_data`、`timestamp`、`left_at`、`from_zone`、`to_zone`。

### 是否足以支撐前端畫面
- M1 本身不直接支撐畫面 API；前端畫面由既有 API 契約支撐，M1 作用是確保口徑穩定。

### 是否有過度設計
- 無。M1 採零新增 API，符合模組邊界最小化。

### 是否缺少必要 API
- 以 M1 職責而言無缺少。  
- 若要求 M1 提供新 API，將與 M2 M3 M4 職責重疊並造成邊界破壞。

---

## 規格不足先行標示

- M1 需依賴的「規格變更流程」目前僅文件約束，未定義機制化流程。  
- 該不足不屬 M1 API 功能缺口，而是治理流程缺口。

