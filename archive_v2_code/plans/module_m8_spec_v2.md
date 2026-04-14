# M8 模組規格 v2 Dashboard 與事件流檢視

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m8_spec.md`](plans/archive_v1/module_m8_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 前置基線：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)、[`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)、[`plans/module_m6_spec_v2.md`](plans/module_m6_spec_v2.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 提供 v2 即時 Dashboard 與事件流檢視，讓營運可快速理解目前門市互動狀態。
- 統一 KPI 與狀態語意展示，避免前後台口徑分裂。
- 納入 v2 角色可見性規則與補貨建議展示入口。

## 2. 模組邊界
### 做什麼
- 顯示核心 KPI 與事件流。
- 顯示即時在場與狀態摘要。
- 顯示固定公式產生的補貨建議區塊。
- 支援即時更新與手動刷新。

### 不做什麼
- 不新增資料寫入 API。
- 不做進階 BI 報表系統。
- 不在 M8 實作可調式機器學習模型。

## 3. 涉及角色與權限
- `trial`：可查看 Dashboard 與事件流，不可匯入資料。
- `user`：可查看 Dashboard，並可配合匯入流程更新資料。
- `admin`：可查看完整 Dashboard 與管理檢視資訊。
- `service_backend`：提供事件與資料寫入來源，不直接操作 Dashboard。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

狀態語意要求：
- `left_fitting_room` 不作商品當前狀態。
- `checkout` 與 `sold` 必須可區分顯示。

## 5. 涉及 API
- 讀取主要透過 Supabase query 與訂閱流程。
- 間接依賴
  - [`api/rfid-webhook.js`](api/rfid-webhook.js:280)
  - [`api/bulk-products.js`](api/bulk-products.js:79)

M8 不新增端點。

## 6. 涉及頁面
- 主畫面容器：[`public/index.html`](public/index.html:20)
- KPI 與看板渲染：[`public/js/main.js`](public/js/main.js:601)
- 事件流與詳情：[`public/js/main.js`](public/js/main.js:928)

## 7. 核心流程
1. 初始化資料連線並載入商品、事件、presence、session。
2. 推導最新狀態與 KPI。
3. 渲染看板卡片、事件流與商品狀態。
4. 計算並渲染補貨建議資料。
5. 接收即時更新或手動刷新後重算並重繪。

## 8. 業務規則
- KPI 規則沿用 M6。
- 補貨建議固定公式
  - `recommended_restock_qty = max(0, sold_7d * 1.2 - current_stock)`。
- 補貨建議為規則引擎，不宣稱外部 AI 推論。
- `trial` 只讀檢視，不得觸發匯入。

## 9. 驗收標準
- Dashboard 可穩定顯示核心 KPI 與事件流。
- 即時更新與手動刷新都可重建一致畫面。
- 補貨建議可顯示每商品建議數量與計算依據。
- `checkout`、`sold` 顯示語意一致且可區分。
- `trial` 帳號只能看，不可操作匯入。

## 10. 與其他模組的依賴
- 前置依賴
  - [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
  - [`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
  - [`plans/module_m4_spec_v2.md`](plans/module_m4_spec_v2.md)
  - [`plans/module_m5_spec_v2.md`](plans/module_m5_spec_v2.md)
  - [`plans/module_m6_spec_v2.md`](plans/module_m6_spec_v2.md)
  - [`plans/module_m7_spec_v2.md`](plans/module_m7_spec_v2.md)
- 後續依賴
  - M9 進階分析與輸出依賴 M8 口徑穩定。

---

## 補充 1 規格仍不足
- 補貨建議風險等級分層門檻尚未定義。
- 事件流分頁與保留筆數上限尚未定版。
- Dashboard 技術檢視與營運檢視切換細節尚未定義。

## 補充 2 直接開發易返工區
- 未固定公式欄位來源就先做補貨卡 UI。
- 未固定角色讀寫邊界就先做操作按鈕顯示。
- 未定義狀態語意就先做狀態色碼規則。

## 補充 3 開發前需先確認
- 補貨建議是否需要四捨五入或無條件進位。
- Dashboard 是否需要導出 CSV 功能。
- `trial` 在 Dashboard 是否顯示 debug 資訊。
