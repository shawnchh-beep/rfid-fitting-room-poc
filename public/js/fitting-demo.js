const ROOM_IDS = [1];
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const LOW_STOCK_THRESHOLD = 3;
const LONG_DWELL_SECONDS = 45;
const SESSION_KEY = 'rfid_poc_login_session_v1';
const LANG_KEY = 'rfid_poc_lang_v1';
const DEFAULT_LANG = 'en';
const SUPPORTED_LANGS = ['en', 'zh-Hant'];
const EMBED_FLAG = 'embed';

const EVENT_TYPE_LABELS = {
  item_entered_fitting_room: 'frd.event.enteredRoom',
  item_left_fitting_room: 'frd.event.leftRoom',
  item_returned_to_floor: 'frd.event.returnedRack',
  item_moved_to_checkout: 'frd.event.movedCheckout',
  sale_completed: 'frd.event.saleCompleted'
};

const I18N = {
  en: {
    'frd.pageTitle': 'RFID Fitting Room Demo',
    'frd.header.title': 'Fitting Room Demo',
    'frd.header.subtitle': 'Interactive 3-step retail journey powered by RFID.',
    'frd.aria.primaryNav': 'Primary',
    'frd.aria.languageSelect': 'Language',
    'frd.aria.demoGuide': 'Demo guide',
    'frd.aria.kpiPanel': 'Live KPI panel',
    'frd.aria.demoBoard': 'Fitting room demo board',
    'frd.aria.checkoutPanel': 'Checkout items ready to purchase',
    'frd.nav.home': 'Home',
    'frd.nav.fittingDemo': 'Fitting Demo',
    'frd.language': 'Language',
    'frd.auth.logout': 'Logout',
    'frd.status.mock': 'Demo Mode',
    'frd.status.db': 'Live Catalog',
    'frd.guide.title': 'How this demo works',
    'frd.guide.step1': 'Step 1: Select product',
    'frd.guide.step2': 'Step 2: Drag into fitting room',
    'frd.guide.step3': 'Step 3: Move to checkout or back',
    'frd.guide.kpiHint': 'KPI updates in real time after each action.',
    'frd.kpi.title': 'Live KPI Panel',
    'frd.kpi.tryOns': 'Try-ons',
    'frd.kpi.sales': 'Sales',
    'frd.kpi.conversion': 'Conversion rate',
    'frd.kpi.missedRevenue': 'Missed revenue',
    'frd.kpi.potentialUplift': 'Potential uplift',
    'frd.kpi.tryOnsHint': 'Items entering fitting room',
    'frd.kpi.salesHint': 'Completed purchases',
    'frd.kpi.conversionHint': 'Sales divided by try-ons',
    'frd.kpi.missedRevenueHint': 'Returned try-ons that did not convert',
    'frd.kpi.potentialUpliftHint': 'Recoverable value from fitting-room signals',
    'frd.rack.title': 'Rack',
    'frd.rack.subtitle': 'Choose size and send item to fitting room',
    'frd.rack.available': 'Available {count}',
    'frd.rack.lowStock': 'Low stock',
    'frd.rack.size': 'Size',
    'frd.rack.price': '{price}',
    'frd.rack.pickSizeHint': 'Select a size to create a draggable demo card.',
    'frd.rack.dragHint': 'Drag this card into the fitting room',
    'frd.rack.sendToRoom': 'Try in Fitting Room',
    'frd.rack.empty': 'No demo products available',
    'frd.variant.qty': '{qty} left',
    'frd.rooms.title': 'Fitting Room',
    'frd.rooms.subtitle': 'Track try-ons, dwell time, and next action',
    'frd.room.title': 'Fitting Room',
    'frd.room.items': '{count} items',
    'frd.room.longestDwell': 'Longest dwell {dwell}',
    'frd.room.dwell': 'Dwell {dwell}',
    'frd.room.dropHint': 'Drop selected item here',
    'frd.room.longDwellWarning': 'Long dwell warning',
    'frd.room.actions.sendCheckout': 'Send to Checkout',
    'frd.room.actions.returnRack': 'Return to Rack',
    'frd.checkout.title': 'Checkout',
    'frd.checkout.subtitle': 'Items ready to purchase',
    'frd.checkout.dropHint': 'Drop fitting-room items here',
    'frd.checkout.noPurchases': 'No items ready for checkout',
    'frd.checkout.total': 'Total {amount}',
    'frd.checkout.completeSale': 'Complete Sale',
    'frd.checkout.completed': 'Completed sales: {count}',
    'frd.advanced.toggle': 'Advanced Mode',
    'frd.advanced.title': 'Technical Details',
    'frd.advanced.empty': 'No technical events yet',
    'frd.advanced.sku': 'SKU',
    'frd.advanced.epc': 'EPC',
    'frd.toast.invalidMove': 'Choose a product size first',
    'frd.toast.actionCouldNotComplete': 'Action could not be completed',
    'frd.toast.itemEntered': 'Try-on recorded',
    'frd.toast.itemReturned': 'Lost conversion opportunity',
    'frd.toast.sentCheckout': 'Ready for checkout',
    'frd.toast.conversionImproved': 'Conversion improved',
    'frd.event.enteredRoom': 'Entered fitting room',
    'frd.event.leftRoom': 'Left fitting room',
    'frd.event.returnedRack': 'Returned to rack',
    'frd.event.movedCheckout': 'Moved to checkout',
    'frd.event.saleCompleted': 'Sale completed'
  },
  'zh-Hant': {
    'frd.pageTitle': 'RFID 試衣間 Demo',
    'frd.header.title': '試衣間 Demo',
    'frd.header.subtitle': 'RFID 驅動的三步驟零售互動展示。',
    'frd.aria.primaryNav': '主要導覽',
    'frd.aria.languageSelect': '語言',
    'frd.aria.demoGuide': 'Demo 指引',
    'frd.aria.kpiPanel': '即時 KPI 面板',
    'frd.aria.demoBoard': '試衣間 Demo 看板',
    'frd.aria.checkoutPanel': '待結帳商品',
    'frd.nav.home': '首頁',
    'frd.nav.fittingDemo': '試衣間 Demo',
    'frd.language': '語言',
    'frd.auth.logout': '登出',
    'frd.status.mock': 'Demo 模式',
    'frd.status.db': '即時型錄',
    'frd.guide.title': 'Demo 操作方式',
    'frd.guide.step1': '步驟 1：選擇商品',
    'frd.guide.step2': '步驟 2：拖曳到試衣間',
    'frd.guide.step3': '步驟 3：移至結帳或退回貨架',
    'frd.guide.kpiHint': '每一次操作都會即時更新 KPI。',
    'frd.kpi.title': '即時 KPI 面板',
    'frd.kpi.tryOns': '試穿次數',
    'frd.kpi.sales': '銷售件數',
    'frd.kpi.conversion': '轉換率',
    'frd.kpi.missedRevenue': '流失營收',
    'frd.kpi.potentialUplift': '潛在成長',
    'frd.kpi.tryOnsHint': '進入試衣間的商品數',
    'frd.kpi.salesHint': '已完成購買件數',
    'frd.kpi.conversionHint': '銷售件數 ÷ 試穿次數',
    'frd.kpi.missedRevenueHint': '試穿後退回而未轉換的金額',
    'frd.kpi.potentialUpliftHint': '從試衣間訊號可挽回的價值',
    'frd.rack.title': '貨架',
    'frd.rack.subtitle': '選擇尺寸後送入試衣間',
    'frd.rack.available': '可用 {count}',
    'frd.rack.lowStock': '低庫存',
    'frd.rack.size': '尺寸',
    'frd.rack.price': '{price}',
    'frd.rack.pickSizeHint': '選擇尺寸後會產生可拖曳 Demo 卡片。',
    'frd.rack.dragHint': '將此卡片拖曳到試衣間',
    'frd.rack.sendToRoom': '送入試衣間',
    'frd.rack.empty': '目前沒有 Demo 商品',
    'frd.variant.qty': '剩餘 {qty}',
    'frd.rooms.title': '試衣間',
    'frd.rooms.subtitle': '追蹤試穿、停留時間與下一步',
    'frd.room.title': '試衣間',
    'frd.room.items': '{count} 件',
    'frd.room.longestDwell': '最長停留 {dwell}',
    'frd.room.dwell': '停留 {dwell}',
    'frd.room.dropHint': '將已選商品拖曳到這裡',
    'frd.room.longDwellWarning': '長時間停留警示',
    'frd.room.actions.sendCheckout': '送至結帳',
    'frd.room.actions.returnRack': '退回貨架',
    'frd.checkout.title': '結帳',
    'frd.checkout.subtitle': '待購買商品',
    'frd.checkout.dropHint': '將試衣間商品拖曳到此',
    'frd.checkout.noPurchases': '目前沒有待結帳商品',
    'frd.checkout.total': '總金額 {amount}',
    'frd.checkout.completeSale': '完成銷售',
    'frd.checkout.completed': '已完成銷售：{count}',
    'frd.advanced.toggle': '進階模式',
    'frd.advanced.title': '技術明細',
    'frd.advanced.empty': '尚無技術事件',
    'frd.advanced.sku': 'SKU',
    'frd.advanced.epc': 'EPC',
    'frd.toast.invalidMove': '請先選擇商品尺寸',
    'frd.toast.actionCouldNotComplete': '操作無法完成',
    'frd.toast.itemEntered': '已記錄試穿行為',
    'frd.toast.itemReturned': '流失一次轉換機會',
    'frd.toast.sentCheckout': '已準備結帳',
    'frd.toast.conversionImproved': '轉換率提升',
    'frd.event.enteredRoom': '進入試衣間',
    'frd.event.leftRoom': '離開試衣間',
    'frd.event.returnedRack': '回到貨架',
    'frd.event.movedCheckout': '移至結帳',
    'frd.event.saleCompleted': '完成銷售'
  }
};

