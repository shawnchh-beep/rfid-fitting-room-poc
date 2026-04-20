import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let client = null;

export function getSupabaseClient() {
  return client;
}

export function createSupabaseClient(url, anonKey, accessToken = null) {
  client = createClient(url, anonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    }
  });
  return client;
}

export function resetSupabaseClient() {
  client = null;
}

