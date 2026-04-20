

拖拉式試衣間頁面 UI 規格 v1.0

1. 頁面目的

本頁面用於展示 RFID fitting room demo 的核心操作流程，讓使用者可以透過拖拉商品完成以下行為：
	•	從 Rack 拖入 Fitting Room
	•	從 Fitting Room 拖回 Rack
	•	從 Fitting Room 拖到 Checkout
	•	從 Rack 直接拖到 Checkout

本頁面重點是：
	•	流程清楚
	•	操作直覺
	•	可視化商品移動
	•	事件邏輯與 UI 同步
	•	適合 demo 與講解商業情境

⸻

2. 頁面定位

此頁面是 流程操作頁，不是資料維護頁。

因此設計原則為：
	•	重互動
	•	重流程理解
	•	輕表單感
	•	保持企業感，不做成遊戲介面
	•	視覺上乾淨、有層次、易於 demo

⸻

3. 頁面名稱

建議頁面標題：

Fitting Room Demo

副標可選：

Drag items through the try-on and purchase journey

⸻

4. 整體版面結構

4.1 主要結構

整頁採用：
	•	上方：Top Bar
	•	中間：三欄式主操作區
	•	下方：事件 / session 資訊區（可選）

⸻

4.2 三欄式主操作區

左欄

Rack / Sales Floor

中欄

Fitting Rooms

右欄

Checkout / Purchased

⸻

4.3 建議寬度比例
	•	左欄：28%
	•	中欄：44%
	•	右欄：28%

若畫面較寬可調整為：
	•	左 30 / 中 40 / 右 30

⸻

5. Top Bar 規格

5.1 內容

Top Bar 應包含：

左側
	•	頁面標題：Fitting Room Demo
	•	副標：簡短說明

右側操作
	•	Reset Demo
	•	Seed Scenario
	•	Active Alerts badge
	•	optional: Demo Controls

⸻

5.2 視覺要求
	•	高度約 64px ~ 80px
	•	底部可有淡分隔線
	•	不要過重陰影
	•	與主內容有明顯間距

⸻

6. 主操作區規格

⸻

6.1 左欄：Rack / Sales Floor

6.1.1 用途

展示目前可被試穿或直接購買的商品。

⸻

6.1.2 區塊標題
	•	Rack
或
	•	Sales Floor

副說明可選：
	•	Available items ready for try-on or purchase

⸻

6.1.3 呈現方式

用 垂直商品卡片列表 顯示。

每張 item card 為可拖動元素。

⸻

6.1.4 每張商品卡顯示資訊

建議包含：
	•	商品縮圖 placeholder
	•	product name
	•	color
	•	size
	•	SKU 或 EPC short code
	•	optional: price
	•	status badge

⸻

6.1.5 商品卡視覺
	•	白底卡片
	•	淡灰邊框
	•	小圓角
	•	hover 時略浮起
	•	draggable 時顯示 move cursor
	•	拖曳中卡片本體可降低透明度

⸻

6.1.6 Rack 區 UI 狀態

空狀態
顯示：
	•	No items on rack

一般狀態
顯示所有 on_floor 商品

⸻

7. 中欄：Fitting Rooms

7.1 用途

展示試衣間 drop zones 與房內商品狀態。

⸻

7.2 區塊標題
	•	Fitting Rooms

副說明可選：
	•	Drag items here to simulate try-on

⸻

7.3 房間數量

v1 固定顯示 4 間：
	•	Room 1
	•	Room 2
	•	Room 3
	•	Room 4

⸻

7.4 排版方式

建議 2 x 2 grid：
	•	左上：Room 1
	•	右上：Room 2
	•	左下：Room 3
	•	右下：Room 4

⸻

7.5 每個 Room Card 結構

每張 room card 包含：

Header
	•	Room name
	•	occupancy badge
	•	optional room status badge

Body
	•	房內商品列表
	•	若無商品則顯示 empty state

Footer / Status area
	•	dwell timer
	•	alert badge（若有）
	•	optional: latest action

⸻

7.6 Room Card 空狀態

顯示：
	•	Drop items here
	•	或 Room is empty

⸻

7.7 房內商品顯示方式

Room 內的商品可用以下方式顯示：

方案 A：小卡片

每件商品顯示簡化卡片：
	•	name
	•	size
	•	short SKU/EPC
	•	dwell time

方案 B：item chips

如果要更緊湊，可用 chip/card 混合形式。

v1 建議採 小卡片，較清楚。

⸻

7.8 房間狀態顯示

Normal
	•	無警示
	•	顯示一般灰 / 藍色系

Occupied
	•	顯示 occupancy 數量
	•	可微弱高亮邊框

Alert / Overdue
	•	顯示 alert badge
	•	room card 邊框或 badge 轉 warning / danger 色

⸻

7.9 拖拉互動

Room card 是合法 drop zone，僅接受：
	•	來自 Rack 的 item

不接受：
	•	Checkout 商品
	•	其他 room 的商品（v1）

⸻

8. 右欄：Checkout / Purchased

8.1 用途

展示完成購買的商品。

⸻

8.2 區塊標題
	•	Checkout
或
	•	Purchased

副說明可選：
	•	Drop items here to complete purchase

⸻

8.3 呈現方式