const MOCK_SKU_ROWS = [
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000015', product_name: 'Northline Polo Shirt', color: 'Black', size: 'XS', quantity: 4, price_usd: 39 },
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000022', product_name: 'Northline Polo Shirt', color: 'Black', size: 'S', quantity: 8, price_usd: 39 },
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000039', product_name: 'Northline Polo Shirt', color: 'Black', size: 'M', quantity: 14, price_usd: 39 },
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000046', product_name: 'Northline Polo Shirt', color: 'Black', size: 'L', quantity: 12, price_usd: 39 },
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000053', product_name: 'Northline Polo Shirt', color: 'Black', size: 'XL', quantity: 2, price_usd: 39 },
  { style_no: '4521001', item_no: '82210201', sku_ean13: '1234567000114', product_name: 'Cityline Oxford Shirt', color: 'White', size: 'S', quantity: 3, price_usd: 49 },
  { style_no: '4521001', item_no: '82210201', sku_ean13: '1234567000121', product_name: 'Cityline Oxford Shirt', color: 'White', size: 'M', quantity: 6, price_usd: 49 },
  { style_no: '4521001', item_no: '82210201', sku_ean13: '1234567000138', product_name: 'Cityline Oxford Shirt', color: 'White', size: 'L', quantity: 4, price_usd: 49 },
  { style_no: '4522001', item_no: '82210301', sku_ean13: '1234567000152', product_name: 'Trailblaze Chino Pants', color: 'Khaki', size: 'S', quantity: 2, price_usd: 59 },
  { style_no: '4522001', item_no: '82210301', sku_ean13: '1234567000169', product_name: 'Trailblaze Chino Pants', color: 'Khaki', size: 'M', quantity: 4, price_usd: 59 },
  { style_no: '4522001', item_no: '82210301', sku_ean13: '1234567000176', product_name: 'Trailblaze Chino Pants', color: 'Khaki', size: 'L', quantity: 2, price_usd: 59 },
  { style_no: '4523001', item_no: '82210401', sku_ean13: '1234567000206', product_name: 'Meridian Denim Jacket', color: 'Indigo', size: 'S', quantity: 3, price_usd: 89 },
  { style_no: '4523001', item_no: '82210401', sku_ean13: '1234567000213', product_name: 'Meridian Denim Jacket', color: 'Indigo', size: 'M', quantity: 5, price_usd: 89 },
  { style_no: '4523001', item_no: '82210401', sku_ean13: '1234567000220', product_name: 'Meridian Denim Jacket', color: 'Indigo', size: 'L', quantity: 3, price_usd: 89 }
];

