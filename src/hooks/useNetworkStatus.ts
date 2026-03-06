import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { processOfflineQueue } from '@/lib/offline-queue';

interface SyncState {
  show: boolean;
  count: number;
}

export const useSyncStore = create<SyncState>(() => ({
  show: false,
  count: 0,
}));

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      try {
        const synced = await processOfflineQueue();
        if (synced > 0) {
          useSyncStore.setState({ show: true, count: synced });
          setTimeout(() => useSyncStore.setState({ show: false, count: 0 }), 4000);
        }
      } catch {
        // silent
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
