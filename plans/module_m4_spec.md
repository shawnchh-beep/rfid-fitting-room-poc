# M4 模組規格 事件接收與標準化

## 1. 模組目標
- 將前台拖拉與模擬輸入統一轉為標準事件格式，確保事件可追蹤、可統計、可被後續模組消費。
- 依據 [`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:64)、[`api/rfid-webhook.js`](api/rfid-webhook.js:279)。

## 2. 模組邊界
### 做什麼
- 接收 [`POST /api/rfid-webhook`](api/rfid-webhook.js:279) 請求。
- 解碼 EPC 並建立商品鍵。
- 依 `reader_id` 與可選欄位推導 `event_type` `event_source` `from_zone` `to_zone`。
- 執行 3 秒 debounce。
- 寫入 `rfid_events`，並保留舊 schema fallback 相容。

### 不做什麼
- 不處理商品主檔匯入。
- 不做前台拖拉 UI 行為設計。
- 不做報表分析與排行邏輯。

邊界來源：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:129)。

## 3. 涉及角色與權限
- `demo_operator`：可觸發事件寫入路徑。
- `analyst_admin`：可觸發測試事件寫入路徑。
- `service_backend`：實際執行資料寫入。
- `viewer`：不可呼叫寫入 API。

權限來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:26)。

## 4. 涉及資料表
- `rfid_events`（主表）
- `fitting_room_presence`（本 API 路徑會更新）
- `fitting_room_sessions`（本 API 路徑會開關 session）

主要事件欄位口徑依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:64)。

## 5. 涉及 API
- [`POST /api/rfid-webhook`](api/rfid-webhook.js:279)
  - Request 與回應規格：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:20)
  - Debounced 回應：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:61)
  - Error Codes：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:74)

## 6. 涉及頁面
- 前台模擬送事件：[`public/index.html`](public/index.html:85)
- 拖拉同步呼叫 webhook：[`public/js/main.js`](public/js/main.js:705)
- 手動模擬送事件：[`public/js/main.js`](public/js/main.js:935)

## 7. 核心流程
1. 接收 webhook 請求並解析 body：[`api/rfid-webhook.js`](api/rfid-webhook.js:282)
2. 解碼 EPC 並建立 `product_key`：[`api/rfid-webhook.js`](api/rfid-webhook.js:293)
3. 標準化事件封裝：[`api/rfid-webhook.js`](api/rfid-webhook.js:25)
4. 執行 3 秒 debounce 查詢：[`api/rfid-webhook.js`](api/rfid-webhook.js:305)
5. 若 debounced，回傳 ignored 並維持必要 heartbeat 更新：[`api/rfid-webhook.js`](api/rfid-webhook.js:361)
6. 若非 debounced，寫入 `rfid_events`：[`api/rfid-webhook.js`](api/rfid-webhook.js:369)
7. 更新 presence / session 並回傳 success：[`api/rfid-webhook.js`](api/rfid-webhook.js:387)

## 8. 業務規則
- `event_type` 與 `event_source` 可由請求提供，未提供則由系統推導與預設。
- debounce 規則：同 `epc_data + reader_id` 3 秒內不重複入歷史事件。
- `rfid_events` 若缺擴充欄位，允許 fallback 寫舊欄位模式。
- `sale_completed` 路徑可觸發轉化標記嘗試。

來源：[`api/rfid-webhook.js`](api/rfid-webhook.js:29)、[`api/rfid-webhook.js`](api/rfid-webhook.js:54)、[`api/rfid-webhook.js`](api/rfid-webhook.js:439)。

## 9. 驗收標準
- 可成功接收並寫入標準化事件欄位 `event_type` `event_source` `from_zone` `to_zone`。
- 同條件重複事件在 3 秒內回 `status=ignored` 與 `reason=debounced`。
- 回傳 `status=success` 時含 event 與 presence 區塊。
- 舊 schema 環境不致阻斷整條寫入路徑。

驗收對照：[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:22)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:50)。

## 10. 與其他模組的依賴
- 前置依賴：
  - M1 基線治理與規格凍結：[`plans/module_m1_spec.md`](plans/module_m1_spec.md:1)
  - M2 資料模型與遷移基線：[`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)
- 後續依賴：
  - M5 在場與 Session 管理依賴 M4 事件輸入穩定。
  - M6 KPI 與轉化計算依賴 M4 事件語意一致。
  - M8 歷史事件流依賴 M4 欄位完整。

---

## 補充 1 規格仍不足
- `event_type` 在部分轉移情境的唯一判定優先序未形成獨立決策表。
- 錯誤碼粒度目前偏粗，主要以 500 匯總，缺分類字典。
- `event_source` 在不同入口的治理規則未有獨立文件。

## 補充 2 直接開發易返工區
- 未先固定事件判定優先序就擴充新入口來源。
- 未先固定錯誤碼分類就做前端錯誤處理分支。
- 忽略 legacy fallback 相容直接改寫 schema 會影響舊環境。

## 補充 3 開發前需先確認
- 各入口是否一律要求傳 `event_type`，或持續允許推導模式。
- debounce 3 秒規則是否作為固定值，不在 M4 內調整。
- 是否接受 v1 階段維持現有 500 錯誤聚合策略。

