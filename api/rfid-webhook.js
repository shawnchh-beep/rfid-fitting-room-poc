import { createClient } from '@supabase/supabase-js';
import { decodeSGTIN96 } from '../server/sgtin96.js';
import { authorizeWebhook } from '../server/auth.js';

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
  const normalizedBodyEventType = (() => {
    const raw = String(bodyEventType || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'item_entered_fitting_room' || raw === 'item_added_to_session' || raw === 'enter_room') return 'enter_fitting_room';
    if (raw === 'item_left_fitting_room' || raw === 'item_returned_to_floor' || raw === 'exit_room') return 'left_fitting_room';
    if (raw === 'item_moved_to_checkout' || raw === 'direct_sale') return 'sale_completed';
    return raw;
  })();

  const inferredToZone = bodyToZone || zoneFromReader(readerId);
  const inferredFromZone = bodyFromZone || null;
  const normalizedEventSource = (() => {
    const raw = String(bodyEventSource || '').trim().toLowerCase();
    if (!raw) return 'simulator';
    if (raw === 'fitting_demo_drag') return 'demo_drag';
    if (['demo_drag', 'simulator', 'rfid_reader', 'system'].includes(raw)) return raw;
    return raw;
  })();

  const inferredEventType = normalizedBodyEventType || (() => {
    if (inferredToZone === 'fitting_room') return 'enter_fitting_room';
    if (inferredToZone === 'checkout') return 'move_to_checkout';
    if (inferredToZone === 'sold') return 'sale_completed';
    if (inferredToZone === 'sales_floor') return 'return_to_sales_floor';
    return 'tag_seen';
  })();

  return {
    eventType: inferredEventType,
    eventSource: normalizedEventSource,
    fromZone: inferredFromZone,
    toZone: inferredToZone
  };
}

function isMissingInventoryTable(error) {
  return error?.code === '42P01';
}

function isMissingInventoryColumns(error) {
  return error?.code === '42703';
}

function resolveInventoryStatusByEvent(eventType, toZone) {
  const type = String(eventType || '').trim().toLowerCase();
  const zone = String(toZone || '').trim().toLowerCase();

  if (type === 'sale_completed' || zone === 'sold') return 'SOLD';
  if (type === 'move_to_checkout' || zone === 'checkout') return 'CHECKOUT';
  if (type === 'enter_fitting_room' || zone === 'fitting_room') return 'FITTING_ROOM';
  if (type === 'left_fitting_room' || type === 'return_to_sales_floor' || zone === 'sales_floor') return 'ACTIVE';
  return null;
}

