# M7 模組規格 v2 前台互動看板

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m7_spec.md`](plans/archive_v1/module_m7_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 前置基線：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)、[`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)、[`plans/module_m3_spec_v2.md`](plans/module_m3_spec_v2.md)、[`plans/module_m4_spec_v2.md`](plans/module_m4_spec_v2.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 提供可展示且可操作的 v2 前台互動場景，符合 2D 卡通門市平面圖方向。
- 讓拖拉與點擊行為可同步後端事件，不只改畫面。
- 落實 v2 角色限制，前台顯示角色僅 `trial`、`user`、`admin`。

## 2. 模組邊界
### 做什麼
- 渲染門市 2D 場景與互動區塊。
- 支援商品拖拉於 `RACK`、`FITTING_ROOM`、`CHECKOUT` 間移動。
- 點擊商品顯示詳情浮層。
- 拖拉與成交動作需同步呼叫 webhook。

### 不做什麼
- 不做真實 RFID 硬體串接。
- 不做進階 BI 報表頁。
- 不在 M7 內實作補貨建議公式。

## 3. 涉及角色與權限
- `trial`
  - 可操作前台拖拉與檢視 Dashboard。
  - 不可使用 CSV 匯入。
- `user`
  - 可操作前台與匯入。
- `admin`
  - 可操作全部前台功能與管理功能。
- `service_backend`
  - 僅 API 內部角色，不出現在前台角色切換。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

狀態語意重點：
- `left_fitting_room` 為事件或 session 結束語意。
- `checkout` 為未完成交易狀態。
- `sold` 為交易完成最終狀態。

## 5. 涉及 API
- [`api/rfid-webhook.js`](api/rfid-webhook.js:280)
- [`api/bulk-products.js`](api/bulk-products.js:79)

M7 不新增 API，沿用既有端點完成互動同步。

## 6. 涉及頁面
- 主頁與場景容器
  - [`public/index.html`](public/index.html:20)
- 互動邏輯
  - [`public/js/main.js`](public/js/main.js:809)
  - [`public/js/main.js`](public/js/main.js:702)
- 場景樣式
  - [`public/css/style.css`](public/css/style.css)

## 7. 核心流程
1. 載入商品與事件資料並渲染場景。
2. 使用者拖拉商品卡至目標區域。
3. 前端先做暫態更新，再呼叫 webhook 同步事件。
4. 成功時重抓資料刷新畫面，失敗則回滾。
5. 在 `CHECKOUT` 區可執行完成銷售，觸發 `sale_completed`。
6. 點擊商品可開啟詳情浮層展示關鍵資訊。

## 8. 業務規則
- 拖拉事件必須落地事件流，不可只改前台狀態。
- 事件映射
  - `RACK -> FITTING_ROOM` 對應 `enter_fitting_room`
  - `FITTING_ROOM -> RACK` 對應 `exit_fitting_room`
  - `* -> CHECKOUT` 對應 `move_to_checkout`
  - 完成銷售對應 `sale_completed`
- 顯示規則
  - 商品資訊以 SKU 或名稱為主，EPC 為輔。
  - 圖片缺失需顯示占位視覺。

## 9. 驗收標準
- 可完成拖拉進試衣間、拖回賣場、拖到結帳、完成銷售。
- 每次互動均可在事件流看到對應事件。
- 角色限制符合 v2 定義，`trial` 無法使用匯入。
- 商品詳情浮層可正確顯示商品與狀態資訊。
- 前台為 2D 場景導向，不回退成純儀表板列表。

## 10. 與其他模組的依賴
- 前置依賴
  - [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
  - [`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
  - [`plans/module_m3_spec_v2.md`](plans/module_m3_spec_v2.md)
  - [`plans/module_m4_spec_v2.md`](plans/module_m4_spec_v2.md)
  - [`plans/module_m5_spec_v2.md`](plans/module_m5_spec_v2.md)
  - [`plans/module_m6_spec_v2.md`](plans/module_m6_spec_v2.md)
- 後續依賴
  - M8 看板指標與事件流檢視依賴 M7 互動資料完整性。

---

## 補充 1 規格仍不足
- 登入頁細節流程與 token 保存策略尚未定版。
- 前台多人同時拖拉衝突規則尚未定義。
- 圖片資產管理規則尚未文件化。

## 補充 2 直接開發易返工區
- 未先鎖定角色限制就做前端權限 UI。
- 未固定事件映射就擴充新區域。
- 未固定狀態語意就調整商品卡狀態徽章。

## 補充 3 開發前需先確認
- 登入成功後角色來源是否以 token claim 為唯一依據。
- `trial` 是否允許切換語言與模式設定。
- 是否保留舊資料欄位在前台除錯面板顯示。
