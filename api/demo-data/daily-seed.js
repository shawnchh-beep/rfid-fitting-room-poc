import { authorizeAdmin } from '../../server/auth.js';
import { normalizeBody } from '../../server/supabase.js';
import { seedDailyDemoData } from '../../server/services/demo-data-seeder.js';

function jsonError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function isCronAuthorized(req) {
  const auth = String(req?.headers?.authorization || '').trim();
  const expected = String(process.env.CRON_SECRET || '').trim();
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

export default async function handler(req, res) {
  const method = String(req.method || '').toUpperCase();
  if (!['GET', 'POST'].includes(method)) {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  const cronAuthorized = isCronAuthorized(req);
  let actorUserId = null;
  let triggerSource = cronAuthorized ? 'cron' : 'admin_manual';

  if (!cronAuthorized) {
    const auth = await authorizeAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json(auth.errorBody || { error: { code: 'FORBIDDEN', message: auth.error || 'Forbidden' } });
    }
    actorUserId = auth.user_id || null;
  }

  try {
    const payload = method === 'POST' ? normalizeBody(req.body) : req.query;
    const force = String(payload?.force || '').trim().toLowerCase() === 'true';
    const targetDate = String(payload?.target_date || '').trim() || null;
    const timezone = String(payload?.timezone || 'Asia/Shanghai').trim() || 'Asia/Shanghai';

    const result = await seedDailyDemoData({
      targetDate,
      timezone,
      force,
      triggerSource,
      actorUserId
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return jsonError(res, 500, 'DEMO_SEED_FAILED', error?.message || 'Failed to seed daily demo data');
  }
}

