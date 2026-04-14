# v2 文件交叉檢查清單與開發順序

## 1. 交叉檢查清單

### 1.1 角色與權限一致性
- [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md) 定義前台角色僅 `trial` `user` `admin`，系統角色 `service_backend`。
- [`plans/api_spec_v2.md`](plans/api_spec_v2.md) 的寫入 API 權限需與 M1 一致。
- [`plans/module_m3_spec_v2.md`](plans/module_m3_spec_v2.md) 與 [`plans/module_m7_spec_v2.md`](plans/module_m7_spec_v2.md) 需同時落實 `trial` 不可匯入。

### 1.2 狀態語意一致性
- [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md) 與 [`plans/schema_v2_freeze.md`](plans/schema_v2_freeze.md) 必須同時定義：
  - `left_fitting_room` 不作 `current_status`
  - `checkout` 為未完成交易
  - `sold` 為交易完成最終狀態
- [`plans/module_m4_spec_v2.md`](plans/module_m4_spec_v2.md)、[`plans/module_m5_spec_v2.md`](plans/module_m5_spec_v2.md)、[`plans/module_m8_spec_v2.md`](plans/module_m8_spec_v2.md) 不得出現衝突語意。

### 1.3 補貨建議公式一致性
- 固定公式統一為
  - `recommended_restock_qty = max(0, sold_7d * 1.2 - current_stock)`
- 公式需在下列文件一致：
  - [`plans/module_m1_spec_v2.md`](plans/module_m1_spec_v2.md)
  - [`plans/module_m8_spec_v2.md`](plans/module_m8_spec_v2.md)
  - [`plans/module_m9_spec_v2.md`](plans/module_m9_spec_v2.md)
  - [`plans/schema_v2_freeze.md`](plans/schema_v2_freeze.md)

### 1.4 API 與前端相容一致性
- [`plans/api_spec_v2.md`](plans/api_spec_v2.md) 僅保留兩支寫入 API，不新增讀取 API。
- 前端錯誤解析需相容 `error` 與 `message` 鍵名。
- `POST /api/bulk-products` 權限需阻擋 `trial`。

### 1.5 文件層級依賴一致性
- M2 以 M1 為前置。
- M3 依賴 M1 M2。
- M4 依賴 M1 M2。
- M5 依賴 M1 M2 M4。
- M6 依賴 M1 M2 M4 M5。
- M7 依賴 M1 M2 M3 M4 M5 M6。
- M8 依賴 M1 M2 M4 M5 M6 M7。
- M9 依賴 M1 至 M8。

## 2. 開發順序

### 階段 A 基線與資料契約
1. M1 基線治理
2. M2 資料模型與遷移基線
3. API v2 凍結
4. Schema v2 凍結

### 階段 B 事件與狀態主鏈路
5. M3 商品主檔與匯入
6. M4 事件接收與標準化
7. M5 在場快照與 Session 管理
8. M6 轉化計算與 KPI 引擎

### 階段 C 體驗與營運可視化
9. M7 前台 2D 場景互動
10. M8 Dashboard 與事件流
11. M9 部署與運維驗證

## 3. 進入實作前的最終 gate
- Gate 1：角色值僅 `trial` `user` `admin` 加 `service_backend`。
- Gate 2：`left_fitting_room` 語意已全文件統一。
- Gate 3：補貨公式 B 已全文件統一。
- Gate 4：`trial` 不可匯入已在 API 與前端策略對齊。
- Gate 5：M9 smoke 流程已包含角色與公式驗證。
