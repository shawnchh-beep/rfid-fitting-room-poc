import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STORAGE_KEY = 'rfid_poc_supabase_config_v1';
const URL_KEY = 'supabaseUrl';
const ANON_KEY = 'supabaseAnonKey';
const LANG_KEY = 'rfid_poc_lang_v1';
const MODE_KEY = 'rfid_poc_mode_v1';
const OVERSTAY_DEMO_KEY = 'rfid_poc_overstay_demo_minutes_v1';
const OVERSTAY_OPERATIONAL_KEY = 'rfid_poc_overstay_operational_minutes_v1';
const API_TOKEN_KEY = 'rfid_poc_api_token_v1';
const USER_ROLE_KEY = 'rfid_poc_user_role_v1';
const USER_ROLE_DEFAULT = 'trial';
const USER_ROLE_OPTIONS = ['trial', 'user', 'admin'];
const DEFAULT_SUPABASE_URL = 'https://trgxtbqjkhydvbfndmhk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_RjeQR-HU84MRCpByTqZlxg_lwJHStMP';
const DEFAULT_LANG = 'en';
const DEFAULT_MODE = 'demo';
const MODE_DEFAULT_THRESHOLDS = {
  demo: 15,
  operational: 10
};
const SUPPORTED_LANGS = ['en', 'zh-Hant', 'zh-Hans', 'ja'];
const SUPPORTED_MODES = ['demo', 'operational'];
const FITTING_EXIT_TIMEOUT_MS = 10_000;
const STATES = ['RACK', 'FITTING_ROOM', 'CHECKOUT', 'SOLD'];
const BOARD_STATES = ['RACK', 'FITTING_ROOM', 'CHECKOUT'];

function normalizeUserRole(value) {
  const role = String(value || '').trim();
  return USER_ROLE_OPTIONS.includes(role) ? role : USER_ROLE_DEFAULT;
}

function todayStartIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

let supabase = null;
let subscription = null;
let currentLang = DEFAULT_LANG;
let currentMode = DEFAULT_MODE;
let dragProductKey = null;
const localLaneOverrides = new Map();
let lastRenderContext = null;

const el = {
  connectionStatus: document.getElementById('connectionStatus'),
  dashboard: document.getElementById('dashboard'),
  itemDetailOverlay: document.getElementById('itemDetailOverlay'),
  itemDetailBody: document.getElementById('itemDetailBody'),
  itemDetailClose: document.getElementById('itemDetailClose'),
  refreshButton: document.getElementById('refreshButton'),
  configForm: document.getElementById('configForm'),
  supabaseUrl: document.getElementById('supabaseUrl'),
  supabaseAnonKey: document.getElementById('supabaseAnonKey'),
  apiToken: document.getElementById('apiToken'),
  userRole: document.getElementById('userRole'),
  csvImportForm: document.getElementById('csvImportForm'),
  csvFile: document.getElementById('csvFile'),
  importResult: document.getElementById('importResult'),
  simulateForm: document.getElementById('simulateForm'),
  simulateResult: document.getElementById('simulateResult'),
  eventLog: document.getElementById('eventLog'),
  languageSelect: document.getElementById('languageSelect'),
  kpiTotal: document.getElementById('kpiTotal'),
  kpiFitting: document.getElementById('kpiFitting'),
  kpiAbnormal: document.getElementById('kpiAbnormal'),
  kpiCheckout: document.getElementById('kpiCheckout'),
  kpiSold: document.getElementById('kpiSold'),
  kpiTodayFitting: document.getElementById('kpiTodayFitting'),
  kpiTodaySales: document.getElementById('kpiTodaySales'),
  kpiConversionRate: document.getElementById('kpiConversionRate'),
  restockList: document.getElementById('restockList'),
  modeSelect: document.getElementById('modeSelect'),
  overstayThresholdMinutes: document.getElementById('overstayThresholdMinutes'),
  activityTimeline: document.getElementById('activityTimeline')
};

