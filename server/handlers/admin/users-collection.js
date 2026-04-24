import { authorizeAdmin } from '../../auth.js';
import { sendInviteEmail } from '../../mailer.js';
import { getSupabaseAdminClient, normalizeBody, toTrialExpiresAtIso } from '../../supabase.js';

const ROLES = new Set(['guest', 'trial', 'user', 'admin']);
const STATUSES = new Set(['pending_activation', 'active', 'expired', 'disabled']);

function jsonError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function parseNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function sanitizeRole(value) {
  const role = String(value || '').trim();
  return ROLES.has(role) ? role : '';
}

function sanitizeStatus(value) {
  const status = String(value || '').trim();
  return STATUSES.has(status) ? status : '';
}

function toIsoOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

async function countActiveAdmins(supabase) {
  const result = await supabase
    .from('user_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('status', 'active');
  return Number(result.count || 0);
}

function normalizeProfile(row = {}) {
  return {
    user_id: row.user_id || null,
    email: row.email || null,
    full_name: row.full_name || null,
    company_name: row.company_name || null,
    job_title: row.job_title || null,
    role: row.role || null,
    status: row.status || null,
    trial_expires_at: row.trial_expires_at || null,
    last_login_at: row.last_login_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function validateCreateBody(body) {
  const fullName = String(body.full_name || '').trim();
  const companyName = String(body.company_name || '').trim();
  const jobTitle = String(body.job_title || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const locale = String(body.locale || 'zh-Hant').trim() || 'zh-Hant';
  const role = sanitizeRole(body.role);
  const status = sanitizeStatus(body.status) || 'active';
  const trialExpiresAtRaw = toIsoOrNull(body.trial_expires_at);

  if (fullName.length < 1 || fullName.length > 80) return { ok: false, message: 'full_name length must be between 1 and 80' };
  if (companyName.length < 1 || companyName.length > 120) return { ok: false, message: 'company_name length must be between 1 and 120' };
  if (jobTitle.length < 1 || jobTitle.length > 120) return { ok: false, message: 'job_title length must be between 1 and 120' };
  if (!validateEmail(email)) return { ok: false, message: 'email is invalid' };
  if (!role) return { ok: false, message: 'role is invalid' };
  if (!STATUSES.has(status)) return { ok: false, message: 'status is invalid' };

  const trialExpiresAt = role === 'trial' ? (trialExpiresAtRaw || toTrialExpiresAtIso()) : null;
  return {
    ok: true,
    value: {
      full_name: fullName,
      company_name: companyName,
      job_title: jobTitle,
      email,
      role,
      status,
      locale,
      trial_expires_at: trialExpiresAt
    }
  };
}

export async function handleAdminUsersList(req, res) {
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
  const role = sanitizeRole(req.query?.role);
  const status = sanitizeStatus(req.query?.status);
  const page = Math.max(1, Math.floor(parseNumber(req.query?.page, 1)));
  const pageSize = Math.min(100, Math.max(1, Math.floor(parseNumber(req.query?.pageSize, 20))));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('user_profiles')
    .select('user_id,email,full_name,company_name,job_title,role,status,trial_expires_at,last_login_at,created_at,updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);
  if (q) {
    const escaped = q.replaceAll(',', ' ');
    query = query.or(`email.ilike.%${escaped}%,full_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%`);
  }

  const [listRes, activeAdminCount] = await Promise.all([
    query,
    countActiveAdmins(supabase)
  ]);

  if (listRes.error) {
    return jsonError(res, 500, 'USERS_QUERY_FAILED', listRes.error.message || 'Failed to query users');
  }

  return res.status(200).json({
    ok: true,
    items: (listRes.data || []).map(normalizeProfile),
    page,
    page_size: pageSize,
    total: Number(listRes.count || 0),
    active_admin_count: activeAdminCount,
    actor_user_id: auth.user_id || null
  });
}

export async function handleAdminUsersCreate(req, res) {
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

  const body = normalizeBody(req.body);
  const validated = validateCreateBody(body);
  if (!validated.ok) return jsonError(res, 400, 'VALIDATION_ERROR', validated.message);

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
      role: payload.role,
      status: payload.status,
      trial_requested_at: payload.role === 'trial' ? new Date().toISOString() : null,
      trial_expires_at: payload.trial_expires_at
    }
  });

  if (userCreate.error || !userCreate.data?.user?.id) {
    return jsonError(res, 500, 'USER_CREATE_FAILED', 'Failed to create user account');
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
      role: payload.role,
      status: payload.status,
      trial_requested_at: payload.role === 'trial' ? new Date().toISOString() : null,
      trial_expires_at: payload.trial_expires_at,
      invited_by: auth.user_id || null
    }, { onConflict: 'user_id' });

  let inviteSent = false;
  let messageId = null;
  const linkRes = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: payload.email,
    options: { redirectTo: process.env.APP_BASE_URL }
  });

  const actionLink = linkRes.data?.properties?.action_link || null;
  if (!linkRes.error && actionLink) {
    const mailRes = await sendInviteEmail({
      to: payload.email,
      fullName: payload.full_name,
      role: payload.role,
      actionLink,
      locale: payload.locale
    });
    if (mailRes.ok) {
      inviteSent = true;
      messageId = mailRes.messageId || null;
    }
  }

  await supabase.from('auth_audit_logs').insert({
    actor_user_id: auth.user_id,
    target_user_id: createdUser.id,
    action: 'user_created',
    entity_type: 'user',
    entity_id: createdUser.id,
    result: 'success',
    metadata: {
      role: payload.role,
      status: payload.status,
      email: payload.email,
      invite_sent: inviteSent,
      resend_message_id: messageId
    }
  });

  const profileRes = await supabase
    .from('user_profiles')
    .select('user_id,email,full_name,company_name,job_title,role,status,trial_expires_at,last_login_at,created_at,updated_at')
    .eq('user_id', createdUser.id)
    .maybeSingle();

  return res.status(201).json({
    ok: true,
    user: normalizeProfile(profileRes.data || { user_id: createdUser.id, ...payload }),
    invite_sent: inviteSent
  });
}

