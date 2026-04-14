import { createClient } from '@supabase/supabase-js';
import { decodeSGTIN96 } from './sgtin96.js';
import { authorizeWebhook } from './_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 使用 Service Role 以繞過 RLS 或執行複雜查詢
);

const FITTING_EXIT_TIMEOUT_MS = 30_000;
const CONVERSION_WINDOW_MS = 10 * 60 * 1000;

function buildProductKey(companyPrefix, itemReference) {
  return `${companyPrefix}::${itemReference}`;
}

function zoneFromReader(readerId) {
  const id = String(readerId || '').toUpperCase();
  if (id.includes('FITTING')) return 'fitting_room';
  if (id.includes('CHECKOUT')) return 'checkout';
  if (id.includes('SOLD')) return 'sold';
  if (id.includes('RACK')) return 'sales_floor';
  return 'sales_floor';
}

function normalizeEventEnvelope({ readerId, bodyEventType, bodyEventSource, bodyFromZone, bodyToZone }) {
  const inferredToZone = bodyToZone || zoneFromReader(readerId);
  const inferredFromZone = bodyFromZone || null;

  const inferredEventType = bodyEventType || (() => {
    if (inferredToZone === 'fitting_room') return 'enter_fitting_room';
    if (inferredToZone === 'checkout') return 'move_to_checkout';
    if (inferredToZone === 'sold') return 'sale_completed';
    if (inferredToZone === 'sales_floor') return 'return_to_sales_floor';
    return 'tag_seen';
  })();

  return {
    eventType: inferredEventType,
    eventSource: bodyEventSource || 'simulator',
    fromZone: inferredFromZone,
    toZone: inferredToZone
  };
}

async function insertRfidEventCompat(record) {
  const richInsert = await supabase
    .from('rfid_events')
    .insert([record]);

  if (!richInsert.error) {
    return { error: null, mode: 'rich' };
  }

  // 舊 schema 可能尚未建立 event_type/event_source/from_zone/to_zone/metadata
  if (richInsert.error?.code === '42703') {
    const legacyInsert = await supabase
      .from('rfid_events')
      .insert([
        {
          epc_data: record.epc_data,
          reader_id: record.reader_id,
          state: record.state,
          timestamp: record.timestamp
        }
      ]);

    if (!legacyInsert.error) {
      console.warn('[rfid-webhook] fallback to legacy rfid_events schema (missing extended columns)');
      return { error: null, mode: 'legacy_fallback' };
    }

    return { error: legacyInsert.error, mode: 'legacy_fallback' };
  }

  return { error: richInsert.error, mode: 'rich' };
}

function isMissingPresenceTable(error) {
  return error?.code === '42P01';
}

async function resolvePresenceEnteredAt(productKey, nowIso) {
  const existing = await supabase
    .from('fitting_room_presence')
    .select('entered_at,last_seen_at')
    .eq('product_key', productKey)
    .maybeSingle();

  if (existing.error) {
    return { error: existing.error, enteredAt: nowIso, isNewVisit: false, previousLastSeenAt: null };
  }

  const enteredAt = existing.data?.entered_at || nowIso;
  const lastSeenAt = existing.data?.last_seen_at || null;
  const nowMs = Date.parse(nowIso);
  const lastSeenMs = lastSeenAt ? Date.parse(lastSeenAt) : NaN;

  // 規則：
  // - 若商品已離開（超過 10 秒沒 heartbeat）後再次進入 FITTING，重設 entered_at
  // - 若連續在場（10 秒內續讀），保留 entered_at
  const shouldResetEnteredAt =
    Number.isFinite(nowMs) && Number.isFinite(lastSeenMs)
      ? nowMs - lastSeenMs > FITTING_EXIT_TIMEOUT_MS
      : false;

  return {
    error: null,
    enteredAt: shouldResetEnteredAt ? nowIso : enteredAt,
    isNewVisit: !existing.data || shouldResetEnteredAt,
    previousLastSeenAt: lastSeenAt
  };
}

async function upsertFittingPresence({ productKey, companyPrefix, itemReference, readerId, nowIso }) {
  const {
    enteredAt,
    error: enteredAtError,
    isNewVisit,
    previousLastSeenAt
  } = await resolvePresenceEnteredAt(productKey, nowIso);
  if (enteredAtError) {
    return { data: null, error: enteredAtError };
  }

  const upsertResult = await supabase
    .from('fitting_room_presence')
    .upsert(
      {
        product_key: productKey,
        epc_company_prefix: companyPrefix,
        item_reference: itemReference,
        entered_at: enteredAt,
        last_seen_at: nowIso,
        last_reader_id: readerId
      },
      { onConflict: 'product_key' }
    )
    .select('product_key, entered_at, last_seen_at, last_reader_id')
    .single();

  if (upsertResult.error) {
    return { data: null, error: upsertResult.error, isNewVisit, previousLastSeenAt };
  }

  return {
    data: upsertResult.data,
    error: null,
    isNewVisit,
    previousLastSeenAt
  };
}

