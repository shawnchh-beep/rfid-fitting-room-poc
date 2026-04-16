# rfid-fitting-room-poc

## Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET` (required for custom login JWT in [`/api/login`](api/login.js:23))

### Local Development

Set the variables in your local env file (e.g. `.env.local`), then restart local server.

### Vercel

Add the same variables in Vercel Project Settings → Environment Variables, then redeploy.
