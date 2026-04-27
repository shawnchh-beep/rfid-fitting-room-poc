import { navigate, onRouteChange, startRouter, getCurrentPath } from './router.js';
import { setShellAuthVisibility, setShellViewByPath } from './app-shell.js';
import { STORAGE_KEYS, readStorage, writeStorage, readJsonStorage, writeJsonStorage } from './state/storage.js';
import { getAppState, setAppState } from './state/app-state.js';
import { createSupabaseClient, getSupabaseClient, resetSupabaseClient } from './services/supabase-service.js';

const STORAGE_KEY = STORAGE_KEYS.supabaseConfig;
const URL_KEY = STORAGE_KEYS.supabaseUrl;
const ANON_KEY = STORAGE_KEYS.supabaseAnonKey;
const LANG_KEY = STORAGE_KEYS.lang;
const MODE_KEY = STORAGE_KEYS.mode;
const PRODUCT_SUMMARY_VIEW_KEY = STORAGE_KEYS.productSummaryView;
const OVERSTAY_DEMO_KEY = STORAGE_KEYS.overstayDemoMinutes;
const OVERSTAY_OPERATIONAL_KEY = STORAGE_KEYS.overstayOperationalMinutes;
const SESSION_KEY = STORAGE_KEYS.session;
const DEFAULT_SUPABASE_URL = 'https://trgxtbqjkhydvbfndmhk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_RjeQR-HU84MRCpByTqZlxg_lwJHStMP';
const DEFAULT_LANG = 'en';
const DEFAULT_MODE = 'demo';
const DEFAULT_PRODUCT_SUMMARY_VIEW = 'nested';
const PRODUCT_SUMMARY_VIEWS = ['sku', 'nested'];
const MODE_DEFAULT_THRESHOLDS = {
  demo: 15,
  operational: 10
};
const SUPPORTED_LANGS = ['en', 'zh-Hant', 'zh-Hans', 'ja'];
const SUPPORTED_MODES = ['demo', 'operational'];
// Keep in sync with server-side timeout in api/rfid-webhook.js
const FITTING_EXIT_TIMEOUT_MS = 30_000;
const MAX_ACTIVITY_ITEMS = 20;
const STATES = ['RACK', 'FITTING_ROOM', 'CHECKOUT', 'SOLD'];
const BOARD_STATES = ['RACK', 'FITTING_ROOM', 'CHECKOUT'];
const SETTING_TABS = ['general', 'accounts', 'trials'];
const ADMIN_PAGE_SIZE = 20;
const SGTIN96_PARTITIONS = {
  0: { companyPrefixBits: 40, itemReferenceBits: 4, companyPrefixDigits: 12, itemReferenceDigits: 1 },
  1: { companyPrefixBits: 37, itemReferenceBits: 7, companyPrefixDigits: 11, itemReferenceDigits: 2 },
  2: { companyPrefixBits: 34, itemReferenceBits: 10, companyPrefixDigits: 10, itemReferenceDigits: 3 },
  3: { companyPrefixBits: 30, itemReferenceBits: 14, companyPrefixDigits: 9, itemReferenceDigits: 4 },
  4: { companyPrefixBits: 27, itemReferenceBits: 17, companyPrefixDigits: 8, itemReferenceDigits: 5 },
  5: { companyPrefixBits: 24, itemReferenceBits: 20, companyPrefixDigits: 7, itemReferenceDigits: 6 },
  6: { companyPrefixBits: 20, itemReferenceBits: 24, companyPrefixDigits: 6, itemReferenceDigits: 7 }
};

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
let lastSkuSummary = { rows: [], conflicts: [] };
let currentProductSummaryView = DEFAULT_PRODUCT_SUMMARY_VIEW;
let currentSettingTab = 'general';
const adminUserState = {
  page: 1,
  total: 0,
  loading: false,
  loaded: false,
  items: [],
  filters: {
    q: '',
    role: '',
    status: ''
  }
};
const adminTrialState = {
  page: 1,
  total: 0,
  loading: false,
  loaded: false,
  items: [],
  filters: {
    q: '',
    status: ''
  }
};

const el = {
  appShell: document.getElementById('appShell'),
  homeView: document.getElementById('homeView'),
  dashboardView: document.getElementById('dashboardView'),
  homeToDashboardTop: document.getElementById('homeToDashboardTop'),
  homeCardDashboard: document.getElementById('homeCardDashboard'),
  homeCardFittingDemo: document.getElementById('homeCardFittingDemo'),
  homeCardProduct: document.getElementById('homeCardProduct'),
  homeCardSetting: document.getElementById('homeCardSetting'),
  homeCardCsvImport: document.getElementById('homeCardCsvImport'),
  backToHome: document.getElementById('backToHome'),
  logoutButton: document.getElementById('logoutButton'),
  logoutButtonHome: document.getElementById('logoutButtonHome'),
  connectionStatus: document.getElementById('connectionStatus'),
  dashboard: document.getElementById('dashboard'),
  itemDetailOverlay: document.getElementById('itemDetailOverlay'),
  itemDetailBody: document.getElementById('itemDetailBody'),
  itemDetailClose: document.getElementById('itemDetailClose'),
  demoControlsToggle: document.getElementById('demoControlsToggle'),
  demoControlsDrawer: document.getElementById('demoControlsDrawer'),
  demoControlsBackdrop: document.getElementById('demoControlsBackdrop'),
  demoControlsClose: document.getElementById('demoControlsClose'),
  quickActionForm: document.getElementById('quickActionForm'),
  quickActionProduct: document.getElementById('quickActionProduct'),
  quickActionRoom: document.getElementById('quickActionRoom'),
  quickActionType: document.getElementById('quickActionType'),
  quickActionNote: document.getElementById('quickActionNote'),
  quickActionError: document.getElementById('quickActionError'),
  quickActionRun: document.getElementById('quickActionRun'),
  seedTodayData: document.getElementById('seedTodayData'),
  clearActiveAlerts: document.getElementById('clearActiveAlerts'),
  resetDemoData: document.getElementById('resetDemoData'),
  demoToastContainer: document.getElementById('demoToastContainer'),
  refreshButton: document.getElementById('refreshButton'),
  configForm: document.getElementById('configForm'),
  supabaseUrl: document.getElementById('supabaseUrl'),
  supabaseAnonKey: document.getElementById('supabaseAnonKey'),
  csvImportForm: document.getElementById('csvImportForm'),
  csvFile: document.getElementById('csvFile'),
  importResult: document.getElementById('importResult'),
  groupedCsvImportForm: document.getElementById('groupedCsvImportForm'),
  groupedCsvFile: document.getElementById('groupedCsvFile'),
  groupedPartition: document.getElementById('groupedPartition'),
  groupedFilter: document.getElementById('groupedFilter'),
  groupedPreviewResult: document.getElementById('groupedPreviewResult'),
  groupedImportResult: document.getElementById('groupedImportResult'),
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
  kpiOpportunityItems: document.getElementById('kpiOpportunityItems'),
  heroNarrative: document.getElementById('heroNarrative'),
  heroLiveStatus: document.getElementById('heroLiveStatus'),
  heroTrackingStatus: document.getElementById('heroTrackingStatus'),
  heroAiStatus: document.getElementById('heroAiStatus'),
  revenueImpactBody: document.getElementById('revenueImpactBody'),
  kpiMissedRevenue: document.getElementById('kpiMissedRevenue'),
  kpiPotentialUplift: document.getElementById('kpiPotentialUplift'),
  kpiTryOnToSaleRate: document.getElementById('kpiTryOnToSaleRate'),
  kpiTopLossDriver: document.getElementById('kpiTopLossDriver'),
  journeyFunnelBody: document.getElementById('journeyFunnelBody'),
  aiBusinessInsightBody: document.getElementById('aiBusinessInsightBody'),
  recommendedActionsBody: document.getElementById('recommendedActionsBody'),
  topOpportunitiesBody: document.getElementById('topOpportunitiesBody'),
  operationsAlertsBody: document.getElementById('operationsAlertsBody'),
  replenishmentRiskBody: document.getElementById('replenishmentRiskBody'),
  technicalBoardToggle: document.getElementById('technicalBoardToggle'),
  technicalBoardBody: document.getElementById('technicalBoardBody'),
  overviewSnapshotBody: document.getElementById('overviewSnapshotBody'),
  overviewAiSummaryBody: document.getElementById('overviewAiSummaryBody'),
  overviewOpportunityBody: document.getElementById('overviewOpportunityBody'),
  overviewAlertBody: document.getElementById('overviewAlertBody'),
  productSkuSummary: document.getElementById('productSkuSummary'),
  productSummaryViewSku: document.getElementById('productSummaryViewSku'),
  productSummaryViewNested: document.getElementById('productSummaryViewNested'),
  productStyleNoFilter: document.getElementById('productStyleNoFilter'),
  productItemNoFilter: document.getElementById('productItemNoFilter'),
  productFilterReset: document.getElementById('productFilterReset'),
  restockList: document.getElementById('restockList'),
  storyFunnelBody: document.getElementById('storyFunnelBody'),
  storyHourlyBody: document.getElementById('storyHourlyBody'),
  opsOpportunityBody: document.getElementById('opsOpportunityBody'),
  opsAlertBody: document.getElementById('opsAlertBody'),
  replenishmentSafetyBody: document.getElementById('replenishmentSafetyBody'),
  replenishmentPriorityBody: document.getElementById('replenishmentPriorityBody'),
  modeSelect: document.getElementById('modeSelect'),
  overstayThresholdMinutes: document.getElementById('overstayThresholdMinutes'),
  activityTimeline: document.getElementById('activityTimeline'),
  settingSubnav: document.getElementById('settingSubnav'),
  settingPanelGeneral: document.getElementById('settingPanelGeneral'),
  settingPanelAccounts: document.getElementById('settingPanelAccounts'),
  settingPanelTrials: document.getElementById('settingPanelTrials'),
  adminUserRefreshButton: document.getElementById('adminUserRefreshButton'),
  adminUserSearch: document.getElementById('adminUserSearch'),
  adminUserRoleFilter: document.getElementById('adminUserRoleFilter'),
  adminUserStatusFilter: document.getElementById('adminUserStatusFilter'),
  adminUserTotalBadge: document.getElementById('adminUserTotalBadge'),
  adminActiveAdminBadge: document.getElementById('adminActiveAdminBadge'),
  adminUserTableBody: document.getElementById('adminUserTableBody'),
  adminUserEmptyHint: document.getElementById('adminUserEmptyHint'),
  adminUserMessage: document.getElementById('adminUserMessage'),
  adminUserLoadMoreButton: document.getElementById('adminUserLoadMoreButton'),
  adminUserForm: document.getElementById('adminUserForm'),
  adminUserEditingId: document.getElementById('adminUserEditingId'),
  adminUserEmail: document.getElementById('adminUserEmail'),
  adminUserFullName: document.getElementById('adminUserFullName'),
  adminUserCompanyName: document.getElementById('adminUserCompanyName'),
  adminUserJobTitle: document.getElementById('adminUserJobTitle'),
  adminUserRole: document.getElementById('adminUserRole'),
  adminUserStatus: document.getElementById('adminUserStatus'),
  adminUserTrialExpiresAt: document.getElementById('adminUserTrialExpiresAt'),
  adminUserSubmitButton: document.getElementById('adminUserSubmitButton'),
  adminUserDeleteButton: document.getElementById('adminUserDeleteButton'),
  adminUserResetButton: document.getElementById('adminUserResetButton'),
  adminTrialRefreshButton: document.getElementById('adminTrialRefreshButton'),
  adminTrialSearch: document.getElementById('adminTrialSearch'),
  adminTrialStatusFilter: document.getElementById('adminTrialStatusFilter'),
  adminTrialTableBody: document.getElementById('adminTrialTableBody'),
  adminTrialEmptyHint: document.getElementById('adminTrialEmptyHint'),
  adminTrialMessage: document.getElementById('adminTrialMessage'),
  adminTrialLoadMoreButton: document.getElementById('adminTrialLoadMoreButton')
};

