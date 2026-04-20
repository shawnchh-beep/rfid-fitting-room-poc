import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ROOM_IDS = [1, 2, 3, 4];
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const LOW_STOCK_THRESHOLD = 3;
const OVERDUE_MINUTES = 15;
const EVENT_TYPE_LABELS = {
  item_entered_fitting_room: 'Entered Room',
  item_added_to_session: 'Session Updated',
  item_left_fitting_room: 'Left Room',
  item_returned_to_floor: 'Returned to Rack',
  item_moved_to_checkout: 'Moved to Checkout'
};
const LEGACY_EVENT_TYPE_MAP = {
  item_entered_fitting_room: 'enter_room',
  item_added_to_session: 'enter_room',
  item_left_fitting_room: 'exit_room',
  item_returned_to_floor: 'exit_room',
  item_moved_to_checkout: 'sale_completed'
};
const SALE_TYPE_LABELS = {
  try_on_purchase: 'Try-On Purchase',
  direct_purchase: 'Direct Purchase'
};

const URL_KEY = 'supabaseUrl';
const ANON_KEY = 'supabaseAnonKey';
const API_TOKEN_KEY = 'rfid_poc_api_token_v1';
const USER_ROLE_KEY = 'rfid_poc_user_role_v1';
const DEFAULT_SUPABASE_URL = 'https://trgxtbqjkhydvbfndmhk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_RjeQR-HU84MRCpByTqZlxg_lwJHStMP';

const MOCK_SKU_ROWS = [
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000015', product_name: 'Northline Polo Shirt', color: 'Black', size: 'XS', quantity: 4, price_usd: 39 },
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000022', product_name: 'Northline Polo Shirt', color: 'Black', size: 'S', quantity: 8, price_usd: 39 },
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000039', product_name: 'Northline Polo Shirt', color: 'Black', size: 'M', quantity: 14, price_usd: 39 },
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000046', product_name: 'Northline Polo Shirt', color: 'Black', size: 'L', quantity: 12, price_usd: 39 },
  { style_no: '4520001', item_no: '82210101', sku_ean13: '1234567000053', product_name: 'Northline Polo Shirt', color: 'Black', size: 'XL', quantity: 2, price_usd: 39 },

  { style_no: '4520001', item_no: '82210102', sku_ean13: '1234567000060', product_name: 'Northline Polo Shirt', color: 'Navy', size: 'XS', quantity: 0, price_usd: 39 },
  { style_no: '4520001', item_no: '82210102', sku_ean13: '1234567000077', product_name: 'Northline Polo Shirt', color: 'Navy', size: 'S', quantity: 5, price_usd: 39 },
  { style_no: '4520001', item_no: '82210102', sku_ean13: '1234567000084', product_name: 'Northline Polo Shirt', color: 'Navy', size: 'M', quantity: 7, price_usd: 39 },
  { style_no: '4520001', item_no: '82210102', sku_ean13: '1234567000091', product_name: 'Northline Polo Shirt', color: 'Navy', size: 'L', quantity: 2, price_usd: 39 },
  { style_no: '4520001', item_no: '82210102', sku_ean13: '1234567000107', product_name: 'Northline Polo Shirt', color: 'Navy', size: 'XL', quantity: 1, price_usd: 39 },

  { style_no: '4521001', item_no: '82210201', sku_ean13: '1234567000114', product_name: 'Cityline Oxford Shirt', color: 'White', size: 'S', quantity: 3, price_usd: 49 },
  { style_no: '4521001', item_no: '82210201', sku_ean13: '1234567000121', product_name: 'Cityline Oxford Shirt', color: 'White', size: 'M', quantity: 6, price_usd: 49 },
  { style_no: '4521001', item_no: '82210201', sku_ean13: '1234567000138', product_name: 'Cityline Oxford Shirt', color: 'White', size: 'L', quantity: 4, price_usd: 49 },
  { style_no: '4521001', item_no: '82210201', sku_ean13: '1234567000145', product_name: 'Cityline Oxford Shirt', color: 'White', size: 'XL', quantity: 0, price_usd: 49 },

  { style_no: '4522001', item_no: '82210301', sku_ean13: '1234567000152', product_name: 'Trailblaze Chino Pants', color: 'Khaki', size: 'S', quantity: 2, price_usd: 59 },
  { style_no: '4522001', item_no: '82210301', sku_ean13: '1234567000169', product_name: 'Trailblaze Chino Pants', color: 'Khaki', size: 'M', quantity: 4, price_usd: 59 },
  { style_no: '4522001', item_no: '82210301', sku_ean13: '1234567000176', product_name: 'Trailblaze Chino Pants', color: 'Khaki', size: 'L', quantity: 2, price_usd: 59 },
  { style_no: '4522001', item_no: '82210301', sku_ean13: '1234567000183', product_name: 'Trailblaze Chino Pants', color: 'Khaki', size: 'XL', quantity: 0, price_usd: 59 }
];

const state = {
  supabase: null,
  rackItems: [],
  selectedItemKey: null,
  selectedSize: null,
  selectedSkuKey: null,
  roomAssignments: buildEmptyRooms(),
  checkoutRecords: [],
  recentEvents: [],
  draggingContext: null,
  alertsCount: 0,
  useMockData: true,
  dataSource: 'mock',
  roomItemSeq: 1,
  debugRfidSchemaProbed: false,
  bottomTab: 'recent-events',
  checkoutShowAll: false,
  expandedRoomIds: {}
};

const el = {
  rackList: document.getElementById('rackList'),
  roomsGrid: document.getElementById('roomsGrid'),
  selectedItemDetailBody: document.getElementById('selectedItemDetailBody'),
  checkoutDropzone: document.getElementById('checkoutDropzone'),
  checkoutList: document.getElementById('checkoutList'),
  checkoutToggle: document.getElementById('checkoutToggleButton'),
  recentEventsBody: document.getElementById('recentEventsBody'),
  roomSummaryBody: document.getElementById('roomSummaryBody'),
  bottomTabButtons: document.querySelectorAll('[data-bottom-tab]'),
  bottomTabPanels: document.querySelectorAll('[data-bottom-panel]'),
  alertsBadge: document.getElementById('fittingDemoAlertsBadge'),
  status: document.getElementById('fittingDemoStatus'),
  resetButton: document.getElementById('fittingDemoResetButton'),
  seedButton: document.getElementById('fittingDemoSeedButton'),
  toastContainer: document.getElementById('fittingDemoToastContainer')
};

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

function normalizeEventType(eventType) {
  const raw = String(eventType || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'enter_room' || raw === 'enter_fitting_room') return 'item_entered_fitting_room';
  if (raw === 'exit_room' || raw === 'left_fitting_room') return 'item_left_fitting_room';
  if (raw === 'return_to_sales_floor') return 'item_returned_to_floor';
  if (raw === 'sale_completed' || raw === 'direct_sale') return 'item_moved_to_checkout';
  return raw;
}

