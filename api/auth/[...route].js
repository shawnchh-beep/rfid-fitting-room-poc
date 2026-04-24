import { routeAuthRequest } from '../../server/routers/auth-router.js';

export default async function handler(req, res) {
  return routeAuthRequest(req, res);
}

