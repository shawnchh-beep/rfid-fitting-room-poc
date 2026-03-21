# M1 模組規格 v2 基線治理與規格凍結

## 0. 版本資訊
- 來源：[`plans/archive_v1/module_m1_spec.md`](plans/archive_v1/module_m1_spec.md)
- 需求來源：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md)
- 關聯規格：[`plans/api_spec_v2.md`](plans/api_spec_v2.md)、[`plans/schema_v2_freeze.md`](plans/schema_v2_freeze.md)
- 狀態：草案 v2.0

## 1. 模組目標
- 凍結 v2 的單一規格口徑，讓 M2 到 M9 依同一份基線開發。
- 明確定義 v2 角色模型：前台角色僅 `trial`、`user`、`admin`；後端保留系統角色 `service_backend`。
- 明確定義 v2 事件與狀態語意，避免 UI 顯示語意與資料語意混用。
- 明確定義 Dashboard 補貨建議為固定公式，不依賴外部 AI 服務。

## 2. 模組邊界
### 做什麼
- 凍結 v2 角色與權限命名。
- 凍結 v2 狀態語意規則。
- 凍結 v2 補貨建議計算口徑。
- 凍結 v2 跨文件引用規則與優先順序。

### 不做什麼
- 不新增硬體串接範圍。
- 不導入外部 AI API 或模型推論服務。
- 不在 M1 定義每個 API 的完整 request/response 細節。
- 不在 M1 實作資料庫 migration 與 RLS SQL。

## 3. 涉及角色與權限
- 前台可見角色
  - `trial`：可操作前台模擬互動與查看 Dashboard，禁止 CSV 匯入。
  - `user`：可操作前台模擬互動、查看 Dashboard、可執行 CSV 匯入。
  - `admin`：具完整前後台操作權限。
- 後端系統角色
  - `service_backend`：僅供系統對系統流程使用，不在前台角色選單顯示。
- 相容策略
  - 舊角色值在 v2 文件中不再作為主角色模型；若需相容映射，僅列於對照表，不作新功能依據。

## 4. 涉及資料表
- 本模組不直接寫入資料。
- 定義 v2 必須遵循的核心表語意
  - `products`
  - `product_translations`
  - `inventory_items`
  - `rfid_events`
  - `fitting_room_presence`
  - `fitting_room_sessions`
- 狀態語意基線
  - `left_fitting_room` 屬於事件語意或 session 結束原因，不作 `current_status`。
  - `checkout` 表示尚未完成銷售流程。
  - `sold` 表示交易完成的最終狀態。

## 5. 涉及 API
- 本模組不新增 API。
- v2 仍以既有 API 為主
  - [`api/rfid-webhook.js`](api/rfid-webhook.js:280)
  - [`api/bulk-products.js`](api/bulk-products.js:79)
- API 權限口徑
  - 前台傳遞角色值僅允許 `trial`、`user`、`admin`。
  - 系統流程可使用 `service_backend`。

## 6. 涉及頁面
- 本模組不交付新頁面，但凍結後續頁面遵循準則。
- 前台視覺基線為 2D 卡通門市場景，不使用傳統看板式儀表板。
- 參考現有入口
  - [`public/index.html`](public/index.html:20)
  - [`public/js/main.js`](public/js/main.js:1187)

## 7. 核心流程
1. 需求文件鎖定 v2 共通決策。
2. M1 先凍結角色、狀態、補貨公式三項基線。
3. M2 到 M9 僅在 M1 基線下展開模組細節。
4. API 與 Schema 文件回填時，必須回指 M1 基線，不得建立平行定義。

## 8. 業務規則
- 規格優先：文件與實作衝突時，以 v2 規格為準。
- 角色規則
  - `trial` 不得使用 CSV 匯入。
  - `user` 可使用 CSV 匯入。
  - `admin` 不受上述限制。
- 補貨建議固定公式
  - `recommended_restock_qty = max(0, sold_7d * 1.2 - current_stock)`。
  - 其中 `1.2` 為固定安全係數，不可由前台任意修改。
- 狀態語意規則
  - `checkout` 與 `sold` 不可混用。
  - `left_fitting_room` 不得被當作商品當前狀態。

## 9. 驗收標準
- M1 文件完整描述 v2 三大基線
  - 角色與權限基線
  - 狀態語意基線
  - 補貨公式基線
- 後續模組文件引用 M1 時，不出現互相矛盾定義。
- 文件中所有角色名、狀態名、公式符號在 v2 內一致。

## 10. 與其他模組依賴
- M1 為 M2 到 M9 的前置依賴。
- M2 起始時必須引用本文件角色模型與狀態語意。
- M8、M9 涉及 Dashboard 與分析時，必須沿用本文件補貨公式。

---

## 補充 1 規格仍不足
- trial 帳號建立方式與到期策略尚未定義。
- 補貨風險等級分層門檻尚未定義。
- `service_backend` 的 token 發放與輪替機制尚未定義。

## 補充 2 直接開發易返工區
- 未先統一角色值就修改 API header 檢查邏輯。
- 未先統一狀態語意就修改 Dashboard 指標。
- 未先凍結補貨公式就開發視覺化建議元件。

## 補充 3 開發前需先確認
- `trial` 是否允許上傳單筆手動事件。
- 補貨建議是否需保留小數或一律進位整數。
- `service_backend` 是否僅允許後端網段來源。
