import { decodeSGTIN96 } from '../sgtin96.js';

const FITTING_EXIT_TIMEOUT_MS = 30_000;
const LONG_DWELL_MINUTES = 15;

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function safeRate(numerator, denominator) {
  const n = toSafeNumber(numerator, 0);
  const d = toSafeNumber(denominator, 0);
  if (d <= 0) return 0;
  return n / d;
}

function toProductKey(companyPrefix, itemReference) {
  const cp = normalizeText(companyPrefix);
  const ir = normalizeText(itemReference);
  if (!cp || !ir) return '';
  return `${cp}::${ir}`;
}

function parseEpcToKey(epcData) {
  const epc = normalizeText(epcData);
  if (!/^[A-Fa-f0-9]{24}$/.test(epc)) return '';
  try {
    const decoded = decodeSGTIN96(epc);
    return toProductKey(decoded.companyPrefix, decoded.itemReference);
  } catch {
    return '';
  }
}

function resolveProductKeyFromProduct(product = {}) {
  return toProductKey(product?.epc_company_prefix, product?.item_reference)
    || parseEpcToKey(product?.epc_data);
}

function resolveProductKeyFromEvent(event = {}) {
  return parseEpcToKey(event?.epc_data);
}

function computeKeyDiagnostics(products = [], recentEvents = []) {
  const productsTotal = Array.isArray(products) ? products.length : 0;
  const eventsTotal = Array.isArray(recentEvents) ? recentEvents.length : 0;

  const productsWithResolvableKey = (Array.isArray(products) ? products : []).filter((product) => Boolean(resolveProductKeyFromProduct(product))).length;
  const eventsWithResolvableKey = (Array.isArray(recentEvents) ? recentEvents : []).filter((event) => Boolean(resolveProductKeyFromEvent(event))).length;

  return {
    productsTotal,
    productsWithResolvableKey,
    productsWithoutResolvableKey: Math.max(0, productsTotal - productsWithResolvableKey),
    eventsTotal,
    eventsWithResolvableKey,
    eventsWithoutResolvableKey: Math.max(0, eventsTotal - eventsWithResolvableKey)
  };
}

function resolveProductName(product = {}) {
  return normalizeText(product?.display_name, product?.name_en, product?.name, 'Unnamed Product');
}

function resolveProductSku(product = {}) {
  return normalizeText(product?.sku, product?.sku_ean13, product?.item_no, '-');
}

function resolveProductPrice(product = {}) {
  return Math.max(0, toSafeNumber(product?.price_usd, toSafeNumber(product?.price, 0)));
}

function todayStartIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

function sevenDaysAgoIso() {
  return new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
}

function isFreshPresence(presence = {}, nowMs = Date.now()) {
  const lastSeenMs = Date.parse(presence?.last_seen_at);
  if (!Number.isFinite(lastSeenMs)) return false;
  return nowMs - lastSeenMs <= FITTING_EXIT_TIMEOUT_MS;
}

function normalizeStateFromEvent(event = {}) {
  const eventType = normalizeText(event?.event_type).toLowerCase();
  const reader = normalizeText(event?.reader_id).toUpperCase();
  const toZone = normalizeText(event?.to_zone).toLowerCase();

  if (eventType === 'sale_completed' || reader.includes('SOLD') || toZone === 'sold') return 'SOLD';
  if (eventType === 'move_to_checkout' || reader.includes('CHECKOUT') || toZone === 'checkout') return 'CHECKOUT';
  if (eventType === 'enter_fitting_room' || reader.includes('FITTING') || toZone === 'fitting_room') return 'FITTING_ROOM';
  return 'RACK';
}

async function selectWithFallback(supabase, table, attempts, options = {}) {
  let lastError = null;
  for (const selectClause of attempts) {
    let query = supabase.from(table).select(selectClause);

    if (options.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending !== false });
    }
    if (options.gte) {
      query = query.gte(options.gte.column, options.gte.value);
    }
    if (options.eq) {
      query = query.eq(options.eq.column, options.eq.value);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const result = await query;
    if (!result.error) return { data: result.data || [], error: null, selectClause };

    lastError = result.error;
    const code = String(result.error?.code || '').toUpperCase();
    const msg = String(result.error?.message || '').toLowerCase();
    const fallbackAllowed = code === '42703' || code === 'PGRST204' || msg.includes('column') || msg.includes('schema cache');
    if (!fallbackAllowed) break;
  }

  return { data: [], error: lastError, selectClause: null };
}

