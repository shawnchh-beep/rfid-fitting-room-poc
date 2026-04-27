# [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)

## Scope and confidence

This document is based on current application code and SQL/schema documents in the repository. It is not a live Supabase introspection. If a detail cannot be confirmed from code or SQL files, it is marked as Unknown / Not confirmed from code.

Primary sources:

- Product, inventory, event, presence, and session bootstrap SQL: [`plans/sql_bootstrap_products_and_style_item.sql`](plans/sql_bootstrap_products_and_style_item.sql:18).
- Auth/trial/RLS SQL baseline: [`plans/sql_auth_trial_step1_auth_and_rls.sql`](plans/sql_auth_trial_step1_auth_and_rls.sql:21).
- Auth/trial compatibility repair SQL: [`plans/sql_auth_trial_compat_repair.sql`](plans/sql_auth_trial_compat_repair.sql:20).
- Current database calls in frontend and APIs: [`public/js/main.js`](public/js/main.js:5276), [`api/bulk-products.js`](api/bulk-products.js:416), [`api/rfid-webhook.js`](api/rfid-webhook.js:142), [`api/trial-requests.js`](api/trial-requests.js:200), and [`server/auth.js`](server/auth.js:102).

## Tables referenced by current code

| Table | Main usage | Confirmed key columns from code/SQL |
| --- | --- | --- |
| [`products`](plans/sql_bootstrap_products_and_style_item.sql:19) | Product master records, CSV import, dashboard, fitting catalog | id, epc_company_prefix, item_reference, name, name_en, description_en, sku, style_no, item_no, size, color, image_url, price, epc_data, created_at, updated_at |
| [`product_translations`](plans/sql_bootstrap_products_and_style_item.sql:49) | Locale-specific product names/descriptions | id, product_id, locale, name, description, created_at, updated_at |
| [`inventory_items`](plans/sql_bootstrap_products_and_style_item.sql:64) | Item/EPC-level inventory, status sync, available quantity | id, epc_data, product_id, sku, style_no, item_no, status, created_at, updated_at |
| [`rfid_events`](plans/sql_bootstrap_products_and_style_item.sql:88) | RFID event log, realtime dashboard updates, sales/try-on history | id, epc_data, reader_id, timestamp, event_type, event_source, from_zone, to_zone, metadata, created_at |
| [`fitting_room_presence`](plans/sql_bootstrap_products_and_style_item.sql:104) | Current in-fitting-room snapshot | product_key, entered_at, last_seen_at, last_reader_id, created_at, updated_at |
| [`fitting_room_sessions`](plans/sql_bootstrap_products_and_style_item.sql:113) | Fitting-room session duration and conversion tracking | id, entered_at, exited_at, converted_to_sale, created_at, updated_at in bootstrap SQL; current code expects additional fields described below |
| [`user_profiles`](plans/sql_auth_trial_compat_repair.sql:21) | App profile, role, status, trial expiry | user_id, email, full_name, company_name, job_title, role, status, trial_requested_at, trial_expires_at, invited_by, last_login_at, created_at, updated_at |
| [`user_role_bindings`](server/auth.js:152) | Optional compatibility role lookup | user_id, role, store_id are read by current auth helper; table creation is not confirmed in current non-archive SQL |
| [`trial_requests`](plans/sql_auth_trial_compat_repair.sql:264) | Public trial-request lifecycle and email status | id, full_name, company_name, job_title, email, request_status, requested_role, supabase_user_id, trial_expires_at, resend_provider, resend_message_id, error_code, error_message, request_ip, user_agent, created_at, updated_at |
| [`auth_audit_logs`](plans/sql_auth_trial_compat_repair.sql:341) | Admin/trial/auth audit trail | id, actor_user_id, target_user_id, action, entity_type, entity_id, result, metadata, created_at |

## Product and inventory model

