# M3 模組規格 v2 商品主檔與批次匯入

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m3_spec.md`](plans/archive_v1/module_m3_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 前置基線：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)、[`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 建立 v2 商品資料入口，支援前台場景展示與後台 Dashboard 分析。
- 將匯入權限與角色模型對齊 v2 定義，落實 trial 限制。
- 維持與既有匯入 API 相容，不額外擴張 API 面向。

## 2. 模組邊界
### 做什麼
- 透過既有匯入流程寫入 `products`、`product_translations`、`inventory_items`。
- 定義 CSV 欄位契約與錯誤回饋最小格式。
- 定義資料去重與覆蓋策略，避免重複商品鍵衝突。

### 不做什麼
- 不在本模組新增 UI 設計系統。
- 不在本模組導入外部商品主檔同步。
- 不在本模組新增即時庫存預測演算法。

## 3. 涉及角色與權限
- `trial`
  - 可瀏覽前台與 Dashboard。
  - 不可呼叫匯入 API。
- `user`
  - 可呼叫匯入 API。
- `admin`
  - 可呼叫匯入 API 並執行管理用途批次操作。
- `service_backend`
  - 供系統流程執行匯入或資料校正。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`

欄位基線需符合 [`plans/schema_v2_freeze.md`](plans/schema_v2_freeze.md) 後續凍結內容。

## 5. 涉及 API
- [`api/bulk-products.js`](api/bulk-products.js:79)
- v2 仍採 `POST /api/bulk-products`，不新增新端點。
- 回應至少應可區分成功、部分失敗、格式錯誤三類。

## 6. 涉及頁面
- 匯入入口與結果顯示
  - [`public/index.html`](public/index.html:112)
  - [`public/js/main.js`](public/js/main.js:1097)

注意：前台主場景雖為 2D 卡通門店，但匯入功能可留在輔助工具區。

## 7. 核心流程
1. 上傳 CSV 並轉換為 `rows`。
2. 以商品鍵去重後寫入 `products`。
3. 回填多語名稱至 `product_translations`。
4. 寫入單件對應至 `inventory_items`。
5. 回傳摘要供前台顯示匯入結果。

## 8. 業務規則
- 商品鍵規則
  - 由 `epc_company_prefix + item_reference` 組成。
- 匯入權限規則
  - `trial` 禁止匯入。
  - `user` 與 `admin` 允許匯入。
- 欄位驗證規則
  - `epc_data` 必須可解析。
  - 商品名稱至少需一個可顯示語系。
  - 價格若提供需可轉數值。
- 去重規則
  - 同鍵重複列採最後一筆覆蓋。

## 9. 驗收標準
- `trial` 呼叫匯入 API 會被拒絕。
- `user` 與 `admin` 可完成匯入並得到摘要回應。
- 匯入資料可被前台卡片與 Dashboard 查詢到。
- 匯入錯誤訊息可提示欄位或列級問題。

## 10. 與其他模組的依賴
- 前置依賴
  - [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
  - [`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
- 後續依賴
  - M7 前台商品顯示
  - M8 Dashboard 商品分析
  - M9 報表與補貨建議

---

## 補充 1 規格仍不足
- CSV 標準模板下載格式尚未固定。
- 匯入錯誤碼字典尚未定版。
- 多語欄位最低必填語系尚未最終定義。

## 補充 2 直接開發易返工區
- 欄位契約未凍結就先擴充前台上傳提示。
- 權限尚未統一就先改 API 驗證。
- 未確認覆蓋策略就先做審計追溯。

## 補充 3 開發前需先確認
- 匯入摘要是否需要保留 rejected_rows 完整明細。
- 匯入成功是否需要觸發商品快取刷新。
- `service_backend` 是否允許跨租戶批次寫入。