let currentLang = DEFAULT_LANG;

const state = {
  rackItems: [],
  selectedItemKey: null,
  selectedSkuKey: null,
  roomAssignments: buildEmptyRooms(),
  checkoutRecords: [],
  completedSalesRecords: [],
  recentEvents: [],
  draggingContext: null,
  roomItemSeq: 1,
  dataSource: 'mock',
  advancedMode: false,
  kpi: {
    tryOns: 0,
    sales: 0,
    missedRevenue: 0
  }
};

const el = {
  rackList: document.getElementById('rackList'),
  roomsGrid: document.getElementById('roomsGrid'),
  checkoutDropzone: document.getElementById('checkoutDropzone'),
  checkoutTotalPrice: document.getElementById('checkoutTotalPrice'),
  checkoutList: document.getElementById('checkoutList'),
  completeSaleButton: document.getElementById('completeSaleButton'),
  advancedToggle: document.getElementById('advancedModeToggle'),
  advancedPanel: document.getElementById('advancedPanel'),
  advancedEventList: document.getElementById('advancedEventList'),
  kpiPanelBody: document.getElementById('kpiPanelBody'),
  status: document.getElementById('fittingDemoStatus'),
  toastContainer: document.getElementById('fittingDemoToastContainer')
};

function ft(key, params = {}) {
  const pack = I18N[currentLang] || I18N[DEFAULT_LANG];
  const template = pack[key] ?? I18N[DEFAULT_LANG][key] ?? key;
  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replaceAll(`{${paramKey}}`, String(value ?? '')),
    template
  );
}

function getCurrentLang() {
  const stored = String(localStorage.getItem(LANG_KEY) || '').trim();
  return Object.prototype.hasOwnProperty.call(I18N, stored) ? stored : DEFAULT_LANG;
}

function applyFittingDemoI18n() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (key) node.textContent = ft(key);
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
    const key = node.getAttribute('data-i18n-aria-label');
    if (key) node.setAttribute('aria-label', ft(key));
  });

  document.documentElement.lang = currentLang;
  document.title = ft('frd.pageTitle');
}

function populateLanguageSelect() {
  const select = document.getElementById('fittingDemoLanguageSelect');
  if (!select) return;
  select.innerHTML = [
    { value: 'en', label: '🇺🇸 English' },
    { value: 'zh-Hant', label: '🇹🇼 繁體中文' }
  ].map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('');
  select.value = SUPPORTED_LANGS.includes(currentLang) ? currentLang : DEFAULT_LANG;
}

