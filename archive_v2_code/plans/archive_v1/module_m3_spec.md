# M3 模組規格 商品主檔與批次匯入

## 1. 模組目標
- 建立 v1 可用的商品資料入口，將批次資料穩定寫入商品主檔、多語文案與單件對應資料。
- 依據 [`plans/api_spec_v1.md`](plans/api_spec_v1.md:83)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24)、[`api/bulk-products.js`](api/bulk-products.js:78)。

## 2. 模組邊界
### 做什麼
- 透過 [`POST /api/bulk-products`](api/bulk-products.js:78) 接收 `rows`。
- 進行欄位與格式驗證：`epc_data`、`name_en`、`price`。
- 依 `epc_company_prefix + item_reference` 做商品主檔 upsert。
- upsert 多語文案與 `inventory_items`。

### 不做什麼
- 不處理真實 RFID 硬體串接。
- 不新增需求文件未定義的商品維度。
- 不處理跨系統主資料同步策略。

依據範圍限制：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:136)。

## 3. 涉及角色與權限
- `analyst_admin`：允許執行匯入 API。
- `service_backend`：允許執行匯入與資料寫入。
- `demo_operator`、`viewer`：不允許呼叫匯入 API。

權限來源：[`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:26)。

## 4. 涉及資料表
- `products`
- `product_translations`
- `inventory_items`

欄位口徑依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:26)。

## 5. 涉及 API
- [`POST /api/bulk-products`](api/bulk-products.js:78)
  - Request 規格：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:87)
  - Success Response：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:120)
  - Error Codes：[`plans/api_spec_v1.md`](plans/api_spec_v1.md:140)

## 6. 涉及頁面
- 匯入操作入口：[`public/index.html`](public/index.html:75)
- 匯入提交與結果顯示：[`public/js/main.js`](public/js/main.js:884)

## 7. 核心流程
1. 前端上傳 CSV 後轉為 `rows` 呼叫匯入 API：[`public/js/main.js`](public/js/main.js:904)
2. API 驗證每列資料並標準化：[`api/bulk-products.js`](api/bulk-products.js:20)
3. 以 `epc_company_prefix + item_reference` 去重後 upsert `products`：[`api/bulk-products.js`](api/bulk-products.js:173)
4. 依商品鍵回填 `product_translations`：[`api/bulk-products.js`](api/bulk-products.js:205)
5. upsert `inventory_items`：[`api/bulk-products.js`](api/bulk-products.js:234)
6. 回傳匯入摘要與筆數：[`api/bulk-products.js`](api/bulk-products.js:249)

## 8. 業務規則
- `epc_data` 必須為 24 碼 Hex：[`api/bulk-products.js`](api/bulk-products.js:37)
- `name_en` 不可為空，舊欄位可由 `product_name` fallback：[`api/bulk-products.js`](api/bulk-products.js:22)
- 同商品鍵重複列採最後一筆覆蓋策略：[`api/bulk-products.js`](api/bulk-products.js:119)
- `price` 有值時必須可解析為數字：[`api/bulk-products.js`](api/bulk-products.js:45)

## 9. 驗收標準
- 能成功呼叫 [`POST /api/bulk-products`](api/bulk-products.js:78) 並回傳 `status=success`。
- 回應含 `affected`、`translation_rows_upserted`、`inventory_items_upserted`。
- 匯入後 Dashboard 可讀到商品資料並渲染。

驗收對照：[`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:98)。

## 10. 與其他模組的依賴
- 前置依賴：
  - M1 基線治理與規格凍結：[`plans/module_m1_spec.md`](plans/module_m1_spec.md:1)
  - M2 資料模型與遷移基線：[`plans/module_m2_spec.md`](plans/module_m2_spec.md:1)
- 後續依賴：
  - M7 前台互動看板依賴商品資料可用
  - M8 Dashboard 顯示依賴商品主檔與翻譯資料

---

## 補充 1 規格仍不足
- CSV 欄位的強制與選填清單未在需求書形成正式欄位契約版本。
- 重複商品鍵覆蓋策略只有程式行為，缺正式業務決策文件。
- 匯入錯誤分類目前以訊息為主，缺統一錯誤碼字典。

## 補充 2 直接開發易返工區
- 在 CSV 欄位契約未鎖定下先擴充匯入模板。
- 在覆蓋策略未確認下先做歷史追溯或審計報表。
- 在商品鍵規則未變更控管下直接改主鍵邏輯。

## 補充 3 開發前需先確認
- CSV 欄位清單以 API 契約為準，包含 `image_url`。
  - 欄位來源：[`plans/module_m3_api_design.md`](plans/module_m3_api_design.md:33)
  - 頁面文案若與 API 不一致，需同步修正文案但不得改動 API 契約。
- 重複鍵採最後一筆覆蓋是否正式接受。
- 匯入失敗時是否需定義可機器判讀錯誤碼而非僅文字訊息。

