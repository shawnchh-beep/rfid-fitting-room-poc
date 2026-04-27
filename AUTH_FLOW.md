# [`AUTH_FLOW.md`](AUTH_FLOW.md)

## Auth overview

This project uses Supabase Auth for user sign-in, password recovery, and admin-created accounts. Application authorization is enforced by Vercel serverless APIs through [`server/auth.js`](server/auth.js:1), not by trusting frontend role state.

The legacy login endpoint [`api/login.js`](api/login.js:1) is deprecated and returns LOGIN_DEPRECATED unless [`LOGIN_FALLBACK_ENABLED`](api/login.js:11) is explicitly enabled. Current login uses Supabase Auth directly from [`public/login.html`](public/login.html:92).

## Roles and account states

Confirmed roles in current code:

- guest, trial, user, and admin are application user roles in [`server/auth.js`](server/auth.js:5).
- service_backend is a service-principal role used by API token fallback in [`server/auth.js`](server/auth.js:193).

Confirmed statuses in admin handlers:

- pending_activation, active, expired, and disabled are accepted by [`server/handlers/admin/users-collection.js`](server/handlers/admin/users-collection.js:6) and [`server/handlers/admin/users-item.js`](server/handlers/admin/users-item.js:5).

Trial accounts must be active and not expired. The check is enforced in [`server/auth.js`](server/auth.js:42) and [`server/auth.js`](server/auth.js:183).

## Browser login flow

1. User opens [`public/login.html`](public/login.html:1).
2. The page creates a Supabase client using [`createAuthClient`](public/js/auth-page-utils.js:330), which reads a saved Supabase URL and anon key from local storage or falls back to defaults in [`public/js/auth-page-utils.js`](public/js/auth-page-utils.js:6).
3. The form submits email and password to Supabase Auth via signInWithPassword in [`public/login.html`](public/login.html:92).
4. On success, the page calls [`/api/auth/me`](api/auth/[...route].js:1) with Authorization Bearer access token in [`public/login.html`](public/login.html:102).
5. [`server/handlers/auth/me.js`](server/handlers/auth/me.js:3) calls [`authorizeAnySignedIn`](server/auth.js:267), then returns user, profile, and permission flags.
6. The browser stores accessToken, refreshToken, expiresAt, user, profile, and permissions through [`writeSession`](public/js/auth-page-utils.js:342).
7. The authenticated app reads the session from [`public/js/main.js`](public/js/main.js:1293). Expired sessions are cleared client-side, but server APIs still perform their own auth checks.

## Password reset flow

1. User opens [`public/forgot-password.html`](public/forgot-password.html:1) and submits email.
2. The page posts to [`/api/auth/forgot-password`](api/auth/[...route].js:1) in [`public/forgot-password.html`](public/forgot-password.html:49).
3. [`server/routers/auth-router.js`](server/routers/auth-router.js:36) dispatches to [`server/handlers/auth/forgot-password.js`](server/handlers/auth/forgot-password.js:23).
4. The handler builds redirectTo as auth-callback plus reset-password path in [`server/handlers/auth/forgot-password.js`](server/handlers/auth/forgot-password.js:38), then calls Supabase Auth resetPasswordForEmail in [`server/handlers/auth/forgot-password.js`](server/handlers/auth/forgot-password.js:70).
5. Supabase redirects to [`public/auth-callback.html`](public/auth-callback.html:1), which reads access_token and refresh_token from the URL hash and calls setSession in [`public/auth-callback.html`](public/auth-callback.html:57).
6. The user lands on [`public/reset-password.html`](public/reset-password.html:1), which updates the Supabase Auth password through updateUser in [`public/reset-password.html`](public/reset-password.html:65).

## Trial account flow

