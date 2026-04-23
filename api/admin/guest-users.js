import { authorizeAdmin } from '../_auth.js';
import { sendInviteEmail } from '../_mailer.js';
import { getSupabaseAdminClient, normalizeBody } from '../_supabase.js';

function jsonError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message }
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validateBody(body) {
  const fullName = String(body.full_name || '').trim();
  const companyName = String(body.company_name || '').trim();
  const jobTitle = String(body.job_title || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const locale = String(body.locale || 'zh-Hant').trim() || 'zh-Hant';

  if (fullName.length < 1 || fullName.length > 80) return { ok: false, message: 'full_name length must be between 1 and 80' };
  if (companyName.length < 1 || companyName.length > 120) return { ok: false, message: 'company_name length must be between 1 and 120' };
  if (jobTitle.length < 1 || jobTitle.length > 120) return { ok: false, message: 'job_title length must be between 1 and 120' };
  if (!validateEmail(email)) return { ok: false, message: 'email is invalid' };

  return {
    ok: true,
    value: {
      full_name: fullName,
      company_name: companyName,
      job_title: jobTitle,
      email,
      locale
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.errorBody || { error: { code: 'FORBIDDEN', message: auth.error || 'Forbidden' } });
  }

  const body = normalizeBody(req.body);
  const validated = validateBody(body);
  if (!validated.ok) {
    return jsonError(res, 400, 'VALIDATION_ERROR', validated.message);
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const payload = validated.value;

  const existingProfile = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('email', payload.email)
    .limit(1)
    .maybeSingle();

  if (!existingProfile.error && existingProfile.data?.user_id) {
    return jsonError(res, 409, 'EMAIL_ALREADY_REGISTERED', 'This email is already registered');
  }

  const userCreate = await supabase.auth.admin.createUser({
    email: payload.email,
    email_confirm: false,
    user_metadata: {
      full_name: payload.full_name,
      company_name: payload.company_name,
      job_title: payload.job_title
    },
    app_metadata: {
      role: 'guest',
      status: 'active',
      trial_requested_at: null,
      trial_expires_at: null
    }
  });

  if (userCreate.error || !userCreate.data?.user?.id) {
    return jsonError(res, 500, 'GUEST_CREATE_FAILED', 'Failed to create guest account');
  }

  const createdUser = userCreate.data.user;

  await supabase
    .from('user_profiles')
    .upsert({
      user_id: createdUser.id,
      email: payload.email,
      full_name: payload.full_name,
      company_name: payload.company_name,
      job_title: payload.job_title,
      role: 'guest',
      status: 'active',
      trial_requested_at: null,
      trial_expires_at: null,
      invited_by: auth.user_id || null
    }, { onConflict: 'user_id' });

  const linkRes = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: payload.email,
    options: {
      redirectTo: process.env.APP_BASE_URL
    }
  });

  const actionLink = linkRes.data?.properties?.action_link || null;
  if (linkRes.error || !actionLink) {
    return jsonError(res, 500, 'INVITE_LINK_FAILED', 'Failed to generate invite link');
  }

  const mailRes = await sendInviteEmail({
    to: payload.email,
    fullName: payload.full_name,
    role: 'guest',
    actionLink,
    locale: payload.locale
  });

  if (!mailRes.ok) {
    return jsonError(res, 500, 'EMAIL_SEND_FAILED', 'Failed to send invite email');
  }

  await supabase.from('auth_audit_logs').insert({
    actor_user_id: auth.user_id,
    target_user_id: createdUser.id,
    action: 'guest_user_created',
    entity_type: 'user',
    entity_id: createdUser.id,
    result: 'success',
    metadata: {
      role: 'guest',
      email: payload.email,
      resend_message_id: mailRes.messageId || null
    }
  });

  return res.status(201).json({
    ok: true,
    user_id: createdUser.id,
    role: 'guest',
    status: 'email_sent'
  });
}

