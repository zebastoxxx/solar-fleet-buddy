import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export function useFleetStats() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  return useQuery({
    queryKey: ['fleet-stats', tenantId],
    enabled: !!tenantId,
    staleTime: 30000,
    queryFn: async () => {
      const { data: machines } = await supabase
        .from('machines')
        .select('id, status')
        .eq('tenant_id', tenantId!);
      const total = machines?.length ?? 0;
      const active = machines?.filter((m) => m.status === 'activa_en_campo').length ?? 0;
      return { active, total };
    },
  });
}

export function useOpenOTs() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  return useQuery({
    queryKey: ['open-ots', tenantId],
    enabled: !!tenantId,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from('work_orders')
        .select('id, priority, status')
        .eq('tenant_id', tenantId!)
        .in('status', ['creada', 'asignada', 'en_curso']);
      const count = data?.length ?? 0;
      const hasCritical = data?.some((o) => o.priority === 'critica') ?? false;
      return { count, hasCritical };
    },
  });
}

export function useMonthlySpend() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  return useQuery({
    queryKey: ['monthly-spend', tenantId],
    enabled: !!tenantId,
    staleTime: 30000,
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: costs } = await supabase
        .from('cost_entries')
        .select('amount')
        .eq('tenant_id', tenantId!)
        .gte('cost_date', startOfMonth.split('T')[0]);
      const total = costs?.reduce((sum, c) => sum + Number(c.amount), 0) ?? 0;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('monthly_maintenance_budget')
        .eq('id', tenantId!)
        .single();
      const budget = Number(tenant?.monthly_maintenance_budget ?? 12000000);
      return { total, budget, pct: budget > 0 ? (total / budget) * 100 : 0 };
    },
  });
}

export function useActiveProjects() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  return useQuery({
    queryKey: ['active-projects', tenantId],
    enabled: !!tenantId,
    staleTime: 30000,
    queryFn: async () => {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .eq('status', 'activo');
      return count ?? 0;
    },
  });
}

export function useRecentOTs() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  return useQuery({
    queryKey: ['recent-ots', tenantId],
    enabled: !!tenantId,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from('work_orders')
        .select('id, code, status, priority, created_at, machines(name)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });
}

export function useActiveAlerts() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  return useQuery({
    queryKey: ['active-alerts', tenantId],
    enabled: !!tenantId,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });
}

export function useActivityFeed(period: 'today' | 'week' | 'month') {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  return useQuery({
    queryKey: ['activity-feed', tenantId, period],
    enabled: !!tenantId,
    staleTime: 30000,
    queryFn: async () => {
      const now = new Date();
      let since: string;
      if (period === 'today') {
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        since = d.toISOString();
      } else {
        since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      }
      const { data } = await supabase
        .from('system_logs')
        .select('*')
        .eq('tenant_id', tenantId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });
}

export function useAllMachines() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  return useQuery({
    queryKey: ['machines', tenantId],
    enabled: !!tenantId,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from('machines')
        .select('id, internal_code, name, brand, model, type, status, horometer_current, monthly_cost_estimate, current_project_id, cover_photo_url, projects:current_project_id(name)')
        .eq('tenant_id', tenantId!)
        .order('status')
        .order('internal_code');
      return data ?? [];
    },
  });
}
