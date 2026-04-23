import { getSupabaseAdminClient, normalizeBody, toIsoDate, toTrialExpiresAtIso } from './_supabase.js';
import { sendInviteEmail } from './_mailer.js';

const OPEN_REQUEST_STATUSES = ['pending', 'account_created', 'email_sent', 'email_failed'];
const TRIAL_REQUEST_RATE_LIMIT_MAX = 5;
const TRIAL_REQUEST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const memoryRateLimit = new Map();

function jsonError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message
    }
  });
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').trim();
  if (forwarded) return forwarded.split(',')[0].trim();
  return String(req.socket?.remoteAddress || '').trim() || null;
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

  if (fullName.length < 1 || fullName.length > 80) {
    return { ok: false, message: 'full_name length must be between 1 and 80' };
  }
  if (companyName.length < 1 || companyName.length > 120) {
    return { ok: false, message: 'company_name length must be between 1 and 120' };
  }
  if (jobTitle.length < 1 || jobTitle.length > 120) {
    return { ok: false, message: 'job_title length must be between 1 and 120' };
  }
  if (!validateEmail(email)) {
    return { ok: false, message: 'email is invalid' };
  }

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

function rateLimitKey(req, email) {
  const ip = getClientIp(req) || 'unknown';
  return `${ip}::${String(email || '').toLowerCase()}`;
}

function checkRateLimit(req, email) {
  const key = rateLimitKey(req, email);
  const now = Date.now();
  const bucket = memoryRateLimit.get(key) || [];
  const active = bucket.filter((ts) => now - ts <= TRIAL_REQUEST_RATE_LIMIT_WINDOW_MS);
  if (active.length >= TRIAL_REQUEST_RATE_LIMIT_MAX) {
    return false;
  }
  active.push(now);
  memoryRateLimit.set(key, active);
  return true;
}

