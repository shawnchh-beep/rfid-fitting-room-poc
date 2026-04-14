
Demo Controls Panel UI 規格 

1. 定位

Demo Controls Panel 是 隱藏式側邊控制面板，用途是讓 demo 操作者快速產生模擬事件、執行情境、管理測試資料。
不是主展示內容的一部分，預設應收合，避免破壞主畫面專業感。

⸻

2. 顯示方式

2.1 開啟方式

主畫面右上角放一個按鈕：
	•	按鈕名稱：Demo Controls
	•	icon：sliders / settings / panel-right
	•	位置：頁面右上角，靠近 refresh / filter 區

2.2 面板行為
	•	從右側滑出
	•	寬度建議：360px ~ 420px
	•	高度：全高，貼齊 viewport
	•	可關閉
	•	點背景可收合
	•	支援桌面版優先，不必先做 mobile 優化

2.3 預設狀態
	•	預設收合
	•	只有在 demo 操作時才開啟
	•	關閉後主畫面恢復完整寬度

⸻

3. 視覺風格

3.1 風格定位
	•	B2B SaaS dashboard
	•	簡潔、克制、專業
	•	不要像工程 debug panel
	•	不要太多鮮豔色塊

3.2 視覺原則
	•	背景：白色或極淺灰
	•	區塊卡片化，但陰影輕微
	•	邊框細、圓角小到中等
	•	間距一致
	•	一個區塊只做一件事

3.3 狀態色建議
	•	Primary action：深藍 / 黑灰系
	•	Success：綠
	•	Warning：橘
	•	Danger / Reset：紅
	•	Badge 狀態色可明顯，但整體控制克制

⸻

4. Panel 結構

面板分成 4 個區塊，由上到下排列：
	1.	Header
	2.	Quick Actions
	3.	Scenario Presets
	4.	Data Utilities

⸻

5. Header 區規格

5.1 內容

顯示：
	•	標題：Demo Controls
	•	副標：Simulation & data actions
	•	右上角：Close icon

5.2 功能
	•	可直接關閉 panel
	•	不放太多說明文字

5.3 視覺
	•	固定在 panel 頂部
	•	下方有分隔線
	•	高度約 64px ~ 72px

⸻

6. Quick Actions 區規格

6.1 用途

讓操作員快速建立單一事件。

6.2 區塊標題

Quick Actions

副說明：
Run a single simulated event

6.3 表單欄位

欄位 1：Product
	•	類型：dropdown / searchable select
	•	label：Product
	•	placeholder：Select a product
	•	顯示內容建議：
	•	SKU
	•	Product name
	•	optional: EPC 簡短碼

範例：
	•	SKU-001 / Black Polo / EPC-0001
	•	SKU-002 / White Tee / EPC-0002

⸻

欄位 2：Fitting Room
	•	類型：dropdown
	•	label：Fitting Room
	•	placeholder：Select a room

選項：
	•	Room 1
	•	Room 2
	•	Room 3
	•	Room 4

⸻

欄位 3：Action
	•	類型：dropdown
	•	label：Action
	•	placeholder：Select an action

選項建議：
	•	Enter Room
	•	Exit Room
	•	Mark Sale
	•	Trigger Alert
	•	Resolve Alert

⸻

欄位 4：Note
	•	類型：optional text input
	•	label：Note
	•	placeholder：Optional note

用途：
	•	加備註
	•	demo 時說明特殊案例

⸻

6.4 按鈕

主按鈕：
	•	名稱：Run Action
	•	類型：primary button
	•	寬度：滿版

次要行為：
	•	執行後可顯示 toast：Action executed successfully

⸻

6.5 驗證規則

基本規則
	•	Enter Room：必須選 product + room
	•	Exit Room：必須選 product + room
	•	Mark Sale：至少選 product
	•	Trigger Alert：至少選 product + room
	•	Resolve Alert：需有 active alert 才可執行

錯誤提示

用 inline error，不要用太多彈窗。

⸻

6.6 UI 補充

Quick Actions 區下方可顯示一行小字：

Each action creates an event record and updates session status.

⸻

7. Scenario Presets 區規格

7.1 用途

讓操作者一鍵跑完整情境，不必手動逐步觸發。

7.2 區塊標題

Scenario Presets

副說明：
Run prebuilt demo scenarios

⸻

7.3 呈現方式

用 卡片列表 或 button list，不要做太複雜。

每個 scenario card 包含：
	•	scenario 名稱
	•	一句簡短描述
	•	Run 按鈕

⸻

7.4 預設情境清單

Scenario 1：Normal Try-On

描述：
Item enters a fitting room and exits within normal dwell time.

系統動作：
	•	建立 enter event
	•	幾秒後建立 exit event
	•	session 狀態 = exited
	•	不觸發 alert
	•	不成交

⸻

Scenario 2：Long Dwell

描述：
Item stays in the fitting room beyond threshold and triggers an alert.

系統動作：
	•	enter event
	•	停留超時
	•	觸發 overdue alert
	•	session 狀態 = overdue

⸻

Scenario 3：Try-On to Purchase

描述：
Item is tried on and sold within conversion window.

系統動作：
	•	enter event
	•	exit event
	•	sale event
	•	session is_converted = true

⸻

Scenario 4：Multi-Item Try-On

描述：
Multiple items enter the same room in one session.

系統動作：
	•	2~3 件商品進同一 room
	•	其中部分離開
	•	可選擇一件成交