const I18N = {
  en: {
    'app.title': 'RFID Fitting Room PoC Dashboard',
    'language.label': 'Language',
    'config.title': 'Supabase Connection',
    'config.urlLabel': 'Supabase URL',
    'config.anonKeyLabel': 'Supabase Publishable Key',
    'auth.apiTokenLabel': 'API Shared Token',
    'auth.roleLabel': 'Role',
    'auth.role.trial': 'Trial',
    'auth.role.user': 'User',
    'auth.role.admin': 'Admin',
    'config.saveAndConnect': 'Save & Connect',
    'dashboard.title': 'Product Status Board',
    'board.title': 'Visual Simulation Board',
    'board.lanes': 'Rack / Fitting / Checkout',
    'board.completeSale': 'Complete Sale',
    'board.soldTag': 'SOLD',
    'dashboard.refresh': 'Refresh',
    'dashboard.empty': 'No data',
    'dashboard.unnamedProduct': 'Unnamed Product',
    'dashboard.sku': 'SKU',
    'dashboard.epc': 'EPC',
    'dashboard.gtinSegment': 'GTIN Segment',
    'dashboard.price': 'Price',
    'dashboard.description': 'Description',
    'dashboard.lastReader': 'Last Reader',
    'dashboard.abnormalStay': 'Abnormal stay',
    'kpi.total': 'Total Items',
    'kpi.fitting': 'In Fitting',
    'kpi.abnormal': 'Abnormal Stay',
    'kpi.checkout': 'At Checkout',
    'kpi.sold': 'Sold',
    'kpi.todayFitting': 'Today Fitting Sessions',
    'kpi.todaySales': 'Today Sales',
    'kpi.conversionRate': 'Today Conversion Rate',
    'mode.label': 'Operation Mode',
    'mode.demo': 'Demo',
    'mode.operational': 'Operational',
    'mode.thresholdLabel': 'Overstay Threshold (minutes)',
    'timeline.title': 'Recent Actions',
    'timeline.dragAction': '{name}: {from} → {to}',
    'backup.title': 'Backup / Testing Tools',
    'backup.hint': 'These tools are secondary and used for maintenance/testing.',
    'backup.summary': 'Open secondary tools',
    'import.title': 'CSV Product Import',
    'import.fieldsHint': 'Fields:',
    'import.submit': 'Upload & Import',
    'import.notStarted': 'Not imported yet',
    'simulate.title': 'Simulate RFID Event',
    'simulate.readerId': 'Reader ID',
    'simulate.epcData': 'EPC Data (24-char Hex)',
    'simulate.submit': 'Send Event',
    'simulate.notSent': 'Not sent yet',
    'events.title': 'Latest Event Logs',
    'events.unknownReader': 'UNKNOWN_READER',
    'events.epc': 'EPC',
    'events.eventType': 'Event Type',
    'events.fromZone': 'From Zone',
    'events.toZone': 'To Zone',
    'events.time': 'Time',
    'detail.title': 'Item Details',
    'detail.close': 'Close',
    'detail.name': 'Name',
    'detail.sku': 'SKU',
    'detail.epc': 'EPC',
    'detail.zone': 'Zone',
    'detail.status': 'Status',
    'restock.title': 'Restock Suggestions (Rule-based)',
    'restock.empty': 'No restock suggestion',
    'restock.row': '{name} / sold7d={sold7d} / stock={stock} / suggest={qty}',
    'status.initializing': 'Initializing…',
    'status.notConnected': 'Supabase not connected yet',
    'status.loading': 'Loading data…',
    'status.connected': 'Connected',
    'status.realtimeSubscribed': 'Realtime subscribed',
    'status.realtimeUpdateFailed': 'Realtime update failed: {message}',
    'status.dragSyncing': 'Syncing drag action…',
    'status.dragSynced': 'Drag action synced',
    'status.dragSyncFailed': 'Drag sync failed: {message}',
    'status.connectionFailed': 'Connection failed: {message}',
    'status.refreshFailed': 'Refresh failed: {message}',
    'status.autoConnectFailed': 'Auto connect failed: {message}',
    'status.needSupabaseConfig': 'Please enter Supabase connection settings',
    'error.apiNotJson': 'Server response is not JSON (HTTP {status})',
    'error.epcMust24Hex': 'EPC must be a 24-char hex string',
    'error.csvNeedsHeaderAndOneRow': 'CSV must contain at least header and one data row',
    'error.invalidEpcRows': 'Found {count} rows with invalid EPC format, please fix and retry',
    'error.bulkImportFailed': 'Bulk import failed',
    'error.bulkImportEmptyResponse': 'Bulk import failed: empty response from server',
    'error.simulateFailed': 'Send event failed',
    'error.simulateEmptyResponse': 'Send event failed: empty response from server',
    'error.importFailed': 'Import failed: {message}',
    'error.trialImportForbidden': 'Trial role cannot import products',
    'error.eventSendFailed': 'Send failed: {message}',
    'state.RACK': 'RACK',
    'state.FITTING_ROOM': 'FITTING_ROOM',
    'state.CHECKOUT': 'CHECKOUT',
    'state.SOLD': 'SOLD'
  },
  'zh-Hant': {
    'app.title': 'RFID 試衣間 PoC 後台',
    'language.label': '語言',
    'config.title': 'Supabase 連線設定',
    'auth.apiTokenLabel': 'API 共用 Token',
    'auth.roleLabel': '角色',
    'auth.role.trial': '試用',
    'auth.role.user': '一般使用者',
    'auth.role.admin': '管理者',
    'config.saveAndConnect': '儲存設定並連線',
    'dashboard.title': '商品狀態看板',
    'board.title': '圖像化模擬看板',
    'board.lanes': '貨架 / 試衣間 / 結帳櫃檯',
    'board.completeSale': '完成銷售',
    'board.soldTag': '已售出',
    'dashboard.refresh': '手動刷新',
    'dashboard.empty': '無資料',
    'dashboard.unnamedProduct': '未命名商品',
    'dashboard.gtinSegment': 'GTIN片段',
    'dashboard.price': '價格',
    'dashboard.description': '描述',
    'dashboard.lastReader': '最後 Reader',
    'dashboard.abnormalStay': '異常停留',
    'kpi.total': '商品總數',
    'kpi.fitting': '試穿中',
    'kpi.abnormal': '異常停留',
    'kpi.checkout': '結帳櫃檯',
    'kpi.sold': '已售出',
    'kpi.todayFitting': '今日試穿次數',
    'kpi.todaySales': '今日成交件數',
    'kpi.conversionRate': '今日轉化率',
    'mode.label': '運作模式',
    'mode.demo': 'Demo',
    'mode.operational': '營運',
    'mode.thresholdLabel': '異常停留門檻（分鐘）',
    'timeline.title': '最近動作',
    'timeline.dragAction': '{name}: {from} → {to}',
    'backup.title': '備援 / 測試工具',
    'backup.hint': '以下工具為二級介面，提供維運與測試使用。',
    'backup.summary': '展開二級工具',
    'import.title': 'CSV 批量導入商品',
    'import.fieldsHint': '欄位：',
    'import.submit': '上傳並導入',
    'import.notStarted': '尚未導入',
    'simulate.title': '模擬 RFID 事件',
    'simulate.epcData': 'EPC Data (24碼 Hex)',
    'simulate.submit': '送出事件',
    'simulate.notSent': '尚未送出',
    'events.title': '最新事件記錄',
    'events.eventType': '事件類型',
    'events.fromZone': '來源區域',
    'events.toZone': '目標區域',
    'events.time': '時間',
    'detail.title': '商品詳情',
    'detail.close': '關閉',
    'detail.name': '名稱',
    'detail.sku': 'SKU',
    'detail.epc': 'EPC',
    'detail.zone': '所在區域',
    'detail.status': '目前狀態',
    'restock.title': '補貨建議（固定規則）',
    'restock.empty': '目前無補貨建議',
    'restock.row': '{name} / 7日售出={sold7d} / 庫存={stock} / 建議={qty}',
    'status.initializing': '初始化中…',
    'status.notConnected': '尚未連線 Supabase',
    'status.loading': '讀取資料中…',
    'status.connected': '連線正常',
    'status.realtimeSubscribed': 'Realtime 已訂閱',
    'status.realtimeUpdateFailed': 'Realtime 更新失敗: {message}',
    'status.dragSyncing': '拖拉動作同步中…',
    'status.dragSynced': '拖拉動作已同步',
    'status.dragSyncFailed': '拖拉同步失敗: {message}',
    'status.connectionFailed': '連線失敗: {message}',
    'status.refreshFailed': '刷新失敗: {message}',
    'status.autoConnectFailed': '自動連線失敗: {message}',
    'status.needSupabaseConfig': '請先輸入 Supabase 連線設定',
    'error.apiNotJson': '伺服器回應不是 JSON（HTTP {status}）',
    'error.epcMust24Hex': 'EPC 必須為 24 碼 Hex 字串',
    'error.csvNeedsHeaderAndOneRow': 'CSV 至少需包含表頭與一筆資料',
    'error.invalidEpcRows': '發現 {count} 筆 EPC 格式不正確，請修正後再導入',
    'error.bulkImportFailed': '批量導入失敗',
    'error.bulkImportEmptyResponse': '批量導入失敗：伺服器回傳空內容',
    'error.simulateFailed': '事件送出失敗',
    'error.simulateEmptyResponse': '事件送出失敗：伺服器回傳空內容',
    'error.importFailed': '導入失敗：{message}',
    'error.trialImportForbidden': 'trial 角色不可匯入商品',
    'error.eventSendFailed': '送出失敗：{message}'
  },
  'zh-Hans': {
    'app.title': 'RFID 试衣间 PoC 后台',
    'language.label': '语言',
    'config.title': 'Supabase 连接设置',
    'config.saveAndConnect': '保存设置并连接',
    'dashboard.title': '商品状态看板',
    'board.title': '图像化模拟看板',
    'board.lanes': '货架 / 试衣间 / 结账柜台',
    'board.completeSale': '完成销售',
    'board.soldTag': '已售出',
    'dashboard.refresh': '手动刷新',
    'dashboard.empty': '无数据',
    'dashboard.unnamedProduct': '未命名商品',
    'dashboard.abnormalStay': '异常停留',
    'import.title': 'CSV 批量导入商品',
    'import.fieldsHint': '字段：',
    'import.submit': '上传并导入',
    'import.notStarted': '尚未导入',
    'simulate.title': '模拟 RFID 事件',
    'simulate.submit': '发送事件',
    'simulate.notSent': '尚未发送',
    'events.title': '最新事件记录',
    'events.epc': 'EPC',
    'events.eventType': '事件类型',
    'events.fromZone': '来源区域',
    'events.toZone': '目标区域',
    'events.time': '时间',
    'kpi.total': '商品总数',
    'kpi.fitting': '试穿中',
    'kpi.abnormal': '异常停留',
    'kpi.checkout': '结账柜台',
    'kpi.sold': '已售出',
    'kpi.todayFitting': '今日试穿次数',
    'kpi.todaySales': '今日成交件数',
    'kpi.conversionRate': '今日转化率',
    'mode.label': '运行模式',
    'mode.demo': 'Demo',
    'mode.operational': '运营',
    'mode.thresholdLabel': '异常停留阈值（分钟）',
    'restock.title': '补货建议（固定规则）',
    'restock.empty': '当前无补货建议',
    'restock.row': '{name} / 7日售出={sold7d} / 库存={stock} / 建议={qty}',
    'timeline.title': '最近动作',
    'timeline.dragAction': '{name}: {from} → {to}',
    'backup.title': '备援 / 测试工具',
    'backup.hint': '以下工具为二级界面，供维护与测试使用。',
    'backup.summary': '展开二级工具'
  },
  ja: {
    'app.title': 'RFID試着室 PoC ダッシュボード',
    'language.label': '言語',
    'config.title': 'Supabase 接続設定',
    'config.saveAndConnect': '保存して接続',
    'dashboard.title': '商品ステータスボード',
    'board.title': 'ビジュアルシミュレーションボード',
    'board.lanes': 'ラック / 試着室 / レジ',
    'board.completeSale': '販売完了',
    'board.soldTag': '販売済み',
    'dashboard.refresh': '更新',
    'dashboard.empty': 'データなし',
    'dashboard.unnamedProduct': '未命名商品',
    'dashboard.abnormalStay': '異常滞在',
    'import.title': 'CSV 商品一括インポート',
    'import.fieldsHint': '項目:',
    'import.submit': 'アップロードしてインポート',
    'import.notStarted': '未インポート',
    'simulate.title': 'RFIDイベント模擬送信',
    'simulate.submit': 'イベント送信',
    'simulate.notSent': '未送信',
    'events.title': '最新イベントログ',
    'events.epc': 'EPC',
    'events.eventType': 'イベント種別',
    'events.fromZone': '遷移元ゾーン',
    'events.toZone': '遷移先ゾーン',
    'events.time': '時刻',
    'kpi.total': '商品総数',
    'kpi.fitting': '試着中',
    'kpi.abnormal': '異常滞在',
    'kpi.checkout': 'レジ',
    'kpi.sold': '販売済み',
    'kpi.todayFitting': '本日の試着セッション数',
    'kpi.todaySales': '本日の販売件数',
    'kpi.conversionRate': '本日の転換率',
    'mode.label': '運用モード',
    'mode.demo': 'Demo',
    'mode.operational': 'Operational',
    'mode.thresholdLabel': '滞在異常しきい値（分）',
    'restock.title': '補充提案（固定ルール）',
    'restock.empty': '補充提案はありません',
    'restock.row': '{name} / 7日販売={sold7d} / 在庫={stock} / 提案={qty}',
    'timeline.title': '最近の操作',
    'timeline.dragAction': '{name}: {from} → {to}',
    'backup.title': 'バックアップ / テストツール',
    'backup.hint': '以下は保守・テスト用の二次ツールです。',
    'backup.summary': '二次ツールを開く'
  }
};

