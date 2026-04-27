# Dashboard 3.1 API 規劃書

## 1. 目的

本文件規劃 Dashboard 3.1 的 API 設計，對齊 [`dashboard plan 3.1.md`](../規格書%203.0/dashboard%20plan%203.1.md:1) 的商業 dashboard 需求，同時考量 Vercel Hobby 方案 12 個 Serverless Functions 上限。

本規劃不是立即實作 API，而是定義未來後端化 dashboard summary、opportunities、actions 時的安全施工方向。

---

## 2. 核心結論

### 2.1 短期方向

Dashboard 3.1 第一階段仍建議採用前端 view model，不新增 API function。

原因：

- 現有 [`api/`](../api) 已接近 Vercel function 上限。
- Dashboard 商業指標可由現有前端資料源計算。
- 第一階段目標是 UI storytelling 改版，不應因 API function 增加造成部署風險。

### 2.2 中期方向

若 dashboard summary 需要後端化，不能新增 `api/dashboard/summary.js`、`api/dashboard/opportunities.js`、`api/dashboard/actions.js` 三個獨立 function。

建議使用單一 catch-all dashboard router 或整合到更大的 app router。

### 2.3 長期方向

將 API function 收斂成少數 domain router：

- [`api/admin/[...route].js`](../api/admin/%5B...route%5D.js:1)
- [`api/auth/[...route].js`](../api/auth/%5B...route%5D.js:1)
- `api/app/[...route].js` 或 `api/dashboard/[...route].js`
- 保留少數高頻 webhook / import endpoint

---

## 3. Vercel Function 限制策略

### 3.1 不建議方案

不要新增以下檔案：

```text
api/dashboard/summary.js
api/dashboard/opportunities.js
api/dashboard/actions.js
```

問題：

- 一次新增 3 個 serverless functions。
- 容易超過 Hobby 方案 12 個 functions 限制。
- 後續每新增 dashboard 子功能都會再次消耗配額。

### 3.2 可接受方案 A：Dashboard catch-all router

新增單一入口：

```text
api/dashboard/[...route].js
```

搭配 server router：

```text
server/routers/dashboard-router.js
server/handlers/dashboard/summary.js
server/handlers/dashboard/opportunities.js
server/handlers/dashboard/actions.js
```

優點：

- Dashboard domain 只消耗 1 個 Vercel function。
- API URL 清楚。
- 未來新增 dashboard 子路徑不會新增 function。

缺點：

- 仍然會多消耗 1 個 function。
- 若目前 function 數量已滿，需先退役或整併既有 endpoint。

### 3.3 可接受方案 B：全域 app catch-all router

新增或預留單一入口：

```text
api/app/[...route].js
```

Dashboard API 映射成：

```text
/api/app/dashboard/summary
/api/app/dashboard/opportunities
/api/app/dashboard/actions
```

優點：

- 未來所有非 webhook、非 import、非 auth/admin 的新 API 都可放進同一 function。
- 最節省 function 配額。
- 適合 Demo / PoC 逐步擴充。

缺點：

- URL 不如 `/api/dashboard/*` 直覺。
- router 需要更嚴格的 method 與 path 管理。

### 3.4 可接受方案 C：整併既有 function 後再開 Dashboard router

先處理既有 function 空間：

- 評估退役 [`api/login.js`](../api/login.js:1)。
- 評估將 [`api/admin/users/[userId].js`](../api/admin/users/%5BuserId%5D.js:1) 完全交給 [`api/admin/[...route].js`](../api/admin/%5B...route%5D.js:1)。
- 確認 [`api/auth/[...route].js`](../api/auth/%5B...route%5D.js:1) 已完整接手 auth 子路徑。

然後再新增單一 `api/dashboard/[...route].js`。

---

## 4. 建議路由設計

### 4.1 推薦最終 URL

若 function 配額已釋出，推薦維持規格書 URL：

| Method | Path | 用途 | Function 入口 |
| --- | --- | --- | --- |
| GET | `/api/dashboard/summary` | Dashboard 主資料一次回傳 | `api/dashboard/[...route].js` |
| GET | `/api/dashboard/opportunities` | 收益機會排行 | `api/dashboard/[...route].js` |
| GET | `/api/dashboard/actions` | 建議行動列表 | `api/dashboard/[...route].js` |

### 4.2 若採全域 app router 的 URL

