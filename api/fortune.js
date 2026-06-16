const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { BAGUA_RESULTS, FORTUNE_METHODS, FORTUNE_TOPICS, TAROT_RESULTS } = require('../server/fortune-data.js');

const DAILY_LIMIT = null;
const TIMEZONE_OFFSET_HOURS = 8;
const MAX_NAME_LENGTH = 40;
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

function jsonError(res, status, code, message, extra = {}) {
  return res.status(status).json({
    error: {
      code,
      message,
      ...extra
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

function getLocalDayRange(date = new Date()) {
  const offsetMs = TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  const startUtcMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString()
  };
}

function validateBody(body) {
  const name = String(body.name || '').trim();
  const topic = String(body.topic || '').trim();
  const method = String(body.method || '').trim();

  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    return { ok: false, message: `姓名需為 1-${MAX_NAME_LENGTH} 個字` };
  }

  if (!FORTUNE_TOPICS[topic]) {
    return { ok: false, message: '請選擇有效的問題類型' };
  }

  if (!FORTUNE_METHODS[method]) {
    return { ok: false, message: '請選擇有效的占卜方式' };
  }

  return { ok: true, value: { name, topic, method } };
}

function pickResult(method, topic) {
  const pool = method === 'tarot' ? TAROT_RESULTS : BAGUA_RESULTS;
  const selected = pool[crypto.randomInt(pool.length)];
  return {
    result_key: selected.key,
    result_title: selected.title,
    result_keywords: selected.keywords,
    result_text: selected.text[topic] || selected.text.random,
    result_lines: selected.lines || null,
    result_visual: selected.visual || null,
    result_orientation: selected.orientation || null,
    result_base_key: selected.base_key || null
  };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const validated = validateBody(normalizeBody(req.body));
  if (!validated.ok) {
    return jsonError(res, 400, 'VALIDATION_ERROR', validated.message);
  }

  const { name, topic, method } = validated.value;
  const ipHash = hashIp(getClientIp(req));
  const { startIso, endIso } = getLocalDayRange();

  const usage = await supabase
    .from('readings')
    .select('id', { head: true, count: 'exact' })
    .eq('ip_hash', ipHash)
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  if (usage.error) {
    return jsonError(res, 500, 'USAGE_LOOKUP_FAILED', usage.error.message || 'Unable to check daily usage');
  }

  const usedToday = usage.count || 0;
  if (Number.isFinite(DAILY_LIMIT) && usedToday >= DAILY_LIMIT) {
    return jsonError(res, 429, 'DAILY_LIMIT_REACHED', '今天的 3 次占卜額度已用完，明天再來抽一次。', {
      limit: DAILY_LIMIT,
      usedToday
    });
  }

  const result = pickResult(method, topic);
  const payload = {
    name,
    topic,
    method,
    result_key: result.result_key,
    result_title: result.result_title,
    result_text: result.result_text,
    ip_hash: ipHash,
    user_agent: String(req.headers['user-agent'] || '').trim() || null
  };

  const insert = await supabase.from('readings').insert(payload).select('id, created_at').single();
  if (insert.error) {
    return jsonError(res, 500, 'READING_SAVE_FAILED', insert.error.message || 'Unable to save reading');
  }

  return res.status(200).json({
    reading: {
      id: insert.data.id,
      name,
      topic,
      topic_label: FORTUNE_TOPICS[topic],
      method,
      method_label: FORTUNE_METHODS[method],
      result_key: result.result_key,
      result_title: result.result_title,
      result_keywords: result.result_keywords,
      result_text: result.result_text,
      result_lines: result.result_lines,
      result_visual: result.result_visual,
      result_orientation: result.result_orientation,
      result_base_key: result.result_base_key,
      created_at: insert.data.created_at
    },
    usage: {
      limit: DAILY_LIMIT,
      usedToday: usedToday + 1,
      remainingToday: Number.isFinite(DAILY_LIMIT) ? Math.max(DAILY_LIMIT - usedToday - 1, 0) : null
    }
  });
}

module.exports = handler;