function t(key, params = {}) {
  const langPack = I18N[currentLang] || I18N[DEFAULT_LANG];
  const template = langPack[key] ?? I18N[DEFAULT_LANG][key] ?? key;
  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replaceAll(`{${paramKey}}`, String(value ?? '')),
    template
  );
}

function applyI18nToStaticText() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (!key) return;
    node.textContent = t(key);
  });

  document.documentElement.lang = currentLang;
  document.title = t('app.title');
}

function getCurrentLang() {
  const stored = localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
  return SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG;
}

function getCurrentMode() {
  const stored = localStorage.getItem(MODE_KEY) || DEFAULT_MODE;
  return SUPPORTED_MODES.includes(stored) ? stored : DEFAULT_MODE;
}

function modeThresholdStorageKey(mode) {
  return mode === 'operational' ? OVERSTAY_OPERATIONAL_KEY : OVERSTAY_DEMO_KEY;
}

function getModeThresholdMinutes(mode) {
  const fallback = MODE_DEFAULT_THRESHOLDS[mode] || MODE_DEFAULT_THRESHOLDS.demo;
  const raw = Number(localStorage.getItem(modeThresholdStorageKey(mode)));
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.floor(raw);
}

function setModeThresholdMinutes(mode, minutes) {
  const safe = Math.max(1, Math.floor(Number(minutes) || 1));
  localStorage.setItem(modeThresholdStorageKey(mode), String(safe));
}

function getCurrentOverstayThresholdMinutes() {
  return getModeThresholdMinutes(currentMode);
}

function getCurrentOverstayThresholdMs() {
  return getCurrentOverstayThresholdMinutes() * 60 * 1000;
}

function applyModeUiFromState() {
  if (el.modeSelect) el.modeSelect.value = currentMode;
  if (el.overstayThresholdMinutes) {
    el.overstayThresholdMinutes.value = String(getCurrentOverstayThresholdMinutes());
  }
}

function populateLanguageSelect() {
  if (!el.languageSelect) return;

  const options = [
    { value: 'en', label: '🇺🇸 English' },
    { value: 'zh-Hant', label: '🇹🇼 繁體中文' },
    { value: 'zh-Hans', label: '🇨🇳 简体中文' },
    { value: 'ja', label: '🇯🇵 日本語' }
  ];

  el.languageSelect.innerHTML = options
    .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
    .join('');

  el.languageSelect.value = currentLang;
}

console.log('[boot] main.js loaded');

function setStatus(text, level = 'warn') {
  if (!el.connectionStatus) {
    console.error('[dom] #connectionStatus not found');
    return;
  }
  el.connectionStatus.textContent = text;
  el.connectionStatus.classList.remove('text-ok', 'text-warn', 'text-err');
  el.connectionStatus.classList.add(`text-${level}`);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isValidEpcData(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
}

function getApiAuthHeaders() {
  const apiToken = (localStorage.getItem(API_TOKEN_KEY) || '').trim();
  const userRole = normalizeUserRole(localStorage.getItem(USER_ROLE_KEY));
  const headers = {};

  if (apiToken) headers['x-api-token'] = apiToken;
  if (userRole) headers['x-user-role'] = userRole;
  return headers;
}

function buildJsonHeaders() {
  return {
    'Content-Type': 'application/json',
    ...getApiAuthHeaders()
  };
}

function getApiErrorMessage(data, fallbackMessage) {
  if (data && typeof data === 'object') {
    const serverMessage = data.error || data.message;
    if (serverMessage) return String(serverMessage);
  }
  return fallbackMessage;
}

async function parseApiResponse(response, tag) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  console.log(`[api:${tag}] response`, {
    status: response.status,
    statusText: response.statusText,
    contentType,
    rawPreview: rawText.slice(0, 300)
  });

  if (!rawText) {
    return { data: null, contentType, rawText };
  }

  try {
    const data = JSON.parse(rawText);
    return { data, contentType, rawText };
  } catch (error) {
    console.error(`[api:${tag}] JSON parse failed`, error);
    throw new Error(t('error.apiNotJson', { status: response.status }));
  }
}

