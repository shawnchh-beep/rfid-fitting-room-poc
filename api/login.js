import { randomUUID } from 'node:crypto';

const SESSION_TTL_MS = 30 * 60 * 1000;

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

  return res.status(200).json({
    ok: true,
    session: {
      token: randomUUID(),
      username,
      role: user.role,
      expiresAt
    }
  });
}

