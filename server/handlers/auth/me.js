import { authorizeAnySignedIn } from '../../auth.js';

export async function handleAuthMe(req, res) {
  const auth = await authorizeAnySignedIn(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.errorBody || {
      error: {
        code: 'UNAUTHORIZED',
        message: auth.error || 'Unauthorized'
      }
    });
  }

  return res.status(200).json({
    user: {
      id: auth.user?.id || auth.user_id,
      email: auth.user?.email || auth.email || null
    },
    profile: {
      role: auth.role,
      status: auth.status,
      full_name: auth.profile?.full_name || null,
      company_name: auth.profile?.company_name || null,
      job_title: auth.profile?.job_title || null,
      trial_expires_at: auth.trial_expires_at || null
    },
    permissions: auth.permissions || {}
  });
}

