這份文檔根據 RFID 試衣間概念驗證 (PoC) 的專案計畫，為不同開發階段整理了可直接提供給 AI 程式碼生成工具（如 GitHub Copilot, Cursor, 或 ChatGPT）的開發需求提示詞（Prompts）。文檔皆採用 Markdown 格式編排。

### 全局系統設定文檔 (Global Context)
您可以將此段落作為系統提示 (System Prompt) 餵給 AI，讓其了解專案的基礎技術棧與狀態定義。

```markdown
# 專案概述：RFID 試衣間 PoC
請基於以下技術棧與架構進行程式碼生成：
- **前端/UI**：HTML5, CSS3, Vanilla JavaScript (或輕量級 React)。
- **部署環境**：Vercel (透過 GitHub 自動部署)。
- **資料庫/BaaS**：Supabase (使用 PostgreSQL 與 PostgREST API)。
- **即時通訊**：Supabase Realtime Subscriptions。
- **邊緣邏輯/API**：Vercel Serverless Functions。

# 核心狀態機 (State Machine)
- 衣服的狀態流轉必須嚴格遵守：RACK -> FITTING_ROOM -> CHECKOUT -> SOLD。
```

---

### 第一階段：資料庫與 Supabase 配置 (Phase 1: Database Setup)

```markdown
# 任務目標：建立基礎資料層與產品映射
請撰寫可執行於 Supabase 的 SQL 指令碼：

1. **建立資料表 (Task 1.1)**：
   - `products` 表：包含 `id`, `epc_company_prefix`, `item_reference`, `name`, `image_url`, `price`。
   - `rfid_events` 表：包含 `id`, `epc_data`, `reader_id`, `state`, `timestamp`。

2. **設置行級安全性 (Row Level Security, RLS) (Task 1.2)**：
   - 配置 Supabase RLS 策略，允許匿名 (anonymous) 新增資料以供 PoC 使用（或設定通用的 anon key）。

3. **生成測試數據 (Task 1.3)**：
   - 撰寫 SQL seed script，插入 3-5 件服飾資料，這些資料必須具備有效的預設 SGTIN-96 映射數據。
```

---

### 第二階段：核心邏輯與 Serverless API (Phase 2: Core Logic & API)

```markdown
# 任務目標：建立解碼與防抖 (Debouncing) 中介軟體
請撰寫 Node.js / Vercel Serverless Function 程式碼：

1. **SGTIN-96 解碼工具 (Task 2.1)**：
   - 撰寫一個純 JavaScript 函數 (`sgtin96.js`)，將 SGTIN-96 十六進制字串解析為 `CompanyPrefix` 與 `ItemReference`。

2. **Vercel Webhook API (`/api/rfid-webhook`) (Task 2.2)**：
   - **輸入**：接收標準化的 JSON Payload。
   - **邏輯處理**：
     1. 呼叫解碼工具解析 EPC 以識別對應產品。
     2. 防抖檢查 (Debounce check)：查詢 Supabase，確保相同的 `reader_id` 在過去 3 秒內沒有記錄過完全相同的 `epc_data`。
     3. 若檢查通過，將該有效事件寫入 Supabase 的 `rfid_events` 資料表中。
   - **輸出**：回傳 HTTP 200 OK 狀態碼。
```

---

### 第三階段：虛擬讀取器 UI (Phase 3: Frontend Simulator)

```markdown
# 任務目標：打造模擬實體 RFID 天線的網頁版拖曳介面
請撰寫前端 HTML/CSS/JS 程式碼：

1. **版面與 CSS Grid (Task 3.1)**：
   - 建立一個包含三個獨立拖放區塊的儀表板，分別命名為：RACK、FITTING_ROOM 與 CHECKOUT。

2. **拖放互動 (Task 3.2)**：
   - 實作 HTML5 Drag and Drop API，讓服飾圖片可以在區塊間拖曳。

3. **API 串接 (Task 3.3)**：
   - 當發生 `drop` 事件時，提取該服飾的模擬 EPC 數據。
   - 建構標準 JSON payload，並透過 `fetch(POST)` 將資料發送至 Vercel Serverless Function (`/api/rfid-webhook`)。
```

---

### 第四階段：即時分析儀表板 (Phase 4: Real-time Analytics Dashboard)

```markdown
# 任務目標：動態視覺化轉換漏斗 (Conversion Funnel)
請撰寫前端即時數據渲染程式碼：

1. **Supabase 即時連線 (Task 4.1)**：
   - 在前端初始化 Supabase JS Client，並訂閱 `rfid_events` 表的 `INSERT` 事件。

2. **指標計算 (Task 4.2)**：
   - 邏輯運算：計算在衣架上的總件數 (total items on rack)、進入試衣間的總件數 (total items entered fitting room)、以及結帳總數 (total checkouts)。

3. **資料視覺化 (Task 4.3)**：
   - 整合 Chart.js 以繪製即時的漏斗圖 (Funnel Chart)。
   - 當 Supabase 即時訂閱觸發時，在不重新載入頁面的情況下更新圖表數據。
```

---

### 硬體轉換準備提醒 (Hardware Transition Note)
**開發者請注意**：前端 UI 僅作為事件發射器使用。當未來取得實體的 RFID 閘道器設備後，將直接跳過第三階段的虛擬 UI，並使用完全相同的 JSON 結構，將實體數據直接推送至第二階段開發的 `/api/rfid-webhook` 端點。