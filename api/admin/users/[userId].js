import { handleAdminUserPatch, handleAdminUserDelete } from '../../../server/handlers/admin/users-item.js';

function firstSegment(value) {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function jsonError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message }
  });
}

export default async function handler(req, res) {
  const method = String(req.method || '').toUpperCase();
  const userId = firstSegment(req.query?.userId);

  console.log('[api/admin/users/[userId]] incoming request', {
    method,
    url: req?.url || '',
    userId,
    queryKeys: Object.keys(req?.query || {})
  });

  if (!userId) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'userId is required');
  }

  if (method === 'PATCH') {
    return handleAdminUserPatch(req, res, userId);
  }

  if (method === 'DELETE') {
    return handleAdminUserDelete(req, res, userId);
  }

  return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
}
