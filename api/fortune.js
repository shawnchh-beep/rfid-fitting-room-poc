const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { BAGUA_RESULTS, FORTUNE_METHODS, FORTUNE_TOPIC_FALLBACKS, FORTUNE_TOPICS, TAROT_RESULTS } = require('../server/fortune-data.js');
const { buildShareUrl, createShareToken, pickTracking } = require('../server/fortune-share.js');

const DAILY_LIMIT = null;
const TIMEZONE_OFFSET_HOURS = 8;
const MAX_NAME_LENGTH = 40;
const ALLOWED_SHARE_PLATFORMS = new Set(['copy', 'native', 'facebook', 'threads', 'line', 'x']);
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
  const textTopic = FORTUNE_TOPIC_FALLBACKS[topic] || topic;
  return {
    result_key: selected.key,
    result_title: selected.title,
    result_keywords: selected.keywords,
    result_text: selected.text[textTopic] || selected.text.random,
    result_lines: selected.lines || null,
    result_visual: selected.visual || null,
    result_orientation: selected.orientation || null,
    result_base_key: selected.base_key || null
  };
}

function isSchemaMissingError(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /share_events|share_token|ref_source|ref_medium|ref_campaign|referrer|schema cache|column|relation/i.test(message);
}

function findResult(resultKey) {
  return [...BAGUA_RESULTS, ...TAROT_RESULTS].find((item) => item.key === resultKey);
}

async function getSupabaseOrError(req, res) {
  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
    return null;
  }
  return supabase;
}

async function handleSharedReading(req, res) {
  const token = String(req.query?.share || req.query?.token || '').trim();
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(token)) {
    return jsonError(res, 400, 'INVALID_SHARE_TOKEN', '分享連結格式不正確');
  }

  const supabase = await getSupabaseOrError(req, res);
  if (!supabase) return;

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

async function handleShareEvent(req, res, body) {
  const readingId = String(body.reading_id || '').trim();
  const platform = String(body.platform || '').trim().toLowerCase();

  if (!/^[0-9a-fA-F-]{36}$/.test(readingId)) {
    return jsonError(res, 400, 'INVALID_READING_ID', 'reading_id 格式不正確');
  }

  if (!ALLOWED_SHARE_PLATFORMS.has(platform)) {
    return jsonError(res, 400, 'INVALID_PLATFORM', '分享平台不支援');
  }

  const supabase = await getSupabaseOrError(req, res);
  if (!supabase) return;

  const insert = await supabase.from('share_events').insert({
    reading_id: readingId,
    platform,
    action: String(body.action || 'click').trim().slice(0, 40) || 'click',
    ip_hash: hashIp(getClientIp(req)),
    user_agent: String(req.headers['user-agent'] || '').trim() || null
  }).select('id, created_at').single();

  if (insert.error && isSchemaMissingError(insert.error)) {
    return res.status(200).json({
      ok: false,
      skipped: true,
      reason: 'share_events table is not ready'
    });
  }

  if (insert.error) {
    return jsonError(res, 500, 'SHARE_EVENT_SAVE_FAILED', insert.error.message || 'Unable to save share event');
  }

  return res.status(200).json({
    ok: true,
    event: insert.data
  });
}

async function handleCreateReading(req, res, body) {
  const supabase = await getSupabaseOrError(req, res);
  if (!supabase) return;

  const validated = validateBody(body);
  if (!validated.ok) {
    return jsonError(res, 400, 'VALIDATION_ERROR', validated.message);
  }

  const { name, topic, method } = validated.value;
  const ipHash = hashIp(getClientIp(req));
  const shareToken = createShareToken();
  const tracking = pickTracking(body, req);
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
    share_token: shareToken,
    ...tracking,
    ip_hash: ipHash,
    user_agent: String(req.headers['user-agent'] || '').trim() || null
  };

  let insert = await supabase.from('readings').insert(payload).select('id, share_token, created_at').single();
  let shareEnabled = true;
  if (insert.error && isSchemaMissingError(insert.error)) {
    shareEnabled = false;
    const { share_token, ref_source, ref_medium, ref_campaign, referrer, ...legacyPayload } = payload;
    insert = await supabase.from('readings').insert(legacyPayload).select('id, created_at').single();
  }

  if (insert.error) {
    return jsonError(res, 500, 'READING_SAVE_FAILED', insert.error.message || 'Unable to save reading');
  }

  const shareUrl = shareEnabled ? buildShareUrl(req, insert.data.share_token || shareToken) : null;
  return res.status(200).json({
    reading: {
      id: insert.data.id,
      share_token: shareEnabled ? insert.data.share_token || shareToken : null,
      share_url: shareUrl,
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
    share_url: shareUrl,
    usage: {
      limit: DAILY_LIMIT,
      usedToday: usedToday + 1,
      remainingToday: Number.isFinite(DAILY_LIMIT) ? Math.max(DAILY_LIMIT - usedToday - 1, 0) : null
    }
  });
}

async function handler(req, res) {
  if (req.method === 'GET') {
    return handleSharedReading(req, res);
  }

  if (req.method !== 'POST') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  const body = normalizeBody(req.body);
  if (body.event_type === 'share') {
    return handleShareEvent(req, res, body);
  }

  return handleCreateReading(req, res, body);
}

module.exports = handler;
