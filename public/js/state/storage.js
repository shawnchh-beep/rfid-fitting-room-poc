export const STORAGE_KEYS = {
  supabaseConfig: 'rfid_poc_supabase_config_v1',
  supabaseUrl: 'supabaseUrl',
  supabaseAnonKey: 'supabaseAnonKey',
  lang: 'rfid_poc_lang_v1',
  mode: 'rfid_poc_mode_v1',
  productSummaryView: 'rfid_poc_product_summary_view_v1',
  overstayDemoMinutes: 'rfid_poc_overstay_demo_minutes_v1',
  overstayOperationalMinutes: 'rfid_poc_overstay_operational_minutes_v1',
  session: 'rfid_poc_login_session_v1'
};

export function readStorage(key, fallback = null) {
  const value = window.localStorage.getItem(key);
  return value == null ? fallback : value;
}

export function writeStorage(key, value) {
  if (value == null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, String(value));
}

export function readJsonStorage(key, fallback = null) {
  const raw = readStorage(key, null);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key, value) {
  if (value == null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}
