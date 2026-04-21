import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useAlertsStore, type Alert } from '@/stores/alertsStore';
import { toast } from 'sonner';

export function useAlerts() {
  const setAlerts = useAlertsStore((s) => s.setAlerts);
  const addAlert = useAlertsStore((s) => s.addAlert);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;

    const loadAlerts = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .eq('resolved', false)
        .order('created_at', { ascending: false });
      if (data) setAlerts(data as Alert[]);
    };
    loadAlerts();

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

    return () => { supabase.removeChannel(channel); };
  }, [user, setAlerts, addAlert]);
}
