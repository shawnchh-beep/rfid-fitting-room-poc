import { createClient } from '@supabase/supabase-js';
import { authorizeBulkProducts } from './_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function decodeSGTIN96(hex) {
  const normalized = String(hex || '').trim();
  const binary = BigInt(`0x${normalized}`).toString(2).padStart(96, '0');
  const companyPrefixBin = binary.substring(14, 38);
  const itemReferenceBin = binary.substring(38, 58);

  return {
    companyPrefix: parseInt(companyPrefixBin, 2).toString(),
    itemReference: parseInt(itemReferenceBin, 2).toString()
  };
}

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
    size: size || null,
    color: color || null,
    image_url: imageUrl || null,
    price,
    translations: translationPayload
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const auth = authorizeBulkProducts(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
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
    if (rows.length === 0) {
      return res.status(400).json({ error: 'rows 不可為空' });
    }

    console.log('[bulk-products] request received', {
      rowsCount: rows.length,
      bodyKeys: Object.keys(req.body || {}),
      targetSupabaseHost,
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

    const inventoryRows = normalizedUnique
      .map((item) => {
        const key = `${item.epc_company_prefix}::${item.item_reference}`;
        const productId = productIdByKey.get(key);
        if (!productId) return null;
        return {
          epc_data: item.epc_data,
          product_id: productId,
          sku: item.sku || null,
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
        console.error('[bulk-products] inventory upsert failed', summarizeError(inventoryUpsert.error));
        throw inventoryUpsert.error;
      }

      inventoryItemsUpserted = inventoryUpsert.data?.length || 0;
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