const I18N = {
  en: {
    'app.title': 'RFID Retail Conversion Dashboard',
    'home.title': 'Main Menu',
    'home.cards.title': 'Select a module',
    'home.cards.dashboard.title': 'Dashboard',
    'home.cards.dashboard.desc': 'Open visual fitting-room dashboard',
    'home.cards.fittingDemo.title': 'Fitting Room Demo',
    'home.cards.fittingDemo.desc': 'Open demo controls for fitting-room simulation',
    'home.cards.product.title': 'Product',
    'home.cards.product.desc': 'Go to product board area',
    'home.cards.setting.title': 'Setting',
    'home.cards.setting.desc': 'Open Supabase and system settings',
    'home.cards.csv.title': 'CSV Import',
    'home.cards.csv.desc': 'Open import tools and upload data',
    'home.actions.openDashboard': 'Open Dashboard',
    'home.actions.backHome': 'Back to Home',
    'login.title': 'Sign in to RFID Fitting Room PoC',
    'login.subtitle': 'Please sign in to continue to dashboard.',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'auth.logout': 'Logout',
    'language.label': 'Language',
    'nav.home': 'Home',
    'nav.product': 'Product',
    'nav.csvImport': 'CSV Import',
    'nav.setting': 'Setting',
    'nav.fittingDemo': 'Fitting Demo',
    'config.title': 'Supabase Connection',
    'config.urlLabel': 'Supabase URL',
    'config.anonKeyLabel': 'Supabase Publishable Key',
    'auth.apiTokenLabel': 'API Shared Token',
    'auth.roleLabel': 'Role',
    'auth.role.trial': 'Trial',
    'auth.role.user': 'User',
    'auth.role.admin': 'Admin',
    'config.saveAndConnect': 'Save & Connect',
    'dashboard.title': 'RFID Retail Conversion Dashboard',
    'board.title': 'Visual Simulation Board',
    'board.lanes': 'Rack / Fitting / Checkout',
    'board.completeSale': 'Complete Sale',
    'board.soldTag': 'SOLD',
    'dashboard.refresh': 'Refresh',
    'dashboard.empty': 'No data',
    'dashboard.unnamedProduct': 'Unnamed Product',
    'product.summary.title': 'Product Inventory',
    'product.summary.desc': 'Review style summaries first, then drill down to color groups, SKU rows, and EPC details.',
    'product.summary.empty': 'No product items found',
    'product.summary.sku': 'SKU',
    'product.summary.styleNo': 'Style No',
    'product.summary.itemNoCode': 'Item No',
    'product.summary.productName': 'Product Name',
    'product.summary.size': 'Size',
    'product.summary.color': 'Color',
    'product.summary.price': 'Price',
    'product.summary.inventoryCount': 'Inventory',
    'product.summary.soldCount': 'Sold',
    'product.summary.totalCount': 'Total Items',
    'product.summary.items': 'Items',
    'product.summary.itemNo': '#',
    'product.summary.epc': 'EPC',
    'product.summary.location': 'Current Location',
    'product.summary.locationUnknown': 'UNKNOWN',
    'product.summary.skuUnknown': 'UNKNOWN_SKU',
    'product.summary.conflictTitle': 'SKU data conflicts detected',
    'product.summary.conflictItem': 'SKU {sku} / {field}: {values}',
    'product.summary.errorValue': 'ERROR',
    'product.summary.filter.styleNo': 'Style No',
    'product.summary.filter.itemNo': 'Item No',
    'product.summary.filter.reset': 'Clear Filters',
    'product.summary.view.label': 'View',
    'product.summary.view.sku': 'SKU View',
    'product.summary.view.nested': 'Nested View',
    'product.summary.nested.items': 'SKU Rows',
    'product.summary.colorCount': 'Color Count',
    'product.summary.skuCount': 'SKU Count',
    'product.summary.priceRange': 'Price Range',
    'product.summary.sizeCount': 'Size Count',
    'product.summary.epcCount': 'EPC Count',
    'product.summary.viewEpcs': 'View EPCs',
    'product.summary.lowStock': 'Low Stock',
    'product.summary.status': 'Status',
    'product.summary.lastSeen': 'Last Seen',
    'product.summary.styleCardFallback': 'Style Summary',
    'dashboard.sku': 'SKU',
    'dashboard.epc': 'EPC',
    'dashboard.gtinSegment': 'GTIN Segment',
    'dashboard.price': 'Price',
    'dashboard.description': 'Description',
    'dashboard.lastReader': 'Last Reader',
    'dashboard.abnormalStay': 'Abnormal stay',
    'kpi.total': 'Total Items',
    'kpi.fitting': 'In Fitting',
    'kpi.abnormal': 'Customer Experience Risk',
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
    'demoControls.openButton': 'Demo Controls',
    'demoControls.title': 'Demo Controls',
    'demoControls.subtitle': 'Simulation & data actions',
    'demoControls.quickActions.title': 'Quick Actions',
    'demoControls.quickActions.subtitle': 'Run a single simulated event',
    'demoControls.quickActions.product': 'Product',
    'demoControls.quickActions.room': 'Fitting Room',
    'demoControls.quickActions.action': 'Action',
    'demoControls.quickActions.note': 'Note',
    'demoControls.quickActions.run': 'Run Action',
    'demoControls.quickActions.helper': 'Each action creates an event record and updates session status.',
    'demoControls.scenarios.title': 'Scenario Presets',
    'demoControls.scenarios.subtitle': 'Run prebuilt demo scenarios',
    'demoControls.scenarios.normal.title': 'Normal Try-On',
    'demoControls.scenarios.normal.desc': 'Item enters and exits within normal dwell time.',
    'demoControls.scenarios.longDwell.title': 'Long Dwell',
    'demoControls.scenarios.longDwell.desc': 'Item stays in fitting room and triggers an alert.',
    'demoControls.scenarios.purchase.title': 'Try-On to Purchase',
    'demoControls.scenarios.purchase.desc': 'Item is tried on and sold within conversion window.',
    'demoControls.scenarios.multi.title': 'Multi-Item Try-On',
    'demoControls.scenarios.multi.desc': 'Multiple items enter one room; one item converts to sale.',
    'demoControls.scenarios.run': 'Run Scenario',
    'demoControls.dataUtils.title': 'Data Utilities',
    'demoControls.dataUtils.subtitle': 'Manage demo data and environment',
    'demoControls.dataUtils.seed': 'Seed Today’s Data',
    'demoControls.dataUtils.clearAlerts': 'Clear Active Alerts',
    'demoControls.dataUtils.reset': 'Reset Demo Data',
    'backup.title': 'Backup / Testing Tools',
    'backup.hint': 'These tools are secondary and used for maintenance/testing.',
    'backup.summary': 'Open secondary tools',
    'import.title': 'CSV Product Import',
    'import.fieldsHint': 'Fields:',
    'import.submit': 'Upload & Import',
    'import.notStarted': 'Not imported yet',
    'importGrouped.title': 'Grouped CSV Import (Auto SGTIN-96)',
    'importGrouped.fieldsHint': 'Fields:',
    'importGrouped.specHint': 'Required columns: style_no, item_no, sku_ean13, product_name, color, size, quantity, price_usd',
    'importGrouped.partitionLabel': 'Partition',
    'importGrouped.filterLabel': 'Filter',
    'importGrouped.previewTitle': 'Validation & Preview',
    'importGrouped.previewEmpty': 'No file parsed yet',
    'importGrouped.preview.summary': 'Summary',
    'importGrouped.preview.sample': 'Sample EPC (max 20)',
    'importGrouped.preview.detail': 'Grouped Rows Preview',
    'importGrouped.preview.error': 'Validation Error',
    'importGrouped.preview.field': 'Field',
    'importGrouped.preview.value': 'Value',
    'importGrouped.preview.line': 'Line',
    'importGrouped.preview.sku': 'SKU (EAN13)',
    'importGrouped.preview.productName': 'Product Name',
    'importGrouped.preview.styleNo': 'Style No',
    'importGrouped.preview.itemNo': 'Item No',
    'importGrouped.preview.color': 'Color',
    'importGrouped.preview.size': 'Size',
    'importGrouped.preview.price': 'Price',
    'importGrouped.preview.quantity': 'Quantity',
    'importGrouped.preview.serial': 'Serial',
    'importGrouped.preview.epc': 'EPC',
    'importGrouped.preview.conflictTitle': 'SKU conflicts detected in file',
    'importGrouped.preview.conflictItem': 'SKU {sku} / {field}: {values}',
    'importGrouped.preview.noConflict': 'No in-file SKU conflict detected',
    'importGrouped.preview.dbConflictTitle': 'SKU conflicts detected against database',
    'importGrouped.preview.dbConflictItem': 'SKU {sku} / {field}: {values}',
    'importGrouped.preview.dbCheckPassed': 'No database conflict detected',
    'importGrouped.preview.dbCheckFailed': 'Database conflict check failed: {message}',
    'importGrouped.submit': 'Generate EPC & Import',
    'importGrouped.notStarted': 'Not imported yet',
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
    'error.groupedImportFailed': 'Grouped import failed: {message}',
    'error.trialImportForbidden': 'Trial role cannot import products',
    'error.loginFailed': 'Login failed: {message}',
    'error.quickActionRequiredProduct': 'Please select a product',
    'error.quickActionRequiredRoom': 'Please select a fitting room',
    'error.quickActionRequiredAction': 'Please select an action',
    'error.resolveAlertNeedActive': 'Resolve Alert requires an active alert on selected product',
    'error.eventSendFailed': 'Send failed: {message}',
    'state.RACK': 'RACK',
    'state.FITTING_ROOM': 'FITTING_ROOM',
    'state.CHECKOUT': 'CHECKOUT',
    'state.SOLD': 'SOLD',
    'analytics.story.title': 'Story Layer',
    'analytics.ops.title': 'Operations Layer',
    'analytics.replenishment.title': 'Replenishment Layer',
    'analytics.range.today': 'Today',
    'analytics.range.last7Days': 'Last 7 days',
    'analytics.range.sessionBasis': 'Session basis',
    'analytics.a1.title': 'Try-On to Sale Funnel',
    'analytics.a1.tryOn': 'Try-On Sessions',
    'analytics.a1.checkout': 'Checkout Intent',
    'analytics.a1.sales': 'Completed Sales',
    'analytics.a1.rate': 'Try-On to Sale Rate',
    'analytics.a2.title': 'Hourly Activity Heat',
    'analytics.a2.tryOn': 'Try-on',
    'analytics.a2.sales': 'Sales',
    'analytics.a2.fallback': 'Sparse today data, showing available hourly summary.',
    'analytics.b1.title': 'Opportunity Matrix',
    'analytics.b1.subtitle': 'Top opportunities',
    'analytics.b1.empty': 'Not enough product-level try-on data yet.',
    'analytics.b1.row': '{name} / Try-on {tryOn} / Conv {conversion}% / Score {score}',
    'analytics.b2.title': 'Operations Alerts',
    'analytics.b2.subtitle': 'Action-required alerts',
    'analytics.b2.empty': 'No active alerts',
    'analytics.b2.longDwellTitle': 'Long dwell items detected',
    'analytics.b2.longDwellAction': 'Check fitting room and assist customer flow.',
    'analytics.b2.unclearedTitle': 'Uncleared fitting-room items',
    'analytics.b2.unclearedAction': 'Verify room clear-out and reset session state.',
    'analytics.b2.congestionTitle': 'Fitting room congestion risk',
    'analytics.b2.congestionAction': 'Reallocate staff to high-load room.',
    'analytics.c1.title': 'Safety Stock Risk',
    'analytics.c1.subtitle': 'SKU risk against safety line',
    'analytics.c1.empty': 'No SKU-level stock risk detected.',
    'analytics.c1.cover': 'cover',
    'analytics.c3.title': 'Restock Priority List',
    'analytics.c3.subtitle': 'Action list',
    'analytics.c3.empty': 'No urgent replenishment actions',
    'analytics.c3.rank': 'Rank',
    'analytics.c3.sku': 'SKU',
    'analytics.c3.gap': 'Gap',
    'analytics.c3.score': 'Score',
    'analytics.label.critical': 'Critical',
    'analytics.label.warning': 'Warning',
    'analytics.label.info': 'Info',
    'analytics.hero.noFitting': 'No fitting activity yet today. Monitor store flow and conversion once sessions begin.',
    'analytics.hero.abnormal': 'Try-on activity is live with {todayFitting} sessions, but {abnormalCount} abnormal dwell alerts need attention.',
    'analytics.hero.normal': 'Store is active with {todayFitting} try-on sessions and {conversionRate}% conversion today.',
    'analytics.hero.liveStore': 'Live store: {status}',
    'analytics.hero.liveStoreActive': 'Active',
    'analytics.hero.liveStoreQuiet': 'Quiet',
    'analytics.hero.tracking': 'RFID tracking: {status}',
    'analytics.hero.trackingNormal': 'Normal',
    'analytics.hero.trackingNoProducts': 'No products',
    'analytics.hero.aiAssistant': 'AI assistant: {status}',
    'analytics.hero.aiReady': 'Ready',
    'analytics.hero.aiMonitoring': 'Monitoring',
    'analytics.snapshot.rack': 'Rack',
    'analytics.snapshot.fittingRoom': 'Fitting Room',
    'analytics.snapshot.checkout': 'Checkout',
    'analytics.snapshot.activeAlerts': 'Active alerts',
    'analytics.snapshot.todaySales': 'Today sales',
    'analytics.snapshot.noActiveTryOnItems': 'No active try-on items',
    'analytics.aiSummary.opportunity': '{name} shows high try-on interest with {conversion}% conversion.',
    'analytics.aiSummary.abnormal': '{abnormalCount} abnormal dwell items detected. Prioritize fitting room follow-up.',
    'analytics.aiSummary.lowConversion': 'Conversion is below 20%. Review styling guidance near fitting rooms.',
    'analytics.aiSummary.stable': 'Store performance is stable. Continue monitoring try-on and conversion trend.',
    'analytics.aiSummary.viewFullInsights': 'View full insights',
    'analytics.aiSummary.askAi': 'Ask AI',
    'dashboard31.hero.title': 'RFID Retail Conversion Dashboard',
    'dashboard31.hero.subtitle': 'Turn fitting room activity into revenue growth.',
    'dashboard31.status.liveStore': 'Live store: Active',
    'dashboard31.status.tracking': 'RFID tracking: Normal',
    'dashboard31.status.ai': 'AI assistant: Ready',
    'dashboard31.revenue.missed': 'Missed Revenue Today',
    'dashboard31.revenue.uplift': 'Potential Sales Uplift',
    'dashboard31.revenue.rate': 'Try-On to Sale Rate',
    'dashboard31.revenue.lossDriver': 'Top Loss Driver',
    'dashboard31.revenue.lossDriverFallback': 'No major loss driver detected',
    'dashboard31.journey.title': 'Customer Journey Funnel',
    'dashboard31.journey.productInterest': 'Product Interest',
    'dashboard31.journey.fittingRoom': 'Fitting Room',
    'dashboard31.journey.purchaseIntent': 'Purchase Intent',
    'dashboard31.journey.completedSales': 'Completed Sales',
    'dashboard31.journey.dropOff': 'Main Drop-off Point',
    'dashboard31.journey.dropOff.afterFitting': 'After fitting room',
    'dashboard31.journey.dropOff.afterCheckout': 'After checkout',
    'dashboard31.journey.dropOff.noActivity': 'No activity yet',
    'dashboard31.ai.title': 'AI Business Insight',
    'dashboard31.ai.headline': 'Insight headline',
    'dashboard31.ai.summary': 'Business summary',
    'dashboard31.ai.impact': 'Business impact',
    'dashboard31.ai.reasons': 'Possible reasons',
    'dashboard31.ai.confidence': 'Confidence',
    'dashboard31.actions.title': 'Recommended Actions',
    'dashboard31.actions.empty': 'No immediate action required',
    'dashboard31.actions.priority.high': 'High',
    'dashboard31.actions.priority.medium': 'Medium',
    'dashboard31.actions.priority.low': 'Low',
    'dashboard31.actions.expectedImpact': 'Expected impact',
    'dashboard31.actions.relatedSkus': 'Related SKUs',
    'dashboard31.opportunities.title': 'Top Revenue Opportunities',
    'dashboard31.opportunities.empty': 'No revenue opportunities yet',
    'dashboard31.opportunities.tryOn': 'Try-ons',
    'dashboard31.opportunities.sales': 'Sales',
    'dashboard31.opportunities.conversion': 'Conversion',
    'dashboard31.opportunities.missedRevenue': 'Estimated missed revenue',
    'dashboard31.opportunities.recommendedAction': 'Recommended action',
    'dashboard31.alerts.title': 'Operations Alerts',
    'dashboard31.alerts.empty': 'No active operational risk',
    'dashboard31.replenishment.title': 'Replenishment Risk',
    'dashboard31.replenishment.empty': 'No replenishment risk detected',
    'dashboard31.replenishment.currentStock': 'Current stock',
    'dashboard31.replenishment.safetyStock': 'Safety stock',
    'dashboard31.replenishment.riskLevel': 'Risk level',
    'dashboard31.replenishment.recommendedAction': 'Recommended action',
    'dashboard31.risk.critical': 'Critical',
    'dashboard31.risk.warning': 'Warning',
    'dashboard31.risk.healthy': 'Healthy',
    'dashboard31.technical.title': 'Technical Live Board',
    'dashboard31.technical.show': 'Show Technical Details',
    'dashboard31.technical.hide': 'Hide Technical Details',
    'analytics.overview.tryOnUnit': 'try-on',
    'placeholder.productStyleNo': 'e.g. 4520001',
    'placeholder.productItemNo': 'e.g. 82210101',
    'placeholder.supabaseUrl': 'https://xxxx.supabase.co',
    'placeholder.supabaseAnonKey': 'eyJ...',
    'placeholder.apiToken': 'optional when auth disabled',
    'aria.languageSelect': 'Language',
    'aria.primaryNav': 'Primary',
    'demo.button.running': 'Running...',
    'demo.button.seeding': 'Seeding...',
    'demo.button.clearing': 'Clearing...',
    'demo.button.resetting': 'Resetting...',
    'demo.quickAction.selectProduct': 'Select a product',
    'demo.toast.actionCompleted': 'Action completed',
    'demo.toast.actionFailed': 'Failed to execute action',
    'demo.toast.scenarioExecuted': 'Scenario executed',
    'demo.toast.scenarioFailed': 'Failed to execute scenario: {message}',
    'demo.toast.generated': 'Demo data generated',
    'demo.toast.generateFailed': 'Unable to generate demo data: {message}',
    'demo.toast.alertsCleared': 'Alerts cleared',
    'demo.toast.alertsClearFailed': 'Unable to clear alerts: {message}',
    'demo.toast.resetDone': 'Demo environment reset',
    'demo.toast.resetFailed': 'Reset failed: {message}'
  },
  'zh-Hant': {
    'app.title': 'RFID 零售轉換儀表板',
    'home.title': '主頁選單',
    'home.cards.title': '請選擇功能模組',
    'home.cards.dashboard.title': 'Dashboard',
    'home.cards.dashboard.desc': '開啟試衣間視覺化看板',
    'home.cards.fittingDemo.title': 'Fitting Room Demo',
    'home.cards.fittingDemo.desc': '開啟試衣間模擬 Demo 控制面板',
    'home.cards.product.title': 'Product',
    'home.cards.product.desc': '前往商品看板區域',
    'home.cards.setting.title': 'Setting',
    'home.cards.setting.desc': '開啟 Supabase 與系統設定',
    'home.cards.csv.title': 'CSV Import',
    'home.cards.csv.desc': '開啟導入工具並上傳資料',
    'home.actions.openDashboard': '開啟 Dashboard',
    'home.actions.backHome': '返回主頁',
    'login.title': '登入 RFID 試衣間 PoC',
    'login.subtitle': '請先登入，再進入儀表板。',
    'login.username': '帳號',
    'login.password': '密碼',
    'login.submit': '登入',
    'auth.logout': '登出',
    'language.label': '語言',
    'nav.home': '首頁',
    'nav.product': '商品',
    'nav.csvImport': 'CSV 匯入',
    'nav.setting': '設定',
    'nav.fittingDemo': '試衣間 Demo',
    'config.title': 'Supabase 連線設定',
    'auth.apiTokenLabel': 'API 共用 Token',
    'auth.roleLabel': '角色',
    'auth.role.trial': '試用',
    'auth.role.user': '一般使用者',
    'auth.role.admin': '管理者',
    'config.saveAndConnect': '儲存設定並連線',
    'dashboard.title': 'RFID 零售轉換儀表板',
    'board.title': '圖像化模擬看板',
    'board.lanes': '貨架 / 試衣間 / 結帳櫃檯',
    'board.completeSale': '完成銷售',
    'board.soldTag': '已售出',
    'dashboard.refresh': '手動刷新',
    'dashboard.empty': '無資料',
    'dashboard.unnamedProduct': '未命名商品',
    'product.summary.title': '商品庫存總覽',
    'product.summary.desc': '先查看款式摘要，再往下檢視顏色群組、SKU 列與 EPC 明細。',
    'product.summary.empty': '目前無商品資料',
    'product.summary.sku': 'SKU',
    'product.summary.styleNo': '款號',
    'product.summary.itemNoCode': '貨號',
    'product.summary.productName': '產品名稱',
    'product.summary.size': '尺寸',
    'product.summary.color': '顏色',
    'product.summary.price': '價格',
    'product.summary.inventoryCount': '庫存數量',
    'product.summary.soldCount': '已銷售數量',
    'product.summary.totalCount': '總件數',
    'product.summary.items': '件',
    'product.summary.itemNo': '序號',
    'product.summary.epc': 'EPC',
    'product.summary.location': '目前位置',
    'product.summary.locationUnknown': '未知',
    'product.summary.skuUnknown': '未知 SKU',
    'product.summary.conflictTitle': '偵測到 SKU 資料衝突',
    'product.summary.conflictItem': 'SKU {sku} / {field}：{values}',
    'product.summary.errorValue': 'ERROR',
    'product.summary.filter.styleNo': '款號',
    'product.summary.filter.itemNo': '貨號',
    'product.summary.filter.reset': '清除篩選',
    'product.summary.view.label': '顯示模式',
    'product.summary.view.sku': 'SKU 檢視',
    'product.summary.view.nested': '巢狀檢視',
    'product.summary.nested.items': 'SKU 筆數',
    'product.summary.colorCount': '顏色數',
    'product.summary.skuCount': 'SKU 數',
    'product.summary.priceRange': '價格區間',
    'product.summary.sizeCount': '尺寸數',
    'product.summary.epcCount': 'EPC 數',
    'product.summary.viewEpcs': '查看 EPC',
    'product.summary.lowStock': '低庫存',
    'product.summary.status': '狀態',
    'product.summary.lastSeen': '最後偵測',
    'product.summary.styleCardFallback': '款式摘要',
    'dashboard.gtinSegment': 'GTIN片段',
    'dashboard.price': '價格',
    'dashboard.description': '描述',
    'dashboard.lastReader': '最後 Reader',
    'dashboard.abnormalStay': '異常停留',
    'kpi.total': '商品總數',
    'kpi.fitting': '試穿中',
    'kpi.abnormal': '顧客體驗風險',
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
    'demoControls.openButton': 'Demo Controls',
    'demoControls.title': 'Demo Controls',
    'demoControls.subtitle': 'Simulation & data actions',
    'demoControls.quickActions.title': 'Quick Actions',
    'demoControls.quickActions.subtitle': '執行單一模擬事件',
    'demoControls.quickActions.product': '商品',
    'demoControls.quickActions.room': '試衣間',
    'demoControls.quickActions.action': '動作',
    'demoControls.quickActions.note': '備註',
    'demoControls.quickActions.run': 'Run Action',
    'demoControls.quickActions.helper': '每次動作都會建立事件紀錄並更新 session 狀態。',
    'demoControls.scenarios.title': 'Scenario Presets',
    'demoControls.scenarios.subtitle': '執行預建展示情境',
    'demoControls.scenarios.normal.title': 'Normal Try-On',
    'demoControls.scenarios.normal.desc': '商品進入並在正常停留時間內離開。',
    'demoControls.scenarios.longDwell.title': 'Long Dwell',
    'demoControls.scenarios.longDwell.desc': '商品停留超時並觸發警示。',
    'demoControls.scenarios.purchase.title': 'Try-On to Purchase',
    'demoControls.scenarios.purchase.desc': '商品試穿後在轉化窗內成交。',
    'demoControls.scenarios.multi.title': 'Multi-Item Try-On',
    'demoControls.scenarios.multi.desc': '多件商品進同一試衣間，其中一件成交。',
    'demoControls.scenarios.run': 'Run Scenario',
    'demoControls.dataUtils.title': 'Data Utilities',
    'demoControls.dataUtils.subtitle': '管理 demo 資料與環境',
    'demoControls.dataUtils.seed': 'Seed Today’s Data',
    'demoControls.dataUtils.clearAlerts': 'Clear Active Alerts',
    'demoControls.dataUtils.reset': 'Reset Demo Data',
    'backup.title': '備援 / 測試工具',
    'backup.hint': '以下工具為二級介面，提供維運與測試使用。',
    'backup.summary': '展開二級工具',
    'import.title': 'CSV 批量導入商品',
    'import.fieldsHint': '欄位：',
    'import.submit': '上傳並導入',
    'import.notStarted': '尚未導入',
    'importGrouped.title': 'Grouped CSV 導入（自動產生 SGTIN-96）',
    'importGrouped.fieldsHint': '欄位：',
    'importGrouped.specHint': '必要欄位：style_no、item_no、sku_ean13、product_name、color、size、quantity、price_usd',
    'importGrouped.partitionLabel': 'Partition',
    'importGrouped.filterLabel': 'Filter',
    'importGrouped.previewTitle': '驗證與預覽',
    'importGrouped.previewEmpty': '尚未解析檔案',
    'importGrouped.preview.summary': '摘要',
    'importGrouped.preview.sample': 'EPC 範例（最多 20 筆）',
    'importGrouped.preview.detail': '分組資料預覽',
    'importGrouped.preview.error': '驗證錯誤',
    'importGrouped.preview.field': '欄位',
    'importGrouped.preview.value': '值',
    'importGrouped.preview.line': '行號',
    'importGrouped.preview.sku': 'SKU（EAN13）',
    'importGrouped.preview.productName': '產品名稱',
    'importGrouped.preview.styleNo': '款號',
    'importGrouped.preview.itemNo': '貨號',
    'importGrouped.preview.color': '顏色',
    'importGrouped.preview.size': '尺寸',
    'importGrouped.preview.price': '價格',
    'importGrouped.preview.quantity': '數量',
    'importGrouped.preview.serial': '序號',
    'importGrouped.preview.epc': 'EPC',
    'importGrouped.preview.conflictTitle': '檔內偵測到 SKU 衝突',
    'importGrouped.preview.conflictItem': 'SKU {sku} / {field}：{values}',
    'importGrouped.preview.noConflict': '未偵測到檔內 SKU 衝突',
    'importGrouped.preview.dbConflictTitle': '偵測到與資料庫既有 SKU 衝突',
    'importGrouped.preview.dbConflictItem': 'SKU {sku} / {field}：{values}',
    'importGrouped.preview.dbCheckPassed': '未偵測到資料庫衝突',
    'importGrouped.preview.dbCheckFailed': '資料庫衝突檢查失敗：{message}',
    'importGrouped.submit': '產生 EPC 並導入',
    'importGrouped.notStarted': '尚未導入',
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
    'error.groupedImportFailed': 'Grouped 導入失敗：{message}',
    'error.trialImportForbidden': 'trial 角色不可匯入商品',
    'error.loginFailed': '登入失敗：{message}',
    'error.quickActionRequiredProduct': '請先選擇商品',
    'error.quickActionRequiredRoom': '請先選擇試衣間',
    'error.quickActionRequiredAction': '請先選擇動作',
    'error.resolveAlertNeedActive': 'Resolve Alert 需要該商品目前有 active alert',
    'error.eventSendFailed': '送出失敗：{message}',
    'analytics.hero.noFitting': '今日尚無試穿活動，待有 session 後再觀察動線與轉換。',
    'analytics.hero.abnormal': '目前有 {todayFitting} 筆試穿活動，但有 {abnormalCount} 筆異常停留需優先處理。',
    'analytics.hero.normal': '門店目前活躍，今日試穿 {todayFitting} 次，轉化率 {conversionRate}%。',
    'analytics.hero.liveStore': '門店即時：{status}',
    'analytics.hero.liveStoreActive': '活躍',
    'analytics.hero.liveStoreQuiet': '平穩',
    'analytics.hero.tracking': 'RFID 追蹤：{status}',
    'analytics.hero.trackingNormal': '正常',
    'analytics.hero.trackingNoProducts': '無商品資料',
    'analytics.hero.aiAssistant': 'AI 助理：{status}',
    'analytics.hero.aiReady': '已就緒',
    'analytics.hero.aiMonitoring': '監控中',
    'analytics.snapshot.rack': '貨架',
    'analytics.snapshot.fittingRoom': '試衣間',
    'analytics.snapshot.checkout': '結帳櫃檯',
    'analytics.snapshot.activeAlerts': '進行中警示',
    'analytics.snapshot.todaySales': '今日成交',
    'analytics.snapshot.noActiveTryOnItems': '目前沒有進行中的試穿商品',
    'analytics.aiSummary.opportunity': '{name} 試穿熱度高，目前轉化率為 {conversion}%。',
    'analytics.aiSummary.abnormal': '偵測到 {abnormalCount} 筆異常停留，請優先跟進試衣間。',
    'analytics.aiSummary.lowConversion': '轉化率低於 20%，建議檢視試衣間周邊導購流程。',
    'analytics.aiSummary.stable': '目前門店表現穩定，持續觀察試穿與轉化趨勢。',
    'analytics.aiSummary.viewFullInsights': '查看完整洞察',
    'analytics.aiSummary.askAi': '詢問 AI',
    'dashboard31.hero.title': 'RFID 零售轉換儀表板',
    'dashboard31.hero.subtitle': '將試衣間活動轉化為營收成長。',
    'dashboard31.status.liveStore': '門市即時：活躍',
    'dashboard31.status.tracking': 'RFID 追蹤：正常',
    'dashboard31.status.ai': 'AI 助理：已就緒',
    'dashboard31.revenue.missed': '今日流失營收',
    'dashboard31.revenue.uplift': '潛在營收提升',
    'dashboard31.revenue.rate': '試穿到成交轉換率',
    'dashboard31.revenue.lossDriver': '主要流失因子',
    'dashboard31.revenue.lossDriverFallback': '目前無顯著流失因子',
    'dashboard31.journey.title': '顧客旅程漏斗',
    'dashboard31.journey.productInterest': '商品興趣',
    'dashboard31.journey.fittingRoom': '試衣間',
    'dashboard31.journey.purchaseIntent': '購買意圖',
    'dashboard31.journey.completedSales': '完成成交',
    'dashboard31.journey.dropOff': '主要流失節點',
    'dashboard31.journey.dropOff.afterFitting': '試衣後流失',
    'dashboard31.journey.dropOff.afterCheckout': '結帳前流失',
    'dashboard31.journey.dropOff.noActivity': '目前無活動',
    'dashboard31.ai.title': 'AI 商業洞察',
    'dashboard31.actions.title': '建議行動',
    'dashboard31.actions.empty': '目前無立即處理事項',
    'dashboard31.opportunities.title': '營收機會清單',
    'dashboard31.opportunities.empty': '目前無可排序機會',
    'dashboard31.alerts.title': '營運警示',
    'dashboard31.alerts.empty': '目前無營運風險',
    'dashboard31.replenishment.title': '補貨風險',
    'dashboard31.replenishment.empty': '目前無補貨風險',
    'dashboard31.technical.title': '技術即時看板',
    'dashboard31.technical.show': '顯示技術細節',
    'dashboard31.technical.hide': '隱藏技術細節',
    'analytics.overview.tryOnUnit': '試穿',
    'placeholder.productStyleNo': '例如 4520001',
    'placeholder.productItemNo': '例如 82210101',
    'placeholder.supabaseUrl': 'https://xxxx.supabase.co',
    'placeholder.supabaseAnonKey': 'eyJ...',
    'placeholder.apiToken': '未啟用 auth 時可留空',
    'aria.languageSelect': '語言',
    'aria.primaryNav': '主要導覽',
    'demo.button.running': '執行中...',
    'demo.button.seeding': '建立中...',
    'demo.button.clearing': '清除中...',
    'demo.button.resetting': '重置中...',
    'demo.quickAction.selectProduct': '請選擇商品',
    'demo.toast.actionCompleted': '動作已完成',
    'demo.toast.actionFailed': '動作執行失敗',
    'demo.toast.scenarioExecuted': '情境已執行',
    'demo.toast.scenarioFailed': '情境執行失敗：{message}',
    'demo.toast.generated': '已產生 Demo 資料',
    'demo.toast.generateFailed': '無法產生 Demo 資料：{message}',
    'demo.toast.alertsCleared': '警示已清除',
    'demo.toast.alertsClearFailed': '無法清除警示：{message}',
    'demo.toast.resetDone': 'Demo 環境已重置',
    'demo.toast.resetFailed': '重置失敗：{message}'
  },
  'zh-Hans': {
    'app.title': 'RFID 零售转化仪表板',
    'login.title': '登录 RFID 试衣间 PoC',
    'login.subtitle': '请先登录，再进入仪表板。',
    'login.username': '账号',
    'login.password': '密码',
    'login.submit': '登录',
    'auth.logout': '登出',
    'language.label': '语言',
    'nav.home': '首页',
    'nav.product': '商品',
    'nav.csvImport': 'CSV 导入',
    'nav.setting': '设置',
    'nav.fittingDemo': '试衣间 Demo',
    'config.title': 'Supabase 连接设置',
    'config.saveAndConnect': '保存设置并连接',
    'dashboard.title': 'RFID 零售转化仪表板',
    'board.title': '图像化模拟看板',
    'board.lanes': '货架 / 试衣间 / 结账柜台',
    'board.completeSale': '完成销售',
    'board.soldTag': '已售出',
    'dashboard.refresh': '手动刷新',
    'dashboard.empty': '无数据',
    'dashboard.unnamedProduct': '未命名商品',
    'product.summary.title': 'SKU 商品总览',
    'product.summary.desc': '点击各 SKU 行可展开查看所有 item 的 EPC 与当前位置',
    'product.summary.empty': '当前无商品数据',
    'product.summary.sku': 'SKU',
    'product.summary.styleNo': '款号',
    'product.summary.itemNoCode': '货号',
    'product.summary.productName': '产品名称',
    'product.summary.size': '尺码',
    'product.summary.color': '颜色',
    'product.summary.price': '价格',
    'product.summary.inventoryCount': '库存数量',
    'product.summary.soldCount': '已销售数量',
    'product.summary.totalCount': '总件数',
    'product.summary.itemNo': '序号',
    'product.summary.epc': 'EPC',
    'product.summary.location': '当前位置',
    'product.summary.locationUnknown': '未知',
    'product.summary.skuUnknown': '未知 SKU',
    'product.summary.conflictTitle': '检测到 SKU 数据冲突',
    'product.summary.conflictItem': 'SKU {sku} / {field}：{values}',
    'product.summary.errorValue': 'ERROR',
    'product.summary.filter.styleNo': '款号',
    'product.summary.filter.itemNo': '货号',
    'product.summary.filter.reset': '清除筛选',
    'product.summary.view.label': '显示模式',
    'product.summary.view.sku': 'SKU 视图',
    'product.summary.view.nested': '嵌套视图',
    'product.summary.nested.items': 'SKU 行数',
    'dashboard.abnormalStay': '异常停留',
    'import.title': 'CSV 批量导入商品',
    'import.fieldsHint': '字段：',
    'import.submit': '上传并导入',
    'import.notStarted': '尚未导入',
    'importGrouped.title': 'Grouped CSV 导入（自动生成 SGTIN-96）',
    'importGrouped.fieldsHint': '字段：',
    'importGrouped.specHint': '必要字段：style_no、item_no、sku_ean13、product_name、color、size、quantity、price_usd',
    'importGrouped.partitionLabel': 'Partition',
    'importGrouped.filterLabel': 'Filter',
    'importGrouped.previewTitle': '校验与预览',
    'importGrouped.previewEmpty': '尚未解析文件',
    'importGrouped.preview.summary': '摘要',
    'importGrouped.preview.sample': 'EPC 示例（最多 20 条）',
    'importGrouped.preview.detail': '分组数据预览',
    'importGrouped.preview.error': '校验错误',
    'importGrouped.preview.field': '字段',
    'importGrouped.preview.value': '值',
    'importGrouped.preview.line': '行号',
    'importGrouped.preview.sku': 'SKU（EAN13）',
    'importGrouped.preview.productName': '产品名称',
    'importGrouped.preview.styleNo': '款号',
    'importGrouped.preview.itemNo': '货号',
    'importGrouped.preview.color': '颜色',
    'importGrouped.preview.size': '尺码',
    'importGrouped.preview.price': '价格',
    'importGrouped.preview.quantity': '数量',
    'importGrouped.preview.serial': '序号',
    'importGrouped.preview.epc': 'EPC',
    'importGrouped.preview.conflictTitle': '文件内检测到 SKU 冲突',
    'importGrouped.preview.conflictItem': 'SKU {sku} / {field}：{values}',
    'importGrouped.preview.noConflict': '未检测到文件内 SKU 冲突',
    'importGrouped.preview.dbConflictTitle': '检测到与数据库既有 SKU 冲突',
    'importGrouped.preview.dbConflictItem': 'SKU {sku} / {field}：{values}',
    'importGrouped.preview.dbCheckPassed': '未检测到数据库冲突',
    'importGrouped.preview.dbCheckFailed': '数据库冲突检查失败：{message}',
    'importGrouped.submit': '生成 EPC 并导入',
    'importGrouped.notStarted': '尚未导入',
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
    'kpi.abnormal': '顾客体验风险',
    'dashboard31.hero.title': 'RFID 零售转化仪表板',
    'dashboard31.hero.subtitle': '将试衣间活动转化为营收增长。',
    'dashboard31.revenue.missed': '今日流失营收',
    'dashboard31.revenue.uplift': '潜在营收提升',
    'dashboard31.revenue.rate': '试穿到成交转化率',
    'dashboard31.revenue.lossDriver': '主要流失因素',
    'dashboard31.journey.title': '顾客旅程漏斗',
    'dashboard31.journey.productInterest': '商品兴趣',
    'dashboard31.journey.purchaseIntent': '购买意图',
    'dashboard31.ai.title': 'AI 商业洞察',
    'dashboard31.actions.title': '建议动作',
    'dashboard31.opportunities.title': '营收机会清单',
    'dashboard31.alerts.title': '运营预警',
    'dashboard31.replenishment.title': '补货风险',
    'dashboard31.technical.title': '技术实时看板',
    'dashboard31.technical.show': '显示技术细节',
    'dashboard31.technical.hide': '隐藏技术细节',
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
    'app.title': 'RFID リテール転換ダッシュボード',
    'login.title': 'RFID試着室 PoC にサインイン',
    'login.subtitle': 'ダッシュボードに進むにはサインインしてください。',
    'login.username': 'ユーザー名',
    'login.password': 'パスワード',
    'login.submit': 'サインイン',
    'auth.logout': 'ログアウト',
    'language.label': '言語',
    'nav.home': 'ホーム',
    'nav.product': '商品',
    'nav.csvImport': 'CSV インポート',
    'nav.setting': '設定',
    'nav.fittingDemo': '試着室デモ',
    'config.title': 'Supabase 接続設定',
    'config.saveAndConnect': '保存して接続',
    'dashboard.title': 'RFID リテール転換ダッシュボード',
    'board.title': 'ビジュアルシミュレーションボード',
    'board.lanes': 'ラック / 試着室 / レジ',
    'board.completeSale': '販売完了',
    'board.soldTag': '販売済み',
    'dashboard.refresh': '更新',
    'dashboard.empty': 'データなし',
    'dashboard.unnamedProduct': '未命名商品',
    'product.summary.title': 'SKU 商品サマリー',
    'product.summary.desc': 'SKU 行をクリックすると item の EPC と現在位置を展開表示します',
    'product.summary.empty': '商品データがありません',
    'product.summary.sku': 'SKU',
    'product.summary.styleNo': 'Style No',
    'product.summary.itemNoCode': 'Item No',
    'product.summary.productName': '商品名',
    'product.summary.size': 'サイズ',
    'product.summary.color': 'カラー',
    'product.summary.price': '価格',
    'product.summary.inventoryCount': '在庫数',
    'product.summary.soldCount': '販売数',
    'product.summary.totalCount': '総件数',
    'product.summary.itemNo': '番号',
    'product.summary.epc': 'EPC',
    'product.summary.location': '現在位置',
    'product.summary.locationUnknown': '不明',
    'product.summary.skuUnknown': '不明 SKU',
    'product.summary.conflictTitle': 'SKU データの不整合を検出しました',
    'product.summary.conflictItem': 'SKU {sku} / {field}: {values}',
    'product.summary.errorValue': 'ERROR',
    'product.summary.filter.styleNo': 'Style No',
    'product.summary.filter.itemNo': 'Item No',
    'product.summary.filter.reset': 'フィルター解除',
    'product.summary.view.label': '表示モード',
    'product.summary.view.sku': 'SKU ビュー',
    'product.summary.view.nested': 'ネストビュー',
    'product.summary.nested.items': 'SKU 行数',
    'dashboard.abnormalStay': '異常滞在',
    'import.title': 'CSV 商品一括インポート',
    'import.fieldsHint': '項目:',
    'import.submit': 'アップロードしてインポート',
    'import.notStarted': '未インポート',
    'importGrouped.title': 'Grouped CSV インポート（SGTIN-96 自動生成）',
    'importGrouped.fieldsHint': '項目：',
    'importGrouped.specHint': '必須列：style_no、item_no、sku_ean13、product_name、color、size、quantity、price_usd',
    'importGrouped.partitionLabel': 'Partition',
    'importGrouped.filterLabel': 'Filter',
    'importGrouped.previewTitle': '検証とプレビュー',
    'importGrouped.previewEmpty': 'まだファイル未解析',
    'importGrouped.preview.summary': 'サマリー',
    'importGrouped.preview.sample': 'EPC サンプル（最大 20 件）',
    'importGrouped.preview.detail': 'グループ行プレビュー',
    'importGrouped.preview.error': '検証エラー',
    'importGrouped.preview.field': '項目',
    'importGrouped.preview.value': '値',
    'importGrouped.preview.line': '行番号',
    'importGrouped.preview.sku': 'SKU（EAN13）',
    'importGrouped.preview.productName': '商品名',
    'importGrouped.preview.styleNo': 'Style No',
    'importGrouped.preview.itemNo': 'Item No',
    'importGrouped.preview.color': 'カラー',
    'importGrouped.preview.size': 'サイズ',
    'importGrouped.preview.price': '価格',
    'importGrouped.preview.quantity': '数量',
    'importGrouped.preview.serial': 'シリアル',
    'importGrouped.preview.epc': 'EPC',
    'importGrouped.preview.conflictTitle': 'ファイル内 SKU 衝突を検出',
    'importGrouped.preview.conflictItem': 'SKU {sku} / {field}: {values}',
    'importGrouped.preview.noConflict': 'ファイル内 SKU 衝突はありません',
    'importGrouped.preview.dbConflictTitle': 'DB 既存 SKU との衝突を検出',
    'importGrouped.preview.dbConflictItem': 'SKU {sku} / {field}: {values}',
    'importGrouped.preview.dbCheckPassed': 'DB 衝突は検出されませんでした',
    'importGrouped.preview.dbCheckFailed': 'DB 衝突チェック失敗: {message}',
    'importGrouped.submit': 'EPC 生成してインポート',
    'importGrouped.notStarted': '未インポート',
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
    'kpi.abnormal': '顧客体験リスク',
    'dashboard31.hero.title': 'RFID リテール転換ダッシュボード',
    'dashboard31.hero.subtitle': '試着室アクティビティを売上成長へつなげる。',
    'dashboard31.revenue.missed': '本日の機会損失売上',
    'dashboard31.revenue.uplift': '想定売上アップリフト',
    'dashboard31.revenue.rate': '試着→購入転換率',
    'dashboard31.revenue.lossDriver': '主要ロス要因',
    'dashboard31.journey.title': '顧客ジャーニーファネル',
    'dashboard31.journey.productInterest': '商品関心',
    'dashboard31.journey.purchaseIntent': '購入意向',
    'dashboard31.ai.title': 'AI ビジネスインサイト',
    'dashboard31.actions.title': '推奨アクション',
    'dashboard31.opportunities.title': '売上機会トップ',
    'dashboard31.alerts.title': '運用アラート',
    'dashboard31.replenishment.title': '補充リスク',
    'dashboard31.technical.title': '技術ライブボード',
    'dashboard31.technical.show': '技術詳細を表示',
    'dashboard31.technical.hide': '技術詳細を非表示',
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

  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder');
    if (!key) return;
    node.setAttribute('placeholder', t(key));
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
    const key = node.getAttribute('data-i18n-aria-label');
    if (!key) return;
    node.setAttribute('aria-label', t(key));
  });

  document.querySelectorAll('[data-i18n-title]').forEach((node) => {
    const key = node.getAttribute('data-i18n-title');
    if (!key) return;
    node.setAttribute('title', t(key));
  });

  document.documentElement.lang = currentLang;
  document.title = t('app.title');
}

