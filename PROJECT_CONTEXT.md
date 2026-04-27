# [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)

## Project Overview

- Project name: [`rfid-fitting-room`](package.json:2), with repository metadata pointing to an RFID fitting room proof-of-concept project in [`package.json`](package.json:12).
- Main purpose: RFID fitting-room retail intelligence demo that tracks product movement from rack to fitting room, checkout, and sold states, matching the workflow in [`RFID fitting room PoC.md`](RFID fitting room PoC.md:11) and the login value proposition in [`public/login.html`](public/login.html:12).
- Current development stage: PoC/demo with active auth, trial-account, product import, dashboard, and fitting-demo flows. Production readiness is Unknown / Not confirmed from code.
- Main user type: retail/store users who need RFID fitting-room, conversion, and replenishment visibility. Confirmed roles are guest, trial, user, admin, and service backend in [`server/auth.js`](server/auth.js:3).

## Tech Stack

Confirmed from project files:

- Frontend: static HTML, CSS, and vanilla JavaScript in [`public/index.html`](public/index.html:1), [`public/css/style.css`](public/css/style.css:1), and [`public/js/main.js`](public/js/main.js:1).
- Frontend routing/app shell: Vercel rewrites to the single app entry in [`vercel.json`](vercel.json:3), plus browser-side route handling in [`public/js/router.js`](public/js/router.js:1).
- Backend/API: Vercel serverless functions under [`api/`](api), with shared server code under [`server/`](server).
- Hosting/deployment: Vercel, confirmed by [`vercel.json`](vercel.json:1) and the dependency in [`package.json`](package.json:23).
- Database: Supabase PostgreSQL/PostgREST via [`@supabase/supabase-js`](package.json:22), with server admin client in [`server/supabase.js`](server/supabase.js:13).
- Auth: Supabase Auth password and recovery flows in [`public/login.html`](public/login.html:92), [`public/reset-password.html`](public/reset-password.html:65), and [`server/auth.js`](server/auth.js:132).
- Realtime: Supabase Realtime subscription to RFID event inserts in [`public/js/main.js`](public/js/main.js:5526).
- Email delivery: Resend HTTP API used by [`server/mailer.js`](server/mailer.js:63).
- Storage: static image files are served from [`public/images/products/82210101.png`](public/images/products/82210101.png) and related folders. Supabase Storage usage is Unknown / Not confirmed from code.

## Folder Structure

- [`api/`](api): Vercel serverless entrypoints. Important files include [`api/bulk-products.js`](api/bulk-products.js:1), [`api/rfid-webhook.js`](api/rfid-webhook.js:1), [`api/fitting-catalog.js`](api/fitting-catalog.js:1), [`api/trial-requests.js`](api/trial-requests.js:1), [`api/auth/[...route].js`](api/auth/[...route].js:1), [`api/admin/[...route].js`](api/admin/[...route].js:1), and [`api/dashboard/[...route].js`](api/dashboard/[...route].js:1).
- [`server/`](server): Shared server helpers, routers, and handlers. Important files include [`server/auth.js`](server/auth.js:1), [`server/supabase.js`](server/supabase.js:1), [`server/mailer.js`](server/mailer.js:1), [`server/routers/admin-router.js`](server/routers/admin-router.js:1), [`server/routers/auth-router.js`](server/routers/auth-router.js:1), and [`server/services/dashboard-metrics.js`](server/services/dashboard-metrics.js:1).
- [`public/`](public): Static frontend. Important pages include [`public/index.html`](public/index.html:1), [`public/login.html`](public/login.html:1), [`public/forgot-password.html`](public/forgot-password.html:1), [`public/auth-callback.html`](public/auth-callback.html:1), [`public/reset-password.html`](public/reset-password.html:1), and [`public/trial-request.html`](public/trial-request.html:1).
- [`public/js/main.js`](public/js/main.js:1): Main authenticated app, dashboard, CSV import, product views, admin account management UI, Supabase connection, and RFID simulation.
- [`public/js/fitting-demo.js`](public/js/fitting-demo.js:1): Fitting-room demo UI and catalog loading.
- [`public/js/auth-page-utils.js`](public/js/auth-page-utils.js:1): Shared auth-page i18n, Supabase auth client creation, and login-session storage helpers.
- [`plans/`](plans): SQL scripts, implementation plans, and operational notes. Important current SQL sources include [`plans/sql_bootstrap_products_and_style_item.sql`](plans/sql_bootstrap_products_and_style_item.sql:1), [`plans/sql_auth_trial_step1_auth_and_rls.sql`](plans/sql_auth_trial_step1_auth_and_rls.sql:1), and [`plans/sql_auth_trial_compat_repair.sql`](plans/sql_auth_trial_compat_repair.sql:1).
- [`規格書 3.0/`](規格書 3.0): Product and schema specifications. Treat these as design documents unless current code or SQL also confirms implementation.
- [`archive_v2_code/`](archive_v2_code): Archived code. Do not treat it as current runtime code unless explicitly restoring or comparing historical behavior.

## Important Runtime Flows

