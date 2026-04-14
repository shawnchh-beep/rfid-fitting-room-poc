# M6 模組規格 v2 轉化計算與 KPI 引擎

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m6_spec.md`](plans/archive_v1/module_m6_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 前置基線：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)、[`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)、[`plans/module_m5_spec_v2.md`](plans/module_m5_spec_v2.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 依 v2 規則計算可解釋的試穿轉化指標，支援 Dashboard 顯示。
- 保留既有 `sale_completed` 觸發邏輯，避免新增 API。
- 為 M8 和 M9 提供一致 KPI 與後續補貨分析所需上游數據。

## 2. 模組邊界
### 做什麼
- 在成交事件路徑套用固定 conversion window 規則。
- 更新 session 轉化標記與成交時間。
- 輸出 Dashboard 所需核心 KPI 計算口徑。

### 不做什麼
- 不做跨商品歸因與顧客旅程建模。
- 不在本模組計算補貨建議數量。
- 不新增需求外的預測模型。

## 3. 涉及角色與權限
- `trial`：可查看 KPI，不可匯入資料。
- `user`：可查看 KPI 並可透過流程觸發成交事件。
- `admin`：可查看並管理 KPI 相關配置與檢視。
- `service_backend`：負責轉化標記寫入。

## 4. 涉及資料表
- `fitting_room_sessions`
- `rfid_events`

核心欄位：
- `converted_to_sale`
- `sale_time`
- `left_at`

## 5. 涉及 API
- [`api/rfid-webhook.js`](api/rfid-webhook.js:280)
- 以既有 `POST /api/rfid-webhook` 的 `sale_completed` 事件觸發轉化更新。

## 6. 涉及頁面
- KPI 顯示頁面
  - [`public/index.html`](public/index.html:22)
  - [`public/js/main.js`](public/js/main.js:601)

M6 只定義數值口徑，不定義最終視覺風格。

## 7. 核心流程
1. webhook 接收並標準化成交事件。
2. 查找可轉化的開啟或最近關閉 session。
3. 若命中 conversion window，寫入 `converted_to_sale` 與 `sale_time`。
4. 回傳 conversion 結果供前台與 dashboard 刷新。
5. 前端彙總當日 session 與成交事件計算 KPI。

## 8. 業務規則
- 轉化規則
  - 同商品在有效窗口內成交視為轉化。
- KPI 規則
  - 今日試穿數 = 今日 session 數。
  - 今日成交數 = 今日成交事件數。
  - 今日轉化率 = 今日已轉化 session 數 / 今日 session 數。
- 狀態語意規則
  - `checkout` 為未完成交易。
  - `sold` 為完成交易最終狀態。

## 9. 驗收標準
- 成交事件可觸發轉化標記更新。
- 無可轉化 session 時可回傳可解釋 skipped 結果。
- Dashboard 可穩定顯示三個核心指標。
- 指標口徑與 M1 M2 規格無衝突。

## 10. 與其他模組的依賴
- 前置依賴
  - [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
  - [`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
  - [`plans/module_m4_spec_v2.md`](plans/module_m4_spec_v2.md)
  - [`plans/module_m5_spec_v2.md`](plans/module_m5_spec_v2.md)
- 後續依賴
  - M8 即時看板消費 KPI。
  - M9 報表與補貨分析參考轉化資料。

---

## 補充 1 規格仍不足
- conversion window 是否可配置尚未定版。
- KPI 日界線時區規則尚未最終定義。
- skipped reason 字典仍需在 API v2 文件統一。

## 補充 2 直接開發易返工區
- 未凍結時區口徑就先做日報 KPI 比較。
- 未定義 reason 字典就先做前台多分支顯示。
- 先做進階歸因再確認 v2 範圍。

## 補充 3 開發前需先確認
- 今日 KPI 的統計時區固定值。
- conversion window 是否沿用既有預設值。
- 是否需要額外曝光 conversion debug 欄位給 admin。