function applyEmbedMode() {
  const params = new URLSearchParams(window.location.search);
  const raw = String(params.get(EMBED_FLAG) || '').trim().toLowerCase();
  const shouldEmbed = ['1', 'true', 'yes'].includes(raw) || window.self !== window.top;
  if (!shouldEmbed) return;
  document.body.classList.add('is-embedded-fitting-demo');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildEmptyRooms() {
  return ROOM_IDS.map((roomId) => ({ roomId, items: [] }));
}

function imagePathForItem(itemNo) {
  return `/images/products/${encodeURIComponent(String(itemNo || '').trim())}.png`;
}

function isValidEpcData(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.expiresAt) return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getApiAuthHeaders() {
  const accessToken = String(getSession()?.accessToken || '').trim();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function formatPrice(priceUsd) {
  const amount = Number(priceUsd);
  if (!Number.isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat(currentLang === 'zh-Hant' ? 'zh-TW' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(amount);
}

function formatTime(iso) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleTimeString(currentLang === 'zh-Hant' ? 'zh-TW' : 'en-US');
}

function formatDwell(enteredAtIso) {
  const entered = new Date(enteredAtIso).getTime();
  if (!Number.isFinite(entered)) return '-';
  const sec = Math.max(0, Math.floor((Date.now() - entered) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function isLongDwell(enteredAtIso) {
  const entered = new Date(enteredAtIso).getTime();
  if (!Number.isFinite(entered)) return false;
  return Date.now() - entered >= LONG_DWELL_SECONDS * 1000;
}

function getLongestDwell(room) {
  if (!room?.items?.length) return '00:00';
  const oldest = room.items.reduce((candidate, item) => {
    if (!candidate) return item;
    return new Date(item.enteredAt).getTime() < new Date(candidate.enteredAt).getTime() ? item : candidate;
  }, null);
  return oldest ? formatDwell(oldest.enteredAt) : '00:00';
}

function showToast(message, level = 'ok') {
  if (!el.toastContainer) return;
  const node = document.createElement('div');
  node.className = `toast toast--${level}`;
  node.textContent = String(message || '');
  el.toastContainer.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

function sortBySize(a, b) {
  const ai = SIZE_ORDER.indexOf(String(a?.size || '').toUpperCase());
  const bi = SIZE_ORDER.indexOf(String(b?.size || '').toUpperCase());
  if (ai === -1 && bi === -1) return String(a?.size || '').localeCompare(String(b?.size || ''));
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function generateDemoEpcPool(seed, quantity) {
  const normalizedSeed = String(seed || '0').replace(/\D/g, '').slice(-10).padStart(10, '0');
  const count = Math.max(0, Math.min(Number(quantity) || 0, 50));
  return Array.from({ length: count }, (_, idx) => `300000${normalizedSeed}${String(idx + 1).padStart(8, '0')}`.slice(0, 24));
}

function buildRackData(rows) {
  const groups = new Map();
  (rows || []).forEach((row) => {
    const sku = firstNonEmpty(row?.sku_ean13, row?.sku, row?.skuKey);
    const itemNo = firstNonEmpty(row?.item_no, row?.itemNo, row?.item_reference, sku);
    const productName = firstNonEmpty(row?.product_name, row?.name_en, row?.name, `Item ${itemNo}`);
    const color = firstNonEmpty(row?.color, '-');
    const size = firstNonEmpty(row?.size, '-');
    if (!itemNo || !sku) return;

    const key = `${itemNo}::${color}::${productName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        style_no: firstNonEmpty(row?.style_no, row?.styleNo),
        item_no: itemNo,
        product_name: productName,
        color,
        image_url: row?.image_url || imagePathForItem(itemNo),
        variants: []
      });
    }

    const quantity = Math.max(0, Number(row?.quantity ?? row?.qty ?? row?.stock ?? 0) || 0);
    const epcPool = Array.isArray(row?.epc_list)
      ? row.epc_list.filter(isValidEpcData)
      : (Array.isArray(row?.epc_pool) ? row.epc_pool.filter(isValidEpcData) : []);

    groups.get(key).variants.push({
      product_id: firstNonEmpty(row?.product_id, row?.id),
      skuKey: sku,
      sku_ean13: sku,
      size,
      quantity,
      unit_price: Number(row?.price_usd ?? row?.price ?? row?.unit_price ?? 0) || 0,
      epc_pool: epcPool.length ? [...epcPool] : generateDemoEpcPool(sku, quantity),
      item_key: key
    });
  });

  return Array.from(groups.values())
    .map((item) => {
      item.variants.sort(sortBySize);
      item.totalAvailable = item.variants.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0);
      return item;
    })
    .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)));
}

function syncRackTotals() {
  state.rackItems.forEach((item) => {
    item.totalAvailable = item.variants.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0);
  });
}

async function fetchCatalogRows() {
  try {
    const response = await fetch('/api/fitting-catalog', {
      method: 'GET',
      headers: { ...getApiAuthHeaders() }
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.rows) ? payload.rows : [];
  } catch {
    return [];
  }
}

function getSelectedItem() {
  return state.rackItems.find((item) => item.key === state.selectedItemKey) || null;
}

function getSelectedSku() {
  const item = getSelectedItem();
  if (!item) return null;
  return item.variants.find((variant) => variant.skuKey === state.selectedSkuKey) || null;
}

function findVariantBySku(skuKey) {
  for (const rackItem of state.rackItems) {
    const variant = rackItem.variants.find((entry) => String(entry.skuKey) === String(skuKey));
    if (variant) return { rackItem, variant };
  }
  return null;
}

function getRoomById(roomId) {
  return state.roomAssignments.find((room) => room.roomId === Number(roomId)) || null;
}

function getRoomEntryById(roomItemId) {
  for (const room of state.roomAssignments) {
    const entry = room.items.find((item) => String(item.room_item_id) === String(roomItemId));
    if (entry) return { room, entry };
  }
  return null;
}

function takeEpcFromVariant(variant) {
  if (!variant || !Array.isArray(variant.epc_pool) || !variant.epc_pool.length) return '';
  const epc = String(variant.epc_pool.shift() || '').trim();
  return isValidEpcData(epc) ? epc : '';
}

function putEpcBackToVariant(variant, epcData) {
  if (!variant || !Array.isArray(variant.epc_pool)) return;
  const epc = String(epcData || '').trim();
  if (isValidEpcData(epc) && !variant.epc_pool.includes(epc)) variant.epc_pool.unshift(epc);
}

function pushEvent(eventType, context, roomId = 1) {
  const event = {
    time: new Date().toISOString(),
    event_type: eventType,
    product_name: context?.product_name || '-',
    size: context?.size || '-',
    room_id: Number(roomId) || 1,
    sku_ean13: context?.sku_ean13 || '',
    epc_data: context?.epc_data || ''
  };
  state.recentEvents.unshift(event);
}

function getCheckoutTotal() {
  return state.checkoutRecords.reduce((sum, record) => sum + (Number(record.unit_price) || 0), 0);
}

function getConversionRate() {
  const tryOns = Number(state.kpi.tryOns) || 0;
  if (tryOns <= 0) return 0;
  return ((Number(state.kpi.sales) || 0) / tryOns) * 100;
}

function getPotentialUplift() {
  return (Number(state.kpi.missedRevenue) || 0) * 0.4 + getCheckoutTotal() * 0.2;
}

function RackItemCard(item) {
  const isSelected = state.selectedItemKey === item.key;
  const selectedSku = isSelected ? getSelectedSku() : null;
  const lowStock = item.totalAvailable > 0 && item.totalAvailable <= LOW_STOCK_THRESHOLD;
  const displayPrice = formatPrice(item.variants[0]?.unit_price || 0);

  return `
    <article class="frd-rack-card${isSelected ? ' is-selected' : ''}" data-rack-item-key="${escapeHtml(item.key)}">
      <div class="frd-rack-thumb-wrap">
        <img class="frd-rack-thumb" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.product_name)}" loading="lazy" />
      </div>
      <div class="frd-rack-main">
        <p class="frd-rack-name">${escapeHtml(item.product_name)}</p>
        <p class="frd-rack-meta">${escapeHtml(item.color || '-')}</p>
        <p class="frd-rack-price">${escapeHtml(ft('frd.rack.price', { price: displayPrice }))}</p>
        ${state.advancedMode ? `<p class="frd-rack-extra">Item ${escapeHtml(item.item_no)}${item.style_no ? ` · Style ${escapeHtml(item.style_no)}` : ''}</p>` : ''}
      </div>
      <div class="frd-rack-badges">
        <span class="frd-pill frd-pill--muted">${escapeHtml(ft('frd.rack.available', { count: item.totalAvailable }))}</span>
        ${lowStock ? `<span class="frd-pill frd-pill--warning">${escapeHtml(ft('frd.rack.lowStock'))}</span>` : ''}
      </div>
      <section class="frd-rack-inline">
        <p class="frd-rack-inline-title">${escapeHtml(ft('frd.rack.size'))}</p>
        ${SizeSelector(item)}
        ${selectedSku ? SelectedVariantCard(item, selectedSku) : `<p class="hint">${escapeHtml(ft('frd.rack.pickSizeHint'))}</p>`}
      </section>
    </article>
  `;
}

function SizeSelector(item) {
  return `
    <div class="frd-size-grid">
      ${item.variants.map((variant) => {
        const qty = Number(variant.quantity) || 0;
        const selected = state.selectedItemKey === item.key && state.selectedSkuKey === variant.skuKey;
        return `
          <button
            type="button"
            class="frd-size-chip${selected ? ' is-selected' : ''}${qty > 0 && qty <= LOW_STOCK_THRESHOLD ? ' is-low' : ''}"
            data-size-item-key="${escapeHtml(item.key)}"
            data-sku-key="${escapeHtml(variant.skuKey)}"
            data-size="${escapeHtml(variant.size)}"
            ${qty <= 0 ? 'disabled' : ''}
          >${escapeHtml(variant.size)} · ${escapeHtml(ft('frd.variant.qty', { qty }))}</button>
        `;
      }).join('')}
    </div>
  `;
}

function SelectedVariantCard(item, sku) {
  return `
    <article class="frd-variant-card" draggable="true" data-drag-variant-key="${escapeHtml(sku.skuKey)}">
      <div class="frd-variant-main">
        <p class="frd-variant-name">${escapeHtml(item.product_name)} · ${escapeHtml(sku.size)}</p>
        <p class="frd-variant-meta">${escapeHtml(ft('frd.rack.dragHint'))}</p>
        ${state.advancedMode ? `<p class="frd-variant-meta">SKU ${escapeHtml(sku.sku_ean13)} · EPC ${escapeHtml(sku.epc_pool[0] || '-')}</p>` : ''}
      </div>
      <button type="button" class="button-secondary frd-rack-send" data-rack-action="try" data-sku-key="${escapeHtml(sku.skuKey)}">${escapeHtml(ft('frd.rack.sendToRoom'))}</button>
    </article>
  `;
}

function RackPanel() {
  if (!state.rackItems.length) return `<p class="hint">${escapeHtml(ft('frd.rack.empty'))}</p>`;
  return state.rackItems.map((item) => RackItemCard(item)).join('');
}

function RoomCard(room) {
  const hasLongDwell = room.items.some((item) => isLongDwell(item.enteredAt));
  return `
    <article class="frd-room-card${hasLongDwell ? ' is-overdue' : ''}">
      <header class="frd-room-head">
        <h3>${escapeHtml(ft('frd.room.title'))}</h3>
        <span class="status-badge">${escapeHtml(ft('frd.room.items', { count: room.items.length }))}</span>
      </header>
      <div class="frd-room-summary-line">
        <span class="frd-pill ${hasLongDwell ? 'frd-pill--danger' : 'frd-pill--muted'}">${escapeHtml(ft('frd.room.longestDwell', { dwell: getLongestDwell(room) }))}</span>
        ${hasLongDwell ? `<span class="frd-pill frd-pill--danger">${escapeHtml(ft('frd.room.longDwellWarning'))}</span>` : ''}
      </div>
      <div class="frd-room-dropzone" data-room-id="${escapeHtml(room.roomId)}" data-drop-zone="room">
        ${room.items.length ? room.items.map((entry) => RoomItemCard(entry, room.roomId)).join('') : `<p class="hint">${escapeHtml(ft('frd.room.dropHint'))}</p>`}
      </div>
    </article>
  `;
}

function RoomItemCard(entry, roomId) {
  const longDwell = isLongDwell(entry.enteredAt);
  return `
    <article class="frd-room-item${longDwell ? ' is-overdue' : ''}" draggable="true" data-drag-room-item-id="${escapeHtml(entry.room_item_id)}" data-room-id="${escapeHtml(roomId)}">
      <div class="frd-room-item-main">
        <img class="frd-room-item-thumb" src="${escapeHtml(entry.image_url || imagePathForItem(entry.item_no))}" alt="${escapeHtml(entry.product_name)}" loading="lazy" />
        <div>
          <p class="frd-room-item-name">${escapeHtml(entry.product_name)}</p>
          <div class="frd-room-item-meta-row">
            <span class="frd-pill frd-pill--primary">${escapeHtml(entry.size)}</span>
            <span class="frd-room-item-meta">${escapeHtml(formatPrice(entry.unit_price || 0))}</span>
            <span class="frd-room-item-meta">${escapeHtml(ft('frd.room.dwell', { dwell: formatDwell(entry.enteredAt) }))}</span>
          </div>
        </div>
      </div>
      ${longDwell ? `<p class="frd-long-dwell">${escapeHtml(ft('frd.room.longDwellWarning'))}</p>` : ''}
      <div class="frd-room-item-actions">
        <button type="button" class="button-primary frd-room-item-btn" data-room-action="checkout" data-room-item-id="${escapeHtml(entry.room_item_id)}">${escapeHtml(ft('frd.room.actions.sendCheckout'))}</button>
        <button type="button" class="button-secondary frd-room-item-btn" data-room-action="rack" data-room-item-id="${escapeHtml(entry.room_item_id)}">${escapeHtml(ft('frd.room.actions.returnRack'))}</button>
      </div>
      ${state.advancedMode ? `<p class="frd-room-item-tech">${escapeHtml(ft('frd.advanced.sku'))}: ${escapeHtml(entry.sku_ean13 || '-')} · ${escapeHtml(ft('frd.advanced.epc'))}: ${escapeHtml(entry.epc_data || '-')}</p>` : ''}
    </article>
  `;
}

function FittingRoomsGrid() {
  return state.roomAssignments.map((room) => RoomCard(room)).join('');
}

function CheckoutListPanel() {
  if (!state.checkoutRecords.length) return `<p class="hint">${escapeHtml(ft('frd.checkout.noPurchases'))}</p>`;
  return state.checkoutRecords.map((record) => `
    <article class="frd-checkout-item">
      <div>
        <p class="frd-checkout-item-name">${escapeHtml(record.product_name)} · ${escapeHtml(record.size)}</p>
        <p class="frd-checkout-item-meta">${escapeHtml(formatPrice(record.unit_price || 0))}</p>
        ${state.advancedMode ? `<p class="frd-checkout-item-meta">SKU ${escapeHtml(record.sku_ean13 || '-')} · EPC ${escapeHtml(record.epc_data || '-')}</p>` : ''}
      </div>
      <span class="frd-pill frd-pill--primary">${escapeHtml(formatTime(record.time))}</span>
    </article>
  `).join('');
}

function KpiPanel() {
  const cards = [
    { label: ft('frd.kpi.tryOns'), value: state.kpi.tryOns, hint: ft('frd.kpi.tryOnsHint') },
    { label: ft('frd.kpi.sales'), value: state.kpi.sales, hint: ft('frd.kpi.salesHint') },
    { label: ft('frd.kpi.conversion'), value: `${getConversionRate().toFixed(1)}%`, hint: ft('frd.kpi.conversionHint') },
    { label: ft('frd.kpi.missedRevenue'), value: formatPrice(state.kpi.missedRevenue), hint: ft('frd.kpi.missedRevenueHint') },
    { label: ft('frd.kpi.potentialUplift'), value: formatPrice(getPotentialUplift()), hint: ft('frd.kpi.potentialUpliftHint') }
  ];

  return cards.map((card) => `
    <article class="frd-kpi-card">
      <p class="frd-kpi-label">${escapeHtml(card.label)}</p>
      <p class="frd-kpi-value">${escapeHtml(card.value)}</p>
      <p class="frd-kpi-hint">${escapeHtml(card.hint)}</p>
    </article>
  `).join('');
}

function AdvancedEventPanel() {
  if (!state.recentEvents.length) return `<p class="hint">${escapeHtml(ft('frd.advanced.empty'))}</p>`;
  return state.recentEvents.slice(0, 24).map((event) => `
    <article class="frd-advanced-event">
      <p><strong>${escapeHtml(formatTime(event.time))}</strong> · ${escapeHtml(ft(EVENT_TYPE_LABELS[event.event_type] || event.event_type))}</p>
      <p class="hint">${escapeHtml(event.product_name)} · ${escapeHtml(event.size)} · SKU ${escapeHtml(event.sku_ean13 || '-')} · EPC ${escapeHtml(event.epc_data || '-')}</p>
    </article>
  `).join('');
}

function renderAll() {
  if (el.rackList) el.rackList.innerHTML = RackPanel();
  if (el.roomsGrid) el.roomsGrid.innerHTML = FittingRoomsGrid();
  if (el.checkoutList) el.checkoutList.innerHTML = CheckoutListPanel();
  if (el.checkoutTotalPrice) el.checkoutTotalPrice.textContent = ft('frd.checkout.total', { amount: formatPrice(getCheckoutTotal()) });
  if (el.completeSaleButton) el.completeSaleButton.disabled = state.checkoutRecords.length === 0;
  if (el.kpiPanelBody) el.kpiPanelBody.innerHTML = KpiPanel();
  if (el.advancedPanel) el.advancedPanel.hidden = !state.advancedMode;
  if (el.advancedEventList) el.advancedEventList.innerHTML = AdvancedEventPanel();
  if (el.status) el.status.textContent = state.dataSource === 'db' ? ft('frd.status.db') : ft('frd.status.mock');
}

function selectSize(itemKey, skuKey) {
  state.selectedItemKey = itemKey;
  state.selectedSkuKey = skuKey;
  renderAll();
}

function ensureValidSelection() {
  const selected = getSelectedSku();
  if (!selected || Number(selected.quantity) <= 0) {
    state.selectedSkuKey = null;
  }
}

function buildRackDragContext(skuKey = state.selectedSkuKey) {
  const hit = findVariantBySku(skuKey);
  if (!hit || Number(hit.variant.quantity) <= 0) return null;
  return {
    source: 'rack',
    item_key: hit.rackItem.key,
    item_no: hit.rackItem.item_no,
    product_name: hit.rackItem.product_name,
    color: hit.rackItem.color,
    image_url: hit.rackItem.image_url,
    size: hit.variant.size,
    sku_ean13: hit.variant.sku_ean13,
    skuKey: hit.variant.skuKey,
    unit_price: Number(hit.variant.unit_price) || 0,
    epc_data: Array.isArray(hit.variant.epc_pool) ? String(hit.variant.epc_pool[0] || '') : ''
  };
}

function buildRoomDragContext(roomItemId) {
  const hit = getRoomEntryById(roomItemId);
  if (!hit) return null;
  return {
    source: 'room',
    fromRoomId: hit.room.roomId,
    room_item_id: hit.entry.room_item_id,
    item_key: hit.entry.item_key,
    item_no: hit.entry.item_no,
    product_name: hit.entry.product_name,
    color: hit.entry.color,
    image_url: hit.entry.image_url,
    size: hit.entry.size,
    sku_ean13: hit.entry.sku_ean13,
    skuKey: hit.entry.sku_ean13,
    unit_price: Number(hit.entry.unit_price) || 0,
    epc_data: hit.entry.epc_data || ''
  };
}

function moveRackItemToRoom(context, roomId = 1) {
  const hit = findVariantBySku(context?.skuKey);
  const room = getRoomById(roomId);
  if (!hit || !room || Number(hit.variant.quantity) <= 0) return false;

  const epcData = takeEpcFromVariant(hit.variant) || context.epc_data || '';
  hit.variant.quantity = Math.max(0, Number(hit.variant.quantity) - 1);
  syncRackTotals();

  const roomEntry = {
    room_item_id: `room_item_${state.roomItemSeq++}`,
    item_key: context.item_key,
    item_no: context.item_no,
    product_name: context.product_name,
    color: context.color,
    image_url: context.image_url,
    size: context.size,
    sku_ean13: context.sku_ean13,
    unit_price: Number(context.unit_price) || 0,
    epc_data: epcData,
    enteredAt: new Date().toISOString()
  };

  room.items.unshift(roomEntry);
  state.kpi.tryOns += 1;
  pushEvent('item_entered_fitting_room', roomEntry, roomId);
  ensureValidSelection();
  renderAll();
  showToast(ft('frd.toast.itemEntered'), 'ok');
  return true;
}

function returnRoomItemToRack(roomItemId) {
  const hit = getRoomEntryById(roomItemId);
  if (!hit) return false;
  const entry = hit.entry;
  hit.room.items = hit.room.items.filter((item) => String(item.room_item_id) !== String(roomItemId));

  const variantHit = findVariantBySku(entry.sku_ean13);
  if (variantHit) {
    variantHit.variant.quantity = Math.max(0, Number(variantHit.variant.quantity) + 1);
    putEpcBackToVariant(variantHit.variant, entry.epc_data);
    syncRackTotals();
  }

  state.kpi.missedRevenue += Math.max(0, Number(entry.unit_price) || 0);
  pushEvent('item_left_fitting_room', entry, hit.room.roomId);
  pushEvent('item_returned_to_floor', entry, hit.room.roomId);
  renderAll();
  showToast(ft('frd.toast.itemReturned'), 'warn');
  return true;
}

function sendRoomItemToCheckout(roomItemId) {
  const hit = getRoomEntryById(roomItemId);
  if (!hit) return false;
  const entry = hit.entry;
  hit.room.items = hit.room.items.filter((item) => String(item.room_item_id) !== String(roomItemId));
  const checkoutRecord = {
    ...entry,
    time: new Date().toISOString()
  };
  state.checkoutRecords.unshift(checkoutRecord);
  pushEvent('item_left_fitting_room', entry, hit.room.roomId);
  pushEvent('item_moved_to_checkout', entry, hit.room.roomId);
  renderAll();
  showToast(ft('frd.toast.sentCheckout'), 'ok');
  return true;
}

function completeSale() {
  if (!state.checkoutRecords.length) {
    showToast(ft('frd.toast.actionCouldNotComplete'), 'warn');
    return;
  }

  const completedAt = new Date().toISOString();
  state.checkoutRecords.forEach((record) => {
    pushEvent('sale_completed', record, 1);
    state.completedSalesRecords.unshift({ ...record, completedAt });
  });
  state.kpi.sales += state.checkoutRecords.length;
  state.checkoutRecords = [];
  renderAll();
  showToast(ft('frd.toast.conversionImproved'), 'ok');
}

function isValidMove(source, targetZone) {
  return ['rack->room', 'room->rack', 'room->checkout'].includes(`${source}->${targetZone}`);
}

function highlightValidDropZones(source) {
  clearDropZoneHighlights();
  if (source === 'rack') {
    document.querySelectorAll('.frd-room-dropzone').forEach((zone) => zone.classList.add('is-valid-drop'));
  }
  if (source === 'room') {
    document.querySelectorAll('.frd-rack-dropzone, .frd-checkout-dropzone').forEach((zone) => zone.classList.add('is-valid-drop'));
  }
}

function clearDropZoneHighlights() {
  document.querySelectorAll('.frd-room-dropzone, .frd-rack-dropzone, .frd-checkout-dropzone')
    .forEach((zone) => zone.classList.remove('is-valid-drop', 'is-drop-hover'));
}

function getDropTarget(node) {
  const roomZone = node.closest('.frd-room-dropzone');
  if (roomZone) return { zone: 'room', roomId: Number(roomZone.dataset.roomId || 1), node: roomZone };
  const rackZone = node.closest('.frd-rack-dropzone');
  if (rackZone) return { zone: 'rack', roomId: 0, node: rackZone };
  const checkoutZone = node.closest('.frd-checkout-dropzone');
  if (checkoutZone) return { zone: 'checkout', roomId: 0, node: checkoutZone };
  return null;
}

function handleDropOnTarget(target) {
  const context = state.draggingContext;
  if (!context || !target || !isValidMove(context.source, target.zone)) {
    showToast(ft('frd.toast.invalidMove'), 'err');
    return;
  }

  if (context.source === 'rack' && target.zone === 'room') {
    moveRackItemToRoom(context, target.roomId || 1);
  } else if (context.source === 'room' && target.zone === 'rack') {
    returnRoomItemToRack(context.room_item_id);
  } else if (context.source === 'room' && target.zone === 'checkout') {
    sendRoomItemToCheckout(context.room_item_id);
  }
}

function bindEvents() {
  const languageSelect = document.getElementById('fittingDemoLanguageSelect');
  if (languageSelect) {
    languageSelect.addEventListener('change', (event) => {
      const nextLang = String(event.target?.value || '').trim();
      if (!SUPPORTED_LANGS.includes(nextLang)) return;
      currentLang = nextLang;
      localStorage.setItem(LANG_KEY, currentLang);
      applyFittingDemoI18n();
      renderAll();
    });
  }

  if (el.advancedToggle) {
    el.advancedToggle.addEventListener('change', (event) => {
      state.advancedMode = Boolean(event.target?.checked);
      renderAll();
    });
  }

  document.addEventListener('click', (event) => {
    const sizeChip = event.target.closest('[data-size-item-key][data-sku-key]');
    if (sizeChip && !sizeChip.hasAttribute('disabled')) {
      selectSize(String(sizeChip.dataset.sizeItemKey || ''), String(sizeChip.dataset.skuKey || ''));
      return;
    }

    const rackAction = event.target.closest('[data-rack-action="try"]');
    if (rackAction) {
      const context = buildRackDragContext(String(rackAction.dataset.skuKey || ''));
      if (!context) {
        showToast(ft('frd.toast.invalidMove'), 'err');
        return;
      }
      moveRackItemToRoom(context, 1);
      return;
    }

    const roomAction = event.target.closest('[data-room-action][data-room-item-id]');
    if (roomAction) {
      const roomItemId = String(roomAction.dataset.roomItemId || '');
      const action = String(roomAction.dataset.roomAction || '');
      if (action === 'checkout') sendRoomItemToCheckout(roomItemId);
      if (action === 'rack') returnRoomItemToRack(roomItemId);
      return;
    }

    if (event.target.closest('#completeSaleButton')) {
      completeSale();
      return;
    }

    const rackCard = event.target.closest('[data-rack-item-key]');
    if (rackCard) {
      state.selectedItemKey = String(rackCard.dataset.rackItemKey || '');
      state.selectedSkuKey = getSelectedItem()?.variants?.find((variant) => Number(variant.quantity) > 0)?.skuKey || null;
      renderAll();
    }
  });

  document.addEventListener('dragstart', (event) => {
    const variantCard = event.target.closest('[data-drag-variant-key]');
    if (variantCard) {
      const context = buildRackDragContext(String(variantCard.dataset.dragVariantKey || ''));
      if (!context) {
        event.preventDefault();
        showToast(ft('frd.toast.invalidMove'), 'err');
        return;
      }
      state.draggingContext = context;
      event.dataTransfer?.setData('text/plain', context.skuKey);
      event.dataTransfer.effectAllowed = 'move';
      variantCard.classList.add('is-dragging');
      highlightValidDropZones('rack');
      return;
    }

    const roomItem = event.target.closest('[data-drag-room-item-id]');
    if (roomItem) {
      const context = buildRoomDragContext(String(roomItem.dataset.dragRoomItemId || ''));
      if (!context) {
        event.preventDefault();
        showToast(ft('frd.toast.actionCouldNotComplete'), 'err');
        return;
      }
      state.draggingContext = context;
      event.dataTransfer?.setData('text/plain', context.room_item_id);
      event.dataTransfer.effectAllowed = 'move';
      roomItem.classList.add('is-dragging');
      highlightValidDropZones('room');
    }
  });

  document.addEventListener('dragend', (event) => {
    const dragNode = event.target.closest('[data-drag-variant-key], [data-drag-room-item-id]');
    if (dragNode) dragNode.classList.remove('is-dragging');
    state.draggingContext = null;
    clearDropZoneHighlights();
  });

  document.addEventListener('dragover', (event) => {
    const target = getDropTarget(event.target);
    if (!target || !state.draggingContext || !isValidMove(state.draggingContext.source, target.zone)) return;
    event.preventDefault();
    target.node.classList.add('is-drop-hover');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });

  document.addEventListener('dragleave', (event) => {
    const target = getDropTarget(event.target);
    if (!target) return;
    if (!target.node.contains(event.relatedTarget)) target.node.classList.remove('is-drop-hover');
  });

  document.addEventListener('drop', (event) => {
    const target = getDropTarget(event.target);
    if (!target) return;
    event.preventDefault();
    handleDropOnTarget(target);
  });
}

function resetDemoState() {
  state.selectedItemKey = null;
  state.selectedSkuKey = null;
  state.roomAssignments = buildEmptyRooms();
  state.checkoutRecords = [];
  state.completedSalesRecords = [];
  state.recentEvents = [];
  state.draggingContext = null;
  state.roomItemSeq = 1;
  state.kpi = { tryOns: 0, sales: 0, missedRevenue: 0 };
}

async function bootstrapData() {
  const rows = await fetchCatalogRows();
  const rackItems = buildRackData(rows);
  if (rackItems.length) {
    state.rackItems = rackItems;
    state.dataSource = 'db';
  } else {
    state.rackItems = buildRackData(MOCK_SKU_ROWS);
    state.dataSource = 'mock';
  }
  resetDemoState();
  renderAll();
}

async function bootstrap() {
  currentLang = getCurrentLang();
  applyEmbedMode();
  populateLanguageSelect();
  applyFittingDemoI18n();
  bindEvents();
  await bootstrapData();
  setInterval(() => {
    if (state.roomAssignments.some((room) => room.items.length > 0)) renderAll();
  }, 1000);
}

bootstrap();
