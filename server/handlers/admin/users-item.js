import { authorizeAdmin } from '../../auth.js';
import { getSupabaseAdminClient, normalizeBody, toTrialExpiresAtIso } from '../../supabase.js';

const ROLES = new Set(['guest', 'trial', 'user', 'admin']);
const STATUSES = new Set(['pending_activation', 'active', 'expired', 'disabled']);

function jsonError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
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
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

async function countActiveAdmins(supabase) {
  const result = await supabase
    .from('user_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('status', 'active');
  return Number(result.count || 0);
}

async function loadTargetProfile(supabase, userId) {
  return supabase
    .from('user_profiles')
    .select('user_id,email,full_name,company_name,job_title,role,status,trial_expires_at')
    .eq('user_id', userId)
    .maybeSingle();
}

export async function handleAdminUserPatch(req, res, userId) {
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

  const profileRes = await loadTargetProfile(supabase, userId);
  if (profileRes.error || !profileRes.data) {
    return jsonError(res, 404, 'USER_NOT_FOUND', 'User profile not found');
  }

  const current = profileRes.data;
  const body = normalizeBody(req.body);

  const fullName = String(body.full_name ?? current.full_name ?? '').trim();
  const companyName = String(body.company_name ?? current.company_name ?? '').trim();
  const jobTitle = String(body.job_title ?? current.job_title ?? '').trim();

  if (fullName.length < 1 || fullName.length > 80) return jsonError(res, 400, 'VALIDATION_ERROR', 'full_name length must be between 1 and 80');
  if (companyName.length < 1 || companyName.length > 120) return jsonError(res, 400, 'VALIDATION_ERROR', 'company_name length must be between 1 and 120');
  if (jobTitle.length < 1 || jobTitle.length > 120) return jsonError(res, 400, 'VALIDATION_ERROR', 'job_title length must be between 1 and 120');

  const nextRole = sanitizeRole(body.role) || String(current.role || '').trim();
  const nextStatus = sanitizeStatus(body.status) || String(current.status || '').trim();
  if (!ROLES.has(nextRole)) return jsonError(res, 400, 'VALIDATION_ERROR', 'role is invalid');
  if (!STATUSES.has(nextStatus)) return jsonError(res, 400, 'VALIDATION_ERROR', 'status is invalid');

  if (String(auth.user_id || '') === userId && (nextRole !== 'admin' || nextStatus !== 'active')) {
    return jsonError(res, 400, 'SELF_PROTECTION', 'Admin cannot demote or disable self');
  }

  const activeAdminCount = await countActiveAdmins(supabase);
  const isCurrentActiveAdmin = String(current.role) === 'admin' && String(current.status) === 'active';
  const isNextActiveAdmin = nextRole === 'admin' && nextStatus === 'active';
  if (isCurrentActiveAdmin && !isNextActiveAdmin && activeAdminCount <= 1) {
    return jsonError(res, 409, 'LAST_ADMIN_PROTECTED', 'Cannot demote or disable the last active admin');
  }

  const nextTrialExpiresAt = nextRole === 'trial'
    ? (toIsoOrNull(body.trial_expires_at) || current.trial_expires_at || toTrialExpiresAtIso())
    : null;

  const updateProfile = await supabase
    .from('user_profiles')
    .update({
      full_name: fullName,
      company_name: companyName,
      job_title: jobTitle,
      role: nextRole,
      status: nextStatus,
      trial_expires_at: nextTrialExpiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select('user_id,email,full_name,company_name,job_title,role,status,trial_expires_at,last_login_at,created_at,updated_at')
    .single();

  if (updateProfile.error || !updateProfile.data) {
    return jsonError(res, 500, 'USER_UPDATE_FAILED', updateProfile.error?.message || 'Failed to update user profile');
  }

  const updateAuth = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      full_name: fullName,
      company_name: companyName,
      job_title: jobTitle
    },
    app_metadata: {
      role: nextRole,
      status: nextStatus,
      trial_expires_at: nextTrialExpiresAt
    }
  });

  if (updateAuth.error) {
    return jsonError(res, 500, 'AUTH_USER_UPDATE_FAILED', updateAuth.error.message || 'Failed to update auth user');
  }

  await supabase.from('auth_audit_logs').insert({
    actor_user_id: auth.user_id,
    target_user_id: userId,
    action: 'user_profile_updated',
    entity_type: 'user',
    entity_id: userId,
    result: 'success',
    metadata: {
      before: {
        role: current.role,
        status: current.status,
        trial_expires_at: current.trial_expires_at
      },
      after: {
        role: nextRole,
        status: nextStatus,
        trial_expires_at: nextTrialExpiresAt
      }
    }
  });

  return res.status(200).json({
    ok: true,
    user: updateProfile.data
  });
}

export async function handleAdminUserDelete(req, res, userId) {
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

  if (String(auth.user_id || '') === userId) {
    return jsonError(res, 400, 'SELF_PROTECTION', 'Admin cannot delete self');
  }

  const profileRes = await loadTargetProfile(supabase, userId);
  if (profileRes.error || !profileRes.data) {
    return jsonError(res, 404, 'USER_NOT_FOUND', 'User profile not found');
  }
  const profile = profileRes.data;

  const activeAdminCount = await countActiveAdmins(supabase);
  const isTargetActiveAdmin = String(profile.role) === 'admin' && String(profile.status) === 'active';
  if (isTargetActiveAdmin && activeAdminCount <= 1) {
    return jsonError(res, 409, 'LAST_ADMIN_PROTECTED', 'Cannot delete the last active admin');
  }

  const deleteRes = await supabase.auth.admin.deleteUser(userId);
  if (deleteRes.error) {
    return jsonError(res, 500, 'USER_DELETE_FAILED', deleteRes.error.message || 'Failed to delete user');
  }

  await supabase.from('auth_audit_logs').insert({
    actor_user_id: auth.user_id,
    target_user_id: userId,
    action: 'user_deleted',
    entity_type: 'user',
    entity_id: userId,
    result: 'success',
    metadata: {
      role: profile.role,
      status: profile.status,
      email: profile.email
    }
  });

  return res.status(200).json({ ok: true, deleted: true, user_id: userId });
}

