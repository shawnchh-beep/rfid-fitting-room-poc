import { createClient } from '@supabase/supabase-js';
import { authorizeBulkProducts } from '../server/auth.js';
import { decodeSGTIN96 } from '../server/sgtin96.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeRow(row = {}) {
  const epcData = String(row.epc_data || '').trim();
  const productNameLegacy = String(row.product_name || '').trim();
  const nameEn = String(row.name_en || productNameLegacy || '').trim();
  const descriptionEn = String(row.description_en || '').trim();
  const nameZhHant = String(row.name_zh_hant || '').trim();
  const descriptionZhHant = String(row.description_zh_hant || '').trim();
  const nameZhHans = String(row.name_zh_hans || '').trim();
  const descriptionZhHans = String(row.description_zh_hans || '').trim();
  const nameJa = String(row.name_ja || '').trim();
  const descriptionJa = String(row.description_ja || '').trim();
  const sku = String(row.sku || '').trim();
  const styleNo = String(row.style_no || '').trim();
  const itemNo = String(row.item_no || '').trim();
  const size = String(row.size || '').trim();
  const color = String(row.color || '').trim();
  const imageUrl = String(row.image_url || '').trim();
  const price = row.price === '' || row.price == null ? null : Number(row.price);

  if (!/^[a-fA-F0-9]{24}$/.test(epcData)) {
    throw new Error('epc_data 必須為 24 碼 Hex 字串');
  }

  if (!nameEn) {
    throw new Error('name_en 不可為空（若舊格式，請提供 product_name）');
  }

  if (price != null && Number.isNaN(price)) {
    throw new Error('price 必須為數字');
  }

  const decoded = decodeSGTIN96(epcData);

  const translationPayload = [];
  if (nameZhHant || descriptionZhHant) {
    translationPayload.push({ locale: 'zh-Hant', name: nameZhHant || null, description: descriptionZhHant || null });
  }
  if (nameZhHans || descriptionZhHans) {
    translationPayload.push({ locale: 'zh-Hans', name: nameZhHans || null, description: descriptionZhHans || null });
  }
  if (nameJa || descriptionJa) {
    translationPayload.push({ locale: 'ja', name: nameJa || null, description: descriptionJa || null });
  }

  return {
    epc_data: epcData,
    epc_company_prefix: decoded.companyPrefix,
    item_reference: decoded.itemReference,
    name: nameEn,
    name_en: nameEn,
    description_en: descriptionEn || null,
    sku: sku || null,
    style_no: styleNo || sku || null,
    item_no: itemNo || sku || null,
    size: size || null,
    color: color || null,
    image_url: imageUrl || null,
    price,
    translations: translationPayload
  };
}

function normalizeComparableText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeComparablePrice(value) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildSkuProfile(item = {}) {
  return {
    style_no: normalizeComparableText(item.style_no),
    item_no: normalizeComparableText(item.item_no),
    sku: normalizeComparableText(item.sku),
    name_en: normalizeComparableText(item.name_en),
    size: normalizeComparableText(item.size),
    color: normalizeComparableText(item.color),
    price: normalizeComparablePrice(item.price)
  };
}