async function clearFittingPresence(productKey) {
  return supabase
    .from('fitting_room_presence')
    .delete()
    .eq('product_key', productKey);
}

async function resolveProductSku(companyPrefix, itemReference) {
  const result = await supabase
    .from('products')
    .select('sku')
    .eq('epc_company_prefix', companyPrefix)
    .eq('item_reference', itemReference)
    .maybeSingle();

  // 部分環境 products 尚未建立 sku 欄位，避免整條 webhook 失敗
  if (result.error?.code === '42703') {
    console.warn('[rfid-webhook] products.sku column missing, fallback sku=null');
    return { sku: null, error: null };
  }

  if (result.error) return { sku: null, error: result.error };
  return { sku: result.data?.sku || null, error: null };
}

function isMissingSessionsTable(error) {
  return error?.code === '42P01';
}

function isMissingSessionColumns(error) {
  return error?.code === '42703';
}

async function closeOpenSession({ productKey, leftAtIso }) {
  const activeRes = await supabase
    .from('fitting_room_sessions')
    .select('id, entered_at')
    .eq('product_key', productKey)
    .is('left_at', null)
    .order('entered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeRes.error) return { error: activeRes.error };
  if (!activeRes.data?.id) return { error: null };

  const enteredMs = Date.parse(activeRes.data.entered_at);
  const leftMs = Date.parse(leftAtIso);
  const durationSeconds = Number.isFinite(enteredMs) && Number.isFinite(leftMs)
    ? Math.max(0, Math.floor((leftMs - enteredMs) / 1000))
    : null;

  const updateRes = await supabase
    .from('fitting_room_sessions')
    .update({ left_at: leftAtIso, duration_seconds: durationSeconds })
    .eq('id', activeRes.data.id);

  return { error: updateRes.error || null };
}

async function openSession({ productKey, companyPrefix, itemReference, sku, enteredAtIso }) {
  return supabase
    .from('fitting_room_sessions')
    .insert({
      product_key: productKey,
      epc_company_prefix: companyPrefix,
      item_reference: itemReference,
      sku,
      entered_at: enteredAtIso,
      left_at: null,
      duration_seconds: null
    });
}

async function markSessionConvertedWithinWindow({ productKey, saleTimeIso }) {
  const sessionRes = await supabase
    .from('fitting_room_sessions')
    .select('id,entered_at,left_at,converted_to_sale')
    .eq('product_key', productKey)
    .order('entered_at', { ascending: false })
    .limit(10);

  if (sessionRes.error) {
    if (isMissingSessionsTable(sessionRes.error) || isMissingSessionColumns(sessionRes.error)) {
      return { converted: false, skipped: true, reason: 'schema_not_ready', error: null };
    }
    return { converted: false, skipped: false, reason: 'query_failed', error: sessionRes.error };
  }

  const saleMs = Date.parse(saleTimeIso);
  if (!Number.isFinite(saleMs)) {
    return { converted: false, skipped: true, reason: 'invalid_sale_time', error: null };
  }

  const candidate = (sessionRes.data || []).find((row) => {
    if (row?.converted_to_sale) return false;
    const endedAt = row?.left_at || null;
    if (!endedAt) return false;
    const endedMs = Date.parse(endedAt);
    if (!Number.isFinite(endedMs)) return false;
    const delta = saleMs - endedMs;
    return delta >= 0 && delta <= CONVERSION_WINDOW_MS;
  });

  if (!candidate?.id) {
    return { converted: false, skipped: true, reason: 'no_session_in_window', error: null };
  }

  const updateRes = await supabase
    .from('fitting_room_sessions')
    .update({
      converted_to_sale: true,
      sale_time: saleTimeIso
    })
    .eq('id', candidate.id);

  if (updateRes.error) {
    if (isMissingSessionColumns(updateRes.error)) {
      return { converted: false, skipped: true, reason: 'schema_not_ready', error: null };
    }
    return { converted: false, skipped: false, reason: 'update_failed', error: updateRes.error };
  }

  return { converted: true, skipped: false, reason: 'ok', error: null, sessionId: candidate.id };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const auth = authorizeWebhook(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const {
    epc_data,
    reader_id,
    event_type,
    event_source,
    from_zone,
    to_zone
  } = req.body || {};

  try {
    // 1. 解碼 EPC
    const { companyPrefix, itemReference } = decodeSGTIN96(epc_data);
    const productKey = buildProductKey(companyPrefix, itemReference);
    const nowIso = new Date().toISOString();
    const isFittingReader = String(reader_id || '').toUpperCase().includes('FITTING');
    const eventEnvelope = normalizeEventEnvelope({
      readerId: reader_id,
      bodyEventType: event_type,
      bodyEventSource: event_source,
      bodyFromZone: from_zone,
      bodyToZone: to_zone
    });

    // 2. Debounce Check: 檢查過去 3 秒內是否有相同 Reader 讀到相同 EPC
    const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();

    const { data: existingEvents, error: queryError } = await supabase
      .from('rfid_events')
      .select('id')
      .eq('epc_data', epc_data)
      .eq('reader_id', reader_id)
      .gt('timestamp', threeSecondsAgo);

    if (queryError) throw queryError;

    // 如果 3 秒內已存在，則跳過不寫入
    if (existingEvents && existingEvents.length > 0) {
      // 仍需更新試衣間 heartbeat，避免持續讀取時因 debounce 造成 10 秒誤判離場
      if (isFittingReader) {
        const presenceUpsert = await upsertFittingPresence({
          productKey,
          companyPrefix,
          itemReference,
          readerId: reader_id,
          nowIso
        });
        if (presenceUpsert.error && !isMissingPresenceTable(presenceUpsert.error)) {
          throw presenceUpsert.error;
        }

        if (!presenceUpsert.error) {
          const { sku, error: skuError } = await resolveProductSku(companyPrefix, itemReference);
          if (skuError) throw skuError;

          if (presenceUpsert.isNewVisit) {
            if (presenceUpsert.previousLastSeenAt) {
              const closePrev = await closeOpenSession({
                productKey,
                leftAtIso: presenceUpsert.previousLastSeenAt
              });
              if (closePrev.error && !isMissingSessionsTable(closePrev.error)) {
                throw closePrev.error;
              }
            }

            const openRes = await openSession({
              productKey,
              companyPrefix,
              itemReference,
              sku,
              enteredAtIso: nowIso
            });
            if (openRes.error && !isMissingSessionsTable(openRes.error)) {
              throw openRes.error;
            }
          }
        }
      }

      return res.status(200).json({
        status: 'ignored',
        reason: 'debounced',
        presence_heartbeat_updated: isFittingReader,
        segmentation_gap_seconds: FITTING_EXIT_TIMEOUT_MS / 1000
      });
    }

    // 3. 寫入資料庫
    const insertResult = await insertRfidEventCompat({
      epc_data,
      reader_id,
      state: 'detected',
      timestamp: nowIso,
      event_type: eventEnvelope.eventType,
      event_source: eventEnvelope.eventSource,
      from_zone: eventEnvelope.fromZone,
      to_zone: eventEnvelope.toZone,
      metadata: {
        product_key: productKey,
        segmentation_gap_seconds: FITTING_EXIT_TIMEOUT_MS / 1000,
        actor_role: auth.role,
        auth_mode: auth.mode
      }
    });

    if (insertResult.error) throw insertResult.error;

    // 4. 更新試衣間在場快照
    if (isFittingReader) {
      const presenceUpsert = await upsertFittingPresence({
        productKey,
        companyPrefix,
        itemReference,
        readerId: reader_id,
        nowIso
      });
      if (presenceUpsert.error && !isMissingPresenceTable(presenceUpsert.error)) {
        throw presenceUpsert.error;
      }

      if (!presenceUpsert.error) {
        const { sku, error: skuError } = await resolveProductSku(companyPrefix, itemReference);
        if (skuError) throw skuError;

        if (presenceUpsert.isNewVisit) {
          if (presenceUpsert.previousLastSeenAt) {
            const closePrev = await closeOpenSession({
              productKey,
              leftAtIso: presenceUpsert.previousLastSeenAt
            });
            if (closePrev.error && !isMissingSessionsTable(closePrev.error)) {
              throw closePrev.error;
            }
          }

          const openRes = await openSession({
            productKey,
            companyPrefix,
            itemReference,
            sku,
            enteredAtIso: nowIso
          });
          if (openRes.error && !isMissingSessionsTable(openRes.error)) {
            throw openRes.error;
          }
        }
      }
    } else {
      const presenceDelete = await clearFittingPresence(productKey);
      if (presenceDelete.error && !isMissingPresenceTable(presenceDelete.error)) {
        throw presenceDelete.error;
      }

      const closeRes = await closeOpenSession({ productKey, leftAtIso: nowIso });
      if (closeRes.error && !isMissingSessionsTable(closeRes.error)) {
        throw closeRes.error;
      }
    }

    let conversion = null;
    if (eventEnvelope.eventType === 'sale_completed') {
      const convertedRes = await markSessionConvertedWithinWindow({
        productKey,
        saleTimeIso: nowIso
      });
      if (convertedRes.error) throw convertedRes.error;
      conversion = {
        converted: convertedRes.converted,
        skipped: convertedRes.skipped,
        reason: convertedRes.reason,
        window_minutes: CONVERSION_WINDOW_MS / 1000 / 60,
        session_id: convertedRes.sessionId || null
      };
    }

    return res.status(200).json({
      status: 'success',
      product: { companyPrefix, itemReference },
      event: {
        event_type: eventEnvelope.eventType,
        event_source: eventEnvelope.eventSource,
        from_zone: eventEnvelope.fromZone,
        to_zone: eventEnvelope.toZone,
        write_mode: insertResult.mode
      },
      presence: {
        product_key: productKey,
        in_fitting_room: isFittingReader
      },
      conversion,
      segmentation_gap_seconds: FITTING_EXIT_TIMEOUT_MS / 1000
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
