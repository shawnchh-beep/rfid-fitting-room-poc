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

function isSchemaMissingError(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /share_events|share_token|ref_source|ref_medium|ref_campaign|referrer|schema cache|column|relation/i.test(message);
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

function summarizeShares(rows) {
  const todayRange = getLocalDayRange(0);
  const platformCounts = {};
  let todayTotal = 0;

  for (const row of rows) {
    const createdAt = new Date(row.created_at).getTime();
    const isToday = createdAt >= Date.parse(todayRange.startIso) && createdAt < Date.parse(todayRange.endIso);
    if (!isToday) continue;

    todayTotal += 1;
    platformCounts[row.platform] = (platformCounts[row.platform] || 0) + 1;
  }

  return {
    today_shares: todayTotal,
    platforms: Object.entries(platformCounts).map(([key, count]) => ({
      key,
      label: key,
      count
    }))
  };
}

function summarizeReferrers(rows) {
  const sourceCounts = {};
  for (const row of rows) {
    const key = row.ref_source || (row.referrer ? 'referrer' : 'direct');
    sourceCounts[key] = (sourceCounts[key] || 0) + 1;
  }

  return Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({
      key,
      label: key,
      count
    }));
}

function summarizeStreaks(rows) {
  const today = getLocalDayRange(0).day;
  const byIp = new Map();

  for (const row of rows) {
    if (!row.ip_hash) continue;
    const day = getLocalDayRange(0, new Date(row.created_at)).day;
    if (!byIp.has(row.ip_hash)) byIp.set(row.ip_hash, new Set());
    byIp.get(row.ip_hash).add(day);
  }

  const currentStreaks = [];
  for (const days of byIp.values()) {
    let streak = 0;
    for (let offset = 0; offset < 30; offset += 1) {
      const day = getLocalDayRange(offset).day;
      if (!days.has(day)) break;
      streak += 1;
    }
    if (streak > 0) currentStreaks.push(streak);
  }

  return {
    active_today: currentStreaks.length,
    max_current_streak: currentStreaks.length ? Math.max(...currentStreaks) : 0,
    buckets: [
      { key: '1', label: '1 天', count: currentStreaks.filter((value) => value === 1).length },
      { key: '2-3', label: '2-3 天', count: currentStreaks.filter((value) => value >= 2 && value <= 3).length },
      { key: '4-7', label: '4-7 天', count: currentStreaks.filter((value) => value >= 4 && value <= 7).length },
      { key: '8+', label: '8 天以上', count: currentStreaks.filter((value) => value >= 8).length }
    ]
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

  const thirtyDaysAgo = getLocalDayRange(29);
  let rowsResult = await supabase
    .from('readings')
    .select('id, name, topic, method, result_title, ip_hash, ref_source, ref_medium, ref_campaign, referrer, user_agent, created_at')
    .gte('created_at', thirtyDaysAgo.startIso)
    .order('created_at', { ascending: false })
    .limit(3000);

  if (rowsResult.error && isSchemaMissingError(rowsResult.error)) {
    rowsResult = await supabase
      .from('readings')
      .select('id, name, topic, method, result_title, ip_hash, user_agent, created_at')
      .gte('created_at', thirtyDaysAgo.startIso)
      .order('created_at', { ascending: false })
      .limit(3000);
  }

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
  const shareResult = await supabase
    .from('share_events')
    .select('id, reading_id, platform, action, ip_hash, user_agent, created_at')
    .gte('created_at', thirtyDaysAgo.startIso)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (shareResult.error && !isSchemaMissingError(shareResult.error)) {
    return jsonError(res, 500, 'SHARE_QUERY_FAILED', shareResult.error.message || 'Unable to load share events');
  }

  const shareRows = shareResult.error ? [] : shareResult.data || [];

  return res.status(200).json({
    generated_at: new Date().toISOString(),
    timezone: 'UTC+08:00',
    ...summary,
    shares: summarizeShares(shareRows),
    referrers: summarizeReferrers(rows),
    streaks: summarizeStreaks(rows),
    trend: buildTrend(rows),
    recent_shares: shareRows.slice(0, 20).map((row) => ({
      id: row.id,
      reading_id: row.reading_id,
      platform: row.platform,
      action: row.action,
      created_at: row.created_at
    })),
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
