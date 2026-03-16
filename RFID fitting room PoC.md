# Technical Project Outline: RFID Fitting Room PoC

## 1. System Architecture & Tech Stack
- **Frontend / UI:** HTML5, CSS3, Vanilla JavaScript (or lightweight React)
- **Hosting / Deployment:** Vercel (Auto-deploy via GitHub)
- **Database / Backend as a Service (BaaS):** Supabase (PostgreSQL, PostgREST API)
- **Real-time Engine:** Supabase Realtime Subscriptions
- **Serverless / Edge Logic:** Vercel Serverless Functions (for data processing)
- **Source Control:** `https://github.com/dululu-chh/rfid-fitting-room-poc`

## 2. Core Workflows & State Machine
- **State Flow:** `RACK` -> `FITTING_ROOM` -> `CHECKOUT` -> `SOLD`
- **Data Payload Standard (Virtual Reader to Backend):**
  ```json
  {
    "reader_id": "STRING (e.g., FITTING_ROOM_ANTENNA_1)",
    "epc_data": "STRING (SGTIN-96 Hex/Binary representation)",
    "timestamp": "ISO 8601 UTC String"
  }