| Method | Path | 用途 | Function 入口 |
| --- | --- | --- | --- |
| GET | `/api/app/dashboard/summary` | Dashboard 主資料一次回傳 | `api/app/[...route].js` |
| GET | `/api/app/dashboard/opportunities` | 收益機會排行 | `api/app/[...route].js` |
| GET | `/api/app/dashboard/actions` | 建議行動列表 | `api/app/[...route].js` |

### 4.3 Query parameters

| Parameter | Type | Required | Default | 說明 |
| --- | --- | --- | --- | --- |
| `storeId` | string | no | demo store | 多店模式預留 |
| `range` | string | no | `today` | 支援 `today`、`last7d`、`custom` |
| `from` | ISO timestamp | no | today start | custom range 起點 |
| `to` | ISO timestamp | no | now | custom range 終點 |
| `locale` | string | no | `en` | API 端若需回傳文案時使用 |

---

## 5. Response shape

### 5.1 GET `/api/dashboard/summary`

用途：一次回傳 Dashboard 主要資料，讓前端可直接 render 商業 dashboard。

```json
{
  "storeStatus": {
    "storeName": "Demo Store",
    "liveStatus": "Active",
    "rfidStatus": "Normal",
    "aiStatus": "Ready",
    "lastUpdatedAt": "2026-04-27T20:30:00+08:00"
  },
  "revenueImpact": {
    "missedRevenueToday": 1240,
    "currency": "USD",
    "potentialUpliftMin": 12,
    "potentialUpliftMax": 18,
    "tryOnToSaleRate": 0,
    "benchmarkConversionRate": 18,
    "topLossDriver": {
      "sku": "1234567000084",
      "productName": "Northline White Polo Shirt",
      "missedSales": 4,
      "estimatedLostRevenue": 160
    }
  },
  "journeyFunnel": {
    "rackInterestCount": 32,
    "fittingRoomCount": 12,
    "checkoutIntentCount": 5,
    "completedSalesCount": 0,
    "tryOnToCheckoutRate": 41.7,
    "checkoutToSaleRate": 0,
    "overallConversionRate": 0,
    "mainDropOffStage": "after_fitting_room"
  },
  "aiInsight": {
    "headline": "High interest, low conversion detected",
    "summary": "Northline White Polo Shirt shows strong fitting-room interest but no completed sales.",
    "businessImpact": "4 potential sales may have been missed today.",
    "possibleReasons": [
      "Size availability issue",
      "Pricing mismatch",
      "Insufficient fitting-room assistance",
      "Product styling mismatch"
    ],
    "confidence": "medium"
  },
  "recommendedActions": [],
  "topRevenueOpportunities": [],
  "operationAlerts": [],
  "replenishmentRisk": [],
  "liveBoard": {
    "rack": [],
    "fittingRoom": [],
    "checkout": [],
    "sold": []
  }
}
```

### 5.2 GET `/api/dashboard/opportunities`

用途：回傳收益機會排行，可支援 table、detail modal 或後續 drill-down。

```json
{
  "items": [
    {
      "rank": 1,
      "sku": "1234567000084",
      "productName": "Northline White Polo Shirt",
      "tryOnCount": 4,
      "salesCount": 0,
      "conversionRate": 0,
      "unitPrice": 41,
      "estimatedMissedRevenue": 160,
      "opportunityScore": 52.1,
      "recommendedAction": "Review fit, size availability, and staff assistance"
    }
  ]
}
```

### 5.3 GET `/api/dashboard/actions`

用途：回傳可行動建議列表，支援未來 staff task / workflow。

```json
{
  "actions": [
    {
      "priority": 1,
      "type": "staff_follow_up",
      "title": "Assist fitting-room customers faster",
      "reason": "3 long dwell cases detected.",
      "suggestedAction": "Ask staff to follow up within 3 minutes.",
      "expectedImpact": "Reduce fitting-room drop-off",
      "relatedSkus": [
        "1234567000039",
        "1234567000107"
      ],
      "severity": "high"
    }
  ]
}
```

---

## 6. Data sources

後端 API 可沿用目前前端已使用的 Supabase 資料源，並在 handler 中集中計算。

### 6.1 建議讀取資料

| Data | 來源概念 | 用途 |
| --- | --- | --- |
| Products | products / catalog | SKU、商品名稱、價格、圖片、EPC mapping |
| RFID events | event log | rack interest、checkout intent、sale completed |
| Fitting sessions | fitting session rows | try-on count、dwell time、converted status |
| Inventory items | inventory rows | current stock、safety stock fallback、live board |
| Presence state | current fitting-room presence | abnormal dwell、technical live state |

