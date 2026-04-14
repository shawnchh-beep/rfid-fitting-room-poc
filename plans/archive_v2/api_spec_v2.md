# RFID Fitting Room API 規格 v2

## 0. 版本資訊
- 來源：[`plans/archive_v1/api_spec_v1.md`](plans/archive_v1/api_spec_v1.md)
- 依據：[`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)、[`plans/module_m2_spec_v2.md`](plans/module_m2_spec_v2.md)
- 狀態：草案 v2.0

## 1. 共通規格
- Base Path：`/api`
- Content-Type：`application/json`
- 僅保留 v2 實際使用端點
  - `POST /api/rfid-webhook`
  - `POST /api/bulk-products`
- 事件與狀態語意
  - `left_fitting_room` 為事件語意或 session 結束語意，不作 `current_status`
  - `checkout` 為未完成交易
  - `sold` 為交易完成最終狀態

## 2. 核心寫入 API
### 2.1 `POST /api/rfid-webhook`
- 實作位置：[`api/rfid-webhook.js`](api/rfid-webhook.js:280)
- 用途：接收前台互動或系統事件，寫入 `rfid_events` 並更新 presence session

#### Request Headers
- `x-user-role`：`trial | user | admin | service_backend`
- `x-api-token`：當服務啟用 API 驗證時必填

#### Request Body 最小欄位
- `epc_data` 字串，24 碼 hex
- `reader_id` 字串

#### Request Body 建議欄位
- `event_type`：`enter_fitting_room | exit_fitting_room | move_to_checkout | sale_completed`
- `event_source`：如 `demo_drag`
- `from_zone`、`to_zone`
- `timestamp`

#### Response Success
- `status`：`success` 或 `ignored`
- `event`：事件摘要
- `presence`：在場摘要
- `conversion`：當 `sale_completed` 觸發時可能回傳

#### Response Ignored
- `status=ignored`
- `reason=debounced`

### 2.2 `POST /api/bulk-products`
- 實作位置：[`api/bulk-products.js`](api/bulk-products.js:79)
- 用途：批次匯入商品主檔與單件資料

#### Request Headers
- `x-user-role`：`user | admin | service_backend`
- `trial` 不允許呼叫本端點

#### Request Body
- `rows` 陣列
- 每列至少包含
  - `epc_data`
  - `name_en` 或可映射主名稱欄位
  - `price` 可選，若提供需為數值

#### Response Success
- `status=success`
- `affected`
- `translation_rows_upserted`
- `inventory_items_upserted`

#### Response Error
- 依欄位驗證回傳錯誤訊息，需可定位至欄位或列

## 3. 核心讀取 API
- v2 不新增專用讀取端點
- 讀取以 Supabase Query 與 Realtime 訂閱為主
  - 前台資料整併邏輯：[`public/js/main.js`](public/js/main.js:948)
- 若未來新增讀取 API，需先更新 [`plans/module_m8_spec_v2.md`](plans/module_m8_spec_v2.md) 與 [`plans/module_m9_spec_v2.md`](plans/module_m9_spec_v2.md)

## 4. 權限與認證
- 前台角色
  - `trial`：可看前台與 dashboard，不可匯入
  - `user`：可前台操作且可匯入
  - `admin`：完整操作權限
- 系統角色
  - `service_backend`：保留給系統流程，不在前台角色選單顯示
- 認證策略
  - API 驗證啟用時需檢查 token 與角色
  - 角色檢查邏輯由共用授權模組處理：[`api/_auth.js`](api/_auth.js:16)

## 5. 錯誤碼與回應格式
- HTTP 狀態碼
  - `200`：成功或被 debounce 忽略
  - `400`：欄位格式錯誤
  - `401`：缺少或無效 token
  - `403`：角色無權限
  - `405`：方法不允許
  - `500`：伺服器內部錯誤
- 統一錯誤格式
  - `{ error: string }` 或 `{ message: string }`
  - 前端需同時相容兩種鍵名：[`public/js/main.js`](public/js/main.js:447)

## 6. 非功能性約束
- Debounce
  - 同商品同 reader 在短時間內重複事件需忽略
- 相容性
  - 維持既有 fallback 寫入路徑，避免舊 schema 立即中斷
- 可觀測性
  - API 需保留最小必要 log，便於 M9 部署驗證