async function insertAuditLog(supabase, payload) {
  await supabase.from('auth_audit_logs').insert(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const body = normalizeBody(req.body);
  const validated = validateBody(body);
  if (!validated.ok) {
    return jsonError(res, 400, 'VALIDATION_ERROR', validated.message);
  }

  const payload = validated.value;
  if (!checkRateLimit(req, payload.email)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many trial requests, please try later');
  }

  const requestIp = getClientIp(req);
  const userAgent = String(req.headers['user-agent'] || '').trim() || null;
  const nowIso = toIsoDate();
  const trialExpiresAt = toTrialExpiresAtIso();

  const duplicateRequest = await supabase
    .from('trial_requests')
    .select('id, request_status')
    .eq('email', payload.email)
    .in('request_status', OPEN_REQUEST_STATUSES)
    .limit(1)
    .maybeSingle();

  if (!duplicateRequest.error && duplicateRequest.data?.id) {
    return jsonError(res, 409, 'DUPLICATE_REQUEST', 'A pending trial request already exists for this email');
  }

  const existingProfile = await supabase
    .from('user_profiles')
    .select('user_id, role, status, trial_expires_at')
    .eq('email', payload.email)
    .limit(1)
    .maybeSingle();

  if (!existingProfile.error && existingProfile.data) {
    const role = String(existingProfile.data.role || '').trim();
    const status = String(existingProfile.data.status || '').trim();
    const isTrialStillValid =
      role === 'trial'
      && status === 'active'
      && existingProfile.data.trial_expires_at
      && Date.parse(existingProfile.data.trial_expires_at) > Date.now();
    const isRegisteredRole = ['guest', 'user', 'admin'].includes(role);
    if (isTrialStillValid || isRegisteredRole) {
      return jsonError(res, 409, 'EMAIL_ALREADY_REGISTERED', 'This email is already registered');
    }
  }

  const createRequest = await supabase
    .from('trial_requests')
    .insert({
      full_name: payload.full_name,
      company_name: payload.company_name,
      job_title: payload.job_title,
      email: payload.email,
      request_status: 'pending',
      requested_role: 'trial',
      request_ip: requestIp,
      user_agent: userAgent,
      trial_expires_at: trialExpiresAt
    })
    .select('id')
    .single();

  if (createRequest.error || !createRequest.data?.id) {
    return jsonError(res, 500, 'TRIAL_PROVISION_FAILED', 'Failed to provision trial account');
  }

  const requestId = createRequest.data.id;

  try {
    await insertAuditLog(supabase, {
      actor_user_id: null,
      target_user_id: null,
      action: 'trial_request_created',
      entity_type: 'trial_request',
      entity_id: requestId,
      result: 'success',
      metadata: {
        email: payload.email,
        ip: requestIp,
        user_agent: userAgent
      }
    });

    const userCreate = await supabase.auth.admin.createUser({
      email: payload.email,
      email_confirm: false,
      user_metadata: {
        full_name: payload.full_name,
        company_name: payload.company_name,
        job_title: payload.job_title
      },
      app_metadata: {
        role: 'trial',
        status: 'active',
        trial_requested_at: nowIso,
        trial_expires_at: trialExpiresAt
      }
    });

    if (userCreate.error || !userCreate.data?.user?.id) {
      await supabase
        .from('trial_requests')
        .update({
          request_status: 'rejected',
          error_code: userCreate.error?.code || 'CREATE_USER_FAILED',
          error_message: userCreate.error?.message || 'createUser failed'
        })
        .eq('id', requestId);
      return jsonError(res, 500, 'TRIAL_PROVISION_FAILED', 'Failed to provision trial account');
    }

    const createdUser = userCreate.data.user;

    await supabase
      .from('trial_requests')
      .update({
        request_status: 'account_created',
        supabase_user_id: createdUser.id,
        trial_expires_at: trialExpiresAt,
        error_code: null,
        error_message: null
      })
      .eq('id', requestId);

    await supabase
      .from('user_profiles')
      .upsert({
        user_id: createdUser.id,
        email: payload.email,
        full_name: payload.full_name,
        company_name: payload.company_name,
        job_title: payload.job_title,
        role: 'trial',
        status: 'active',
        trial_requested_at: nowIso,
        trial_expires_at: trialExpiresAt
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
      await supabase
        .from('trial_requests')
        .update({
          request_status: 'email_failed',
          error_code: linkRes.error?.code || 'GENERATE_LINK_FAILED',
          error_message: linkRes.error?.message || 'Failed to generate invite link'
        })
        .eq('id', requestId);
      return jsonError(res, 500, 'TRIAL_PROVISION_FAILED', 'Failed to provision trial account');
    }

    const mailRes = await sendInviteEmail({
      to: payload.email,
      fullName: payload.full_name,
      role: 'trial',
      actionLink,
      locale: payload.locale
    });

    if (!mailRes.ok) {
      await supabase
        .from('trial_requests')
        .update({
          request_status: 'email_failed',
          resend_provider: 'resend',
          error_code: 'EMAIL_SEND_FAILED',
          error_message: mailRes.error || 'Failed to send email'
        })
        .eq('id', requestId);
      return jsonError(res, 500, 'TRIAL_PROVISION_FAILED', 'Failed to provision trial account');
    }

    await supabase
      .from('trial_requests')
      .update({
        request_status: 'email_sent',
        resend_provider: 'resend',
        resend_message_id: mailRes.messageId,
        error_code: null,
        error_message: null
      })
      .eq('id', requestId);

    await insertAuditLog(supabase, {
      actor_user_id: null,
      target_user_id: createdUser.id,
      action: 'trial_email_sent',
      entity_type: 'trial_request',
      entity_id: requestId,
      result: 'success',
      metadata: {
        email: payload.email,
        resend_message_id: mailRes.messageId,
        trial_expires_at: trialExpiresAt
      }
    });

    return res.status(201).json({
      ok: true,
      request_id: requestId,
      status: 'email_sent',
      message: 'Trial account created. Please check your email to set password.'
    });
  } catch (error) {
    await supabase
      .from('trial_requests')
      .update({
        request_status: 'email_failed',
        error_code: error?.code || 'TRIAL_PROVISION_FAILED',
        error_message: error?.message || 'Unexpected error'
      })
      .eq('id', requestId);

    return jsonError(res, 500, 'TRIAL_PROVISION_FAILED', 'Failed to provision trial account');
  }
}