- CSV import normalizes each row in [`api/bulk-products.js`](api/bulk-products.js:10), decodes EPC data, then upserts product records using the unique product key epc_company_prefix plus item_reference in [`api/bulk-products.js`](api/bulk-products.js:416).
- Product translations are upserted by product_id plus locale in [`api/bulk-products.js`](api/bulk-products.js:450).
- Inventory rows are item-level records keyed by epc_data and upserted in [`api/bulk-products.js`](api/bulk-products.js:482). This is the table the fitting catalog uses to calculate available quantity in [`api/fitting-catalog.js`](api/fitting-catalog.js:89).
- Frontend dashboard reads products, translations, inventory, events, presence, and sessions directly through the Supabase client in [`public/js/main.js`](public/js/main.js:5276).

Important constraints and indexes confirmed in SQL:

- Product uniqueness: epc_company_prefix plus item_reference in [`plans/sql_bootstrap_products_and_style_item.sql`](plans/sql_bootstrap_products_and_style_item.sql:36).
- Product translation uniqueness: product_id plus locale in [`plans/sql_bootstrap_products_and_style_item.sql`](plans/sql_bootstrap_products_and_style_item.sql:57).
- Inventory uniqueness: epc_data in [`plans/sql_bootstrap_products_and_style_item.sql`](plans/sql_bootstrap_products_and_style_item.sql:74).

## RFID event and fitting-room model

- Incoming webhook events are handled by [`api/rfid-webhook.js`](api/rfid-webhook.js:406).
- The webhook decodes SGTIN-96 EPC values through [`server/sgtin96.js`](server/sgtin96.js:1).
- Debounce behavior checks for duplicate epc_data and reader_id within three seconds in [`api/rfid-webhook.js`](api/rfid-webhook.js:462).
- Rich event insertion targets [`rfid_events`](plans/sql_bootstrap_products_and_style_item.sql:88) with event_type, event_source, from_zone, to_zone, and metadata in [`api/rfid-webhook.js`](api/rfid-webhook.js:536).
- Legacy fallback insertion only writes epc_data, reader_id, state, and timestamp when extended event columns are missing in [`api/rfid-webhook.js`](api/rfid-webhook.js:151). The bootstrap SQL does not confirm a state column, so live schema support for state is Unknown / Not confirmed from code.
- Realtime frontend updates subscribe to inserts on [`rfid_events`](plans/sql_bootstrap_products_and_style_item.sql:88) in [`public/js/main.js`](public/js/main.js:5526).

Observed event_type values from code include enter_fitting_room, left_fitting_room, move_to_checkout, sale_completed, return_to_sales_floor, tag_seen, and inventory_status_updated, based on [`api/rfid-webhook.js`](api/rfid-webhook.js:26) and [`api/rfid-webhook.js`](api/rfid-webhook.js:107).

Observed inventory status values from code include ACTIVE, FITTING_ROOM, CHECKOUT, and SOLD, based on [`api/rfid-webhook.js`](api/rfid-webhook.js:63).

## Auth/trial tables

- [`user_profiles`](plans/sql_auth_trial_compat_repair.sql:21) is the application role/status table used by the API auth helper in [`server/auth.js`](server/auth.js:102).
- The auth helper supports both a v3-style profile id lookup and a v2-style user_id lookup in [`server/auth.js`](server/auth.js:102).
- [`user_role_bindings`](server/auth.js:152) is read as a compatibility role source. Current non-archive SQL creation for this table is Unknown / Not confirmed from code.
- [`trial_requests`](plans/sql_auth_trial_compat_repair.sql:264) records trial application lifecycle and open request statuses. Duplicate checks use pending, account_created, email_sent, and email_failed in [`api/trial-requests.js`](api/trial-requests.js:4).
- [`auth_audit_logs`](plans/sql_auth_trial_compat_repair.sql:341) records auth and account actions from trial creation, admin creation, update, delete, and resend flows.

## Row-level security and access pattern

- SQL baseline enables RLS for [`user_profiles`](plans/sql_auth_trial_step1_auth_and_rls.sql:187), [`trial_requests`](plans/sql_auth_trial_step1_auth_and_rls.sql:209), and [`auth_audit_logs`](plans/sql_auth_trial_step1_auth_and_rls.sql:210).
- SQL baseline also enables select policies for active authenticated users on product, inventory, event, presence, and session tables in [`plans/sql_auth_trial_step1_auth_and_rls.sql`](plans/sql_auth_trial_step1_auth_and_rls.sql:228).
- Frontend reads are expected to use an authenticated Supabase access token injected into the Supabase client by [`public/js/services/supabase-service.js`](public/js/services/supabase-service.js:9).
- Server writes use the Supabase service-role client from [`server/supabase.js`](server/supabase.js:13) or direct service-role clients in API files such as [`api/bulk-products.js`](api/bulk-products.js:5).
- Whether the live Supabase project has these RLS policies applied is Unknown / Not confirmed from code.

