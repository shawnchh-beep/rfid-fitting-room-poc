# M9 資料結構設計與記錄

依據 [`plans/module_m9_spec.md`](plans/module_m9_spec.md:1)、[`plans/vercel_deployment_runbook.md`](plans/vercel_deployment_runbook.md:1)、[`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24) 整理。

> 限制聲明：本文件僅針對 M9 部署與運維驗證模組；M9 不新增業務資料模型，只驗證既有資料結構可用性。

## 1. 資料表清單

M9 **不新增資料表**。

M9 驗證範圍內需可讀寫的既有表：
- `products`
- `product_translations`
- `inventory_items`
- `rfid_events`
- `fitting_room_presence`
- `fitting_room_sessions`

## 2. 每張表的欄位設計

- M9 不設計新欄位。
- M9 僅檢查上述既有表是否符合凍結口徑，依 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:24)。

## 3. 主鍵 / 外鍵

- M9 不新增主鍵。
- M9 不新增外鍵。
- 僅驗證既有結構可支撐部署 smoke 路徑。

## 4. 必填欄位

- M9 不定義新必填欄位。
- 僅驗證 API 實際寫入路徑所需欄位存在，參照 [`plans/api_spec_v1.md`](plans/api_spec_v1.md:16)、[`plans/api_spec_v1.md`](plans/api_spec_v1.md:83)。

## 5. 可為空欄位

- M9 不新增可空欄位規則。
- 沿用既有模組凍結定義。

## 6. 狀態欄位

- M9 不新增狀態欄位。
- 部署驗證時需確認既有狀態欄位可被流程正確讀寫。

## 7. 建立時間 / 更新時間

- M9 不新增時間欄位。
- 僅驗證既有時間欄位可支撐 smoke 驗證流程與資料可觀測性。

## 8. 是否需要軟刪除

- M9 不新增軟刪除欄位。
- 理由：M9 屬部署驗證層，不承載資料生命週期設計。

## 9. 資料關聯

- M9 不新增資料關聯。
- 僅驗證既有關聯在部署後可支撐完整鏈路：匯入 事件 在場 session KPI 顯示。

## 10. 為什麼這樣設計

- M9 職責是驗證，不是資料建模。
- 若在 M9 新增或改動資料表，會侵入 M2 職責並破壞模組邊界。
- 採用「零資料結構變更」可降低部署階段返工風險。

---

## 充足性檢查

### 是否足以支撐前端頁面需求
- 足夠。M9 透過 smoke 驗證前端是否可正常渲染與即時更新，並不需新增資料結構。

### 是否足以支撐 API 操作
- 足夠。M9 驗證 [`api/bulk-products.js`](api/bulk-products.js:78) 與 [`api/rfid-webhook.js`](api/rfid-webhook.js:279) 是否在既有結構上可運作。

### 是否足以支撐報表或查詢
- 對 M9 足夠。M9 只需驗證查詢可用性，不擴充報表模型。

### 哪些地方未來容易擴充失敗
- 若把 M9 當成資料模型調整點，會導致部署流程與資料遷移耦合，造成回滾困難。
- 若未固定 smoke 測資與驗證順序，會出現同環境不同結論。

---

## 影響其他模組風險標示

- 若在 M9 新增資料表或改欄位，會直接影響 M2 凍結契約與 M3-M8 的實作一致性。
- 若 M9 變更資料口徑，會讓驗收基準與模組責任分層失效。

