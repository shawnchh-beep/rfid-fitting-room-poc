stateDiagram-v2
    [*] --> RACK
    RACK --> FITTING_ROOM : RFID 標籤讀取
    FITTING_ROOM --> CHECKOUT : 顧客確認購買
    CHECKOUT --> SOLD : 交易完成
    SOLD --> [*]
    FITTING_ROOM --> RACK : 退回貨架
    CHECKOUT --> RACK : 放棄購買