function decodeSGTIN96(hex) {
  const normalized = String(hex || '').trim();
  if (!isValidEpcData(normalized)) {
    throw new Error(t('error.epcMust24Hex'));
  }

  const binary = BigInt(`0x${normalized}`).toString(2).padStart(96, '0');
  const companyPrefixBin = binary.substring(14, 38);
  const itemReferenceBin = binary.substring(38, 58);
  const serialBin = binary.substring(58, 96);

  return {
    companyPrefix: parseInt(companyPrefixBin, 2).toString(),
    itemReference: parseInt(itemReferenceBin, 2).toString(),
    serial: BigInt(`0b${serialBin}`).toString()
  };
}

function csvToRows(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error(t('error.csvNeedsHeaderAndOneRow'));
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line, index) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    row.__line = index + 2;
    return row;
  });
}

function normalizeStateByReader(readerId) {
  const id = String(readerId || '').toUpperCase();
  if (id.includes('FITTING')) return 'FITTING_ROOM';
  if (id.includes('CHECKOUT')) return 'CHECKOUT';
  if (id.includes('SOLD')) return 'SOLD';
  if (id.includes('RACK')) return 'RACK';
  return 'RACK';
}

function normalizeStateFromEvent(event = {}) {
  const eventType = String(event.event_type || '').toLowerCase();
  const toZone = String(event.to_zone || '').toLowerCase();

  if (eventType === 'sale_completed' || toZone === 'sold') return 'SOLD';
  if (eventType === 'move_to_checkout' || toZone === 'checkout') return 'CHECKOUT';
  if (eventType === 'enter_fitting_room' || toZone === 'fitting_room') return 'FITTING_ROOM';

  // left_fitting_room / exit_fitting_room / return_to_sales_floor 都視為回到賣場（RACK）
  if (
    eventType === 'left_fitting_room'
    || eventType === 'exit_fitting_room'
    || eventType === 'return_to_sales_floor'
    || toZone === 'sales_floor'
  ) {
    return 'RACK';
  }

  return normalizeStateByReader(event.reader_id);
}

function normalizeProductKey(prefix, itemRef) {
  const p = String(prefix ?? '').trim();
  const i = String(itemRef ?? '').trim();
  if (!p || !i) return null;
  return `${p}::${i}`;
}

function productKeyFromProduct(product = {}) {
  return normalizeProductKey(product.epc_company_prefix, product.item_reference);
}

function productKeyFromEvent(event = {}) {
  try {
    const decoded = decodeSGTIN96(event.epc_data);
    return normalizeProductKey(decoded.companyPrefix, decoded.itemReference);
  } catch {
    return null;
  }
}

function buildLatestStateMap(events = []) {
  const map = new Map();
  events.forEach((event) => {
    const key = productKeyFromEvent(event);
    if (!key) return;
    const current = map.get(key);
    if (!current || new Date(event.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      map.set(key, event);
    }
  });
  return map;
}

function buildPresenceMap(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    if (row?.product_key) {
      map.set(row.product_key, row);
    }
  });
  return map;
}

function deriveStateByPresence(productKey, latestEvent, presence, nowMs, overstayMs) {
  if (presence) {
    const lastSeenMs = Date.parse(presence.last_seen_at);
    const enteredMs = Date.parse(presence.entered_at);
    if (Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= FITTING_EXIT_TIMEOUT_MS) {
      const abnormal = Number.isFinite(enteredMs) && nowMs - enteredMs >= overstayMs;
      return { state: 'FITTING_ROOM', abnormal };
    }
    return { state: 'RACK', abnormal: false };
  }

  // Fitting 狀態改為「僅由 presence 決定」：
  // 當 presence 不存在時，即使最新事件是 FITTING，也視為已離場回 RACK。
  const stateFromEvent = latestEvent ? normalizeStateFromEvent(latestEvent) : 'RACK';
  const state = stateFromEvent === 'FITTING_ROOM' ? 'RACK' : stateFromEvent;
  return { state, abnormal: false };
}

function computeKpiMetrics({ grouped, sessions, saleEvents }) {
  const totalItems = Object.values(grouped).reduce((acc, rows) => acc + rows.length, 0);
  const fittingItems = grouped.FITTING_ROOM.length;
  const abnormalItems = grouped.FITTING_ROOM.filter((item) => item.abnormal).length;
  const checkoutItems = grouped.CHECKOUT.filter((item) => !item.sold).length;
  const soldItems = grouped.CHECKOUT.filter((item) => item.sold).length;

  const todayFitting = Array.isArray(sessions) ? sessions.length : 0;
  const todaySales = Array.isArray(saleEvents) ? saleEvents.length : 0;
  const convertedSessions = Array.isArray(sessions)
    ? sessions.filter((session) => session?.converted_to_sale).length
    : 0;
  const conversionRate = todayFitting > 0 ? (convertedSessions / todayFitting) * 100 : 0;

  return { totalItems, fittingItems, abnormalItems, checkoutItems, soldItems, todayFitting, todaySales, conversionRate };
}

function computeRestockSuggestions(products = [], sales7d = [], inventoryRows = []) {
  const soldCountByEpc = new Map();
  sales7d.forEach((row) => {
    const epc = String(row?.epc_data || '').trim();
    if (!epc) return;
    soldCountByEpc.set(epc, (soldCountByEpc.get(epc) || 0) + 1);
  });

  const stockByProductId = new Map();
  inventoryRows.forEach((row) => {
    const productId = row?.product_id;
    if (productId == null) return;
    const status = String(row?.status || '').toUpperCase();
    const isAvailable = !status || status === 'ACTIVE' || status === 'IN_STOCK';
    if (!isAvailable) return;
    stockByProductId.set(productId, (stockByProductId.get(productId) || 0) + 1);
  });

  return products
    .map((product) => {
      const epc = String(product?.epc_data || '').trim();
      const sold7d = epc ? (soldCountByEpc.get(epc) || 0) : 0;
      const currentStock = stockByProductId.get(product?.id) || 0;
      const suggestedQty = Math.max(0, Math.ceil(sold7d * 1.2 - currentStock));
      return {
        product,
        sold7d,
        currentStock,
        suggestedQty
      };
    })
    .filter((row) => row.suggestedQty > 0)
    .sort((a, b) => b.suggestedQty - a.suggestedQty)
    .slice(0, 20);
}

