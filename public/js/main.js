import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STORAGE_KEY = 'rfid_poc_supabase_config_v1';
const URL_KEY = 'supabaseUrl';
const ANON_KEY = 'supabaseAnonKey';
const STATES = ['RACK', 'FITTING_ROOM', 'CHECKOUT', 'SOLD'];

let supabase = null;
let subscription = null;

const el = {
  connectionStatus: document.getElementById('connectionStatus'),
  dashboard: document.getElementById('dashboard'),
  refreshButton: document.getElementById('refreshButton'),
  configForm: document.getElementById('configForm'),
  supabaseUrl: document.getElementById('supabaseUrl'),
  supabaseAnonKey: document.getElementById('supabaseAnonKey'),
  csvImportForm: document.getElementById('csvImportForm'),
  csvFile: document.getElementById('csvFile'),
  importResult: document.getElementById('importResult'),
  simulateForm: document.getElementById('simulateForm'),
  simulateResult: document.getElementById('simulateResult'),
  eventLog: document.getElementById('eventLog')
};

console.log('[boot] main.js loaded');

function setStatus(text, level = 'warn') {
  if (!el.connectionStatus) {
    console.error('[dom] #connectionStatus not found');
    return;
  }
  el.connectionStatus.textContent = text;
  el.connectionStatus.classList.remove('text-ok', 'text-warn', 'text-err');
  el.connectionStatus.classList.add(`text-${level}`);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function parseApiResponse(response, tag) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  console.log(`[api:${tag}] response`, {
    status: response.status,
    statusText: response.statusText,
    contentType,
    rawPreview: rawText.slice(0, 300)
  });

  if (!rawText) {
    return { data: null, contentType, rawText };
  }

  try {
    const data = JSON.parse(rawText);
    return { data, contentType, rawText };
  } catch (error) {
    console.error(`[api:${tag}] JSON parse failed`, error);
    throw new Error(`伺服器回應不是 JSON（HTTP ${response.status}）`);
  }
}

function decodeSGTIN96(hex) {
  const normalized = String(hex || '').trim();
  if (!/^[a-fA-F0-9]{24}$/.test(normalized)) {
    throw new Error('EPC 必須為 24 碼 Hex 字串');
  }

  const binary = BigInt(`0x${normalized}`).toString(2).padStart(96, '0');
  const companyPrefixBin = binary.substring(14, 38);
  const itemReferenceBin = binary.substring(38, 58);
  const serialBin = binary.substring(58, 96);

  return {
    companyPrefix: parseInt(companyPrefixBin, 2).toString(),
    itemReference: parseInt(itemReferenceBin, 2).toString(),
    serial: BigInt(`0b${serialBin}`).toString()
  };
}

function csvToRows(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV 至少需包含表頭與一筆資料');
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line, index) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    row.__line = index + 2;
    return row;
  });
}

function normalizeStateByReader(readerId) {
  const id = String(readerId || '').toUpperCase();
  if (id.includes('FITTING')) return 'FITTING_ROOM';
  if (id.includes('CHECKOUT')) return 'CHECKOUT';
  if (id.includes('SOLD')) return 'SOLD';
  if (id.includes('RACK')) return 'RACK';
  return 'RACK';
}

