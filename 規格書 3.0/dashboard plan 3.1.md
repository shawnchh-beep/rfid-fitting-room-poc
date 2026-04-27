以下是 **RFID Fitting Room Dashboard UI Spec v2**。

---

# RFID Fitting Room Dashboard UI Spec v2

## 1. 改版目標

將目前 Dashboard 從：

> RFID 技術監控頁

改成：

> 店鋪營收與轉換率決策中心

核心敘事：

> RFID 不只是追蹤商品，而是找出「顧客試穿後為什麼沒有購買」。

---

# 2. Dashboard 資訊架構

新版分成 5 層：

```text
1. Revenue Impact Layer
2. Store Journey Layer
3. AI Business Insight Layer
4. Action Recommendation Layer
5. Technical Detail Layer
```

---

# 3. 頁面 Layout

```text
[ Header / Store Status ]

[ Revenue Impact Cards ]

[ Customer Journey Funnel ]   [ AI Business Insight ]

[ Top Revenue Opportunities ] [ Recommended Actions ]

[ Operations Alerts ]         [ Replenishment Risk ]

[ Detailed Live Board - Collapsible ]
```

---

# 4. Header 區塊

## Component: DashboardHeader

### 目的

讓使用者立刻知道目前店鋪狀態。

### UI Copy

```text
RFID Retail Conversion Dashboard

Turn fitting room activity into revenue growth.
```

### 顯示欄位

```json
{
  "storeName": "Demo Store",
  "liveStatus": "Live",
  "rfidStatus": "Normal",
  "aiStatus": "Ready",
  "lastUpdatedAt": "2026-04-27T20:30:00+08:00"
}
```

### 狀態顯示

```text
Live Store: Active / Quiet / Offline
RFID Tracking: Normal / Warning / Offline
AI Assistant: Ready / Processing / Disabled
```

---

# 5. Revenue Impact Layer

## Component: RevenueImpactCards

### 目的

第一眼讓老闆看到「錢」。

### 卡片 1：Missed Revenue

```text
Missed Revenue Today
$1,240

Based on high-interest items with no completed sales.
```

### 卡片 2：Potential Uplift

```text
Potential Sales Uplift
+12~18%

If top drop-off items are optimized.
```

### 卡片 3：Conversion Rate

```text
Try-On to Sale Rate
0.0%

Benchmark: 18%
```

### 卡片 4：Top Loss Driver

```text
Top Loss Driver
Northline White Polo Shirt

4 missed sales today
```

### API 欄位

```json
{
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
  }
}
```

---

# 6. Customer Journey Layer

## Component: CustomerJourneyFunnel

### 目的

把 RFID 事件轉成顧客旅程故事。

### UI Copy

```text
Customer Journey Funnel

Where customers drop off before purchase.
```

### Funnel 顯示

```text
Rack Interest      32
Fitting Room       12
Checkout Intent    5
Completed Sales    0
```

### Drop-off 顯示

```text
Main Drop-off Point:
After Fitting Room
```

### API 欄位

```json
{
  "journeyFunnel": {
    "rackInterestCount": 32,
    "fittingRoomCount": 12,
    "checkoutIntentCount": 5,
    "completedSalesCount": 0,
    "tryOnToCheckoutRate": 41.7,
    "checkoutToSaleRate": 0,
    "overallConversionRate": 0,
    "mainDropOffStage": "after_fitting_room"
  }
}
```

---

# 7. AI Business Insight Layer

## Component: AIBusinessInsightCard

### 目的

讓 AI 不只是摘要，而是講商業判斷。

### UI Copy 範例

```text
AI Business Insight

Northline White Polo Shirt shows strong fitting-room interest but no completed sales.

This may indicate a sizing, pricing, styling, or staff assistance issue.
```

### Insight 結構

```json
{
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
  }
}
```

---

# 8. Action Recommendation Layer

## Component: RecommendedActions

### 目的

這是最重要的商業價值區。

不要只顯示問題，要顯示下一步。

### UI Copy

```text
Recommended Actions

Prioritized actions to recover lost sales.
```

### Action Card 範例

```text
1. Assist fitting-room customers faster

Reason:
3 long dwell cases detected.

Suggested Action:
Ask staff to follow up within 3 minutes.
```

### API 欄位

```json
{
  "recommendedActions": [
    {
      "priority": 1,
      "type": "staff_follow_up",
      "title": "Assist fitting-room customers faster",
      "reason": "3 long dwell cases detected.",
      "suggestedAction": "Ask staff to follow up within 3 minutes.",
      "expectedImpact": "Reduce fitting-room drop-off",
      "relatedSkus": [
        "1234567000039",
        "1234567000107",
        "1234567000053"
      ],
      "severity": "high"
    },
    {
      "priority": 2,
      "type": "product_review",
      "title": "Review high-interest item",
      "reason": "White Polo Shirt has 4 try-ons and 0 sales.",
      "suggestedAction": "Check size availability, fit feedback, and price positioning.",
      "expectedImpact": "Recover missed conversion opportunity",
      "relatedSkus": [
        "1234567000084"
      ],
      "severity": "medium"
    }
  ]
}
```