function isValidEpcData(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
}

function normalizeUserRole(role) {
  const raw = String(role || '').trim();
  if (raw === 'demo_operator') return 'user';
  if (raw === 'analyst_admin') return 'admin';
  if (raw === 'viewer') return 'trial';
  if (['trial', 'user', 'admin', 'service_backend'].includes(raw)) return raw;
  return 'user';
}

function getApiAuthHeaders() {
  const apiToken = String(localStorage.getItem(API_TOKEN_KEY) || '').trim();
  const role = normalizeUserRole(localStorage.getItem(USER_ROLE_KEY));
  const headers = {};
  if (apiToken) headers['x-api-token'] = apiToken;
  if (role) headers['x-user-role'] = role;
  return headers;
}

function isSchemaCompatError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42703'
    || code === 'PGRST204'
    || message.includes('column')
    || message.includes('schema cache')
    || message.includes('could not find')
  );
}

function resolveSkuValue(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeProductId(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function isAvailableInventoryStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return true;
  if (['sold', 'checkout', 'returned', 'damaged', 'void'].includes(s)) return false;
  return true;
}

function formatPrice(priceUsd) {
  const amount = Number(priceUsd);
  if (!Number.isFinite(amount)) return '-';
  return `$${amount.toFixed(2)}`;
}

function formatTime(iso) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleTimeString();
}

