# M9 模組規格 部署與運維驗證

## 1. 模組目標
- 建立可重現的部署與 smoke 驗證流程，確保 v1 在目標環境可穩定運作。
- 依據 [`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:1) 與需求架構原則 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:53)。

## 2. 模組邊界
### 做什麼
- 定義 Vercel 部署前置檢查與環境變數設定。
- 定義上線 smoke 流程，覆蓋首頁、匯入、webhook、realtime、事件流。
- 定義常見故障排查入口與檢查順序。

### 不做什麼
- 不新增業務功能或資料模型。
- 不修改核心 API 與前端互動邏輯。
- 不納入真實硬體 Reader 串接驗證。

邊界來源：[`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:9)、[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:136)。

## 3. 涉及角色與權限
- `service_backend`：部署與環境變數配置。
- `analyst_admin`：執行 smoke 與結果判讀。
- `viewer`：僅驗證展示可讀性。

權限來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:24)。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

M9 不改表，只驗證上述表在部署環境可支撐功能。

## 5. 涉及 API
- [`api/rfid-webhook.js`](api/rfid-webhook.js:279)
- [`api/bulk-products.js`](api/bulk-products.js:78)

驗證流程依 [`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:58)。

## 6. 涉及頁面
- 主頁：[`public/index.html`](public/index.html:19)
- 互動與資料讀取邏輯：[`public/js/main.js`](public/js/main.js:970)

## 7. 核心流程
1. 設定部署環境變數並確認目標環境。
2. 部署後連線首頁，驗證 Supabase 可連線。
3. 執行 CSV 匯入 smoke。
4. 發送 webhook 事件並檢查回應 success 或 debounced。
5. 驗證事件流與看板是否更新。
6. 執行 Realtime 多視窗驗證。
7. 若失敗，按 runbook 故障路徑排查。

流程依據：[`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:58)、[`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:69)。

## 8. 業務規則
- 部署驗證需覆蓋「資料寫入 + 畫面更新 + 即時同步」完整鏈路。
- smoke 結果以 API 回應與畫面可觀測結果共同判定。
- 若核心 API 任一不可用，視為部署未通過。

## 9. 驗收標準
- 可完成 runbook 的最小 smoke 步驟且無阻斷錯誤。
- `/api/bulk-products` 與 `/api/rfid-webhook` 可正常回應。
- 看板與事件流可反映最新事件。
- Realtime 訂閱狀態正常。

驗收來源：[`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:58)、[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:98)。

## 10. 與其他模組的依賴
- 前置依賴：M1 至 M8 均需完成核心路徑。
- M9 是整體上線前的整合驗證層，不反向提供業務能力。

---

## 補充 1 規格仍不足
- smoke 測試資料集規模與固定測資版本未在文件定義。
- 部署回滾條件與版本標記規則未定義。
- 監控告警門檻與持續觀測指標未定義。

## 補充 2 直接開發易返工區
- 未固定 smoke 測資即反覆調整驗證結論。
- 未固定回滾規則即直接上線多次會造成流程重做。
- 在核心模組未穩定前先優化部署流程，後續需重跑驗證。

## 補充 3 開發前需先確認
- M9 驗證是否以 [`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:1) 為唯一依據。
- smoke 通過門檻是否採用 AC 全通過或核心 AC 通過即可。
- 是否需要固定一份專用 smoke CSV 與事件樣本供每次部署重複使用。

