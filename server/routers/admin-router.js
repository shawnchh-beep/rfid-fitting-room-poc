import { handleAdminGuestUsers } from '../handlers/admin/guest-users.js';
import { handleAdminTrialRequests } from '../handlers/admin/trial-requests.js';
import { handleAdminUsersList, handleAdminUsersCreate } from '../handlers/admin/users-collection.js';
import { handleAdminUserPatch, handleAdminUserDelete } from '../handlers/admin/users-item.js';
import { handleAdminUsersResendInvite } from '../handlers/admin/users-resend-invite.js';

function jsonError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message }
  });
}

function firstSegment(value) {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function toSegments(routeParam) {
  if (Array.isArray(routeParam)) {
    return routeParam.map((part) => String(part || '').trim()).filter(Boolean);
  }
  const single = String(routeParam || '').trim();
  return single ? [single] : [];
}

export async function routeAdminRequest(req, res) {
  const method = String(req.method || '').toUpperCase();
  const segments = toSegments(req.query?.['...route'] ?? req.query?.route);
  const [head, second, third] = segments;

  console.log('[admin-router] routeAdminRequest', {
    method,
    url: req?.url || '',
    routeParam: req?.query?.['...route'] ?? req?.query?.route ?? null,
    segments,
    segmentCount: segments.length
  });

  if (head === 'trial-requests' && segments.length === 1) {
    console.log('[admin-router] matched trial-requests list');
    if (method !== 'GET') return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    return handleAdminTrialRequests(req, res);
  }

  if (head === 'guest-users' && segments.length === 1) {
    console.log('[admin-router] matched guest-users create');
    if (method !== 'POST') return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    return handleAdminGuestUsers(req, res);
  }

  if (head === 'users' && segments.length === 1) {
    console.log('[admin-router] matched users collection');
    if (method === 'GET') return handleAdminUsersList(req, res);
    if (method === 'POST') return handleAdminUsersCreate(req, res);
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  if (head === 'users' && second && !third && segments.length === 2) {
    const userId = firstSegment(second);
    console.log('[admin-router] matched users item', { userId });
    if (!userId) return jsonError(res, 400, 'VALIDATION_ERROR', 'userId is required');
    if (method === 'PATCH') return handleAdminUserPatch(req, res, userId);
    if (method === 'DELETE') return handleAdminUserDelete(req, res, userId);
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  if (head === 'users' && second && third === 'resend-invite' && segments.length === 3) {
    const userId = firstSegment(second);
    console.log('[admin-router] matched users resend-invite', { userId });
    if (!userId) return jsonError(res, 400, 'VALIDATION_ERROR', 'userId is required');
    if (method !== 'POST') return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    return handleAdminUsersResendInvite(req, res, userId);
  }

  console.warn('[admin-router] no route matched', {
    method,
    url: req?.url || '',
    segments
  });
  return jsonError(res, 404, 'NOT_FOUND', 'Not Found');
}