用一個主要 drop zone + 已購買商品列表。

⸻

8.4 已購買商品顯示資訊

每筆可顯示：
	•	product name
	•	size
	•	sale type badge
	•	time

⸻

8.5 Sale Type Badge

需可區分：
	•	Try-On Purchase
	•	Direct Purchase

這對 demo 很重要。

⸻

8.6 Checkout drop zone 規則

可接受來源：
	•	Rack
	•	Fitting Room

⸻

8.7 空狀態

顯示：
	•	No purchases yet

⸻

9. Item Card 規格

9.1 基本內容

每張 item card 建議欄位：
	•	image placeholder
	•	product_name
	•	color / size
	•	sku or epc short code
	•	optional: price
	•	status badge

⸻

9.2 狀態 badge

on_floor
	•	On Floor

in_room
	•	In Room

sold
	•	Sold

⸻

9.3 可拖曳條件

可拖動
	•	on_floor
	•	in_room

不可拖動
	•	sold

⸻

9.4 Sold item 樣式
	•	透明度略降
	•	cursor 不可拖
	•	badge 顯示 sold

⸻

10. 拖拉互動規格

10.1 拖曳開始

當使用者開始拖曳 item 時：
	•	item card 進入 dragging 狀態
	•	合法 drop zones 高亮
	•	不合法區域不高亮

⸻

10.2 拖曳中
	•	顯示 drag preview / ghost card
	•	當 hover 在合法區時，該區塊高亮邊框
	•	若 hover 在不合法區，不顯示接收狀態

⸻

10.3 成功放下

放下後：
	1.	執行事件邏輯
	2.	成功後更新 UI
	3.	顯示 toast 成功提示

⸻

10.4 放下失敗

若 drop 非法或 API 失敗：
	•	item 回彈原位
	•	顯示錯誤提示
	•	Invalid move
	•	Unable to complete action

⸻

11. Drop Zone 視覺規格

11.1 預設狀態
	•	淡灰邊框
	•	背景白色或極淡灰

11.2 可接收 hover 狀態
	•	邊框變為 primary color
	•	背景可加 very soft primary tint

11.3 不可接收狀態
	•	不變色
	•	或顯示淡紅提示（可選）

⸻

12. 下方資訊區（建議加入）

雖然主體是拖拉，但建議在頁面下半部或右側補一個資訊區，避免整頁只有拖拉。

可包含以下兩塊：

⸻

12.1 Recent Events

表格欄位：
	•	time
	•	item
	•	room
	•	event_type
	•	status

用途：
	•	讓使用者看見拖拉背後有事件發生

⸻

12.2 Active Session / Selected Item Detail

顯示：
	•	selected item
	•	current room
	•	entered_at
	•	dwell time
	•	session status

這塊能幫助 demo 講解。

⸻

13. 頁面狀態與訊息

13.1 Toast 成功訊息

建議文字：
	•	Item entered fitting room
	•	Item returned to rack
	•	Purchase completed
	•	Direct purchase completed
	•	Demo reset successfully

⸻

13.2 Toast 錯誤訊息

建議文字：
	•	Invalid move
	•	This item cannot be dropped here
	•	Failed to update item state
	•	Action could not be completed

⸻

14. 視覺風格規範

14.1 風格方向
	•	enterprise SaaS
	•	clean
	•	modern
	•	structured
	•	professional

⸻

14.2 頁面背景

建議沿用全站背景：

linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)


⸻

14.3 卡片風格
	•	card background: #FFFFFF
	•	border: #E2E8F0
	•	rounded: 12px ~ 16px
	•	subtle shadow

⸻

14.4 主要色
	•	primary: #2563EB
	•	hover: #1D4ED8
	•	success: #16A34A
	•	warning: #D97706
	•	danger: #DC2626

⸻

15. 響應式策略

v1 優先支援 desktop。
mobile 不需完整拖拉體驗。

Tablet / 小螢幕

可退化為：
	•	上方 Rack
	•	中間 Rooms
	•	下方 Checkout

但 v1 開發重點仍是 desktop。

⸻

16. 元件清單

本頁建議元件：
	•	Page Header
	•	Action Button
	•	Badge
	•	Draggable Item Card
	•	Drop Zone Card
	•	Room Card
	•	Checkout Panel
	•	Rack List
	•	Events Table
	•	Toast
	•	Empty State
	•	Divider

⸻

17. MVP 範圍

必做
	•	三欄式拖拉頁面
	•	Rack 商品列表
	•	4 個 Fitting Room drop zones
	•	Checkout drop zone
	•	支援 4 條合法路徑
	•	成功 / 失敗提示
	•	Recent Events
	•	基本 badge / 狀態顯示

⸻

可延後
	•	圖片優化
	•	動畫細修
	•	room to room transfer
	•	多商品拖曳
	•	高階 floor map 視覺
	•	自訂 drag overlay 美術

⸻

18. 一句話版結論

這個頁面應該做成：

三欄式、受控拖拉、流程導向的試衣間 demo 操作頁
	•	左：Rack
	•	中：4 個 Fitting Rooms
	•	右：Checkout
	•	下方：Recent Events / Session Detail

畫面重點不是炫，而是讓人一眼理解商品從展示、試穿到成交的流程。

