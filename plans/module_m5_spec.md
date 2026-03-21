# M5 模組規格 在場快照與 Session 管理

## 1. 模組目標
- 維持商品在試衣間的即時在場狀態，並正確建立與關閉試衣 session，提供後續停留與轉化計算基礎。
- 依據 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:291)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:82)、[`api/rfid-webhook.js`](api/rfid-webhook.js:114)。

## 2. 模組邊界
### 做什麼
- 在 webhook 事件流程中維護 `fitting_room_presence` 的 `entered_at`、`last_seen_at`。
- 依進出試衣間行為開啟與關閉 `fitting_room_sessions`。
- 在非試衣間事件時清除在場快照並嘗試關閉開啟中的 session。

### 不做什麼
- 不負責商品主檔匯入。
- 不負責 KPI 聚合與轉化率報表輸出。
- 不新增延後欄位 `ended_by`、`is_overstay`。

邊界來源：[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:112)、[`plans/module_m4_spec.md`](plans/module_m4_spec.md:1)。

## 3. 涉及角色與權限
- `service_backend`：透過 API 寫入 presence 與 sessions。
- `demo_operator`：透過前台操作間接觸發在場與 session 變化。
- `analyst_admin`：可讀取在場與 session 資料做營運檢視。
- `viewer`：僅讀取，不可觸發寫入。

權限來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:33)。

## 4. 涉及資料表
- `fitting_room_presence`
- `fitting_room_sessions`
- `rfid_events`（作為觸發來源事件）

資料欄位口徑依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:82)。

## 5. 涉及 API
- [`POST /api/rfid-webhook`](api/rfid-webhook.js:279)
  - 在場快照 upsert：[`api/rfid-webhook.js`](api/rfid-webhook.js:114)
  - 在場清除：[`api/rfid-webhook.js`](api/rfid-webhook.js:153)
  - session 關閉：[`api/rfid-webhook.js`](api/rfid-webhook.js:186)
  - session 開啟：[`api/rfid-webhook.js`](api/rfid-webhook.js:213)

## 6. 涉及頁面
- 前台拖拉與完成銷售觸發事件路徑：[`public/js/main.js`](public/js/main.js:696)
- Dashboard 依 presence 推導在場狀態：[`public/js/main.js`](public/js/main.js:455)

## 7. 核心流程
1. webhook 收到事件並建立 `product_key`：[`api/rfid-webhook.js`](api/rfid-webhook.js:294)
2. 若為試衣間 reader，upsert `fitting_room_presence`：[`api/rfid-webhook.js`](api/rfid-webhook.js:389)
3. 若判定為新一段試穿，先關舊 session 再開新 session：[`api/rfid-webhook.js`](api/rfid-webhook.js:404)
4. 若為非試衣間事件，刪除 presence 並關閉開啟中 session：[`api/rfid-webhook.js`](api/rfid-webhook.js:427)
5. 回傳包含 `presence` 狀態的 webhook 響應：[`api/rfid-webhook.js`](api/rfid-webhook.js:465)

## 8. 業務規則
- 在場判定依 `entered_at`、`last_seen_at` 維持。
- 連續讀取在 segmentation gap 內視為同次試穿，超過 gap 視為新次試穿。
- 商品離開試衣間或移動到結帳區時，需關閉開啟中的 session。
- 本版 session 欄位不含 `ended_by`、`is_overstay`（屬延後項）。

規則依據：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:291)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:112)、[`api/rfid-webhook.js`](api/rfid-webhook.js:82)。

## 9. 驗收標準
- 進入試衣間後可在 `fitting_room_presence` 看到 `entered_at` 與更新中的 `last_seen_at`。
- 試衣間離場事件後，presence 會清除且 session 關閉時間可讀。
- 連續試穿與重新進入可形成不同 session，`duration_seconds` 可計算。
- webhook 成功回應含 `presence.product_key` 與 `in_fitting_room`。

驗收對照：[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:22)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:36)。

## 10. 與其他模組的依賴
- 前置依賴：
  - M1 基線治理與規格凍結：[`plans/module_m1_spec.md`](plans/module_m1_spec.md:1)
  - M2 資料模型與遷移基線：[`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)
  - M4 事件接收與標準化：[`plans/module_m4_spec.md`](plans/module_m4_spec.md:1)
- 後續依賴：
  - M6 轉化計算依賴 session 正確開關。
  - M8 Dashboard 在場狀態依賴 presence 正確性。

---

## 補充 1 規格仍不足
- `fitting_room_sessions` 的 `ended_by` 與 `is_overstay` 在需求有建議，但 v1 凍結未納入必要欄位。
- segmentation gap 固定值的可配置規格未在 M5 文件獨立定義。
- heartbeat 更新頻率只在需求有描述方向，缺正式參數規格。

依據：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:329)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:112)。

## 補充 2 直接開發易返工區
- 在 `ended_by` 未定版前先做 session 結束原因分析欄位。
- 在 heartbeat 參數未固定前先做異常停留細緻優化。
- 未考慮舊環境缺表相容即直接移除 fallback 路徑。

## 補充 3 開發前需先確認
- segmentation gap 是否維持現值，不在 M5 調整。
- v1 是否接受不落地 `ended_by`、`is_overstay`。
- heartbeat 更新頻率是否沿用現行實作，不新增額外排程。