---

# 9. Top Revenue Opportunities

## Component: TopRevenueOpportunities

### 目的

把原本 Top Opportunities 改成「賺錢機會排行」。

### UI Copy

```text
Top Revenue Opportunities

Products with strong interest but low purchase conversion.
```

### 顯示格式

```text
1. Northline White Polo Shirt
4 try-ons
0 sales
Estimated missed revenue: $160
Action: Review fit / price / assistance
```

### API 欄位

```json
{
  "topRevenueOpportunities": [
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

---

# 10. Operations Alerts

## Component: OperationsAlerts

### 目的

把異常狀態翻譯成營運風險。

### 原本語言

```text
Abnormal stay
Uncleared fitting-room items
```

### 新版語言

```text
Customer Experience Risk
3 customers stayed too long in fitting rooms.

Action:
Staff follow-up recommended.
```

### API 欄位

```json
{
  "operationAlerts": [
    {
      "id": "alert_long_dwell",
      "title": "Customer Experience Risk",
      "description": "3 customers stayed too long in fitting rooms.",
      "impact": "Possible lost conversion due to delayed assistance.",
      "action": "Ask staff to follow up within 3 minutes.",
      "severity": "high",
      "count": 3
    },
    {
      "id": "alert_uncleared_items",
      "title": "Uncleared Fitting-Room Items",
      "description": "3 items remain in fitting-room state.",
      "impact": "Inventory status may be inaccurate.",
      "action": "Verify room clear-out and reset item status.",
      "severity": "medium",
      "count": 3
    }
  ]
}
```

---

# 11. Replenishment Risk

## Component: ReplenishmentRisk

### 目的

把庫存資訊轉成補貨決策。

### UI Copy

```text
Replenishment Risk

Low-stock items that may block sales conversion.
```

### 顯示格式

```text
Northline White Polo Shirt / XS
Stock: 3
Risk: Medium
Action: Prepare restock
```

### API 欄位

```json
{
  "replenishmentRisk": [
    {
      "sku": "1234567000060",
      "productName": "Northline White Polo Shirt",
      "color": "White",
      "size": "XS",
      "currentStock": 3,
      "safetyStock": 5,
      "riskLevel": "medium",
      "recommendedAction": "Prepare restock"
    }
  ]
}
```

---

# 12. Detailed Live Board

## Component: DetailedLiveBoard

### 目的

保留技術展示，但不要放在主敘事最前面。

### UI 行為

```text
Default: Collapsed
Button: Show Technical Details
```

### 分區

```text
Rack
Fitting Room
Checkout
Sold
```

### 每個 Item 顯示

```text
Product Name
SKU
Current Location
Status
Dwell Time
Action Button
```

### API 欄位

```json
{
  "liveBoard": {
    "rack": [
      {
        "epc": "30144B5A1C000040000F4241",
        "sku": "1234567000015",
        "productName": "Northline Black Polo Shirt",
        "location": "RACK",
        "status": "RACK",
        "dwellMinutes": 0,
        "lastSeenAt": null
      }
    ],
    "fittingRoom": [],
    "checkout": [],
    "sold": []
  }
}
```

---

# 13. API Endpoint 建議

## GET /api/dashboard/summary

回傳整個 Dashboard 主資料。

```json
{
  "storeStatus": {},
  "revenueImpact": {},
  "journeyFunnel": {},
  "aiInsight": {},
  "recommendedActions": [],
  "topRevenueOpportunities": [],
  "operationAlerts": [],
  "replenishmentRisk": [],
  "liveBoard": {}
}
```

---

## GET /api/dashboard/opportunities

```json
{
  "items": [
    {
      "sku": "1234567000084",
      "productName": "Northline White Polo Shirt",
      "tryOnCount": 4,
      "salesCount": 0,
      "conversionRate": 0,
      "estimatedMissedRevenue": 160,
      "opportunityScore": 52.1
    }
  ]
}
```

---

## GET /api/dashboard/actions

```json
{
  "actions": [
    {
      "priority": 1,
      "title": "Assist fitting-room customers faster",
      "reason": "3 long dwell cases detected.",
      "suggestedAction": "Ask staff to follow up within 3 minutes.",
      "severity": "high"
    }
  ]
}
```

---

# 14. 資料計算邏輯

## Missed Revenue

```text
missedRevenue = tryOnCountWithoutSale × unitPrice
```

## Try-On to Sale Rate

```text
tryOnToSaleRate = completedSalesCount / fittingRoomCount
```

## Opportunity Score

建議公式：

```text
opportunityScore =
tryOnCount × unitPrice × (1 - conversionRate)
```

## Long Dwell

```text
if fittingRoomDwellMinutes > abnormalThresholdMinutes
then longDwell = true
```

---

# 15. UI Copy 對照表

| 舊文案                 | 新文案                      |
| ------------------- | ------------------------ |
| Abnormal Stay       | Customer Experience Risk |
| Opportunity Items   | Revenue Opportunities    |
| AI Summary          | AI Business Insight      |
| Try-On Rate         | Try-On to Sale Rate      |
| Detailed Live Board | Technical Live Board     |
| Rack                | Product Interest         |
| Checkout            | Purchase Intent          |

---

# 16. 視覺風格建議

## 設計方向

```text
B2B SaaS
Clean
Business intelligence
Retail executive dashboard
```

## 色彩建議

```text
Primary: Deep Blue / Indigo
Revenue: Green
Warning: Amber
Critical: Red
Background: Light Gray
Card: White
```

## 風格關鍵字

```text
Executive dashboard
Retail intelligence
Actionable insight
Revenue-first analytics
```

---

# 17. AI Coding Prompt

直接把下面貼給 AI coding 工具。

```text
You are helping refactor an RFID fitting room PoC dashboard into a business-oriented retail conversion dashboard.

