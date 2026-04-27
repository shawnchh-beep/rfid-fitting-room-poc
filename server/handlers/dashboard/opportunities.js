import { authorizeAnySignedIn } from '../../auth.js';
import { getSupabaseAdminClient } from '../../supabase.js';
import { buildDashboardData } from '../../services/dashboard-metrics.js';

function jsonError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export async function handleDashboardOpportunities(req, res) {
  const auth = await authorizeAnySignedIn(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.errorBody || { error: { code: 'UNAUTHORIZED', message: auth.error || 'Unauthorized' } });
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const built = await buildDashboardData({ supabase, query: req.query || {} });
  if (!built.ok) {
    return jsonError(res, built.status || 500, built.error?.code || 'INTERNAL_ERROR', built.error?.message || 'Internal Server Error');
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    items: built.opportunities
  });
}