function buildLatestEventMap(events = []) {
  const map = new Map();
  for (const event of events) {
    const key = resolveProductKeyFromEvent(event);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, event);
      continue;
    }
    const prevMs = Date.parse(prev?.timestamp);
    const nextMs = Date.parse(event?.timestamp);
    if (!Number.isFinite(prevMs) || (Number.isFinite(nextMs) && nextMs >= prevMs)) {
      map.set(key, event);
    }
  }
  return map;
}

function countTodayEvents(events = [], eventType = '') {
  const startMs = Date.parse(todayStartIso());
  return events.filter((event) => {
    if (eventType && event?.event_type !== eventType) return false;
    const ts = Date.parse(event?.timestamp);
    return Number.isFinite(ts) && ts >= startMs;
  }).length;
}

function buildOpportunities(products = [], recentEvents = []) {
  const byKey = new Map();

  for (const product of products) {
    const key = resolveProductKeyFromProduct(product);
    if (!key) continue;
    byKey.set(key, {
      sku: resolveProductSku(product),
      productName: resolveProductName(product),
      unitPrice: resolveProductPrice(product),
      tryOnCount: 0,
      salesCount: 0
    });
  }

  for (const event of recentEvents) {
    const key = resolveProductKeyFromEvent(event);
    if (!key || !byKey.has(key)) continue;
    if (event?.event_type === 'enter_fitting_room') byKey.get(key).tryOnCount += 1;
    if (event?.event_type === 'sale_completed') byKey.get(key).salesCount += 1;
  }

  return Array.from(byKey.values())
    .filter((row) => row.tryOnCount > 0)
    .map((row) => {
      const conversionRate = safeRate(row.salesCount, row.tryOnCount);
      const estimatedMissedRevenue = Math.max(0, row.tryOnCount * row.unitPrice * (1 - conversionRate));
      const opportunityScore = Math.max(0, row.tryOnCount * row.unitPrice * (1 - conversionRate));
      return {
        ...row,
        conversionRate,
        estimatedMissedRevenue,
        opportunityScore,
        recommendedAction: row.salesCount === 0
          ? 'Review fit, size availability, and staff assistance'
          : 'Monitor and optimize checkout conversion'
      };
    })
    .sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.tryOnCount - a.tryOnCount));
}

function buildJourneyFunnel({ grouped, todaySessions, todaySales, recentEvents }) {
  const rackInterestCount = Math.max(grouped.RACK.length, countTodayEvents(recentEvents, 'tag_seen'), 0);
  const fittingRoomCount = Math.max(todaySessions.length, countTodayEvents(recentEvents, 'enter_fitting_room'), 0);
  const checkoutIntentCount = countTodayEvents(recentEvents, 'move_to_checkout');
  const completedSalesCount = todaySales.length;

  const dropAfterFitting = Math.max(0, fittingRoomCount - checkoutIntentCount);
  const dropAfterCheckout = Math.max(0, checkoutIntentCount - completedSalesCount);
  const hasActivity = rackInterestCount + fittingRoomCount + checkoutIntentCount + completedSalesCount > 0;

  const mainDropOffStage = hasActivity
    ? (dropAfterFitting >= dropAfterCheckout ? 'after_fitting_room' : 'after_checkout')
    : 'no_activity';

  return {
    rackInterestCount,
    fittingRoomCount,
    checkoutIntentCount,
    completedSalesCount,
    tryOnToCheckoutRate: safeRate(checkoutIntentCount, fittingRoomCount) * 100,
    checkoutToSaleRate: safeRate(completedSalesCount, checkoutIntentCount) * 100,
    overallConversionRate: safeRate(completedSalesCount, rackInterestCount) * 100,
    mainDropOffStage
  };
}