function getCurrentLang() {
  const stored = readStorage(LANG_KEY, DEFAULT_LANG);
  return SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG;
}

function getCurrentMode() {
  const stored = readStorage(MODE_KEY, DEFAULT_MODE);
  return SUPPORTED_MODES.includes(stored) ? stored : DEFAULT_MODE;
}

function getCurrentProductSummaryView() {
  const stored = readStorage(PRODUCT_SUMMARY_VIEW_KEY, DEFAULT_PRODUCT_SUMMARY_VIEW);
  return PRODUCT_SUMMARY_VIEWS.includes(stored) ? stored : DEFAULT_PRODUCT_SUMMARY_VIEW;
}

function getSession() {
  const raw = readStorage(SESSION_KEY, null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.expiresAt) {
      writeStorage(SESSION_KEY, null);
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      writeStorage(SESSION_KEY, null);
      return null;
    }
    return parsed;
  } catch {
    writeStorage(SESSION_KEY, null);
    return null;
  }
}

function setSession(session) {
  writeJsonStorage(SESSION_KEY, session);
}

function clearSession() {
  writeStorage(SESSION_KEY, null);
}

function setAppVisibility(isAuthenticated) {
  setShellAuthVisibility(isAuthenticated);
}

function setMainView(view) {
  const targetPath = view === 'dashboard' ? '/dashboard' : '/';
  setShellViewByPath(targetPath);
  syncTopNavActiveState(targetPath);
}

function navigateToDashboard() {
  navigate('/dashboard');
}

function navigateToHome() {
  navigate('/');
}

function handleLogout() {
  clearSession();
  if (subscription) {
    subscription.unsubscribe().catch(() => {});
    subscription = null;
  }
  supabase = null;
  resetSupabaseClient();
  setAppState({ session: null, supabaseClient: null, connectionStatus: 'idle' });
  setAppVisibility(false);
  applyAuthUi(null);
  window.location.replace('/login.html');
}

function modeThresholdStorageKey(mode) {
  return mode === 'operational' ? OVERSTAY_OPERATIONAL_KEY : OVERSTAY_DEMO_KEY;
}

function getModeThresholdMinutes(mode) {
  const fallback = MODE_DEFAULT_THRESHOLDS[mode] || MODE_DEFAULT_THRESHOLDS.demo;
  const raw = Number(readStorage(modeThresholdStorageKey(mode), ''));
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.floor(raw);
}

