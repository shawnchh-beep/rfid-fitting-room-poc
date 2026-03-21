# M4 模組規格 v2 事件接收與標準化

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m4_spec.md`](plans/archive_v1/module_m4_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 前置基線：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)、[`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 將前台拖拉與模擬輸入統一為 v2 事件契約，供後續 presence、session、dashboard 一致使用。
- 在不新增 API 的前提下，完成 v2 狀態語意對齊。
- 明確區分事件語意與當前狀態語意，避免 `left_fitting_room` 被誤當 `current_status`。

## 2. 模組邊界
### 做什麼
- 接收既有 webhook 事件並標準化欄位。
- 保留 debounce 機制與既有相容寫入路徑。
- 產出可供 M5、M6、M8、M9 消費的穩定事件資料。

### 不做什麼
- 不新增商品匯入流程。
- 不新增前台場景 UI 元件。
- 不在本模組計算補貨建議數量。

## 3. 涉及角色與權限
- `trial`：可觸發前台模擬事件，但不得執行 CSV 匯入。
- `user`：可觸發前台模擬事件，且可執行匯入。
- `admin`：可觸發全部可用事件入口。
- `service_backend`：系統內部寫入角色，保留於 API 內部流程。

## 4. 涉及資料表
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

v2 語意凍結：
- `left_fitting_room` 屬於事件或 session 結束語意，不作 `current_status`。
- `checkout` 表示尚未完成銷售。
- `sold` 表示交易完成最終狀態。

## 5. 涉及 API
- [`api/rfid-webhook.js`](api/rfid-webhook.js:280)
- 維持單一入口 `POST /api/rfid-webhook`，不新增端點。
- 事件標準欄位至少包含
  - `event_type`
  - `event_source`
  - `from_zone`
  - `to_zone`

## 6. 涉及頁面
- 事件來源頁面
  - [`public/index.html`](public/index.html:122)
  - [`public/js/main.js`](public/js/main.js:1148)
  - [`public/js/main.js`](public/js/main.js:770)

前台仍以 2D 門市場景互動為主，M4 僅承接事件資料契約。

## 7. 核心流程
1. 接收請求並解析 EPC、reader 與事件相關欄位。
2. 將輸入標準化為 v2 事件封裝。
3. 進行 debounce 檢查。
4. 寫入事件與同步更新 presence。
5. 視事件語意開啟或關閉 session。
6. 回傳 success 或 ignored 結果。

## 8. 業務規則
- debounce 規則維持既有時間窗。
- `left_fitting_room` 不得進入 `current_status`。
- `checkout` 與 `sold` 必須可區分並可追溯。
- 事件標準化失敗時需回傳可判讀錯誤訊息。

## 9. 驗收標準
- webhook 可穩定接收並標準化事件資料。
- 重複事件在時間窗內回傳 `ignored`。
- presence 與 session 會隨事件正確更新。
- `left_fitting_room` 不會出現在商品當前狀態顯示。
- `checkout`、`sold` 的語意在資料層可區分。

## 10. 與其他模組的依賴
- 前置依賴
  - [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
  - [`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
- 後續依賴
  - M5 依賴 M4 事件以維護 presence 與 session。
  - M6 依賴 M4 事件以計算轉化。
  - M8 M9 依賴 M4 事件作分析與建議輸入。

---

## 補充 1 規格仍不足
- `event_source` 的完整枚舉與治理策略尚未定版。
- 事件錯誤碼字典仍需在 API v2 文件統一。
- 前台手動模擬與拖拉事件是否完全同權重仍需定義。

## 補充 2 直接開發易返工區
- 先改 UI 事件格式再改 API 解析規則。
- 未鎖定狀態語意就擴充 Dashboard 指標。
- 忽略舊資料相容欄位直接移除 fallback。

## 補充 3 開發前需先確認
- debounce 規則是否固定值不開放前台設定。
- webhook 對 `trial` 是否需額外速率限制。
- session 結束原因是否統一引用事件字典。
