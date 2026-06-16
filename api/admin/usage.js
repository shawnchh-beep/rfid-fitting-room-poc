const { createClient } = require('@supabase/supabase-js');
const { FORTUNE_METHODS, FORTUNE_TOPICS } = require('../../server/fortune-data.js');

const TIMEZONE_OFFSET_HOURS = 8;
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

function getLocalDayRange(daysAgo = 0, date = new Date()) {
  const offsetMs = TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  const startUtcMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysAgo) - offsetMs;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    day: new Date(startUtcMs + offsetMs).toISOString().slice(0, 10),
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString()
  };
}

function checkAdminPassword(req) {
  const configured = String(process.env.FORTUNE_ADMIN_PASSWORD || '').trim();
  if (!configured) return { ok: false, code: 'ADMIN_PASSWORD_NOT_CONFIGURED' };

  const provided = String(req.headers['x-admin-password'] || '').trim();
  if (!provided || provided !== configured) return { ok: false, code: 'UNAUTHORIZED' };

  return { ok: true };
}

function makeBuckets(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function summarizeRows(rows) {
  const todayRange = getLocalDayRange(0);
  const topicCounts = makeBuckets(Object.keys(FORTUNE_TOPICS));
  const methodCounts = makeBuckets(Object.keys(FORTUNE_METHODS));
  const uniqueIps = new Set();
  let todayTotal = 0;

  for (const row of rows) {
    const createdAt = new Date(row.created_at).getTime();
    const isToday = createdAt >= Date.parse(todayRange.startIso) && createdAt < Date.parse(todayRange.endIso);
    if (!isToday) continue;

    todayTotal += 1;
    if (row.ip_hash) uniqueIps.add(row.ip_hash);
    if (topicCounts[row.topic] !== undefined) topicCounts[row.topic] += 1;
    if (methodCounts[row.method] !== undefined) methodCounts[row.method] += 1;
  }

  return {
    today: {
      day: todayRange.day,
      total_readings: todayTotal,
      unique_users: uniqueIps.size
    },
    topics: Object.entries(topicCounts).map(([key, count]) => ({
      key,
      label: FORTUNE_TOPICS[key],
      count
    })),
    methods: Object.entries(methodCounts).map(([key, count]) => ({
      key,
      label: FORTUNE_METHODS[key],
      count
    }))
  };
}

function buildTrend(rows) {
  return Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    const range = getLocalDayRange(daysAgo);
    const uniqueIps = new Set();
    let total = 0;

    for (const row of rows) {
      const createdAt = new Date(row.created_at).getTime();
      if (createdAt >= Date.parse(range.startIso) && createdAt < Date.parse(range.endIso)) {
        total += 1;
        if (row.ip_hash) uniqueIps.add(row.ip_hash);
      }
    }

    return {
      day: range.day,
      total_readings: total,
      unique_users: uniqueIps.size
    };
  });
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
  }

  const auth = checkAdminPassword(req);
  if (!auth.ok) {
    const status = auth.code === 'ADMIN_PASSWORD_NOT_CONFIGURED' ? 500 : 401;
    return jsonError(res, status, auth.code, auth.code === 'UNAUTHORIZED' ? 'Invalid admin password' : 'FORTUNE_ADMIN_PASSWORD is required');
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (error) {
    return jsonError(res, 500, 'CONFIG_ERROR', error?.message || 'Supabase config error');
  }

  const sevenDaysAgo = getLocalDayRange(6);
  const rowsResult = await supabase
    .from('readings')
    .select('id, name, topic, method, result_title, ip_hash, user_agent, created_at')
    .gte('created_at', sevenDaysAgo.startIso)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (rowsResult.error) {
    return jsonError(res, 500, 'USAGE_QUERY_FAILED', rowsResult.error.message || 'Unable to load usage');
  }

  const recentResult = await supabase
    .from('readings')
    .select('id, name, topic, method, result_title, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (recentResult.error) {
    return jsonError(res, 500, 'RECENT_QUERY_FAILED', recentResult.error.message || 'Unable to load recent readings');
  }

  const rows = rowsResult.data || [];
  const summary = summarizeRows(rows);

  return res.status(200).json({
    generated_at: new Date().toISOString(),
    timezone: 'UTC+08:00',
    ...summary,
    trend: buildTrend(rows),
    recent: (recentResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      topic: row.topic,
      topic_label: FORTUNE_TOPICS[row.topic] || row.topic,
      method: row.method,
      method_label: FORTUNE_METHODS[row.method] || row.method,
      result_title: row.result_title,
      created_at: row.created_at
    }))
  });
}

module.exports = handler;