function setModeThresholdMinutes(mode, minutes) {
  const safe = Math.max(1, Math.floor(Number(minutes) || 1));
  writeStorage(modeThresholdStorageKey(mode), String(safe));
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

function applyProductSummaryViewUi() {
  const isSku = currentProductSummaryView === 'sku';
  if (el.productSummaryViewSku) {
    el.productSummaryViewSku.classList.toggle('is-active', isSku);
    el.productSummaryViewSku.setAttribute('aria-pressed', isSku ? 'true' : 'false');
  }
  if (el.productSummaryViewNested) {
    el.productSummaryViewNested.classList.toggle('is-active', !isSku);
    el.productSummaryViewNested.setAttribute('aria-pressed', isSku ? 'false' : 'true');
  }
}

function setProductSummaryView(nextView, options = {}) {
  const { persist = true, rerender = true } = options;
  const view = PRODUCT_SUMMARY_VIEWS.includes(nextView) ? nextView : DEFAULT_PRODUCT_SUMMARY_VIEW;
  currentProductSummaryView = view;
  if (persist) {
    writeStorage(PRODUCT_SUMMARY_VIEW_KEY, currentProductSummaryView);
  }
  applyProductSummaryViewUi();
  if (rerender) {
    renderProductSkuSummary(lastSkuSummary);
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

function syncTopNavActiveState(pathname = window.location.pathname) {
  const navLinks = Array.from(document.querySelectorAll('.top-nav-link'));
  if (!navLinks.length) return;

  const currentPath = String(pathname || '/');
  const currentComparable = currentPath
    .replace('/product.html', '/product')
    .replace('/csv-import.html', '/csv-import')
    .replace('/setting.html', '/setting')
    .replace('/fitting-demo.html', '/fitting-demo');
  navLinks.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const url = new URL(href, window.location.origin);
    const linkComparable = String(url.pathname || '/')
      .replace('/product.html', '/product')
      .replace('/csv-import.html', '/csv-import')
      .replace('/setting.html', '/setting')
      .replace('/fitting-demo.html', '/fitting-demo');
    const isActive = linkComparable === currentComparable;
    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

console.log('[boot] main.js loaded');

function setStatus(text, level = 'warn') {
  if (!el.connectionStatus) {
    return;
  }
  el.connectionStatus.textContent = text;
  el.connectionStatus.classList.remove('text-ok', 'text-warn', 'text-err');
  el.connectionStatus.classList.add(`text-${level}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showToast(message, level = 'ok') {
  if (!el.demoToastContainer) return;
  const node = document.createElement('div');
  node.className = `toast toast--${level}`;
  node.textContent = String(message || '');
  el.demoToastContainer.appendChild(node);
  setTimeout(() => {
    node.remove();
  }, 2600);
}

function openDemoControls() {
  if (el.demoControlsDrawer) {
    el.demoControlsDrawer.classList.add('is-open');
    el.demoControlsDrawer.setAttribute('aria-hidden', 'false');
  }
  if (el.demoControlsBackdrop) {
    el.demoControlsBackdrop.hidden = false;
  }
}

function openDemoControlsAt(sectionId) {
  openDemoControls();
  if (!sectionId) return;
  const node = document.getElementById(sectionId);
  if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDemoControls() {
  if (el.demoControlsDrawer) {
    el.demoControlsDrawer.classList.remove('is-open');
    el.demoControlsDrawer.setAttribute('aria-hidden', 'true');
  }
  if (el.demoControlsBackdrop) {
    el.demoControlsBackdrop.hidden = true;
  }
}

function handleHomeCardNavigation(type) {
  const session = getSession();
  console.info('[nav] home card navigation', {
    type,
    fromPath: window.location.pathname,
    at: new Date().toISOString()
  });
  if (type === 'dashboard') {
    navigate('/dashboard');
    return;
  }
  if (type === 'fittingDemo') {
    console.info('[nav] redirect to fitting-demo', {
      to: '/fitting-demo',
      fromPath: window.location.pathname
    });
    navigate('/fitting-demo');
    return;
  }
  if (type === 'product') {
    navigate('/product.html');
    return;
  }
  if (type === 'setting') {
    if (!canUseSetting(session)) {
      setStatus('目前帳號無設定頁權限', 'warn');
      navigate('/');
      return;
    }
    navigate('/setting');
    return;
  }
  if (type === 'csv') {
    if (!canUseCsvImport(session)) {
      setStatus('目前帳號無 CSV 匯入權限', 'warn');
      navigate('/');
      return;
    }
    navigate('/csv-import.html');
  }
}

function getRoomReaderId(room, fallback = 'FITTING_ROOM_ANTENNA_1') {
  const n = Number(room);
  if (Number.isInteger(n) && n >= 1 && n <= 4) return `FITTING_ROOM_ANTENNA_${n}`;
  return fallback;
}

async function sendRfidEvent({ epcData, readerId, eventType, fromZone, toZone, note }) {
  const response = await fetch('/api/rfid-webhook', {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({
      epc_data: epcData,
      reader_id: readerId,
      event_type: eventType,
      from_zone: fromZone,
      to_zone: toZone,
      metadata: note ? { note } : undefined
    })
  });
  const { data } = await parseApiResponse(response, 'demo-controls-webhook');
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, t('error.eventSendFailed', { message: 'api failed' })));
  }
  return data;
}

function populateQuickActionProducts(products = lastRenderContext?.products || []) {
  if (!el.quickActionProduct) return;
  const rows = Array.isArray(products) ? products : [];
  const options = rows
    .filter((p) => p?.epc_data)
    .map((p) => {
      const sku = String(p.sku || '-');
      const name = String(p.display_name || p.name_en || p.name || t('dashboard.unnamedProduct'));
      const epcSuffix = String(p.epc_data || '').slice(-4);
      const label = `${sku} / ${name} / EPC-${epcSuffix}`;
      return `<option value="${escapeHtml(p.epc_data)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  el.quickActionProduct.innerHTML = `<option value="">${escapeHtml(t('demo.quickAction.selectProduct'))}</option>${options}`;
}

function getQuickActionProduct() {
  const selectedEpc = String(el.quickActionProduct?.value || '').trim();
  if (!selectedEpc) return null;
  return (lastRenderContext?.products || []).find((p) => String(p.epc_data || '').trim() === selectedEpc) || null;
}

function hasActiveAlert(product) {
  if (!product) return false;
  const key = productKeyFromProduct(product);
  const latestEvent = key ? lastRenderContext?.latestEventMap?.get(key) : null;
  const presence = key ? lastRenderContext?.presenceMap?.get(key) : null;
  const { abnormal } = deriveStateByPresence(key, latestEvent, presence, Date.now(), getCurrentOverstayThresholdMs());
  return Boolean(abnormal);
}

async function runQuickAction({ product, room, action, note }) {
  const epcData = product?.epc_data;
  const fittingReader = getRoomReaderId(room);
  if (!epcData) throw new Error(t('error.quickActionRequiredProduct'));

  if (action === 'enter') {
    await sendRfidEvent({ epcData, readerId: fittingReader, eventType: 'enter_fitting_room', fromZone: 'sales_floor', toZone: 'fitting_room', note });
    return;
  }
  if (action === 'exit') {
    await sendRfidEvent({ epcData, readerId: 'RACK_ANTENNA_1', eventType: 'left_fitting_room', fromZone: 'fitting_room', toZone: 'sales_floor', note });
    return;
  }
  if (action === 'sale') {
    await sendRfidEvent({ epcData, readerId: 'SOLD_ANTENNA_1', eventType: 'sale_completed', fromZone: 'checkout', toZone: 'sold', note });
    return;
  }
  if (action === 'alert') {
    await sendRfidEvent({ epcData, readerId: fittingReader, eventType: 'enter_fitting_room', fromZone: 'sales_floor', toZone: 'fitting_room', note });
    return;
  }
  if (action === 'resolve') {
    if (!hasActiveAlert(product)) {
      throw new Error(t('error.resolveAlertNeedActive'));
    }
    await sendRfidEvent({ epcData, readerId: 'RACK_ANTENNA_1', eventType: 'left_fitting_room', fromZone: 'fitting_room', toZone: 'sales_floor', note });
    return;
  }
}

async function handleQuickActionSubmit(event) {
  event.preventDefault();
  if (el.quickActionError) {
    el.quickActionError.hidden = true;
    el.quickActionError.textContent = '';
  }

  const product = getQuickActionProduct();
  const action = String(el.quickActionType?.value || '').trim();
  const room = String(el.quickActionRoom?.value || '').trim();
  const note = String(el.quickActionNote?.value || '').trim();

  try {
    if (!product) throw new Error(t('error.quickActionRequiredProduct'));
    if (!action) throw new Error(t('error.quickActionRequiredAction'));

    if ((action === 'enter' || action === 'exit' || action === 'alert') && !room) {
      throw new Error(t('error.quickActionRequiredRoom'));
    }

    const button = el.quickActionRun;
    if (button) {
      button.disabled = true;
      button.textContent = t('demo.button.running');
    }
    await runQuickAction({ product, room, action, note });
    showToast(t('demo.toast.actionCompleted'), 'ok');
    if (el.dashboard) {
      await fetchAndRenderDashboard();
    }
  } catch (error) {
    if (el.quickActionError) {
      el.quickActionError.hidden = false;
      el.quickActionError.textContent = error.message;
    }
    showToast(t('demo.toast.actionFailed'), 'err');
  } finally {
    const button = el.quickActionRun;
    if (button) {
      button.disabled = false;
      button.textContent = t('demoControls.quickActions.run');
    }
  }
}

function pickScenarioProducts(count = 1) {
  const rows = (lastRenderContext?.products || []).filter((p) => p?.epc_data);
  return rows.slice(0, count);
}

async function runScenario(name) {
  const one = pickScenarioProducts(1)[0];
  if (!one) throw new Error(t('error.quickActionRequiredProduct'));

  if (name === 'normal') {
    await runQuickAction({ product: one, room: '1', action: 'enter', note: 'scenario:normal' });
    await sleep(700);
    await runQuickAction({ product: one, room: '1', action: 'exit', note: 'scenario:normal' });
    return;
  }
  if (name === 'longDwell') {
    await runQuickAction({ product: one, room: '2', action: 'alert', note: 'scenario:longDwell' });
    return;
  }
  if (name === 'purchase') {
    await runQuickAction({ product: one, room: '1', action: 'enter', note: 'scenario:purchase' });
    await sleep(500);
    await runQuickAction({ product: one, room: '1', action: 'exit', note: 'scenario:purchase' });
    await sleep(500);
    await runQuickAction({ product: one, room: '1', action: 'sale', note: 'scenario:purchase' });
    return;
  }
  if (name === 'multi') {
    const items = pickScenarioProducts(3);
    if (items.length < 2) throw new Error(t('error.quickActionRequiredProduct'));
    await runQuickAction({ product: items[0], room: '3', action: 'enter', note: 'scenario:multi' });
    await runQuickAction({ product: items[1], room: '3', action: 'enter', note: 'scenario:multi' });
    await sleep(500);
    await runQuickAction({ product: items[1], room: '3', action: 'exit', note: 'scenario:multi' });
    await runQuickAction({ product: items[0], room: '3', action: 'sale', note: 'scenario:multi' });
  }
}

async function handleScenarioRun(event) {
  const button = event.currentTarget;
  const scenario = String(button?.dataset?.scenario || '').trim();
  if (!scenario) return;
  const original = button.textContent;
  try {
    button.disabled = true;
    button.textContent = t('demo.button.running');
    await runScenario(scenario);
    showToast(t('demo.toast.scenarioExecuted'), 'ok');
    await fetchAndRenderDashboard();
  } catch (error) {
    showToast(t('demo.toast.scenarioFailed', { message: error.message }), 'err');
  } finally {
    button.disabled = false;
    button.textContent = original || t('demoControls.scenarios.run');
  }
}

async function handleSeedTodayData() {
  try {
    if (el.seedTodayData) {
      el.seedTodayData.disabled = true;
      el.seedTodayData.textContent = t('demo.button.seeding');
    }
    await runScenario('normal');
    await runScenario('purchase');
    showToast(t('demo.toast.generated'), 'ok');
    await fetchAndRenderDashboard();
  } catch (error) {
    showToast(t('demo.toast.generateFailed', { message: error.message }), 'err');
  } finally {
    if (el.seedTodayData) {
      el.seedTodayData.disabled = false;
      el.seedTodayData.textContent = t('demoControls.dataUtils.seed');
    }
  }
}

async function handleClearActiveAlerts() {
  try {
    if (el.clearActiveAlerts) {
      el.clearActiveAlerts.disabled = true;
      el.clearActiveAlerts.textContent = t('demo.button.clearing');
    }
    const products = (lastRenderContext?.products || []).filter((p) => hasActiveAlert(p)).slice(0, 6);
    for (const product of products) {
      await runQuickAction({ product, room: '1', action: 'resolve', note: 'utility:clear-alerts' });
    }
    showToast(t('demo.toast.alertsCleared'), 'ok');
    await fetchAndRenderDashboard();
  } catch (error) {
    showToast(t('demo.toast.alertsClearFailed', { message: error.message }), 'err');
  } finally {
    if (el.clearActiveAlerts) {
      el.clearActiveAlerts.disabled = false;
      el.clearActiveAlerts.textContent = t('demoControls.dataUtils.clearAlerts');
    }
  }
}

async function handleResetDemoData() {
  const ok = window.confirm('This will reset the current demo environment.');
  if (!ok) return;
  try {
    if (el.resetDemoData) {
      el.resetDemoData.disabled = true;
      el.resetDemoData.textContent = t('demo.button.resetting');
    }
    localLaneOverrides.clear();
    const products = (lastRenderContext?.products || []).slice(0, 8);
    for (const product of products) {
      try {
        await runQuickAction({ product, room: '1', action: 'exit', note: 'utility:reset' });
      } catch {
        // ignore per-item failure in reset flow
      }
    }
    showToast(t('demo.toast.resetDone'), 'warn');
    await fetchAndRenderDashboard();
  } catch (error) {
    showToast(t('demo.toast.resetFailed', { message: error.message }), 'err');
  } finally {
    if (el.resetDemoData) {
      el.resetDemoData.disabled = false;
      el.resetDemoData.textContent = t('demoControls.dataUtils.reset');
    }
  }
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
  const session = getSession();
  const accessToken = String(session?.accessToken || '').trim();
  const headers = {};

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function canUseCsvImport(session = getSession()) {
  const role = String(session?.profile?.role || '').trim();
  const fromPermissions = session?.permissions?.canUseCsvImport;
  if (typeof fromPermissions === 'boolean') return fromPermissions;
  return role === 'user' || role === 'admin';
}

function canUseSetting(session = getSession()) {
  const role = String(session?.profile?.role || '').trim();
  const fromPermissions = session?.permissions?.canUseSetting;
  if (typeof fromPermissions === 'boolean') return fromPermissions;
  return role === 'admin';
}

function canViewFittingDemo(session = getSession()) {
  const role = String(session?.profile?.role || '').trim();
  const fromPermissions = session?.permissions?.canViewFittingDemo;
  if (typeof fromPermissions === 'boolean') return fromPermissions;
  return role === 'trial' || role === 'user' || role === 'admin';
}

function toggleEntryVisibility(node, visible) {
  if (!node) return;
  if ('hidden' in node) node.hidden = !visible;
  node.classList.toggle('is-disabled', !visible);
  if (node.tagName === 'A') {
    node.setAttribute('aria-hidden', visible ? 'false' : 'true');
    node.setAttribute('tabindex', visible ? '0' : '-1');
    if (!visible) {
      node.removeAttribute('aria-current');
    }
  }
}

function applyAuthUi(session = getSession()) {
  const canCsv = canUseCsvImport(session);
  const canSettingPage = canUseSetting(session);
  const canFittingPage = canViewFittingDemo(session);

  toggleEntryVisibility(el.homeCardCsvImport, canCsv);
  toggleEntryVisibility(el.homeCardSetting, canSettingPage);
  toggleEntryVisibility(el.homeCardFittingDemo, canFittingPage);

  const navLinks = Array.from(document.querySelectorAll('.top-nav-link'));
  navLinks.forEach((link) => {
    const href = String(link.getAttribute('href') || '').trim();
    if (href === '/csv-import.html' || href === '/csv-import') {
      toggleEntryVisibility(link, canCsv);
    }
    if (href === '/setting' || href === '/setting.html') {
      toggleEntryVisibility(link, canSettingPage);
    }
    if (href === '/fitting-demo.html' || href === '/fitting-demo') {
      toggleEntryVisibility(link, canFittingPage);
    }
  });
}

function buildJsonHeaders() {
  return {
    'Content-Type': 'application/json',
    ...getApiAuthHeaders()
  };
}

function getApiErrorMessage(data, fallbackMessage) {
  if (data && typeof data === 'object') {
    const rawError = data.error;
    if (rawError && typeof rawError === 'object' && rawError.message) {
      return String(rawError.message);
    }
    const serverMessage = rawError || data.message;
    if (serverMessage) return String(serverMessage);
  }
  return fallbackMessage;
}

function getSettingTabFromHash() {
  const hash = String(window.location.hash || '').replace(/^#/, '').trim();
  return SETTING_TABS.includes(hash) ? hash : 'general';
}

function getSettingPanelByTab(tab) {
  if (tab === 'accounts') return el.settingPanelAccounts;
  if (tab === 'trials') return el.settingPanelTrials;
  return el.settingPanelGeneral;
}

function setSettingTab(tab, { updateHash = true } = {}) {
  const nextTab = SETTING_TABS.includes(tab) ? tab : 'general';
  currentSettingTab = nextTab;

  if (el.settingSubnav) {
    Array.from(el.settingSubnav.querySelectorAll('[data-setting-tab]')).forEach((button) => {
      const buttonTab = String(button.getAttribute('data-setting-tab') || '').trim();
      const isActive = buttonTab === nextTab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  SETTING_TABS.forEach((itemTab) => {
    const panel = getSettingPanelByTab(itemTab);
    if (!panel) return;
    panel.hidden = itemTab !== nextTab;
  });

  if (updateHash) {
    const hash = `#${nextTab}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }
  }

  ensureSettingTabData(nextTab).catch((error) => {
    const message = error?.message || '設定子頁資料載入失敗';
    if (nextTab === 'accounts') {
      setAdminMessage(el.adminUserMessage, message, 'err');
      return;
    }
    if (nextTab === 'trials') {
      setAdminMessage(el.adminTrialMessage, message, 'err');
    }
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const locale = currentLang === 'zh-Hant'
    ? 'zh-TW'
    : (currentLang === 'zh-Hans' ? 'zh-CN' : currentLang);
  return date.toLocaleString(locale);
}

function humanizeSnakeCase(text) {
  const input = String(text || '').trim();
  if (!input) return '-';
  return input
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatEventTypeLabel(eventType) {
  const normalized = String(eventType || '').trim().toLowerCase();
  if (!normalized) return '-';
  const map = {
    sale_completed: 'Sale Completed',
    enter_fitting_room: 'Enter Fitting Room',
    exit_fitting_room: 'Exit Fitting Room',
    left_fitting_room: 'Left Fitting Room',
    move_to_checkout: 'Move To Checkout',
    return_to_sales_floor: 'Return To Sales Floor',
    tag_seen: 'Tag Seen'
  };
  return map[normalized] || humanizeSnakeCase(normalized);
}

function normalizeStateFromZone(zone) {
  const normalized = String(zone || '').trim().toLowerCase();
  if (normalized === 'fitting_room') return 'FITTING_ROOM';
  if (normalized === 'checkout') return 'CHECKOUT';
  if (normalized === 'sold') return 'SOLD';
  return 'RACK';
}

function formatZoneLabel(zone) {
  if (!zone) return '-';
  const state = normalizeStateFromZone(zone);
  return t(`state.${state}`);
}

function trimLogList(node, max = MAX_ACTIVITY_ITEMS) {
  if (!node) return;
  while (node.children.length > max) {
    node.removeChild(node.lastElementChild);
  }
}

function inferActivityTransition(event = {}) {
  const fromZone = String(event?.from_zone || '').trim();
  const toZone = String(event?.to_zone || '').trim();
  if (fromZone && toZone) {
    const fromStateByZone = normalizeStateFromZone(fromZone);
    const toStateByZone = normalizeStateFromZone(toZone);
    if (fromStateByZone !== toStateByZone) {
      return { fromState: fromStateByZone, toState: toStateByZone };
    }
  }

  const eventType = String(event?.event_type || '').trim().toLowerCase();
  if (eventType === 'sale_completed') return { fromState: 'CHECKOUT', toState: 'SOLD' };
  if (eventType === 'enter_fitting_room') return { fromState: 'RACK', toState: 'FITTING_ROOM' };
  if (eventType === 'move_to_checkout') return { fromState: 'FITTING_ROOM', toState: 'CHECKOUT' };
  if (eventType === 'exit_fitting_room' || eventType === 'left_fitting_room' || eventType === 'return_to_sales_floor') {
    return { fromState: 'FITTING_ROOM', toState: 'RACK' };
  }

  return null;
}

function resolveEventProductName(event = {}, productsByKey = new Map()) {
  const key = productKeyFromEvent(event);
  const product = key ? productsByKey.get(key) : null;
  return product?.display_name
    || product?.name_en
    || product?.name
    || String(event?.epc_data || '').trim()
    || t('dashboard.unnamedProduct');
}

function renderActivityTimelineFromEvents(recentEvents = [], products = []) {
  if (!el.activityTimeline) return;
  const productsByKey = new Map();
  (Array.isArray(products) ? products : []).forEach((product) => {
    const key = productKeyFromProduct(product);
    if (!key) return;
    productsByKey.set(key, product);
  });

  el.activityTimeline.innerHTML = '';
  (Array.isArray(recentEvents) ? recentEvents : [])
    .map((event) => {
      const transition = inferActivityTransition(event);
      if (!transition) return null;
      return {
        name: resolveEventProductName(event, productsByKey),
        fromState: transition.fromState,
        toState: transition.toState,
        timestamp: event?.timestamp || null
      };
    })
    .filter(Boolean)
    .slice(0, MAX_ACTIVITY_ITEMS)
    .forEach((entry) => appendActivityLog(entry));
}

function renderEventLogList(recentEvents = []) {
  if (!el.eventLog) return;
  el.eventLog.innerHTML = '';
  (Array.isArray(recentEvents) ? recentEvents : [])
    .slice(0, MAX_ACTIVITY_ITEMS)
    .forEach((event) => appendEventLog(event));
}

function toLocalDatetimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDatetimeInputValue(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function getAdminApiError(error, fallback = '操作失敗') {
  return error?.message || fallback;
}

function setAdminMessage(node, message, level = 'warn') {
  if (!node) return;
  node.textContent = String(message || '');
  node.classList.remove('text-ok', 'text-warn', 'text-err');
  if (message) {
    node.classList.add(`text-${level}`);
  }
}

function resetAdminUserForm() {
  if (!el.adminUserForm) return;
  el.adminUserForm.reset();
  if (el.adminUserEditingId) el.adminUserEditingId.value = '';
  if (el.adminUserEmail) el.adminUserEmail.disabled = false;
  if (el.adminUserDeleteButton) el.adminUserDeleteButton.hidden = true;
  if (el.adminUserSubmitButton) el.adminUserSubmitButton.textContent = '建立帳號';
}

function syncAdminUserTrialInputState() {
  if (!el.adminUserRole || !el.adminUserTrialExpiresAt) return;
  const isTrial = String(el.adminUserRole.value || '') === 'trial';
  el.adminUserTrialExpiresAt.disabled = !isTrial;
  if (!isTrial) {
    el.adminUserTrialExpiresAt.value = '';
  }
}

function fillAdminUserForm(user) {
  if (!user) return;
  if (el.adminUserEditingId) el.adminUserEditingId.value = String(user.user_id || '');
  if (el.adminUserEmail) {
    el.adminUserEmail.value = String(user.email || '');
    el.adminUserEmail.disabled = true;
  }
  if (el.adminUserFullName) el.adminUserFullName.value = String(user.full_name || '');
  if (el.adminUserCompanyName) el.adminUserCompanyName.value = String(user.company_name || '');
  if (el.adminUserJobTitle) el.adminUserJobTitle.value = String(user.job_title || '');
  if (el.adminUserRole) el.adminUserRole.value = String(user.role || 'guest');
  if (el.adminUserStatus) el.adminUserStatus.value = String(user.status || 'active');
  if (el.adminUserTrialExpiresAt) el.adminUserTrialExpiresAt.value = toLocalDatetimeInputValue(user.trial_expires_at);
  if (el.adminUserDeleteButton) el.adminUserDeleteButton.hidden = false;
  if (el.adminUserSubmitButton) el.adminUserSubmitButton.textContent = '儲存變更';
  syncAdminUserTrialInputState();
}

function getAdminUserPayloadFromForm() {
  const role = String(el.adminUserRole?.value || '').trim();
  const payload = {
    full_name: String(el.adminUserFullName?.value || '').trim(),
    company_name: String(el.adminUserCompanyName?.value || '').trim(),
    job_title: String(el.adminUserJobTitle?.value || '').trim(),
    role,
    status: String(el.adminUserStatus?.value || '').trim()
  };

  if (!payload.full_name || !payload.company_name || !payload.job_title || !payload.role || !payload.status) {
    throw new Error('請完整填寫帳號資料');
  }

  if (!el.adminUserEditingId?.value) {
    payload.email = String(el.adminUserEmail?.value || '').trim().toLowerCase();
    if (!payload.email) throw new Error('請填寫有效 Email');
  }

  if (role === 'trial') {
    const trialIso = fromLocalDatetimeInputValue(el.adminUserTrialExpiresAt?.value);
    if (!trialIso) throw new Error('trial 角色需要有效到期時間');
    payload.trial_expires_at = trialIso;
  }

  return payload;
}

async function adminApiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...buildJsonHeaders(),
      ...(options.headers || {})
    }
  });
  const { data, rawText, parsed } = await parseApiResponse(response, `admin:${path}`);
  if (!response.ok) {
    if (!parsed) {
      const fallbackText = String(rawText || '').trim();
      throw new Error(fallbackText || 'Admin API failed');
    }
    throw new Error(getApiErrorMessage(data, 'Admin API failed'));
  }
  return data;
}

function renderAdminUserRows() {
  if (!el.adminUserTableBody) return;
  const rows = adminUserState.items;
  el.adminUserTableBody.innerHTML = rows
    .map((row) => {
      const userId = escapeHtml(row.user_id || '');
      return `
        <tr>
          <td>${escapeHtml(row.email || '-')}</td>
          <td>
            <strong>${escapeHtml(row.full_name || '-')}</strong><br />
            <span class="hint">${escapeHtml(row.company_name || '-')}</span>
          </td>
          <td>${escapeHtml(row.role || '-')}</td>
          <td>${escapeHtml(row.status || '-')}</td>
          <td>${escapeHtml(formatDateTime(row.trial_expires_at))}</td>
          <td>
            <div class="setting-row-actions">
              <button type="button" class="button-secondary" data-user-action="edit" data-user-id="${userId}">編輯</button>
              <button type="button" class="button-danger" data-user-action="delete" data-user-id="${userId}">刪除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  if (el.adminUserEmptyHint) {
    el.adminUserEmptyHint.hidden = rows.length > 0;
  }
  if (el.adminUserLoadMoreButton) {
    el.adminUserLoadMoreButton.hidden = rows.length >= adminUserState.total;
    el.adminUserLoadMoreButton.disabled = adminUserState.loading;
  }
}

function renderAdminUserMeta(meta = {}) {
  const total = Number(meta.total ?? adminUserState.total ?? 0);
  const activeAdmins = Number(meta.active_admin_count ?? 0);
  if (el.adminUserTotalBadge) el.adminUserTotalBadge.textContent = `帳號總數：${total}`;
  if (el.adminActiveAdminBadge) el.adminActiveAdminBadge.textContent = `啟用 admin：${activeAdmins}`;
}

async function fetchAdminUsers({ append = false } = {}) {
  if (adminUserState.loading) return;
  adminUserState.loading = true;
  setAdminMessage(el.adminUserMessage, '帳號資料讀取中...', 'warn');

  try {
    const page = append ? adminUserState.page + 1 : 1;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(ADMIN_PAGE_SIZE)
    });
    if (adminUserState.filters.q) params.set('q', adminUserState.filters.q);
    if (adminUserState.filters.role) params.set('role', adminUserState.filters.role);
    if (adminUserState.filters.status) params.set('status', adminUserState.filters.status);

    const data = await adminApiFetch(`/api/admin/users?${params.toString()}`);
    const incoming = Array.isArray(data?.items) ? data.items : [];
    adminUserState.page = Number(data?.page || page);
    adminUserState.total = Number(data?.total || incoming.length);
    adminUserState.loaded = true;
    adminUserState.items = append ? [...adminUserState.items, ...incoming] : incoming;
    renderAdminUserRows();
    renderAdminUserMeta(data);
    setAdminMessage(el.adminUserMessage, `已載入 ${adminUserState.items.length} / ${adminUserState.total} 筆`, 'ok');
  } catch (error) {
    setAdminMessage(el.adminUserMessage, getAdminApiError(error, '帳號資料讀取失敗'), 'err');
  } finally {
    adminUserState.loading = false;
    renderAdminUserRows();
  }
}

function renderTrialRows() {
  if (!el.adminTrialTableBody) return;
  const rows = adminTrialState.items;
  el.adminTrialTableBody.innerHTML = rows
    .map((row) => {
      const mailResult = row.request_status === 'email_sent'
        ? `寄送成功 (${escapeHtml(row.resend_message_id || '-')})`
        : (row.error_message ? `失敗：${escapeHtml(row.error_message)}` : '-');
      return `
        <tr>
          <td>
            <strong>${escapeHtml(row.full_name || '-')}</strong><br />
            <span class="hint">${escapeHtml(row.company_name || '-')}</span>
          </td>
          <td>${escapeHtml(row.email || '-')}</td>
          <td>${escapeHtml(formatDateTime(row.created_at))}</td>
          <td>${escapeHtml(row.request_status || '-')}</td>
          <td>${mailResult}</td>
        </tr>
      `;
    })
    .join('');

  if (el.adminTrialEmptyHint) {
    el.adminTrialEmptyHint.hidden = rows.length > 0;
  }
  if (el.adminTrialLoadMoreButton) {
    el.adminTrialLoadMoreButton.hidden = rows.length >= adminTrialState.total;
    el.adminTrialLoadMoreButton.disabled = adminTrialState.loading;
  }
}

async function fetchTrialRequests({ append = false } = {}) {
  if (adminTrialState.loading) return;
  adminTrialState.loading = true;
  setAdminMessage(el.adminTrialMessage, 'Trial 申請紀錄讀取中...', 'warn');

  try {
    const page = append ? adminTrialState.page + 1 : 1;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(ADMIN_PAGE_SIZE)
    });
    if (adminTrialState.filters.q) params.set('q', adminTrialState.filters.q);
    if (adminTrialState.filters.status) params.set('status', adminTrialState.filters.status);

    const data = await adminApiFetch(`/api/admin/trial-requests?${params.toString()}`);
    const incoming = Array.isArray(data?.items) ? data.items : [];
    adminTrialState.page = Number(data?.page || page);
    adminTrialState.total = Number(data?.total || incoming.length);
    adminTrialState.loaded = true;
    adminTrialState.items = append ? [...adminTrialState.items, ...incoming] : incoming;
    renderTrialRows();
    setAdminMessage(el.adminTrialMessage, `已載入 ${adminTrialState.items.length} / ${adminTrialState.total} 筆`, 'ok');
  } catch (error) {
    setAdminMessage(el.adminTrialMessage, getAdminApiError(error, 'Trial 申請紀錄讀取失敗'), 'err');
  } finally {
    adminTrialState.loading = false;
    renderTrialRows();
  }
}

async function handleAdminUserSubmit(event) {
  event.preventDefault();
  try {
    const editingId = String(el.adminUserEditingId?.value || '').trim();
    const payload = getAdminUserPayloadFromForm();
    if (!editingId) {
      await adminApiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setAdminMessage(el.adminUserMessage, '帳號建立成功', 'ok');
    } else {
      await adminApiFetch(`/api/admin/users/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setAdminMessage(el.adminUserMessage, '帳號更新成功', 'ok');
    }
    resetAdminUserForm();
    await fetchAdminUsers({ append: false });
  } catch (error) {
    setAdminMessage(el.adminUserMessage, getAdminApiError(error, '帳號操作失敗'), 'err');
  }
}

async function handleDeleteUserById(userId) {
  if (!userId) return;
  const ok = window.confirm('確定要刪除此帳號？此操作不可還原。');
  if (!ok) return;
  try {
    await adminApiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
    setAdminMessage(el.adminUserMessage, '帳號刪除成功', 'ok');
    const editingId = String(el.adminUserEditingId?.value || '').trim();
    if (editingId === userId) {
      resetAdminUserForm();
    }
    await fetchAdminUsers({ append: false });
  } catch (error) {
    setAdminMessage(el.adminUserMessage, getAdminApiError(error, '帳號刪除失敗'), 'err');
  }
}

async function ensureSettingTabData(tab = currentSettingTab) {
  if (tab === 'accounts' && !adminUserState.loaded) {
    await fetchAdminUsers({ append: false });
  }
  if (tab === 'trials' && !adminTrialState.loaded) {
    await fetchTrialRequests({ append: false });
  }
}

function applyAdminUserFiltersFromInputs() {
  adminUserState.filters.q = String(el.adminUserSearch?.value || '').trim();
  adminUserState.filters.role = String(el.adminUserRoleFilter?.value || '').trim();
  adminUserState.filters.status = String(el.adminUserStatusFilter?.value || '').trim();
  adminUserState.page = 1;
  adminUserState.total = 0;
  adminUserState.items = [];
  adminUserState.loaded = false;
  fetchAdminUsers({ append: false });
}

function applyAdminTrialFiltersFromInputs() {
  adminTrialState.filters.q = String(el.adminTrialSearch?.value || '').trim();
  adminTrialState.filters.status = String(el.adminTrialStatusFilter?.value || '').trim();
  adminTrialState.page = 1;
  adminTrialState.total = 0;
  adminTrialState.items = [];
  adminTrialState.loaded = false;
  fetchTrialRequests({ append: false });
}

function normalizeConflictDisplayValue(value) {
  if (value == null) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((v) => normalizeConflictDisplayValue(v)).join(', ')}]`;
  }
  if (typeof value === 'string') return value;
  return String(value);
}

function formatSkuConflictDetails(errorData) {
  if (!errorData || typeof errorData !== 'object') return null;
  if (errorData.error_code !== 'SKU_CONFLICT') return null;

  const scope = String(errorData.scope || '').trim() || 'unknown';
  const scopeLabel = scope === 'in_file' ? '檔內衝突' : (scope === 'against_db' ? '與資料庫衝突' : scope);
  const conflicts = Array.isArray(errorData.conflicts) ? errorData.conflicts : [];

  const lines = [
    `錯誤代碼：${errorData.error_code}`,
    `衝突範圍：${scopeLabel}`
  ];

  if (conflicts.length === 0) {
    lines.push('衝突明細：無');
    return lines.join('\n');
  }

  lines.push('衝突明細：');
  conflicts.forEach((conflict, index) => {
    const sku = String(conflict?.sku || '').trim() || 'UNKNOWN_SKU';
    lines.push(`${index + 1}. SKU=${sku}`);
    const fields = conflict?.fields && typeof conflict.fields === 'object' ? conflict.fields : {};
    Object.entries(fields).forEach(([field, diff]) => {
      lines.push(
        `   - ${field}: incoming=${normalizeConflictDisplayValue(diff?.incoming)} / existing=${normalizeConflictDisplayValue(diff?.existing)}`
      );
    });
  });

  return lines.join('\n');
}

function normalizeSupabaseError(error) {
  if (!error || typeof error !== 'object') return null;
  return {
    code: error.code || null,
    message: error.message || null,
    details: error.details || null,
    hint: error.hint || null,
    status: error.status || null,
    name: error.name || null
  };
}

function inferSchemaMismatchFromError(error, tableName) {
  const e = normalizeSupabaseError(error);
  const haystack = [e?.message, e?.details, e?.hint].filter(Boolean).join(' | ');
  const missingColumnMatch = haystack.match(/column\s+([^\s]+)\s+does\s+not\s+exist/i);
  const missingTableMatch = haystack.match(/relation\s+([^\s]+)\s+does\s+not\s+exist/i);
  const undefinedFunctionMatch = haystack.match(/function\s+([^\s(]+)\s*\(/i);
  return {
    hasError: !!e,
    tableName,
    pgCode: e?.code || null,
    isBadRequestLike: e?.code === '42703' || e?.code === '42P01' || e?.status === 400,
    isServerErrorLike: Number(e?.status) >= 500,
    missingColumn: missingColumnMatch ? missingColumnMatch[1] : null,
    missingTable: missingTableMatch ? missingTableMatch[1] : null,
    maybeUndefinedFunction: undefinedFunctionMatch ? undefinedFunctionMatch[1] : null,
    raw: e
  };
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
    return { data: null, contentType, rawText, parsed: true };
  }

  try {
    const data = JSON.parse(rawText);
    return { data, contentType, rawText, parsed: true };
  } catch (error) {
    console.error(`[api:${tag}] JSON parse failed`, error);
    if (!response.ok) {
      return { data: null, contentType, rawText, parsed: false };
    }
    throw new Error(t('error.apiNotJson', { status: response.status }));
  }
}

function decodeSGTIN96(hex) {
  const normalized = String(hex || '').trim();
  if (!isValidEpcData(normalized)) {
    throw new Error(t('error.epcMust24Hex'));
  }

  const binary = BigInt(`0x${normalized}`).toString(2).padStart(96, '0');
  const partition = parseInt(binary.substring(11, 14), 2);
  const spec = SGTIN96_PARTITIONS[partition];
  if (!spec) {
    throw new Error(`Unsupported partition: ${partition}`);
  }

  const companyStart = 14;
  const companyEnd = companyStart + spec.companyPrefixBits;
  const itemEnd = companyEnd + spec.itemReferenceBits;
  const companyPrefixBin = binary.substring(companyStart, companyEnd);
  const itemReferenceBin = binary.substring(companyEnd, itemEnd);
  const serialBin = binary.substring(58, 96);

  return {
    companyPrefix: BigInt(`0b${companyPrefixBin}`).toString().padStart(spec.companyPrefixDigits, '0'),
    itemReference: BigInt(`0b${itemReferenceBin}`).toString().padStart(spec.itemReferenceDigits, '0'),
    serial: BigInt(`0b${serialBin}`).toString(),
    partition
  };
}

function toFixedBin(value, bits, fieldName) {
  const num = BigInt(value);
  if (num < 0n) throw new Error(`${fieldName} must be >= 0`);
  const binary = num.toString(2);
  if (binary.length > bits) {
    throw new Error(`${fieldName} exceeds ${bits} bits`);
  }
  return binary.padStart(bits, '0');
}

function encodeSGTIN96({ companyPrefix, itemReference, serial, partition = 5, filter = 1 }) {
  const partitionValue = Number(partition);
  const filterValue = Number(filter);
  const spec = SGTIN96_PARTITIONS[partitionValue];
  if (!spec) throw new Error(`Unsupported partition: ${partitionValue}`);
  if (!Number.isInteger(filterValue) || filterValue < 0 || filterValue > 7) {
    throw new Error('Filter must be 0~7');
  }

  const cp = String(companyPrefix ?? '').trim();
  const ir = String(itemReference ?? '').trim();
  const serialText = String(serial ?? '').trim();
  if (!/^\d+$/.test(cp)) throw new Error('companyPrefix must be numeric');
  if (!/^\d+$/.test(ir)) throw new Error('itemReference must be numeric');
  if (!/^\d+$/.test(serialText)) throw new Error('serial must be numeric');

  const cpPadded = cp.padStart(spec.companyPrefixDigits, '0');
  const irPadded = ir.padStart(spec.itemReferenceDigits, '0');

  const binary = [
    toFixedBin(48, 8, 'header'),
    toFixedBin(filterValue, 3, 'filter'),
    toFixedBin(partitionValue, 3, 'partition'),
    toFixedBin(cpPadded, spec.companyPrefixBits, 'companyPrefix'),
    toFixedBin(irPadded, spec.itemReferenceBits, 'itemReference'),
    toFixedBin(serialText, 38, 'serial')
  ].join('');

  return BigInt(`0b${binary}`).toString(16).toUpperCase().padStart(24, '0');
}

function groupedCsvToRows(text) {
  const rows = csvToRows(text);
  const required = ['style_no', 'item_no', 'sku_ean13', 'product_name', 'color', 'size', 'quantity', 'price_usd'];
  rows.forEach((row) => {
    required.forEach((field) => {
      if (!(field in row)) {
        throw new Error(`Missing required field: ${field}`);
      }
    });
  });
  return rows;
}

function detectGroupedCsvSkuConflicts(groupedRows = []) {
  const baselineBySku = new Map();
  const conflictsBySku = new Map();
  const fieldsToCheck = ['product_name', 'color', 'size', 'price_usd'];

  const normalizeValue = (field, value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (field === 'price_usd') {
      const num = Number(text);
      return Number.isFinite(num) ? String(num) : text;
    }
    return text;
  };

  groupedRows.forEach((row) => {
    const sku = String(row?.sku_ean13 || '').trim();
    if (!sku) return;

    const current = {
      product_name: normalizeValue('product_name', row?.product_name),
      color: normalizeValue('color', row?.color),
      size: normalizeValue('size', row?.size),
      price_usd: normalizeValue('price_usd', row?.price_usd)
    };

    if (!baselineBySku.has(sku)) {
      baselineBySku.set(sku, current);
      return;
    }

    const baseline = baselineBySku.get(sku);
    const fieldConflicts = {};
    fieldsToCheck.forEach((field) => {
      if (baseline[field] !== current[field]) {
        fieldConflicts[field] = [baseline[field], current[field]].filter((v) => v != null);
      }
    });

    if (Object.keys(fieldConflicts).length > 0) {
      const existing = conflictsBySku.get(sku) || { sku, fields: {} };
      Object.entries(fieldConflicts).forEach(([field, values]) => {
        const set = existing.fields[field] || new Set();
        values.forEach((v) => set.add(v));
        existing.fields[field] = set;
      });
      conflictsBySku.set(sku, existing);
    }
  });

  return [...conflictsBySku.values()].map((row) => ({
    sku: row.sku,
    fields: Object.fromEntries(Object.entries(row.fields).map(([field, set]) => [field, [...set]]))
  }));
}

async function previewGroupedCsvFile() {
  if (!el.groupedPreviewResult) return;

  const file = el.groupedCsvFile?.files?.[0];
  if (!file) {
    el.groupedPreviewResult.textContent = t('importGrouped.previewEmpty');
    return;
  }

  try {
    const partition = Number(el.groupedPartition?.value ?? 5);
    const filter = Number(el.groupedFilter?.value ?? 0);
    if (!(partition in SGTIN96_PARTITIONS)) throw new Error('partition must be 0~6');
    if (!Number.isInteger(filter) || filter < 0 || filter > 7) throw new Error('filter must be 0~7');

    const text = await file.text();
    const groupedRows = groupedCsvToRows(text);

    const serialStart = 1000001;
    let serial = serialStart;
    const sample = [];
    let expandedRows = 0;

    for (const row of groupedRows) {
      const ean13 = String(row.sku_ean13 || '').trim();
      const qty = Number(row.quantity);
      const price = Number(row.price_usd);
      if (!/^\d{13}$/.test(ean13)) throw new Error(`Invalid EAN13 at line ${row.__line}`);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error(`Invalid quantity at line ${row.__line}`);
      if (!Number.isFinite(price)) throw new Error(`Invalid price_usd at line ${row.__line}`);

      const { companyPrefix, itemReference } = buildItemReferenceFromEan13(ean13, partition);
      for (let i = 0; i < qty; i += 1) {
        const epc = encodeSGTIN96({ companyPrefix, itemReference, serial, partition, filter });
        expandedRows += 1;
        if (sample.length < 20) {
          sample.push({ line: row.__line, sku: ean13, serial, epc });
        }
        serial += 1;
      }
    }

    const serialEnd = expandedRows > 0 ? (serialStart + expandedRows - 1) : null;
    const conflicts = detectGroupedCsvSkuConflicts(groupedRows);
    const detailRows = groupedRows.slice(0, 50);
    const uniqueStyles = new Set(groupedRows.map((row) => String(row.style_no || '').trim()).filter(Boolean));
    const uniqueItems = new Set(groupedRows.map((row) => String(row.item_no || '').trim()).filter(Boolean));

    const validationRows = [];
    groupedRows.forEach((row) => {
      const ean13 = String(row.sku_ean13 || '').trim();
      const qty = Number(row.quantity);
      const price = Number(row.price_usd);
      if (!/^[\d]{13}$/.test(ean13)) return;
      if (!Number.isInteger(qty) || qty <= 0) return;
      if (!Number.isFinite(price)) return;

      const { companyPrefix, itemReference } = buildItemReferenceFromEan13(ean13, partition);
      const epc = encodeSGTIN96({ companyPrefix, itemReference, serial: 1000001, partition, filter });
      validationRows.push({
        epc_data: epc,
        product_name: String(row.product_name || '').trim(),
        name_en: String(row.product_name || '').trim(),
        sku: ean13,
        style_no: String(row.style_no || '').trim(),
        item_no: String(row.item_no || '').trim(),
        size: String(row.size || '').trim(),
        color: String(row.color || '').trim(),
        price
      });
    });

    let dbConflicts = [];
    let dbCheckError = null;
    try {
      const response = await fetch('/api/bulk-products', {
        method: 'POST',
        headers: buildJsonHeaders(),
        body: JSON.stringify({ rows: validationRows, validate_only: true })
      });
      const { data: result } = await parseApiResponse(response, 'grouped-preview-validate-only');
      if (!response.ok) {
        if (result?.error_code === 'SKU_CONFLICT' && result?.scope === 'against_db') {
          dbConflicts = Array.isArray(result?.conflicts) ? result.conflicts : [];
        } else {
          dbCheckError = getApiErrorMessage(result, t('error.bulkImportFailed'));
        }
      }
    } catch (error) {
      dbCheckError = error?.message || 'unknown error';
    }

    const summaryRows = [
      ['file_name', file.name],
      ['grouped_rows', String(groupedRows.length)],
      ['style_rows', String(uniqueStyles.size)],
      ['item_rows', String(uniqueItems.size)],
      ['expanded_rows', String(expandedRows)],
      ['partition', String(partition)],
      ['filter', String(filter)],
      ['serial_start', serialEnd == null ? '-' : String(serialStart)],
      ['serial_end', serialEnd == null ? '-' : String(serialEnd)],
      ['sku_conflicts', String(conflicts.length)],
      ['db_conflicts', String(dbConflicts.length)]
    ];

    const summaryTable = `
      <h4>${escapeHtml(t('importGrouped.preview.summary'))}</h4>
      <table class="preview-table">
        <thead>
          <tr>
            <th>${escapeHtml(t('importGrouped.preview.field'))}</th>
            <th>${escapeHtml(t('importGrouped.preview.value'))}</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows.map(([field, value]) => `
            <tr>
              <td>${escapeHtml(field)}</td>
              <td>${escapeHtml(value)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const sampleTable = `
      <h4>${escapeHtml(t('importGrouped.preview.sample'))}</h4>
      <table class="preview-table">
        <thead>
          <tr>
            <th>${escapeHtml(t('importGrouped.preview.line'))}</th>
            <th>${escapeHtml(t('importGrouped.preview.sku'))}</th>
            <th>${escapeHtml(t('importGrouped.preview.serial'))}</th>
            <th>${escapeHtml(t('importGrouped.preview.epc'))}</th>
          </tr>
        </thead>
        <tbody>
          ${sample.map((row) => `
            <tr>
              <td>${escapeHtml(String(row.line))}</td>
              <td>${escapeHtml(row.sku)}</td>
              <td>${escapeHtml(String(row.serial))}</td>
              <td><code>${escapeHtml(row.epc)}</code></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const detailTable = `
      <h4>${escapeHtml(t('importGrouped.preview.detail'))}</h4>
      <div class="preview-table-wrap">
        <table class="preview-table">
          <thead>
            <tr>
              <th>${escapeHtml(t('importGrouped.preview.line'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.styleNo'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.itemNo'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.sku'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.productName'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.color'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.size'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.price'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.quantity'))}</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row) => `
              <tr>
                <td>${escapeHtml(String(row.__line ?? '-'))}</td>
                <td>${escapeHtml(String(row.style_no || ''))}</td>
                <td>${escapeHtml(String(row.item_no || ''))}</td>
                <td>${escapeHtml(String(row.sku_ean13 || ''))}</td>
                <td>${escapeHtml(String(row.product_name || ''))}</td>
                <td>${escapeHtml(String(row.color || ''))}</td>
                <td>${escapeHtml(String(row.size || ''))}</td>
                <td>${escapeHtml(String(row.price_usd || ''))}</td>
                <td>${escapeHtml(String(row.quantity || ''))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const hasAnyConflict = conflicts.length > 0 || dbConflicts.length > 0 || Boolean(dbCheckError);
    const conflictSummaryTable = hasAnyConflict
      ? `
        <div class="preview-conflicts" role="alert">
          ${conflicts.length > 0
            ? `
              <h4>${escapeHtml(t('importGrouped.preview.conflictTitle'))}</h4>
              <ul>
                ${conflicts.map((conflict) => Object.entries(conflict.fields).map(([field, values]) => `
                  <li>${escapeHtml(t('importGrouped.preview.conflictItem', {
                    sku: conflict.sku,
                    field,
                    values: (values || []).join(', ')
                  }))}</li>
                `).join('')).join('')}
              </ul>
            `
            : ''}
          ${dbCheckError
            ? `
              <h4>${escapeHtml(t('importGrouped.preview.dbConflictTitle'))}</h4>
              <div>${escapeHtml(t('importGrouped.preview.dbCheckFailed', { message: dbCheckError }))}</div>
            `
            : ''}
          ${!dbCheckError && dbConflicts.length > 0
            ? `
              <h4>${escapeHtml(t('importGrouped.preview.dbConflictTitle'))}</h4>
              <ul>
                ${dbConflicts.map((conflict) => Object.entries(conflict.fields || {}).map(([field, detail]) => {
                  const values = Array.isArray(detail?.existing)
                    ? detail.existing
                    : [detail?.existing, detail?.incoming].filter((v) => v != null);
                  return `
                    <li>${escapeHtml(t('importGrouped.preview.dbConflictItem', {
                      sku: conflict.sku,
                      field,
                      values: values.join(', ')
                    }))}</li>
                  `;
                }).join('')).join('')}
              </ul>
            `
            : ''}
        </div>
      `
      : `
        <div class="preview-ok">${escapeHtml(t('importGrouped.preview.noConflict'))}</div>
      `;

    el.groupedPreviewResult.innerHTML = `
      <div class="preview-block">${summaryTable}</div>
      <div class="preview-block">${conflictSummaryTable}</div>
      <div class="preview-block">${detailTable}</div>
      <div class="preview-block">${sampleTable}</div>
    `;
  } catch (error) {
    el.groupedPreviewResult.innerHTML = `
      <div class="preview-block">
        <h4>${escapeHtml(t('importGrouped.preview.error'))}</h4>
        <table class="preview-table">
          <thead>
            <tr>
              <th>${escapeHtml(t('importGrouped.preview.field'))}</th>
              <th>${escapeHtml(t('importGrouped.preview.value'))}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>message</td>
              <td>${escapeHtml(t('error.groupedImportFailed', { message: error.message }))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
}

function buildItemReferenceFromEan13(ean13, partition) {
  const spec = SGTIN96_PARTITIONS[partition];
  const base12 = String(ean13).slice(0, 12);
  const cpDigits = spec.companyPrefixDigits;
  const cp = base12.slice(0, cpDigits);
  const rest = base12.slice(cpDigits);
  // 若 partition 需要多 1 位，補 0 作為 indicator。
  const itemReference = rest.padStart(spec.itemReferenceDigits, '0');
  return { companyPrefix: cp, itemReference };
}

async function handleGroupedCsvImport(event) {
  event.preventDefault();
  console.log('[grouped-import] submit triggered', {
    at: new Date().toISOString(),
    hasForm: !!el.groupedCsvImportForm,
    hasFileInput: !!el.groupedCsvFile,
    hasResultBox: !!el.groupedImportResult,
    fileSelected: !!el.groupedCsvFile?.files?.[0],
    role: String(getSession()?.profile?.role || '').trim() || 'unknown'
  });

  if (!canUseCsvImport()) {
    console.warn('[grouped-import] blocked by role policy', {
      at: new Date().toISOString(),
      role: String(getSession()?.profile?.role || '').trim() || 'unknown'
    });
    el.groupedImportResult.textContent = [
      '匯入失敗',
      '原因：trial 角色無匯入權限',
      '資料筆數（inventory_items）：0',
      '產品總數（products）：0'
    ].join('\n');
    return;
  }

  const file = el.groupedCsvFile.files?.[0];
  if (!file) {
    console.warn('[grouped-import] no file selected');
    return;
  }

  try {
    const partition = Number(el.groupedPartition?.value ?? 5);
    const filter = Number(el.groupedFilter?.value ?? 1);
    if (!(partition in SGTIN96_PARTITIONS)) throw new Error('partition must be 0~6');
    if (!Number.isInteger(filter) || filter < 0 || filter > 7) throw new Error('filter must be 0~7');

    const text = await file.text();
    const groupedRows = groupedCsvToRows(text);

    let serial = 1000001;
    const rows = [];
    for (const row of groupedRows) {
      const ean13 = String(row.sku_ean13 || '').trim();
      const qty = Number(row.quantity);
      const price = Number(row.price_usd);
      if (!/^\d{13}$/.test(ean13)) throw new Error(`Invalid EAN13 at line ${row.__line}`);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error(`Invalid quantity at line ${row.__line}`);
      if (!Number.isFinite(price)) throw new Error(`Invalid price_usd at line ${row.__line}`);

      const { companyPrefix, itemReference } = buildItemReferenceFromEan13(ean13, partition);
      for (let i = 0; i < qty; i += 1) {
        const epc = encodeSGTIN96({
          companyPrefix,
          itemReference,
          serial,
          partition,
          filter
        });

        rows.push({
          epc_data: epc,
          product_name: String(row.product_name || '').trim(),
          name_en: String(row.product_name || '').trim(),
          sku: ean13,
          style_no: String(row.style_no || '').trim(),
          item_no: String(row.item_no || '').trim(),
          size: String(row.size || '').trim(),
          color: String(row.color || '').trim(),
          price: price
        });
        serial += 1;
      }
    }

    const response = await fetch('/api/bulk-products', {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ rows })
    });

    const { data: result } = await parseApiResponse(response, 'grouped-bulk-products');
    if (!response.ok) {
      const skuConflictDetails = formatSkuConflictDetails(result);
      const baseMessage = getApiErrorMessage(result, t('error.bulkImportFailed'));
      throw new Error(skuConflictDetails ? `${baseMessage}\n${skuConflictDetails}` : baseMessage);
    }

    const productCount = Number(result?.affected);
    const inventoryCount = Number(result?.inventory_items_upserted);
    el.groupedImportResult.textContent = [
      '匯入成功',
      `資料筆數（inventory_items）：${Number.isFinite(inventoryCount) ? inventoryCount : rows.length}`,
      `產品總數（products）：${Number.isFinite(productCount) ? productCount : '-'}`
    ].join('\n');

    await fetchAndRenderDashboard();
  } catch (error) {
    console.error('[grouped-import] failed', error);
    el.groupedImportResult.textContent = [
      '匯入失敗',
      `原因：${error?.message || '未知錯誤'}`,
      '資料筆數（inventory_items）：0',
      '產品總數（products）：0'
    ].join('\n');
  }
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

function buildLatestEventByEpc(events = []) {
  const map = new Map();
  events.forEach((event) => {
    const epc = String(event?.epc_data || '').trim();
    if (!epc) return;
    const current = map.get(epc);
    if (!current || new Date(event.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      map.set(epc, event);
    }
  });
  return map;
}

function resolveSkuValue(...candidates) {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return '';
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
  const stateFromEvent = latestEvent ? normalizeStateFromEvent(latestEvent) : 'RACK';
  const eventMs = Date.parse(latestEvent?.timestamp);
  const eventAgeMs = Number.isFinite(eventMs) ? (nowMs - eventMs) : null;
  if (presence) {
    const lastSeenMs = Date.parse(presence.last_seen_at);
    const enteredMs = Date.parse(presence.entered_at);
    const lastSeenAgeMs = Number.isFinite(lastSeenMs) ? (nowMs - lastSeenMs) : null;
    const enteredAgeMs = Number.isFinite(enteredMs) ? (nowMs - enteredMs) : null;
    if (Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= FITTING_EXIT_TIMEOUT_MS) {
      const abnormal = Number.isFinite(enteredMs) && nowMs - enteredMs >= overstayMs;
      return { state: 'FITTING_ROOM', abnormal };
    }

    console.debug('[abnormal] presence stale -> fallback event state', {
      productKey,
      stateFromEvent,
      lastSeenAgeMs,
      enteredAgeMs,
      eventAgeMs,
      fittingExitTimeoutMs: FITTING_EXIT_TIMEOUT_MS,
      overstayMs,
      lastSeenAt: presence.last_seen_at,
      enteredAt: presence.entered_at,
      eventType: latestEvent?.event_type || null,
      eventTimestamp: latestEvent?.timestamp || null
    });

    if (stateFromEvent === 'FITTING_ROOM') {
      const abnormalFromEvent = Number.isFinite(eventMs) && eventAgeMs >= overstayMs;
      return { state: 'FITTING_ROOM', abnormal: abnormalFromEvent };
    }
    return { state: stateFromEvent, abnormal: false };
  }

  // 相容舊環境：若 presence 表不可用/空值，回退到最新事件狀態。
  // 只要沒有 left/return/sale 事件覆蓋，enter_fitting_room 會維持為 FITTING_ROOM。
  // 避免切頁後因 heartbeat 缺失導致 live snapshot 掉回 0。
  if (stateFromEvent === 'FITTING_ROOM') {
    const abnormalFromEvent = Number.isFinite(eventMs) && eventAgeMs >= overstayMs;
    console.debug('[abnormal] no presence row, using latest event fallback', {
      productKey,
      stateFromEvent,
      overstayMs,
      eventAgeMs,
      abnormalFromEvent,
      note: 'fallback abnormal derived from latest fitting event timestamp',
      eventType: latestEvent?.event_type || null,
      eventTimestamp: latestEvent?.timestamp || null
    });
    return { state: 'FITTING_ROOM', abnormal: abnormalFromEvent };
  }
  const state = stateFromEvent;
  return { state, abnormal: false };
}

function getProductKeyFromInventoryItem(row = {}, productById = new Map()) {
  const productId = row?.product_id;
  const product = productById.get(productId) || null;
  if (product) {
    const keyFromProduct = productKeyFromProduct(product);
    if (keyFromProduct) return keyFromProduct;
  }

  const epc = String(row?.epc_data || '').trim();
  if (!epc) return null;
  const decoded = safeDecode(epc);
  if (!decoded) return null;
  return normalizeProductKey(decoded.companyPrefix, decoded.itemReference);
}

function buildSkuSummaryRows(products = [], events = [], presenceRows = [], inventoryRows = []) {
  const productById = new Map((products || []).map((p) => [p.id, p]));
  const latestEventByEpc = buildLatestEventByEpc(events || []);
  const presenceMap = buildPresenceMap(presenceRows || []);
  const nowMs = Date.now();
  const overstayMs = getCurrentOverstayThresholdMs();

  const skuMap = new Map();
  const seenIdentity = new Set();
  const skuResolutionStats = {
    fromInventoryItemSku: 0,
    fromProductSku: 0,
    unknownSku: 0
  };

  const normalizeSummaryField = (value) => {
    const text = String(value ?? '').trim();
    return text || null;
  };

  const normalizeSummaryPrice = (value) => {
    if (value === '' || value == null) return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return String(num);
  };

  const sourceRows = Array.isArray(inventoryRows) && inventoryRows.length > 0
    ? inventoryRows
    : (products || []).map((product) => ({
      epc_data: product?.epc_data || product?.epc,
      product_id: product?.id,
      style_no: resolveSkuValue(product?.style_no),
      item_no: resolveSkuValue(product?.item_no),
      sku: resolveSkuValue(product?.sku),
      __fromProductsFallback: true
    }));

  console.log('[product-summary] source selection', {
    productsCount: (products || []).length,
    inventoryRowsCount: (inventoryRows || []).length,
    usingInventoryRows: Array.isArray(inventoryRows) && inventoryRows.length > 0,
    sourceRowsCount: sourceRows.length,
    sourceRowsWithProductId: sourceRows.filter((row) => row?.product_id != null).length,
    sourceRowsWithoutProductId: sourceRows.filter((row) => row?.product_id == null).length,
    fallbackRowsWithEpc: sourceRows.filter((row) => String(row?.epc_data || '').trim()).length,
    fallbackRowsWithoutEpc: sourceRows.filter((row) => !String(row?.epc_data || '').trim()).length,
    sourceRowsWithSku: sourceRows.filter((row) => String(row?.sku || '').trim()).length,
    sourceRowsWithoutSku: sourceRows.filter((row) => !String(row?.sku || '').trim()).length
  });

  sourceRows.forEach((item, index) => {
    const epc = String(item?.epc_data || '').trim();
    const product = productById.get(item?.product_id) || null;
    const styleNo = resolveSkuValue(item?.style_no, product?.style_no, product?.sku);
    const itemNo = resolveSkuValue(item?.item_no, item?.sku, product?.item_no, product?.sku);
    const rawItemSku = resolveSkuValue(item?.sku);
    const rawProductSku = resolveSkuValue(product?.sku);
    const sku = resolveSkuValue(rawItemSku, rawProductSku, t('product.summary.skuUnknown'));

    if (rawItemSku) {
      skuResolutionStats.fromInventoryItemSku += 1;
    } else if (rawProductSku) {
      skuResolutionStats.fromProductSku += 1;
    } else {
      skuResolutionStats.unknownSku += 1;
    }

    const identity = epc || `${item?.product_id || 'no_product'}::${itemNo || sku}::${index}`;
    if (seenIdentity.has(identity)) return;
    seenIdentity.add(identity);

    const latestEvent = latestEventByEpc.get(epc) || null;
    const productKey = getProductKeyFromInventoryItem(item, productById);
    const presence = productKey ? presenceMap.get(productKey) : null;
    const { state } = epc
      ? deriveStateByPresence(productKey, latestEvent, presence, nowMs, overstayMs)
      : { state: String(item?.status || '').toUpperCase() === 'SOLD' ? 'SOLD' : 'UNKNOWN' };
    const location = STATES.includes(state) ? state : 'UNKNOWN';

    // 以 SKU 作為聚合主鍵，避免同 item_no 下不同尺寸（不同 SKU）被誤合併。
    // 若 SKU 缺失才回退 itemNo，最後才使用 EPC/索引確保不會全部擠成同一桶。
    const bucketKey = rawItemSku || rawProductSku || itemNo || `UNKNOWN::${epc || index}`;
    if (!skuMap.has(bucketKey)) {
      skuMap.set(bucketKey, {
        sku,
        styleNo,
        itemNo,
        productNameCandidates: new Set(),
        sizeCandidates: new Set(),
        colorCandidates: new Set(),
        priceCandidates: new Set(),
        inventoryCount: 0,
        soldCount: 0,
        totalCount: 0,
        items: []
      });
    }

    const bucket = skuMap.get(bucketKey);
    const productName = normalizeSummaryField(
      product?.display_name || product?.name_en || product?.name || item?.name_en || item?.product_name
    );
    const size = normalizeSummaryField(item?.size || product?.size);
    const color = normalizeSummaryField(item?.color || product?.color);
    const price = normalizeSummaryPrice(item?.price ?? product?.price);

    if (productName) bucket.productNameCandidates.add(productName);
    if (size) bucket.sizeCandidates.add(size);
    if (color) bucket.colorCandidates.add(color);
    if (price) bucket.priceCandidates.add(price);

    bucket.totalCount += 1;
    if (location === 'SOLD') {
      bucket.soldCount += 1;
    } else {
      bucket.inventoryCount += 1;
    }

    bucket.items.push({
      epc: epc || '-',
      location
    });
  });

  console.log('[product-summary] aggregation result', {
    uniqueSkuCount: skuMap.size,
    uniqueIdentityCount: seenIdentity.size,
    skuResolutionStats,
    bucketWithProductNameCandidate: [...skuMap.values()].filter((row) => row.productNameCandidates?.size > 0).length,
    bucketWithSizeCandidate: [...skuMap.values()].filter((row) => row.sizeCandidates?.size > 0).length,
    bucketWithColorCandidate: [...skuMap.values()].filter((row) => row.colorCandidates?.size > 0).length,
    rowsWithUnknownLocation: [...skuMap.values()].reduce((acc, row) => acc + row.items.filter((it) => it.location === 'UNKNOWN').length, 0),
    unknownSkuCount: (skuMap.get(t('product.summary.skuUnknown'))?.items || []).length,
    unknownSkuSample: sourceRows
      .filter((row) => !String(row?.sku || '').trim())
      .slice(0, 5)
      .map((row) => {
        const p = productById.get(row?.product_id) || {};
        return {
          product_id: row?.product_id ?? null,
          item_sku: row?.sku ?? null,
          product_sku: p?.sku ?? null,
          epc_data: row?.epc_data ?? null
        };
      })
  });

  const conflicts = [];
  const resolveDisplayValue = (candidates, sku, fieldKey) => {
    const values = [...candidates];
    if (values.length === 0) return '-';
    if (values.length === 1) return values[0];
    conflicts.push({ sku, field: fieldKey, candidates: values });
    return t('product.summary.errorValue');
  };

  const rows = [...skuMap.values()]
    .sort((a, b) => {
      const aStyle = String(a.styleNo || '');
      const bStyle = String(b.styleNo || '');
      if (aStyle !== bStyle) return aStyle.localeCompare(bStyle);
      const aItem = String(a.itemNo || a.sku || '');
      const bItem = String(b.itemNo || b.sku || '');
      return aItem.localeCompare(bItem);
    })
    .map((row) => ({
      sku: row.sku,
      styleNo: row.styleNo || '-',
      itemNo: row.itemNo || '-',
      productName: resolveDisplayValue(row.productNameCandidates, row.sku, 'product.summary.productName'),
      size: resolveDisplayValue(row.sizeCandidates, row.sku, 'product.summary.size'),
      color: resolveDisplayValue(row.colorCandidates, row.sku, 'product.summary.color'),
      price: resolveDisplayValue(row.priceCandidates, row.sku, 'product.summary.price'),
      inventoryCount: row.inventoryCount,
      soldCount: row.soldCount,
      totalCount: row.totalCount,
      items: row.items.sort((a, b) => String(a.epc).localeCompare(String(b.epc)))
    }));

  const rowsWithDashSizeOrColor = rows
    .filter((row) => row.size === '-' || row.color === '-')
    .slice(0, 10)
    .map((row) => ({
      sku: row.sku,
      size: row.size,
      color: row.color,
      totalCount: row.totalCount
    }));

  console.log('[product-summary] rendered-value snapshot', {
    rowsCount: rows.length,
    rowsWithDashSize: rows.filter((row) => row.size === '-').length,
    rowsWithDashColor: rows.filter((row) => row.color === '-').length,
    rowsWithErrorSize: rows.filter((row) => row.size === t('product.summary.errorValue')).length,
    rowsWithErrorColor: rows.filter((row) => row.color === t('product.summary.errorValue')).length,
    rowsWithDashSizeOrColor
  });

  return { rows, conflicts };
}

function formatSummaryPriceDisplay(value) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  if (text === '-' || text === t('product.summary.errorValue')) return text;
  const num = Number(text);
  if (!Number.isFinite(num)) return text;
  return `$${num.toFixed(2)}`;
}

function getFilteredSummaryRows(summarySummary = { rows: [], conflicts: [] }) {
  const summaryRowsRaw = Array.isArray(summarySummary)
    ? summarySummary
    : (Array.isArray(summarySummary?.rows) ? summarySummary.rows : []);
  const styleFilter = String(el.productStyleNoFilter?.value || '').trim().toLowerCase();
  const itemFilter = String(el.productItemNoFilter?.value || '').trim().toLowerCase();
  return summaryRowsRaw.filter((row) => {
    const styleNo = String(row?.styleNo || '').toLowerCase();
    const itemNo = String(row?.itemNo || '').toLowerCase();
    const sku = String(row?.sku || '').toLowerCase();
    const passStyle = !styleFilter || styleNo.includes(styleFilter);
    const passItem = !itemFilter || itemNo.includes(itemFilter) || sku.includes(itemFilter);
    return passStyle && passItem;
  });
}

function renderProductSummaryConflicts(conflicts = []) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return '';
  return `
    <div class="product-sku-conflicts" role="alert">
      <strong>${escapeHtml(t('product.summary.conflictTitle'))}</strong>
      <ul>
        ${conflicts.map((conflict) => `
          <li>${escapeHtml(t('product.summary.conflictItem', {
            sku: conflict.sku,
            field: t(conflict.field),
            values: conflict.candidates.join(', ')
          }))}</li>
        `).join('')}
      </ul>
    </div>
  `;
}

function renderLegacySkuSummary(summaryRows = [], conflictHtml = '') {
  const cardsHtml = summaryRows
    .map((row) => {
      const detailRows = row.items
        .map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><code>${escapeHtml(item.epc)}</code></td>
            <td>${escapeHtml(STATES.includes(item.location) ? t(`state.${item.location}`) : t('product.summary.locationUnknown'))}</td>
          </tr>
        `)
        .join('');

      return `
        <details class="product-sku-card">
          <summary class="product-sku-summary-row">
            <span class="product-sku-col">${escapeHtml(row.styleNo)}</span>
            <span class="product-sku-col">${escapeHtml(row.itemNo)}</span>
            <span class="product-sku-col product-sku-col--sku">${escapeHtml(row.sku)}</span>
            <span class="product-sku-col">${escapeHtml(row.productName)}</span>
            <span class="product-sku-col">${escapeHtml(row.size)}</span>
            <span class="product-sku-col">${escapeHtml(row.color)}</span>
            <span class="product-sku-col">${escapeHtml(formatSummaryPriceDisplay(row.price))}</span>
            <span class="product-sku-col">${escapeHtml(String(row.inventoryCount))}</span>
            <span class="product-sku-col">${escapeHtml(String(row.soldCount))}</span>
            <span class="product-sku-col">${escapeHtml(String(row.totalCount))}</span>
          </summary>
          <div class="product-sku-detail">
            <table class="preview-table">
              <thead>
                <tr>
                  <th>${escapeHtml(t('product.summary.itemNo'))}</th>
                  <th>${escapeHtml(t('product.summary.epc'))}</th>
                  <th>${escapeHtml(t('product.summary.location'))}</th>
                </tr>
              </thead>
              <tbody>
                ${detailRows}
              </tbody>
            </table>
          </div>
        </details>
      `;
    })
    .join('');

  return `
    ${conflictHtml}
    <div class="product-sku-head" role="row">
      <span class="product-sku-col">${escapeHtml(t('product.summary.styleNo'))}</span>
      <span class="product-sku-col">${escapeHtml(t('product.summary.itemNoCode'))}</span>
      <span class="product-sku-col product-sku-col--sku">${escapeHtml(t('product.summary.sku'))}</span>
      <span class="product-sku-col">${escapeHtml(t('product.summary.productName'))}</span>
      <span class="product-sku-col">${escapeHtml(t('product.summary.size'))}</span>
      <span class="product-sku-col">${escapeHtml(t('product.summary.color'))}</span>
      <span class="product-sku-col">${escapeHtml(t('product.summary.price'))}</span>
      <span class="product-sku-col">${escapeHtml(t('product.summary.inventoryCount'))}</span>
      <span class="product-sku-col">${escapeHtml(t('product.summary.soldCount'))}</span>
      <span class="product-sku-col">${escapeHtml(t('product.summary.totalCount'))}</span>
    </div>
    ${cardsHtml}
  `;
}

function compareSummarySize(a, b) {
  const order = ['XS', 'S', 'M', 'L', 'XL'];
  const map = new Map(order.map((size, idx) => [size, idx]));
  const left = String(a || '').trim().toUpperCase();
  const right = String(b || '').trim().toUpperCase();
  const leftRank = map.has(left) ? map.get(left) : Number.POSITIVE_INFINITY;
  const rightRank = map.has(right) ? map.get(right) : Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function parseSummaryPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inferColorSwatchHex(colorName = '') {
  const key = String(colorName || '').trim().toLowerCase();
  if (!key || key === '-') return '#94A3B8';
  if (key.includes('black')) return '#0F172A';
  if (key.includes('white')) return '#E2E8F0';
  if (key.includes('gray') || key.includes('grey')) return '#6B7280';
  if (key.includes('navy')) return '#1E3A8A';
  if (key.includes('blue')) return '#2563EB';
  if (key.includes('red')) return '#DC2626';
  if (key.includes('green')) return '#16A34A';
  if (key.includes('yellow')) return '#D97706';
  if (key.includes('beige') || key.includes('khaki')) return '#BFA77A';
  if (key.includes('brown')) return '#92400E';
  if (key.includes('pink')) return '#EC4899';
  if (key.includes('purple') || key.includes('violet')) return '#7C3AED';
  return '#64748B';
}

function buildPriceRangeDisplay(minPrice, maxPrice) {
  if (!Number.isFinite(minPrice) && !Number.isFinite(maxPrice)) return '-';
  if (!Number.isFinite(minPrice)) return `$${maxPrice.toFixed(2)}`;
  if (!Number.isFinite(maxPrice)) return `$${minPrice.toFixed(2)}`;
  if (Math.abs(minPrice - maxPrice) < 0.00001) return `$${minPrice.toFixed(2)}`;
  return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
}

function buildStyleHierarchyFromSummaryRows(summaryRows = []) {
  const styleMap = new Map();
  summaryRows.forEach((row) => {
    const styleNo = String(row?.styleNo || '-');
    const itemNo = String(row?.itemNo || '-');
    const color = String(row?.color || '-');
    const size = String(row?.size || '-');
    const groupKey = `${itemNo}::${color}`;
    const inventoryCount = Number(row?.inventoryCount || 0);
    const soldCount = Number(row?.soldCount || 0);
    const totalCount = Number(row?.totalCount || 0);
    const parsedPrice = parseSummaryPrice(row?.price);

    if (!styleMap.has(styleNo)) {
      styleMap.set(styleNo, {
        styleNo,
        productName: String(row?.productName || '').trim() || t('product.summary.styleCardFallback'),
        inventoryCount: 0,
        soldCount: 0,
        totalCount: 0,
        colorsSet: new Set(),
        skuCount: 0,
        minPrice: Number.POSITIVE_INFINITY,
        maxPrice: Number.NEGATIVE_INFINITY,
        groups: new Map()
      });
    }

    const styleNode = styleMap.get(styleNo);
    if (String(styleNode.productName || '').trim() === t('product.summary.styleCardFallback') && String(row?.productName || '').trim() && row?.productName !== '-') {
      styleNode.productName = String(row.productName);
    }
    styleNode.inventoryCount += inventoryCount;
    styleNode.soldCount += soldCount;
    styleNode.totalCount += totalCount;
    styleNode.skuCount += 1;
    if (color && color !== '-') styleNode.colorsSet.add(color);
    if (Number.isFinite(parsedPrice)) {
      styleNode.minPrice = Math.min(styleNode.minPrice, parsedPrice);
      styleNode.maxPrice = Math.max(styleNode.maxPrice, parsedPrice);
    }

    if (!styleNode.groups.has(groupKey)) {
      styleNode.groups.set(groupKey, {
        itemNo,
        color,
        inventoryCount: 0,
        soldCount: 0,
        totalCount: 0,
        sizes: new Set(),
        skuRows: []
      });
    }
    const groupNode = styleNode.groups.get(groupKey);
    groupNode.inventoryCount += inventoryCount;
    groupNode.soldCount += soldCount;
    groupNode.totalCount += totalCount;
    if (size && size !== '-') groupNode.sizes.add(size);
    groupNode.skuRows.push({
      ...row,
      size,
      epcCount: Array.isArray(row?.items) ? row.items.length : 0
    });
  });

  return [...styleMap.values()]
    .sort((a, b) => String(a.styleNo).localeCompare(String(b.styleNo), undefined, { numeric: true, sensitivity: 'base' }))
    .map((styleNode) => ({
      ...styleNode,
      colorCount: styleNode.colorsSet.size,
      priceRange: buildPriceRangeDisplay(styleNode.minPrice, styleNode.maxPrice),
      groups: [...styleNode.groups.values()]
        .sort((a, b) => {
          const itemCmp = String(a.itemNo || '').localeCompare(String(b.itemNo || ''), undefined, { numeric: true, sensitivity: 'base' });
          if (itemCmp !== 0) return itemCmp;
          return String(a.color || '').localeCompare(String(b.color || ''), undefined, { numeric: true, sensitivity: 'base' });
        })
        .map((groupNode) => ({
          ...groupNode,
          sizeCount: groupNode.sizes.size,
          skuRows: [...groupNode.skuRows].sort((left, right) => {
            const sizeCmp = compareSummarySize(left.size, right.size);
            if (sizeCmp !== 0) return sizeCmp;
            return String(left.sku || '').localeCompare(String(right.sku || ''), undefined, { numeric: true, sensitivity: 'base' });
          })
        }))
    }));
}

function renderEpcDetailRows(items = []) {
  return (items || []).map((item, idx) => {
    const location = STATES.includes(item.location) ? item.location : 'UNKNOWN';
    const label = STATES.includes(location) ? t(`state.${location}`) : t('product.summary.locationUnknown');
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><code>${escapeHtml(item.epc)}</code></td>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(label)}</td>
        <td>-</td>
      </tr>
    `;
  }).join('');
}

function renderNestedSkuSummary(summaryRows = [], conflictHtml = '') {
  const LOW_STOCK_THRESHOLD = 3;
  const styleNodes = buildStyleHierarchyFromSummaryRows(summaryRows);
  const styleHtml = styleNodes
    .map((styleNode) => {
      const styleLabel = String(styleNode.productName || '').trim() || t('product.summary.styleCardFallback');
      const colorHtml = styleNode.groups
        .map((groupNode) => {
          const skuRowsHtml = groupNode.skuRows
            .map((skuRow) => {
              const inventory = Number(skuRow.inventoryCount || 0);
              const isLowStock = inventory > 0 && inventory <= LOW_STOCK_THRESHOLD;
              const epcRows = renderEpcDetailRows(skuRow.items || []);
              return `
                <details class="product-enterprise-sku-row">
                  <summary class="product-enterprise-sku-summary">
                    <span class="product-enterprise-sku-cell product-enterprise-sku-cell--sku"><code>${escapeHtml(skuRow.sku)}</code></span>
                    <span class="product-enterprise-sku-cell"><span class="product-size-badge">${escapeHtml(skuRow.size || '-')}</span></span>
                    <span class="product-enterprise-sku-cell">${escapeHtml(formatSummaryPriceDisplay(skuRow.price))}</span>
                    <span class="product-enterprise-sku-cell product-enterprise-sku-cell--inventory ${isLowStock ? 'is-low-stock' : ''}">${escapeHtml(String(inventory))}</span>
                    <span class="product-enterprise-sku-cell product-enterprise-sku-cell--sold">${escapeHtml(String(skuRow.soldCount || 0))}</span>
                    <span class="product-enterprise-sku-cell">${escapeHtml(String(skuRow.epcCount || 0))}</span>
                    <span class="product-enterprise-sku-cell product-enterprise-sku-cell--action">${escapeHtml(t('product.summary.viewEpcs'))}${isLowStock ? ` · <span class="product-stock-badge">${escapeHtml(t('product.summary.lowStock'))}</span>` : ''}</span>
                  </summary>
                  <div class="product-enterprise-epc-detail">
                    <table class="preview-table product-enterprise-epc-table">
                      <thead>
                        <tr>
                          <th>${escapeHtml(t('product.summary.itemNo'))}</th>
                          <th>${escapeHtml(t('product.summary.epc'))}</th>
                          <th>${escapeHtml(t('product.summary.location'))}</th>
                          <th>${escapeHtml(t('product.summary.status'))}</th>
                          <th>${escapeHtml(t('product.summary.lastSeen'))}</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${epcRows}
                      </tbody>
                    </table>
                  </div>
                </details>
              `;
            })
            .join('');

          return `
            <details class="product-enterprise-color-group" open>
              <summary class="product-enterprise-color-summary">
                <div class="product-enterprise-color-main">
                  <span class="product-color-swatch" style="--swatch:${escapeHtml(inferColorSwatchHex(groupNode.color))}"></span>
                  <strong>${escapeHtml(groupNode.color || '-')}</strong>
                  <span class="product-enterprise-muted">${escapeHtml(t('product.summary.itemNoCode'))}: ${escapeHtml(groupNode.itemNo || '-')}</span>
                </div>
                <div class="product-enterprise-color-metrics">
                  <span>${escapeHtml(t('product.summary.sizeCount'))}: <strong>${escapeHtml(String(groupNode.sizeCount || 0))}</strong></span>
                  <span>${escapeHtml(t('product.summary.inventoryCount'))}: <strong>${escapeHtml(String(groupNode.inventoryCount || 0))}</strong></span>
                  <span>${escapeHtml(t('product.summary.soldCount'))}: <strong>${escapeHtml(String(groupNode.soldCount || 0))}</strong></span>
                </div>
              </summary>
              <div class="product-enterprise-sku-list">
                <div class="product-enterprise-sku-head">
                  <span>${escapeHtml(t('product.summary.sku'))}</span>
                  <span>${escapeHtml(t('product.summary.size'))}</span>
                  <span>${escapeHtml(t('product.summary.price'))}</span>
                  <span>${escapeHtml(t('product.summary.inventoryCount'))}</span>
                  <span>${escapeHtml(t('product.summary.soldCount'))}</span>
                  <span>${escapeHtml(t('product.summary.epcCount'))}</span>
                  <span>${escapeHtml(t('product.summary.viewEpcs'))}</span>
                </div>
                ${skuRowsHtml}
              </div>
            </details>
          `;
        }).join('');

      return `
        <details class="product-enterprise-style-card" open>
          <summary class="product-enterprise-style-summary">
            <div class="product-enterprise-style-left">
              <div class="product-enterprise-thumb" aria-hidden="true">${escapeHtml(String(styleLabel).slice(0, 1).toUpperCase())}</div>
              <div>
                <p class="product-enterprise-style-no">${escapeHtml(t('product.summary.styleNo'))}: ${escapeHtml(styleNode.styleNo)}</p>
                <h3 class="product-enterprise-style-name">${escapeHtml(styleLabel)}</h3>
              </div>
            </div>
            <div class="product-enterprise-style-kpi">
              <span>${escapeHtml(t('product.summary.colorCount'))}: <strong>${escapeHtml(String(styleNode.colorCount || 0))}</strong></span>
              <span>${escapeHtml(t('product.summary.skuCount'))}: <strong>${escapeHtml(String(styleNode.skuCount || 0))}</strong></span>
              <span>${escapeHtml(t('product.summary.inventoryCount'))}: <strong>${escapeHtml(String(styleNode.inventoryCount || 0))}</strong></span>
              <span>${escapeHtml(t('product.summary.soldCount'))}: <strong>${escapeHtml(String(styleNode.soldCount || 0))}</strong></span>
              <span>${escapeHtml(t('product.summary.priceRange'))}: <strong>${escapeHtml(styleNode.priceRange || '-')}</strong></span>
            </div>
          </summary>
          <div class="product-enterprise-style-body">
            ${colorHtml}
          </div>
        </details>
      `;
    })
    .join('');

  return `${conflictHtml}<div class="product-nested-summary">${styleHtml}</div>`;
}

function renderProductSkuSummary(summarySummary = { rows: [], conflicts: [] }) {
  if (!el.productSkuSummary) return;

  const summaryRows = getFilteredSummaryRows(summarySummary);
  if (!Array.isArray(summaryRows) || summaryRows.length === 0) {
    el.productSkuSummary.innerHTML = `<p class="hint">${escapeHtml(t('product.summary.empty'))}</p>`;
    return;
  }

  const conflicts = Array.isArray(summarySummary?.conflicts) ? summarySummary.conflicts : [];
  const conflictHtml = renderProductSummaryConflicts(conflicts);

  if (currentProductSummaryView === 'nested') {
    el.productSkuSummary.innerHTML = renderNestedSkuSummary(summaryRows, conflictHtml);
    return;
  }

  el.productSkuSummary.innerHTML = renderLegacySkuSummary(summaryRows, conflictHtml);
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
  const conversionRate = todayFitting > 0 ? (todaySales / todayFitting) * 100 : 0;

  console.log('[kpi] conversion diagnostics', {
    todayFitting,
    todaySales,
    convertedSessions,
    conversionRate,
    mode: 'sales_over_sessions'
  });

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

function getHourOfTimestamp(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours();
}

function buildHourlyMetrics(todaySessions = [], todaySaleEvents = []) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, tryOn: 0, sales: 0 }));

  todaySessions.forEach((session) => {
    const hour = getHourOfTimestamp(session?.entered_at);
    if (hour == null) return;
    hours[hour].tryOn += 1;
  });

  todaySaleEvents.forEach((event) => {
    const hour = getHourOfTimestamp(event?.timestamp);
    if (hour == null) return;
    hours[hour].sales += 1;
  });

  return hours;
}

function computeStoryFunnelMetrics(todaySessions = [], todaySaleEvents = [], recentEvents = []) {
  const tryOnSessions = Array.isArray(todaySessions) ? todaySessions.length : 0;
  const checkoutIntent = (Array.isArray(recentEvents) ? recentEvents : [])
    .filter((row) => {
      if (row?.event_type !== 'move_to_checkout') return false;
      const ts = new Date(row?.timestamp || 0);
      if (Number.isNaN(ts.getTime())) return false;
      const start = new Date(todayStartIso());
      return ts >= start;
    })
    .length;
  const completedSales = Array.isArray(todaySaleEvents) ? todaySaleEvents.length : 0;
  const tryOnToSaleRate = tryOnSessions > 0 ? (completedSales / tryOnSessions) * 100 : 0;

  return {
    tryOnSessions,
    checkoutIntent,
    completedSales,
    tryOnToSaleRate
  };
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value) {
  const amount = toSafeNumber(value, 0);
  return `$${amount.toFixed(2)}`;
}

function getProductUnitPrice(product = {}) {
  const direct = toSafeNumber(product?.price, NaN);
  if (Number.isFinite(direct)) return Math.max(0, direct);
  const fromDisplay = toSafeNumber(product?.display_price, NaN);
  if (Number.isFinite(fromDisplay)) return Math.max(0, fromDisplay);
  return 0;
}

function computeOpportunityRows(products = [], recentEvents = []) {
  const eventRows = Array.isArray(recentEvents) ? recentEvents : [];
  const byKey = new Map();

  products.forEach((product) => {
    const productKey = productKeyFromProduct(product);
    if (!productKey) return;
    byKey.set(productKey, {
      name: product.display_name || product.name_en || product.name || t('dashboard.unnamedProduct'),
      sku: resolveSkuValue(product?.sku) || '-',
      unitPrice: getProductUnitPrice(product),
      tryOn: 0,
      sales: 0
    });
  });

  eventRows.forEach((event) => {
    const key = productKeyFromEvent(event);
    if (!key || !byKey.has(key)) return;
    if (event?.event_type === 'enter_fitting_room') {
      byKey.get(key).tryOn += 1;
    }
    if (event?.event_type === 'sale_completed') {
      byKey.get(key).sales += 1;
    }
  });

  const rows = Array.from(byKey.values())
    .map((row) => {
      const conversion = row.tryOn > 0 ? (row.sales / row.tryOn) * 100 : 0;
      return {
        ...row,
        conversion
      };
    })
    .filter((row) => row.tryOn > 0);

  const benchmark = rows.length > 0
    ? rows.reduce((acc, row) => acc + row.conversion, 0) / rows.length
    : 0;

  return rows
    .map((row) => ({
      ...row,
      conversionRate: row.tryOn > 0 ? (row.sales / row.tryOn) : 0,
      estimatedMissedRevenue: Math.max(0, row.tryOn * row.unitPrice * (1 - (row.tryOn > 0 ? (row.sales / row.tryOn) : 0))),
      opportunityScore: Math.max(0, row.tryOn * row.unitPrice * (1 - (row.tryOn > 0 ? (row.sales / row.tryOn) : 0)) + (benchmark - row.conversion))
    }))
    .sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.tryOn - a.tryOn))
    .slice(0, 10);
}

function computeRevenueImpact({ opportunities = [], todayFittingCount = 0, todaySalesCount = 0 }) {
  const missedRevenueToday = opportunities.reduce((acc, row) => {
    if (row.tryOn > 0 && row.sales === 0) return acc + (row.tryOn * toSafeNumber(row.unitPrice, 0));
    return acc;
  }, 0);
  const totalEstimatedMissed = opportunities.reduce((acc, row) => acc + toSafeNumber(row.estimatedMissedRevenue, 0), 0);
  const upliftLow = totalEstimatedMissed * 0.4;
  const upliftHigh = totalEstimatedMissed * 0.75;
  const tryOnToSaleRate = todayFittingCount > 0 ? (todaySalesCount / todayFittingCount) : 0;
  const topLossDriver = opportunities.find((row) => row.tryOn > 0 && row.sales === 0) || opportunities[0] || null;
  return {
    missedRevenueToday,
    upliftLow,
    upliftHigh,
    tryOnToSaleRate,
    topLossDriver
  };
}

function countTodayEvents(recentEvents = [], eventType = '') {
  const startMs = Date.parse(todayStartIso());
  return (Array.isArray(recentEvents) ? recentEvents : []).filter((row) => {
    if (eventType && row?.event_type !== eventType) return false;
    const ts = Date.parse(row?.timestamp);
    return Number.isFinite(ts) && ts >= startMs;
  }).length;
}

function computeJourneyFunnel({ grouped = {}, todaySessions = [], todaySaleEvents = [], recentEvents = [] }) {
  const rackInterestByState = Array.isArray(grouped?.RACK) ? grouped.RACK.length : 0;
  const rackInterestByEvents = countTodayEvents(recentEvents, 'tag_seen');
  const rackInterestCount = Math.max(rackInterestByState, rackInterestByEvents, 0);

  const fittingBySessions = Array.isArray(todaySessions) ? todaySessions.length : 0;
  const fittingByEvents = countTodayEvents(recentEvents, 'enter_fitting_room');
  const fittingRoomCount = Math.max(fittingBySessions, fittingByEvents, 0);

  const checkoutIntentCount = countTodayEvents(recentEvents, 'move_to_checkout');
  const completedSalesCount = Array.isArray(todaySaleEvents) ? todaySaleEvents.length : 0;

  const dropAfterFitting = Math.max(0, fittingRoomCount - checkoutIntentCount);
  const dropAfterCheckout = Math.max(0, checkoutIntentCount - completedSalesCount);
  const hasActivity = rackInterestCount + fittingRoomCount + checkoutIntentCount + completedSalesCount > 0;
  let mainDropOffStage = 'no_activity';
  if (hasActivity) {
    mainDropOffStage = dropAfterFitting >= dropAfterCheckout ? 'after_fitting_room' : 'after_checkout';
  }

  return {
    rackInterestCount,
    fittingRoomCount,
    checkoutIntentCount,
    completedSalesCount,
    mainDropOffStage,
    tryOnToSaleRate: fittingRoomCount > 0 ? (completedSalesCount / fittingRoomCount) : 0
  };
}

function computeAIBusinessInsight({ journey, revenueImpact, opportunities = [], grouped = {} }) {
  const abnormalCount = (grouped?.FITTING_ROOM || []).filter((row) => row.abnormal).length;
  const topOpportunity = opportunities[0] || null;
  if (topOpportunity && topOpportunity.tryOn > 0 && topOpportunity.sales === 0) {
    return {
      headline: `${topOpportunity.name} has high fitting interest but zero conversion`,
      summary: `${topOpportunity.tryOn} try-ons did not convert today.`,
      businessImpact: `${formatCurrency(topOpportunity.estimatedMissedRevenue)} potential revenue at risk.`,
      possibleReasons: 'Size availability mismatch, fitting guidance quality, or checkout hesitation.',
      confidence: 0.82
    };
  }
  if (abnormalCount > 0) {
    return {
      headline: 'Customer experience risk detected in fitting rooms',
      summary: `${abnormalCount} long-dwell items may indicate assistance delays.`,
      businessImpact: `Likely conversion drag with ${formatCurrency(revenueImpact.missedRevenueToday)} missed potential.`,
      possibleReasons: 'Staff load imbalance, queue friction, or delayed support.',
      confidence: 0.77
    };
  }
  return {
    headline: 'Store conversion is stable and under monitoring',
    summary: `Try-on to sale rate is ${(journey.tryOnToSaleRate * 100).toFixed(1)}%.`,
    businessImpact: 'No critical risk detected at this moment.',
    possibleReasons: 'Balanced flow and normal product engagement.',
    confidence: 0.66
  };
}

function computeRecommendedActions({ grouped = {}, opportunities = [], journey, skuRows = [] }) {
  const actions = [];
  const abnormalRows = (grouped?.FITTING_ROOM || []).filter((row) => row.abnormal);
  if (abnormalRows.length > 0) {
    actions.push({
      priority: 1,
      type: 'staff_follow_up',
      title: 'Follow up long-dwell fitting sessions',
      reason: `${abnormalRows.length} items show long dwell signals.`,
      suggestedAction: 'Assign floor staff to immediate assistance and room throughput checks.',
      expectedImpact: 'Reduce abandonment after fitting and improve conversion consistency.',
      severity: 'high',
      relatedSkus: abnormalRows.map((row) => resolveSkuValue(row?.product?.sku)).filter(Boolean).slice(0, 6)
    });
  }

  const zeroSaleOpportunity = opportunities.filter((row) => row.tryOn > 0 && row.sales === 0).slice(0, 3);
  if (zeroSaleOpportunity.length > 0) {
    actions.push({
      priority: 2,
      type: 'product_review',
      title: 'Review high-interest zero-conversion products',
      reason: `${zeroSaleOpportunity.length} products have try-ons without sales.`,
      suggestedAction: 'Audit sizing, price positioning, and in-room recommendation scripts.',
      expectedImpact: 'Recover missed revenue from high-intent traffic.',
      severity: 'high',
      relatedSkus: zeroSaleOpportunity.map((row) => row.sku).filter(Boolean)
    });
  }

  const lowStockRows = (skuRows || []).filter((row) => row.currentStock < row.safetyStock).slice(0, 5);
  if (lowStockRows.length > 0) {
    actions.push({
      priority: 3,
      type: 'restock',
      title: 'Prioritize low-stock replenishment',
      reason: `${lowStockRows.length} SKUs are below safety stock.`,
      suggestedAction: 'Trigger replenishment orders for high-gap SKUs.',
      expectedImpact: 'Prevent lost sales due to stockouts in high-demand items.',
      severity: 'medium',
      relatedSkus: lowStockRows.map((row) => row.sku).filter(Boolean)
    });
  }

  if (journey.checkoutIntentCount > journey.completedSalesCount) {
    actions.push({
      priority: 4,
      type: 'checkout_flow_review',
      title: 'Review checkout conversion flow',
      reason: `${journey.checkoutIntentCount - journey.completedSalesCount} intents did not complete purchase.`,
      suggestedAction: 'Inspect queue time, payment friction, and final-sales assistance.',
      expectedImpact: 'Increase capture rate from checkout intent to completed sales.',
      severity: 'medium',
      relatedSkus: []
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

function computeTopRevenueOpportunities(opportunities = []) {
  return (Array.isArray(opportunities) ? opportunities : []).slice(0, 8).map((row) => ({
    name: row.name,
    sku: row.sku,
    tryOn: row.tryOn,
    sales: row.sales,
    conversionRate: row.conversionRate,
    opportunityScore: row.opportunityScore,
    estimatedMissedRevenue: row.estimatedMissedRevenue,
    recommendedAction: row.sales === 0 ? 'product_review' : 'monitor'
  }));
}

function computeOperationAlerts({ grouped = {}, journey }) {
  const fittingRows = grouped?.FITTING_ROOM || [];
  const abnormalCount = fittingRows.filter((row) => row.abnormal).length;
  const alerts = [];
  if (abnormalCount > 0) {
    alerts.push({ level: 'critical', title: 'Customer Experience Risk', detail: `${abnormalCount} long-dwell items`, action: 'Dispatch staff to active fitting rooms.' });
  }
  if (fittingRows.length > 0) {
    alerts.push({ level: 'warning', title: 'Uncleared fitting-room items', detail: `${fittingRows.length} items still in fitting flow`, action: 'Validate room turnover and session reset.' });
  }
  if (journey.checkoutIntentCount > journey.completedSalesCount) {
    alerts.push({ level: 'info', title: 'Checkout conversion gap', detail: `${journey.checkoutIntentCount - journey.completedSalesCount} intents not converted`, action: 'Review POS queue and checkout support.' });
  }
  return alerts.slice(0, 5);
}

function computeReplenishmentRisk(skuRows = []) {
  return (Array.isArray(skuRows) ? skuRows : [])
    .filter((row) => row.currentStock < row.safetyStock)
    .slice(0, 8)
    .map((row) => ({
      sku: row.sku,
      currentStock: row.currentStock,
      safetyStock: row.safetyStock,
      riskLevel: row.riskLevel,
      recommendedAction: row.suggestedQty > 0 ? `Restock +${row.suggestedQty}` : 'Monitor'
    }));
}

function buildDashboardSummaryModel({ grouped = {}, todaySessions = [], todaySaleEvents = [], recentEvents = [], products = [], sales7d = [], inventoryRows = [] }) {
  const opportunities = computeOpportunityRows(products, recentEvents);
  const todayFittingCount = Array.isArray(todaySessions) ? todaySessions.length : 0;
  const todaySalesCount = Array.isArray(todaySaleEvents) ? todaySaleEvents.length : 0;
  const revenueImpact = computeRevenueImpact({ opportunities, todayFittingCount, todaySalesCount });
  const journey = computeJourneyFunnel({ grouped, todaySessions, todaySaleEvents, recentEvents });
  const skuRows = computeSkuReplenishment(products, sales7d, inventoryRows);
  const aiInsight = computeAIBusinessInsight({ journey, revenueImpact, opportunities, grouped });
  const actions = computeRecommendedActions({ grouped, opportunities, journey, skuRows });
  const topOpportunities = computeTopRevenueOpportunities(opportunities);
  const operationAlerts = computeOperationAlerts({ grouped, journey });
  const replenishmentRisk = computeReplenishmentRisk(skuRows);
  return {
    revenueImpact,
    journey,
    aiInsight,
    actions,
    topOpportunities,
    operationAlerts,
    replenishmentRisk
  };
}

function renderDashboardSummary(summaryModel) {
  if (!summaryModel) return;
  const { revenueImpact, journey, aiInsight, actions, topOpportunities, operationAlerts, replenishmentRisk } = summaryModel;

  if (el.kpiMissedRevenue) el.kpiMissedRevenue.textContent = formatCurrency(revenueImpact.missedRevenueToday);
  if (el.kpiPotentialUplift) el.kpiPotentialUplift.textContent = `${formatCurrency(revenueImpact.upliftLow)} - ${formatCurrency(revenueImpact.upliftHigh)}`;
  if (el.kpiTryOnToSaleRate) el.kpiTryOnToSaleRate.textContent = `${(revenueImpact.tryOnToSaleRate * 100).toFixed(1)}%`;
  if (el.kpiTopLossDriver) el.kpiTopLossDriver.textContent = revenueImpact.topLossDriver?.name || t('dashboard31.revenue.lossDriverFallback');

  if (el.journeyFunnelBody) {
    const maxValue = Math.max(journey.rackInterestCount, journey.fittingRoomCount, journey.checkoutIntentCount, journey.completedSalesCount, 1);
    const dropOffText = journey.mainDropOffStage === 'after_fitting_room'
      ? t('dashboard31.journey.dropOff.afterFitting')
      : (journey.mainDropOffStage === 'after_checkout' ? t('dashboard31.journey.dropOff.afterCheckout') : t('dashboard31.journey.dropOff.noActivity'));
    el.journeyFunnelBody.innerHTML = `
      <div class="analytics-funnel-step">
        <div class="analytics-funnel-label-row"><span>${escapeHtml(t('dashboard31.journey.productInterest'))}</span><strong>${escapeHtml(String(journey.rackInterestCount))}</strong></div>
        <div class="analytics-funnel-track"><div class="analytics-funnel-fill" style="width:${Math.max(6, (journey.rackInterestCount / maxValue) * 100).toFixed(1)}%"></div></div>
      </div>
      <div class="analytics-funnel-step">
        <div class="analytics-funnel-label-row"><span>${escapeHtml(t('dashboard31.journey.fittingRoom'))}</span><strong>${escapeHtml(String(journey.fittingRoomCount))}</strong></div>
        <div class="analytics-funnel-track"><div class="analytics-funnel-fill" style="width:${Math.max(6, (journey.fittingRoomCount / maxValue) * 100).toFixed(1)}%"></div></div>
      </div>
      <div class="analytics-funnel-step">
        <div class="analytics-funnel-label-row"><span>${escapeHtml(t('dashboard31.journey.purchaseIntent'))}</span><strong>${escapeHtml(String(journey.checkoutIntentCount))}</strong></div>
        <div class="analytics-funnel-track"><div class="analytics-funnel-fill" style="width:${Math.max(6, (journey.checkoutIntentCount / maxValue) * 100).toFixed(1)}%"></div></div>
      </div>
      <div class="analytics-funnel-step">
        <div class="analytics-funnel-label-row"><span>${escapeHtml(t('dashboard31.journey.completedSales'))}</span><strong>${escapeHtml(String(journey.completedSalesCount))}</strong></div>
        <div class="analytics-funnel-track"><div class="analytics-funnel-fill" style="width:${Math.max(6, (journey.completedSalesCount / maxValue) * 100).toFixed(1)}%"></div></div>
      </div>
      <p class="hint">${escapeHtml(t('dashboard31.journey.dropOff'))}: <strong>${escapeHtml(dropOffText)}</strong></p>
    `;
  }

  if (el.aiBusinessInsightBody) {
    el.aiBusinessInsightBody.innerHTML = `
      <div class="dashboard31-insight-headline">${escapeHtml(aiInsight.headline)}</div>
      <p class="hint">${escapeHtml(aiInsight.summary)}</p>
      <p class="hint">${escapeHtml(aiInsight.businessImpact)}</p>
      <p class="hint">${escapeHtml(aiInsight.possibleReasons)}</p>
      <p class="hint">${escapeHtml(t('dashboard31.ai.confidence'))}: <strong>${escapeHtml(`${Math.round(toSafeNumber(aiInsight.confidence, 0) * 100)}%`)}</strong></p>
    `;
  }

  if (el.recommendedActionsBody) {
    if (!actions.length) {
      el.recommendedActionsBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('dashboard31.actions.empty'))}</p>`;
    } else {
      el.recommendedActionsBody.innerHTML = `<ul class="analytics-alert-list">${actions.map((action) => `
        <li class="analytics-alert-item analytics-alert-item--${escapeHtml(action.severity === 'high' ? 'critical' : (action.severity === 'medium' ? 'warning' : 'info'))}">
          <div><strong>${escapeHtml(action.title)}</strong></div>
          <div>${escapeHtml(action.reason)}</div>
          <div class="hint">${escapeHtml(action.suggestedAction)}</div>
          <div class="hint">${escapeHtml(t('dashboard31.actions.expectedImpact'))}: ${escapeHtml(action.expectedImpact)}</div>
          <div class="hint">${escapeHtml(t('dashboard31.actions.relatedSkus'))}: ${escapeHtml((action.relatedSkus || []).join(', ') || '-')}</div>
        </li>
      `).join('')}</ul>`;
    }
  }

  if (el.topOpportunitiesBody) {
    if (!topOpportunities.length) {
      el.topOpportunitiesBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('dashboard31.opportunities.empty'))}</p>`;
    } else {
      el.topOpportunitiesBody.innerHTML = topOpportunities.map((row) => `
        <div class="analytics-opportunity-row">
          <strong>${escapeHtml(row.name)}</strong>
          <span>${escapeHtml(t('dashboard31.opportunities.tryOn'))}: ${escapeHtml(String(row.tryOn))}</span>
          <span>${escapeHtml(t('dashboard31.opportunities.sales'))}: ${escapeHtml(String(row.sales))}</span>
          <span>${escapeHtml(t('dashboard31.opportunities.conversion'))}: ${escapeHtml((toSafeNumber(row.conversionRate, 0) * 100).toFixed(1))}%</span>
          <span>${escapeHtml(t('dashboard31.opportunities.missedRevenue'))}: ${escapeHtml(formatCurrency(row.estimatedMissedRevenue))}</span>
        </div>
      `).join('');
    }
  }

  if (el.operationsAlertsBody) {
    if (!operationAlerts.length) {
      el.operationsAlertsBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('dashboard31.alerts.empty'))}</p>`;
    } else {
      el.operationsAlertsBody.innerHTML = `<ul class="analytics-alert-list">${operationAlerts.map((alert) => `
        <li class="analytics-alert-item analytics-alert-item--${escapeHtml(alert.level)}">
          <div><strong>${escapeHtml(alert.title)}</strong></div>
          <div>${escapeHtml(alert.detail)}</div>
          <div class="hint">${escapeHtml(alert.action)}</div>
        </li>
      `).join('')}</ul>`;
    }
  }

  if (el.replenishmentRiskBody) {
    if (!replenishmentRisk.length) {
      el.replenishmentRiskBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('dashboard31.replenishment.empty'))}</p>`;
    } else {
      el.replenishmentRiskBody.innerHTML = replenishmentRisk.map((row) => `
        <div class="analytics-safety-row">
          <strong>${escapeHtml(row.sku)}</strong>
          <span>${escapeHtml(t('dashboard31.replenishment.currentStock'))}: ${escapeHtml(String(row.currentStock))}</span>
          <span>${escapeHtml(t('dashboard31.replenishment.safetyStock'))}: ${escapeHtml(String(row.safetyStock))}</span>
          <span>${escapeHtml(t('dashboard31.replenishment.riskLevel'))}: ${escapeHtml(t(`dashboard31.risk.${row.riskLevel}`))}</span>
          <span>${escapeHtml(t('dashboard31.replenishment.recommendedAction'))}: ${escapeHtml(row.recommendedAction)}</span>
        </div>
      `).join('');
    }
  }
}

function setTechnicalBoardVisibility(expanded) {
  if (el.technicalBoardBody) {
    el.technicalBoardBody.hidden = !expanded;
  }
  if (el.technicalBoardToggle) {
    el.technicalBoardToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    el.technicalBoardToggle.textContent = expanded ? t('dashboard31.technical.hide') : t('dashboard31.technical.show');
  }
}

function computeAlertRows(grouped = {}) {
  const fittingRows = grouped?.FITTING_ROOM || [];
  const abnormalCount = fittingRows.filter((row) => row.abnormal).length;
  const unclearedCount = fittingRows.length;

  const alerts = [];

  if (abnormalCount > 0) {
    alerts.push({
      level: 'critical',
      title: t('analytics.b2.longDwellTitle'),
      detail: `${abnormalCount}`,
      action: t('analytics.b2.longDwellAction')
    });
  }
  if (unclearedCount > 0) {
    alerts.push({
      level: 'warning',
      title: t('analytics.b2.unclearedTitle'),
      detail: `${unclearedCount}`,
      action: t('analytics.b2.unclearedAction')
    });
  }
  if (fittingRows.length >= 6) {
    alerts.push({
      level: 'info',
      title: t('analytics.b2.congestionTitle'),
      detail: `${fittingRows.length}`,
      action: t('analytics.b2.congestionAction')
    });
  }

  return alerts.slice(0, 5);
}

function renderManagerOverview({ grouped, todaySessions, todaySaleEvents, products, recentEvents }) {
  const fittingCount = grouped?.FITTING_ROOM?.length || 0;
  const checkoutCount = grouped?.CHECKOUT?.length || 0;
  const rackCount = grouped?.RACK?.length || 0;
  const abnormalCount = (grouped?.FITTING_ROOM || []).filter((row) => row.abnormal).length;
  const todayFitting = Array.isArray(todaySessions) ? todaySessions.length : 0;
  const todaySales = Array.isArray(todaySaleEvents) ? todaySaleEvents.length : 0;
  const conversionRate = todayFitting > 0 ? (todaySales / todayFitting) * 100 : 0;
  const opportunityRows = computeOpportunityRows(products, recentEvents);
  const alertRows = computeAlertRows(grouped);

  if (el.kpiOpportunityItems) {
    el.kpiOpportunityItems.textContent = String(opportunityRows.length);
  }

  if (el.heroNarrative) {
    if (todayFitting === 0) {
      el.heroNarrative.textContent = t('analytics.hero.noFitting');
    } else if (abnormalCount > 0) {
      el.heroNarrative.textContent = t('analytics.hero.abnormal', {
        todayFitting,
        abnormalCount
      });
    } else {
      el.heroNarrative.textContent = t('analytics.hero.normal', {
        todayFitting,
        conversionRate: conversionRate.toFixed(1)
      });
    }
  }

  if (el.heroLiveStatus) {
    el.heroLiveStatus.textContent = t('analytics.hero.liveStore', {
      status: todayFitting > 0 ? t('analytics.hero.liveStoreActive') : t('analytics.hero.liveStoreQuiet')
    });
    el.heroLiveStatus.classList.toggle('text-warn', todayFitting === 0);
  }
  if (el.heroTrackingStatus) {
    el.heroTrackingStatus.textContent = t('analytics.hero.tracking', {
      status: products.length > 0 ? t('analytics.hero.trackingNormal') : t('analytics.hero.trackingNoProducts')
    });
    el.heroTrackingStatus.classList.toggle('text-warn', products.length === 0);
  }
  if (el.heroAiStatus) {
    el.heroAiStatus.textContent = t('analytics.hero.aiAssistant', {
      status: opportunityRows.length > 0 || alertRows.length > 0 ? t('analytics.hero.aiReady') : t('analytics.hero.aiMonitoring')
    });
  }

  if (el.overviewSnapshotBody) {
    const topProducts = (grouped?.FITTING_ROOM || []).slice(0, 5).map((row) => row?.product?.display_name || row?.product?.name_en || row?.product?.name || '-');
    el.overviewSnapshotBody.innerHTML = `
      <div class="snapshot-grid">
        <article class="snapshot-chip"><p class="snapshot-chip-label">${escapeHtml(t('analytics.snapshot.rack'))}</p><p class="snapshot-chip-value">${escapeHtml(String(rackCount))}</p></article>
        <article class="snapshot-chip"><p class="snapshot-chip-label">${escapeHtml(t('analytics.snapshot.fittingRoom'))}</p><p class="snapshot-chip-value">${escapeHtml(String(fittingCount))}</p></article>
        <article class="snapshot-chip"><p class="snapshot-chip-label">${escapeHtml(t('analytics.snapshot.checkout'))}</p><p class="snapshot-chip-value">${escapeHtml(String(checkoutCount))}</p></article>
      </div>
      <p class="hint">${escapeHtml(t('analytics.snapshot.activeAlerts'))}: <strong>${escapeHtml(String(alertRows.length))}</strong> / ${escapeHtml(t('analytics.snapshot.todaySales'))}: <strong>${escapeHtml(String(todaySales))}</strong></p>
      <div class="snapshot-mini-products">
        ${(topProducts.length > 0 ? topProducts : [t('analytics.snapshot.noActiveTryOnItems')]).map((name) => `<span class="snapshot-mini-product">${escapeHtml(name)}</span>`).join('')}
      </div>
    `;
  }

  if (el.overviewAiSummaryBody) {
    const summaryItems = [];
    if (opportunityRows.length > 0) {
      const top = opportunityRows[0];
      summaryItems.push(t('analytics.aiSummary.opportunity', { name: top.name, conversion: top.conversion.toFixed(1) }));
    }
    if (abnormalCount > 0) {
      summaryItems.push(t('analytics.aiSummary.abnormal', { abnormalCount }));
    }
    if (todayFitting > 0 && conversionRate < 20) {
      summaryItems.push(t('analytics.aiSummary.lowConversion'));
    }
    if (summaryItems.length === 0) {
      summaryItems.push(t('analytics.aiSummary.stable'));
    }
    el.overviewAiSummaryBody.innerHTML = `
      <ul class="ai-summary-list">
        ${summaryItems.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
      <div class="ai-summary-actions">
        <button type="button" class="button-secondary">${escapeHtml(t('analytics.aiSummary.viewFullInsights'))}</button>
        <button type="button" class="button-secondary">${escapeHtml(t('analytics.aiSummary.askAi'))}</button>
      </div>
    `;
  }
}

function computeSkuReplenishment(products = [], sales7d = [], inventoryRows = []) {
  const productById = new Map();
  const productByEpc = new Map();
  products.forEach((product) => {
    if (product?.id != null) productById.set(product.id, product);
    const epc = String(product?.epc_data || '').trim();
    if (epc) productByEpc.set(epc, product);
  });

  const stockBySku = new Map();
  inventoryRows.forEach((row) => {
    const status = String(row?.status || '').toUpperCase();
    const isAvailable = !status || status === 'ACTIVE' || status === 'IN_STOCK';
    if (!isAvailable) return;
    const product = productById.get(row?.product_id);
    const sku = resolveSkuValue(row?.sku, product?.sku);
    if (!sku) return;
    stockBySku.set(sku, (stockBySku.get(sku) || 0) + 1);
  });

  const soldBySku = new Map();
  sales7d.forEach((row) => {
    const epc = String(row?.epc_data || '').trim();
    if (!epc) return;
    const product = productByEpc.get(epc);
    const sku = resolveSkuValue(product?.sku);
    if (!sku) return;
    soldBySku.set(sku, (soldBySku.get(sku) || 0) + 1);
  });

  const allSkus = new Set([...stockBySku.keys(), ...soldBySku.keys()]);

  return Array.from(allSkus)
    .map((sku) => {
      const sold7d = soldBySku.get(sku) || 0;
      const currentStock = stockBySku.get(sku) || 0;
      const avgDailySales = sold7d / 7;
      const safetyStock = Math.ceil(avgDailySales * 3);
      const reorderPoint = safetyStock + 1;
      const suggestedQty = Math.max(0, reorderPoint - currentStock);
      const safetyGap = Math.max(0, safetyStock - currentStock);
      const daysOfCover = avgDailySales > 0 ? (currentStock / avgDailySales) : null;
      const priorityScore = (safetyGap * 2) + avgDailySales;
      const riskLevel = currentStock < safetyStock ? 'critical' : (currentStock < reorderPoint ? 'warning' : 'healthy');
      return {
        sku,
        sold7d,
        currentStock,
        avgDailySales,
        safetyStock,
        reorderPoint,
        suggestedQty,
        safetyGap,
        daysOfCover,
        priorityScore,
        riskLevel
      };
    })
    .sort((a, b) => (b.suggestedQty - a.suggestedQty) || (b.priorityScore - a.priorityScore));
}

function renderAnalyticsModules({ products, grouped, todaySessions, todaySaleEvents, recentEvents, sales7d, inventoryRows }) {
  if (el.storyFunnelBody) {
    const funnel = computeStoryFunnelMetrics(todaySessions, todaySaleEvents, recentEvents);
    const maxValue = Math.max(funnel.tryOnSessions, funnel.checkoutIntent, funnel.completedSales, 1);
    el.storyFunnelBody.innerHTML = `
      <div class="analytics-funnel-step">
        <div class="analytics-funnel-label-row"><span>${escapeHtml(t('analytics.a1.tryOn'))}</span><strong>${escapeHtml(String(funnel.tryOnSessions))}</strong></div>
        <div class="analytics-funnel-track"><div class="analytics-funnel-fill" style="width:${Math.max(6, (funnel.tryOnSessions / maxValue) * 100).toFixed(1)}%"></div></div>
      </div>
      <div class="analytics-funnel-step">
        <div class="analytics-funnel-label-row"><span>${escapeHtml(t('analytics.a1.checkout'))}</span><strong>${escapeHtml(String(funnel.checkoutIntent))}</strong></div>
        <div class="analytics-funnel-track"><div class="analytics-funnel-fill" style="width:${Math.max(6, (funnel.checkoutIntent / maxValue) * 100).toFixed(1)}%"></div></div>
      </div>
      <div class="analytics-funnel-step">
        <div class="analytics-funnel-label-row"><span>${escapeHtml(t('analytics.a1.sales'))}</span><strong>${escapeHtml(String(funnel.completedSales))}</strong></div>
        <div class="analytics-funnel-track"><div class="analytics-funnel-fill" style="width:${Math.max(6, (funnel.completedSales / maxValue) * 100).toFixed(1)}%"></div></div>
      </div>
      <p class="hint">${escapeHtml(t('analytics.a1.rate'))}: <strong>${escapeHtml(funnel.tryOnToSaleRate.toFixed(1))}%</strong></p>
    `;
  }

  if (el.storyHourlyBody) {
    const hourly = buildHourlyMetrics(todaySessions, todaySaleEvents);
    const nonZero = hourly.filter((row) => row.tryOn > 0 || row.sales > 0);
    const sourceRows = nonZero.length > 0 ? nonZero : hourly;
    const top = sourceRows.slice().sort((a, b) => (b.tryOn + b.sales) - (a.tryOn + a.sales)).slice(0, 8);
    const maxVal = Math.max(...top.map((row) => row.tryOn + row.sales), 1);
    const fallbackHtml = nonZero.length === 0 ? `<p class="hint">${escapeHtml(t('analytics.a2.fallback'))}</p>` : '';
    el.storyHourlyBody.innerHTML = `${fallbackHtml}${top.map((row) => `
      <div class="analytics-hour-row">
        <span>${escapeHtml(String(row.hour).padStart(2, '0'))}:00</span>
        <div class="analytics-hour-track"><div class="analytics-hour-fill" style="width:${(((row.tryOn + row.sales) / maxVal) * 100).toFixed(1)}%"></div></div>
        <span>${escapeHtml(t('analytics.a2.tryOn'))} ${escapeHtml(String(row.tryOn))} / ${escapeHtml(t('analytics.a2.sales'))} ${escapeHtml(String(row.sales))}</span>
      </div>
    `).join('')}`;
  }

  if (el.opsOpportunityBody) {
    const rows = computeOpportunityRows(products, recentEvents);
    if (rows.length === 0) {
      el.opsOpportunityBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('analytics.b1.empty'))}</p>`;
    } else {
      el.opsOpportunityBody.innerHTML = rows.map((row) => `
        <div class="analytics-opportunity-row">
          <strong>${escapeHtml(row.name)}</strong>
          <span>${escapeHtml(t('analytics.a1.rate'))}: ${escapeHtml(row.conversion.toFixed(1))}%</span>
          <span>${escapeHtml(row.opportunityScore.toFixed(1))}</span>
        </div>
      `).join('');
    }
  }
  if (el.overviewOpportunityBody) {
    const rows = computeOpportunityRows(products, recentEvents).slice(0, 5);
    if (rows.length === 0) {
      el.overviewOpportunityBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('analytics.b1.empty'))}</p>`;
    } else {
      el.overviewOpportunityBody.innerHTML = rows.map((row) => `
        <div class="analytics-opportunity-row">
          <strong>${escapeHtml(row.name)}</strong>
          <span>${escapeHtml(row.tryOn)} ${escapeHtml(t('analytics.overview.tryOnUnit'))}</span>
          <span>${escapeHtml(row.conversion.toFixed(1))}%</span>
        </div>
      `).join('');
    }
  }

  if (el.opsAlertBody) {
    const alerts = computeAlertRows(grouped);
    if (alerts.length === 0) {
      el.opsAlertBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('analytics.b2.empty'))}</p>`;
    } else {
      el.opsAlertBody.innerHTML = `<ul class="analytics-alert-list">${alerts.map((alert) => `
        <li class="analytics-alert-item analytics-alert-item--${escapeHtml(alert.level)}">
          <div><strong>${escapeHtml(alert.title)}</strong></div>
          <div>${escapeHtml(alert.detail)}</div>
          <div class="hint">${escapeHtml(alert.action)}</div>
        </li>
      `).join('')}</ul>`;
    }
  }
  if (el.overviewAlertBody) {
    const alerts = computeAlertRows(grouped);
    if (alerts.length === 0) {
      el.overviewAlertBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('analytics.b2.empty'))}</p>`;
    } else {
      el.overviewAlertBody.innerHTML = `<ul class="analytics-alert-list">${alerts.map((alert) => `
        <li class="analytics-alert-item analytics-alert-item--${escapeHtml(alert.level)}">
          <div><strong>${escapeHtml(alert.title)}</strong></div>
          <div class="hint">${escapeHtml(alert.action)}</div>
        </li>
      `).join('')}</ul>`;
    }
  }

  const skuRows = computeSkuReplenishment(products, sales7d, inventoryRows);

  if (el.replenishmentSafetyBody) {
    const topRiskRows = skuRows.slice(0, 8);
    if (topRiskRows.length === 0) {
      el.replenishmentSafetyBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('analytics.c1.empty'))}</p>`;
    } else {
      const maxSafety = Math.max(...topRiskRows.map((row) => Math.max(row.safetyStock, row.currentStock, 1)), 1);
      el.replenishmentSafetyBody.innerHTML = topRiskRows.map((row) => `
        <div class="analytics-safety-row">
          <strong>${escapeHtml(row.sku)}</strong>
          <div class="analytics-safety-track"><div class="analytics-safety-fill analytics-safety-fill--${escapeHtml(row.riskLevel)}" style="width:${((row.currentStock / maxSafety) * 100).toFixed(1)}%"></div></div>
          <span>${escapeHtml(String(row.currentStock))}/${escapeHtml(String(row.safetyStock))}</span>
        </div>
      `).join('');
    }
  }

  if (el.replenishmentPriorityBody) {
    const priorityRows = skuRows.filter((row) => row.suggestedQty > 0).slice(0, 10);
    if (priorityRows.length === 0) {
      el.replenishmentPriorityBody.innerHTML = `<p class="analytics-empty">${escapeHtml(t('analytics.c3.empty'))}</p>`;
    } else {
      el.replenishmentPriorityBody.innerHTML = `
        <div class="analytics-priority-head">
          <span>${escapeHtml(t('analytics.c3.rank'))}</span>
          <span>${escapeHtml(t('analytics.c3.sku'))}</span>
          <span>${escapeHtml(t('analytics.c3.gap'))}</span>
          <span>${escapeHtml(t('analytics.c3.score'))}</span>
        </div>
        ${priorityRows.map((row, index) => `
          <div class="analytics-priority-row">
            <span>${escapeHtml(String(index + 1))}</span>
            <strong>${escapeHtml(row.sku)}</strong>
            <span>${escapeHtml(String(row.suggestedQty))}</span>
            <span>${escapeHtml(row.priorityScore.toFixed(1))}</span>
          </div>
        `).join('')}
      `;
    }
  }
}

function renderDashboard(products, latestEventMap, presenceMap, todaySessions = [], todaySaleEvents = [], sales7d = [], inventoryRows = [], recentEvents = []) {
  lastRenderContext = { products, latestEventMap, presenceMap, todaySessions, todaySaleEvents, sales7d, inventoryRows, recentEvents };
  const grouped = Object.fromEntries(BOARD_STATES.map((s) => [s, []]));
  const eventFittingKeys = [];
  latestEventMap.forEach((event, key) => {
    if (normalizeStateFromEvent(event) === 'FITTING_ROOM') {
      eventFittingKeys.push(key);
    }
  });
  const presenceKeys = new Set(presenceMap.keys());
  const fittingWithoutPresence = eventFittingKeys.filter((key) => !presenceKeys.has(key));

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
  const abnormalDiag = {
    fittingRows: 0,
    abnormalRows: 0,
    fittingButNotAbnormalRows: 0,
    noPresenceButEventSaysFittingRows: 0,
    stalePresenceRows: 0,
    stalePresenceAndEventFittingRows: 0,
    overstayThresholdMinutes: overstayMinutes
  };

  products.forEach((product) => {
    const productKey = productKeyFromProduct(product);
    const event = latestEventMap.get(productKey);
    const presence = productKey ? presenceMap.get(productKey) : null;
    const lastSeenMs = Date.parse(presence?.last_seen_at);
    const enteredMs = Date.parse(presence?.entered_at);
    const presenceStale = Boolean(presence)
      && (!Number.isFinite(lastSeenMs) || nowMs - lastSeenMs > FITTING_EXIT_TIMEOUT_MS);
    const eventState = normalizeStateFromEvent(event || {});
    const { state: rawState, abnormal: rawAbnormal } = deriveStateByPresence(productKey, event, presence, nowMs, overstayMs);
    const overrideState = productKey ? localLaneOverrides.get(productKey) : null;
    const state = overrideState || (rawState === 'SOLD' ? 'CHECKOUT' : rawState);
    const normalizedState = BOARD_STATES.includes(state) ? state : 'RACK';
    const abnormal = normalizedState === 'FITTING_ROOM' ? rawAbnormal : false;
    const sold = rawState === 'SOLD' || event?.event_type === 'sale_completed';
    grouped[normalizedState].push({ product, event, abnormal, state: normalizedState, productKey, sold });

    if (normalizedState === 'FITTING_ROOM') {
      abnormalDiag.fittingRows += 1;
      if (abnormal) {
        abnormalDiag.abnormalRows += 1;
      } else {
        abnormalDiag.fittingButNotAbnormalRows += 1;
      }
    }
    if (!presence && eventState === 'FITTING_ROOM') {
      abnormalDiag.noPresenceButEventSaysFittingRows += 1;
    }
    if (presenceStale) {
      abnormalDiag.stalePresenceRows += 1;
      if (eventState === 'FITTING_ROOM') {
        abnormalDiag.stalePresenceAndEventFittingRows += 1;
      }
    }

    debugStateRows.push({
      productKey,
      name: product.display_name || product.name_en || product.name || null,
      state: normalizedState,
      abnormal,
      lastReader: event?.reader_id || null,
      eventState,
      presenceStale,
      lastSeenAgeSec: Number.isFinite(lastSeenMs) ? Math.floor((nowMs - lastSeenMs) / 1000) : null,
      enteredAgeSec: Number.isFinite(enteredMs) ? Math.floor((nowMs - enteredMs) / 1000) : null,
      presenceLastSeen: presence?.last_seen_at || null,
      presenceEnteredAt: presence?.entered_at || null
    });
  });

  console.table(debugStateRows.slice(0, 20));
  console.log('[abnormal] pipeline diagnostics', abnormalDiag);
  if (abnormalDiag.fittingRows > 0 && abnormalDiag.abnormalRows === 0) {
    console.warn('[abnormal][diag] fitting items exist but abnormal is zero', {
      likelyCauseA: 'presence rows are stale (front-end timeout too strict or heartbeat not updated)',
      likelyCauseB: 'no presence row for fitting items, so fallback keeps abnormal=false',
      fittingRows: abnormalDiag.fittingRows,
      stalePresenceRows: abnormalDiag.stalePresenceRows,
      stalePresenceAndEventFittingRows: abnormalDiag.stalePresenceAndEventFittingRows,
      noPresenceButEventSaysFittingRows: abnormalDiag.noPresenceButEventSaysFittingRows,
      overstayThresholdMinutes: abnormalDiag.overstayThresholdMinutes,
      fittingExitTimeoutMs: FITTING_EXIT_TIMEOUT_MS
    });
  }
  const stateReconcileDiag = {
    productsCount: products.length,
    latestEventKeyCount: latestEventMap.size,
    presenceKeyCount: presenceMap.size,
    fittingByLatestEventCount: eventFittingKeys.length,
    fittingByPresenceCount: grouped.FITTING_ROOM.length,
    forcedRackBecausePresenceMissingCount: fittingWithoutPresence.length,
    forcedRackSample: fittingWithoutPresence.slice(0, 8)
  };
  if (fittingWithoutPresence.length > 0) {
    console.warn('[dashboard] fitting reconciliation mismatch', stateReconcileDiag);
  } else {
    console.log('[dashboard] fitting reconciliation', stateReconcileDiag);
  }

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

  const summaryModel = buildDashboardSummaryModel({
    grouped,
    todaySessions,
    todaySaleEvents,
    recentEvents,
    products,
    sales7d,
    inventoryRows
  });
  renderDashboardSummary(summaryModel);

  renderManagerOverview({ grouped, todaySessions, todaySaleEvents, products, recentEvents });

  renderAnalyticsModules({ products, grouped, todaySessions, todaySaleEvents, recentEvents, sales7d, inventoryRows });

  if (!el.dashboard) return;

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

  console.log('[overlay] open requested', {
    at: new Date().toISOString(),
    hiddenBeforeOpen: el.itemDetailOverlay.hidden,
    sku,
    state,
    eventType: event?.event_type || null
  });
  el.itemDetailOverlay.hidden = false;
  console.log('[overlay] open applied', {
    at: new Date().toISOString(),
    hiddenAfterOpen: el.itemDetailOverlay.hidden
  });
}

function appendActivityLog({ name, fromState, toState, timestamp }) {
  if (!el.activityTimeline) return;
  const li = document.createElement('li');
  li.innerHTML = `
    <div><strong>${escapeHtml(t('timeline.dragAction', {
      name,
      from: t(`state.${fromState}`),
      to: t(`state.${toState}`)
    }))}</strong></div>
    <div>${t('events.time')}: ${escapeHtml(formatDateTime(timestamp || new Date().toISOString()))}</div>
  `;
  el.activityTimeline.prepend(li);
  trimLogList(el.activityTimeline);
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
    lastRenderContext.inventoryRows || [],
    lastRenderContext.recentEvents || []
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
    if (!card) {
      console.log('[dnd] dragstart ignored: no .product-card target', {
        at: new Date().toISOString(),
        targetTag: event.target?.tagName || null
      });
      return;
    }
    const productKey = card.dataset.productKey;
    if (!productKey) {
      console.log('[dnd] dragstart ignored: missing productKey', {
        at: new Date().toISOString()
      });
      return;
    }
    dragProductKey = productKey;
    card.classList.add('is-dragging');
    event.dataTransfer?.setData('text/plain', productKey);
    event.dataTransfer.effectAllowed = 'move';
    console.log('[dnd] dragstart', {
      at: new Date().toISOString(),
      productKey,
      fromState: card.dataset.currentState || null
    });
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
    if (!column) {
      console.log('[dnd] drop ignored: no .state-column target', {
        at: new Date().toISOString(),
        targetTag: event.target?.tagName || null
      });
      return;
    }
    event.preventDefault();

    const toState = column.dataset.state;
    const productKey = dragProductKey || event.dataTransfer?.getData('text/plain');
    if (!toState || !productKey) {
      console.log('[dnd] drop ignored: missing toState/productKey', {
        at: new Date().toISOString(),
        toState: toState || null,
        productKey: productKey || null,
        dragProductKey: dragProductKey || null
      });
      return;
    }

    const card = el.dashboard.querySelector(`.product-card[data-product-key="${CSS.escape(productKey)}"]`);
    const fromState = card?.dataset.currentState || 'RACK';
    if (fromState === toState) {
      console.log('[dnd] drop ignored: fromState equals toState', {
        at: new Date().toISOString(),
        productKey,
        fromState,
        toState
      });
      return;
    }

    console.log('[dnd] drop accepted', {
      at: new Date().toISOString(),
      productKey,
      fromState,
      toState
    });

    const product = (lastRenderContext?.products || []).find((item) => productKeyFromProduct(item) === productKey);

    localLaneOverrides.set(productKey, toState);
    const productName = card?.querySelector('strong')?.textContent || productKey;
    appendActivityLog({ name: productName, fromState, toState });
    rerenderFromCache();

    try {
      console.log('[dnd] sync start', {
        at: new Date().toISOString(),
        productKey,
        fromState,
        toState
      });
      await syncDragAction({ product, fromState, toState });
      console.log('[dnd] sync success', {
        at: new Date().toISOString(),
        productKey,
        toState
      });
      await fetchAndRenderDashboard();
    } catch (error) {
      console.log('[dnd] sync failed', {
        at: new Date().toISOString(),
        productKey,
        fromState,
        toState,
        message: error?.message || String(error)
      });
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
  const fromZone = payload?.from_zone || '';
  const toZone = payload?.to_zone || '';
  const li = document.createElement('li');
  li.innerHTML = `
    <div><strong>${escapeHtml(payload.reader_id || t('events.unknownReader'))}</strong></div>
    <div>${t('events.epc')}: ${escapeHtml(payload.epc_data || '-')}</div>
    <div>${t('events.eventType')}: ${escapeHtml(formatEventTypeLabel(payload.event_type))}</div>
    <div>${t('events.fromZone')}: ${escapeHtml(fromZone ? formatZoneLabel(fromZone) : '-')}</div>
    <div>${t('events.toZone')}: ${escapeHtml(toZone ? formatZoneLabel(toZone) : '-')}</div>
    <div>${t('events.time')}: ${escapeHtml(formatDateTime(payload.timestamp || new Date().toISOString()))}</div>
  `;
  el.eventLog.prepend(li);
  trimLogList(el.eventLog);
}

async function fetchAndRenderDashboard() {
  if (!supabase) {
    setStatus(t('status.notConnected'), 'warn');
    console.warn('[dashboard] supabase client not ready', {
      hasClient: !!supabase,
      savedUrl: readStorage(URL_KEY, null),
      hasAnonKey: !!readStorage(ANON_KEY, '')
    });
    return;
  }

  if (!el.dashboard && !el.productSkuSummary) {
    console.debug('[dom] #dashboard/#productSkuSummary not found on current page, skip render');
    return;
  }

  setStatus(t('status.loading'), 'warn');
  console.log('[dashboard] start fetching products + rfid_events');

  const sevenDaysAgoIso = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();

  const [productsRes, eventsRes, translationsRes, presenceRes, todaySessionsRes, todaySalesRes, sales7dRes, inventoryRes] = await Promise.all([
    supabase.from('products').select('id,name,name_en,description_en,image_url,price,size,color,sku,style_no,item_no,epc_data,epc_company_prefix,item_reference').order('id', { ascending: true }),
    supabase.from('rfid_events').select('epc_data,reader_id,timestamp,event_type,event_source,from_zone,to_zone').order('timestamp', { ascending: false }).limit(500),
    supabase.from('product_translations').select('product_id,locale,name,description').eq('locale', currentLang),
    supabase.from('fitting_room_presence').select('product_key,entered_at,last_seen_at,last_reader_id'),
    supabase.from('fitting_room_sessions').select('id,converted_to_sale,entered_at,left_at,fitting_room_id,session_status').gte('entered_at', todayStartIso()),
    supabase.from('rfid_events').select('epc_data,timestamp,event_type').eq('event_type', 'sale_completed').gte('timestamp', todayStartIso()),
    supabase.from('rfid_events').select('epc_data').eq('event_type', 'sale_completed').gte('timestamp', sevenDaysAgoIso),
    supabase.from('inventory_items').select('product_id,sku,style_no,item_no,status,epc_data')
  ]);

  if (todaySessionsRes?.error && todaySessionsRes.error.code === '42703') {
    const fallbackTodaySessionsRes = await supabase
      .from('fitting_room_sessions')
      .select('id,converted_to_sale,entered_at,left_at')
      .gte('entered_at', todayStartIso());
    if (!fallbackTodaySessionsRes.error) {
      todaySessionsRes.data = fallbackTodaySessionsRes.data || [];
      todaySessionsRes.error = null;
      console.warn('[dashboard] fitting_room_sessions fallback query applied (reduced columns)', {
        rows: todaySessionsRes.data.length
      });
    }
  }

  if (inventoryRes?.error) {
    if (inventoryRes.error.code === '42703') {
      const fallbackInventoryRes = await supabase
        .from('inventory_items')
        .select('product_id,sku,status,epc_data');
      if (!fallbackInventoryRes.error) {
        inventoryRes.data = fallbackInventoryRes.data || [];
        inventoryRes.error = null;
      } else {
        console.warn('[dashboard] inventory_items fallback query failed', {
          code: fallbackInventoryRes.error.code,
          message: fallbackInventoryRes.error.message,
          hint: fallbackInventoryRes.error.hint,
          details: fallbackInventoryRes.error.details
        });
      }
    }
    if (inventoryRes?.error) {
      console.warn('[dashboard] inventory_items query failed, sku summary will fallback to products if needed', {
        code: inventoryRes.error.code,
        message: inventoryRes.error.message,
        hint: inventoryRes.error.hint,
        details: inventoryRes.error.details
      });
    }
  }

  if (productsRes.error) {
    const productsSchemaDiag = inferSchemaMismatchFromError(productsRes.error, 'products');
    console.warn('[dashboard] products primary query failed, fallback to select(*)', {
      code: productsRes.error.code,
      message: productsRes.error.message,
      details: productsRes.error.details,
      hint: productsRes.error.hint,
      diag: {
        queryColumns: ['id', 'name', 'name_en', 'description_en', 'image_url', 'price', 'size', 'color', 'sku', 'style_no', 'item_no', 'epc_data', 'epc_company_prefix', 'item_reference'],
        likelySchemaMismatch: productsSchemaDiag.isBadRequestLike,
        missingColumn: productsSchemaDiag.missingColumn,
        missingTable: productsSchemaDiag.missingTable,
        maybeUndefinedFunction: productsSchemaDiag.maybeUndefinedFunction
      }
    });
    const fallbackProductsRes = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });
    if (fallbackProductsRes.error) {
      console.error('[dashboard] products fallback query failed:', fallbackProductsRes.error);
      throw fallbackProductsRes.error;
    }
    productsRes.data = fallbackProductsRes.data;
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
    const presenceDiag = inferSchemaMismatchFromError(presenceRes.error, 'fitting_room_presence');
    console.warn('[dashboard] fitting_room_presence query skipped', {
      code: presenceRes.error.code,
      message: presenceRes.error.message,
      hint: presenceRes.error.hint,
      details: presenceRes.error.details,
      diag: {
        likelyPolicyOrFunctionIssue: presenceDiag.isServerErrorLike || (presenceDiag.raw?.code === '42501'),
        likelySchemaMismatch: presenceDiag.isBadRequestLike,
        missingColumn: presenceDiag.missingColumn,
        missingTable: presenceDiag.missingTable,
        maybeUndefinedFunction: presenceDiag.maybeUndefinedFunction
      }
    });
    return [];
  })();

  if (todaySessionsRes?.error) {
    console.warn('[dashboard] fitting_room_sessions query failed, today fitting KPI will fallback to 0', {
      code: todaySessionsRes.error.code,
      message: todaySessionsRes.error.message,
      hint: todaySessionsRes.error.hint,
      details: todaySessionsRes.error.details
    });
  }

  if (todaySalesRes?.error) {
    console.warn('[dashboard] sale_completed(today) query failed, today sales KPI will fallback to 0', {
      code: todaySalesRes.error.code,
      message: todaySalesRes.error.message,
      hint: todaySalesRes.error.hint,
      details: todaySalesRes.error.details
    });
  }

  const translationMap = new Map((translationsRes.data || []).map((row) => [row.product_id, row]));
  const localizedProducts = (productsRes.data || []).map((product) => {
    const tr = translationMap.get(product.id);
    return {
      ...product,
      display_name: tr?.name || product.name_en || product.name || null,
      display_description: tr?.description || product.description_en || null
    };
  });

  console.log('[dashboard] products sku snapshot', {
    totalProducts: localizedProducts.length,
    productsWithSku: localizedProducts.filter((p) => resolveSkuValue(p?.sku)).length,
    productsWithoutSku: localizedProducts.filter((p) => !resolveSkuValue(p?.sku)).length,
    productsWithSize: localizedProducts.filter((p) => String(p?.size ?? '').trim()).length,
    productsWithColor: localizedProducts.filter((p) => String(p?.color ?? '').trim()).length,
    productsWithoutSkuSample: localizedProducts
      .filter((p) => !resolveSkuValue(p?.sku))
      .slice(0, 5)
      .map((p) => ({
        id: p?.id ?? null,
        name: p?.display_name || p?.name_en || p?.name || null,
        sku: p?.sku ?? null,
        epc_company_prefix: p?.epc_company_prefix ?? null,
        item_reference: p?.item_reference ?? null
      }))
  });

  const latestMap = buildLatestStateMap(eventsRes.data || []);
  const presenceMap = buildPresenceMap(safePresenceRows);
  const safeTodaySessions = todaySessionsRes?.error ? [] : (todaySessionsRes?.data || []);
  const safeTodaySales = todaySalesRes?.error ? [] : (todaySalesRes?.data || []);
  const safeSales7d = sales7dRes?.error ? [] : (sales7dRes?.data || []);
  const safeInventoryRows = inventoryRes?.error ? [] : (inventoryRes?.data || []);
  const safeRecentEvents = eventsRes?.data || [];

  renderActivityTimelineFromEvents(safeRecentEvents, localizedProducts);
  renderEventLogList(safeRecentEvents);

  if (!inventoryRes?.error && safeInventoryRows.length === 0 && (productsRes.data || []).length > 0) {
    console.warn('[dashboard] inventory_items returned 0 rows while products exist; possible RLS/no-select-policy or wrong project data source', {
      productsCount: (productsRes.data || []).length,
      inventoryCount: safeInventoryRows.length
    });
  }

  console.log('[product-summary] query snapshot', {
    productsCount: (localizedProducts || []).length,
    eventsCount: (eventsRes?.data || []).length,
    presenceCount: (safePresenceRows || []).length,
    inventoryCount: safeInventoryRows.length,
    inventoryWithProductId: safeInventoryRows.filter((r) => r?.product_id != null).length,
    inventoryWithoutProductId: safeInventoryRows.filter((r) => r?.product_id == null).length,
    productsWithEpc: (localizedProducts || []).filter((p) => String(p?.epc_data || '').trim() || (String(p?.epc_company_prefix || '').trim() && String(p?.item_reference || '').trim())).length,
    inventoryWithEpc: safeInventoryRows.filter((r) => String(r?.epc_data || '').trim()).length,
    productsWithAnySku: (localizedProducts || []).filter((p) => resolveSkuValue(p?.sku)).length,
    inventoryWithSku: safeInventoryRows.filter((r) => String(r?.sku || '').trim()).length
  });

  if (el.productSkuSummary) {
    const skuSummaryRows = buildSkuSummaryRows(
      localizedProducts,
      eventsRes.data || [],
      safePresenceRows,
      safeInventoryRows
    );
    lastSkuSummary = skuSummaryRows;
    renderProductSkuSummary(skuSummaryRows);
  }

  console.log('[dashboard] key matching preview', {
    productKeySample: (productsRes.data || []).slice(0, 5).map((p) => productKeyFromProduct(p)),
    eventKeySample: (eventsRes.data || []).slice(0, 5).map((e) => productKeyFromEvent(e))
  });
  if (el.dashboard) {
    renderDashboard(localizedProducts, latestMap, presenceMap, safeTodaySessions, safeTodaySales, safeSales7d, safeInventoryRows, safeRecentEvents);
  }
  console.log('[dashboard] render success', {
    products: localizedProducts.length,
    events: (eventsRes.data || []).length
  });
  setStatus(t('status.connected'), 'ok');
}

// backward compatibility for existing call sites
const loadDashboardData = fetchAndRenderDashboard;

async function connectSupabase(url, anonKey, accessToken = null) {
  if (subscription) {
    await subscription.unsubscribe();
    subscription = null;
  }

  const authHeader = String(accessToken || '').trim();
  if (!authHeader) {
    throw new Error('請先登入後再連線 Dashboard（缺少 Supabase access token）');
  }

  supabase = createSupabaseClient(url, anonKey, authHeader);
  setAppState({ supabaseClient: supabase, connectionStatus: 'connecting' });
  console.log('[supabase] client created', {
    urlHost: (() => {
      try {
        return new URL(url).host;
      } catch {
        return 'INVALID_URL';
      }
    })(),
    anonKeyLength: anonKey?.length || 0,
    hasAuthHeader: Boolean(authHeader)
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
  setAppState({ connectionStatus: 'connected' });
}

async function handleConfigSubmit(event) {
  event.preventDefault();

  const url = el.supabaseUrl.value.trim();
  const anonKey = el.supabaseAnonKey.value.trim();

  try {
    writeStorage(URL_KEY, url);
    writeStorage(ANON_KEY, anonKey);
    writeJsonStorage(STORAGE_KEY, { url, anonKey });
    const session = getSession();
    await connectSupabase(url, anonKey, session?.accessToken || null);
  } catch (error) {
    setStatus(t('status.connectionFailed', { message: error.message }), 'err');
  }
}

async function handleCsvImport(event) {
  event.preventDefault();
  if (!canUseCsvImport()) {
    el.importResult.textContent = [
      '匯入失敗',
      '原因：目前帳號無匯入權限',
      '資料筆數（inventory_items）：0',
      '產品總數（products）：0'
    ].join('\n');
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
      currentFrontendSupabaseUrl: readStorage(URL_KEY, null)
    });

    const response = await fetch('/api/bulk-products', {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ rows })
    });

    const { data: result } = await parseApiResponse(response, 'bulk-products');
    if (!response.ok) {
      const skuConflictDetails = formatSkuConflictDetails(result);
      const baseMessage = getApiErrorMessage(result, t('error.bulkImportFailed'));
      throw new Error(skuConflictDetails ? `${baseMessage}\n${skuConflictDetails}` : baseMessage);
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

    const productCount = Number(result?.affected);
    const inventoryCount = Number(result?.inventory_items_upserted);
    el.importResult.textContent = [
      '匯入成功',
      `資料筆數（inventory_items）：${Number.isFinite(inventoryCount) ? inventoryCount : rows.length}`,
      `產品總數（products）：${Number.isFinite(productCount) ? productCount : '-'}`
    ].join('\n');
    if (!supabase) {
      console.warn('[csv] imported successfully but dashboard refresh cannot query DB because supabase client is not connected');
    }
    await fetchAndRenderDashboard();
  } catch (error) {
    console.error('[csv] import failed', error);
    el.importResult.textContent = [
      '匯入失敗',
      `原因：${error?.message || '未知錯誤'}`,
      '資料筆數（inventory_items）：0',
      '產品總數（products）：0'
    ].join('\n');
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
  const sharedState = getAppState();
  if (sharedState?.supabaseClient) {
    supabase = sharedState.supabaseClient;
  } else {
    supabase = getSupabaseClient();
  }

  currentLang = getCurrentLang();
  currentMode = getCurrentMode();
  currentProductSummaryView = getCurrentProductSummaryView();
  setAppState({ currentLang, currentMode, currentProductSummaryView });
  syncTopNavActiveState();
  populateLanguageSelect();
  applyI18nToStaticText();
  applyModeUiFromState();
  applyProductSummaryViewUi();

  console.log('[dom-check]', {
    dashboard: !!el.dashboard,
    eventLog: !!el.eventLog,
    connectionStatus: !!el.connectionStatus
  });

  const session = getSession();
  setAppState({ session });
  setAppVisibility(Boolean(session));
  applyAuthUi(session);
  setMainView(session ? 'home' : 'home');

  if (el.logoutButton) {
    el.logoutButton.addEventListener('click', handleLogout);
  }
  if (el.logoutButtonHome) {
    el.logoutButtonHome.addEventListener('click', handleLogout);
  }
  if (el.homeToDashboardTop) {
    el.homeToDashboardTop.addEventListener('click', () => handleHomeCardNavigation('dashboard'));
  }
  if (el.homeCardDashboard) {
    el.homeCardDashboard.addEventListener('click', () => handleHomeCardNavigation('dashboard'));
  }
  if (el.homeCardFittingDemo) {
    el.homeCardFittingDemo.addEventListener('click', () => handleHomeCardNavigation('fittingDemo'));
  }
  if (el.homeCardProduct) {
    el.homeCardProduct.addEventListener('click', () => handleHomeCardNavigation('product'));
  }
  if (el.homeCardSetting) {
    el.homeCardSetting.addEventListener('click', () => handleHomeCardNavigation('setting'));
  }
  if (el.homeCardCsvImport) {
    el.homeCardCsvImport.addEventListener('click', () => handleHomeCardNavigation('csv'));
  }
  if (el.backToHome) {
    el.backToHome.addEventListener('click', () => {
      closeDemoControls();
      navigateToHome();
    });
  }

  if (el.languageSelect) {
    el.languageSelect.addEventListener('change', async (event) => {
      const nextLang = event.target.value;
      if (!SUPPORTED_LANGS.includes(nextLang)) return;
      currentLang = nextLang;
      writeStorage(LANG_KEY, currentLang);
      applyI18nToStaticText();
      if (el.technicalBoardBody && el.technicalBoardToggle) {
        setTechnicalBoardVisibility(!el.technicalBoardBody.hidden);
      }
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
      writeStorage(MODE_KEY, currentMode);
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
      console.log('[overlay] close button clicked', {
        at: new Date().toISOString(),
        hiddenBeforeClose: el.itemDetailOverlay.hidden
      });
      el.itemDetailOverlay.hidden = true;
      console.log('[overlay] close button applied', {
        at: new Date().toISOString(),
        hiddenAfterClose: el.itemDetailOverlay.hidden
      });
    });

    el.itemDetailOverlay.addEventListener('click', (event) => {
      console.log('[overlay] backdrop click', {
        at: new Date().toISOString(),
        isBackdrop: event.target === el.itemDetailOverlay,
        targetTag: event.target?.tagName || null,
        hiddenBeforeBackdropClose: el.itemDetailOverlay.hidden
      });
      if (event.target === el.itemDetailOverlay) {
        el.itemDetailOverlay.hidden = true;
        console.log('[overlay] backdrop close applied', {
          at: new Date().toISOString(),
          hiddenAfterBackdropClose: el.itemDetailOverlay.hidden
        });
      }
    });

    console.log('[overlay] listeners bound', {
      at: new Date().toISOString(),
      initialHidden: el.itemDetailOverlay.hidden
    });
  }

  if (el.demoControlsToggle) {
    el.demoControlsToggle.addEventListener('click', () => {
      populateQuickActionProducts(lastRenderContext?.products || []);
      openDemoControls();
    });
  }
  if (el.demoControlsClose) {
    el.demoControlsClose.addEventListener('click', closeDemoControls);
  }
  if (el.demoControlsBackdrop) {
    el.demoControlsBackdrop.addEventListener('click', closeDemoControls);
  }
  if (el.quickActionForm) {
    el.quickActionForm.addEventListener('submit', handleQuickActionSubmit);
  }
  document.querySelectorAll('.scenario-run').forEach((button) => {
    button.addEventListener('click', handleScenarioRun);
  });
  if (el.seedTodayData) {
    el.seedTodayData.addEventListener('click', handleSeedTodayData);
  }
  if (el.clearActiveAlerts) {
    el.clearActiveAlerts.addEventListener('click', handleClearActiveAlerts);
  }
  if (el.resetDemoData) {
    el.resetDemoData.addEventListener('click', handleResetDemoData);
  }

  if (el.configForm) {
    el.configForm.addEventListener('submit', handleConfigSubmit);
  }
  if (el.csvImportForm) {
    el.csvImportForm.addEventListener('submit', handleCsvImport);
  }
  if (el.groupedCsvImportForm) {
    console.log('[grouped-import] submit listener bound');
    el.groupedCsvImportForm.addEventListener('submit', handleGroupedCsvImport);
  }
  if (el.groupedCsvFile) {
    el.groupedCsvFile.addEventListener('change', previewGroupedCsvFile);
  }
  if (el.groupedPartition) {
    el.groupedPartition.addEventListener('change', previewGroupedCsvFile);
  }
  if (el.settingSubnav) {
    el.settingSubnav.addEventListener('click', (event) => {
      const target = event.target.closest('[data-setting-tab]');
      if (!target) return;
      const tab = String(target.getAttribute('data-setting-tab') || '').trim();
      if (!SETTING_TABS.includes(tab)) return;
      setSettingTab(tab);
    });
  }
  if (el.adminUserRole) {
    el.adminUserRole.addEventListener('change', syncAdminUserTrialInputState);
  }
  if (el.adminUserRefreshButton) {
    el.adminUserRefreshButton.addEventListener('click', () => {
      adminUserState.loaded = false;
      fetchAdminUsers({ append: false });
    });
  }
  if (el.adminUserLoadMoreButton) {
    el.adminUserLoadMoreButton.addEventListener('click', () => {
      fetchAdminUsers({ append: true });
    });
  }
  if (el.adminTrialRefreshButton) {
    el.adminTrialRefreshButton.addEventListener('click', () => {
      adminTrialState.loaded = false;
      fetchTrialRequests({ append: false });
    });
  }
  if (el.adminTrialLoadMoreButton) {
    el.adminTrialLoadMoreButton.addEventListener('click', () => {
      fetchTrialRequests({ append: true });
    });
  }
  if (el.adminUserSearch) {
    el.adminUserSearch.addEventListener('change', applyAdminUserFiltersFromInputs);
  }
  if (el.adminUserRoleFilter) {
    el.adminUserRoleFilter.addEventListener('change', applyAdminUserFiltersFromInputs);
  }
  if (el.adminUserStatusFilter) {
    el.adminUserStatusFilter.addEventListener('change', applyAdminUserFiltersFromInputs);
  }
  if (el.adminTrialSearch) {
    el.adminTrialSearch.addEventListener('change', applyAdminTrialFiltersFromInputs);
  }
  if (el.adminTrialStatusFilter) {
    el.adminTrialStatusFilter.addEventListener('change', applyAdminTrialFiltersFromInputs);
  }
  if (el.adminUserForm) {
    el.adminUserForm.addEventListener('submit', handleAdminUserSubmit);
  }
  if (el.adminUserResetButton) {
    el.adminUserResetButton.addEventListener('click', resetAdminUserForm);
  }
  if (el.adminUserDeleteButton) {
    el.adminUserDeleteButton.addEventListener('click', () => {
      const userId = String(el.adminUserEditingId?.value || '').trim();
      if (!userId) return;
      handleDeleteUserById(userId);
    });
  }
  if (el.adminUserTableBody) {
    el.adminUserTableBody.addEventListener('click', (event) => {
      const target = event.target.closest('[data-user-action]');
      if (!target) return;
      const action = String(target.getAttribute('data-user-action') || '').trim();
      const userId = String(target.getAttribute('data-user-id') || '').trim();
      if (!action || !userId) return;
      const selected = adminUserState.items.find((item) => String(item.user_id || '') === userId);
      if (!selected) return;
      if (action === 'edit') {
        fillAdminUserForm(selected);
        return;
      }
      if (action === 'delete') {
        handleDeleteUserById(userId);
      }
    });
  }
  if (el.groupedFilter) {
    el.groupedFilter.addEventListener('change', previewGroupedCsvFile);
  }
  if (el.productStyleNoFilter) {
    el.productStyleNoFilter.addEventListener('input', () => {
      renderProductSkuSummary(lastSkuSummary);
    });
  }
  if (el.productItemNoFilter) {
    el.productItemNoFilter.addEventListener('input', () => {
      renderProductSkuSummary(lastSkuSummary);
    });
  }
  if (el.productFilterReset) {
    el.productFilterReset.addEventListener('click', () => {
      if (el.productStyleNoFilter) el.productStyleNoFilter.value = '';
      if (el.productItemNoFilter) el.productItemNoFilter.value = '';
      renderProductSkuSummary(lastSkuSummary);
    });
  }
  if (el.productSummaryViewSku) {
    el.productSummaryViewSku.addEventListener('click', () => {
      setProductSummaryView('sku');
    });
  }
  if (el.productSummaryViewNested) {
    el.productSummaryViewNested.addEventListener('click', () => {
      setProductSummaryView('nested');
    });
  }
  if (el.simulateForm) {
    el.simulateForm.addEventListener('submit', handleSimulateSubmit);
  }
  bindBoardDnD();
  if (el.technicalBoardToggle) {
    setTechnicalBoardVisibility(false);
    el.technicalBoardToggle.addEventListener('click', () => {
      const expanded = el.technicalBoardBody ? !el.technicalBoardBody.hidden : false;
      setTechnicalBoardVisibility(expanded);
    });
  }
  if (el.refreshButton) {
    el.refreshButton.addEventListener('click', async () => {
      try {
        await fetchAndRenderDashboard();
      } catch (error) {
        setStatus(t('status.refreshFailed', { message: error.message }), 'err');
      }
    });
  }
  const csvImportTabGrouped = document.getElementById('csvImportTabGrouped');
  const csvImportTabSimple = document.getElementById('csvImportTabSimple');
  const csvImportPanelGrouped = document.getElementById('csvImportPanelGrouped');
  const csvImportPanelSimple = document.getElementById('csvImportPanelSimple');
  if (csvImportTabGrouped && csvImportTabSimple && csvImportPanelGrouped && csvImportPanelSimple) {
    csvImportTabGrouped.addEventListener('click', () => {
      csvImportPanelGrouped.hidden = false;
      csvImportPanelSimple.hidden = true;
      csvImportTabGrouped.classList.add('is-active');
      csvImportTabSimple.classList.remove('is-active');
      csvImportTabGrouped.setAttribute('aria-selected', 'true');
      csvImportTabSimple.setAttribute('aria-selected', 'false');
    });
    csvImportTabSimple.addEventListener('click', () => {
      csvImportPanelGrouped.hidden = true;
      csvImportPanelSimple.hidden = false;
      csvImportTabSimple.classList.add('is-active');
      csvImportTabGrouped.classList.remove('is-active');
      csvImportTabSimple.setAttribute('aria-selected', 'true');
      csvImportTabGrouped.setAttribute('aria-selected', 'false');
    });
  }

  // preferred: read explicit keys from localStorage
  let url = readStorage(URL_KEY, DEFAULT_SUPABASE_URL);
  let anonKey = readStorage(ANON_KEY, DEFAULT_SUPABASE_ANON_KEY);

  // fallback for old storage schema
  if (!url || !anonKey) {
    const parsed = readJsonStorage(STORAGE_KEY, null);
    if (!parsed && readStorage(STORAGE_KEY, null)) {
      console.warn('[storage] malformed STORAGE_KEY payload');
    }
    url = url || parsed?.url || '';
    anonKey = anonKey || parsed?.anonKey || '';
  }

  if (el.supabaseUrl) el.supabaseUrl.value = url;
  if (el.supabaseAnonKey) el.supabaseAnonKey.value = anonKey;
  resetAdminUserForm();
  syncAdminUserTrialInputState();
  setSettingTab(getSettingTabFromHash(), { updateHash: false });
  window.addEventListener('hashchange', () => {
    if (!window.location.pathname.startsWith('/setting')) return;
    setSettingTab(getSettingTabFromHash(), { updateHash: false });
  });
  onRouteChange(({ path }) => {
    const activeSession = getSession();
    const authenticated = Boolean(activeSession);
    console.info('[router] route changed', {
      path,
      authenticated,
      at: new Date().toISOString()
    });
    setShellAuthVisibility(authenticated);
    applyAuthUi(activeSession);
    if (!authenticated) {
      const target = encodeURIComponent(path || '/');
      window.location.replace(`/login.html?next=${target}`);
      return;
    }

    if ((path === '/setting' || path === '/setting.html') && !canUseSetting(activeSession)) {
      setStatus('目前帳號無設定頁權限', 'warn');
      navigate('/', { replace: true });
      return;
    }
    if ((path === '/csv-import' || path === '/csv-import.html') && !canUseCsvImport(activeSession)) {
      setStatus('目前帳號無 CSV 匯入權限', 'warn');
      navigate('/', { replace: true });
      return;
    }
    if ((path === '/fitting-demo' || path === '/fitting-demo.html') && !canViewFittingDemo(activeSession)) {
      setStatus('目前帳號無試衣間 Demo 權限', 'warn');
      navigate('/', { replace: true });
      return;
    }

    setShellViewByPath(path);
    syncTopNavActiveState(path);
    if (path === '/setting' || path === '/setting.html') {
      setSettingTab(getSettingTabFromHash(), { updateHash: false });
    }
  });

  startRouter();

  if (session) {
    setShellAuthVisibility(true);
    applyAuthUi(session);
    syncTopNavActiveState(getCurrentPath());
    if (url && anonKey) {
      connectSupabase(url, anonKey, session?.accessToken || null).catch((error) => {
        setStatus(t('status.autoConnectFailed', { message: error.message }), 'err');
      });
      return;
    }

    setStatus(t('status.needSupabaseConfig'), 'warn');
  } else {
    const target = encodeURIComponent(getCurrentPath() || '/');
    window.location.replace(`/login.html?next=${target}`);
    return;
  }

  populateQuickActionProducts(lastRenderContext?.products || []);
}

boot();