⸻

Scenario 5：Unpurchased Exit

描述：
Item leaves the room without purchase.

系統動作：
	•	enter
	•	exit
	•	no sale
	•	session closed

⸻

7.5 執行方式

每個 card 一個按鈕：
	•	Run Scenario

執行時：
	•	按鈕 loading 狀態
	•	完成後 toast 提示
	•	recent events 自動更新

⸻

7.6 UI 重點
	•	每張卡不要太高
	•	文字短
	•	同一區塊最多先放 4~5 個 scenario
	•	不要可編輯流程，先做固定版本

⸻

8. Data Utilities 區規格

8.1 用途

管理 demo 資料，不屬於主流程，但對展示很重要。

8.2 區塊標題

Data Utilities

副說明：
Manage demo data and environment

⸻

8.3 功能按鈕

按鈕 1：Seed Today’s Data

用途：
	•	產生今天的模擬試穿、警示、成交資料

結果：
	•	dashboard 有當日數字可看
	•	recent events 有內容

⸻

按鈕 2：Generate 7-Day History

用途：
	•	產生過去 7 天歷史資料

結果：
	•	趨勢圖有資料
	•	KPI 看起來完整

⸻

按鈕 3：Reset Demo Data

用途：
	•	清除當前 demo session / events / alerts / sales

注意：
	•	需二次確認
	•	用 danger style button

確認文字：
This will reset the current demo environment.

⸻

按鈕 4：Clear Active Alerts

用途：
	•	一鍵清掉目前 active alerts
	•	方便快速回到乾淨狀態

⸻

8.4 UI 呈現

建議用垂直 button stack：
	•	Seed Today’s Data
	•	Generate 7-Day History
	•	Clear Active Alerts
	•	Reset Demo Data

其中 Reset 與其他按鈕間隔拉大一點，避免誤按。

⸻

9. 狀態回饋規格

9.1 執行中

執行 action / scenario / utility 時：
	•	按鈕進入 loading
	•	防止重複點擊

9.2 成功

顯示 toast：
	•	Action completed
	•	Scenario executed
	•	Demo data generated
	•	Alerts cleared

9.3 失敗

顯示 toast 或 inline error：
	•	Failed to execute action
	•	Unable to generate demo data

錯誤訊息簡短即可。

⸻

10. 與主畫面互動規格

當 panel 執行動作後，主畫面下列區塊要同步刷新：
	•	KPI cards
	•	Live room status
	•	Recent events
	•	Alerts panel
	•	Session list

更新方式：
	•	可先用簡單 refresh
	•	不必一開始就做即時 websocket
	•	若有 Supabase subscription 再加分

⸻

11. 權限與模式規格

11.1 顯示條件

建議只在以下情境顯示：
	•	demo mode = on
	•	admin mode = on

一般客戶展示模式可選擇隱藏。

11.2 模式切換

可先簡化成：
	•	一個變數控制是否顯示按鈕
	•	不必先做完整 auth

⸻

12. 元件清單

AI 開發時，元件只需要這些：
	•	Side Sheet / Drawer
	•	Section Header
	•	Searchable Select
	•	Select Dropdown
	•	Text Input
	•	Primary Button
	•	Secondary Button
	•	Danger Button
	•	Card
	•	Badge
	•	Toast
	•	Divider

夠了，不要再加複雜互動元件。

⸻

13. 版面尺寸建議

Panel
	•	width: 380px 為優先
	•	padding: 20px
	•	section gap: 20px ~ 24px

表單欄位
	•	每欄 full width
	•	vertical spacing: 12px

按鈕
	•	高度：40px ~ 44px

⸻

14. 文案規格

整體文案風格：
	•	短
	•	清楚
	•	商業感
	•	不要工程術語過重

建議用字：
	•	Demo Controls
	•	Quick Actions
	•	Scenario Presets
	•	Data Utilities
	•	Run Action
	•	Run Scenario
	•	Reset Demo Data

不要用字：
	•	Fake Data
	•	Debug Tool
	•	Test Event
	•	Random Stuff
	•	Hack Panel

⸻

15. MVP 範圍

第一版只做這些就夠：

必做
	•	右側可收合 panel
	•	Quick Actions
	•	4 個固定 scenarios
	•	Seed / Reset / Clear Alerts
	•	toast success/error
	•	主畫面刷新

可延後
	•	自訂 scenario editor
	•	批次事件編排
	•	事件排程器
	•	動畫流程播放
	•	角色權限系統

⸻

16. 可直接給 AI 的開發摘要

你可以直接把這段丟給 AI：

請建立一個 RFID fitting room demo 的右側可收合 Demo Controls panel，風格為乾淨專業的 B2B SaaS dashboard。
Panel 寬度約 380px，包含 3 個主要區塊：
	1.	Quick Actions

	•	Product searchable select
	•	Fitting Room select
	•	Action select
	•	Optional note
	•	Run Action button

	2.	Scenario Presets

	•	顯示 4~5 個固定 scenario cards
	•	每張卡有 title、short description、Run Scenario button

	3.	Data Utilities

	•	Seed Today’s Data
	•	Generate 7-Day History
	•	Clear Active Alerts
	•	Reset Demo Data

執行後需顯示 toast，並刷新 dashboard 的 KPI、live room status、recent events、alerts。
整體 UI 不要像 debug tool，要像正式 solution demo 的控制面板。