- Login flow: [`public/login.html`](public/login.html:92) signs in with Supabase Auth, then calls [`/api/auth/me`](api/auth/[...route].js:1) through [`server/handlers/auth/me.js`](server/handlers/auth/me.js:3) to load profile and permissions.
- Authenticated app flow: [`public/js/main.js`](public/js/main.js:1293) reads a local session and hides/shows UI entries based on server-provided permissions in [`public/js/main.js`](public/js/main.js:1872).
- CSV import flow: [`public/js/main.js`](public/js/main.js:5595) posts product rows to [`api/bulk-products.js`](api/bulk-products.js:252), which upserts product, translation, and inventory records.
- RFID event flow: [`public/js/main.js`](public/js/main.js:5652) posts simulated events to [`api/rfid-webhook.js`](api/rfid-webhook.js:406), which decodes EPC, writes events, updates presence/session state, and syncs inventory status.
- Fitting demo catalog flow: [`public/js/fitting-demo.js`](public/js/fitting-demo.js:443) loads rack data from [`api/fitting-catalog.js`](api/fitting-catalog.js:68).
- Dashboard data flow: the main app reads Supabase tables directly from the browser using an authenticated Supabase client in [`public/js/main.js`](public/js/main.js:5276), while server dashboard endpoints use [`server/services/dashboard-metrics.js`](server/services/dashboard-metrics.js:483).
- Trial request flow: [`public/trial-request.html`](public/trial-request.html:148) calls [`api/trial-requests.js`](api/trial-requests.js:150), which creates Supabase users, profiles, trial request records, and invite email records.

## Environment Variables Used

- [`SUPABASE_URL`](server/supabase.js:16): server-side Supabase target URL.
- [`SUPABASE_SERVICE_ROLE_KEY`](server/supabase.js:17): server-side admin/service key. Must never be exposed to frontend static files.
- [`SUPABASE_ANON_KEY`](server/handlers/auth/forgot-password.js:34): anon/publishable key used by password reset helper when configured.
- [`NEXT_PUBLIC_SUPABASE_ANON_KEY`](server/handlers/auth/forgot-password.js:35): fallback anon/publishable key name accepted by password reset helper.
- [`APP_BASE_URL`](server/handlers/auth/forgot-password.js:38): redirect base URL for auth recovery and invite flows.
- [`RESEND_API_KEY`](server/mailer.js:43): Resend API key for invite emails.
- [`RESEND_FROM_EMAIL`](server/mailer.js:44): sender address for Resend emails.
- [`TRIAL_ACCOUNT_DAYS`](server/supabase.js:32): trial-account duration, defaulting to 14 days.
- [`API_AUTH_ENABLED`](server/auth.js:36): auth gate flag; empty means enabled.
- [`API_SHARED_TOKEN`](server/auth.js:194): service-backend token accepted through the API token header path.
- [`DEBUG_AUTH_REDIRECTS`](server/handlers/auth/forgot-password.js:47): optional password-reset redirect diagnostics.
- [`LOGIN_FALLBACK_ENABLED`](api/login.js:11): legacy login endpoint toggle. The legacy endpoint is deprecated in [`api/login.js`](api/login.js:15).
- [`SUPABASE_JWT_SECRET`](README.md:7): documented in [`README.md`](README.md:7), but current login code no longer confirms active usage.

## Rules Future Agents Must Not Break

- Do not put [`SUPABASE_SERVICE_ROLE_KEY`](server/supabase.js:17) in any frontend file under [`public/`](public).
- Do not trust role information from browser input. Protected APIs resolve roles from Bearer token, profile tables, and service-token fallback in [`server/auth.js`](server/auth.js:223).
- Keep [`API_AUTH_ENABLED`](server/auth.js:36) enabled unless intentionally running an unsafe local/debug mode; empty string means enabled.
- Keep CSV import restricted to user/admin/service-backend roles as enforced by [`server/auth.js`](server/auth.js:4) and [`api/bulk-products.js`](api/bulk-products.js:257).
- Keep admin account management behind admin authorization through [`server/routers/admin-router.js`](server/routers/admin-router.js:26) and [`server/handlers/admin/users-collection.js`](server/handlers/admin/users-collection.js:98).
- Maintain schema compatibility fallbacks unless the live Supabase schema is migrated and verified. The code has explicit fallback paths for old event/product schemas in [`api/rfid-webhook.js`](api/rfid-webhook.js:151), [`public/js/main.js`](public/js/main.js:5287), and [`api/fitting-catalog.js`](api/fitting-catalog.js:9).
- Do not assume [`規格書 3.0/DB schema 3.0.md`](規格書 3.0/DB schema 3.0.md:1) is fully implemented. Confirm against current code and SQL before changing queries or migrations.

## Unknown / Not confirmed from code

- Whether the deployed Supabase database exactly matches the SQL in [`plans/sql_bootstrap_products_and_style_item.sql`](plans/sql_bootstrap_products_and_style_item.sql:1) or the compatibility SQL in [`plans/sql_auth_trial_compat_repair.sql`](plans/sql_auth_trial_compat_repair.sql:1).
- Whether Supabase RLS policies in [`plans/sql_auth_trial_step1_auth_and_rls.sql`](plans/sql_auth_trial_step1_auth_and_rls.sql:186) have been applied to the live environment.
- Whether GitHub auto-deploy is currently configured outside the repository metadata.
- Whether Supabase Storage is used.