function buildLatestStateMap(events = []) {
  const map = new Map();
  events.forEach((event) => {
    const key = event.epc_data;
    const current = map.get(key);
    if (!current || new Date(event.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      map.set(key, event);
    }
  });
  return map;
}

function renderDashboard(products, latestEventMap) {
  const grouped = Object.fromEntries(STATES.map((s) => [s, []]));

  products.forEach((product) => {
    const event = latestEventMap.get(product.epc_data);
    const state = event ? normalizeStateByReader(event.reader_id) : 'RACK';
    grouped[state].push({ product, event });
  });

  el.dashboard.innerHTML = STATES.map((state) => {
    const cards = grouped[state]
      .map(({ product, event }) => {
        const decoded = product.epc_data ? safeDecode(product.epc_data) : null;
        return `
          <article class="product-card">
            <p><strong>${escapeHtml(product.name || '未命名商品')}</strong></p>
            <p>SKU: ${escapeHtml(product.sku || '-')}</p>
            <p>EPC: ${escapeHtml(product.epc_data || '-')}</p>
            <p>GTIN片段: ${decoded ? `${decoded.companyPrefix}-${decoded.itemReference}` : '-'}</p>
            <p>價格: ${escapeHtml(product.price ?? '-')}</p>
            <p>最後 Reader: ${escapeHtml(event?.reader_id || '-')}</p>
          </article>
        `;
      })
      .join('');

    return `
      <section class="state-column">
        <h3 class="state-title">${state} (${grouped[state].length})</h3>
        ${cards || '<p class="hint">無資料</p>'}
      </section>
    `;
  }).join('');
}

function safeDecode(epc) {
  try {
    return decodeSGTIN96(epc);
  } catch {
    return null;
  }
}

function appendEventLog(payload) {
  if (!el.eventLog) {
    console.error('[dom] #eventLog not found, skip appendEventLog');
    return;
  }
  const li = document.createElement('li');
  li.innerHTML = `
    <div><strong>${escapeHtml(payload.reader_id || 'UNKNOWN_READER')}</strong></div>
    <div>EPC: ${escapeHtml(payload.epc_data || '-')}</div>
    <div>時間: ${escapeHtml(payload.timestamp || new Date().toISOString())}</div>
  `;
  el.eventLog.prepend(li);
  while (el.eventLog.children.length > 20) {
    el.eventLog.removeChild(el.eventLog.lastElementChild);
  }
}

async function fetchAndRenderDashboard() {
  if (!supabase) {
    setStatus('尚未連線 Supabase', 'warn');
    console.warn('[dashboard] supabase client not ready');
    return;
  }

  if (!el.dashboard) {
    console.error('[dom] #dashboard not found, skip render');
    return;
  }

  setStatus('讀取資料中…', 'warn');
  console.log('[dashboard] start fetching products + rfid_events');

  const [productsRes, eventsRes] = await Promise.all([
    supabase.from('products').select('*').order('id', { ascending: true }),
    supabase.from('rfid_events').select('epc_data,reader_id,timestamp').order('timestamp', { ascending: false }).limit(500)
  ]);

  if (productsRes.error) {
    console.error('[dashboard] products query failed:', productsRes.error);
    throw productsRes.error;
  }
  if (eventsRes.error) {
    console.error('[dashboard] rfid_events query failed:', eventsRes.error);
    throw eventsRes.error;
  }

  const latestMap = buildLatestStateMap(eventsRes.data || []);
  renderDashboard(productsRes.data || [], latestMap);
  console.log('[dashboard] render success', {
    products: (productsRes.data || []).length,
    events: (eventsRes.data || []).length
  });
  setStatus('連線正常', 'ok');
}

// backward compatibility for existing call sites
const loadDashboardData = fetchAndRenderDashboard;

async function connectSupabase(url, anonKey) {
  if (subscription) {
    await subscription.unsubscribe();
    subscription = null;
  }

  supabase = createClient(url, anonKey);

  subscription = supabase
    .channel('rfid-events-insert')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rfid_events' }, async (payload) => {
      console.log('[realtime] INSERT rfid_events', { epc_data: payload?.new?.epc_data, payload });
      appendEventLog(payload.new);
      try {
        await fetchAndRenderDashboard();
      } catch (error) {
        setStatus(`Realtime 更新失敗: ${error.message}`, 'err');
      }
    })
    .subscribe((status) => {
      console.log('[realtime] channel status:', status);
      if (status === 'SUBSCRIBED') {
        setStatus('Realtime 已訂閱', 'ok');
      }
    });

  await fetchAndRenderDashboard();
}

