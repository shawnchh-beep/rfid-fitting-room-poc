const LEGACY_ROLE_MAP = new Map([
  ['demo_operator', 'user'],
  ['analyst_admin', 'admin'],
  ['viewer', 'trial']
]);

const WEBHOOK_ALLOWED_ROLES = new Set(['trial', 'user', 'admin', 'service_backend']);
const BULK_ALLOWED_ROLES = new Set(['user', 'admin', 'service_backend']);

function isAuthEnabled() {
  return String(process.env.API_AUTH_ENABLED || '').toLowerCase() === 'true';
}

function getRole(req) {
  return String(req.headers['x-user-role'] || '').trim();
}

function normalizeRole(role) {
  const normalized = String(role || '').trim();
  return LEGACY_ROLE_MAP.get(normalized) || normalized;
}

function getToken(req) {
  return String(req.headers['x-api-token'] || '').trim();
}

function checkAuth(req, allowedRoles) {
  const rawRole = getRole(req);
  const role = normalizeRole(rawRole);

  if (!isAuthEnabled()) {
    return {
      ok: true,
      role: role || 'anonymous',
      rawRole: rawRole || null,
      mode: 'disabled'
    };
  }

  const expectedToken = String(process.env.API_SHARED_TOKEN || '').trim();
  const providedToken = getToken(req);
  if (!expectedToken) {
    return { ok: false, status: 500, error: 'API_SHARED_TOKEN is required when API_AUTH_ENABLED=true' };
  }

  if (!providedToken || providedToken !== expectedToken) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  if (!allowedRoles.has(role)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, role, rawRole: rawRole || null, mode: 'enforced' };
}

export function authorizeWebhook(req) {
  return checkAuth(req, WEBHOOK_ALLOWED_ROLES);
}

export function authorizeBulkProducts(req) {
  return checkAuth(req, BULK_ALLOWED_ROLES);
}
