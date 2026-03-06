import { get, set, del, keys } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

export interface QueueItem {
  id: string;
  action: 'create_preop_inicio' | 'create_preop_cierre';
  payload: { record: any; items?: any[] };
  createdAt: string;
  retries: number;
}

const QUEUE_PREFIX = 'offline_queue_';

export async function addToOfflineQueue(item: QueueItem) {
  await set(`${QUEUE_PREFIX}${item.id}`, item);
}

export async function processOfflineQueue(): Promise<number> {
  const allKeys = await keys();
  const queueKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(QUEUE_PREFIX)
  );

  let synced = 0;

  for (const key of queueKeys) {
    const item: QueueItem = await get(key);
    if (!item || item.retries >= 3) {
      await del(key);
      continue;
    }

    try {
      const { data: preop, error } = await supabase
        .from('preop_records')
        .insert([{ ...item.payload.record, synced_at: new Date().toISOString() }])
        .select()
        .single();

      if (error) throw error;

      if (item.payload.items && preop) {
        await supabase.from('preop_items').insert(
          item.payload.items.map((i: any) => ({ ...i, record_id: preop.id }))
        );
      }

      await del(key);
      synced++;
    } catch {
      await set(key, { ...item, retries: item.retries + 1 });
    }
  }

  return synced;
}