function buildRevenueImpact({ opportunities, journeyFunnel }) {
  const missedRevenueToday = opportunities
    .filter((row) => row.tryOnCount > 0 && row.salesCount === 0)
    .reduce((acc, row) => acc + (row.tryOnCount * row.unitPrice), 0);

  const totalEstimatedMissed = opportunities.reduce((acc, row) => acc + row.estimatedMissedRevenue, 0);
  const topLossDriver = opportunities.find((row) => row.salesCount === 0) || opportunities[0] || null;

  return {
    missedRevenueToday,
    currency: 'USD',
    potentialUpliftMin: Math.round((totalEstimatedMissed * 0.4) || 0),
    potentialUpliftMax: Math.round((totalEstimatedMissed * 0.75) || 0),
    tryOnToSaleRate: Math.round(safeRate(journeyFunnel.completedSalesCount, journeyFunnel.fittingRoomCount) * 1000) / 10,
    benchmarkConversionRate: 18,
    topLossDriver: topLossDriver
      ? {
          sku: topLossDriver.sku,
          productName: topLossDriver.productName,
          missedSales: Math.max(0, topLossDriver.tryOnCount - topLossDriver.salesCount),
          estimatedLostRevenue: Math.round(topLossDriver.estimatedMissedRevenue)
        }
      : null
  };
}

function buildAiInsight({ opportunities, revenueImpact }) {
  const top = opportunities[0] || null;
  if (top && top.tryOnCount > 0 && top.salesCount === 0) {
    return {
      headline: 'High interest, low conversion detected',
      summary: `${top.productName} shows strong fitting-room interest but no completed sales.`,
      businessImpact: `${Math.max(0, top.tryOnCount - top.salesCount)} potential sales may have been missed today.`,
      possibleReasons: [
        'Size availability issue',
        'Pricing mismatch',
        'Insufficient fitting-room assistance',
        'Product styling mismatch'
      ],
      confidence: 'medium'
    };
  }

  return {
    headline: 'Store performance is stable',
    summary: 'No critical conversion anomaly detected in current data window.',
    businessImpact: `Estimated missed revenue today: ${Math.round(toSafeNumber(revenueImpact.missedRevenueToday, 0))} USD.`,
    possibleReasons: [
      'Normal traffic fluctuation',
      'Balanced fitting-room workflow'
    ],
    confidence: 'low'
  };
}

function buildReplenishmentRisk(products = [], inventoryRows = [], sales7d = []) {
  const productByEpc = new Map();
  const productById = new Map();
  for (const p of products) {
    if (p?.id != null) productById.set(p.id, p);
    const epc = normalizeText(p?.epc_data);
    if (epc) productByEpc.set(epc, p);
  }

  const stockBySku = new Map();
  for (const row of inventoryRows) {
    const status = normalizeText(row?.status).toUpperCase();
    const isAvailable = !status || status === 'ACTIVE' || status === 'IN_STOCK';
    if (!isAvailable) continue;

    const p = productById.get(row?.product_id);
    const sku = normalizeText(row?.sku, p?.sku);
    if (!sku) continue;
    stockBySku.set(sku, (stockBySku.get(sku) || 0) + 1);
  }

  const soldBySku = new Map();
  for (const event of sales7d) {
    const epc = normalizeText(event?.epc_data);
    const p = productByEpc.get(epc);
    const sku = normalizeText(p?.sku);
    if (!sku) continue;
    soldBySku.set(sku, (soldBySku.get(sku) || 0) + 1);
  }

  const skus = new Set([...stockBySku.keys(), ...soldBySku.keys()]);
  return Array.from(skus)
    .map((sku) => {
      const currentStock = stockBySku.get(sku) || 0;
      const sold7d = soldBySku.get(sku) || 0;
      const safetyStock = Math.max(5, Math.ceil((sold7d / 7) * 3));
      const suggestedQty = Math.max(0, safetyStock + 1 - currentStock);
      const riskLevel = currentStock < safetyStock ? 'critical' : (currentStock <= safetyStock + 1 ? 'warning' : 'healthy');
      return {
        sku,
        currentStock,
        safetyStock,
        riskLevel,
        recommendedAction: suggestedQty > 0 ? `Restock +${suggestedQty}` : 'Monitor'
      };
    })
    .filter((row) => row.currentStock < row.safetyStock)
    .sort((a, b) => (a.currentStock - b.currentStock))
    .slice(0, 8);
}