function collectIncomingSkuProfilesAndConflicts(items = []) {
  const profilesBySku = new Map();
  const conflictsBySku = new Map();
  const fieldsToCheck = ['style_no', 'item_no', 'name_en', 'size', 'color', 'price'];
  const skuShape = new Map();

  for (const item of items) {
    // 衝突主鍵改為 SKU：允許同 item_no（同款同色）下存在不同尺寸、不同 SKU。
    const sku = normalizeComparableText(item?.sku);
    if (!sku) continue;

    const profile = buildSkuProfile(item);

    const shape = skuShape.get(sku) || {
      count: 0,
      size: new Set(),
      price: new Set(),
      item_no: new Set(),
      style_no: new Set()
    };
    shape.count += 1;
    shape.size.add(profile.size);
    shape.price.add(profile.price);
    shape.item_no.add(profile.item_no);
    shape.style_no.add(profile.style_no);
    skuShape.set(sku, shape);

    const existingProfile = profilesBySku.get(sku);
    if (!existingProfile) {
      profilesBySku.set(sku, profile);
      continue;
    }

    const fieldDiff = {};
    fieldsToCheck.forEach((field) => {
      if (existingProfile[field] !== profile[field]) {
        fieldDiff[field] = {
          incoming: profile[field],
          existing: existingProfile[field]
        };
      }
    });

    if (Object.keys(fieldDiff).length > 0) {
      const current = conflictsBySku.get(sku) || { sku, fields: {} };
      Object.entries(fieldDiff).forEach(([field, diff]) => {
        current.fields[field] = current.fields[field] || diff;
      });
      conflictsBySku.set(sku, current);
    }
  }

  const repeatedSkuShape = [...skuShape.entries()]
    .filter(([, shape]) => shape.count > 1)
    .map(([sku, shape]) => ({
      sku,
      rows: shape.count,
      sizeValues: [...shape.size],
      priceValues: [...shape.price],
      itemNoValues: [...shape.item_no],
      styleNoValues: [...shape.style_no]
    }));

  if (repeatedSkuShape.length > 0) {
    console.log('[bulk-products][diag] incoming repeated sku profile', {
      repeatedSkuCount: repeatedSkuShape.length,
      sample: repeatedSkuShape.slice(0, 20)
    });
  }

  return {
    profilesBySku,
    conflicts: [...conflictsBySku.values()]
  };
}

