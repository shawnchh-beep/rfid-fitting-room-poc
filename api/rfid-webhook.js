import { createClient } from '@supabase/supabase-js';
import { decodeSGTIN96 } from './sgtin96.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 使用 Service Role 以繞過 RLS 或執行複雜查詢
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { epc_data, reader_id } = req.body;

  try {
    // 1. 解碼 EPC
    const { companyPrefix, itemReference } = decodeSGTIN96(epc_data);

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
      return res.status(200).json({ status: 'ignored', reason: 'debounced' });
    }

    // 3. 寫入資料庫
    const { error: insertError } = await supabase
      .from('rfid_events')
      .insert([
        { 
          epc_data, 
          reader_id, 
          state: 'detected',
          timestamp: new Date().toISOString()
        }
      ]);

    if (insertError) throw insertError;

    return res.status(200).json({ 
      status: 'success', 
      product: { companyPrefix, itemReference } 
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
