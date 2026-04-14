# M6 模組規格 轉化計算與 KPI 引擎

## 1. 模組目標
- 依 v1 定義產出可解釋的試穿轉化計算與 KPI 數值，支撐 Dashboard 顯示。
- 依據 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:301)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:79)、[`api/rfid-webhook.js`](api/rfid-webhook.js:439)。

## 2. 模組邊界
### 做什麼
- 於 `sale_completed` 路徑套用 10 分鐘 conversion window。
- 將 session 標記 `converted_to_sale` 並寫入 `sale_time`。
- 產出 Dashboard 所需 KPI：今日試穿數、今日成交數、今日轉化率。

### 不做什麼
- 不處理跨商品歸因與顧客旅程追蹤。
- 不做 SKU 排行與進階分析報表。
- 不新增需求未定義的歸因模型。

邊界來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:309)、[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:360)。

## 3. 涉及角色與權限
- `analyst_admin`：讀取 KPI 與轉化結果。
- `viewer`：可讀展示層 KPI。
- `service_backend`：在 webhook 路徑寫入轉化標記。
- `demo_operator`：透過操作事件間接觸發轉化判定。

權限來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:33)。

## 4. 涉及資料表
- `fitting_room_sessions`
- `rfid_events`

欄位口徑依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:94)。

## 5. 涉及 API
- [`POST /api/rfid-webhook`](api/rfid-webhook.js:279)
  - `sale_completed` 觸發轉化標記：[`api/rfid-webhook.js`](api/rfid-webhook.js:439)
  - 回傳 `conversion` 區塊：[`api/rfid-webhook.js`](api/rfid-webhook.js:446)

## 6. 涉及頁面
- KPI 顯示與計算：[`public/js/main.js`](public/js/main.js:532)
- KPI 容器：[`public/index.html`](public/index.html:22)

## 7. 核心流程
1. 事件流進入 webhook 並標準化：[`api/rfid-webhook.js`](api/rfid-webhook.js:297)
2. 若事件為 `sale_completed`，查找可轉化 session：[`api/rfid-webhook.js`](api/rfid-webhook.js:227)
3. 符合窗口則更新 `converted_to_sale` 與 `sale_time`：[`api/rfid-webhook.js`](api/rfid-webhook.js:261)
4. 回傳 conversion 結果給前端：[`api/rfid-webhook.js`](api/rfid-webhook.js:455)
5. 前端讀取當日 session 與 sale 事件後計算 KPI：[`public/js/main.js`](public/js/main.js:851)

## 8. 業務規則
- v1 轉化定義：同 EPC 商品在 session 結束後 10 分鐘內成交視為轉化。
- 轉化率公式：已轉化 session 數 除以 試衣 session 總數。
- 不處理跨商品歸因與多件組合歸因。

規則依據：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:301)、[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:306)。

## 9. 驗收標準
- 觸發 `sale_completed` 後，符合窗口的 session 會被標記轉化。
- Dashboard 可顯示今日試穿數、今日成交數、今日轉化率。
- 轉化率口徑與需求公式一致。
- 當沒有可轉化 session 時，回傳可解釋的 skipped reason。

驗收對照：[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:42)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:79)。

## 10. 與其他模組的依賴
- 前置依賴：
  - M1 基線治理與規格凍結：[`plans/module_m1_spec.md`](plans/module_m1_spec.md:1)
  - M2 資料模型與遷移基線：[`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)
  - M4 事件接收與標準化：[`plans/module_m4_spec.md`](plans/module_m4_spec.md:1)
  - M5 在場與 Session 管理：[`plans/module_m5_spec.md`](plans/module_m5_spec.md:1)
- 後續依賴：
  - M8 Dashboard 顯示依賴 M6 KPI 口徑。

---

## 補充 1 規格仍不足
- 今日統計的時區口徑未在需求文件明文定義。
- KPI 的全期間與區間切換規格未定義。
- 轉化失敗 reason 的對外字典未獨立文件化。

## 補充 2 直接開發易返工區
- 未先固定時區口徑就做日報表展示。
- 未先固定轉化 reason 對應就做前端提示分類。
- 在不處理跨商品歸因前先做複雜分析頁會返工。

## 補充 3 開發前需先確認
- 今日 KPI 的時區以哪個系統時間為準。
- v1 是否只維持目前簡化 conversion window，不增加新歸因規則。
- Dashboard 顯示是否僅需需求列出的三個轉化 KPI。

