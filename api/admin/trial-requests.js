import { authorizeAdmin } from '../_auth.js';
import { getSupabaseAdminClient } from '../_supabase.js';

const REQUEST_STATUSES = new Set([
  'pending',
  'account_created',
  'email_sent',
  'email_failed',
  'duplicate',
  'rejected'
]);

function jsonError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function parseNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.errorBody || { error: { code: 'FORBIDDEN', message: auth.error || 'Forbidden' } });
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const q = String(req.query?.q || '').trim();
  const status = String(req.query?.status || '').trim();
  const page = Math.max(1, Math.floor(parseNumber(req.query?.page, 1)));
  const pageSize = Math.min(100, Math.max(1, Math.floor(parseNumber(req.query?.pageSize, 20))));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('trial_requests')
    .select('id,full_name,company_name,job_title,email,request_status,requested_role,supabase_user_id,trial_expires_at,resend_provider,resend_message_id,error_code,error_message,created_at,updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (REQUEST_STATUSES.has(status)) {
    query = query.eq('request_status', status);
  }
  if (q) {
    const escaped = q.replaceAll(',', ' ');
    query = query.or(`email.ilike.%${escaped}%,full_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%`);
  }

  const result = await query;
  if (result.error) {
    return jsonError(res, 500, 'TRIAL_REQUESTS_QUERY_FAILED', result.error.message || 'Failed to query trial requests');
  }

  return res.status(200).json({
    ok: true,
    items: result.data || [],
    page,
    page_size: pageSize,
    total: Number(result.count || 0)
  });
}

