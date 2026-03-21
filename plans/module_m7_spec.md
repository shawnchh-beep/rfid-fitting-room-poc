# M7 模組規格 前台互動看板

## 1. 模組目標
- 提供可展示且可操作的前台互動看板，讓使用者以拖拉方式模擬商品在 `RACK`、`FITTING_ROOM`、`CHECKOUT` 的流轉，並與後端事件同步。
- 依據 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:86)、[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:319)、[`public/js/main.js`](public/js/main.js:634)。

## 2. 模組邊界
### 做什麼
- 渲染三欄拖拉看板與商品卡。
- 支援拖拉動作與完成銷售按鈕。
- 拖拉與按鈕操作需呼叫 webhook 同步事件。
- 顯示 SKU 優先、EPC 次要、圖片顯示與無圖占位。
- 支援 Demo Operational 模式與 overstay 門檻 UI。

### 不做什麼
- 不實作真實 RFID Reader 硬體輸入。
- 不做進階報表分析與排行。
- 不做複雜權限管理與登入流程。

邊界來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:136)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:11)。

## 3. 涉及角色與權限
- `demo_operator`：主要操作拖拉與銷售模擬。
- `viewer`：可讀展示畫面，不執行寫入操作。
- `analyst_admin`：可操作與觀察結果。
- `service_backend`：由 API 寫入資料。

權限依據：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:26)。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

資料口徑依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24)。

## 5. 涉及 API
- [`POST /api/rfid-webhook`](api/rfid-webhook.js:279)
  - 拖拉同步 `event_type` `event_source` `from_zone` `to_zone`。
- （輔助）[`POST /api/bulk-products`](api/bulk-products.js:78)
  - 用於先備商品資料。

規格依據：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:83)。

## 6. 涉及頁面
- 主頁骨架：[`public/index.html`](public/index.html:19)
- 看板與互動邏輯：[`public/js/main.js`](public/js/main.js:473)
- 看板樣式：[`public/css/style.css`](public/css/style.css:121)

## 7. 核心流程
1. 載入商品、事件、在場資料並渲染看板：[`public/js/main.js`](public/js/main.js:752)
2. 使用者拖拉商品卡跨欄：[`public/js/main.js`](public/js/main.js:696)
3. 前端先做暫態顯示，再呼叫 webhook 同步：[`public/js/main.js`](public/js/main.js:711)
4. webhook 成功後重抓資料重渲染：[`public/js/main.js`](public/js/main.js:717)
5. 若失敗則回滾暫態並顯示錯誤：[`public/js/main.js`](public/js/main.js:720)
6. 在 `CHECKOUT` 可點完成銷售，送出 `sale_completed`：[`public/js/main.js`](public/js/main.js:637)

## 8. 業務規則
- 拖拉不能只改畫面，必須寫入事件。
- 事件映射：
  - `RACK -> FITTING_ROOM` 對應 `enter_fitting_room`
  - `FITTING_ROOM -> RACK` 對應 `exit_fitting_room`
  - `* -> CHECKOUT` 對應 `move_to_checkout`
  - 完成銷售對應 `sale_completed`
- `event_source` 前台拖拉固定為 `demo_drag`。
- 前台展示以 SKU 為主，EPC 為輔。

依據：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:321)、[`public/js/main.js`](public/js/main.js:662)、[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:150)。

## 9. 驗收標準
- 可完成拖拉進試衣間、拖回賣場、拖到結帳與完成銷售。
- 每次操作都可在後端事件流看到對應事件。
- 前台卡片符合 SKU 主顯示、EPC 次顯示、圖片可見或占位。
- 模式切換與門檻調整可影響異常停留判定。

驗收對照：[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:22)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:60)。

## 10. 與其他模組的依賴
- 前置依賴：
  - M1 基線治理與規格凍結：[`plans/module_m1_spec.md`](plans/module_m1_spec.md:1)
  - M2 資料模型與遷移基線：[`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)
  - M3 商品主檔與批次匯入：[`plans/module_m3_spec.md`](plans/module_m3_spec.md:1)
  - M4 事件接收與標準化：[`plans/module_m4_spec.md`](plans/module_m4_spec.md:1)
- 後續依賴：
  - M8 事件流與看板監控依賴 M7 操作路徑穩定。

---

## 補充 1 規格仍不足
- 操作角色在前台是否需要顯式登入態，需求未定義。
- 拖拉衝突情境如同時多人操作處理規格未定。
- 圖片來源失效時的 fallback 文案規格未獨立定義。

## 補充 2 直接開發易返工區
- 未固定拖拉映射表即擴充新欄位或新區域。
- 未固定 optimistic 更新回滾規則就做 UI 優化。
- 在角色操作邊界未定前先做前端權限控制分支。

## 補充 3 開發前需先確認
- 前台是否只保留目前三欄 `RACK` `FITTING_ROOM` `CHECKOUT`。
- 模式與門檻設定是否僅作用於前台判定顯示。
- 銷售完成按鈕是否維持僅在 `CHECKOUT` 顯示。

