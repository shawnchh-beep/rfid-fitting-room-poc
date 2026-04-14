# M9 模組規格 v2 部署與運維驗證

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m9_spec.md`](plans/archive_v1/module_m9_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 前置基線：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md) 至 [`plans/module_m8_spec_v2.md`](plans/module_m8_spec_v2.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 建立可重現的 v2 部署與 smoke 驗證流程，確保角色、狀態、補貨建議在目標環境一致運作。
- 將部署驗證範圍從單純功能可用，擴充為含權限邊界與資料語意檢查。
- 提供故障排查與回復順序，降低上線風險。

## 2. 模組邊界
### 做什麼
- 定義部署前檢查清單與環境變數完整性驗證。
- 定義上線後 smoke 流程，覆蓋登入角色、匯入限制、事件流、看板與補貨建議。
- 定義常見故障排查流程與責任邊界。

### 不做什麼
- 不新增業務 API。
- 不修改核心資料模型。
- 不做真實 RFID 硬體壓測驗證。

## 3. 涉及角色與權限
- `trial`：驗證只讀與不可匯入限制。
- `user`：驗證可匯入與可操作前台流程。
- `admin`：驗證完整管理與檢視流程。
- `service_backend`：驗證系統流程可正常寫入。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

M9 不改表，僅驗證資料可支撐 v2 完整路徑。

## 5. 涉及 API
- [`api/rfid-webhook.js`](api/rfid-webhook.js:280)
- [`api/bulk-products.js`](api/bulk-products.js:79)
- 不新增 API，僅驗證既有端點在部署環境可用且符合 v2 角色限制。

## 6. 涉及頁面
- 前台主畫面：[`public/index.html`](public/index.html:20)
- 互動邏輯：[`public/js/main.js`](public/js/main.js:1187)
- 需驗證登入角色分流、匯入限制、事件更新與補貨區塊顯示。

## 7. 核心流程
1. 檢查環境變數與部署目標。
2. 部署後驗證首頁可載入並完成資料連線。
3. 以 `trial` 驗證只讀流程與匯入被拒。
4. 以 `user` 驗證匯入成功與事件同步。
5. 以 `admin` 驗證完整 Dashboard 與補貨建議顯示。
6. 驗證 `checkout`、`sold` 語意呈現與 `left_fitting_room` 不作 `current_status`。
7. 若失敗，依 runbook 路徑排查與回復。

## 8. 業務規則
- 部署 smoke 必須覆蓋角色權限邊界。
- 補貨建議顯示必須採固定公式
  - `recommended_restock_qty = max(0, sold_7d * 1.2 - current_stock)`。
- 任一核心鏈路失敗視為未通過
  - 匯入
  - 事件寫入
  - 看板更新
  - 補貨建議顯示

## 9. 驗收標準
- `/api/bulk-products` 與 `/api/rfid-webhook` 在部署環境可穩定回應。
- `trial` 無法匯入，`user` 與 `admin` 可依規則完成操作。
- 事件流可反映互動事件且狀態語意正確。
- Dashboard 補貨建議可依固定公式產生結果。
- 失敗案例可依 runbook 快速定位問題。

## 10. 與其他模組的依賴
- 前置依賴：M1 至 M8 全部完成並通過基礎驗收。
- M9 為上線前整合驗證層，提供 go or no-go 判定依據。

---

## 補充 1 規格仍不足
- 回滾策略與版本標記規則尚未定版。
- smoke 固定測資版本控管方式尚未定義。
- 生產監控告警門檻尚未文件化。

## 補充 2 直接開發易返工區
- 未先固定角色測試腳本就大量手動測試。
- 未先固定補貨公式驗證樣本就上線比對。
- 在資料口徑未對齊前先做最終部署簽核。

## 補充 3 開發前需先確認
- 上線判定是否需全部核心 smoke 全綠。
- 回滾觸發條件是否由 API 錯誤率驅動。
- 補貨建議驗證是否需固定對照樣本集。
