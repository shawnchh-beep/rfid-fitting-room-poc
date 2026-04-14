# M8 模組規格 Dashboard 與事件流檢視

## 1. 模組目標
- 提供可讀的即時 Dashboard 與歷史事件流，讓營運與展示角色可直接理解目前狀態、異常停留與轉化指標。
- 依據 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:336)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:79)、[`public/js/main.js`](public/js/main.js:752)。

## 2. 模組邊界
### 做什麼
- 顯示 KPI：總數、試穿中、異常、結帳、今日試穿、今日成交、今日轉化率。
- 顯示歷史事件流，包含 `event_type`、`from_zone`、`to_zone`、`timestamp`、`epc`。
- 透過 Realtime 與手動刷新維持畫面更新。
- 以商品資料與翻譯資料渲染可讀名稱。

### 不做什麼
- 不做進階分析區塊如排行與平均停留（需求有列但非本模組最小範圍）。
- 不做新事件寫入入口。
- 不做權限登入流程。

邊界來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:360)、[`plans/module_m7_spec.md`](plans/module_m7_spec.md:1)。

## 3. 涉及角色與權限
- `viewer`：主要讀取 Dashboard 與事件流。
- `analyst_admin`：讀取並做營運判讀。
- `demo_operator`：可在操作後觀察回饋。
- `service_backend`：提供資料寫入來源。

權限依據：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:33)。

## 4. 涉及資料表
- `products`
- `product_translations`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

欄位口徑依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24)。

## 5. 涉及 API
- 讀取資料來源為 Supabase 查詢與 Realtime 訂閱流程：[`public/js/main.js`](public/js/main.js:752)
- 事件來源 API（間接依賴）：[`api/rfid-webhook.js`](api/rfid-webhook.js:279)
- 商品來源 API（間接依賴）：[`api/bulk-products.js`](api/bulk-products.js:78)

## 6. 涉及頁面
- Dashboard 與 KPI 容器：[`public/index.html`](public/index.html:20)
- 歷史事件流區塊：[`public/index.html`](public/index.html:101)
- 前端資料整併與渲染：[`public/js/main.js`](public/js/main.js:473)

## 7. 核心流程
1. 初始化連線並建立 Realtime 訂閱：[`public/js/main.js`](public/js/main.js:829)
2. 讀取 `products`、`rfid_events`、`product_translations`、`fitting_room_presence`、當日 session 與 sale 事件：[`public/js/main.js`](public/js/main.js:851)
3. 建立 latest event map 與 presence map，推導看板狀態：[`public/js/main.js`](public/js/main.js:432)
4. 計算 KPI 並更新畫面：[`public/js/main.js`](public/js/main.js:532)
5. 寫入或收到新事件時更新事件流顯示：[`public/js/main.js`](public/js/main.js:813)

## 8. 業務規則
- 看板狀態推導以 presence 為優先，事件為輔。
- KPI 轉化率依「今日已轉化 session 數 / 今日試穿 session 總數」。
- 事件流必須顯示事件語意與區域遷移資訊。
- 前台可讀展示以商品可理解資訊優先。
- `fitting_room_presence` 僅作即時快照來源，不作歷史追溯依據；歷史追溯以 `rfid_events` 為準。

規則來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:165)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:79)。

## 9. 驗收標準
- KPI 可穩定顯示需求列出的核心數值。
- 事件流每筆可見 `event_type`、`from_zone`、`to_zone`、`timestamp`、`epc`。
- Realtime 新事件到達時畫面可自動更新。
- 手動刷新可重建與資料庫一致的畫面狀態。

驗收對照：[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:79)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:91)。

## 10. 與其他模組的依賴
- 前置依賴：
  - M1 基線治理與規格凍結：[`plans/module_m1_spec.md`](plans/module_m1_spec.md:1)
  - M2 資料模型與遷移基線：[`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)
  - M4 事件接收與標準化：[`plans/module_m4_spec.md`](plans/module_m4_spec.md:1)
  - M5 在場快照與 Session 管理：[`plans/module_m5_spec.md`](plans/module_m5_spec.md:1)
  - M6 轉化計算與 KPI 引擎：[`plans/module_m6_spec.md`](plans/module_m6_spec.md:1)
- 與 M7 關係：M7 提供操作事件來源，M8 提供監控與可視化檢視。

---

## 補充 1 規格仍不足
- 需求提到商品分析區塊排行，但未有 v1 最小欄位與查詢定義。
- Dashboard 營運層與技術層切換方式未在頁面規格明確定義。
- 事件流分頁與保留筆數規格未獨立文件化。

## 補充 2 直接開發易返工區
- 未先鎖定 KPI 口徑就擴充更多指標卡。
- 未先明確分析區塊需求即實作排行會重做。
- 在事件欄位未統一前就優化事件流格式，後續會重排。

## 補充 3 開發前需先確認
- M8 v1 是否僅交付核心 KPI 與事件流，不含排行分析。
- 事件流顯示筆數是否維持現行前端限制。
- Dashboard 是否需要正式區分營運檢視與技術檢視切換 UI。
