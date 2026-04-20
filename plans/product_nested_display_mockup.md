# Product 頁面巢狀顯示示意圖

## 顯示模式切換

```mermaid
flowchart LR
  A[Product Summary 區塊] --> B[顯示模式切換]
  B --> C[SKU 單層模式 現行]
  B --> D[巢狀模式 新增]
```

## 巢狀模式結構

```mermaid
flowchart TD
  A[Product Summary 巢狀模式] --> B[Style STY0001]
  A --> C[Style STY0002]

  B --> B1[Color Black]
  B --> B2[Color White]

  B1 --> B1a[Size XS 庫存 3 銷售 1 總數 4]
  B1 --> B1b[Size S 庫存 2 銷售 0 總數 2]
  B2 --> B2a[Size M 庫存 5 銷售 2 總數 7]

  B1a --> T1[EPC 明細表]
  T1 --> T1a[EPC 1 位置 RACK]
  T1 --> T1b[EPC 2 位置 FITTING_ROOM]
  T1 --> T1c[EPC 3 位置 SOLD]
```

## 互動規則

- 預設顯示 [`SKU 單層模式`](public/js/main.js:2312)
- 可由切換按鈕進入巢狀模式
- 巢狀模式允許多節點同時展開
- 巢狀模式預設全部收合
- 排序規則為 style_no 升冪 → color 升冪 → size XS S M L XL 優先 其餘自然排序