## Known compatibility risks

- [`api/rfid-webhook.js`](api/rfid-webhook.js:211) writes epc_company_prefix and item_reference to [`fitting_room_presence`](plans/sql_bootstrap_products_and_style_item.sql:104), but the bootstrap SQL only defines product_key, entered_at, last_seen_at, and last_reader_id. Whether live schema includes those extra columns is Unknown / Not confirmed from code.
- [`api/rfid-webhook.js`](api/rfid-webhook.js:340) writes product_key, epc_company_prefix, item_reference, sku, left_at, duration_seconds, and sale_time related data to [`fitting_room_sessions`](plans/sql_bootstrap_products_and_style_item.sql:113), but the bootstrap SQL defines a smaller shape. Some callers swallow missing session-column errors, but not all analytics will work without the extended columns.
- [`server/services/dashboard-metrics.js`](server/services/dashboard-metrics.js:501) and [`public/js/main.js`](public/js/main.js:5276) contain fallback select clauses for older schemas. Preserve these fallbacks unless the database is migrated and verified.
- The dashboard service reads display_name, price_usd, and sku_ean13 as compatibility columns in [`server/services/dashboard-metrics.js`](server/services/dashboard-metrics.js:501), but these columns are not created by [`plans/sql_bootstrap_products_and_style_item.sql`](plans/sql_bootstrap_products_and_style_item.sql:19).
- Do not add a restrictive event_source constraint unless it includes all event_source values written by current code, including simulator and rfid_webhook from [`api/rfid-webhook.js`](api/rfid-webhook.js:49) and [`api/rfid-webhook.js`](api/rfid-webhook.js:113).

## Existing SQL and schema documentation found

- Current bootstrap SQL: [`plans/sql_bootstrap_products_and_style_item.sql`](plans/sql_bootstrap_products_and_style_item.sql:1).
- Auth/trial SQL baseline: [`plans/sql_auth_trial_step1_auth_and_rls.sql`](plans/sql_auth_trial_step1_auth_and_rls.sql:1).
- Auth/trial compatibility repair SQL: [`plans/sql_auth_trial_compat_repair.sql`](plans/sql_auth_trial_compat_repair.sql:1).
- Inventory RLS helper SQL: [`plans/sql_fix_inventory_items_rls_minimal.sql`](plans/sql_fix_inventory_items_rls_minimal.sql:1).
- Rich demo seed SQL: [`plans/sql_seed_rich_demo_data.sql`](plans/sql_seed_rich_demo_data.sql:1).
- Event-table clear SQL: [`plans/sql_clear_event_tables.sql`](plans/sql_clear_event_tables.sql:1).
- Auth/trial API and SQL spec: [`plans/auth_trial_sql_api_spec.md`](plans/auth_trial_sql_api_spec.md:1).
- V3 schema design spec: [`規格書 3.0/DB schema 3.0.md`](規格書 3.0/DB schema 3.0.md:1). Treat as design/spec unless current SQL or code confirms implementation.
- Archived v2 schema references exist under [`plans/archive_v2/`](plans/archive_v2) and [`archive_v2_code/`](archive_v2_code), but they are not current runtime sources.

## Unknown / Not confirmed from code

- Exact live Supabase table definitions, constraints, indexes, grants, and RLS policies.
- Whether [`user_role_bindings`](server/auth.js:152) exists in the deployed database.
- Whether current live [`fitting_room_presence`](plans/sql_bootstrap_products_and_style_item.sql:104) and [`fitting_room_sessions`](plans/sql_bootstrap_products_and_style_item.sql:113) include all extended columns expected by [`api/rfid-webhook.js`](api/rfid-webhook.js:211).
- Whether schema docs under [`規格書 3.0/`](規格書 3.0) have been migrated to production.
