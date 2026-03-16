import { createClient } from '@supabase/supabase-js';

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
  const productName = String(row.product_name || '').trim();
  const sku = String(row.sku || '').trim();
  const size = String(row.size || '').trim();
  const color = String(row.color || '').trim();
  const imageUrl = String(row.image_url || '').trim();
  const price = row.price === '' || row.price == null ? null : Number(row.price);

  if (!/^[a-fA-F0-9]{24}$/.test(epcData)) {
    throw new Error('epc_data 必須為 24 碼 Hex 字串');
  }

  if (!productName) {
    throw new Error('product_name 不可為空');
  }

  if (price != null && Number.isNaN(price)) {
    throw new Error('price 必須為數字');
  }

  const decoded = decodeSGTIN96(epcData);

  return {
    epc_data: epcData,
    epc_company_prefix: decoded.companyPrefix,
    item_reference: decoded.itemReference,
    name: productName,
    sku: sku || null,
    size: size || null,
    color: color || null,
    image_url: imageUrl || null,
    price
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({ error: 'rows 不可為空' });
    }

    const normalized = rows.map((row, index) => {
      try {
        return normalizeRow(row);
      } catch (error) {
        throw new Error(`第 ${index + 1} 筆資料錯誤：${error.message}`);
      }
    });

    let operationMode = 'upsert_epc_data';
    let data = null;

    const firstTry = await supabase
      .from('products')
      .upsert(normalized, { onConflict: 'epc_data' })
      .select('id, name, epc_data, epc_company_prefix, item_reference');

    if (!firstTry.error) {
      data = firstTry.data;
    } else {
      const fallbackRows = normalized.map((item) => ({
        epc_company_prefix: item.epc_company_prefix,
        item_reference: item.item_reference,
        name: item.name,
        image_url: item.image_url,
        price: item.price
      }));

      const secondTry = await supabase
        .from('products')
        .upsert(fallbackRows, { onConflict: 'epc_company_prefix,item_reference' })
        .select('id, name, epc_company_prefix, item_reference');

      if (!secondTry.error) {
        operationMode = 'upsert_prefix_item';
        data = secondTry.data;
      } else {
        const thirdTry = await supabase
          .from('products')
          .insert(fallbackRows)
          .select('id, name, epc_company_prefix, item_reference');

        if (thirdTry.error) {
          throw thirdTry.error;
        }

        operationMode = 'insert_prefix_item';
        data = thirdTry.data;
      }
    }

    return res.status(200).json({
      status: 'success',
      message: `已處理 ${normalized.length} 筆資料`,
      mode: operationMode,
      affected: data?.length || 0,
      items: data || []
    });
  } catch (error) {
    console.error('Bulk Products Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
