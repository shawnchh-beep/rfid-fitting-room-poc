# M5 模組規格 v2 在場快照與 Session 管理

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m5_spec.md`](plans/archive_v1/module_m5_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 前置基線：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)、[`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)、[`plans/module_m4_spec_v2.md`](plans/module_m4_spec_v2.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 維持商品在試衣間的即時在場快照，提供前台與 Dashboard 同步狀態來源。
- 正確開關 `fitting_room_sessions`，作為轉化與補貨分析上游資料。
- 對齊 v2 狀態語意，不將 `left_fitting_room` 作為 `current_status`。

## 2. 模組邊界
### 做什麼
- 依事件流更新 `fitting_room_presence` 的 `entered_at` 與 `last_seen_at`。
- 依進出試衣間行為開啟與關閉 `fitting_room_sessions`。
- 在離場或轉區時關閉進行中的 session。

### 不做什麼
- 不做商品主檔匯入。
- 不做前台拖拉互動 UI 設計。
- 不在本模組計算轉化率 KPI 或補貨建議數量。

## 3. 涉及角色與權限
- `trial`：可透過前台互動間接觸發事件，不可匯入資料。
- `user`：可觸發互動事件與匯入流程。
- `admin`：可執行完整操作與管理檢視。
- `service_backend`：執行 presence 與 session 寫入。

## 4. 涉及資料表
- `fitting_room_presence`
- `fitting_room_sessions`
- `rfid_events` 作為觸發來源

v2 語意重點：
- session 結束可由事件語意標記 `left_fitting_room`。
- 商品 `current_status` 不得採 `left_fitting_room`。

## 5. 涉及 API
- [`api/rfid-webhook.js`](api/rfid-webhook.js:280)
- 透過既有 webhook 流程驅動 presence upsert、clear 與 session 開關。

## 6. 涉及頁面
- 事件觸發來源
  - [`public/js/main.js`](public/js/main.js:770)
  - [`public/js/main.js`](public/js/main.js:1148)
- 狀態消費頁面
  - [`public/js/main.js`](public/js/main.js:700)

## 7. 核心流程
1. 接收標準化事件與商品鍵。
2. 若商品進入試衣間，更新 `fitting_room_presence`。
3. 依 segmentation 規則判定是否開新 session。
4. 若商品離開試衣間或進入其他區域，清除 presence 並關閉 session。
5. 回傳包含 presence 狀態的 API 結果供前台刷新。

## 8. 業務規則
- 在場規則
  - presence 以 `entered_at` 與 `last_seen_at` 維持。
- session 規則
  - 同一商品不可同時存在多筆 open session。
  - 離場時必須關閉 open session。
- 狀態規則
  - `left_fitting_room` 為事件或結束語意，不作商品當前狀態。

## 9. 驗收標準
- 商品進入試衣間可看到 presence 建立與 heartbeat 更新。
- 商品離開試衣間後 presence 清除，session 正常關閉。
- 多次進入離開可形成多段 session 並可追溯。
- API 回應可讀到 `presence.product_key` 與在場判定。

## 10. 與其他模組的依賴
- 前置依賴
  - [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
  - [`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
  - [`plans/module_m4_spec_v2.md`](plans/module_m4_spec_v2.md)
- 後續依賴
  - M6 轉化計算依賴 session 正確開關。
  - M8 即時看板依賴 presence 正確性。
  - M9 分析與建議依賴 session 完整度。

---

## 補充 1 規格仍不足
- session `ended_by` 完整枚舉與寫入時機尚未定版。
- segmentation gap 可配置策略尚未定義。
- heartbeat 異常斷訊恢復規則尚未定義。

## 補充 2 直接開發易返工區
- 在 ended reason 未定義前先做複雜報表欄位。
- 在 segmentation 規則未固定前先做 session 拆分優化。
- 忽略相容資料直接調整舊 session 結構。

## 補充 3 開發前需先確認
- session 關閉時間採事件時間或伺服器時間。
- 是否需要保留 presence 清除審計紀錄。
- `trial` 行為是否需額外節流以防止事件洪水。
