import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useAlertsStore, type Alert } from '@/stores/alertsStore';
import { toast } from 'sonner';

// Module-level guard: ensure a single realtime subscription across the app,
// even under React StrictMode double-invoke and HMR.
let activeChannel: ReturnType<typeof supabase.channel> | null = null;
let activeTenantId: string | null = null;

export function useAlerts() {
  const setAlerts = useAlertsStore((s) => s.setAlerts);
  const addAlert = useAlertsStore((s) => s.addAlert);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const loadAlerts = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .eq('resolved', false)
        .order('created_at', { ascending: false });
      if (!cancelled && data) setAlerts(data as Alert[]);
    };
    loadAlerts();

    // Reuse existing subscription if same tenant
    if (activeChannel && activeTenantId === user.tenant_id) {
      return () => { cancelled = true; };
    }

    // Tear down stale channel (different tenant after re-login)
    if (activeChannel) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
      activeTenantId = null;
    }

    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `tenant_id=eq.${user.tenant_id}`,
      }, (payload) => {
        const newAlert = payload.new as Alert;
        addAlert(newAlert);
        if (newAlert.severity === 'critical') {
          toast.error(`🚨 ${newAlert.message}`, { duration: 8000 });
        } else if (newAlert.severity === 'warning') {
          toast.warning(`⚠️ ${newAlert.message}`, { duration: 5000 });
        }
      })
      .subscribe();

    activeChannel = channel;
    activeTenantId = user.tenant_id;

    return () => {
      cancelled = true;
      // Do NOT remove the channel here — keep it alive across navigations.
      // It will be cleaned up only on tenant change or full app teardown.
    };
  }, [user, setAlerts, addAlert]);
}