function renderDashboard(products, latestEventMap, presenceMap, todaySessions = [], todaySaleEvents = [], sales7d = [], inventoryRows = []) {
  lastRenderContext = { products, latestEventMap, presenceMap, todaySessions, todaySaleEvents, sales7d, inventoryRows };
  const grouped = Object.fromEntries(BOARD_STATES.map((s) => [s, []]));

  const missingKeyProducts = products.filter((product) => !productKeyFromProduct(product));
  if (missingKeyProducts.length > 0) {
    console.warn('[dashboard] products missing key columns (epc_company_prefix/item_reference), state matching may fail', {
      missingCount: missingKeyProducts.length,
      sample: missingKeyProducts.slice(0, 3).map((p) => ({
        id: p.id,
        name: p.name,
        epc_company_prefix: p.epc_company_prefix,
        item_reference: p.item_reference
      }))
    });
  }

  const nowMs = Date.now();
  const overstayMs = getCurrentOverstayThresholdMs();
  const overstayMinutes = getCurrentOverstayThresholdMinutes();
  const debugStateRows = [];

  products.forEach((product) => {
    const productKey = productKeyFromProduct(product);
    const event = latestEventMap.get(productKey);
    const presence = productKey ? presenceMap.get(productKey) : null;
    const { state: rawState, abnormal: rawAbnormal } = deriveStateByPresence(productKey, event, presence, nowMs, overstayMs);
    const overrideState = productKey ? localLaneOverrides.get(productKey) : null;
    const state = overrideState || (rawState === 'SOLD' ? 'CHECKOUT' : rawState);
    const normalizedState = BOARD_STATES.includes(state) ? state : 'RACK';
    const abnormal = normalizedState === 'FITTING_ROOM' ? rawAbnormal : false;
    const sold = rawState === 'SOLD' || event?.event_type === 'sale_completed';
    grouped[normalizedState].push({ product, event, abnormal, state: normalizedState, productKey, sold });

    debugStateRows.push({
      productKey,
      name: product.display_name || product.name_en || product.name || null,
      state: normalizedState,
      abnormal,
      lastReader: event?.reader_id || null,
      presenceLastSeen: presence?.last_seen_at || null,
      presenceEnteredAt: presence?.entered_at || null
    });
  });

  console.table(debugStateRows.slice(0, 20));

  const {
    totalItems,
    fittingItems,
    abnormalItems,
    checkoutItems,
    soldItems,
    todayFitting,
    todaySales,
    conversionRate
  } = computeKpiMetrics({ grouped, sessions: todaySessions, saleEvents: todaySaleEvents });
  if (el.kpiTotal) el.kpiTotal.textContent = String(totalItems);
  if (el.kpiFitting) el.kpiFitting.textContent = String(fittingItems);
  if (el.kpiAbnormal) el.kpiAbnormal.textContent = String(abnormalItems);
  if (el.kpiCheckout) el.kpiCheckout.textContent = String(checkoutItems);
  if (el.kpiSold) el.kpiSold.textContent = String(soldItems);
  if (el.kpiTodayFitting) el.kpiTodayFitting.textContent = String(todayFitting);
  if (el.kpiTodaySales) el.kpiTodaySales.textContent = String(todaySales);
  if (el.kpiConversionRate) el.kpiConversionRate.textContent = `${conversionRate.toFixed(1)}%`;

  if (el.restockList) {
    const suggestions = computeRestockSuggestions(products, sales7d, inventoryRows);
    if (suggestions.length === 0) {
      el.restockList.innerHTML = `<li class="hint">${escapeHtml(t('restock.empty'))}</li>`;
    } else {
      el.restockList.innerHTML = suggestions
        .map(({ product, sold7d, currentStock, suggestedQty }) => {
          const displayName = product.display_name || product.name_en || product.name || t('dashboard.unnamedProduct');
          return `
            <li class="restock-row">
              <span>${escapeHtml(t('restock.row', {
                name: displayName,
                sold7d,
                stock: currentStock,
                qty: suggestedQty
              }))}</span>
              <strong class="text-warn">+${escapeHtml(String(suggestedQty))}</strong>
            </li>
          `;
        })
        .join('');
    }
  }

  el.dashboard.innerHTML = BOARD_STATES.map((state) => {
    const cards = grouped[state]
      .map(({ product, event, abnormal, productKey }) => {
        const displayName = product.display_name || product.name_en || product.name || t('dashboard.unnamedProduct');
        const isSold = String(event?.reader_id || '').toUpperCase().includes('SOLD');
        const imageUrl = String(product.image_url || '').trim();
        const sku = String(product.sku || '-');
        return `
          <article class="product-card product-card--scene" draggable="true" data-product-key="${escapeHtml(productKey || '')}" data-current-state="${escapeHtml(state)}">
            ${imageUrl
              ? `<img class="product-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(displayName)}" loading="lazy" />`
              : `<div class="product-image product-image--placeholder" aria-hidden="true">${escapeHtml(sku)}</div>`}
            <p class="product-sku-badge">${t('dashboard.sku')}: ${escapeHtml(sku)}</p>
            <p class="product-title">${escapeHtml(displayName)}</p>
            ${isSold ? `<p class="text-ok"><strong>${t('board.soldTag')}</strong></p>` : ''}
            ${abnormal ? `<p class="text-err"><strong>${t('dashboard.abnormalStay', { minutes: overstayMinutes })}</strong></p>` : ''}
            ${state === 'CHECKOUT' && !isSold
              ? `<button type="button" class="sale-button" data-product-key="${escapeHtml(productKey || '')}">${t('board.completeSale')}</button>`
              : ''}
          </article>
        `;
      })
      .join('');

    return `
      <section class="state-column state-column--${escapeHtml(state)}" data-state="${escapeHtml(state)}">
        <header class="state-column-header">
          <h3 class="state-title">${t(`state.${state}`)}</h3>
          <span class="state-count">${grouped[state].length}</span>
        </header>
        <div class="zone-drop-area">
          ${cards || `<p class="hint">${t('dashboard.empty')}</p>`}
        </div>
      </section>
    `;
  }).join('');
}

function renderProductDetailOverlay({ product, state, event }) {
  if (!el.itemDetailOverlay || !el.itemDetailBody) return;

  const imageUrl = String(product?.image_url || '').trim();
  const displayName = product?.display_name || product?.name_en || product?.name || t('dashboard.unnamedProduct');
  const sku = String(product?.sku || '-');
  const epc = String(product?.epc_data || '-');
  const zoneLabel = t(`state.${state || 'RACK'}`);
  const status = event?.event_type || '-';

  el.itemDetailBody.innerHTML = `
    <div class="item-detail-media">
      ${imageUrl
        ? `<img class="item-detail-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(displayName)}" loading="lazy" />`
        : `<div class="item-detail-image item-detail-image--placeholder">${escapeHtml(sku)}</div>`}
    </div>
    <div class="item-detail-grid">
      <p><strong>${t('detail.name')}:</strong> ${escapeHtml(displayName)}</p>
      <p><strong>${t('detail.sku')}:</strong> ${escapeHtml(sku)}</p>
      <p><strong>${t('detail.epc')}:</strong> ${escapeHtml(epc)}</p>
      <p><strong>${t('detail.zone')}:</strong> ${escapeHtml(zoneLabel)}</p>
      <p><strong>${t('detail.status')}:</strong> ${escapeHtml(status)}</p>
    </div>
  `;

  el.itemDetailOverlay.hidden = false;
}

