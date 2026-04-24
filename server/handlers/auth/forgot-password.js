import { createClient } from '@supabase/supabase-js';

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
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
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appBaseUrl}/auth-callback.html?next=/reset-password.html`
    });

    if (error) {
      return jsonError(res, 400, error.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return jsonError(res, 500, err?.message || 'Internal server error');
  }
}