function formatDwell(enteredAtIso) {
  const entered = new Date(enteredAtIso).getTime();
  if (!Number.isFinite(entered)) return '-';
  const sec = Math.max(0, Math.floor((Date.now() - entered) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function getLongestDwell(room) {
  if (!room?.items?.length) return '-';
  const oldest = room.items.reduce((candidate, entry) => {
    if (!candidate) return entry;
    const ct = new Date(candidate.enteredAt).getTime();
    const et = new Date(entry.enteredAt).getTime();
    return et < ct ? entry : candidate;
  }, null);
  return oldest ? formatDwell(oldest.enteredAt) : '-';
}

function getRoomSessionStatus(room) {
  if (!room?.items?.length) return 'Idle';
  return room.items.some((item) => isOverdue(item.enteredAt)) ? 'Alert' : 'Active';
}

function isOverdue(enteredAtIso) {
  const entered = new Date(enteredAtIso).getTime();
  if (!Number.isFinite(entered)) return false;
  return Date.now() - entered >= OVERDUE_MINUTES * 60 * 1000;
}

function sortBySize(a, b) {
  const ai = SIZE_ORDER.indexOf(String(a?.size || '').toUpperCase());
  const bi = SIZE_ORDER.indexOf(String(b?.size || '').toUpperCase());
  if (ai === -1 && bi === -1) return String(a?.size || '').localeCompare(String(b?.size || ''));
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

function buildRackData(rows) {
  const groups = new Map();
  (rows || []).forEach((row) => {
    const itemNo = String(row?.item_no || '').trim();
    const color = String(row?.color || '').trim();
    const key = `${itemNo}::${color}`;
    if (!itemNo) return;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        style_no: String(row?.style_no || '').trim(),
        item_no: itemNo,
        product_name: String(row?.product_name || '').trim() || `Item ${itemNo}`,
        color,
        image_url: imagePathForItem(itemNo),
        variants: []
      });
    }

    const group = groups.get(key);
    group.variants.push({
      product_id: normalizeProductId(row?.product_id),
      skuKey: String(row?.sku_ean13 || '').trim(),
      sku_ean13: String(row?.sku_ean13 || '').trim(),
      size: String(row?.size || '').trim() || '-',
      quantity: Math.max(0, Number(row?.quantity) || 0),
      unit_price: Number(row?.price_usd) || 0,
      epc_pool: Array.isArray(row?.epc_list) ? [...row.epc_list] : [],
      item_key: key
    });
  });

  return Array.from(groups.values())
    .map((item) => {
      item.variants.sort(sortBySize);
      item.totalAvailable = item.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
      return item;
    })
    .sort((a, b) => String(a.item_no).localeCompare(String(b.item_no)));
}

async function fetchProductsCompat() {
  const selectAttempts = [
    'id,name,name_en,price,size,color,sku,sku_ean13,style_no,item_no',
    'id,name,name_en,price,size,color,sku,style_no,item_no,epc_data',
    'id,name,name_en,price,size,color,sku,style_no,item_no',
    'id,name,name_en,price,size,color,sku',
    '*'
  ];

  let lastError = null;
  for (const selectClause of selectAttempts) {
    console.debug('[FRD][fetchProductsCompat] trying select:', selectClause);
    const res = await state.supabase
      .from('products')
      .select(selectClause)
      .order('id', { ascending: true })
      .limit(3000);

    if (!res.error) {
      console.debug('[FRD][fetchProductsCompat] success:', {
        selectClause,
        rowCount: (res.data || []).length
      });
      return res.data || [];
    }

    console.warn('[FRD][fetchProductsCompat] failed:', {
      selectClause,
      code: res.error?.code,
      message: res.error?.message,
      details: res.error?.details,
      hint: res.error?.hint
    });

    try {
      console.debug('[FRD][fetchProductsCompat] failed json:', JSON.stringify({
        selectClause,
        error: res.error || null
      }));
    } catch {
      console.debug('[FRD][fetchProductsCompat] failed json: <unserializable>');
    }

    lastError = res.error;
    const code = String(res.error?.code || '').toUpperCase();
    const message = String(res.error?.message || '').toLowerCase();
    const isLikelyMissingColumn =
      code === '42703'
      || code === 'PGRST204'
      || message.includes('column')
      || message.includes('could not find')
      || message.includes('schema cache');

    console.debug('[FRD][fetchProductsCompat] fallback decision diagnostics:', {
      selectClause,
      code: res.error?.code,
      message: res.error?.message,
      details: res.error?.details,
      hint: res.error?.hint,
      isLikelyMissingColumn,
      nextSelectWillRun: isLikelyMissingColumn
    });

    console.debug('[FRD][fetchProductsCompat] possible root causes:', [
      'products schema 欄位與查詢 select 不一致（最可能）',
      'Supabase PostgREST schema cache 尚未刷新（最可能）',
      '目前連到錯誤 project/環境，schema 較舊',
      'RLS/權限導致欄位或資料查詢異常',
      'table/view 同名但來源不是預期 public.products',
      '遷移腳本未完整執行，欄位只存在於部分環境'
    ]);

    if (!isLikelyMissingColumn) break;
  }

  console.error('[FRD][fetchProductsCompat] all attempts failed:', {
    code: lastError?.code,
    message: lastError?.message,
    details: lastError?.details,
    hint: lastError?.hint
  });

  throw lastError || new Error('Failed to fetch products');
}

async function fetchInventoryCompat() {
  const selectAttempts = [
    'product_id,sku,style_no,item_no,status,epc_data',
    'product_id,sku,status,epc_data',
    'product_id,sku,style_no,item_no,status'
  ];

  let lastError = null;
  for (const selectClause of selectAttempts) {
    console.debug('[FRD][fetchInventoryCompat] trying select:', selectClause);
    const res = await state.supabase
      .from('inventory_items')
      .select(selectClause)
      .limit(10000);

    if (!res.error) {
      console.debug('[FRD][fetchInventoryCompat] success:', {
        selectClause,
        rowCount: (res.data || []).length
      });
      return res.data || [];
    }

    console.warn('[FRD][fetchInventoryCompat] failed:', {
      selectClause,
      code: res.error?.code,
      message: res.error?.message,
      details: res.error?.details,
      hint: res.error?.hint
    });

    lastError = res.error;
    const fallbackAllowed = isSchemaCompatError(res.error);
    console.debug('[FRD][fetchInventoryCompat] fallback decision diagnostics:', {
      selectClause,
      code: res.error?.code,
      message: res.error?.message,
      details: res.error?.details,
      hint: res.error?.hint,
      fallbackAllowed
    });
    if (!fallbackAllowed) break;
  }

  if (lastError) {
    console.warn('[FRD][fetchInventoryCompat] fallback to empty rows due to error:', {
      code: lastError?.code,
      message: lastError?.message,
      details: lastError?.details,
      hint: lastError?.hint
    });
  }

  return [];
}

async function fetchCatalogFromDb() {
  if (!state.supabase) throw new Error('Supabase not initialized');

  try {
    const response = await fetch('/api/fitting-catalog', {
      method: 'GET',
      headers: {
        ...getApiAuthHeaders()
      }
    });

    if (response.ok) {
      const payload = await response.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      console.debug('[FRD][fetchCatalogFromDb] using service API /api/fitting-catalog', {
        rows: rows.length,
        debug: payload?.debug || null
      });
      if (rows.length > 0) {
        return rows;
      }
    } else {
      let details = `HTTP ${response.status}`;
      try {
        const errPayload = await response.json();
        details = String(errPayload?.error || errPayload?.message || details);
      } catch {
        // ignore non-json
      }
      console.warn('[FRD][fetchCatalogFromDb] /api/fitting-catalog failed, fallback to direct supabase', {
        status: response.status,
        details
      });
    }
  } catch (error) {
    console.warn('[FRD][fetchCatalogFromDb] /api/fitting-catalog unavailable, fallback to direct supabase', {
      message: error?.message || String(error)
    });
  }

  const [products, inventoryRows] = await Promise.all([
    fetchProductsCompat(),
    fetchInventoryCompat()
  ]);

  if (!products.length) return [];

  const availableInventory = (inventoryRows || []).filter((row) => isAvailableInventoryStatus(row?.status));
  const qtyBySku = new Map();
  const epcPoolBySku = new Map();
  const qtyByProductId = new Map();
  const epcPoolByProductId = new Map();
  availableInventory.forEach((row) => {
    const productId = normalizeProductId(row?.product_id);
    const sku = resolveSkuValue(row?.sku);

    if (productId) {
      qtyByProductId.set(productId, (qtyByProductId.get(productId) || 0) + 1);
    }

    if (sku) {
      qtyBySku.set(sku, (qtyBySku.get(sku) || 0) + 1);
    }

    const epc = String(row?.epc_data || '').trim();
    if (!isValidEpcData(epc)) return;
    if (sku) {
      if (!epcPoolBySku.has(sku)) epcPoolBySku.set(sku, []);
      epcPoolBySku.get(sku).push(epc);
    }

    if (productId) {
      if (!epcPoolByProductId.has(productId)) epcPoolByProductId.set(productId, []);
      epcPoolByProductId.get(productId).push(epc);
    }
  });

  const fallbackQtyBySku = new Map();
  const productEpcPoolBySku = new Map();
  const productEpcPoolByProductId = new Map();
  products.forEach((product) => {
    const pid = normalizeProductId(product?.id);
    const sku = resolveSkuValue(product?.sku_ean13, product?.sku);
    if (!sku) return;
    fallbackQtyBySku.set(sku, (fallbackQtyBySku.get(sku) || 0) + 1);

    const productEpc = String(product?.epc_data || '').trim();
    if (isValidEpcData(productEpc)) {
      if (!productEpcPoolBySku.has(sku)) productEpcPoolBySku.set(sku, []);
      productEpcPoolBySku.get(sku).push(productEpc);

      if (pid) {
        if (!productEpcPoolByProductId.has(pid)) productEpcPoolByProductId.set(pid, []);
        productEpcPoolByProductId.get(pid).push(productEpc);
      }
    }
  });

  const variantMap = new Map();
  products.forEach((product) => {
    const sku = resolveSkuValue(product?.sku_ean13, product?.sku);
    const itemNo = resolveSkuValue(product?.item_no, sku);
    const styleNo = resolveSkuValue(product?.style_no);
    const color = resolveSkuValue(product?.color, '-');
    const size = resolveSkuValue(product?.size, '-');
    if (!sku || !itemNo) return;

    const variantKey = `${itemNo}::${color}::${size}::${sku}`;
    if (!variantMap.has(variantKey)) {
      variantMap.set(variantKey, {
        product_id: normalizeProductId(product?.id),
        style_no: styleNo,
        item_no: itemNo,
        sku_ean13: sku,
        product_name: resolveSkuValue(product?.name_en, product?.name, `Item ${itemNo}`),
        color,
        size,
        quantity: 0,
        price_usd: Number(product?.price) || 0,
        epc_list: []
      });
    }
  });

  const rows = Array.from(variantMap.values()).map((variant) => {
    const pid = normalizeProductId(variant.product_id);
    const pidQty = pid ? qtyByProductId.get(pid) : null;
    const skuQty = qtyBySku.get(variant.sku_ean13);
    const fallbackQty = fallbackQtyBySku.get(variant.sku_ean13) || 0;
    const pidEpcPool = pid ? (epcPoolByProductId.get(pid) || []) : [];
    const skuEpcPool = epcPoolBySku.get(variant.sku_ean13) || [];
    const productPidEpcPool = pid ? (productEpcPoolByProductId.get(pid) || []) : [];
    const productSkuEpcPool = productEpcPoolBySku.get(variant.sku_ean13) || [];
    const finalEpcPool =
      pidEpcPool.length > 0 ? pidEpcPool
        : (skuEpcPool.length > 0 ? skuEpcPool
          : (productPidEpcPool.length > 0 ? productPidEpcPool : productSkuEpcPool));

    return {
      ...variant,
      quantity: Number.isFinite(pidQty) ? pidQty : (Number.isFinite(skuQty) ? skuQty : fallbackQty),
      epc_list: [...finalEpcPool]
    };
  });

  const skuMismatchSample = rows
    .filter((row) => (Number(row.quantity) || 0) > 0 && (!Array.isArray(row.epc_list) || row.epc_list.length === 0))
    .slice(0, 12)
    .map((row) => ({
      product_id: row.product_id,
      sku: row.sku_ean13,
      qty: row.quantity,
      byProductIdPool: normalizeProductId(row.product_id) ? (epcPoolByProductId.get(normalizeProductId(row.product_id)) || []).length : 0,
      bySkuPool: (epcPoolBySku.get(row.sku_ean13) || []).length
    }));

  const epcSummary = rows.slice(0, 12).map((row) => ({
    sku: row.sku_ean13,
    qty: Number(row.quantity) || 0,
    epcPool: Array.isArray(row.epc_list) ? row.epc_list.length : 0
  }));
  console.debug('[FRD][fetchCatalogFromDb] EPC pool diagnostics:', {
    rows: rows.length,
    skuWithEpcPool: rows.filter((r) => Array.isArray(r.epc_list) && r.epc_list.length > 0).length,
    skuWithoutEpcPool: rows.filter((r) => !Array.isArray(r.epc_list) || r.epc_list.length === 0).length,
    inventoryEpcSkuCount: epcPoolBySku.size,
    productEpcSkuCount: productEpcPoolBySku.size,
    sample: epcSummary,
    skuMismatchSample
  });

  return rows;
}

async function fetchRecentEventsFromDb(limit = 50) {
  if (!state.supabase) return [];
  const res = await state.supabase
    .from('rfid_events')
    .select('timestamp,event_type,metadata')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (res.error) return [];

  return (res.data || [])
    .filter((row) => {
      const type = normalizeEventType(row?.event_type);
      return [
        'item_entered_fitting_room',
        'item_added_to_session',
        'item_left_fitting_room',
        'item_returned_to_floor',
        'item_moved_to_checkout'
      ].includes(type);
    })
    .map((row) => {
      const metadata = (row?.metadata && typeof row.metadata === 'object') ? row.metadata : {};
      return {
        time: row?.timestamp || new Date().toISOString(),
        product_name: String(metadata.product_name || metadata.item_no || '-'),
        size: String(metadata.size || '-'),
        room_id: Number(metadata.room_id || 0) || 0,
        event_type: normalizeEventType(row?.event_type) || 'item_entered_fitting_room',
        status: 'completed'
      };
    });
}

function initSupabase() {
  const url = (localStorage.getItem(URL_KEY) || DEFAULT_SUPABASE_URL).trim();
  const anon = (localStorage.getItem(ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY).trim();
  if (!url || !anon) return null;
  state.supabase = createClient(url, anon);
  return state.supabase;
}

function getSelectedItem() {
  return state.rackItems.find((x) => x.key === state.selectedItemKey) || null;
}

function getSelectedSku() {
  const item = getSelectedItem();
  if (!item) return null;
  return item.variants.find((v) => v.skuKey === state.selectedSkuKey) || null;
}

function getRoomById(roomId) {
  return state.roomAssignments.find((x) => x.roomId === Number(roomId)) || null;
}

function syncAlertsCount() {
  const overdueCount = state.roomAssignments
    .flatMap((room) => room.items)
    .filter((item) => isOverdue(item.enteredAt)).length;
  state.alertsCount = overdueCount;
}

function setStatus(text) {
  if (!el.status) return;
  el.status.textContent = String(text || '');
}

function showToast(message, level = 'ok') {
  if (!el.toastContainer) return;
  const node = document.createElement('div');
  node.className = `toast toast--${level}`;
  node.textContent = String(message || '');
  el.toastContainer.appendChild(node);
  setTimeout(() => node.remove(), 2400);
}

function RackItemCard(item) {
  const isSelected = state.selectedItemKey === item.key;
  const lowStock = item.totalAvailable <= LOW_STOCK_THRESHOLD && item.totalAvailable > 0;
  const selectedSku = isSelected ? getSelectedSku() : null;
  return `
    <article class="frd-rack-card${isSelected ? ' is-selected' : ''}" data-rack-item-key="${escapeHtml(item.key)}">
      <div class="frd-rack-thumb-wrap">
        <img class="frd-rack-thumb" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.product_name)}" loading="lazy" />
      </div>
      <div class="frd-rack-main">
        <p class="frd-rack-name">${escapeHtml(item.product_name)}</p>
        <p class="frd-rack-meta">${escapeHtml(item.color || '-')}</p>
        <p class="frd-rack-extra">Item ${escapeHtml(item.item_no)}${item.style_no ? ` · Style ${escapeHtml(item.style_no)}` : ''}</p>
      </div>
      <div class="frd-rack-badges">
        <span class="frd-pill frd-pill--muted">Available ${escapeHtml(item.totalAvailable)}</span>
        ${lowStock ? '<span class="frd-pill frd-pill--warning">Low stock</span>' : ''}
      </div>

      ${isSelected ? `
        <section class="frd-rack-inline" data-rack-inline="${escapeHtml(item.key)}">
          <div class="frd-rack-inline-block">
            <p class="frd-rack-inline-title">Size</p>
            ${SizeSelector(item)}
          </div>
          <div class="frd-rack-inline-block">
            <p class="frd-rack-inline-title">Drag Token</p>
            ${selectedSku ? SelectedVariantCard(item, selectedSku) : '<p class="hint">Pick a size to create drag token</p>'}
          </div>
        </section>
      ` : ''}
    </article>
  `;
}

function RackPanel() {
  if (!state.rackItems.length) {
    return '<p class="hint">No items available on rack</p>';
  }
  return state.rackItems.map((item) => RackItemCard(item)).join('');
}

function SizeSelector(item) {
  return `
    <div class="frd-size-grid">
      ${item.variants.map((variant) => {
        const qty = Number(variant.quantity) || 0;
        const out = qty <= 0;
        const low = qty > 0 && qty <= LOW_STOCK_THRESHOLD;
        const selected = state.selectedSkuKey === variant.skuKey;
        return `
          <button
            type="button"
            class="frd-size-chip${selected ? ' is-selected' : ''}${low ? ' is-low' : ''}"
            data-size="${escapeHtml(variant.size)}"
            data-sku-key="${escapeHtml(variant.skuKey)}"
            ${out ? 'disabled' : ''}
          >
            ${escapeHtml(variant.size)} (${escapeHtml(qty)})
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function SelectedVariantCard(item, sku) {
  if (!sku) return '';
  return `
    <article class="frd-variant-card" draggable="${sku.quantity > 0 ? 'true' : 'false'}" data-drag-variant-key="${escapeHtml(sku.skuKey)}">
      <div class="frd-variant-main">
        <p class="frd-variant-name">${escapeHtml(item.product_name)}</p>
        <p class="frd-variant-meta">${escapeHtml(item.color || '-')}</p>
      </div>
      <div class="frd-variant-badges">
        <span class="frd-pill frd-pill--primary">Size ${escapeHtml(sku.size)}</span>
        <span class="frd-pill frd-pill--muted">Qty ${escapeHtml(sku.quantity)}</span>
      </div>
      <span class="frd-drag-hint">⋮⋮ Drag to room / checkout</span>
    </article>
  `;
}

function SelectedItemDetailPanel() {
  const item = getSelectedItem();
  if (!item) {
    return '<p class="hint">Tip: click a Rack item, then choose size directly inside that card.</p>';
  }

  const sku = getSelectedSku();
  return `
    <section class="frd-detail-section frd-selection-tray frd-selection-tray--hint">
      <header class="frd-selection-head">
        <div>
          <p class="frd-detail-name">Selected: ${escapeHtml(item.product_name)}</p>
          <p class="frd-detail-meta">${escapeHtml(item.color || '-')} · ${escapeHtml(sku?.size || 'No size selected')}</p>
        </div>
        <span class="frd-pill frd-pill--muted">Drag from selected Rack card</span>
      </header>
    </section>
  `;
}

function RoomCard(room) {
  const overdue = room.items.some((item) => isOverdue(item.enteredAt));
  const sessionStatus = getRoomSessionStatus(room);
  const longestDwell = getLongestDwell(room);
  const isExpanded = Boolean(state.expandedRoomIds[room.roomId]);
  const visibleItems = isExpanded ? room.items : room.items.slice(0, 2);
  const hiddenCount = Math.max(0, room.items.length - visibleItems.length);
  return `
    <article class="frd-room-card${overdue ? ' is-overdue' : ''}">
      <header class="frd-room-head">
        <h3>Room ${escapeHtml(room.roomId)}</h3>
        <span class="status-badge">${escapeHtml(room.items.length)} items</span>
      </header>
      <div class="frd-room-summary-line">
        <span class="frd-pill frd-pill--muted">Session ${escapeHtml(sessionStatus)}</span>
        <span class="frd-pill ${overdue ? 'frd-pill--danger' : 'frd-pill--muted'}">Longest dwell ${escapeHtml(longestDwell)}</span>
      </div>
      <div class="frd-room-dropzone" data-room-id="${escapeHtml(room.roomId)}" data-drop-zone="room">
        ${room.items.length
          ? visibleItems.map((entry) => `
              <article
                class="frd-room-item${isOverdue(entry.enteredAt) ? ' is-overdue' : ''}"
                draggable="true"
                data-drag-room-item-id="${escapeHtml(entry.room_item_id)}"
                data-room-id="${escapeHtml(room.roomId)}"
              >
                <p class="frd-room-item-name">${escapeHtml(entry.product_name)}</p>
                <div class="frd-room-item-meta-row">
                  <span class="frd-pill frd-pill--primary">${escapeHtml(entry.size)}</span>
                  <span class="frd-room-item-meta">Dwell ${escapeHtml(formatDwell(entry.enteredAt))}</span>
                  ${isOverdue(entry.enteredAt) ? '<span class="frd-pill frd-pill--danger">Overdue</span>' : ''}
                </div>
              </article>
            `).join('')
          : '<p class="hint">Drop selected item here</p>'}
        ${hiddenCount > 0 ? `<button type="button" class="frd-room-more-btn" data-room-toggle="${escapeHtml(room.roomId)}">+${escapeHtml(hiddenCount)} more</button>` : ''}
        ${room.items.length > 2 && isExpanded ? `<button type="button" class="frd-room-more-btn" data-room-toggle="${escapeHtml(room.roomId)}">Collapse</button>` : ''}
      </div>
    </article>
  `;
}

function FittingRoomsGrid() {
  return state.roomAssignments.map((room) => RoomCard(room)).join('');
}

function CheckoutListPanel() {
  if (!state.checkoutRecords.length) {
    return '<p class="hint">No purchases yet</p>';
  }

  const records = state.checkoutShowAll ? state.checkoutRecords : state.checkoutRecords.slice(0, 5);
  return records.map((record) => `
    <article class="frd-checkout-item">
      <div>
        <p class="frd-checkout-item-name">${escapeHtml(record.product_name)} · ${escapeHtml(record.size)}</p>
        <p class="frd-checkout-item-meta">${escapeHtml(formatTime(record.time))}</p>
      </div>
      <span class="frd-pill frd-pill--primary">${escapeHtml(SALE_TYPE_LABELS[record.sale_type] || record.sale_type)}</span>
    </article>
  `).join('');
}

function RecentEventsTable() {
  if (!state.recentEvents.length) {
    return '<tr><td colspan="6" class="hint">No recent events</td></tr>';
  }
  return state.recentEvents.slice(0, 30).map((event) => `
    <tr>
      <td>${escapeHtml(formatTime(event.time))}</td>
      <td>${escapeHtml(event.product_name)}</td>
      <td>${escapeHtml(event.size)}</td>
      <td>${escapeHtml(event.room_id ? `Room ${event.room_id}` : '-')}</td>
      <td>${escapeHtml(EVENT_TYPE_LABELS[event.event_type] || event.event_type)}</td>
      <td>${escapeHtml(event.status || 'completed')}</td>
    </tr>
  `).join('');
}

function RoomSummaryPanel() {
  const rows = state.roomAssignments.map((room) => {
    const itemCount = room.items.length;
    const sessionStatus = getRoomSessionStatus(room);
    const dwell = getLongestDwell(room);
    return `
      <tr>
        <td>Room ${escapeHtml(room.roomId)}</td>
        <td>${escapeHtml(itemCount)}</td>
        <td>${escapeHtml(sessionStatus)}</td>
        <td>${escapeHtml(dwell)}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="frd-events-table">
      <thead>
        <tr>
          <th>Room</th>
          <th>Item Count</th>
          <th>Session</th>
          <th>Longest Dwell</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderBottomTabs() {
  el.bottomTabButtons.forEach((button) => {
    const tab = String(button.dataset.bottomTab || '');
    const active = tab === state.bottomTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  el.bottomTabPanels.forEach((panel) => {
    const tab = String(panel.dataset.bottomPanel || '');
    panel.hidden = tab !== state.bottomTab;
  });
}

function renderCheckoutToggle() {
  if (!el.checkoutToggle) return;
  const hasMore = state.checkoutRecords.length > 5;
  el.checkoutToggle.hidden = !hasMore;
  el.checkoutToggle.textContent = state.checkoutShowAll ? 'Collapse older' : 'View older';
}

function syncRackTotals() {
  state.rackItems.forEach((item) => {
    item.totalAvailable = item.variants.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0);
  });
}

function renderTopState() {
  syncAlertsCount();
  if (el.alertsBadge) {
    el.alertsBadge.textContent = `Active Alerts: ${state.alertsCount}`;
    el.alertsBadge.classList.toggle('text-err', state.alertsCount > 0);
  }
}

function renderAll() {
  if (el.rackList) el.rackList.innerHTML = RackPanel();
  if (el.selectedItemDetailBody) el.selectedItemDetailBody.innerHTML = SelectedItemDetailPanel();
  if (el.roomsGrid) el.roomsGrid.innerHTML = FittingRoomsGrid();
  if (el.checkoutList) el.checkoutList.innerHTML = CheckoutListPanel();
  renderCheckoutToggle();
  if (el.recentEventsBody) el.recentEventsBody.innerHTML = RecentEventsTable();
  if (el.roomSummaryBody) el.roomSummaryBody.innerHTML = RoomSummaryPanel();
  renderBottomTabs();
  renderTopState();
}

function selectRackItem(itemKey) {
  state.selectedItemKey = itemKey;
  state.selectedSize = null;
  state.selectedSkuKey = null;
  renderAll();
}

function selectSize(skuKey, size) {
  state.selectedSkuKey = skuKey;
  state.selectedSize = size;
  renderAll();
}

function ensureValidSelectedSku() {
  const sku = getSelectedSku();
  if (sku && sku.quantity > 0) return;
  state.selectedSkuKey = null;
  state.selectedSize = null;
}

function isValidMove(fromZone, toZone) {
  const key = `${fromZone}->${toZone}`;
  return ['rack->room', 'room->rack', 'room->checkout', 'rack->checkout'].includes(key);
}

function resolveEventPlan(fromZone, toZone) {
  const key = `${fromZone}->${toZone}`;
  if (key === 'rack->room') {
    return {
      events: ['item_entered_fitting_room', 'item_added_to_session'],
      successToast: 'Item entered fitting room'
    };
  }
  if (key === 'room->rack') {
    return {
      events: ['item_left_fitting_room', 'item_returned_to_floor'],
      successToast: 'Item returned to rack'
    };
  }
  if (key === 'room->checkout') {
    return {
      events: ['item_left_fitting_room', 'item_moved_to_checkout'],
      successToast: 'Purchase completed',
      saleType: 'try_on_purchase'
    };
  }
  if (key === 'rack->checkout') {
    return {
      events: ['item_moved_to_checkout'],
      successToast: 'Direct purchase completed',
      saleType: 'direct_purchase'
    };
  }
  return null;
}

function pushRecentEvents(events, context, roomId) {
  const nowIso = new Date().toISOString();
  events.slice().reverse().forEach((eventType) => {
    state.recentEvents.unshift({
      time: nowIso,
      product_name: context.product_name,
      size: context.size,
      room_id: Number(roomId) || 0,
      event_type: eventType,
      status: 'completed'
    });
  });
}

async function postRfidEvents(events, context, roomId) {
  if (!events.length) return;
  const epcData = String(context?.epc_data || '').trim();
  if (!isValidEpcData(epcData)) {
    throw new Error('Selected inventory has no valid EPC, unable to persist to DB.');
  }

  const roomNum = Number(roomId || context?.fromRoomId || 1) || 1;
  const fittingReader = `FITTING_ROOM_ANTENNA_${Math.min(4, Math.max(1, roomNum))}`;

  for (const eventType of events) {
    let payload = null;
    if (eventType === 'item_entered_fitting_room' || eventType === 'item_added_to_session') {
      payload = {
        epc_data: epcData,
        reader_id: fittingReader,
        event_type: 'enter_fitting_room',
        event_source: 'demo_drag',
        from_zone: 'sales_floor',
        to_zone: 'fitting_room'
      };
    } else if (eventType === 'item_left_fitting_room' || eventType === 'item_returned_to_floor') {
      payload = {
        epc_data: epcData,
        reader_id: 'RACK_ANTENNA_1',
        event_type: 'left_fitting_room',
        event_source: 'demo_drag',
        from_zone: 'fitting_room',
        to_zone: 'sales_floor'
      };
    } else if (eventType === 'item_moved_to_checkout') {
      payload = {
        epc_data: epcData,
        reader_id: 'SOLD_ANTENNA_1',
        event_type: 'sale_completed',
        event_source: 'demo_drag',
        from_zone: 'checkout',
        to_zone: 'sold'
      };
    }

    if (!payload) continue;

    const response = await fetch('/api/rfid-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getApiAuthHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let details = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        details = String(data?.error || data?.message || details);
      } catch {
        // ignore non-json response
      }
      throw new Error(details);
    }
  }
}

function snapshotMoveState() {
  return {
    rackItems: JSON.parse(JSON.stringify(state.rackItems)),
    roomAssignments: JSON.parse(JSON.stringify(state.roomAssignments)),
    checkoutRecords: JSON.parse(JSON.stringify(state.checkoutRecords)),
    recentEvents: JSON.parse(JSON.stringify(state.recentEvents)),
    selectedItemKey: state.selectedItemKey,
    selectedSize: state.selectedSize,
    selectedSkuKey: state.selectedSkuKey,
    roomItemSeq: state.roomItemSeq
  };
}

function restoreMoveState(snapshot) {
  state.rackItems = snapshot.rackItems;
  state.roomAssignments = snapshot.roomAssignments;
  state.checkoutRecords = snapshot.checkoutRecords;
  state.recentEvents = snapshot.recentEvents;
  state.selectedItemKey = snapshot.selectedItemKey;
  state.selectedSize = snapshot.selectedSize;
  state.selectedSkuKey = snapshot.selectedSkuKey;
  state.roomItemSeq = snapshot.roomItemSeq;
}

function findVariantBySku(skuKey) {
  for (const rackItem of state.rackItems) {
    const variant = rackItem.variants.find((v) => v.skuKey === skuKey);
    if (variant) return { rackItem, variant };
  }
  return null;
}

function getRoomEntryById(roomItemId) {
  for (const room of state.roomAssignments) {
    const entry = room.items.find((x) => String(x.room_item_id) === String(roomItemId));
    if (entry) return { room, entry };
  }
  return null;
}

function consumeRackVariant(variant) {
  variant.quantity = Math.max(0, Number(variant.quantity) - 1);
  syncRackTotals();
}

function restoreRackVariant(variant) {
  variant.quantity = Math.max(0, Number(variant.quantity) + 1);
  syncRackTotals();
}

function takeEpcFromVariant(variant) {
  if (!variant || !Array.isArray(variant.epc_pool) || variant.epc_pool.length === 0) return null;
  const epc = String(variant.epc_pool.shift() || '').trim();
  return isValidEpcData(epc) ? epc : null;
}

function putEpcBackToVariant(variant, epcData) {
  if (!variant || !Array.isArray(variant.epc_pool)) return;
  const epc = String(epcData || '').trim();
  if (!isValidEpcData(epc)) return;
  if (!variant.epc_pool.includes(epc)) {
    variant.epc_pool.unshift(epc);
  }
}

function buildSelectedRackDragContext() {
  const item = getSelectedItem();
  const sku = getSelectedSku();
  if (!item || !sku || sku.quantity <= 0) return null;
  const epcData = Array.isArray(sku.epc_pool) ? String(sku.epc_pool[0] || '').trim() : '';
  if (!isValidEpcData(epcData)) {
    showToast('此 SKU 缺少可用 EPC，無法寫入資料庫。請先補齊 inventory_items.epc_data。', 'err');
    return null;
  }
  return {
    source: 'rack',
    item_key: item.key,
    item_no: item.item_no,
    product_name: item.product_name,
    size: sku.size,
    sku_ean13: sku.sku_ean13,
    epc_data: epcData,
    skuKey: sku.skuKey
  };
}

function buildRoomDragContext(roomItemId) {
  const roomHit = getRoomEntryById(roomItemId);
  if (!roomHit) return null;
  const epcData = String(roomHit.entry.epc_data || '').trim();
  if (!isValidEpcData(epcData)) {
    showToast('此房間商品缺少有效 EPC，無法同步至資料庫。', 'err');
    return null;
  }
  return {
    source: 'room',
    fromRoomId: roomHit.room.roomId,
    room_item_id: roomHit.entry.room_item_id,
    item_key: roomHit.entry.item_key,
    item_no: roomHit.entry.item_no,
    product_name: roomHit.entry.product_name,
    size: roomHit.entry.size,
    sku_ean13: roomHit.entry.sku_ean13,
    epc_data: epcData,
    skuKey: roomHit.entry.sku_ean13
  };
}

function highlightValidDropZones(source) {
  const roomZones = document.querySelectorAll('.frd-room-dropzone');
  const rackZone = document.querySelector('.frd-rack-dropzone');
  const checkoutZone = document.getElementById('checkoutDropzone');

  if (source === 'rack') {
    roomZones.forEach((zone) => zone.classList.add('is-valid-drop'));
    if (checkoutZone) checkoutZone.classList.add('is-valid-drop');
  }

  if (source === 'room') {
    if (rackZone) rackZone.classList.add('is-valid-drop');
    if (checkoutZone) checkoutZone.classList.add('is-valid-drop');
  }
}

function clearDropZoneHighlights() {
  document.querySelectorAll('.frd-room-dropzone, .frd-rack-dropzone, .frd-checkout-dropzone')
    .forEach((zone) => zone.classList.remove('is-valid-drop', 'is-drop-hover'));
}

function getDropTargetFromNode(node) {
  const roomZone = node.closest('.frd-room-dropzone');
  if (roomZone) {
    const roomId = Number(roomZone.dataset.roomId || 0);
    if (!ROOM_IDS.includes(roomId)) return null;
    return { zone: 'room', roomId, node: roomZone };
  }

  const rackZone = node.closest('.frd-rack-dropzone');
  if (rackZone) return { zone: 'rack', roomId: 0, node: rackZone };

  const checkoutZone = node.closest('.frd-checkout-dropzone');
  if (checkoutZone) return { zone: 'checkout', roomId: 0, node: checkoutZone };

  return null;
}

function commitMove(context, target, plan) {
  const nowIso = new Date().toISOString();
  if (context.source === 'rack' && target.zone === 'room') {
    const hit = findVariantBySku(context.skuKey);
    if (!hit || hit.variant.quantity <= 0) return false;
    const consumedEpc = takeEpcFromVariant(hit.variant);
    consumeRackVariant(hit.variant);
    const room = getRoomById(target.roomId);
    if (!room) return false;
    context.epc_data = consumedEpc || context.epc_data || '';
    room.items.push({
      room_item_id: `room_item_${state.roomItemSeq++}`,
      item_key: context.item_key,
      item_no: context.item_no,
      product_name: context.product_name,
      size: context.size,
      sku_ean13: context.sku_ean13,
      epc_data: context.epc_data || '',
      enteredAt: nowIso
    });
    return true;
  }

  if (context.source === 'room' && target.zone === 'rack') {
    const roomHit = getRoomEntryById(context.room_item_id);
    if (!roomHit) return false;
    roomHit.room.items = roomHit.room.items.filter((x) => x.room_item_id !== context.room_item_id);
    const hit = findVariantBySku(context.skuKey);
    if (hit) {
      restoreRackVariant(hit.variant);
      putEpcBackToVariant(hit.variant, context.epc_data || roomHit.entry?.epc_data || '');
    }
    return true;
  }

  if (context.source === 'room' && target.zone === 'checkout') {
    const roomHit = getRoomEntryById(context.room_item_id);
    if (!roomHit) return false;
    context.epc_data = context.epc_data || roomHit.entry?.epc_data || '';
    roomHit.room.items = roomHit.room.items.filter((x) => x.room_item_id !== context.room_item_id);
    state.checkoutRecords.unshift({
      product_name: context.product_name,
      size: context.size,
      sku_ean13: context.sku_ean13,
      epc_data: context.epc_data || '-',
      sale_type: plan.saleType,
      time: nowIso
    });
    return true;
  }

  if (context.source === 'rack' && target.zone === 'checkout') {
    const hit = findVariantBySku(context.skuKey);
    if (!hit || hit.variant.quantity <= 0) return false;
    const consumedEpc = takeEpcFromVariant(hit.variant);
    consumeRackVariant(hit.variant);
    context.epc_data = consumedEpc || context.epc_data || '';
    state.checkoutRecords.unshift({
      product_name: context.product_name,
      size: context.size,
      sku_ean13: context.sku_ean13,
      epc_data: context.epc_data || '-',
      sale_type: plan.saleType,
      time: nowIso
    });
    return true;
  }

  return false;
}

async function handleDropOnTarget(target) {
  const context = state.draggingContext;
  if (!context) {
    showToast('Invalid move', 'err');
    return;
  }

  if (!isValidMove(context.source, target.zone)) {
    showToast('Invalid move', 'err');
    return;
  }

  const plan = resolveEventPlan(context.source, target.zone);
  if (!plan) {
    showToast('Action could not be completed', 'err');
    return;
  }

  const snapshot = snapshotMoveState();
  const ok = commitMove(context, target, plan);
  if (!ok) {
    showToast('Action could not be completed', 'err');
    return;
  }

  try {
    await postRfidEvents(plan.events, context, target.roomId || context.fromRoomId || 0);
  } catch (error) {
    restoreMoveState(snapshot);
    renderAll();
    showToast('Action could not be completed', 'err');
    return;
  }

  pushRecentEvents(plan.events, context, target.roomId || context.fromRoomId || 0);
  ensureValidSelectedSku();
  renderAll();
  showToast(plan.successToast, 'ok');
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const sizeChip = event.target.closest('[data-sku-key]');
    if (sizeChip && !sizeChip.hasAttribute('disabled')) {
      selectSize(String(sizeChip.dataset.skuKey || ''), String(sizeChip.dataset.size || ''));
      return;
    }

    const roomToggle = event.target.closest('[data-room-toggle]');
    if (roomToggle) {
      const roomId = Number(roomToggle.dataset.roomToggle || 0);
      if (ROOM_IDS.includes(roomId)) {
        state.expandedRoomIds[roomId] = !state.expandedRoomIds[roomId];
        renderAll();
      }
      return;
    }

    const bottomTabButton = event.target.closest('[data-bottom-tab]');
    if (bottomTabButton) {
      state.bottomTab = String(bottomTabButton.dataset.bottomTab || 'recent-events');
      renderBottomTabs();
      return;
    }

    const checkoutToggle = event.target.closest('#checkoutToggleButton');
    if (checkoutToggle) {
      state.checkoutShowAll = !state.checkoutShowAll;
      renderAll();
      return;
    }

    const rackCard = event.target.closest('[data-rack-item-key]');
    if (rackCard) {
      selectRackItem(String(rackCard.dataset.rackItemKey || ''));
      return;
    }
  });

  document.addEventListener('dragstart', (event) => {
    const selectedCard = event.target.closest('[data-drag-variant-key]');
    if (selectedCard) {
      const context = buildSelectedRackDragContext();
      if (!context) {
        event.preventDefault();
        showToast('Invalid move', 'err');
        return;
      }
      state.draggingContext = context;
      selectedCard.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain', context.skuKey);
      event.dataTransfer.effectAllowed = 'move';
      highlightValidDropZones('rack');
      return;
    }

    const roomItem = event.target.closest('[data-drag-room-item-id]');
    if (!roomItem) return;
    const context = buildRoomDragContext(String(roomItem.dataset.dragRoomItemId || ''));
    if (!context) {
      event.preventDefault();
      showToast('Invalid move', 'err');
      return;
    }

    state.draggingContext = context;
    roomItem.classList.add('is-dragging');
    event.dataTransfer?.setData('text/plain', context.room_item_id);
    event.dataTransfer.effectAllowed = 'move';
    highlightValidDropZones('room');
  });

  document.addEventListener('dragend', (event) => {
    const dragNode = event.target.closest('[data-drag-variant-key], [data-drag-room-item-id]');
    if (dragNode) dragNode.classList.remove('is-dragging');
    state.draggingContext = null;
    clearDropZoneHighlights();
  });

  document.addEventListener('dragover', (event) => {
    const target = getDropTargetFromNode(event.target);
    if (!target || !state.draggingContext) return;
    if (!isValidMove(state.draggingContext.source, target.zone)) return;
    event.preventDefault();
    target.node.classList.add('is-drop-hover');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });

  document.addEventListener('dragleave', (event) => {
    const target = getDropTargetFromNode(event.target);
    if (!target) return;
    if (!target.node.contains(event.relatedTarget)) {
      target.node.classList.remove('is-drop-hover');
    }
  });

  document.addEventListener('drop', async (event) => {
    const target = getDropTargetFromNode(event.target);
    if (!target) {
      if (state.draggingContext) showToast('Invalid move', 'err');
      return;
    }

    event.preventDefault();
    await handleDropOnTarget(target);
  });

  if (el.resetButton) {
    el.resetButton.addEventListener('click', () => {
      bootstrapMockData();
      showToast('Demo reset', 'ok');
    });
  }

  if (el.seedButton) {
    el.seedButton.addEventListener('click', () => {
      bootstrapMockData();
      showToast('Demo data seeded', 'ok');
    });
  }
}

function bootstrapMockData() {
  state.rackItems = buildRackData(MOCK_SKU_ROWS);
  state.selectedItemKey = null;
  state.selectedSize = null;
  state.selectedSkuKey = null;
  state.roomAssignments = buildEmptyRooms();
  state.checkoutRecords = [];
  state.recentEvents = [];
  state.draggingContext = null;
  state.roomItemSeq = 1;
  state.bottomTab = 'recent-events';
  state.checkoutShowAll = false;
  state.expandedRoomIds = {};
  state.dataSource = 'mock';
  setStatus('Mock Mode');
  renderAll();
}

async function bootstrapFromDb() {
  if (!initSupabase()) {
    console.warn('[FRD][bootstrapFromDb] supabase init failed, fallback to mock mode');
    bootstrapMockData();
    return;
  }

  try {
    const rows = await fetchCatalogFromDb();
    if (!rows.length) {
      console.warn('[FRD][bootstrapFromDb] catalog rows empty, fallback to mock mode');
      bootstrapMockData();
      return;
    }

    state.rackItems = buildRackData(rows);
    state.selectedItemKey = null;
    state.selectedSize = null;
    state.selectedSkuKey = null;
    state.roomAssignments = buildEmptyRooms();
    state.checkoutRecords = [];
    state.recentEvents = await fetchRecentEventsFromDb(50);
    state.draggingContext = null;
    state.roomItemSeq = 1;
    state.bottomTab = 'recent-events';
    state.checkoutShowAll = false;
    state.expandedRoomIds = {};
    state.dataSource = 'db';
    setStatus('DB Mode');
    console.debug('[FRD][bootstrapFromDb] using DB mode:', {
      rackItems: state.rackItems.length,
      recentEvents: state.recentEvents.length
    });
    renderAll();
  } catch (error) {
    console.error('[FRD][bootstrapFromDb] error, fallback to mock mode:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      raw: error
    });
    bootstrapMockData();
  }
}

async function bootstrap() {
  bindEvents();
  await bootstrapFromDb();
  setInterval(() => {
    if (state.roomAssignments.some((room) => room.items.length > 0)) {
      renderAll();
    }
  }, 1000);
}

bootstrap();