function appendActivityLog({ name, fromState, toState }) {
  if (!el.activityTimeline) return;
  const li = document.createElement('li');
  li.innerHTML = `
    <div><strong>${escapeHtml(t('timeline.dragAction', {
      name,
      from: t(`state.${fromState}`),
      to: t(`state.${toState}`)
    }))}</strong></div>
    <div>${t('events.time')}: ${escapeHtml(new Date().toISOString())}</div>
  `;
  el.activityTimeline.prepend(li);
  while (el.activityTimeline.children.length > 20) {
    el.activityTimeline.removeChild(el.activityTimeline.lastElementChild);
  }
}

function zoneFromBoardState(state) {
  if (state === 'FITTING_ROOM') return 'fitting_room';
  if (state === 'CHECKOUT') return 'checkout';
  if (state === 'SOLD') return 'sold';
  return 'sales_floor';
}

function readerFromBoardState(state) {
  if (state === 'FITTING_ROOM') return 'FITTING_ROOM_ANTENNA_1';
  if (state === 'CHECKOUT') return 'CHECKOUT_COUNTER_1';
  if (state === 'SOLD') return 'SOLD_COUNTER_1';
  return 'RACK_ZONE_1';
}

function eventTypeFromTransition(fromState, toState) {
  if (toState === 'SOLD') return 'sale_completed';
  if (toState === 'FITTING_ROOM') return 'enter_fitting_room';
  if (fromState === 'FITTING_ROOM' && toState === 'RACK') return 'exit_fitting_room';
  if (toState === 'CHECKOUT') return 'move_to_checkout';
  if (toState === 'RACK') return 'return_to_sales_floor';
  return 'tag_seen';
}

async function syncDragAction({ product, fromState, toState }) {
  if (!product?.epc_data || !isValidEpcData(product.epc_data)) {
    throw new Error(t('error.epcMust24Hex'));
  }

  const payload = {
    reader_id: readerFromBoardState(toState),
    epc_data: product.epc_data,
    event_type: eventTypeFromTransition(fromState, toState),
    event_source: 'demo_drag',
    from_zone: zoneFromBoardState(fromState),
    to_zone: zoneFromBoardState(toState)
  };

  setStatus(t('status.dragSyncing'), 'warn');
  const response = await fetch('/api/rfid-webhook', {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload)
  });

  const { data } = await parseApiResponse(response, 'drag-rfid-webhook');
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, t('error.simulateFailed')));
  }
  setStatus(t('status.dragSynced'), 'ok');
}

function rerenderFromCache() {
  if (!lastRenderContext) return;
  renderDashboard(
    lastRenderContext.products,
    lastRenderContext.latestEventMap,
    lastRenderContext.presenceMap,
    lastRenderContext.todaySessions || [],
    lastRenderContext.todaySaleEvents || [],
    lastRenderContext.sales7d || [],
    lastRenderContext.inventoryRows || []
  );
}

function bindBoardDnD() {
  if (!el.dashboard) return;

  el.dashboard.addEventListener('click', async (event) => {
    const card = event.target.closest('.product-card');
    const button = event.target.closest('.sale-button');

    if (card && !button) {
      const productKey = card.dataset.productKey;
      const state = card.dataset.currentState || 'RACK';
      const product = (lastRenderContext?.products || []).find((item) => productKeyFromProduct(item) === productKey);
      const eventRow = lastRenderContext?.latestEventMap?.get(productKey);
      if (product) {
        renderProductDetailOverlay({ product, state, event: eventRow });
      }
      return;
    }

    if (!button) return;

    const productKey = button.dataset.productKey;
    if (!productKey) return;

    const product = (lastRenderContext?.products || []).find((item) => productKeyFromProduct(item) === productKey);
    const saleCard = el.dashboard.querySelector(`.product-card[data-product-key="${CSS.escape(productKey)}"]`);
    const productName =
      saleCard?.querySelector('.product-title')?.textContent
      || product?.display_name
      || product?.name_en
      || product?.name
      || productKey;

    try {
      await syncDragAction({ product, fromState: 'CHECKOUT', toState: 'SOLD' });
      appendActivityLog({ name: productName, fromState: 'CHECKOUT', toState: 'SOLD' });
      await fetchAndRenderDashboard();
    } catch (error) {
      setStatus(t('status.dragSyncFailed', { message: error.message }), 'err');
    }
  });

  el.dashboard.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.product-card');
    if (!card) return;
    const productKey = card.dataset.productKey;
    if (!productKey) return;
    dragProductKey = productKey;
    card.classList.add('is-dragging');
    event.dataTransfer?.setData('text/plain', productKey);
    event.dataTransfer.effectAllowed = 'move';
  });

  el.dashboard.addEventListener('dragend', (event) => {
    const card = event.target.closest('.product-card');
    if (card) card.classList.remove('is-dragging');
    dragProductKey = null;
    el.dashboard.querySelectorAll('.state-column.is-drop-active').forEach((node) => node.classList.remove('is-drop-active'));
  });

  el.dashboard.addEventListener('dragover', (event) => {
    const column = event.target.closest('.state-column');
    if (!column) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  });

  el.dashboard.addEventListener('dragenter', (event) => {
    const column = event.target.closest('.state-column');
    if (!column) return;
    column.classList.add('is-drop-active');
  });

  el.dashboard.addEventListener('dragleave', (event) => {
    const column = event.target.closest('.state-column');
    if (!column) return;
    if (!column.contains(event.relatedTarget)) {
      column.classList.remove('is-drop-active');
    }
  });

  el.dashboard.addEventListener('drop', async (event) => {
    const column = event.target.closest('.state-column');
    if (!column) return;
    event.preventDefault();

    const toState = column.dataset.state;
    const productKey = dragProductKey || event.dataTransfer?.getData('text/plain');
    if (!toState || !productKey) return;

    const card = el.dashboard.querySelector(`.product-card[data-product-key="${CSS.escape(productKey)}"]`);
    const fromState = card?.dataset.currentState || 'RACK';
    if (fromState === toState) return;

    const product = (lastRenderContext?.products || []).find((item) => productKeyFromProduct(item) === productKey);

    localLaneOverrides.set(productKey, toState);
    const productName = card?.querySelector('strong')?.textContent || productKey;
    appendActivityLog({ name: productName, fromState, toState });
    rerenderFromCache();

    try {
      await syncDragAction({ product, fromState, toState });
      await fetchAndRenderDashboard();
    } catch (error) {
      localLaneOverrides.set(productKey, fromState);
      rerenderFromCache();
      setStatus(t('status.dragSyncFailed', { message: error.message }), 'err');
    }
  });
}

function safeDecode(epc) {
  try {
    return decodeSGTIN96(epc);
  } catch {
    return null;
  }
}

