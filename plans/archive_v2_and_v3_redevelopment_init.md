# v2 封存與 v3 重開發初始化紀錄

## 1) 封存命名（已確認）
- Git Tag：`v2-final`
- Git Branch：`archive/v2`
- 檔案封存目錄：`archive_v2_code/`

## 2) 已執行封存動作
1. 建立封存提交：`chore: freeze current state for v2 archive baseline`
2. 建立並推送 Tag：`v2-final`
3. 建立並推送 Branch：`archive/v2`
4. 建立資料夾封存：`archive_v2_code/`（以工作區現況完整複製）

## 3) 還原方式
### 3.1 還原到封存點（detached HEAD）
```bash
git checkout v2-final
```

### 3.2 以封存分支為基線開發修補
```bash
git checkout archive/v2
```

### 3.3 對照本地檔案封存
直接比對 `archive_v2_code/` 與目前工作目錄。

## 4) 文件凍結策略（v2 -> frozen）
- 舊版（v1/v2）規格與設計檔視為「封存參考」，不再作為新功能實作依據。
- 新開發唯一來源改為 `規格書 3.0/` 目錄下文件。
- 若 `plans/` 與 `規格書 3.0/` 出現衝突，以 `規格書 3.0/` 為準，並在對應計畫文件註記差異。

## 5) v3 重開發初始化原則
1. **保留**：部署與環境基礎設施（如 `vercel.json`、CI/CD 慣例）。
2. **重建**：API 契約、資料模型、前端流程、事件規則，全部以 3.0 規格重做。
3. **隔離**：v2 舊邏輯不得直接沿用到 v3 主幹；必要借鑑需明確註記來源與差異。
4. **可追溯**：每個新模組都要對應到 3.0 章節與驗收條件。

## 6) 里程碑與交付順序（初始化版）
### Milestone A：契約凍結
- A1. 角色/權限矩陣
- A2. API I/O 契約
- A3. DB schema 與 migration baseline

### Milestone B：核心鏈路
- B1. RFID 事件接收與標準化
- B2. Session/在場狀態引擎
- B3. KPI 與警示規則

### Milestone C：前台與營運
- C1. 前台互動流程
- C2. 後台 dashboard
- C3. smoke test 與部署驗收

## 7) 驗收閘門（Gate）
- Gate 1：所有資料欄位與狀態定義皆可對映至 3.0 文件。
- Gate 2：API 權限與角色限制可被測試案例驗證。
- Gate 3：事件規則與警示規則具可重現測試。
- Gate 4：前後端整合 smoke test 全數通過。