async function handleConfigSubmit(event) {
  event.preventDefault();

  const url = el.supabaseUrl.value.trim();
  const anonKey = el.supabaseAnonKey.value.trim();

  try {
    localStorage.setItem(URL_KEY, url);
    localStorage.setItem(ANON_KEY, anonKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, anonKey }));
    await connectSupabase(url, anonKey);
  } catch (error) {
    setStatus(`連線失敗: ${error.message}`, 'err');
  }
}

async function handleCsvImport(event) {
  event.preventDefault();
  const file = el.csvFile.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rows = csvToRows(text);
    const badRows = rows.filter((row) => !row.epc_data || !/^[a-fA-F0-9]{24}$/.test(row.epc_data));
    if (badRows.length > 0) {
      throw new Error(`發現 ${badRows.length} 筆 EPC 格式不正確，請修正後再導入`);
    }

    console.log('[csv] start import', {
      rowsCount: rows.length,
      firstRow: rows[0] || null
    });

    const response = await fetch('/api/bulk-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    });

    const { data: result } = await parseApiResponse(response, 'bulk-products');
    if (!response.ok) {
      throw new Error(result?.error || '批量導入失敗');
    }
    if (!result) {
      throw new Error('批量導入失敗：伺服器回傳空內容');
    }

    el.importResult.textContent = JSON.stringify(result, null, 2);
    await fetchAndRenderDashboard();
  } catch (error) {
    el.importResult.textContent = `導入失敗：${error.message}`;
  }
}

async function handleSimulateSubmit(event) {
  event.preventDefault();
  const readerId = el.simulateForm.reader_id.value.trim();
  const epcData = el.simulateForm.epc_data.value.trim();

  try {
    console.log('[simulate] send webhook', { readerId, epcData });

    const response = await fetch('/api/rfid-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reader_id: readerId, epc_data: epcData })
    });

    const { data: result } = await parseApiResponse(response, 'rfid-webhook');
    if (!response.ok) {
      throw new Error(result?.error || '事件送出失敗');
    }
    if (!result) {
      throw new Error('事件送出失敗：伺服器回傳空內容');
    }

    el.simulateResult.textContent = JSON.stringify(result, null, 2);
    appendEventLog({ reader_id: readerId, epc_data: epcData, timestamp: new Date().toISOString() });
    await fetchAndRenderDashboard();
  } catch (error) {
    el.simulateResult.textContent = `送出失敗：${error.message}`;
  }
}

function boot() {
  console.log('[dom-check]', {
    dashboard: !!el.dashboard,
    eventLog: !!el.eventLog,
    connectionStatus: !!el.connectionStatus
  });

  if (!el.dashboard || !el.eventLog || !el.connectionStatus) {
    console.error('[dom-check] required elements missing, abort boot');
    return;
  }

  el.configForm.addEventListener('submit', handleConfigSubmit);
  el.csvImportForm.addEventListener('submit', handleCsvImport);
  el.simulateForm.addEventListener('submit', handleSimulateSubmit);
  el.refreshButton.addEventListener('click', async () => {
    try {
      await fetchAndRenderDashboard();
    } catch (error) {
      setStatus(`刷新失敗: ${error.message}`, 'err');
    }
  });

  // preferred: read explicit keys from localStorage
  let url = localStorage.getItem(URL_KEY) || '';
  let anonKey = localStorage.getItem(ANON_KEY) || '';

  // fallback for old storage schema
  if (!url || !anonKey) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        url = url || parsed?.url || '';
        anonKey = anonKey || parsed?.anonKey || '';
      } catch {
        console.warn('[storage] malformed STORAGE_KEY payload');
      }
    }
  }

  el.supabaseUrl.value = url;
  el.supabaseAnonKey.value = anonKey;

  if (url && anonKey) {
    connectSupabase(url, anonKey).catch((error) => {
      setStatus(`自動連線失敗: ${error.message}`, 'err');
    });
    return;
  }

  setStatus('請先輸入 Supabase 連線設定', 'warn');
}

boot();
