const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const ALLOWED_PLATFORMS = new Set(['copy', 'native', 'facebook', 'threads', 'line', 'x']);
let supabaseAdminClient = null;

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getSupabaseAdminClient() {
  if (supabaseAdminClient) return supabaseAdminClient;
  supabaseAdminClient = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return supabaseAdminClient;
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

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
  return String(req.socket?.remoteAddress || '').trim() || 'unknown';
}

function hashIp(ip) {
  const salt = String(process.env.FORTUNE_IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  const body = normalizeBody(req.body);
  const readingId = String(body.reading_id || '').trim();
  const platform = String(body.platform || '').trim().toLowerCase();

  if (!/^[0-9a-fA-F-]{36}$/.test(readingId)) {
    return jsonError(res, 400, 'INVALID_READING_ID', 'reading_id 格式不正確');
  }

  if (!ALLOWED_PLATFORMS.has(platform)) {
    return jsonError(res, 400, 'INVALID_PLATFORM', '分享平台不支援');
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const insert = await supabase.from('share_events').insert({
    reading_id: readingId,
    platform,
    action: String(body.action || 'click').trim().slice(0, 40) || 'click',
    ip_hash: hashIp(getClientIp(req)),
    user_agent: String(req.headers['user-agent'] || '').trim() || null
  }).select('id, created_at').single();

  if (insert.error) {
    return jsonError(res, 500, 'SHARE_EVENT_SAVE_FAILED', insert.error.message || 'Unable to save share event');
  }

  return res.status(200).json({
    ok: true,
    event: insert.data
  });
}

module.exports = handler;
