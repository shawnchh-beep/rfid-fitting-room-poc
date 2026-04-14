# RFID Fitting Room 驗收標準 v1

依據需求文件 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:82) 與現行功能邊界建立可量測驗收條件。

> 限制：僅定義 v1 要做範圍，不包含需求書明確排除項目。

## 1. 驗收範圍

- 前台拖拉互動
- 事件寫入與狀態同步
- 異常停留模式與門檻
- 轉化率計算
- Dashboard KPI 與歷史事件流
- 匯入 API 基本可用性

## 2. 驗收案例 Given When Then

### AC-01 拖拉進試衣間

- Given 商品目前在 `RACK`
- When 操作者拖拉到 `FITTING_ROOM`
- Then 
  - 產生事件 `event_type=enter_fitting_room`
  - `event_source=demo_drag`
  - 商品顯示於試衣間欄位

參照：[`public/js/main.js`](public/js/main.js:662)、[`api/rfid-webhook.js`](api/rfid-webhook.js:455)

### AC-02 拖拉離開試衣間回賣場

- Given 商品目前在 `FITTING_ROOM`
- When 操作者拖拉到 `RACK`
- Then 
  - 產生事件 `event_type=exit_fitting_room` 或對應回賣場事件
  - 該商品不再顯示試衣間在場狀態

### AC-03 拖拉到結帳與完成銷售

- Given 商品目前在 `CHECKOUT`
- When 操作者點擊完成銷售
- Then 
  - 產生 `event_type=sale_completed`
  - 若符合 10 分鐘條件，session 被標記 `converted_to_sale=true`

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:439)

### AC-04 Debounce 行為

- Given 同一 `epc_data + reader_id` 在 3 秒內重複送入
- When 再次送 `POST /api/rfid-webhook`
- Then 回應 `status=ignored` 且 `reason=debounced`

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:305)

### AC-04A 事件推導優先序 Body 優先

- Given `POST /api/rfid-webhook` 請求同時提供 `event_type` 與可推導 `to_zone`
- When 送出請求
- Then `event.event_type` 應以 Body 提供值為準，不被 `to_zone` 覆蓋

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:303)、[`plans/module_m4_api_design.md`](plans/module_m4_api_design.md:106)

### AC-04B 事件推導優先序 Zone 推導與最終 fallback

- Given `POST /api/rfid-webhook` 未提供 `event_type`
- When `to_zone` 分別為 `fitting_room` `checkout` `sold` `sales_floor` 或未知值
- Then `event.event_type` 依序推導為
  - `enter_fitting_room`
  - `move_to_checkout`
  - `sale_completed`
  - `return_to_sales_floor`
  - `tag_seen`

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:29)、[`plans/module_m4_api_design.md`](plans/module_m4_api_design.md:106)

### AC-05 異常停留門檻可配置

- Given 系統提供模式切換與門檻輸入
- When 切換模式或調整門檻分鐘數
- Then 異常停留判定依新門檻生效且畫面可見目前設定

參照：[`public/index.html`](public/index.html:41)、[`public/js/main.js`](public/js/main.js:354)

### AC-06 前台顯示層級

- Given 任一商品卡
- When 看板渲染
- Then 
  - SKU 為主要可見資訊
  - EPC 為次要資訊
  - `image_url` 有值時顯示圖片，無值顯示占位

參照：[`public/js/main.js`](public/js/main.js:621)

### AC-07 KPI 完整度

- Given Dashboard 已載入
- When 有當日 session 與成交事件
- Then 顯示
  - 今日試穿次數
  - 今日成交件數
  - 今日轉化率

參照：[`public/js/main.js`](public/js/main.js:532)

### AC-08 歷史事件流欄位完整

- Given 有新事件寫入
- When 事件流刷新
- Then 每筆至少顯示 `event_type`、`from_zone`、`to_zone`、`timestamp`、`epc`
- And 歷史來源以 `rfid_events` 為準，不以 `fitting_room_presence` 作歷史回放來源

參照：[`public/js/main.js`](public/js/main.js:813)

### AC-09 匯入 API 可用

- Given 上傳符合格式的 CSV rows
- When 呼叫 `POST /api/bulk-products`
- Then 回應 `status=success` 並回傳 `affected` 與 upsert 摘要

參照：[`api/bulk-products.js`](api/bulk-products.js:249)

### AC-10 方法限制與錯誤碼

- Given API 收到非 `POST`
- When 呼叫端點
- Then 回傳 405

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:280)、[`api/bulk-products.js`](api/bulk-products.js:79)

### AC-11 寫入 API 授權邊界

- Given 部署環境啟用 `API_AUTH_ENABLED=true`
- When 呼叫 `POST /api/rfid-webhook` 或 `POST /api/bulk-products` 且
  - 缺少 `x-api-token` 或 token 不正確
  - 或 `x-user-role` 不在允許角色集合
- Then
  - 缺 token 或 token 錯誤回 401
  - 角色不允許回 403

參照：[`api/_auth.js`](api/_auth.js:16)、[`api/rfid-webhook.js`](api/rfid-webhook.js:283)、[`api/bulk-products.js`](api/bulk-products.js:84)

### AC-12 M5 在場快照建立與更新

- Given 商品首次送入 `fitting_room` 路徑事件
- When 呼叫 `POST /api/rfid-webhook`
- Then
  - `fitting_room_presence` 需建立或更新 `product_key`、`entered_at`、`last_seen_at`
  - 回應 `presence.in_fitting_room=true`

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:389)、[`api/rfid-webhook.js`](api/rfid-webhook.js:465)

### AC-13 M5 離場清除與 session 關閉

- Given 商品已有開啟中的試衣 session
- When 商品送入非試衣間事件（例如 `checkout` 或 `sales_floor`）
- Then
  - `fitting_room_presence` 被清除
  - 開啟中的 session 需寫入 `left_at` 與 `duration_seconds`

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:427)、[`api/rfid-webhook.js`](api/rfid-webhook.js:433)

## 3. 驗收通過判定

- 15 個 AC 全數通過即視為 v1 功能驗收通過
- 若 AC-01 AC-03 AC-05 AC-07 任一失敗，視為核心流程未通過

## 4. 不在本版驗收

- 真實 RFID Reader 硬體連接
- POS ERP 真實串接
- 複雜權限

依據：[`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:136)
