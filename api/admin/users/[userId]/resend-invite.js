import { authorizeAdmin } from '../../../_auth.js';
import { sendInviteEmail } from '../../../_mailer.js';
import { getSupabaseAdminClient, normalizeBody } from '../../../_supabase.js';

function jsonError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message }
  });
}

function readUserId(req) {
  const raw = req?.query?.userId;
  return String(Array.isArray(raw) ? raw[0] : (raw || '')).trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.errorBody || { error: { code: 'FORBIDDEN', message: auth.error || 'Forbidden' } });
  }

  const userId = readUserId(req);
  if (!userId) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'userId is required');
  }

  const body = normalizeBody(req.body);
  const reason = String(body.reason || '').trim() || null;
  const locale = String(body.locale || 'zh-Hant').trim() || 'zh-Hant';

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const profileRes = await supabase
    .from('user_profiles')
    .select('user_id,email,full_name,role,status,trial_expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileRes.error || !profileRes.data) {
    return jsonError(res, 404, 'USER_NOT_FOUND', 'User profile not found');
  }

  const profile = profileRes.data;
  if (!['trial', 'guest'].includes(String(profile.role || '').trim())) {
    return jsonError(res, 400, 'INVALID_ROLE', 'Only trial or guest users can be resent invite');
  }

  const linkRes = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: {
      redirectTo: process.env.APP_BASE_URL
    }
  });

  const actionLink = linkRes.data?.properties?.action_link || null;
  if (linkRes.error || !actionLink) {
    return jsonError(res, 500, 'INVITE_LINK_FAILED', 'Failed to generate invite link');
  }

  const mailRes = await sendInviteEmail({
    to: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    actionLink,
    locale
  });

  if (!mailRes.ok) {
    return jsonError(res, 500, 'EMAIL_SEND_FAILED', 'Failed to send invite email');
  }

  await supabase.from('auth_audit_logs').insert({
    actor_user_id: auth.user_id,
    target_user_id: userId,
    action: 'trial_email_resent',
    entity_type: 'user',
    entity_id: userId,
    result: 'success',
    metadata: {
      reason,
      role: profile.role,
      email: profile.email,
      resend_message_id: mailRes.messageId || null
    }
  });

  return res.status(200).json({
    ok: true,
    user_id: userId,
    resent: true
  });
}

