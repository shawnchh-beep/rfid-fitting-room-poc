import { routeDashboardRequest } from '../../server/routers/dashboard-router.js';

function normalizeRouteParam(routeParam) {
  if (Array.isArray(routeParam)) {
    return routeParam.map((part) => String(part || '').trim()).filter(Boolean);
  }
  const single = String(routeParam || '').trim();
  return single ? [single] : [];
}

export default async function handler(req, res) {
  console.info('[api/dashboard] incoming request', {
    method: String(req?.method || '').toUpperCase(),
    url: req?.url || null,
    route: normalizeRouteParam(req?.query?.['...route'] ?? req?.query?.route),
    queryKeys: Object.keys(req?.query || {})
  });

  return routeDashboardRequest(req, res);
}

