# RFID Fitting Room 權限矩陣 v1 最小版

依據角色定義 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:66) 與 v1 範圍 [`規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md`](規格書/RFID_Fitting_Room_Demo_需求文件_v1.1_更新版.md:108) 整理。

> 假設：本文件中的角色對應「系統操作身份」，非組織職稱。此為治理假設，需求書未明文定義登入身份模型。

## 1. 角色定義 v1

| 角色代碼 | 對應需求角色 | 說明 |
|---|---|---|
| `demo_operator` | Demo 操作者 | 操作前台拖拉、觸發模擬事件 |
| `viewer` | 客戶 品牌參觀者 | 只讀查看前台與 Dashboard |
| `analyst_admin` | 管理者 業務 顧問 | 讀取分析資料、執行匯入與測試事件 |
| `service_backend` | 系統服務帳號 | Vercel API 使用 Service Role 寫入資料 |

參照：[`api/rfid-webhook.js`](api/rfid-webhook.js:4)、[`api/bulk-products.js`](api/bulk-products.js:3)

## 2. 資源清單 v1

- API：[`/api/rfid-webhook`](api/rfid-webhook.js:279)、[`/api/bulk-products`](api/bulk-products.js:78)
- 表：`products`、`product_translations`、`inventory_items`、`rfid_events`、`fitting_room_presence`、`fitting_room_sessions`
- 前台模組：拖拉看板、KPI、歷史事件流、二級工具

## 3. 權限矩陣

### 3.1 API 權限

| API | demo_operator | viewer | analyst_admin | service_backend |
|---|---|---|---|---|
| `POST /api/rfid-webhook` | 允許 | 禁止 | 允許 | 允許 |
| `POST /api/bulk-products` | 禁止 | 禁止 | 允許 | 允許 |

### 3.2 資料表權限

| 資料表 | demo_operator | viewer | analyst_admin | service_backend |
|---|---|---|---|---|
| `products` | 讀 | 讀 | 讀寫 | 讀寫 |
| `product_translations` | 讀 | 讀 | 讀寫 | 讀寫 |
| `inventory_items` | 讀 | 讀 | 讀寫 | 讀寫 |
| `rfid_events` | 讀 | 讀 | 讀 | 讀寫 |
| `fitting_room_presence` | 讀 | 讀 | 讀 | 讀寫 |
| `fitting_room_sessions` | 讀 | 讀 | 讀 | 讀寫 |

## 4. 最小安全邊界

1. 前端不得直接持有 Service Role Key
2. 所有寫入由 server-side API 代理
3. 匯入 API 僅開放 `analyst_admin` 或後端服務身份
4. 事件寫入 API 需可追蹤 `event_source`

## 5. RLS 實作指引 最小版

> 本版不直接提供 SQL policy 細節，僅凍結原則。

- 匿名使用者：僅允許讀取展示必要資料
- 寫入事件：走 API 層，資料庫層不直接開匿名寫入 `rfid_events`
- 匯入資料：限制為受控後台流程

## 6. 稽核與追蹤

- 必填欄位：`event_source`、`event_type`、`timestamp`
- 建議在 `metadata` 放入操作脈絡，例如來源 UI 或批次匯入識別

參照：[`plans/sql_stage2_event_model.sql`](plans/sql_stage2_event_model.sql:5)

## 7. 不在本版定義

- SSO 與外部 IAM
- 細粒度欄位遮罩
- 多租戶隔離

上述超出需求文件 v1 範圍，延後至後續版本。