async function updateInventoryStatusByEpc({ epcData, status, eventType, readerId, fromZone, toZone, nowIso }) {
  if (!epcData || !status) {
    return { updated: false, skipped: true, reason: 'missing_epc_or_status', data: null, error: null };
  }

  const updateRes = await supabase
    .from('inventory_items')
    .update({
      status,
      updated_at: nowIso
    })
    .eq('epc_data', epcData)
    .select('id,epc_data,product_id,sku,style_no,item_no,status')
    .limit(1);

  if (updateRes.error) {
    if (isMissingInventoryTable(updateRes.error) || isMissingInventoryColumns(updateRes.error)) {
      return {
        updated: false,
        skipped: true,
        reason: 'inventory_schema_not_ready',
        data: null,
        error: null
      };
    }
    return { updated: false, skipped: false, reason: 'update_failed', data: null, error: updateRes.error };
  }

  const row = Array.isArray(updateRes.data) ? updateRes.data[0] : null;
  if (!row) {
    return { updated: false, skipped: true, reason: 'inventory_item_not_found', data: null, error: null };
  }

  const eventLogInsert = await insertRfidEventCompat({
    epc_data: epcData,
    reader_id: readerId,
    state: 'status_synced',
    timestamp: nowIso,
    event_type: 'inventory_status_updated',
    event_source: 'rfid_webhook',
    from_zone: fromZone || null,
    to_zone: toZone || null,
    metadata: {
      inventory_status: status,
      source_event_type: eventType,
      product_id: row.product_id || null,
      sku: row.sku || null,
      style_no: row.style_no || null,
      item_no: row.item_no || null
    }
  });

  if (eventLogInsert.error) {
    console.warn('[rfid-webhook] inventory status audit event insert failed', {
      code: eventLogInsert.error?.code,
      message: eventLogInsert.error?.message
    });
  }

  return {
    updated: true,
    skipped: false,
    reason: 'ok',
    data: row,
    error: null
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
  // 先嘗試完整鍵值（epc_company_prefix + item_reference + sku）
  const byKey = await supabase
    .from('products')
    .select('sku')
    .eq('epc_company_prefix', companyPrefix)
    .eq('item_reference', itemReference)
    .maybeSingle();

  if (!byKey.error) {
    return { sku: byKey.data?.sku || null, error: null };
  }

  // 欄位缺失（42703）時降級：不阻斷 webhook
  if (byKey.error?.code !== '42703') {
    return { sku: null, error: byKey.error };
  }

  // 第二層降級：若 products 尚有 epc_data，用 company/item 前綴比對
  const epcFallback = await supabase
    .from('products')
    .select('sku,epc_data')
    .limit(5000);

  if (!epcFallback.error) {
    const row = (epcFallback.data || []).find((it) => {
      const epc = String(it?.epc_data || '').trim();
      if (!/^[A-Fa-f0-9]{24}$/.test(epc)) return false;
      try {
        const decoded = decodeSGTIN96(epc);
        return decoded.companyPrefix === companyPrefix && decoded.itemReference === itemReference;
      } catch {
        return false;
      }
    });

    return { sku: row?.sku || null, error: null };
  }

  // 若連 epc_data/sku 都缺，視為可接受降級（sku=null）
  if (epcFallback.error?.code === '42703') {
    console.warn('[rfid-webhook] products schema partial, fallback sku=null');
    return { sku: null, error: null };
  }

  return { sku: null, error: epcFallback.error };
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

  const auth = await authorizeWebhook(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.errorBody || { error: auth.error });
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
    let phase = 'decode_epc';
    // 1. 解碼 EPC
    let companyPrefix;
    let itemReference;
    try {
      const decoded = decodeSGTIN96(epc_data);
      companyPrefix = decoded.companyPrefix;
      itemReference = decoded.itemReference;
    } catch (decodeError) {
      return res.status(400).json({
        error: 'Invalid EPC payload',
        debug: {
          message: decodeError?.message || String(decodeError),
          code: 'INVALID_EPC'
        }
      });
    }
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

    console.log('[rfid-webhook] envelope diagnostics', {
      epc_data: epc_data || null,
      reader_id: reader_id || null,
      event_type: event_type || null,
      from_zone: from_zone || null,
      to_zone: to_zone || null,
      normalized: eventEnvelope,
      productKey,
      isFittingReader
    });

    // 2. Debounce Check: 檢查過去 3 秒內是否有相同 Reader 讀到相同 EPC
    const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();

    phase = 'debounce_query';
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
        phase = 'debounce_presence_upsert';
        const presenceUpsert = await upsertFittingPresence({
          productKey,
          companyPrefix,
          itemReference,
          readerId: reader_id,
          nowIso
        });
        console.log('[rfid-webhook] debounce branch presence update result', {
          productKey,
          isFittingReader,
          hasError: Boolean(presenceUpsert.error),
          errorCode: presenceUpsert.error?.code || null,
          errorMessage: presenceUpsert.error?.message || null,
          isNewVisit: presenceUpsert.isNewVisit ?? null,
          previousLastSeenAt: presenceUpsert.previousLastSeenAt || null
        });
        if (presenceUpsert.error && !isMissingPresenceTable(presenceUpsert.error)) {
          throw presenceUpsert.error;
        }

        if (!presenceUpsert.error) {
          phase = 'debounce_resolve_sku';
          const { sku, error: skuError } = await resolveProductSku(companyPrefix, itemReference);
          if (skuError) throw skuError;

          if (presenceUpsert.isNewVisit) {
            if (presenceUpsert.previousLastSeenAt) {
              phase = 'debounce_close_open_session';
              const closePrev = await closeOpenSession({
                productKey,
                leftAtIso: presenceUpsert.previousLastSeenAt
              });
              if (closePrev.error && !isMissingSessionsTable(closePrev.error) && !isMissingSessionColumns(closePrev.error)) {
                throw closePrev.error;
              }
            }

            phase = 'debounce_open_session';
            const openRes = await openSession({
              productKey,
              companyPrefix,
              itemReference,
              sku,
              enteredAtIso: nowIso
            });
            if (openRes.error && !isMissingSessionsTable(openRes.error) && !isMissingSessionColumns(openRes.error)) {
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
    phase = 'insert_rfid_event';
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
      phase = 'insert_presence_upsert';
      const presenceUpsert = await upsertFittingPresence({
        productKey,
        companyPrefix,
        itemReference,
        readerId: reader_id,
        nowIso
      });
      console.log('[rfid-webhook] insert branch presence update result', {
        productKey,
        isFittingReader,
        hasError: Boolean(presenceUpsert.error),
        errorCode: presenceUpsert.error?.code || null,
        errorMessage: presenceUpsert.error?.message || null,
        isNewVisit: presenceUpsert.isNewVisit ?? null,
        previousLastSeenAt: presenceUpsert.previousLastSeenAt || null
      });
      if (presenceUpsert.error && !isMissingPresenceTable(presenceUpsert.error)) {
        console.error('[rfid-webhook] phase failure', {
          phase,
          code: presenceUpsert.error?.code || null,
          message: presenceUpsert.error?.message || null,
          details: presenceUpsert.error?.details || null,
          hint: presenceUpsert.error?.hint || null
        });
        throw presenceUpsert.error;
      }

      if (!presenceUpsert.error) {
        phase = 'insert_resolve_sku';
        const { sku, error: skuError } = await resolveProductSku(companyPrefix, itemReference);
        if (skuError) throw skuError;

        if (presenceUpsert.isNewVisit) {
          if (presenceUpsert.previousLastSeenAt) {
            phase = 'insert_close_open_session';
            const closePrev = await closeOpenSession({
              productKey,
              leftAtIso: presenceUpsert.previousLastSeenAt
            });
            if (closePrev.error && !isMissingSessionsTable(closePrev.error) && !isMissingSessionColumns(closePrev.error)) {
              throw closePrev.error;
            }
          }

          phase = 'insert_open_session';
          const openRes = await openSession({
            productKey,
            companyPrefix,
            itemReference,
            sku,
            enteredAtIso: nowIso
          });
          if (openRes.error && !isMissingSessionsTable(openRes.error) && !isMissingSessionColumns(openRes.error)) {
            throw openRes.error;
          }
        }
      }
    } else {
      phase = 'non_fitting_clear_presence';
      const presenceDelete = await clearFittingPresence(productKey);
      console.log('[rfid-webhook] non-fitting branch presence clear result', {
        productKey,
        isFittingReader,
        hasError: Boolean(presenceDelete.error),
        errorCode: presenceDelete.error?.code || null,
        errorMessage: presenceDelete.error?.message || null
      });
      if (presenceDelete.error && !isMissingPresenceTable(presenceDelete.error)) {
        console.error('[rfid-webhook] phase failure', {
          phase,
          code: presenceDelete.error?.code || null,
          message: presenceDelete.error?.message || null,
          details: presenceDelete.error?.details || null,
          hint: presenceDelete.error?.hint || null
        });
        throw presenceDelete.error;
      }

      phase = 'non_fitting_close_open_session';
      const closeRes = await closeOpenSession({ productKey, leftAtIso: nowIso });
      if (closeRes.error && !isMissingSessionsTable(closeRes.error) && !isMissingSessionColumns(closeRes.error)) {
        console.error('[rfid-webhook] phase failure', {
          phase,
          code: closeRes.error?.code || null,
          message: closeRes.error?.message || null,
          details: closeRes.error?.details || null,
          hint: closeRes.error?.hint || null
        });
        throw closeRes.error;
      }
    }

    let conversion = null;
    if (eventEnvelope.eventType === 'sale_completed') {
      phase = 'mark_session_converted';
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

    phase = 'update_inventory_status';
    const targetInventoryStatus = resolveInventoryStatusByEvent(eventEnvelope.eventType, eventEnvelope.toZone);
    const inventoryStatusUpdate = await updateInventoryStatusByEpc({
      epcData: epc_data,
      status: targetInventoryStatus,
      eventType: eventEnvelope.eventType,
      readerId: reader_id,
      fromZone: eventEnvelope.fromZone,
      toZone: eventEnvelope.toZone,
      nowIso
    });
    if (inventoryStatusUpdate.error) throw inventoryStatusUpdate.error;

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
      inventory_status: {
        target: targetInventoryStatus,
        updated: inventoryStatusUpdate.updated,
        skipped: inventoryStatusUpdate.skipped,
        reason: inventoryStatusUpdate.reason,
        row: inventoryStatusUpdate.data
      },
      conversion,
      segmentation_gap_seconds: FITTING_EXIT_TIMEOUT_MS / 1000
    });

  } catch (error) {
    console.error('Webhook Error:', {
      message: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null
    });
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
