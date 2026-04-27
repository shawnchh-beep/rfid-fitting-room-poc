import { createClient } from '@supabase/supabase-js';

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

function resolveRequestBaseUrl(req) {
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  const host = String(req.headers?.host || '').trim();
  const proto = forwardedProto || 'https';
  const finalHost = forwardedHost || host;
  if (!finalHost) return '';
  return normalizeBaseUrl(`${proto}://${finalHost}`);
}

export async function handleAuthForgotPassword(req, res) {
  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const email = String(body.email || '').trim();

    if (!email) {
      return jsonError(res, 400, 'Email is required');
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || 'https://trgxtbqjkhydvbfndmhk.supabase.co').trim();
    const supabaseAnonKey = String(
      process.env.SUPABASE_ANON_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || 'sb_publishable_RjeQR-HU84MRCpByTqZlxg_lwJHStMP'
    ).trim();
    const envAppBaseUrl = normalizeBaseUrl(process.env.APP_BASE_URL);
    const requestBaseUrl = resolveRequestBaseUrl(req);
    const fallbackBaseUrl = normalizeBaseUrl('http://localhost:3000');
    // Prefer runtime request host to avoid stale APP_BASE_URL pointing to old domains.
    const appBaseUrl = requestBaseUrl || envAppBaseUrl || fallbackBaseUrl;
    const redirectTo = `${appBaseUrl}/auth-callback.html?next=/reset-password.html`;

    // Diagnostic logs for reset-link routing issues.
    // Controlled by DEBUG_AUTH_REDIRECTS=1 to avoid noisy production logs.
    if (String(process.env.DEBUG_AUTH_REDIRECTS || '').trim() === '1') {
      const requestHost = req.headers?.host || null;
      const requestOrigin = req.headers?.origin || null;
      const requestReferer = req.headers?.referer || null;
      const emailDomain = email.includes('@') ? email.split('@').pop() : null;
      const forwardedProto = req.headers?.['x-forwarded-proto'] || null;
      const forwardedHost = req.headers?.['x-forwarded-host'] || null;

      console.info('[auth/forgot-password] redirect diagnostics', {
        envAppBaseUrl,
        requestBaseUrl,
        appBaseUrl,
        baseUrlSource: requestBaseUrl ? 'request' : (envAppBaseUrl ? 'env' : 'fallback'),
        redirectTo,
        requestHost,
        forwardedProto,
        forwardedHost,
        requestOrigin,
        requestReferer,
        emailDomain
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      if (String(process.env.DEBUG_AUTH_REDIRECTS || '').trim() === '1') {
        console.error('[auth/forgot-password] supabase reset error', {
          message: error.message,
          status: error.status || null,
          appBaseUrl,
          redirectTo
        });
      }
      return jsonError(res, 400, error.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return jsonError(res, 500, err?.message || 'Internal server error');
  }
}