async function detectSkuConflictsAgainstDb(profilesBySku = new Map()) {
  const skus = [...profilesBySku.keys()].filter(Boolean);
  if (skus.length === 0) return [];

  const bySku = await supabase
    .from('products')
    .select('sku, item_no, style_no, name_en, size, color, price')
    .in('sku', skus);

  if (bySku.error) throw bySku.error;

  const mergedRows = bySku.data || [];
  const conflictCheckMode = 'sku-only';
  const supportsStyleNo = true;

  console.log('[bulk-products] conflict-check mode', {
    mode: conflictCheckMode,
    incomingKeys: skus.length,
    dbRows: mergedRows.length,
    supportsStyleNo
  });

  const fieldsToCheck = supportsStyleNo
      ? ['style_no', 'item_no', 'name_en', 'size', 'color', 'price']
      : ['item_no', 'name_en', 'size', 'color', 'price'];
  const existingBySku = new Map();

  mergedRows.forEach((row) => {
    const sku = normalizeComparableText(row?.sku);
    if (!sku) return;

    const existing = existingBySku.get(sku) || {
      name_en: new Set(),
      size: new Set(),
      color: new Set(),
      price: new Set()
    };

    if (supportsStyleNo) {
      existing.style_no = existing.style_no || new Set();
      existing.style_no.add(normalizeComparableText(row?.style_no));
    }

    existing.item_no = existing.item_no || new Set();
    existing.item_no.add(normalizeComparableText(row?.item_no));
    existing.name_en.add(normalizeComparableText(row?.name_en));
    existing.size.add(normalizeComparableText(row?.size));
    existing.color.add(normalizeComparableText(row?.color));
    existing.price.add(normalizeComparablePrice(row?.price));
    existingBySku.set(sku, existing);
  });

  const conflicts = [];
  for (const [sku, incomingProfile] of profilesBySku.entries()) {
    const existingProfileSets = existingBySku.get(sku);
    if (!existingProfileSets) continue;

    const fields = {};
    fieldsToCheck.forEach((field) => {
      const existingValues = [...existingProfileSets[field]];
      if (existingValues.length === 0) return;

      const exactlyMatchSingleValue =
        existingValues.length === 1 && existingValues[0] === incomingProfile[field];

      if (!exactlyMatchSingleValue) {
        fields[field] = {
          incoming: incomingProfile[field],
          existing: existingValues.length === 1 ? existingValues[0] : existingValues
        };
      }
    });

    if (Object.keys(fields).length > 0) {
      conflicts.push({ sku, fields });
    }
  }

  return conflicts;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const auth = await authorizeBulkProducts(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.errorBody || { error: auth.error });
  }

  // v2 規則：trial 永遠不可匯入（即使 API_AUTH_ENABLED=false 也維持限制）
  if (auth.role === 'trial') {
    return res.status(403).json({ error: 'Forbidden: trial role cannot import products' });
  }

  try {
    const targetSupabaseHost = (() => {
      try {
        return new URL(process.env.SUPABASE_URL).host;
      } catch {
        return 'INVALID_SUPABASE_URL';
      }
    })();

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const validateOnly = req.body?.validate_only === true;

    const [probeItemNo, probeStyleNo] = await Promise.all([
      supabase.from('products').select('item_no').limit(1),
      supabase.from('products').select('style_no').limit(1)
    ]);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'rows 不可為空' });
    }

    console.log('[bulk-products] request received', {
      rowsCount: rows.length,
      bodyKeys: Object.keys(req.body || {}),
      targetSupabaseHost,
      schemaProbe: {
        productsHasItemNo: !probeItemNo.error,
        productsItemNoError: probeItemNo.error ? {
          code: probeItemNo.error.code,
          message: probeItemNo.error.message
        } : null,
        productsHasStyleNo: !probeStyleNo.error,
        productsStyleNoError: probeStyleNo.error ? {
          code: probeStyleNo.error.code,
          message: probeStyleNo.error.message
        } : null
      },
      actorRole: auth.role,
      authMode: auth.mode
    });

    const normalized = rows.map((row, index) => {
      try {
        return normalizeRow(row);
      } catch (error) {
        throw new Error(`第 ${index + 1} 筆資料錯誤：${error.message}`);
      }
    });

    const { profilesBySku, conflicts: inFileConflicts } = collectIncomingSkuProfilesAndConflicts(normalized);
    if (inFileConflicts.length > 0) {
      console.warn('[bulk-products][diag] in-file sku conflicts', {
        conflictCount: inFileConflicts.length,
        sample: inFileConflicts.slice(0, 20)
      });
      return res.status(409).json({
        error: 'SKU conflict detected',
        error_code: 'SKU_CONFLICT',
        scope: 'in_file',
        conflicts: inFileConflicts
      });
    }

    const dbConflicts = await detectSkuConflictsAgainstDb(profilesBySku);
    if (dbConflicts.length > 0) {
      return res.status(409).json({
        error: 'SKU conflict detected',
        error_code: 'SKU_CONFLICT',
        scope: 'against_db',
        conflicts: dbConflicts
      });
    }

    if (validateOnly) {
      return res.status(200).json({
        status: 'validated',
        message: `驗證通過，共 ${normalized.length} 筆`,
        scope: 'none',
        conflicts: []
      });
    }

    const keyByPrefixItem = (item) => `${item.epc_company_prefix}::${item.item_reference}`;
    const duplicateCounter = new Map();
    const dedupedMap = new Map();
    const duplicateNameSamples = new Map();

    for (const item of normalized) {
      const key = keyByPrefixItem(item);
      duplicateCounter.set(key, (duplicateCounter.get(key) || 0) + 1);
      // 命名策略：同商品鍵出現多筆時，採用「最後一筆」作為最終名稱/屬性
      // 這樣可讓最新匯入資料覆蓋舊命名（例如中英混名時以最後版本為準）。
      dedupedMap.set(key, item);

      const sampled = duplicateNameSamples.get(key) || [];
      if (sampled.length < 3) {
        sampled.push(item.name);
      }
      duplicateNameSamples.set(key, sampled);
    }

    const duplicates = [...duplicateCounter.entries()]
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({
        key,
        count,
        namesSample: duplicateNameSamples.get(key) || []
      }));

    const normalizedUnique = [...dedupedMap.values()];

    console.log('[bulk-products] normalized summary', {
      rowsCount: normalized.length,
      uniquePrefixItemCount: normalizedUnique.length,
      duplicates,
      sampleInputToWrite: normalizedUnique.slice(0, 2).map((item) => ({
        epc_company_prefix: item.epc_company_prefix,
        item_reference: item.item_reference,
        name: item.name
      }))
    });

    const summarizeError = (err) => ({
      code: err?.code,
      message: err?.message,
      details: err?.details,
      hint: err?.hint
    });

    const fallbackRows = normalizedUnique.map((item) => ({
      epc_company_prefix: item.epc_company_prefix,
      item_reference: item.item_reference,
      name: item.name,
      name_en: item.name_en,
      description_en: item.description_en,
      sku: item.sku || null,
      style_no: item.style_no || null,
      item_no: item.item_no || null,
      size: item.size || null,
      color: item.color || null,
      image_url: item.image_url,
      price: item.price
    }));

    console.log('[bulk-products] upsert payload preview', {
      sample: fallbackRows.slice(0, 3),
      count: fallbackRows.length
    });

    const upsertResult = await supabase
      .from('products')
      .upsert(fallbackRows, { onConflict: 'epc_company_prefix,item_reference' })
      .select('id, name, name_en, epc_company_prefix, item_reference');

    if (upsertResult.error) {
      console.error('[bulk-products] upsert failed', summarizeError(upsertResult.error));
      throw upsertResult.error;
    }

    const operationMode = 'upsert_prefix_item';
    const data = upsertResult.data;

    const productIdByKey = new Map(
      (data || []).map((row) => [`${row.epc_company_prefix}::${row.item_reference}`, row.id])
    );

    const translationRows = [];
    normalizedUnique.forEach((item) => {
      const key = `${item.epc_company_prefix}::${item.item_reference}`;
      const productId = productIdByKey.get(key);
      if (!productId) return;
      (item.translations || []).forEach((tr) => {
        translationRows.push({
          product_id: productId,
          locale: tr.locale,
          name: tr.name,
          description: tr.description
        });
      });
    });

    let translationUpserted = 0;
    if (translationRows.length > 0) {
      const translationUpsert = await supabase
        .from('product_translations')
        .upsert(translationRows, { onConflict: 'product_id,locale' })
        .select('product_id, locale');

      if (translationUpsert.error) {
        console.error('[bulk-products] translation upsert failed', summarizeError(translationUpsert.error));
        throw translationUpsert.error;
      }

      translationUpserted = translationUpsert.data?.length || 0;
    }

    // inventory_items 必須以「逐筆 EPC」寫入，不能使用 normalizedUnique（會把同款不同 EPC 併掉）
    const inventoryRows = normalized
      .map((item) => {
        const key = `${item.epc_company_prefix}::${item.item_reference}`;
        const productId = productIdByKey.get(key);
        if (!productId) return null;
        return {
          epc_data: item.epc_data,
          product_id: productId,
          sku: item.sku || null,
          style_no: item.style_no || null,
          item_no: item.item_no || null,
          status: 'ACTIVE'
        };
      })
      .filter(Boolean);

    let inventoryItemsUpserted = 0;
    if (inventoryRows.length > 0) {
      const inventoryUpsert = await supabase
        .from('inventory_items')
        .upsert(inventoryRows, { onConflict: 'epc_data' })
        .select('id, epc_data');

      if (inventoryUpsert.error) {
        const missingTable =
          inventoryUpsert.error?.code === '42P01'
          || String(inventoryUpsert.error?.message || '').includes("Could not find the table 'public.inventory_items'");

        if (missingTable) {
          console.error('[bulk-products] inventory_items table missing in current Supabase schema', {
            targetSupabaseHost,
            code: inventoryUpsert.error?.code,
            message: inventoryUpsert.error?.message,
            hint: inventoryUpsert.error?.hint,
            details: inventoryUpsert.error?.details
          });
        }

        console.error('[bulk-products] inventory upsert failed', summarizeError(inventoryUpsert.error));
        throw inventoryUpsert.error;
      }

      inventoryItemsUpserted = inventoryUpsert.data?.length || 0;

      console.log('[bulk-products] inventory upsert summary', {
        normalizedRowsCount: normalized.length,
        uniqueProductCount: normalizedUnique.length,
        inventoryRowsCount: inventoryRows.length,
        inventoryItemsUpserted
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `已處理 ${normalized.length} 筆資料（唯一商品鍵 ${normalizedUnique.length}）`,
      mode: operationMode,
      duplicates_merged: duplicates,
      affected: data?.length || 0,
      translation_rows_upserted: translationUpserted,
      inventory_items_upserted: inventoryItemsUpserted,
      items: data || [],
      debug: {
        targetSupabaseHost
      }
    });
  } catch (error) {
    console.error('Bulk Products Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
