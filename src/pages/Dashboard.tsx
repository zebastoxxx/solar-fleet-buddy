import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Truck, Wrench, DollarSign, FolderOpen, AlertTriangle, CheckCircle, Clock, Package, User } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { FilterPills } from '@/components/ui/filter-pills';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  useFleetStats,
  useOpenOTs,
  useMonthlySpend,
  useActiveProjects,
  useAllMachines,
  useRecentOTs,
  useActiveAlerts,
  useActivityFeed,
} from '@/hooks/useDashboardData';
import type { Database } from '@/integrations/supabase/types';

type MachineStatus = Database['public']['Enums']['machine_status'];

function formatCOP(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  maquinas: <Truck className="h-4 w-4" />,
  ordenes_trabajo: <Wrench className="h-4 w-4" />,
  preoperacionales: <Clock className="h-4 w-4" />,
  inventario: <Package className="h-4 w-4" />,
  usuarios: <User className="h-4 w-4" />,
};

const OT_STATUS_MAP: Record<string, string> = {
  creada: 'creada',
  asignada: 'asignada',
  en_curso: 'en_curso',
  pausada: 'pausada',
  cerrada: 'cerrada',
  firmada: 'firmada',
};

export default function Dashboard() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [feedPeriod, setFeedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  const fleet = useFleetStats();
  const openOTs = useOpenOTs();
  const spend = useMonthlySpend();
  const projects = useActiveProjects();
  const machines = useAllMachines();
  const recentOTs = useRecentOTs();
  const alerts = useActiveAlerts();
  const feed = useActivityFeed(feedPeriod);

  const criticalAlerts = (alerts.data ?? []).filter((a) => a.severity === 'critical');

  const resolveAlert = async (id: string) => {
    await supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id);
    alerts.refetch();
    toast({ title: 'Alerta resuelta' });
  };

  return (
    <div className="space-y-6">
      {/* Critical alerts banner */}
      {criticalAlerts.length > 0 && !alertsCollapsed && (
        <div className="rounded-xl border border-danger bg-danger-bg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger" />
              <span className="font-barlow text-sm font-semibold uppercase text-danger">
                {criticalAlerts.length} alerta{criticalAlerts.length > 1 ? 's' : ''} crítica{criticalAlerts.length > 1 ? 's' : ''} requiere{criticalAlerts.length > 1 ? 'n' : ''} atención
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAlertsCollapsed(true)}>Ocultar</Button>
          </div>
        </div>
      )}

      {/* Row 1 — StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fleet.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Flota Activa" value={`${fleet.data?.active ?? 0} de ${fleet.data?.total ?? 0}`} />
            <StatCard
              label="OT Abiertas"
              value={`${openOTs.data?.count ?? 0} abiertas`}
              trend={openOTs.data?.hasCritical ? { value: 'Hay OT críticas', positive: false } : undefined}
            />
            <div className="h-[88px] rounded-xl border border-border bg-card p-3.5 px-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-dm">Gasto Mensual</p>
              <p className="mt-1 text-[28px] font-bold leading-tight font-barlow text-foreground">
                {formatCOP(spend.data?.total ?? 0)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full transition-all ${(spend.data?.pct ?? 0) >= 80 ? 'bg-danger' : 'bg-gold'}`}
                    style={{ width: `${Math.min(spend.data?.pct ?? 0, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-dm">de {formatCOP(spend.data?.budget ?? 12000000)}</span>
              </div>
            </div>
            <StatCard label="Proyectos Activos" value={`${projects.data ?? 0} activos`} />
          </>
        )}
      </div>

      {/* Row 2 — Fleet grid + Recent OTs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Fleet grid */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Flota Completa</h3>
          {machines.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
            </div>
          ) : !machines.data?.length ? (
            <p className="text-sm text-muted-foreground font-dm py-8 text-center">Sin máquinas registradas</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {machines.data.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/maquinas/${m.id}`)}
                  className="h-[120px] rounded-xl border border-border bg-card p-3 text-left hover:border-gold transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StatusIndicator status={m.status as MachineStatus} />
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground font-dm">{m.type}</span>
                  </div>
                  <p className="font-barlow text-sm font-semibold text-foreground truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground font-dm">{m.internal_code}</p>
                  <p className="text-[12px] font-dm text-foreground mt-1">⏱ {Number(m.horometer_current ?? 0).toLocaleString()} h</p>
                  {(m as any).projects?.name && (
                    <p className="text-[11px] text-gold font-dm truncate">📍 {(m as any).projects.name}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent OTs */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Últimas OT</h3>
          {recentOTs.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : !recentOTs.data?.length ? (
            <p className="text-sm text-muted-foreground font-dm py-8 text-center">Sin órdenes de trabajo</p>
          ) : (
            <div className="space-y-2">
              {recentOTs.data.map((ot) => (
                <div key={ot.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <div>
                    <span className="font-barlow text-[13px] font-semibold text-gold">{ot.code}</span>
                    <p className="text-[12px] text-muted-foreground font-dm">{(ot as any).machines?.name ?? '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={OT_STATUS_MAP[ot.status ?? 'creada'] ?? ot.status ?? 'creada'} />
                    <span className="text-[11px] text-muted-foreground font-dm">
                      {ot.created_at ? formatDistanceToNow(new Date(ot.created_at), { addSuffix: true, locale: es }) : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Active Alerts */}
      {(alerts.data?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Alertas Activas</h3>
          <div className="space-y-2">
            {alerts.data?.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className={`flex items-center justify-between rounded-lg border-l-4 p-3 ${
                  a.severity === 'critical'
                    ? 'border-l-danger bg-danger-bg'
                    : a.severity === 'warning'
                    ? 'border-l-warning bg-warning-bg'
                    : 'border-l-blue-500 bg-blue-50'
                }`}
              >
                <div>
                  <p className="text-sm font-dm font-medium text-foreground">{a.message}</p>
                  <p className="text-[11px] text-muted-foreground font-dm">
                    {a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es }) : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => resolveAlert(a.id)}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Resolver
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 4 — Activity Feed */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground">Actividad Reciente</h3>
          <FilterPills
            options={[
              { label: 'Hoy', value: 'today' },
              { label: 'Esta semana', value: 'week' },
              { label: 'Este mes', value: 'month' },
            ]}
            value={feedPeriod}
            onChange={(v) => setFeedPeriod(v as 'today' | 'week' | 'month')}
          />
        </div>
        {feed.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : !feed.data?.length ? (
          <p className="text-sm text-muted-foreground font-dm py-6 text-center">Sin actividad en este periodo</p>
        ) : (
          <div className="space-y-2">
            {feed.data.map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <div className="text-muted-foreground">
                  {MODULE_ICONS[log.module] ?? <Clock className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-dm text-foreground truncate">
                    {log.action} {log.entity_name ?? log.entity_type ?? ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-dm">{log.user_name}</p>
                </div>
                <span className="text-[11px] text-muted-foreground font-dm whitespace-nowrap">
                  {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: es }) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
