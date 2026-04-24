import { routeAdminRequest } from '../../server/routers/admin-router.js';

export default async function handler(req, res) {
  return routeAdminRequest(req, res);
}