function buildRecommendedActions({ longDwellCount, opportunities, replenishmentRisk, journeyFunnel }) {
  const actions = [];

  if (longDwellCount > 0) {
    actions.push({
      priority: 1,
      type: 'staff_follow_up',
      title: 'Assist fitting-room customers faster',
      reason: `${longDwellCount} long dwell cases detected.`,
      suggestedAction: 'Ask staff to follow up within 3 minutes.',
      expectedImpact: 'Reduce fitting-room drop-off',
      relatedSkus: [],
      severity: 'high'
    });
  }

  const zeroSaleRows = opportunities.filter((row) => row.tryOnCount > 0 && row.salesCount === 0).slice(0, 3);
  if (zeroSaleRows.length > 0) {
    actions.push({
      priority: 2,
      type: 'product_review',
      title: 'Review high-interest products with no sales',
      reason: `${zeroSaleRows.length} products show try-ons but no conversion.`,
      suggestedAction: 'Review fit, pricing, and in-room guidance quality.',
      expectedImpact: 'Recover missed revenue from high-intent demand.',
      relatedSkus: zeroSaleRows.map((row) => row.sku),
      severity: 'medium'
    });
  }

  if (replenishmentRisk.length > 0) {
    actions.push({
      priority: 3,
      type: 'restock',
      title: 'Prioritize low-stock replenishment',
      reason: `${replenishmentRisk.length} SKUs are below safety stock.`,
      suggestedAction: 'Create replenishment tasks for at-risk SKUs.',
      expectedImpact: 'Prevent stockout-driven revenue loss.',
      relatedSkus: replenishmentRisk.map((row) => row.sku).slice(0, 6),
      severity: 'medium'
    });
  }

  if (journeyFunnel.checkoutIntentCount > journeyFunnel.completedSalesCount) {
    actions.push({
      priority: 4,
      type: 'checkout_flow_review',
      title: 'Review checkout completion flow',
      reason: `${journeyFunnel.checkoutIntentCount - journeyFunnel.completedSalesCount} checkout intents did not complete sales.`,
      suggestedAction: 'Inspect queue time and payment friction at checkout.',
      expectedImpact: 'Increase checkout-to-sale conversion.',
      relatedSkus: [],
      severity: 'medium'
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

function buildOperationAlerts({ longDwellCount, fittingRoomCount, journeyFunnel }) {
  const alerts = [];
  if (longDwellCount > 0) {
    alerts.push({
      level: 'critical',
      title: 'Customer Experience Risk',
      detail: `${longDwellCount} abnormal stay signals detected`,
      action: 'Ask staff to follow up within 3 minutes'
    });
  }

  if (fittingRoomCount > 0) {
    alerts.push({
      level: 'warning',
      title: 'Inventory Accuracy Risk',
      detail: `${fittingRoomCount} items still in fitting-room flow`,
      action: 'Verify room clear-out and reset item status'
    });
  }

  if (journeyFunnel.checkoutIntentCount > journeyFunnel.completedSalesCount) {
    alerts.push({
      level: 'info',
      title: 'Service Capacity Risk',
      detail: `${journeyFunnel.checkoutIntentCount - journeyFunnel.completedSalesCount} checkout intents not converted`,
      action: 'Reallocate staff to high-load fitting rooms'
    });
  }

  return alerts.slice(0, 5);
}

function buildLiveBoardRows(products, latestEventMap, presenceMap) {
  const nowMs = Date.now();
  const longDwellMs = LONG_DWELL_MINUTES * 60 * 1000;

  const board = {
    rack: [],
    fittingRoom: [],
    checkout: [],
    sold: []
  };

  let longDwellCount = 0;

  for (const product of products) {
    const key = resolveProductKeyFromProduct(product);
    if (!key) continue;

    const event = latestEventMap.get(key);
    const presence = presenceMap.get(key);
    let state = normalizeStateFromEvent(event || {});

    if (isFreshPresence(presence, nowMs)) state = 'FITTING_ROOM';

    const enteredAtMs = Date.parse(presence?.entered_at);
    const longDwell = state === 'FITTING_ROOM' && Number.isFinite(enteredAtMs) && (nowMs - enteredAtMs > longDwellMs);
    if (longDwell) longDwellCount += 1;

    const row = {
      sku: resolveProductSku(product),
      productName: resolveProductName(product),
      epc: normalizeText(product?.epc_data),
      lastReader: normalizeText(event?.reader_id),
      abnormalStay: longDwell
    };

    if (state === 'SOLD') board.sold.push(row);
    else if (state === 'CHECKOUT') board.checkout.push(row);
    else if (state === 'FITTING_ROOM') board.fittingRoom.push(row);
    else board.rack.push(row);
  }

  return { board, longDwellCount };
}

function normalizeQuery(query = {}) {
  const range = normalizeText(query?.range || 'today').toLowerCase() || 'today';
  const from = normalizeText(query?.from);
  const to = normalizeText(query?.to);
  if (!['today', 'last7d', 'custom'].includes(range)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid range parameter' };
  }
  if (range === 'custom') {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid from/to parameter for custom range' };
    }
  }
  return {
    ok: true,
    range,
    locale: normalizeText(query?.locale || 'en') || 'en',
    storeId: normalizeText(query?.storeId || 'demo-store') || 'demo-store',
    from,
    to
  };
}

export async function buildDashboardData({ supabase, query = {} }) {
  const queryMeta = normalizeQuery(query);
  if (!queryMeta.ok) {
    return { ok: false, status: 400, error: { code: queryMeta.code, message: queryMeta.message } };
  }

  const nowIso = new Date().toISOString();
  const recentWindowIso = queryMeta.range === 'last7d' ? sevenDaysAgoIso() : todayStartIso();

  const [
    productsRes,
    recentEventsRes,
    todaySalesRes,
    sales7dRes,
    todaySessionsRes,
    presenceRes,
    inventoryRes
  ] = await Promise.all([
    selectWithFallback(
      supabase,
      'products',
      [
        'id,name,name_en,display_name,price,price_usd,sku,sku_ean13,item_no,epc_data,epc_company_prefix,item_reference',
        'id,name,name_en,price,sku,epc_data,epc_company_prefix,item_reference',
        '*'
      ],
      { orderBy: { column: 'id', ascending: true }, limit: 5000 }
    ),
    selectWithFallback(
      supabase,
      'rfid_events',
      ['epc_data,reader_id,timestamp,event_type,event_source,from_zone,to_zone', 'epc_data,reader_id,timestamp,event_type', 'epc_data,reader_id,timestamp'],
      { orderBy: { column: 'timestamp', ascending: false }, gte: { column: 'timestamp', value: recentWindowIso }, limit: 2000 }
    ),
    selectWithFallback(
      supabase,
      'rfid_events',
      ['epc_data,timestamp,event_type', 'epc_data,timestamp'],
      { eq: { column: 'event_type', value: 'sale_completed' }, gte: { column: 'timestamp', value: todayStartIso() }, limit: 2000 }
    ),
    selectWithFallback(
      supabase,
      'rfid_events',
      ['epc_data,timestamp,event_type', 'epc_data,timestamp'],
      { eq: { column: 'event_type', value: 'sale_completed' }, gte: { column: 'timestamp', value: sevenDaysAgoIso() }, limit: 10000 }
    ),
    selectWithFallback(
      supabase,
      'fitting_room_sessions',
      ['id,entered_at,left_at,converted_to_sale,session_status', 'id,entered_at,left_at,converted_to_sale'],
      { gte: { column: 'entered_at', value: todayStartIso() }, limit: 5000 }
    ),
    selectWithFallback(
      supabase,
      'fitting_room_presence',
      ['product_key,entered_at,last_seen_at,last_reader_id', '*'],
      { limit: 10000 }
    ),
    selectWithFallback(
      supabase,
      'inventory_items',
      ['product_id,sku,status,epc_data', 'product_id,sku,epc_data', '*'],
      { limit: 20000 }
    )
  ]);

  const blockingError = productsRes.error || recentEventsRes.error || todaySalesRes.error || sales7dRes.error || todaySessionsRes.error;
  if (blockingError) {
    return {
      ok: false,
      status: 500,
      error: {
        code: 'INTERNAL_ERROR',
        message: blockingError.message || 'Failed to build dashboard data'
      }
    };
  }

  const products = productsRes.data || [];
  const recentEvents = recentEventsRes.data || [];
  const todaySales = todaySalesRes.data || [];
  const sales7d = sales7dRes.data || [];
  const todaySessions = todaySessionsRes.data || [];
  const presenceRows = presenceRes.error ? [] : (presenceRes.data || []);
  const inventoryRows = inventoryRes.error ? [] : (inventoryRes.data || []);

  const keyDiag = computeKeyDiagnostics(products, recentEvents);
  console.info('[dashboard-metrics] query-result snapshot', {
    queryMeta,
    productsCount: products.length,
    recentEventsCount: recentEvents.length,
    todaySalesCount: todaySales.length,
    todaySessionsCount: todaySessions.length,
    presenceCount: presenceRows.length,
    inventoryCount: inventoryRows.length,
    keyDiag
  });

  const presenceMap = new Map(presenceRows.map((row) => [normalizeText(row?.product_key), row]).filter(([k]) => k));
  const latestEventMap = buildLatestEventMap(recentEvents);

  const grouped = { RACK: [], FITTING_ROOM: [], CHECKOUT: [], SOLD: [] };
  for (const product of products) {
    const key = resolveProductKeyFromProduct(product);
    if (!key) continue;
    const event = latestEventMap.get(key);
    const presence = presenceMap.get(key);
    let state = normalizeStateFromEvent(event || {});
    if (isFreshPresence(presence)) state = 'FITTING_ROOM';
    grouped[state].push({ product, event, presence });
  }

  console.info('[dashboard-metrics] grouped snapshot', {
    rack: grouped.RACK.length,
    fittingRoom: grouped.FITTING_ROOM.length,
    checkout: grouped.CHECKOUT.length,
    sold: grouped.SOLD.length,
    productsDroppedByKey: keyDiag.productsWithoutResolvableKey
  });

  const opportunitiesRaw = buildOpportunities(products, recentEvents);
  const opportunities = opportunitiesRaw.slice(0, 50);

  const journeyFunnel = buildJourneyFunnel({
    grouped,
    todaySessions,
    todaySales,
    recentEvents
  });

  const revenueImpact = buildRevenueImpact({ opportunities, journeyFunnel });
  const replenishmentRisk = buildReplenishmentRisk(products, inventoryRows, sales7d);

  const liveBoardData = buildLiveBoardRows(products, latestEventMap, presenceMap);
  const topRevenueOpportunities = opportunities.slice(0, 8).map((row, index) => ({
    rank: index + 1,
    sku: row.sku,
    productName: row.productName,
    tryOnCount: row.tryOnCount,
    salesCount: row.salesCount,
    conversionRate: Number((row.conversionRate * 100).toFixed(1)),
    unitPrice: row.unitPrice,
    estimatedMissedRevenue: Number(row.estimatedMissedRevenue.toFixed(2)),
    opportunityScore: Number(row.opportunityScore.toFixed(2)),
    recommendedAction: row.recommendedAction
  }));

  const recommendedActions = buildRecommendedActions({
    longDwellCount: liveBoardData.longDwellCount,
    opportunities,
    replenishmentRisk,
    journeyFunnel
  });

  const operationAlerts = buildOperationAlerts({
    longDwellCount: liveBoardData.longDwellCount,
    fittingRoomCount: grouped.FITTING_ROOM.length,
    journeyFunnel
  });

  const aiInsight = buildAiInsight({ opportunities, revenueImpact });

  return {
    ok: true,
    queryMeta,
    nowIso,
    summary: {
      storeStatus: {
        storeName: 'Demo Store',
        liveStatus: 'Active',
        rfidStatus: 'Normal',
        aiStatus: 'Ready',
        lastUpdatedAt: nowIso
      },
      revenueImpact,
      journeyFunnel,
      aiInsight,
      recommendedActions,
      topRevenueOpportunities,
      operationAlerts,
      replenishmentRisk,
      liveBoard: liveBoardData.board
    },
    opportunities: topRevenueOpportunities,
    actions: recommendedActions
  };
}