1. Visitor opens [`public/trial-request.html`](public/trial-request.html:1).
2. The form posts full name, company, job title, email, and locale to [`api/trial-requests.js`](api/trial-requests.js:150) from [`public/trial-request.html`](public/trial-request.html:148).
3. The API rate-limits by IP plus email in [`api/trial-requests.js`](api/trial-requests.js:133).
4. The API checks for open duplicate requests in [`trial_requests`](plans/sql_auth_trial_compat_repair.sql:264) in [`api/trial-requests.js`](api/trial-requests.js:200).
5. The API checks for an existing profile in [`user_profiles`](plans/sql_auth_trial_compat_repair.sql:21) in [`api/trial-requests.js`](api/trial-requests.js:238).
6. The API inserts a trial request in [`api/trial-requests.js`](api/trial-requests.js:278).
7. The API creates a Supabase Auth user through admin createUser in [`api/trial-requests.js`](api/trial-requests.js:327).
8. The API updates the trial request and upserts a trial user profile in [`api/trial-requests.js`](api/trial-requests.js:369) and [`api/trial-requests.js`](api/trial-requests.js:380).
9. The API generates a recovery link in [`api/trial-requests.js`](api/trial-requests.js:394) and sends the invite email through [`server/mailer.js`](server/mailer.js:21).
10. The invite email asks the user to set a password using the recovery link. Actual email delivery depends on [`RESEND_API_KEY`](server/mailer.js:43) and [`RESEND_FROM_EMAIL`](server/mailer.js:44).

## Admin account management flow

- Admin routes are exposed through [`api/admin/[...route].js`](api/admin/[...route].js:1) and routed by [`server/routers/admin-router.js`](server/routers/admin-router.js:26).
- User list and create operations are handled by [`server/handlers/admin/users-collection.js`](server/handlers/admin/users-collection.js:98).
- User update and delete operations are handled by [`server/handlers/admin/users-item.js`](server/handlers/admin/users-item.js:47).
- Guest creation is handled by [`server/handlers/admin/guest-users.js`](server/handlers/admin/guest-users.js:39).
- Invite resend is handled by [`server/handlers/admin/users-resend-invite.js`](server/handlers/admin/users-resend-invite.js:11).
- Admin UI calls these endpoints through [`adminApiFetch`](public/js/main.js:2179), which adds Authorization Bearer headers from the stored session.

## Server authorization helper

All protected APIs should use the helper path in [`server/auth.js`](server/auth.js:223).

Core behavior:

1. [`API_AUTH_ENABLED`](server/auth.js:36) defaults to enabled when unset.
2. If auth is disabled, the helper returns an admin-like principal in [`server/auth.js`](server/auth.js:223). This is unsafe for production.
3. If Authorization Bearer is present, the helper validates it with Supabase Auth getUser in [`server/auth.js`](server/auth.js:145).
4. The helper resolves profile by id or user_id for compatibility in [`server/auth.js`](server/auth.js:102).
5. The helper optionally maps role bindings from [`user_role_bindings`](server/auth.js:152).
6. The helper rejects unknown roles, inactive accounts, and expired trials in [`server/auth.js`](server/auth.js:179).
7. If no Bearer token is provided, the helper attempts service-token auth with [`API_SHARED_TOKEN`](server/auth.js:194).
8. Permission flags are built in [`server/auth.js`](server/auth.js:71).

## API authorization matrix

| Endpoint | Auth requirement confirmed from code |
| --- | --- |
| [`/api/auth/me`](api/auth/[...route].js:1) | Any signed-in app user through [`authorizeAnySignedIn`](server/auth.js:267) |
| [`/api/auth/forgot-password`](server/routers/auth-router.js:36) | Public POST with email; no Bearer required |
| [`/api/trial-requests`](api/trial-requests.js:150) | Public POST with rate limiting and duplicate checks |
| [`/api/fitting-catalog`](api/fitting-catalog.js:68) | Any signed-in app user through [`authorizeAnySignedIn`](server/auth.js:267) |
| [`/api/dashboard/summary`](server/routers/dashboard-router.js:24) | Any signed-in app user through dashboard handlers |
| [`/api/dashboard/opportunities`](server/routers/dashboard-router.js:29) | Any signed-in app user through dashboard handlers |
| [`/api/dashboard/actions`](server/routers/dashboard-router.js:34) | Any signed-in app user through dashboard handlers |
| [`/api/rfid-webhook`](api/rfid-webhook.js:406) | trial, user, admin, or service_backend through [`authorizeWebhook`](server/auth.js:259) |
| [`/api/bulk-products`](api/bulk-products.js:252) | user, admin, or service_backend through [`authorizeBulkProducts`](server/auth.js:263); trial is explicitly blocked in [`api/bulk-products.js`](api/bulk-products.js:262) |
| [`/api/admin/*`](api/admin/[...route].js:1) | admin only through [`authorizeAdmin`](server/auth.js:271) |
| [`/api/login`](api/login.js:1) | Deprecated legacy endpoint; not part of current login flow |