Goal:
Transform the existing dashboard from a technical RFID monitoring page into a revenue-focused decision dashboard.

Current page:
- Shows RFID fitting room activity
- Includes rack, fitting room, checkout, sold states
- Includes top opportunities, abnormal stay, AI summary, and live board
- Current UI is too technical and not sales-oriented

New dashboard structure:
1. Header / Store Status
2. Revenue Impact Layer
3. Customer Journey Funnel
4. AI Business Insight
5. Recommended Actions
6. Top Revenue Opportunities
7. Operations Alerts
8. Replenishment Risk
9. Detailed Live Board, collapsed by default

Implementation requirements:

1. Create or refactor the dashboard UI into these components:
- DashboardHeader
- RevenueImpactCards
- CustomerJourneyFunnel
- AIBusinessInsightCard
- RecommendedActions
- TopRevenueOpportunities
- OperationsAlerts
- ReplenishmentRisk
- DetailedLiveBoard

2. Keep the existing RFID live data logic, but change the presentation priority:
- Business metrics should appear first
- Technical SKU/EPC details should be moved to the bottom
- Detailed Live Board should be collapsible by default

3. Replace technical language with business language:
- “Abnormal Stay” → “Customer Experience Risk”
- “Opportunity Items” → “Revenue Opportunities”
- “AI Summary” → “AI Business Insight”
- “Rack” → “Product Interest”
- “Checkout” → “Purchase Intent”

4. Add revenue calculations:
- missedRevenueToday = sum of high-interest items with try-ons but no sale × unit price
- opportunityScore = tryOnCount × unitPrice × (1 - conversionRate)
- tryOnToSaleRate = completedSalesCount / fittingRoomCount

5. Add recommended action logic:
- If long dwell count > 0, recommend staff follow-up
- If try-on count > 0 and sales count = 0, recommend product review
- If stock is below safety stock, recommend restock
- If checkout intent exists but sales are incomplete, recommend checkout flow review

6. API response shape should follow this structure:

{
  "storeStatus": {
    "storeName": "Demo Store",
    "liveStatus": "Active",
    "rfidStatus": "Normal",
    "aiStatus": "Ready",
    "lastUpdatedAt": "ISO timestamp"
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
  "liveBoard": {}
}

7. UI style:
- Use a clean B2B SaaS dashboard style
- Prioritize cards, clear hierarchy, and business language
- Use warning colors for risks and green for revenue opportunities
- Keep EPC/SKU details visible only in the technical detail section

8. Do not remove the existing RFID demo logic.
Only refactor the dashboard storytelling, layout, copywriting, and business metric layer.

Expected result:
The dashboard should feel like a retail conversion optimization product, not just an RFID technical demo.
```

---

# 18. 最優先實作順序

```text
Priority 1:
RevenueImpactCards

Priority 2:
CustomerJourneyFunnel

Priority 3:
RecommendedActions

Priority 4:
TopRevenueOpportunities

Priority 5:
DetailedLiveBoard collapse
```

---

# 19. 最終產品定位

新版 Dashboard 不要再叫：

```text
RFID Fitting Room PoC Dashboard
```

建議改成：

```text
RFID Retail Conversion Dashboard
```

或更商業一點：

```text
Fitting Room Revenue Intelligence
```

一句話：

```text
Turn fitting room activity into actionable revenue growth.
```