### 6.2 欄位 fallback 原則

| 欄位 | 第一優先 | fallback |
| --- | --- | --- |
| productName | `display_name` | `name_en`、`name`、`Unnamed Product` |
| sku | normalized sku | `sku_ean13`、`item_no`、`-` |
| unitPrice | `price_usd` | `price`、0 |
| currentStock | active inventory count | product inventory count、0 |
| safetyStock | configured safety stock | calculated safety stock、5 |

---

## 7. Business calculation rules

### 7.1 Revenue Impact

```text
missedRevenueToday = sum of tryOnCountWithoutSale * unitPrice
```

```text
tryOnToSaleRate = completedSalesCount / fittingRoomCount
```

```text
opportunityScore = tryOnCount * unitPrice * (1 - conversionRate)
```

防呆規則：

- 分母為 0 時回傳 0。
- 缺少 price 時以 0 計算，不得出現 NaN。
- conversionRate 應使用 0 到 1 內部計算，輸出時再轉成百分比。

### 7.2 Journey Funnel

| Metric | 計算 |
| --- | --- |
| rackInterestCount | rack state count 或當日商品互動事件數 |
| fittingRoomCount | today fitting sessions 或 enter fitting room 事件數 |
| checkoutIntentCount | move to checkout 事件數 |
| completedSalesCount | sale completed 事件數 |
| tryOnToCheckoutRate | checkoutIntentCount / fittingRoomCount |
| checkoutToSaleRate | completedSalesCount / checkoutIntentCount |
| overallConversionRate | completedSalesCount / rackInterestCount |

### 7.3 Recommended Actions

| Condition | Action type | Severity |
| --- | --- | --- |
| longDwellCount > 0 | `staff_follow_up` | high |
| tryOnCount > 0 and salesCount = 0 | `product_review` | medium |
| currentStock < safetyStock | `restock` | medium |
| checkoutIntentCount > completedSalesCount | `checkout_flow_review` | medium |

### 7.4 Operation Alerts

| 原技術訊號 | 商業翻譯 | Action |
| --- | --- | --- |
| abnormal stay | Customer Experience Risk | Ask staff to follow up within 3 minutes |
| uncleared fitting-room items | Inventory Accuracy Risk | Verify room clear-out and reset item status |
| congestion | Service Capacity Risk | Reallocate staff to high-load fitting rooms |

---

## 8. Proposed implementation structure

### 8.1 Dashboard catch-all router 方案

```text
api/dashboard/[...route].js
server/routers/dashboard-router.js
server/handlers/dashboard/summary.js
server/handlers/dashboard/opportunities.js
server/handlers/dashboard/actions.js
server/services/dashboard-metrics.js
```

### 8.2 Router dispatch rules

| Path segments | Method | Handler | Error |
| --- | --- | --- | --- |
| `summary` | GET | `handleDashboardSummary` | other methods return 405 |
| `opportunities` | GET | `handleDashboardOpportunities` | other methods return 405 |
| `actions` | GET | `handleDashboardActions` | other methods return 405 |
| unknown | any | none | return 404 |

### 8.3 Handler responsibilities

| Handler | Responsibilities |
| --- | --- |
| `handleDashboardSummary` | query source data, build all dashboard sections, return full response |
| `handleDashboardOpportunities` | compute opportunity rows, sort, rank, paginate if needed |
| `handleDashboardActions` | compute recommended actions and operation priorities |

### 8.4 Shared service responsibilities

`server/services/dashboard-metrics.js` 應集中放置純計算邏輯：

- `buildDashboardSummary`
- `computeRevenueImpact`
- `computeJourneyFunnel`
- `computeTopRevenueOpportunities`
- `computeRecommendedActions`
- `computeOperationAlerts`
- `computeReplenishmentRisk`
- `buildLiveBoard`

---

## 9. Authentication and authorization

### 9.1 建議權限

| Endpoint | Auth required | Roles |
| --- | --- | --- |
| `/api/dashboard/summary` | yes | admin、user、trial |
| `/api/dashboard/opportunities` | yes | admin、user、trial |
| `/api/dashboard/actions` | yes | admin、user、trial |

### 9.2 權限原則

- 沿用現有 [`server/auth.js`](../server/auth.js:1) 的 token/session 驗證策略。
- Trial 帳號可讀 dashboard，但不可觸發 mutation。
- Dashboard 3.1 初版全為 GET endpoint，不提供寫入操作。

