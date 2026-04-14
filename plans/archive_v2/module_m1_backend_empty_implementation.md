# M1 後端開發前聲明與空實作說明

依據 [`plans/module_m1_spec.md`](plans/module_m1_spec.md:1) 與 [`plans/module_m1_api_design.md`](plans/module_m1_api_design.md:1)，M1 為治理與規格凍結模組，不新增後端程式實作。

## A. 本次遵守的約束

1. 僅在 M1 邊界內處理，不跨入 M2 以後模組。
2. 不新增 schema migration。
3. 不新增 model entity。
4. 不新增 route controller service。
5. 不新增 request validation 與 error handling 程式碼。
6. 不新增權限檢查程式邏輯。
7. 不改動既定命名規則與既有 API 規格。

## B. 本次不處理的內容

- schema migration 實作
- model entity 實作
- route 定義
- controller
- service
- request validation
- error handling
- 權限檢查邏輯

以上項目均屬業務模組實作，應由 M2 之後模組承接。

## C. 可能影響其他模組的風險

1. 若在 M1 直接實作後端，會與 M2 責任重疊，破壞模組分層。
2. 若在 M1 改動 API 或資料結構，會造成 M3 到 M9 文件與實作口徑失配。
3. 若跳過 M1 治理邊界，後續模組將失去共同基準，增加返工風險。

## 空實作說明

M1 後端輸出採「零程式碼實作」：
- 不建立新檔案於 [`api/rfid-webhook.js`](api/rfid-webhook.js:1) 與 [`api/bulk-products.js`](api/bulk-products.js:1) 以外路徑。
- 不修改任何現有後端邏輯。
- 僅保留治理層文件輸出，作為後續 M2 實作前置依據。

