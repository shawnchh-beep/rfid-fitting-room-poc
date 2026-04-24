import { routeAdminRequest } from '../../server/routers/admin-router.js';

export default async function handler(req, res) {
  console.log('[api/admin/[...route]] incoming request', {
    method: String(req?.method || '').toUpperCase(),
    url: req?.url || '',
    routeParam: req?.query?.['...route'] ?? req?.query?.route ?? null,
    queryKeys: Object.keys(req?.query || {})
  });
  return routeAdminRequest(req, res);
}
