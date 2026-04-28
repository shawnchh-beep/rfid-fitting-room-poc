import { createClient } from '@supabase/supabase-js';
import { authorizeAnySignedIn } from '../server/auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function selectWithFallback(table, selectAttempts = [], options = {}) {
  let lastError = null;
  for (const selectClause of selectAttempts) {
    let query = supabase
      .from(table)
      .select(selectClause);

    if (options.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending !== false });
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const res = await query;
    if (!res.error) {
      return { data: res.data || [], error: null, selectClause };
    }

    lastError = res.error;
    const code = String(res.error?.code || '').toUpperCase();
    const msg = String(res.error?.message || '').toLowerCase();
    const fallbackAllowed =
      code === '42703'
      || code === 'PGRST204'
      || msg.includes('column')
      || msg.includes('schema cache')
      || msg.includes('could not find');

    console.warn('[fitting-catalog] select failed', {
      table,
      selectClause,
      code: res.error?.code,
      message: res.error?.message,
      details: res.error?.details,
      hint: res.error?.hint,
      fallbackAllowed
    });

    if (!fallbackAllowed) break;
  }

  return { data: [], error: lastError, selectClause: null };
}

function isAvailableInventoryStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return true;
  return !['sold', 'checkout', 'returned', 'damaged', 'void'].includes(s);
}

function resolveText(...values) {
  for (const v of values) {
    const t = String(v ?? '').trim();
    if (t) return t;
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const auth = await authorizeAnySignedIn(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.errorBody || { error: auth.error });
  }

  try {
    const productsRes = await selectWithFallback(
      'products',
      [
        'id,name,name_en,price,size,color,sku,sku_ean13,style_no,item_no,epc_data,epc_company_prefix,item_reference',
        'id,name,name_en,price,size,color,sku,sku_ean13,style_no,item_no,epc_company_prefix,item_reference',
        'id,name,name_en,price,size,color,sku,sku_ean13,style_no,item_no',
        'id,name,name_en,price,size,color,sku,style_no,item_no',
        'id,name,name_en,price,size,color,sku',
        '*'
      ],
      { orderBy: { column: 'id', ascending: true }, limit: 3000 }
    );

    const inventoryRes = await selectWithFallback(
      'inventory_items',
      [
        'product_id,sku,style_no,item_no,status,epc_data',
        'product_id,sku,status,epc_data',
        'product_id,sku,style_no,item_no,status'
      ],
      { limit: 10000 }
    );

    if (productsRes.error) {
      return res.status(500).json({
        error: 'Failed to read products',
        debug: {
          code: productsRes.error?.code || null,
          message: productsRes.error?.message || null,
          details: productsRes.error?.details || null,
          hint: productsRes.error?.hint || null
        }
      });
    }

    const products = productsRes.data || [];
    const inventoryRows = (inventoryRes.data || []).filter((row) => isAvailableInventoryStatus(row?.status));

    const qtyBySku = new Map();
    const epcBySku = new Map();
    const qtyByProductId = new Map();
    const epcByProductId = new Map();

    for (const row of inventoryRows) {
      const sku = resolveText(row?.sku);
      const productId = resolveText(row?.product_id);
      const epc = resolveText(row?.epc_data);

      if (sku) qtyBySku.set(sku, (qtyBySku.get(sku) || 0) + 1);
      if (productId) qtyByProductId.set(productId, (qtyByProductId.get(productId) || 0) + 1);

      if (/^[0-9A-Fa-f]{24}$/.test(epc)) {
        if (sku) {
          if (!epcBySku.has(sku)) epcBySku.set(sku, []);
          epcBySku.get(sku).push(epc);
        }
        if (productId) {
          if (!epcByProductId.has(productId)) epcByProductId.set(productId, []);
          epcByProductId.get(productId).push(epc);
        }
      }
    }

    const rows = products.map((p) => {
      const productId = resolveText(p?.id);
      const sku = resolveText(p?.sku_ean13, p?.sku);
      const epcFromInventory = productId
        ? (epcByProductId.get(productId) || [])
        : (epcBySku.get(sku) || []);
      const epcProduct = resolveText(p?.epc_data);
      const epcFallback = /^[0-9A-Fa-f]{24}$/.test(epcProduct) ? [epcProduct] : [];
      const epcList = epcFromInventory.length > 0 ? epcFromInventory : epcFallback;

      const qty = productId
        ? (qtyByProductId.get(productId) || qtyBySku.get(sku) || 0)
        : (qtyBySku.get(sku) || 0);

      return {
        product_id: productId || null,
        style_no: resolveText(p?.style_no, sku),
        item_no: resolveText(p?.item_no, sku),
        epc_company_prefix: resolveText(p?.epc_company_prefix),
        item_reference: resolveText(p?.item_reference),
        sku_ean13: sku,
        product_name: resolveText(p?.name_en, p?.name, p?.item_no, 'Unknown'),
        color: resolveText(p?.color, '-'),
        size: resolveText(p?.size, '-'),
        quantity: Number(qty) || 0,
        price_usd: Number(p?.price) || 0,
        epc_list: epcList
      };
    }).filter((r) => r.sku_ean13 && r.item_no);

    return res.status(200).json({
      status: 'success',
      rows,
      debug: {
        products_select: productsRes.selectClause,
        inventory_select: inventoryRes.selectClause,
        products_count: products.length,
        inventory_count: inventoryRows.length,
        rows_count: rows.length,
        rows_with_epc: rows.filter((r) => Array.isArray(r.epc_list) && r.epc_list.length > 0).length
      }
    });
  } catch (error) {
    console.error('[fitting-catalog] error', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      debug: {
        message: error?.message || String(error),
        code: error?.code || null,
        details: error?.details || null,
        hint: error?.hint || null
      }
    });
  }
}