function appendEventLog(payload) {
  if (!el.eventLog) {
    console.error('[dom] #eventLog not found, skip appendEventLog');
    return;
  }
  const li = document.createElement('li');
  li.innerHTML = `
    <div><strong>${escapeHtml(payload.reader_id || t('events.unknownReader'))}</strong></div>
    <div>${t('events.epc')}: ${escapeHtml(payload.epc_data || '-')}</div>
    <div>${t('events.eventType')}: ${escapeHtml(payload.event_type || '-')}</div>
    <div>${t('events.fromZone')}: ${escapeHtml(payload.from_zone || '-')}</div>
    <div>${t('events.toZone')}: ${escapeHtml(payload.to_zone || '-')}</div>
    <div>${t('events.time')}: ${escapeHtml(payload.timestamp || new Date().toISOString())}</div>
  `;
  el.eventLog.prepend(li);
  while (el.eventLog.children.length > 20) {
    el.eventLog.removeChild(el.eventLog.lastElementChild);
  }
}

async function fetchAndRenderDashboard() {
  if (!supabase) {
    setStatus(t('status.notConnected'), 'warn');
    console.warn('[dashboard] supabase client not ready', {
      hasClient: !!supabase,
      savedUrl: localStorage.getItem(URL_KEY) || null,
      hasAnonKey: !!(localStorage.getItem(ANON_KEY) || '')
    });
    return;
  }

  if (!el.dashboard) {
    console.error('[dom] #dashboard not found, skip render');
    return;
  }

  setStatus(t('status.loading'), 'warn');
  console.log('[dashboard] start fetching products + rfid_events');

  const sevenDaysAgoIso = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();

  const [productsRes, eventsRes, translationsRes, presenceRes, todaySessionsRes, todaySalesRes, sales7dRes, inventoryRes] = await Promise.all([
    supabase.from('products').select('*').order('id', { ascending: true }),
    supabase.from('rfid_events').select('epc_data,reader_id,timestamp,event_type,event_source,from_zone,to_zone').order('timestamp', { ascending: false }).limit(500),
    supabase.from('product_translations').select('product_id,locale,name,description').eq('locale', currentLang),
    supabase.from('fitting_room_presence').select('product_key,entered_at,last_seen_at,last_reader_id'),
    supabase.from('fitting_room_sessions').select('id,converted_to_sale').gte('entered_at', todayStartIso()),
    supabase.from('rfid_events').select('id').eq('event_type', 'sale_completed').gte('timestamp', todayStartIso()),
    supabase.from('rfid_events').select('epc_data').eq('event_type', 'sale_completed').gte('timestamp', sevenDaysAgoIso),
    supabase.from('inventory_items').select('product_id,status,epc_data')
  ]);

  if (productsRes.error) {
    console.error('[dashboard] products query failed:', productsRes.error);
    throw productsRes.error;
  }
  if (eventsRes.error) {
    if (eventsRes.error.code === '42703') {
      const fallbackEventsRes = await supabase
        .from('rfid_events')
        .select('epc_data,reader_id,timestamp')
        .order('timestamp', { ascending: false })
        .limit(500);
      if (fallbackEventsRes.error) {
        console.error('[dashboard] rfid_events fallback query failed:', fallbackEventsRes.error);
        throw fallbackEventsRes.error;
      }
      eventsRes.data = fallbackEventsRes.data;
    } else {
      console.error('[dashboard] rfid_events query failed:', eventsRes.error);
      throw eventsRes.error;
    }
  }
  if (translationsRes.error) {
    console.error('[dashboard] product_translations query failed:', translationsRes.error);
    throw translationsRes.error;
  }

  // Note: fitting_room_presence may not exist in older environments before migration.
  // Keep dashboard query resilient by falling back to empty presence map.
  const safePresenceRows = (() => {
    if (!presenceRes?.error) return presenceRes?.data || [];
    console.warn('[dashboard] fitting_room_presence query skipped', {
      code: presenceRes.error.code,
      message: presenceRes.error.message
    });
    return [];
  })();

  const translationMap = new Map((translationsRes.data || []).map((row) => [row.product_id, row]));
  const localizedProducts = (productsRes.data || []).map((product) => {
    const tr = translationMap.get(product.id);
    return {
      ...product,
      display_name: tr?.name || product.name_en || product.name || null,
      display_description: tr?.description || product.description_en || null
    };
  });

  const latestMap = buildLatestStateMap(eventsRes.data || []);
  const presenceMap = buildPresenceMap(safePresenceRows);
  const safeTodaySessions = todaySessionsRes?.error ? [] : (todaySessionsRes?.data || []);
  const safeTodaySales = todaySalesRes?.error ? [] : (todaySalesRes?.data || []);
  const safeSales7d = sales7dRes?.error ? [] : (sales7dRes?.data || []);
  const safeInventoryRows = inventoryRes?.error ? [] : (inventoryRes?.data || []);
  console.log('[dashboard] key matching preview', {
    productKeySample: (productsRes.data || []).slice(0, 5).map((p) => productKeyFromProduct(p)),
    eventKeySample: (eventsRes.data || []).slice(0, 5).map((e) => productKeyFromEvent(e))
  });
  renderDashboard(localizedProducts, latestMap, presenceMap, safeTodaySessions, safeTodaySales, safeSales7d, safeInventoryRows);
  console.log('[dashboard] render success', {
    products: localizedProducts.length,
    events: (eventsRes.data || []).length
  });
  setStatus(t('status.connected'), 'ok');
}

// backward compatibility for existing call sites
const loadDashboardData = fetchAndRenderDashboard;

async function connectSupabase(url, anonKey) {
  if (subscription) {
    await subscription.unsubscribe();
    subscription = null;
  }

  supabase = createClient(url, anonKey);
  console.log('[supabase] client created', {
    urlHost: (() => {
      try {
        return new URL(url).host;
      } catch {
        return 'INVALID_URL';
      }
    })(),
    anonKeyLength: anonKey?.length || 0
  });

  subscription = supabase
    .channel('rfid-events-insert')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rfid_events' }, async (payload) => {
      console.log('[realtime] INSERT rfid_events', { epc_data: payload?.new?.epc_data, payload });
      appendEventLog(payload.new);
      try {
        await fetchAndRenderDashboard();
      } catch (error) {
        setStatus(t('status.realtimeUpdateFailed', { message: error.message }), 'err');
      }
    })
    .subscribe((status) => {
      console.log('[realtime] channel status:', status);
      if (status === 'SUBSCRIBED') {
        setStatus(t('status.realtimeSubscribed'), 'ok');
      }
    });

  await fetchAndRenderDashboard();
}

async function handleConfigSubmit(event) {
  event.preventDefault();

  const url = el.supabaseUrl.value.trim();
  const anonKey = el.supabaseAnonKey.value.trim();
  const apiToken = (el.apiToken?.value || '').trim();
  const userRole = normalizeUserRole(el.userRole?.value);

  try {
    localStorage.setItem(URL_KEY, url);
    localStorage.setItem(ANON_KEY, anonKey);
    localStorage.setItem(API_TOKEN_KEY, apiToken);
    localStorage.setItem(USER_ROLE_KEY, userRole);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, anonKey }));
    await connectSupabase(url, anonKey);
  } catch (error) {
    setStatus(t('status.connectionFailed', { message: error.message }), 'err');
  }
}

