export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method Not Allowed'
      }
    });
  }

  const fallbackEnabled = String(process.env.LOGIN_FALLBACK_ENABLED || '').trim().toLowerCase() === 'true';
  if (!fallbackEnabled) {
    return res.status(410).json({
      error: {
        code: 'LOGIN_DEPRECATED',
        message: 'Legacy /api/login is deprecated. Please use Supabase Auth signInWithPassword.'
      }
    });
  }

  return res.status(501).json({
    error: {
      code: 'LEGACY_LOGIN_NOT_IMPLEMENTED',
      message: 'Legacy fallback is enabled but not implemented in this auth-trial migration.'
    }
  });
}
