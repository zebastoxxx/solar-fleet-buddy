import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useCallback } from 'react';

export function useLog() {
  const user = useAuthStore((s) => s.user);

  const log = useCallback(
    async (
      module: string,
      action: string,
      entityType?: string,
      entityId?: string,
      entityName?: string,
      detail?: Record<string, unknown>
    ) => {
      if (!user) return;
      try {
        await supabase.from('system_logs').insert([{
          tenant_id: user.tenant_id,
          user_id: user.id,
          user_name: user.full_name,
          user_role: user.role,
          module,
          action,
          entity_type: entityType ?? null,
          entity_id: entityId ?? null,
          entity_name: entityName ?? null,
          detail: (detail as any) ?? null,
        }]);
      } catch {
        // silent fail for logging
      }
    },
    [user]
  );

  return { log };
}
