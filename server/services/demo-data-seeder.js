import { getSupabaseAdminClient } from '../supabase.js';

const EVENT_STATES = ['FITTING_ROOM', 'CHECKOUT', 'SOLD', 'ACTIVE'];

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromDate(dateText) {
  const raw = String(dateText || '').replaceAll('-', '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 20260511;
}

function weightedPick(rand, weights) {
  const total = weights.reduce((acc, item) => acc + item.weight, 0);
  const hit = rand() * total;
  let cursor = 0;
  for (const item of weights) {
    cursor += item.weight;
    if (hit <= cursor) return item.value;
  }
  return weights[weights.length - 1]?.value;
}

function buildEventPayloadByState(state) {
  if (state === 'FITTING_ROOM') {
    return {
      event_type: 'enter_fitting_room',
      reader_id: 'FITTING_ROOM_ANTENNA_1',
      from_zone: 'sales_floor',
      to_zone: 'fitting_room',
      status: 'FITTING_ROOM'
    };
  }
  if (state === 'CHECKOUT') {
    return {
      event_type: 'move_to_checkout',
      reader_id: 'CHECKOUT_ANTENNA_1',
      from_zone: 'fitting_room',
      to_zone: 'checkout',
      status: 'CHECKOUT'
    };
  }
  if (state === 'SOLD') {
    return {
      event_type: 'sale_completed',
      reader_id: 'SOLD_ANTENNA_1',
      from_zone: 'checkout',
      to_zone: 'sold',
      status: 'SOLD'
    };
  }
  return {
    event_type: 'left_fitting_room',
    reader_id: 'RACK_ANTENNA_1',
    from_zone: 'fitting_room',
    to_zone: 'sales_floor',
    status: 'ACTIVE'
  };
}

function uniqueByInventoryId(rows = []) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(row?.inventory_id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function fetchCandidates(supabase, limit = 40) {
  const productRes = await supabase
    .from('products')
    .select('id,epc_company_prefix,item_reference,sku,name,name_en')
    .not('epc_company_prefix', 'is', null)
    .not('item_reference', 'is', null)
    .order('id', { ascending: true })
    .limit(limit);

  if (productRes.error) throw productRes.error;
  const productRows = productRes.data || [];
  if (!productRows.length) return [];

  const productIds = productRows.map((p) => p.id).filter((v) => v != null);
  const inventoryRes = await supabase
    .from('inventory_items')
    .select('id,product_id,epc_data,sku,status')
    .in('product_id', productIds)
    .not('epc_data', 'is', null)
    .order('id', { ascending: true })
    .limit(limit * 3);

  if (inventoryRes.error) throw inventoryRes.error;

  const byProduct = new Map(productRows.map((p) => [p.id, p]));
  return (inventoryRes.data || [])
    .map((inv) => {
      const p = byProduct.get(inv.product_id);
      if (!p) return null;
      return {
        inventory_id: inv.id,
        product_id: inv.product_id,
        epc_data: String(inv.epc_data || '').trim(),
        sku: String(inv.sku || p.sku || '').trim() || null,
        product_key: `${p.epc_company_prefix}::${p.item_reference}`,
        epc_company_prefix: p.epc_company_prefix,
        item_reference: p.item_reference,
        name: p.name || p.name_en || 'Unnamed Product'
      };
    })
    .filter((row) => row && /^[A-Fa-f0-9]{24}$/.test(row.epc_data));
}

export async function seedDailyDemoData({
  targetDate,
  timezone = 'Asia/Shanghai',
  force = false,
  triggerSource = 'manual',
  actorUserId = null
} = {}) {
  const supabase = getSupabaseAdminClient();
  const dateObj = targetDate ? new Date(targetDate) : new Date();
  const dateText = Number.isNaN(dateObj.getTime())
    ? new Date().toISOString().slice(0, 10)
    : dateObj.toISOString().slice(0, 10);

  const seedTag = 'daily_demo_v1';
  const rng = mulberry32(seedFromDate(dateText));
  const plannedCount = 3 + Math.floor(rng() * 5); // 3..7

  const existingRes = await supabase
    .from('demo_seed_runs')
    .select('id,status')
    .eq('seed_date', dateText)
    .eq('seed_tag', seedTag)
    .eq('status', 'success')
    .limit(1)
    .maybeSingle();

  if (!force && !existingRes.error && existingRes.data?.id) {
    return {
      ok: true,
      skipped: true,
      skipped_reason: 'already_seeded',
      target_date: dateText,
      timezone,
      seed_tag: seedTag,
      run_id: existingRes.data.id,
      planned_count: plannedCount,
      generated_count: 0
    };
  }

  const runRes = await supabase
    .from('demo_seed_runs')
    .insert({
      seed_date: dateText,
      seed_tag: seedTag,
      trigger_source: triggerSource,
      status: 'running',
      started_at: new Date().toISOString(),
      created_by: actorUserId
    })
    .select('id')
    .single();
  if (runRes.error) throw runRes.error;
  const runId = runRes.data.id;

  try {
    const candidates = uniqueByInventoryId(await fetchCandidates(supabase, 64));
    if (candidates.length < 3) {
      throw new Error('Not enough inventory candidates for daily seed (need >= 3)');
    }

    // deterministic shuffle
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const picked = candidates.slice(0, Math.min(plannedCount, candidates.length));

    const states = picked.map(() => weightedPick(rng, [
      { value: 'FITTING_ROOM', weight: 40 },
      { value: 'CHECKOUT', weight: 20 },
      { value: 'SOLD', weight: 20 },
      { value: 'ACTIVE', weight: 20 }
    ]));
    if (!states.includes('FITTING_ROOM')) states[0] = 'FITTING_ROOM';
    if (states.length >= 4 && !states.some((s) => s === 'CHECKOUT' || s === 'SOLD')) states[1] = 'CHECKOUT';

    const now = Date.now();
    const events = [];
    const inventoryUpdates = [];
    const presenceRows = [];
    const sessionRows = [];

    for (let i = 0; i < picked.length; i += 1) {
      const item = picked[i];
      const state = states[i] || EVENT_STATES[i % EVENT_STATES.length];
      const eventDef = buildEventPayloadByState(state);
      const ts = new Date(now - (i + 1) * 60_000).toISOString();

      events.push({
        epc_data: item.epc_data,
        reader_id: eventDef.reader_id,
        timestamp: ts,
        state: 'detected',
        event_type: eventDef.event_type,
        event_source: 'system',
        from_zone: eventDef.from_zone,
        to_zone: eventDef.to_zone,
        metadata: {
          seed_tag: seedTag,
          seed_date: dateText,
          run_id: runId,
          timezone,
          generated_by: triggerSource,
          random_slot: i + 1
        }
      });

      inventoryUpdates.push({
        id: item.inventory_id,
        status: eventDef.status,
        updated_at: ts
      });

      if (state === 'FITTING_ROOM') {
        presenceRows.push({
          product_key: item.product_key,
          epc_company_prefix: item.epc_company_prefix,
          item_reference: item.item_reference,
          entered_at: new Date(now - (i + 1) * 8 * 60_000).toISOString(),
          last_seen_at: ts,
          last_reader_id: eventDef.reader_id
        });
        sessionRows.push({
          product_key: item.product_key,
          epc_company_prefix: item.epc_company_prefix,
          item_reference: item.item_reference,
          sku: item.sku,
          entered_at: new Date(now - (i + 1) * 8 * 60_000).toISOString(),
          left_at: null,
          converted_to_sale: false,
          duration_seconds: null
        });
      } else {
        const entered = new Date(now - (i + 3) * 12 * 60_000).toISOString();
        const left = new Date(now - (i + 1) * 8 * 60_000).toISOString();
        sessionRows.push({
          product_key: item.product_key,
          epc_company_prefix: item.epc_company_prefix,
          item_reference: item.item_reference,
          sku: item.sku,
          entered_at: entered,
          left_at: left,
          converted_to_sale: state === 'SOLD',
          sale_time: state === 'SOLD' ? ts : null,
          duration_seconds: Math.max(60, Math.floor((Date.parse(left) - Date.parse(entered)) / 1000))
        });
      }
    }

    await supabase
      .from('rfid_events')
      .delete()
      .eq('event_source', 'system')
      .gte('timestamp', `${dateText}T00:00:00.000Z`)
      .lt('timestamp', `${dateText}T23:59:59.999Z`);

    if (events.length) {
      const insertEventsRes = await supabase.from('rfid_events').insert(events);
      if (insertEventsRes.error) throw insertEventsRes.error;
    }

    if (presenceRows.length) {
      const presenceRes = await supabase
        .from('fitting_room_presence')
        .upsert(presenceRows, { onConflict: 'product_key' });
      if (presenceRes.error && String(presenceRes.error.code || '') !== '42703') throw presenceRes.error;
    }

    if (sessionRows.length) {
      const sessionRes = await supabase.from('fitting_room_sessions').insert(sessionRows);
      if (sessionRes.error && String(sessionRes.error.code || '') !== '42703') throw sessionRes.error;
    }

    for (const row of inventoryUpdates) {
      await supabase.from('inventory_items').update({ status: row.status, updated_at: row.updated_at }).eq('id', row.id);
    }

    const counts = {
      planned_count: plannedCount,
      generated_count: events.length,
      inserted_events_count: events.length,
      upserted_presence_count: presenceRows.length,
      inserted_sessions_count: sessionRows.length,
      updated_inventory_count: inventoryUpdates.length
    };

    await supabase
      .from('demo_seed_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        counts
      })
      .eq('id', runId);

    return {
      ok: true,
      skipped: false,
      target_date: dateText,
      timezone,
      seed_tag: seedTag,
      run_id: runId,
      ...counts
    };
  } catch (error) {
    await supabase
      .from('demo_seed_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error?.message || String(error)
      })
      .eq('id', runId);
    throw error;
  }
}

