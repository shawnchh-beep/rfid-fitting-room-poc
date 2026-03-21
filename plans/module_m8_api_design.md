# M8 API 設計記錄

依據 [`plans/module_m8_spec.md`](plans/module_m8_spec.md:1)、[`plans/module_m8_data_structure.md`](plans/module_m8_data_structure.md:1)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:1)、[`public/js/main.js`](public/js/main.js:752) 整理。

## 規格不足先行標示

- M8 目前無獨立查詢 API 規格，前端以既有資料來源查詢與 Realtime 組裝。  
- 需求中的商品分析排行區塊未有對應查詢 API 契約。  
- 事件流分頁與伺服器端查詢規則未獨立定義。

---

## M8 API 設計結論

> M8 為 Dashboard 檢視模組，依既定規格 **不新增新 API 端點**。  
> M8 使用既有 API 產生的資料，並在前端進行查詢整併與渲染。

---

## 逐項輸出

### 1 API 名稱
- 無新增 API（M8 不定義新端點）

### 2 Method
- 無

### 3 路徑
- 無

### 4 功能說明
- M8 職責是顯示與監控，不是提供新寫入或新查詢服務端點。

### 5 請求參數
- 無

### 6 回應格式
- 無

### 7 錯誤格式
- 無

### 8 權限要求
- M8 不新增 API 權限。
- 依賴資料來源與既有 API 權限如下：
  - `viewer` `analyst_admin` 可讀取展示資料
  - 事件寫入仍由既有 [`/api/rfid-webhook`](api/rfid-webhook.js:279) 控制

來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:33)

### 9 驗證規則
- M8 不新增 API 驗證規則。
- 沿用既有資料欄位驗證與事件寫入規則。

### 10 分頁 / 搜尋 / 排序規則
- 不適用於新增 API（因 M8 無新增端點）。
- 現況事件列表筆數限制由前端控制，非 API 分頁規格。

---

## M8 依賴的既有 API 與資料來源（非新增）

1. 事件來源 API  
- `POST /api/rfid-webhook`  
- 作用：提供 M8 事件流與狀態變動資料來源

2. 商品準備 API  
- `POST /api/bulk-products`  
- 作用：提供 M8 所需商品主資料

3. 前端查詢整併  
- 在 [`public/js/main.js`](public/js/main.js:851) 查詢 `products` `product_translations` `rfid_events` `fitting_room_presence` `fitting_room_sessions`，供 M8 顯示

---

## 額外檢查

### 命名是否一致
- 一致，M8 不新增 API 命名，沿用凍結欄位命名。

### 是否符合既有欄位命名規則
- 符合 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:7) 的凍結口徑。

### 是否足以支撐前端畫面
- 足夠支撐目前 M8 核心畫面：KPI 與事件流。  
- 若後續需要排行分析，現況 API 規格仍不足。

### 是否有過度設計
- 無。未新增端點，符合 M8 模組邊界。

### 是否缺少必要 API
- 以目前確認範圍判定不缺少必要 API。  
- 若要實作需求中的排行分析區塊，將需要額外查詢 API 規格，但該需求尚未定稿。

