const { createClient } = require('@supabase/supabase-js');
const { BAGUA_RESULTS, FORTUNE_METHODS, FORTUNE_TOPICS, TAROT_RESULTS } = require('../../server/fortune-data.js');
const { buildShareUrl } = require('../../server/fortune-share.js');

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

function jsonError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message
    }
  });
}

function getToken(req) {
  const raw = req.query?.token || req.query?.share || '';
  return String(Array.isArray(raw) ? raw[0] : raw).trim();
}

function findResult(resultKey) {
  return [...BAGUA_RESULTS, ...TAROT_RESULTS].find((item) => item.key === resultKey);
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  const token = getToken(req);
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(token)) {
    return jsonError(res, 400, 'INVALID_SHARE_TOKEN', '分享連結格式不正確');
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const result = await supabase
    .from('readings')
    .select('id, name, topic, method, result_key, result_title, result_text, share_token, created_at')
    .eq('share_token', token)
    .single();

  if (result.error || !result.data) {
    return jsonError(res, 404, 'SHARED_READING_NOT_FOUND', '找不到這則分享結果');
  }

  const row = result.data;
  const fortuneResult = findResult(row.result_key);
  return res.status(200).json({
    reading: {
      id: row.id,
      share_token: row.share_token,
      share_url: buildShareUrl(req, row.share_token),
      name: row.name,
      topic: row.topic,
      topic_label: FORTUNE_TOPICS[row.topic] || row.topic,
      method: row.method,
      method_label: FORTUNE_METHODS[row.method] || row.method,
      result_key: row.result_key,
      result_title: row.result_title,
      result_keywords: fortuneResult?.keywords || '',
      result_text: row.result_text,
      result_lines: fortuneResult?.lines || null,
      result_visual: fortuneResult?.visual || null,
      result_orientation: fortuneResult?.orientation || null,
      result_base_key: fortuneResult?.base_key || null,
      created_at: row.created_at
    }
  });
}

module.exports = handler;
