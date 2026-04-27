import { handleDashboardSummary } from '../handlers/dashboard/summary.js';
import { handleDashboardOpportunities } from '../handlers/dashboard/opportunities.js';
import { handleDashboardActions } from '../handlers/dashboard/actions.js';

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

export async function routeDashboardRequest(req, res) {
  const method = String(req.method || '').toUpperCase();
  const segments = toSegments(req.query?.['...route'] ?? req.query?.route);
  const [head] = segments;

  if (head === 'summary' && segments.length === 1) {
    if (method !== 'GET') return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    return handleDashboardSummary(req, res);
  }

  if (head === 'opportunities' && segments.length === 1) {
    if (method !== 'GET') return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    return handleDashboardOpportunities(req, res);
  }

  if (head === 'actions' && segments.length === 1) {
    if (method !== 'GET') return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
    return handleDashboardActions(req, res);
  }

  return jsonError(res, 404, 'NOT_FOUND', 'Not Found');
}

