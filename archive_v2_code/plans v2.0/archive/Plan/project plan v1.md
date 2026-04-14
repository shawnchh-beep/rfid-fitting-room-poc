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

3. Development Sprints (AI / OpenClaw Execution Plan)
Phase 1: Database Setup & Supabase Configuration
Objective: Establish the foundation data layer and product mapping.

Task 1.1 - Database Schema (SQL): - Create table products: id, epc_company_prefix, item_reference, name, image_url, price.

Create table rfid_events: id, epc_data, reader_id, state, timestamp.

Task 1.2 - Row Level Security (RLS): Configure Supabase RLS policies to allow anonymous inserts for the PoC (or set up a generic anon key).

Task 1.3 - Mock Data: Write a SQL seed script to insert 3-5 clothing items with valid predefined SGTIN-96 mapping data.

Phase 2: Core Logic & Vercel Serverless API
Objective: Create the decoding and debouncing middleware.

Task 2.1 - SGTIN-96 Decoder Utility: Write a pure JavaScript function (sgtin96.js) to parse SGTIN-96 hex strings into CompanyPrefix and ItemReference.

Task 2.2 - Vercel Serverless Function (/api/rfid-webhook):

Input: Standardized JSON Payload from Phase 2.

Logic: 1. Decode EPC to identify the product.
2. Debounce check: Query Supabase to ensure the exact same epc_data hasn't been logged by the same reader_id in the last 3 seconds.
3. Insert the valid event into the Supabase rfid_events table.

Output: HTTP 200 OK status.

Phase 3: Virtual Reader UI (Frontend Simulator)
Objective: Build the web-based drag-and-drop interface simulating physical RFID antennas.

Task 3.1 - Layout & CSS Grid: Create a dashboard with three distinct drop zones: RACK, FITTING_ROOM, and CHECKOUT.

Task 3.2 - HTML5 Drag and Drop API: Implement drag logic for clothing item images.

Task 3.3 - API Integration: On drop event, extract the item's mocked EPC, construct the standard JSON payload, and fetch(POST) to the Vercel Serverless Function (/api/rfid-webhook).

Phase 4: Real-time Analytics Dashboard
Objective: Visualize the conversion funnel dynamically.

Task 4.1 - Supabase Realtime Setup: Initialize the Supabase JS Client in the frontend and subscribe to INSERT events on the rfid_events table.

Task 4.2 - Metrics Calculation: Compute total items on rack, total items entered fitting room, and total checkouts.

Task 4.3 - Data Visualization: Integrate Chart.js to render a live Funnel Chart. Whenever the Supabase Realtime subscription triggers, update the chart data without reloading the page.

4. Hardware Transition Readiness
The frontend UI acts purely as an event emitter.

Once physical RFID gateways are acquired, they will bypass Phase 3 and push directly to the Phase 2 /api/rfid-webhook endpoint using the exact same JSON schema.