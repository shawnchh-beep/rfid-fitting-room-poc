import { createHmac, randomUUID } from 'node:crypto';

const SESSION_TTL_MS = 30 * 60 * 1000;
const SUPABASE_JWT_TTL_SECONDS = 30 * 60;

const TEST_USERS = new Map([
  ['admin', { password: 'admin', role: 'admin' }],
  ['user', { password: 'user', role: 'user' }],
  ['test', { password: 'test', role: 'trial' }]
]);

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHs256(unsignedToken, secret) {
  return base64UrlEncode(
    createHmac('sha256', secret).update(unsignedToken).digest()
  );
}

function createSupabaseCustomJwt({ username, appRole, secret }) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'authenticated',
    sub: `user:${username}`,
    role: 'authenticated',
    app_role: appRole,
    iat: nowSeconds,
    exp: nowSeconds + SUPABASE_JWT_TTL_SECONDS
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = signHs256(unsigned, secret);
  return {
    token: `${unsigned}.${signature}`,
    exp: payload.exp
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = normalizeBody(req.body);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = TEST_USERS.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const jwtSecret = String(process.env.SUPABASE_JWT_SECRET || '').trim();
  if (!jwtSecret) {
    return res.status(500).json({ error: 'SUPABASE_JWT_SECRET is required' });
  }

  const { token: supabaseAccessToken, exp: supabaseExp } = createSupabaseCustomJwt({
    username,
    appRole: user.role,
    secret: jwtSecret
  });

  return res.status(200).json({
    ok: true,
    session: {
      token: randomUUID(),
      username,
      role: user.role,
      expiresAt,
      supabaseAccessToken,
      supabaseTokenExpiresAt: new Date(supabaseExp * 1000).toISOString()
    },
    supabase_access_token: supabaseAccessToken,
    supabase_token_expires_at: new Date(supabaseExp * 1000).toISOString()
  });
}