## Frontend session and permissions

- Auth-page session storage key is [`rfid_poc_login_session_v1`](public/js/auth-page-utils.js:2) and shared app storage key is also defined in [`public/js/state/storage.js`](public/js/state/storage.js:10).
- The main app validates the stored expiresAt timestamp in [`public/js/main.js`](public/js/main.js:1293).
- API fetch helpers attach Authorization Bearer from the stored access token in [`public/js/main.js`](public/js/main.js:1829).
- UI gating hides CSV import, settings, and fitting demo entries in [`public/js/main.js`](public/js/main.js:1872). This is not a security boundary; APIs enforce roles independently.
- Supabase browser queries use an access token in the client global Authorization header from [`public/js/services/supabase-service.js`](public/js/services/supabase-service.js:9).

## Environment variables for auth

- [`SUPABASE_URL`](server/supabase.js:16): required for server admin Supabase client.
- [`SUPABASE_SERVICE_ROLE_KEY`](server/supabase.js:17): required for server admin Supabase client and Supabase Auth admin operations.
- [`SUPABASE_ANON_KEY`](server/handlers/auth/forgot-password.js:34): used by forgot-password handler when configured.
- [`NEXT_PUBLIC_SUPABASE_ANON_KEY`](server/handlers/auth/forgot-password.js:35): fallback anon key name for forgot-password handler.
- [`APP_BASE_URL`](server/handlers/auth/forgot-password.js:38): redirect base URL for password reset/invite links.
- [`RESEND_API_KEY`](server/mailer.js:43): required for invite email delivery.
- [`RESEND_FROM_EMAIL`](server/mailer.js:44): required for invite sender.
- [`TRIAL_ACCOUNT_DAYS`](server/supabase.js:32): controls generated trial expiry; defaults to 14.
- [`API_AUTH_ENABLED`](server/auth.js:36): auth gate flag; unset means enabled.
- [`API_SHARED_TOKEN`](server/auth.js:194): service backend fallback token.
- [`DEBUG_AUTH_REDIRECTS`](server/handlers/auth/forgot-password.js:47): optional diagnostics for reset-link routing.

## Security rules and gotchas

- Never expose [`SUPABASE_SERVICE_ROLE_KEY`](server/supabase.js:17) to files under [`public/`](public).
- Do not rely on browser-stored profile or permissions for authorization; server-side role checks in [`server/auth.js`](server/auth.js:223) are the source of truth.
- Do not reintroduce frontend-controlled role headers. The auth/trial spec explicitly says not to trust frontend roles in [`plans/auth_trial_sql_api_spec.md`](plans/auth_trial_sql_api_spec.md:820).
- Keep trial expiry checks active in [`server/auth.js`](server/auth.js:42).
- Keep last-admin protections in admin update/delete flows in [`server/handlers/admin/users-item.js`](server/handlers/admin/users-item.js:81) and [`server/handlers/admin/users-item.js`](server/handlers/admin/users-item.js:204).
- Password recovery and invite links depend on Supabase redirect allow-list configuration outside this repository. Whether the Supabase dashboard allow-list is correctly configured is Unknown / Not confirmed from code.

## Unknown / Not confirmed from code

- Supabase project Auth settings, redirect allow-list, email templates, and SMTP/provider configuration.
- Whether all configured production environment variables are present in Vercel.
- Whether live users have both Supabase Auth records and matching [`user_profiles`](plans/sql_auth_trial_compat_repair.sql:21) rows.
- Whether [`user_role_bindings`](server/auth.js:152) exists and is populated in the deployed database.
