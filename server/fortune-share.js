const crypto = require('node:crypto');

const SHARE_TOKEN_BYTES = 12;

function createShareToken() {
  return crypto.randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

function getBaseUrl(req) {
  const envUrl = String(process.env.FORTUNE_PUBLIC_BASE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (envUrl) return envUrl.startsWith('http') ? envUrl.replace(/\/+$/, '') : `https://${envUrl.replace(/\/+$/, '')}`;

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'getrfid.link').split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function getFortuneUrl(req) {
  return `${getBaseUrl(req)}/fortuneteller`;
}

function buildShareUrl(req, token, platform = 'copy') {
  const url = new URL(getFortuneUrl(req));
  url.searchParams.set('share', token);
  url.searchParams.set('utm_source', platform);
  url.searchParams.set('utm_medium', 'share');
  return url.toString();
}

function pickTracking(body = {}, req) {
  return {
    ref_source: cleanTrackingValue(body.utm_source || body.ref_source),
    ref_medium: cleanTrackingValue(body.utm_medium || body.ref_medium),
    ref_campaign: cleanTrackingValue(body.utm_campaign || body.ref_campaign),
    referrer: cleanTrackingValue(body.referrer || req.headers.referer || req.headers.referrer, 500)
  };
}

function cleanTrackingValue(value, maxLength = 120) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

module.exports = {
  buildShareUrl,
  createShareToken,
  getFortuneUrl,
  pickTracking
};
