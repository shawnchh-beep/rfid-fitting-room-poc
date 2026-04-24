import { handleAuthMe } from '../handlers/auth/me.js';
import { handleAuthForgotPassword } from '../handlers/auth/forgot-password.js';

function jsonError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message }
  });
}

function toSegments(routeParam) {
  if (Array.isArray(routeParam)) {
    return routeParam.map((part) => String(part || '').trim()).filter(Boolean);
  }
  const single = String(routeParam || '').trim();
  return single ? [single] : [];
}

export async function routeAuthRequest(req, res) {
  const method = String(req.method || '').toUpperCase();
  const segments = toSegments(req.query?.route);
  const [head] = segments;

  if (head === 'me' && segments.length === 1) {
    if (method !== 'GET') return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    return handleAuthMe(req, res);
  }

  if (head === 'forgot-password' && segments.length === 1) {
    if (method !== 'POST') return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    return handleAuthForgotPassword(req, res);
  }

  return jsonError(res, 404, 'NOT_FOUND', 'Not Found');
}