async function handleCsvImport(event) {
  event.preventDefault();
  const currentRole = normalizeUserRole(localStorage.getItem(USER_ROLE_KEY));
  if (currentRole === 'trial') {
    el.importResult.textContent = t('error.trialImportForbidden');
    return;
  }

  const file = el.csvFile.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rows = csvToRows(text);
    const badRows = rows.filter((row) => !row.epc_data || !/^[a-fA-F0-9]{24}$/.test(row.epc_data));
    if (badRows.length > 0) {
      throw new Error(t('error.invalidEpcRows', { count: badRows.length }));
    }

    console.log('[csv] start import', {
      rowsCount: rows.length,
      firstRow: rows[0] || null,
      hasSupabaseClient: !!supabase,
      currentFrontendSupabaseUrl: localStorage.getItem(URL_KEY) || null
    });

    const response = await fetch('/api/bulk-products', {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ rows })
    });

    const { data: result } = await parseApiResponse(response, 'bulk-products');
    if (!response.ok) {
      throw new Error(getApiErrorMessage(result, t('error.bulkImportFailed')));
    }
    if (!result) {
      throw new Error(t('error.bulkImportEmptyResponse'));
    }

    console.log('[csv] bulk import success', {
      affected: result.affected,
      mode: result.mode,
      itemsReturned: Array.isArray(result.items) ? result.items.length : null,
      serverTargetSupabaseHost: result?.debug?.targetSupabaseHost || null
    });

    el.importResult.textContent = JSON.stringify(result, null, 2);
    if (!supabase) {
      console.warn('[csv] imported successfully but dashboard refresh cannot query DB because supabase client is not connected');
    }
    await fetchAndRenderDashboard();
  } catch (error) {
    el.importResult.textContent = t('error.importFailed', { message: error.message });
  }
}

async function handleSimulateSubmit(event) {
  event.preventDefault();
  const readerId = el.simulateForm.reader_id.value.trim();
  const epcData = el.simulateForm.epc_data.value.trim();

  try {
    if (!isValidEpcData(epcData)) {
      throw new Error(t('error.epcMust24Hex'));
    }

    console.log('[simulate] send webhook', { readerId, epcData });

    const response = await fetch('/api/rfid-webhook', {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ reader_id: readerId, epc_data: epcData })
    });

    const { data: result } = await parseApiResponse(response, 'rfid-webhook');
    if (!response.ok) {
      throw new Error(getApiErrorMessage(result, t('error.simulateFailed')));
    }
    if (!result) {
      throw new Error(t('error.simulateEmptyResponse'));
    }

    console.log('[simulate] webhook result detail', {
      productKey: result?.presence?.product_key || null,
      inFittingRoom: result?.presence?.in_fitting_room ?? null,
      product: result?.product || null
    });

    el.simulateResult.textContent = JSON.stringify(result, null, 2);
    await fetchAndRenderDashboard();
  } catch (error) {
    el.simulateResult.textContent = t('error.eventSendFailed', { message: error.message });
  }
}

function boot() {
  currentLang = getCurrentLang();
  currentMode = getCurrentMode();
  populateLanguageSelect();
  applyI18nToStaticText();
  applyModeUiFromState();

  console.log('[dom-check]', {
    dashboard: !!el.dashboard,
    eventLog: !!el.eventLog,
    connectionStatus: !!el.connectionStatus
  });

  if (!el.dashboard || !el.eventLog || !el.connectionStatus) {
    console.error('[dom-check] required elements missing, abort boot');
    return;
  }

  if (el.languageSelect) {
    el.languageSelect.addEventListener('change', async (event) => {
      const nextLang = event.target.value;
      if (!SUPPORTED_LANGS.includes(nextLang)) return;
      currentLang = nextLang;
      localStorage.setItem(LANG_KEY, currentLang);
      applyI18nToStaticText();
      if (supabase) {
        try {
          await fetchAndRenderDashboard();
        } catch (error) {
          setStatus(t('status.refreshFailed', { message: error.message }), 'err');
        }
      }
    });
  }

  if (el.modeSelect) {
    el.modeSelect.addEventListener('change', async (event) => {
      const nextMode = event.target.value;
      if (!SUPPORTED_MODES.includes(nextMode)) return;
      currentMode = nextMode;
      localStorage.setItem(MODE_KEY, currentMode);
      applyModeUiFromState();
      rerenderFromCache();
      if (supabase) {
        try {
          await fetchAndRenderDashboard();
        } catch (error) {
          setStatus(t('status.refreshFailed', { message: error.message }), 'err');
        }
      }
    });
  }

  if (el.overstayThresholdMinutes) {
    el.overstayThresholdMinutes.addEventListener('change', async () => {
      setModeThresholdMinutes(currentMode, Number(el.overstayThresholdMinutes.value));
      applyModeUiFromState();
      rerenderFromCache();
      if (supabase) {
        try {
          await fetchAndRenderDashboard();
        } catch (error) {
          setStatus(t('status.refreshFailed', { message: error.message }), 'err');
        }
      }
    });
  }

  if (el.itemDetailClose && el.itemDetailOverlay) {
    el.itemDetailClose.addEventListener('click', () => {
      el.itemDetailOverlay.hidden = true;
    });

    el.itemDetailOverlay.addEventListener('click', (event) => {
      if (event.target === el.itemDetailOverlay) {
        el.itemDetailOverlay.hidden = true;
      }
    });
  }

  el.configForm.addEventListener('submit', handleConfigSubmit);
  el.csvImportForm.addEventListener('submit', handleCsvImport);
  el.simulateForm.addEventListener('submit', handleSimulateSubmit);
  bindBoardDnD();
  el.refreshButton.addEventListener('click', async () => {
    try {
      await fetchAndRenderDashboard();
    } catch (error) {
      setStatus(t('status.refreshFailed', { message: error.message }), 'err');
    }
  });

  // preferred: read explicit keys from localStorage
  let url = localStorage.getItem(URL_KEY) || DEFAULT_SUPABASE_URL;
  let anonKey = localStorage.getItem(ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

  // fallback for old storage schema
  if (!url || !anonKey) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        url = url || parsed?.url || '';
        anonKey = anonKey || parsed?.anonKey || '';
      } catch {
        console.warn('[storage] malformed STORAGE_KEY payload');
      }
    }
  }

  el.supabaseUrl.value = url;
  el.supabaseAnonKey.value = anonKey;
  if (el.apiToken) {
    el.apiToken.value = (localStorage.getItem(API_TOKEN_KEY) || '').trim();
  }
  if (el.userRole) {
    const role = normalizeUserRole(localStorage.getItem(USER_ROLE_KEY));
    localStorage.setItem(USER_ROLE_KEY, role);
    el.userRole.value = role;
  }

  if (url && anonKey) {
    connectSupabase(url, anonKey).catch((error) => {
      setStatus(t('status.autoConnectFailed', { message: error.message }), 'err');
    });
    return;
  }

  setStatus(t('status.needSupabaseConfig'), 'warn');
}

boot();
