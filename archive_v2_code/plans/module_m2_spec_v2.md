# M2 模組規格 v2 資料模型與遷移基線

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m2_spec.md`](plans/archive_v1/module_m2_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 前置基線：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
- 關聯規格：[`plans/api_spec_v2.md`](plans/api_spec_v2.md)、[`plans/schema_v2_freeze.md`](plans/schema_v2_freeze.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 建立 v2 可執行資料模型基線，作為 M3 至 M9 唯一資料契約來源。
- 將角色模型與狀態語意落到資料層可驗證規則。
- 保持既有流程可運作，並提供舊口徑至 v2 口徑的相容映射。

## 2. 模組邊界
### 做什麼
- 凍結 v2 核心資料表與必要欄位。
- 定義 `checkout`、`sold`、`left_fitting_room` 的資料語意邊界。
- 定義補貨建議計算所需最小資料輸入來源。
- 定義遷移與相容策略，避免一次性破壞既有查詢。

### 不做什麼
- 不導入新硬體表或 POS ERP 整合表。
- 不在 M2 實作 Dashboard 視覺元件。
- 不在 M2 定義 API 完整 response 格式。
- 不在 M2 導入外部 AI 推論資料欄位。

## 3. 涉及角色與權限
- 前台角色
  - `trial`：可讀取前台與 Dashboard 所需資料，不可觸發 CSV 匯入資料寫入。
  - `user`：可讀取資料，且可觸發 CSV 匯入所需寫入流程。
  - `admin`：可讀寫所有 v2 範圍資料。
- 系統角色
  - `service_backend`：供 webhook 與批次流程寫入。
- 角色基線以 [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md) 為準。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

狀態與事件語意凍結：
- `left_fitting_room` 只作事件語意或 session 結束原因。
- `checkout` 表示流程中未完成交易。
- `sold` 表示已完成交易最終狀態。
- `current_status` 不得使用 `left_fitting_room`。

## 5. 涉及 API
- 不新增 API，沿用既有端點。
- [`api/rfid-webhook.js`](api/rfid-webhook.js:280)
  - 寫入 `rfid_events` 與 `fitting_room_presence`，並驅動 session 生命週期。
- [`api/bulk-products.js`](api/bulk-products.js:79)
  - 寫入商品主檔與單件資料，供補貨計算與前台展示。

## 6. 涉及頁面
- 本模組不直接開發頁面。
- 間接支援
  - [`public/index.html`](public/index.html:20)
  - [`public/js/main.js`](public/js/main.js:948)

重點是確保前台 2D 場景與 Dashboard 查詢有一致資料來源。

## 7. 核心流程
1. 依 M1 v2 基線凍結角色與狀態語意。
2. 凍結 v2 核心資料表欄位與命名。
3. 定義遷移策略與相容欄位對照。
4. 以 webhook 事件流驗證狀態語意。
5. 以近 7 日 sold 與當前庫存驗證補貨計算輸入完整性。

## 8. 業務規則
- 角色規則
  - `trial` 禁止匯入資料寫入。
  - `user` 可執行匯入寫入。
  - `admin` 具完整權限。
- 補貨建議資料規則
  - 固定公式由上層模組使用：`recommended_restock_qty = max(0, sold_7d * 1.2 - current_stock)`。
  - M2 必須確保 `sold_7d` 與 `current_stock` 可由既有表穩定取得。
- 狀態規則
  - `checkout` 與 `sold` 必須可區分。
  - `left_fitting_room` 不得進入商品當前狀態欄位。

## 9. 驗收標準
- 六張核心表在 v2 文件中有明確用途定義。
- 狀態語意與角色語意與 M1 v2 一致，無衝突命名。
- 補貨公式所需欄位來源可追溯，無額外新表依賴。
- webhook 與匯入流程不需新增 API 即可支援 v2。

## 10. 與其他模組的依賴
- 前置依賴：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
- 後續依賴
  - M3 使用商品與匯入資料契約。
  - M4 至 M7 使用事件與 session 契約。
  - M8 與 M9 使用分析與補貨計算輸入契約。

---

## 補充 1 規格仍不足
- `trial` 資料留存期間與清理策略未定。
- 補貨公式結果取整規則尚未定義。
- session `ended_by` 的枚舉值是否擴充尚未定義。

## 補充 2 直接開發易返工區
- 在狀態語意未凍結前先做 dashboard 指標查詢。
- 在角色語意未對齊前先改 API 授權檢查。
- 先做補貨視覺化再回補資料來源口徑。

## 補充 3 開發前需先確認
- `sold_7d` 的統計窗口是否固定以系統時區計算。
- `current_stock` 來源是否固定為 `inventory_items` 即時可用量。
- 相容舊角色映射是否需要落地在資料層審計欄位。