---

## 10. Error response

建議統一錯誤格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid range parameter"
  }
}
```

### 10.1 Error codes

| HTTP status | Code | Condition |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | invalid query parameters |
| 401 | `UNAUTHORIZED` | missing or invalid auth |
| 403 | `FORBIDDEN` | role not allowed |
| 404 | `NOT_FOUND` | unknown dashboard route |
| 405 | `METHOD_NOT_ALLOWED` | unsupported HTTP method |
| 500 | `INTERNAL_ERROR` | unexpected server error |

---

## 11. Caching strategy

### 11.1 初版建議

不做持久快取，只做短時間 HTTP cache 或無快取。

建議 header：

```text
Cache-Control: no-store
```

原因：

- RFID fitting room state 接近即時資料。
- Demo 階段避免 cache 造成狀態看起來不同步。

### 11.2 後續可優化

若資料量增加，可對 opportunities 與 actions 加上短 TTL：

```text
Cache-Control: private, max-age=15
```

---

## 12. Migration path

### Phase 1：目前採用

- 不新增 API。
- Dashboard 由 [`public/js/main.js`](../public/js/main.js:1) 以前端 view model 計算。
- 完成 UI 改版與商業 storytelling。

### Phase 2：釋出 function 配額

- 評估退役 [`api/login.js`](../api/login.js:1)。
- 評估移除或 rewrite [`api/admin/users/[userId].js`](../api/admin/users/%5BuserId%5D.js:1)，讓使用者更新與刪除統一進 [`api/admin/[...route].js`](../api/admin/%5B...route%5D.js:1)。
- 確認 Vercel function 數量有空間。

### Phase 3：新增單一 dashboard router

- 新增 `api/dashboard/[...route].js` 或 `api/app/[...route].js`。
- 新增 dashboard router、handlers、metrics service。
- 前端改為優先 fetch dashboard summary API，失敗時 fallback 到前端 view model。

### Phase 4：後端正式成為 source of truth

- Dashboard 商業計算由後端統一回傳。
- 前端只負責 render。
- 可新增更完整的 drill-down 與 export 功能。

---

## 13. Test checklist

### 13.1 Function limit

- [ ] 不新增多個 dashboard API function。
- [ ] 若新增 dashboard API，只新增 1 個 catch-all function。
- [ ] 部署前確認 Vercel function 總數未超過 12。

### 13.2 Router tests

- [ ] GET `/api/dashboard/summary` 回 200。
- [ ] GET `/api/dashboard/opportunities` 回 200。
- [ ] GET `/api/dashboard/actions` 回 200。
- [ ] POST `/api/dashboard/summary` 回 405。
- [ ] GET `/api/dashboard/unknown` 回 404。

### 13.3 Response tests

- [ ] summary response 包含 storeStatus。
- [ ] summary response 包含 revenueImpact。
- [ ] summary response 包含 journeyFunnel。
- [ ] summary response 包含 aiInsight。
- [ ] summary response 包含 recommendedActions。
- [ ] summary response 包含 topRevenueOpportunities。
- [ ] summary response 包含 operationAlerts。
- [ ] summary response 包含 replenishmentRisk。
- [ ] summary response 包含 liveBoard。

### 13.4 Calculation tests

- [ ] 分母為 0 時不出現 NaN。
- [ ] 缺少 price 時不出現 NaN。
- [ ] opportunityScore 排序穩定。
- [ ] long dwell 可產生 staff_follow_up action。
- [ ] try-on 有量但無 sale 可產生 product_review action。
- [ ] low stock 可產生 restock action。

### 13.5 Frontend integration tests

- [ ] 前端能以 dashboard summary API render 全頁。
- [ ] API 失敗時可 fallback 到前端 view model。
- [ ] Technical Live Board 不受 API 切換影響。
- [ ] Drag-and-drop 與 complete sale 流程不受 API 切換影響。

---

## 14. Final recommendation

建議目前維持前端計算，先完成 Dashboard 3.1 UI 改版。

若後續要 API 化，最推薦做法是：

1. 先釋出 Vercel function 配額。
2. 新增單一 `api/dashboard/[...route].js`。
3. 將 summary、opportunities、actions 全部掛在同一個 dashboard router。
4. 把純計算邏輯放在 `server/services/dashboard-metrics.js`，讓前端與後端計算規則容易對照與測試。
