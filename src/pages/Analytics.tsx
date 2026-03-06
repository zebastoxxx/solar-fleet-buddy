import { useState, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@tanstack/react-query';
import { subMonths, subDays, startOfYear, format, differenceInDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { StatCard } from '@/components/ui/stat-card';
import { FilterPills } from '@/components/ui/filter-pills';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  ComposedChart,
} from 'recharts';

const PERIOD_OPTIONS = [
  { label: 'Último mes', value: '1m' },
  { label: '3 meses', value: '3m' },
  { label: '6 meses', value: '6m' },
  { label: 'Este año', value: 'year' },
];

function getDateRange(period: string) {
  const now = new Date();
  switch (period) {
    case '1m': return { from: subMonths(now, 1), to: now };
    case '3m': return { from: subMonths(now, 3), to: now };
    case '6m': return { from: subMonths(now, 6), to: now };
    case 'year': return { from: startOfYear(now), to: now };
    default: return { from: subMonths(now, 6), to: now };
  }
}

function formatCOP(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const COST_COLORS: Record<string, string> = {
  materiales: '#1D4ED8',
  mano_obra: '#D4881E',
  externo: '#6B7280',
  consumibles: '#EA580C',
};

const OT_TYPE_COLORS: Record<string, string> = {
  preventivo: '#1D4ED8',
  correctivo: '#C0392B',
  inspeccion: '#1A7A2E',
  preparacion: '#D97706',
};

function exportCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── TAB COSTOS ───
function CostosTab({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) {
  const user = useAuthStore(s => s.user);
  const fromStr = dateFrom.toISOString();
  const toStr = dateTo.toISOString();

  const { data: costEntries, isLoading } = useQuery({
    queryKey: ['analytics-costs', user?.tenant_id, fromStr, toStr],
    queryFn: async () => {
      const { data } = await supabase.from('cost_entries').select('*, machines(name, internal_code, type)')
        .eq('tenant_id', user!.tenant_id).gte('cost_date', fromStr.split('T')[0]).lte('cost_date', toStr.split('T')[0]);
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant-budget', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('monthly_maintenance_budget').eq('id', user!.tenant_id).single();
      return data;
    },
    enabled: !!user,
    staleTime: 300000,
  });

  const stats = useMemo(() => {
    if (!costEntries) return null;
    const total = costEntries.reduce((s, e) => s + Number(e.amount), 0);
    const months = Math.max(1, Math.ceil(differenceInDays(dateTo, dateFrom) / 30));
    const byMachine: Record<string, { name: string; code: string; type: string; total: number }> = {};
    costEntries.forEach(e => {
      const m = (e as any).machines;
      if (m && e.machine_id) {
        if (!byMachine[e.machine_id]) byMachine[e.machine_id] = { name: m.name, code: m.internal_code, type: m.type, total: 0 };
        byMachine[e.machine_id].total += Number(e.amount);
      }
    });
    const topMachines = Object.values(byMachine).sort((a, b) => b.total - a.total).slice(0, 5);
    const budget = Number(tenant?.monthly_maintenance_budget ?? 12000000) * 12;
    const pct = budget > 0 ? Math.round((total / budget) * 100) : 0;

    // Monthly by type
    const monthlyMap: Record<string, Record<string, number>> = {};
    costEntries.forEach(e => {
      const month = format(new Date(e.cost_date), 'yyyy-MM');
      if (!monthlyMap[month]) monthlyMap[month] = {};
      monthlyMap[month][e.cost_type] = (monthlyMap[month][e.cost_type] || 0) + Number(e.amount);
    });
    const monthlyData = Object.entries(monthlyMap).sort().map(([m, types]) => ({
      month: format(new Date(m + '-01'), 'MMM', { locale: es }),
      ...types,
    }));

    return { total, avg: total / months, topMachines, pct, budget, monthlyData, topName: topMachines[0]?.name ?? '—', topAmount: topMachines[0]?.total ?? 0 };
  }, [costEntries, tenant, dateFrom, dateTo]);

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div>;
  if (!stats) return <p className="text-sm text-muted-foreground font-dm py-8 text-center">Sin datos para este período</p>;

  const maxMachine = stats.topMachines[0]?.total ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gasto Total Período" value={formatCOP(stats.total)} />
        <StatCard label="Promedio Mensual" value={formatCOP(stats.avg)} />
        <StatCard label="Máquina Más Costosa" value={stats.topName} trend={{ value: formatCOP(stats.topAmount), positive: false }} />
        <StatCard label="% Presupuesto Usado" value={`${stats.pct}%`} trend={stats.pct > 80 ? { value: 'Superando presupuesto', positive: false } : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly costs stacked bar */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Costo Mensual por Tipo</h3>
          {stats.monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(36 10% 86%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: 'DM Sans' }} />
                <YAxis tickFormatter={(v) => formatCOP(v)} tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                <Tooltip formatter={(v: number) => formatCOP(v)} />
                <Legend />
                {Object.entries(COST_COLORS).map(([key, color]) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={color} name={key.replace('_', ' ')} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground font-dm py-8 text-center">Sin datos</p>}
        </div>

        {/* Top 5 machines */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top 5 Máquinas Más Costosas</h3>
          <div className="space-y-3">
            {stats.topMachines.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="font-barlow text-lg font-bold text-primary w-8">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-barlow text-sm font-semibold text-foreground truncate">{m.name}</p>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(m.total / maxMachine) * 100}%` }} />
                  </div>
                </div>
                <span className="font-barlow text-sm font-bold text-foreground whitespace-nowrap">{formatCOP(m.total)}</span>
              </div>
            ))}
            {stats.topMachines.length === 0 && <p className="text-sm text-muted-foreground font-dm text-center py-4">Sin datos</p>}
          </div>
        </div>

        {/* Budget donut */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Presupuesto vs Real</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Gastado', value: stats.total },
                    { name: 'Disponible', value: Math.max(0, stats.budget - stats.total) },
                  ]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value"
                >
                  <Cell fill={stats.pct > 100 ? '#C0392B' : '#D4881E'} />
                  <Cell fill="hsl(36 14% 93%)" />
                </Pie>
                <Tooltip formatter={(v: number) => formatCOP(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center font-barlow text-2xl font-bold text-foreground">{stats.pct}%</p>
          <p className="text-center text-xs text-muted-foreground font-dm">
            Gastado {formatCOP(stats.total)} · Disponible {formatCOP(Math.max(0, stats.budget - stats.total))}
          </p>
          {stats.pct > 100 && <p className="text-center text-xs text-destructive font-dm mt-1">⚠️ Presupuesto superado</p>}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => exportCSV((costEntries ?? []).map(e => ({
          fecha: e.cost_date, tipo: e.cost_type, monto: e.amount, descripcion: e.description ?? '',
        })), `costos-updown-${format(new Date(), 'yyyy-MM-dd')}.csv`)}>
          <Download className="h-4 w-4 mr-1" /> Exportar Costos
        </Button>
      </div>
    </div>
  );
}

// ─── TAB OPERATIVO ───
function OperativoTab({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) {
  const user = useAuthStore(s => s.user);
  const fromStr = dateFrom.toISOString();

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['analytics-ot', user?.tenant_id, fromStr],
    queryFn: async () => {
      const { data } = await supabase.from('work_orders').select('*, work_order_technicians(personnel_id, personnel(full_name))')
        .eq('tenant_id', user!.tenant_id).gte('created_at', fromStr);
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 300000,
  });

  const stats = useMemo(() => {
    if (!workOrders) return null;
    const total = workOrders.length;
    const completed = workOrders.filter(w => ['cerrada', 'firmada'].includes(w.status ?? '')).length;
    const withTimes = workOrders.filter(w => w.started_at && w.closed_at);
    const avgHours = withTimes.length > 0
      ? withTimes.reduce((s, w) => s + (new Date(w.closed_at!).getTime() - new Date(w.started_at!).getTime()) / 3600000, 0) / withTimes.length
      : 0;
    const totalHours = workOrders.reduce((s, w) => s + Number(w.actual_hours ?? 0), 0);

    // By type
    const byType: Record<string, number> = {};
    workOrders.forEach(w => { byType[w.type] = (byType[w.type] || 0) + 1; });
    const typeData = Object.entries(byType).map(([name, value]) => ({ name, value }));

    // By technician hours
    const techMap: Record<string, { name: string; hours: number; count: number }> = {};
    workOrders.forEach(w => {
      const techs = (w as any).work_order_technicians ?? [];
      techs.forEach((t: any) => {
        const pName = t.personnel?.full_name ?? 'Sin nombre';
        if (!techMap[t.personnel_id]) techMap[t.personnel_id] = { name: pName, hours: 0, count: 0 };
        techMap[t.personnel_id].hours += Number(w.actual_hours ?? 0);
        techMap[t.personnel_id].count += 1;
      });
    });
    const techData = Object.values(techMap).sort((a, b) => b.hours - a.hours);

    // Avg resolution by type
    const resByType: Record<string, { total: number; count: number }> = {};
    withTimes.forEach(w => {
      const h = (new Date(w.closed_at!).getTime() - new Date(w.started_at!).getTime()) / 3600000;
      if (!resByType[w.type]) resByType[w.type] = { total: 0, count: 0 };
      resByType[w.type].total += h;
      resByType[w.type].count += 1;
    });
    const resData = Object.entries(resByType).map(([type, v]) => ({
      type, avg: v.total / v.count, count: v.count,
    }));

    return { total, completed, avgHours, totalHours, typeData, techData, resData };
  }, [workOrders]);

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div>;
  if (!stats) return <p className="text-sm text-muted-foreground font-dm py-8 text-center">Sin datos</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total OT" value={stats.total} />
        <StatCard label="OT Completadas" value={stats.completed} />
        <StatCard label="Tiempo Prom. Resolución" value={`${stats.avgHours.toFixed(1)}h`} />
        <StatCard label="Horas-Hombre Totales" value={`${stats.totalHours.toFixed(0)}h`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tech hours horizontal bar */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Horas por Técnico</h3>
          {stats.techData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, stats.techData.length * 40)}>
              <BarChart data={stats.techData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(36 10% 86%)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${v}h`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fontFamily: 'DM Sans' }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} />
                <Bar dataKey="hours" fill="#D4881E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground font-dm text-center py-4">Sin datos</p>}
        </div>

        {/* OT by type pie */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">OT por Tipo</h3>
          {stats.typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={stats.typeData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stats.typeData.map((d) => (
                    <Cell key={d.name} fill={OT_TYPE_COLORS[d.name] ?? '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground font-dm text-center py-4">Sin datos</p>}
        </div>

        {/* Resolution time by type */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tiempo Promedio de Resolución por Tipo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['preventivo', 'correctivo', 'inspeccion', 'preparacion'].map(type => {
              const d = stats.resData.find(r => r.type === type);
              return (
                <div key={type} className="rounded-xl border border-border p-4 text-center">
                  <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{
                    backgroundColor: OT_TYPE_COLORS[type] + '20',
                    color: OT_TYPE_COLORS[type],
                  }}>{type}</span>
                  <p className="font-barlow text-2xl font-bold text-primary mt-2">{d ? `${d.avg.toFixed(1)}h` : '—'}</p>
                  <p className="text-[11px] text-muted-foreground font-dm">{d ? `${d.count} órdenes` : 'Sin datos'}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB PREOPERACIONALES ───
function PreopsTab({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) {
  const user = useAuthStore(s => s.user);
  const fromStr = dateFrom.toISOString();

  const { data: preops, isLoading } = useQuery({
    queryKey: ['analytics-preops', user?.tenant_id, fromStr],
    queryFn: async () => {
      const { data } = await supabase.from('preop_records').select('*, machines(name, internal_code, type), projects(name)')
        .eq('tenant_id', user!.tenant_id).gte('created_at', fromStr);
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: preopItems } = useQuery({
    queryKey: ['analytics-preop-items', user?.tenant_id, fromStr],
    queryFn: async () => {
      const { data } = await supabase.from('preop_items').select('item_label, section, result, is_critical, record_id, preop_records!inner(tenant_id, created_at)')
        .eq('preop_records.tenant_id', user!.tenant_id).gte('preop_records.created_at', fromStr).eq('result', 'malo').eq('is_critical', true);
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 300000,
  });

  const stats = useMemo(() => {
    if (!preops) return null;
    const total = preops.length;
    const withCritical = preops.filter(p => p.has_critical_failures).length;
    const operators = new Set(preops.map(p => p.operator_id).filter(Boolean)).size;
    const days = Math.max(1, differenceInDays(dateTo, dateFrom));
    const avgDaily = total / days;

    // Top failed items
    const itemMap: Record<string, { label: string; section: string; count: number }> = {};
    (preopItems ?? []).forEach(pi => {
      const key = pi.item_label;
      if (!itemMap[key]) itemMap[key] = { label: pi.item_label, section: pi.section, count: 0 };
      itemMap[key].count += 1;
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.count - a.count).slice(0, 10);

    // Machines with most failures
    const machineMap: Record<string, { name: string; code: string; type: string; totalPreops: number; withFaults: number; criticals: number }> = {};
    preops.forEach(p => {
      const m = (p as any).machines;
      if (m && p.machine_id) {
        if (!machineMap[p.machine_id]) machineMap[p.machine_id] = { name: m.name, code: m.internal_code, type: m.type, totalPreops: 0, withFaults: 0, criticals: 0 };
        machineMap[p.machine_id].totalPreops += 1;
        if (p.has_critical_failures) machineMap[p.machine_id].withFaults += 1;
        machineMap[p.machine_id].criticals += p.critical_failures_count ?? 0;
      }
    });
    const topMachines = Object.values(machineMap).sort((a, b) => b.criticals - a.criticals).slice(0, 5);

    // Heatmap data: day of week activity
    const dayCount: Record<number, number> = {};
    preops.forEach(p => {
      if (p.created_at) {
        const day = getDay(new Date(p.created_at));
        dayCount[day] = (dayCount[day] || 0) + 1;
      }
    });
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const heatData = dayNames.map((name, i) => ({ name, count: dayCount[i] || 0 }));

    return { total, withCritical, operators, avgDaily, topItems, topMachines, heatData };
  }, [preops, preopItems, dateFrom, dateTo]);

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div>;
  if (!stats) return <p className="text-sm text-muted-foreground font-dm py-8 text-center">Sin datos</p>;

  const maxItem = stats.topItems[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Registros" value={stats.total} />
        <StatCard label="Con Fallos Críticos" value={stats.withCritical} trend={stats.withCritical > 0 ? { value: `${((stats.withCritical / Math.max(1, stats.total)) * 100).toFixed(0)}%`, positive: false } : undefined} />
        <StatCard label="Operarios Activos" value={stats.operators} />
        <StatCard label="Promedio Diario" value={stats.avgDaily.toFixed(1)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top failed items */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top Ítems Críticos Fallidos</h3>
          <div className="space-y-2">
            {stats.topItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="font-barlow text-sm font-bold text-destructive w-6">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-dm text-foreground truncate">{item.label}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-destructive" style={{ width: `${(item.count / maxItem) * 100}%` }} />
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">{item.count}×</span>
              </div>
            ))}
            {stats.topItems.length === 0 && <p className="text-sm text-muted-foreground font-dm text-center py-4">Sin fallas críticas</p>}
          </div>
        </div>

        {/* Machines with failures */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Máquinas con Más Fallas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.topMachines.map((m, i) => (
              <div key={i} className={`rounded-xl border p-3 ${m.withFaults > 5 ? 'border-l-4 border-l-destructive border-border' : 'border-border'}`}>
                <p className="font-barlow text-sm font-semibold text-foreground">{m.name}</p>
                <p className="text-[11px] text-muted-foreground font-dm">{m.type}</p>
                <p className="text-[12px] font-dm text-foreground mt-2">{m.totalPreops} preops</p>
                <p className="text-[12px] font-dm text-destructive">⚠️ {m.withFaults} con críticos</p>
                <p className="text-[12px] font-dm text-destructive">🚨 {m.criticals} puntos</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity by day of week */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actividad por Día de la Semana</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.heatData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(36 10% 86%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'DM Sans' }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#D4881E" radius={[4, 4, 0, 0]} name="Preoperacionales" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ───
export default function Analytics() {
  usePageTitle('Analytics');
  const [period, setPeriod] = useState('6m');
  const { from: dateFrom, to: dateTo } = getDateRange(period);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-barlow text-xl font-bold uppercase tracking-wider text-foreground">Analytics</h1>
        <FilterPills options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      <Tabs defaultValue="costos">
        <TabsList>
          <TabsTrigger value="costos">💰 Costos</TabsTrigger>
          <TabsTrigger value="operativo">⚙️ Operativo</TabsTrigger>
          <TabsTrigger value="preops">📋 Preoperacionales</TabsTrigger>
        </TabsList>
        <TabsContent value="costos"><CostosTab dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="operativo"><OperativoTab dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
        <TabsContent value="preops"><PreopsTab dateFrom={dateFrom} dateTo={dateTo} /></TabsContent>
      </Tabs>
    </div>
  );
}
