# M1 模組規格 基線治理與規格凍結

## 1. 模組目標
- 凍結 v1 開發基準，統一 API Schema 權限與驗收口徑。
- 依據 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:1) 與
  [`plans/api_spec_v1.md`](plans/api_spec_v1.md)
  [`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md)
  [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md)
  [`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md)

## 2. 模組邊界
### 做什麼
- 凍結 API 最小契約
- 凍結權限矩陣與最小安全邊界
- 凍結 Schema v1 命名口徑與遷移基線
- 凍結驗收條件

### 不做什麼
- 不新增 API 與頁面功能
- 不新增需求書未定義能力
- 不納入硬體串接與 POS ERP 串接

## 3. 涉及角色與權限
- `demo_operator`
- `viewer`
- `analyst_admin`
- `service_backend`
- 依據 [`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:7)

## 4. 涉及資料表
- 本模組不直接寫資料表
- 定義後續遵循範圍
  - `products`
  - `product_translations`
  - `inventory_items`
  - `rfid_events`
  - `fitting_room_presence`
  - `fitting_room_sessions`

## 5. 涉及 API
- 本模組不執行 API
- 凍結以下 API 契約
  - [`api/rfid-webhook.js`](api/rfid-webhook.js:279)
  - [`api/bulk-products.js`](api/bulk-products.js:78)

## 6. 涉及頁面
- 本模組不開發頁面
- 僅定義後續頁面驗收口徑
  - [`public/index.html`](public/index.html:19)
  - [`public/js/main.js`](public/js/main.js:752)

## 7. 核心流程
1. 以需求文件為單一來源
2. 凍結 API 文件
3. 凍結權限矩陣
4. 凍結 Schema 文件
5. 凍結驗收標準
6. 後續模組必須引用上述文件

## 8. 業務規則
- 規格優先於實作
- API 行為以 [`plans/api_spec_v1.md`](plans/api_spec_v1.md:1) 為準
- 權限以 [`plans/access_control_matrix_v1.md`](plans/access_control_matrix_v1.md:1) 為準
- 資料命名以 [`plans/schema_v1_freeze.md`](plans/schema_v1_freeze.md:1) 為準
- 驗收以 [`plans/acceptance_criteria_v1.md`](plans/acceptance_criteria_v1.md:1) 為準

## 9. 驗收標準
- 四份基線文件存在且可引用
- 文件內容互相不衝突
- 後續模組可直接採用，不需再定義第二套口徑

## 10. 與其他模組依賴
- M1 為後續模組前置依賴
- M2 至 M9 需依 M1 基線實作

---

## 補充 1 規格仍不足
- 登入身份模型未定
- RLS policy 僅原則未有 SQL 細節
- API 版本策略未定
- Schema 延後項目尚未定版

## 補充 2 直接開發易返工區
- 未固定 auth 與 RLS 即大量串接 API
- 未固定命名口徑即擴寫查詢與報表
- 未固定驗收條件即進行 UI KPI 調整

## 補充 3 開發前需先確認
- 角色是否需登入態對應
- 匿名讀取範圍上限
- RLS 在 v1 是否落地 SQL
- 延後項目納入版本凍結時點

