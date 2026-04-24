import { getSupabaseAdminClient } from './_supabase.js';

const WEBHOOK_ALLOWED_ROLES = new Set(['trial', 'user', 'admin', 'service_backend']);
const BULK_ALLOWED_ROLES = new Set(['user', 'admin', 'service_backend']);
const ANY_APP_USER_ROLES = new Set(['guest', 'trial', 'user', 'admin']);

function getHeader(req, key) {
  return String(req?.headers?.[key] || '').trim();
}

function getBearerToken(req) {
  const authorization = getHeader(req, 'authorization');
  if (!authorization) return '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}

function getServiceToken(req) {
  return getHeader(req, 'x-api-token');
}

function baseError(status, code, message) {
  return {
    ok: false,
    status,
    error: message,
    errorBody: {
      error: {
        code,
        message
      }
    }
  };
}

function isAuthModeEnabled() {
  const raw = String(process.env.API_AUTH_ENABLED || '').trim().toLowerCase();
  if (!raw) return true;
  return raw === 'true';
}

function isProfileActive(profile) {
  if (!profile) return false;
  if (profile.status !== 'active') return false;
  if (profile.role !== 'trial') return true;
  if (!profile.trial_expires_at) return false;
  return Date.parse(profile.trial_expires_at) > Date.now();
}

function buildPrincipalFromProfile({ user, profile }) {
  return {
    ok: true,
    auth_mode: 'bearer',
    mode: 'bearer',
    role: profile.role,
    user_id: user.id,
    email: profile.email || user.email || null,
    status: profile.status,
    trial_expires_at: profile.trial_expires_at || null,
    user: {
      id: user.id,
      email: profile.email || user.email || null,
      role: profile.role,
      status: profile.status,
      trial_expires_at: profile.trial_expires_at || null
    },
    profile
  };
}

function buildPermissions(role) {
  const r = String(role || '').trim();
  return {
    canViewDashboard: ['guest', 'trial', 'user', 'admin'].includes(r),
    canViewProduct: ['guest', 'trial', 'user', 'admin'].includes(r),
    canViewFittingDemo: ['trial', 'user', 'admin'].includes(r),
    canUseFittingDemo: ['trial', 'user', 'admin'].includes(r),
    canUseCsvImport: ['user', 'admin'].includes(r),
    canUseSetting: ['admin'].includes(r),
    canManageAccounts: ['admin'].includes(r)
  };
}

function mapRoleBindingToAppRole(bindingRole) {
  const raw = String(bindingRole || '').trim();
  if (!raw) return '';
  if (raw === 'admin') return 'admin';
  if (raw === 'guest') return 'guest';
  if (raw === 'trial') return 'trial';
  if (raw === 'user') return 'user';
  if (raw === 'store_manager' || raw === 'store_clerk') return 'user';
  return '';
}

function pickPrimaryBindingRole(bindings = []) {
  if (!Array.isArray(bindings) || bindings.length === 0) return '';
  const globalBinding = bindings.find((row) => row?.store_id == null);
  const chosen = globalBinding || bindings[0] || null;
  return mapRoleBindingToAppRole(chosen?.role);
}

async function resolveUserProfileCompat(supabase, authUserId) {
  // v3: user_profiles.id = auth.users.id
  const byId = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();

  if (!byId.error && byId.data) {
    return { profile: byId.data, source: 'id', error: null };
  }

  // v2: user_profiles.user_id = auth.users.id
  const byUserId = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (!byUserId.error && byUserId.data) {
    return { profile: byUserId.data, source: 'user_id', error: null };
  }

  return {
    profile: null,
    source: 'none',
    error: byId.error || byUserId.error || null
  };
}

async function resolveBearerPrincipal(req) {
  const token = getBearerToken(req);
  if (!token) {
    return baseError(401, 'UNAUTHORIZED', 'Missing or invalid access token');
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return baseError(500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const userRes = await supabase.auth.getUser(token);
  if (userRes.error || !userRes.data?.user) {
    return baseError(401, 'UNAUTHORIZED', 'Missing or invalid access token');
  }

  const authUser = userRes.data.user;
  const profileLookup = await resolveUserProfileCompat(supabase, authUser.id);
  const roleBindingRes = await supabase
    .from('user_role_bindings')
    .select('user_id,role,store_id')
    .eq('user_id', authUser.id)
    .limit(5);

  if (profileLookup.error || !profileLookup.profile) {
    return baseError(403, 'PROFILE_NOT_FOUND', 'User profile not found');
  }

  const rawProfile = profileLookup.profile;
  const bindingRole = pickPrimaryBindingRole(roleBindingRes?.data || []);
  const normalizedRole = String(rawProfile.role || '').trim() || bindingRole;
  const normalizedStatus = String(rawProfile.status || '').trim()
    || (rawProfile.is_active === false ? 'disabled' : 'active');

  const profile = {
    ...rawProfile,
    email: rawProfile.email || authUser.email || null,
    full_name: rawProfile.full_name || rawProfile.display_name || null,
    company_name: rawProfile.company_name || null,
    job_title: rawProfile.job_title || null,
    role: normalizedRole,
    status: normalizedStatus,
    trial_expires_at: rawProfile.trial_expires_at || null
  };

  if (!ANY_APP_USER_ROLES.has(String(profile.role || '').trim())) {
    return baseError(403, 'FORBIDDEN', 'Unknown account role');
  }

  if (!isProfileActive(profile)) {
    if (profile.role === 'trial' && profile.trial_expires_at && Date.parse(profile.trial_expires_at) <= Date.now()) {
      return baseError(403, 'ACCOUNT_EXPIRED', 'Trial account has expired');
    }
    return baseError(403, 'FORBIDDEN', 'Account is not active');
  }

  return buildPrincipalFromProfile({ user: authUser, profile });
}

function resolveServicePrincipal(req) {
  const expectedToken = String(process.env.API_SHARED_TOKEN || '').trim();
  const providedToken = getServiceToken(req);
  if (!expectedToken) {
    return baseError(500, 'CONFIG_ERROR', 'API_SHARED_TOKEN is required for service auth');
  }
  if (!providedToken || providedToken !== expectedToken) {
    return baseError(401, 'UNAUTHORIZED', 'Invalid service token');
  }

  return {
    ok: true,
    auth_mode: 'service_token',
    mode: 'service_token',
    role: 'service_backend',
    user_id: null,
    email: null,
    status: 'active',
    trial_expires_at: null,
    user: {
      id: null,
      email: null,
      role: 'service_backend',
      status: 'active',
      trial_expires_at: null
    },
    profile: null
  };
}

async function authorize(req, allowedRoles = new Set()) {
  if (!isAuthModeEnabled()) {
    return {
      ok: true,
      auth_mode: 'disabled',
      mode: 'disabled',
      role: 'admin',
      user_id: null,
      email: null,
      status: 'active',
      trial_expires_at: null,
      user: {
        id: null,
        email: null,
        role: 'admin',
        status: 'active',
        trial_expires_at: null
      },
      profile: null
    };
  }

  const hasBearer = Boolean(getBearerToken(req));
  const principal = hasBearer ? await resolveBearerPrincipal(req) : resolveServicePrincipal(req);
  if (!principal.ok) return principal;

  if (allowedRoles.size > 0 && !allowedRoles.has(principal.role)) {
    return baseError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
  }

  return {
    ...principal,
    permissions: buildPermissions(principal.role)
  };
}

export async function authorizeWebhook(req) {
  return authorize(req, WEBHOOK_ALLOWED_ROLES);
}

export async function authorizeBulkProducts(req) {
  return authorize(req, BULK_ALLOWED_ROLES);
}

export async function authorizeAnySignedIn(req) {
  return authorize(req, ANY_APP_USER_ROLES);
}

export async function authorizeAdmin(req) {
  return authorize(req, new Set(['admin']));
}
