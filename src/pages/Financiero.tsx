import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatCOP, formatCOPShort, formatDate } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonStatCards, SkeletonTableRows } from '@/components/ui/SkeletonLoaders';
import { StatCard } from '@/components/ui/stat-card';
import { SearchInput } from '@/components/ui/search-input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Plus, Download, Upload, ChevronDown, ChevronRight, CalendarIcon,
  Trash2, Edit, FileText
} from 'lucide-react';
import { subMonths, subDays, startOfMonth, startOfYear, format, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// ─── Types ───
interface FinancialEntry {
  id: string;
  entry_type: string;
  cost_date: string;
  cost_type: string;
  amount: number;
  description: string | null;
  category_id: string | null;
  machine_id: string | null;
  project_id: string | null;
  supplier_id: string | null;
  work_order_id: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  notes: string | null;
  imported_from: string | null;
  source: string;
  source_id: string | null;
  created_by: string | null;
  tenant_id: string;
  created_at: string | null;
}

interface FinancialCategory {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  is_default: boolean;
  active: boolean;
}

// ─── Period Selector ───
type PeriodKey = '1m' | '3m' | '6m' | 'year' | 'all';
const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '1m', label: 'Mes actual' },
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: 'year', label: 'Este año' },
  { key: 'all', label: 'Todo' },
];

function getDateRange(period: PeriodKey): { from: string; to: string } {
  const now = new Date();
  const to = format(now, 'yyyy-MM-dd');
  switch (period) {
    case '1m': return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to };
    case '3m': return { from: format(subMonths(now, 3), 'yyyy-MM-dd'), to };
    case '6m': return { from: format(subMonths(now, 6), 'yyyy-MM-dd'), to };
    case 'year': return { from: format(startOfYear(now), 'yyyy-MM-dd'), to };
    case 'all': return { from: '2000-01-01', to };
  }
}

const CHART_COLORS = {
  income: 'hsl(var(--gold))',
  expense: '#C0392B',
  incomeLight: 'hsl(var(--gold) / 0.3)',
  expenseLight: 'rgba(192,57,43,0.2)',
};

const CATEGORY_FALLBACK_COLORS = ['#D4881E', '#1D4ED8', '#C0392B', '#065F46', '#6D28D9', '#EA580C', '#374151', '#D97706'];

// ─── Main Component ───
export default function Financiero() {
  usePageTitle('Financiero');
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const { log } = useLog();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>('6m');
  const dateRange = useMemo(() => getDateRange(period), [period]);
  const [activeTab, setActiveTab] = useState('movimientos');
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editEntry, setEditEntry] = useState<FinancialEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinancialEntry | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'ingreso' | 'gasto'>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [filterMachineId, setFilterMachineId] = useState<string>('all');
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [movDateFrom, setMovDateFrom] = useState('');
  const [movDateTo, setMovDateTo] = useState('');

  // ─── Queries ───
  const { data: categories = [] } = useQuery({
    queryKey: ['financial-categories', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_categories')
        .select('*')
        .eq('tenant_id', user!.tenant_id)
        .eq('active', true)
        .order('type')
        .order('name');
      return (data ?? []) as FinancialCategory[];
    },
    enabled: !!user,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['financials', user?.tenant_id, dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data } = await supabase
        .from('cost_entries')
        .select('*')
        .eq('tenant_id', user!.tenant_id)
        .gte('cost_date', dateRange.from)
        .lte('cost_date', dateRange.to)
        .order('cost_date', { ascending: false });
      return (data ?? []) as FinancialEntry[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: machines = [] } = useQuery({
    queryKey: ['machines-list', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('machines')
        .select('id, name, internal_code, type')
        .eq('tenant_id', user!.tenant_id)
        .order('name');
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, budget, status')
        .eq('tenant_id', user!.tenant_id)
        .order('name');
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('tenant_id', user!.tenant_id)
        .order('name');
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['work-orders-list', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('work_orders')
        .select('id, code, machine_id, type')
        .eq('tenant_id', user!.tenant_id)
        .order('code', { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!user,
  });

  // ─── Computed ───
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filterType !== 'all') result = result.filter(e => e.entry_type === filterType);
    if (filterCategoryId !== 'all') result = result.filter(e => e.category_id === filterCategoryId);
    if (filterMachineId !== 'all') result = result.filter(e => e.machine_id === filterMachineId);
    if (filterProjectId !== 'all') result = result.filter(e => e.project_id === filterProjectId);
    if (movDateFrom) result = result.filter(e => e.cost_date >= movDateFrom);
    if (movDateTo) result = result.filter(e => e.cost_date <= movDateTo);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e =>
        (e.description?.toLowerCase().includes(s)) ||
        (e.invoice_number?.toLowerCase().includes(s)) ||
        (e.notes?.toLowerCase().includes(s))
      );
    }
    return result;
  }, [entries, filterType, filterCategoryId, filterMachineId, filterProjectId, search, movDateFrom, movDateTo]);

  const totals = useMemo(() => {
    const totalIncome = filteredEntries.filter(e => e.entry_type === 'ingreso').reduce((s, e) => s + Number(e.amount), 0);
    const totalExpense = filteredEntries.filter(e => e.entry_type === 'gasto').reduce((s, e) => s + Number(e.amount), 0);
    const profit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? ((profit / totalIncome) * 100) : 0;
    return { totalIncome, totalExpense, profit, margin };
  }, [filteredEntries]);

  const globalTotals = useMemo(() => {
    const totalIncome = entries.filter(e => e.entry_type === 'ingreso').reduce((s, e) => s + Number(e.amount), 0);
    const totalExpense = entries.filter(e => e.entry_type === 'gasto').reduce((s, e) => s + Number(e.amount), 0);
    const profit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? ((profit / totalIncome) * 100) : 0;
    return { totalIncome, totalExpense, profit, margin, incomeCount: entries.filter(e => e.entry_type === 'ingreso').length, expenseCount: entries.filter(e => e.entry_type === 'gasto').length };
  }, [entries]);

  // ─── Monthly chart data ───
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; ingresos: number; gastos: number }>();
    entries.forEach(e => {
      const m = e.cost_date.substring(0, 7);
      if (!map.has(m)) map.set(m, { month: m, ingresos: 0, gastos: 0 });
      const item = map.get(m)!;
      if (e.entry_type === 'ingreso') item.ingresos += Number(e.amount);
      else item.gastos += Number(e.amount);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  // ─── Category chart data ───
  const categoryData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    entries.filter(e => e.entry_type === 'gasto').forEach(e => {
      const cat = categories.find(c => c.id === e.category_id);
      const name = cat?.name ?? 'Sin categoría';
      const color = cat?.color ?? '#6B7280';
      if (!map.has(name)) map.set(name, { name, value: 0, color });
      map.get(name)!.value += Number(e.amount);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [entries, categories]);

  // ─── Machine financials ───
  const machineFinancials = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string; type: string; income: number; expense: number }>();
    machines.forEach(m => map.set(m.id, { id: m.id, name: m.name, code: m.internal_code, type: m.type, income: 0, expense: 0 }));
    entries.forEach(e => {
      if (!e.machine_id || !map.has(e.machine_id)) return;
      const item = map.get(e.machine_id)!;
      if (e.entry_type === 'ingreso') item.income += Number(e.amount);
      else item.expense += Number(e.amount);
    });
    return Array.from(map.values())
      .filter(m => m.income > 0 || m.expense > 0)
      .sort((a, b) => (b.income - b.expense) - (a.income - a.expense));
  }, [entries, machines]);

  // ─── Project financials ───
  const projectFinancials = useMemo(() => {
    const map = new Map<string, { id: string; name: string; budget: number | null; status: string | null; income: number; expense: number }>();
    projects.forEach(p => map.set(p.id, { id: p.id, name: p.name, budget: p.budget, status: p.status, income: 0, expense: 0 }));
    entries.forEach(e => {
      if (!e.project_id || !map.has(e.project_id)) return;
      const item = map.get(e.project_id)!;
      if (e.entry_type === 'ingreso') item.income += Number(e.amount);
      else item.expense += Number(e.amount);
    });
    return Array.from(map.values())
      .filter(p => p.income > 0 || p.expense > 0)
      .sort((a, b) => (b.income - b.expense) - (a.income - a.expense));
  }, [entries, projects]);

  // ─── Delete mutation ───
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cost_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      toast({ title: 'Registro eliminado' });
    },
  });

  // ─── CSV Export ───
  const exportCSV = useCallback(() => {
    const rows = filteredEntries.map(e => {
      const cat = categories.find(c => c.id === e.category_id);
      const machine = machines.find(m => m.id === e.machine_id);
      const project = projects.find(p => p.id === e.project_id);
      return {
        Fecha: e.cost_date,
        Tipo: e.entry_type,
        Categoría: cat?.name ?? '',
        Descripción: e.description ?? '',
        Monto: e.amount,
        Máquina: machine ? `${machine.name} [${machine.internal_code}]` : '',
        Proyecto: project?.name ?? '',
        Factura: e.invoice_number ?? '',
      };
    });
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financiero-updown-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredEntries, categories, machines, projects]);

  // ─── Render ───
  return (
    <div className="space-y-6">
      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-dm text-muted-foreground">Desde</label>
          <input type="date" value={dateRange.from} onChange={e => {
            const val = e.target.value;
            if (val) setPeriod('all'); // switch to custom
          }}
            className="h-9 w-full sm:w-auto rounded-lg border border-border bg-card px-3 text-xs font-dm text-foreground" />
          <span className="text-muted-foreground hidden sm:inline">→</span>
          <label className="text-xs font-dm text-muted-foreground">Hasta</label>
          <input type="date" value={dateRange.to}
            className="h-9 w-full sm:w-auto rounded-lg border border-border bg-card px-3 text-xs font-dm text-foreground" readOnly />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-dm font-medium transition-colors',
                period === p.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      {entriesLoading ? (
        <SkeletonStatCards />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="💰 Ingresos totales" value={formatCOPShort(globalTotals.totalIncome)} trend={{ value: `${globalTotals.incomeCount} registros`, positive: true }} />
          <StatCard label="📤 Gastos totales" value={formatCOPShort(globalTotals.totalExpense)} trend={{ value: `${globalTotals.expenseCount} registros`, positive: false }} />
          <StatCard label="📈 Utilidad neta" value={formatCOPShort(globalTotals.profit)}
            trend={globalTotals.profit < 0 ? { value: '⚠️ Pérdida', positive: false } : undefined} />
          <StatCard label="% Margen bruto" value={`${globalTotals.margin.toFixed(1)}%`}
            trend={{ value: globalTotals.margin > 30 ? '✅ Saludable' : globalTotals.margin > 10 ? '⚡ Moderado' : '⚠️ Bajo', positive: globalTotals.margin > 10 }} />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="resumen" className="font-dm text-sm">📊 Resumen</TabsTrigger>
          <TabsTrigger value="movimientos" className="font-dm text-sm">📋 Movimientos</TabsTrigger>
          <TabsTrigger value="maquina" className="font-dm text-sm">🏭 Por Máquina</TabsTrigger>
          <TabsTrigger value="proyecto" className="font-dm text-sm">📁 Por Proyecto</TabsTrigger>
        </TabsList>

        {/* ═══ TAB: RESUMEN ═══ */}
        <TabsContent value="resumen" className="space-y-6 mt-4">
          {entriesLoading ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="skeleton-shimmer h-[320px] rounded-xl" />
              <div className="skeleton-shimmer h-[320px] rounded-xl" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon="📊"
              title="Sin datos financieros"
              description="Registra tu primer ingreso o gasto para ver gráficas de rentabilidad."
              action={{ label: '➕ Nuevo registro', onClick: () => setShowNewEntry(true) }}
            />
          ) : (
            <>
              {/* Chart 1: Monthly flow */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-barlow font-semibold text-foreground mb-4">Flujo de caja mensual</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'DM Sans' }}
                      tickFormatter={v => {
                        const [y, m] = v.split('-');
                        return format(new Date(+y, +m - 1), 'MMM yy', { locale: es });
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCOPShort(v)} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatCOP(v), name === 'ingresos' ? 'Ingresos' : 'Gastos']}
                      labelFormatter={v => {
                        const [y, m] = v.split('-');
                        return format(new Date(+y, +m - 1), 'MMMM yyyy', { locale: es });
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="ingresos" stroke="hsl(var(--gold))" fill="hsl(var(--gold) / 0.2)" name="Ingresos" />
                    <Area type="monotone" dataKey="gastos" stroke="#C0392B" fill="rgba(192,57,43,0.15)" name="Gastos" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Chart 2: Expenses by category (Donut) */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-barlow font-semibold text-foreground mb-4">Gastos por categoría</h3>
                  {categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sin gastos categorizados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          innerRadius={55} outerRadius={100} paddingAngle={2}>
                          {categoryData.map((c, i) => (
                            <Cell key={i} fill={c.color || CATEGORY_FALLBACK_COLORS[i % CATEGORY_FALLBACK_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCOP(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Top 5 profitable machines */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-barlow font-semibold text-foreground mb-4">Top máquinas por rentabilidad</h3>
                  {machineFinancials.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sin datos de máquinas</p>
                  ) : (
                    <div className="space-y-3">
                      {machineFinancials.slice(0, 5).map((m, i) => {
                        const profit = m.income - m.expense;
                        const margin = m.income > 0 ? ((profit / m.income) * 100) : 0;
                        const maxProfit = Math.max(...machineFinancials.slice(0, 5).map(x => Math.abs(x.income - x.expense)), 1);
                        return (
                          <div key={m.id} className="flex items-center gap-3">
                            <span className="text-lg font-barlow font-bold text-primary w-6">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-dm font-medium truncate">{m.name}</span>
                                <span className="text-xs text-muted-foreground">[{m.code}]</span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', profit >= 0 ? 'bg-primary' : 'bg-destructive')}
                                  style={{ width: `${Math.min(Math.abs(profit) / maxProfit * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={cn('text-sm font-barlow font-bold', profit >= 0 ? 'text-primary' : 'text-destructive')}>
                                {formatCOPShort(profit)}
                              </span>
                              <MarginBadge margin={margin} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══ TAB: MOVIMIENTOS ═══ */}
        <TabsContent value="movimientos" className="space-y-4 mt-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar descripción, factura..." className="w-64" />
            <div className="flex gap-1">
              {(['all', 'ingreso', 'gasto'] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-dm font-medium transition-colors',
                    filterType === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                  {t === 'all' ? 'Todos' : t === 'ingreso' ? '💰 Ingresos' : '📤 Gastos'}
                </button>
              ))}
            </div>
            <Select value={filterMachineId} onValueChange={setFilterMachineId}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Máquina" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las máquinas</SelectItem>
                {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterProjectId} onValueChange={setFilterProjectId}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Proyecto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="text-xs">
              <Upload className="h-3.5 w-3.5 mr-1" /> Importar
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs">
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
            </Button>
            <Button size="sm" onClick={() => setShowNewEntry(true)} className="text-xs bg-primary hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo registro
            </Button>
          </div>

          {/* Table */}
          {entriesLoading ? (
            <div className="rounded-xl border border-border bg-card">
              <table className="w-full"><tbody><SkeletonTableRows /></tbody></table>
            </div>
          ) : filteredEntries.length === 0 ? (
            <EmptyState icon="📋" title="Sin movimientos" description="No hay registros financieros en este período con los filtros aplicados."
              action={{ label: '➕ Nuevo registro', onClick: () => setShowNewEntry(true) }} />
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2.5 text-left font-dm font-medium text-muted-foreground text-xs">Fecha</th>
                      <th className="px-3 py-2.5 text-left font-dm font-medium text-muted-foreground text-xs">Tipo</th>
                      <th className="px-3 py-2.5 text-left font-dm font-medium text-muted-foreground text-xs">Categoría</th>
                      <th className="px-3 py-2.5 text-left font-dm font-medium text-muted-foreground text-xs">Descripción</th>
                      <th className="px-3 py-2.5 text-left font-dm font-medium text-muted-foreground text-xs">Máquina</th>
                      <th className="px-3 py-2.5 text-left font-dm font-medium text-muted-foreground text-xs">Proyecto</th>
                      <th className="px-3 py-2.5 text-left font-dm font-medium text-muted-foreground text-xs">Factura</th>
                      <th className="px-3 py-2.5 text-right font-dm font-medium text-muted-foreground text-xs">Monto</th>
                      <th className="px-3 py-2.5 text-right font-dm font-medium text-muted-foreground text-xs">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map(e => {
                      const cat = categories.find(c => c.id === e.category_id);
                      const machine = machines.find(m => m.id === e.machine_id);
                      const project = projects.find(p => p.id === e.project_id);
                      return (
                        <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" style={{ borderLeftWidth: 3, borderLeftColor: cat?.color ?? 'transparent' }}>
                          <td className="px-3 py-2 font-dm text-xs whitespace-nowrap">{formatDate(e.cost_date)}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={cn('text-[10px]', e.entry_type === 'ingreso' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
                              {e.entry_type === 'ingreso' ? '💰 Ingreso' : '📤 Gasto'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-dm text-xs">{cat ? `${cat.icon} ${cat.name}` : '—'}</td>
                          <td className="px-3 py-2 font-dm text-xs max-w-[200px] truncate">{e.description ?? '—'}</td>
                          <td className="px-3 py-2 font-dm text-xs">{machine ? `${machine.name}` : '—'}</td>
                          <td className="px-3 py-2 font-dm text-xs">{project?.name ?? '—'}</td>
                          <td className="px-3 py-2 font-dm text-xs">{e.invoice_number ?? '—'}</td>
                          <td className={cn('px-3 py-2 text-right font-barlow font-bold text-sm whitespace-nowrap', e.entry_type === 'ingreso' ? 'text-emerald-600' : 'text-red-600')}>
                            {e.entry_type === 'ingreso' ? '+' : '-'}{formatCOP(Number(e.amount))}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditEntry(e)} aria-label="Editar">
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget(e)} aria-label="Eliminar">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Footer totals */}
              <div className="flex flex-wrap gap-4 text-xs font-dm text-muted-foreground">
                <span>{filteredEntries.length} registros</span>
                <span>Ingresos: <strong className="text-emerald-600">{formatCOP(totals.totalIncome)}</strong></span>
                <span>Gastos: <strong className="text-red-600">{formatCOP(totals.totalExpense)}</strong></span>
                <span>Utilidad: <strong className={totals.profit >= 0 ? 'text-primary' : 'text-destructive'}>{formatCOP(totals.profit)}</strong></span>
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══ TAB: POR MÁQUINA ═══ */}
        <TabsContent value="maquina" className="space-y-3 mt-4">
          {entriesLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>
          ) : machineFinancials.length === 0 ? (
            <EmptyState icon="🏭" title="Sin datos por máquina" description="Los registros financieros vinculados a máquinas aparecerán aquí." />
          ) : (
            machineFinancials.map(m => <MachineFinancialCard key={m.id} item={m} entries={entries} categories={categories} onNewEntry={() => { setShowNewEntry(true); }} />)
          )}
        </TabsContent>

        {/* ═══ TAB: POR PROYECTO ═══ */}
        <TabsContent value="proyecto" className="space-y-3 mt-4">
          {entriesLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>
          ) : projectFinancials.length === 0 ? (
            <EmptyState icon="📁" title="Sin datos por proyecto" description="Los registros financieros vinculados a proyectos aparecerán aquí." />
          ) : (
            projectFinancials.map(p => <ProjectFinancialCard key={p.id} item={p} entries={entries} categories={categories} />)
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Modals ─── */}
      <EntryFormModal
        open={showNewEntry || !!editEntry}
        onClose={() => { setShowNewEntry(false); setEditEntry(null); }}
        entry={editEntry}
        categories={categories}
        machines={machines}
        projects={projects}
        suppliers={suppliers}
        workOrders={workOrders}
        tenantId={user?.tenant_id ?? ''}
        userId={user?.id ?? ''}
      />

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        categories={categories}
        machines={machines}
        projects={projects}
        tenantId={user?.tenant_id ?? ''}
        userId={user?.id ?? ''}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMut.mutateAsync(deleteTarget.id);
            await log('financiero', 'eliminar_movimiento', 'cost_entry', deleteTarget.id, deleteTarget.description ?? '');
          }
          setDeleteTarget(null);
        }}
        title="Eliminar registro"
        message="¿Eliminar este registro financiero? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={deleteMut.isPending}
      />
    </div>
  );
}

// ─── MarginBadge ───
function MarginBadge({ margin }: { margin: number }) {
  const color = margin > 40 ? 'bg-emerald-50 text-emerald-700' :
    margin > 20 ? 'bg-amber-50 text-amber-700' :
    margin > 0 ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700';
  return <Badge variant="outline" className={cn('text-[10px] ml-1', color)}>{margin.toFixed(0)}%</Badge>;
}

// ─── Machine Financial Card ───
function MachineFinancialCard({ item, entries, categories, onNewEntry }: {
  item: { id: string; name: string; code: string; type: string; income: number; expense: number };
  entries: FinancialEntry[];
  categories: FinancialCategory[];
  onNewEntry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const profit = item.income - item.expense;
  const margin = item.income > 0 ? ((profit / item.income) * 100) : 0;
  const machineEntries = useMemo(() => entries.filter(e => e.machine_id === item.id).slice(0, 5), [entries, item.id]);

  // Category breakdown for this machine
  const catBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    entries.filter(e => e.machine_id === item.id && e.entry_type === 'gasto').forEach(e => {
      const cat = categories.find(c => c.id === e.category_id);
      const name = cat?.name ?? 'Otros';
      const color = cat?.color ?? '#6B7280';
      if (!map.has(name)) map.set(name, { name, value: 0, color });
      map.get(name)!.value += Number(e.amount);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [entries, categories, item.id]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="font-dm font-medium text-sm">{item.name}</span>
        <span className="text-xs text-muted-foreground">[{item.code}]</span>
        <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
        <div className="flex-1" />
        <span className="text-xs font-dm text-emerald-600">{formatCOPShort(item.income)}</span>
        <span className="text-xs text-muted-foreground mx-1">|</span>
        <span className="text-xs font-dm text-red-600">{formatCOPShort(item.expense)}</span>
        <MarginBadge margin={margin} />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="💰 Ingresos" value={formatCOPShort(item.income)} />
            <StatCard label="📤 Gastos" value={formatCOPShort(item.expense)} />
            <StatCard label="📈 Utilidad" value={formatCOPShort(profit)} />
            <StatCard label="% Margen" value={`${margin.toFixed(1)}%`} />
          </div>

          {catBreakdown.length > 0 && (
            <div>
              <h4 className="text-xs font-dm font-semibold text-muted-foreground mb-2">Gastos por categoría</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={catBreakdown} layout="vertical">
                  <XAxis type="number" tickFormatter={v => formatCOPShort(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCOP(v)} />
                  <Bar dataKey="value" fill="hsl(var(--gold))">
                    {catBreakdown.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {machineEntries.length > 0 && (
            <div>
              <h4 className="text-xs font-dm font-semibold text-muted-foreground mb-2">Últimos movimientos</h4>
              <div className="space-y-1">
                {machineEntries.map(e => {
                  const cat = categories.find(c => c.id === e.category_id);
                  return (
                    <div key={e.id} className="flex items-center gap-2 text-xs font-dm py-1">
                      <span className="text-muted-foreground w-20">{formatDate(e.cost_date)}</span>
                      <Badge variant="outline" className={cn('text-[10px]', e.entry_type === 'ingreso' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
                        {e.entry_type}
                      </Badge>
                      <span className="truncate flex-1">{cat?.icon} {e.description}</span>
                      <span className={cn('font-barlow font-bold', e.entry_type === 'ingreso' ? 'text-emerald-600' : 'text-red-600')}>
                        {e.entry_type === 'ingreso' ? '+' : '-'}{formatCOP(Number(e.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Project Financial Card ───
function ProjectFinancialCard({ item, entries, categories }: {
  item: { id: string; name: string; budget: number | null; status: string | null; income: number; expense: number };
  entries: FinancialEntry[];
  categories: FinancialCategory[];
}) {
  const [expanded, setExpanded] = useState(false);
  const profit = item.income - item.expense;
  const margin = item.income > 0 ? ((profit / item.income) * 100) : 0;
  const budgetPct = item.budget && item.budget > 0 ? (item.expense / item.budget * 100) : null;
  const projectEntries = useMemo(() => entries.filter(e => e.project_id === item.id).slice(0, 5), [entries, item.id]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
        <span className="font-dm font-medium text-sm">{item.name}</span>
        <div className="flex-1" />
        {budgetPct !== null && (
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full', budgetPct > 100 ? 'bg-destructive' : budgetPct > 80 ? 'bg-amber-500' : 'bg-primary')}
                style={{ width: `${Math.min(budgetPct, 100)}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{budgetPct.toFixed(0)}%</span>
          </div>
        )}
        <span className="text-xs font-dm text-emerald-600">{formatCOPShort(item.income)}</span>
        <span className="text-xs text-muted-foreground mx-1">|</span>
        <span className="text-xs font-dm text-red-600">{formatCOPShort(item.expense)}</span>
        <MarginBadge margin={margin} />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="💰 Ingresos" value={formatCOPShort(item.income)} />
            <StatCard label="📤 Gastos" value={formatCOPShort(item.expense)} />
            <StatCard label="📈 Utilidad" value={formatCOPShort(profit)} />
            <StatCard label="🎯 Presupuesto" value={item.budget ? formatCOPShort(item.budget) : 'N/A'} />
          </div>

          {item.budget && item.budget > 0 && (
            <div>
              <div className="flex justify-between text-xs font-dm mb-1">
                <span>Presupuesto ejecutado</span>
                <span className={budgetPct! > 100 ? 'text-destructive font-bold' : ''}>{budgetPct!.toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', budgetPct! > 100 ? 'bg-destructive' : budgetPct! > 80 ? 'bg-amber-500' : 'bg-primary')}
                  style={{ width: `${Math.min(budgetPct!, 100)}%` }} />
              </div>
            </div>
          )}

          {projectEntries.length > 0 && (
            <div>
              <h4 className="text-xs font-dm font-semibold text-muted-foreground mb-2">Últimos movimientos</h4>
              <div className="space-y-1">
                {projectEntries.map(e => {
                  const cat = categories.find(c => c.id === e.category_id);
                  return (
                    <div key={e.id} className="flex items-center gap-2 text-xs font-dm py-1">
                      <span className="text-muted-foreground w-20">{formatDate(e.cost_date)}</span>
                      <Badge variant="outline" className={cn('text-[10px]', e.entry_type === 'ingreso' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
                        {e.entry_type}
                      </Badge>
                      <span className="truncate flex-1">{cat?.icon} {e.description}</span>
                      <span className={cn('font-barlow font-bold', e.entry_type === 'ingreso' ? 'text-emerald-600' : 'text-red-600')}>
                        {e.entry_type === 'ingreso' ? '+' : '-'}{formatCOP(Number(e.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entry Form Modal ───
function EntryFormModal({ open, onClose, entry, categories, machines, projects, suppliers, workOrders, tenantId, userId }: {
  open: boolean;
  onClose: () => void;
  entry: FinancialEntry | null;
  categories: FinancialCategory[];
  machines: any[];
  projects: any[];
  suppliers: any[];
  workOrders: any[];
  tenantId: string;
  userId: string;
}) {
  const { toast } = useToast();
  const { log } = useLog();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [entryType, setEntryType] = useState<'ingreso' | 'gasto'>(entry?.entry_type as any ?? 'gasto');
  const [costDate, setCostDate] = useState(entry?.cost_date ?? format(new Date(), 'yyyy-MM-dd'));
  const [categoryId, setCategoryId] = useState(entry?.category_id ?? '');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [creatingCat, setCreatingCat] = useState(false);
  const [description, setDescription] = useState(entry?.description ?? '');
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [machineId, setMachineId] = useState(entry?.machine_id ?? '');
  const [projectId, setProjectId] = useState(entry?.project_id ?? '');
  const [supplierId, setSupplierId] = useState(entry?.supplier_id ?? '');
  const [workOrderId, setWorkOrderId] = useState(entry?.work_order_id ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(entry?.invoice_number ?? '');
  const [invoiceUrl, setInvoiceUrl] = useState(entry?.invoice_url ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');

  // Reset when entry changes
  const resetForm = useCallback(() => {
    setEntryType(entry?.entry_type as any ?? 'gasto');
    setCostDate(entry?.cost_date ?? format(new Date(), 'yyyy-MM-dd'));
    setCategoryId(entry?.category_id ?? '');
    setDescription(entry?.description ?? '');
    setAmount(entry ? String(entry.amount) : '');
    setMachineId(entry?.machine_id ?? '');
    setProjectId(entry?.project_id ?? '');
    setSupplierId(entry?.supplier_id ?? '');
    setWorkOrderId(entry?.work_order_id ?? '');
    setInvoiceNumber(entry?.invoice_number ?? '');
    setInvoiceUrl(entry?.invoice_url ?? '');
    setNotes(entry?.notes ?? '');
  }, [entry]);

  // When OT selected, auto-fill machine
  const handleOTChange = (otId: string) => {
    setWorkOrderId(otId);
    if (otId) {
      const ot = workOrders.find(w => w.id === otId);
      if (ot?.machine_id) setMachineId(ot.machine_id);
    }
  };

  const filteredCategories = categories.filter(c => c.type === entryType);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const { data, error } = await supabase.from('financial_categories').insert({
        tenant_id: tenantId,
        name: newCatName.trim(),
        type: entryType,
        icon: newCatIcon,
        color: entryType === 'ingreso' ? '#D4881E' : '#C0392B',
        is_default: false,
        active: true,
      }).select().single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
      setCategoryId(data.id);
      setNewCatName('');
      setShowNewCategory(false);
      toast({ title: `Categoría "${data.name}" creada` });
    } catch (err: any) {
      toast({ title: 'Error creando categoría', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingCat(false);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim() || !amount || !costDate) {
      toast({ title: 'Completa los campos obligatorios', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        tenant_id: tenantId,
        entry_type: entryType,
        cost_date: costDate,
        cost_type: 'general',
        description: description.trim(),
        amount: Math.round(parseFloat(amount)),
        category_id: categoryId || null,
        machine_id: machineId || null,
        project_id: projectId || null,
        supplier_id: supplierId || null,
        work_order_id: workOrderId || null,
        invoice_number: invoiceNumber || null,
        invoice_url: invoiceUrl || null,
        notes: notes || null,
        source: entry ? 'manual_edit' : 'manual',
        created_by: userId,
      };

      if (entry) {
        const { error } = await supabase.from('cost_entries').update(payload).eq('id', entry.id);
        if (error) throw error;
        await log('financiero', 'editar_movimiento', 'cost_entry', entry.id, description);
        toast({ title: '✏️ Registro actualizado' });
      } else {
        const { error } = await supabase.from('cost_entries').insert(payload);
        if (error) throw error;
        await log('financiero', 'registrar_movimiento', 'cost_entry', undefined, description);
        toast({ title: entryType === 'ingreso' ? '💰 Ingreso registrado' : '📤 Gasto registrado' });
      }

      queryClient.invalidateQueries({ queryKey: ['financials'] });
      onClose();
      resetForm();
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow">{entry ? 'Editar movimiento' : 'Registrar movimiento financiero'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setEntryType('ingreso')}
              className={cn('p-3 rounded-lg border-2 text-center font-dm font-medium transition-colors',
                entryType === 'ingreso' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-border hover:border-muted-foreground')}>
              💰 INGRESO
            </button>
            <button onClick={() => setEntryType('gasto')}
              className={cn('p-3 rounded-lg border-2 text-center font-dm font-medium transition-colors',
                entryType === 'gasto' ? 'border-red-500 bg-red-50 text-red-700' : 'border-border hover:border-muted-foreground')}>
              📤 GASTO
            </button>
          </div>

          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-dm text-xs">Fecha *</Label>
              <Input type="date" value={costDate} onChange={e => setCostDate(e.target.value)} className="font-dm" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="font-dm text-xs">Categoría *</Label>
                <button type="button" onClick={() => setShowNewCategory(!showNewCategory)}
                  className="text-xs text-primary hover:underline font-dm">
                  {showNewCategory ? 'Cancelar' : '+ Nueva'}
                </button>
              </div>
              {showNewCategory ? (
                <div className="flex gap-2">
                  <Select value={newCatIcon} onValueChange={setNewCatIcon}>
                    <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['📦','💰','⚙️','📋','🎯','🔩','🛢️','⛽','🏭','👷','🔧','🚚','🧴','➕'].map(icon => (
                        <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Nombre categoría" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="flex-1 font-dm text-sm" />
                  <Button size="sm" onClick={handleCreateCategory} disabled={creatingCat || !newCatName.trim()}>
                    {creatingCat ? '...' : '✓'}
                  </Button>
                </div>
              ) : (
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-dm text-xs">Descripción *</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)}
                placeholder={entryType === 'ingreso' ? 'Alquiler JCB T6 — Parque Solar' : 'Cambio filtro hidráulico'}
                className="font-dm" />
            </div>
            <div>
              <Label className="font-dm text-xs">Monto (COP) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="font-dm" min="0" />
            </div>
          </div>

          {/* Row 3 - Cost centers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-dm text-xs">Máquina</Label>
              <Select value={machineId || '__none__'} onValueChange={v => setMachineId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sin máquina" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin máquina</SelectItem>
                  {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name} [{m.internal_code}]</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-dm text-xs">Proyecto</Label>
              <Select value={projectId || '__none__'} onValueChange={v => setProjectId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin proyecto</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {machineId && projectId && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
              ℹ️ Este registro aparecerá en el centro de costos de la máquina Y del proyecto. Sin duplicación.
            </p>
          )}

          {/* Row 4 */}
          <div className="grid grid-cols-2 gap-4">
            {entryType === 'gasto' && (
              <div>
                <Label className="font-dm text-xs">Proveedor</Label>
                <Select value={supplierId || '__none__'} onValueChange={v => setSupplierId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin proveedor</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="font-dm text-xs">OT vinculada</Label>
              <Select value={workOrderId || '__none__'} onValueChange={v => handleOTChange(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sin OT" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin OT</SelectItem>
                  {workOrders.map(w => <SelectItem key={w.id} value={w.id}>{w.code} · {w.type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-dm text-xs">Número de factura</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="FV-00123" className="font-dm" />
            </div>
            <div>
              <Label className="font-dm text-xs">URL factura</Label>
              <Input value={invoiceUrl} onChange={e => setInvoiceUrl(e.target.value)} placeholder="https://..." className="font-dm" />
            </div>
          </div>

          <div>
            <Label className="font-dm text-xs">Notas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="font-dm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); resetForm(); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-primary hover:bg-primary/90">
            {loading ? 'Guardando...' : entry ? 'Actualizar' : entryType === 'ingreso' ? '💰 Registrar ingreso' : '📤 Registrar gasto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import Modal ───
function ImportModal({ open, onClose, categories, machines, projects, tenantId, userId }: {
  open: boolean;
  onClose: () => void;
  categories: FinancialCategory[];
  machines: any[];
  projects: any[];
  tenantId: string;
  userId: string;
}) {
  const { toast } = useToast();
  const { log } = useLog();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);

  // Mappings
  const [mapDate, setMapDate] = useState('');
  const [mapType, setMapType] = useState('');
  const [mapDescription, setMapDescription] = useState('');
  const [mapAmount, setMapAmount] = useState('');
  const [mapInvoice, setMapInvoice] = useState('');
  const [defaultType, setDefaultType] = useState<'ingreso' | 'gasto'>('gasto');
  const [globalMachineId, setGlobalMachineId] = useState('');
  const [globalProjectId, setGlobalProjectId] = useState('');

  const handleFile = async (file: File) => {
    setFileName(file.name);
    let data: any[];
    if (file.name.endsWith('.csv')) {
      data = await new Promise(resolve => {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => resolve(r.data) });
      });
    } else {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(sheet, { raw: false });
    }
    if (data.length > 0) {
      setRawData(data);
      setColumns(Object.keys(data[0]));

      // Auto-detect
      const cols = Object.keys(data[0]).map(c => c.toLowerCase());
      const dateCol = Object.keys(data[0]).find((_, i) => ['fecha', 'date'].some(k => cols[i].includes(k)));
      const amountCol = Object.keys(data[0]).find((_, i) => ['monto', 'valor', 'amount', 'total'].some(k => cols[i].includes(k)));
      const descCol = Object.keys(data[0]).find((_, i) => ['descripcion', 'description', 'detalle', 'concepto'].some(k => cols[i].includes(k)));
      const invoiceCol = Object.keys(data[0]).find((_, i) => ['factura', 'invoice', 'remision'].some(k => cols[i].includes(k)));
      if (dateCol) setMapDate(dateCol);
      if (amountCol) setMapAmount(amountCol);
      if (descCol) setMapDescription(descCol);
      if (invoiceCol) setMapInvoice(invoiceCol);

      setStep(2);
    }
  };

  const mappedRows = useMemo(() => {
    if (!mapDate || !mapAmount || !mapDescription) return [];
    return rawData.map((row, i) => {
      const rawDate = row[mapDate];
      const rawAmount = row[mapAmount];
      const parsedAmount = parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
      let parsedDate = '';
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) parsedDate = format(d, 'yyyy-MM-dd');
      } catch { /* invalid */ }
      return {
        idx: i,
        date: parsedDate,
        entry_type: mapType ? (row[mapType]?.toLowerCase().includes('ingreso') ? 'ingreso' : 'gasto') : defaultType,
        description: row[mapDescription] ?? '',
        amount: isNaN(parsedAmount) ? 0 : Math.round(Math.abs(parsedAmount)),
        invoice_number: mapInvoice ? row[mapInvoice] ?? '' : '',
        hasErrors: !parsedDate || isNaN(parsedAmount) || parsedAmount === 0,
        selected: !(!parsedDate || isNaN(parsedAmount) || parsedAmount === 0),
      };
    });
  }, [rawData, mapDate, mapAmount, mapDescription, mapType, mapInvoice, defaultType]);

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Initialize selectedRows when mappedRows changes
  useMemo(() => {
    setSelectedRows(new Set(mappedRows.filter(r => r.selected).map(r => r.idx)));
  }, [mappedRows]);

  const handleImport = async () => {
    const toImport = mappedRows.filter(r => selectedRows.has(r.idx) && !r.hasErrors);
    if (toImport.length === 0) {
      toast({ title: 'No hay filas válidas para importar', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const batchId = `excel_import_${new Date().toISOString()}`;
    try {
      const chunkSize = 100;
      let imported = 0;
      for (let i = 0; i < toImport.length; i += chunkSize) {
        const chunk = toImport.slice(i, i + chunkSize);
        const { error } = await supabase.from('cost_entries').insert(
          chunk.map(r => ({
            tenant_id: tenantId,
            entry_type: r.entry_type,
            cost_date: r.date,
            cost_type: 'general',
            description: r.description,
            amount: r.amount,
            invoice_number: r.invoice_number || null,
            machine_id: globalMachineId || null,
            project_id: globalProjectId || null,
            imported_from: batchId,
            source: 'import',
            created_by: userId,
          }))
        );
        if (!error) imported += chunk.length;
      }
      await log('financiero', 'importar_excel', 'cost_entries', undefined, `${imported} registros importados`);
      toast({ title: `✅ ${imported} registros importados correctamente` });
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      onClose();
      setStep(1);
      setRawData([]);
    } catch (err: any) {
      toast({ title: 'Error al importar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setStep(1); setRawData([]); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow">📥 Importar Excel/CSV — Paso {step} de 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="text-5xl">📄</div>
            <p className="font-dm text-sm text-muted-foreground">Arrastra tu archivo Excel o CSV aquí</p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="font-dm text-sm" />
            <p className="text-xs text-muted-foreground">Formatos: .xlsx, .xls, .csv</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-dm text-muted-foreground">Archivo: <strong>{fileName}</strong> · {rawData.length} filas · {columns.length} columnas</p>
            <div className="grid gap-3">
              {[
                { label: 'Fecha *', value: mapDate, set: setMapDate },
                { label: 'Descripción *', value: mapDescription, set: setMapDescription },
                { label: 'Monto *', value: mapAmount, set: setMapAmount },
                { label: 'Tipo (ingreso/gasto)', value: mapType, set: setMapType },
                { label: 'Factura', value: mapInvoice, set: setMapInvoice },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="text-xs font-dm w-40">{f.label}</span>
                  <Select value={f.value || '__none__'} onValueChange={v => f.set(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Seleccionar columna" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— No mapear —</SelectItem>
                      {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!mapType && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-dm w-40">Tipo por defecto:</span>
                <div className="flex gap-2">
                  {(['ingreso', 'gasto'] as const).map(t => (
                    <button key={t} onClick={() => setDefaultType(t)}
                      className={cn('px-3 py-1 rounded-full text-xs font-dm', defaultType === t ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                      {t === 'ingreso' ? '💰 Ingresos' : '📤 Gastos'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Asignar a máquina</Label>
                <Select value={globalMachineId || '__none__'} onValueChange={v => setGlobalMachineId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin máquina" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin máquina</SelectItem>
                    {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Asignar a proyecto</Label>
                <Select value={globalProjectId || '__none__'} onValueChange={v => setGlobalProjectId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin proyecto</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>← Atrás</Button>
              <Button onClick={() => setStep(3)} disabled={!mapDate || !mapAmount || !mapDescription}
                className="bg-primary hover:bg-primary/90">
                Revisar datos →
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-dm text-muted-foreground">
              {selectedRows.size} filas seleccionadas ·
              Total: <strong>{formatCOP(mappedRows.filter(r => selectedRows.has(r.idx)).reduce((s, r) => s + r.amount, 0))}</strong>
            </p>

            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">✓</th>
                    <th className="px-2 py-1.5 text-left">Fecha</th>
                    <th className="px-2 py-1.5 text-left">Tipo</th>
                    <th className="px-2 py-1.5 text-left">Descripción</th>
                    <th className="px-2 py-1.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.map(r => (
                    <tr key={r.idx} className={cn('border-b border-border/50', r.hasErrors && 'bg-red-50')}>
                      <td className="px-2 py-1">
                        <input type="checkbox" checked={selectedRows.has(r.idx)} disabled={r.hasErrors}
                          onChange={e => {
                            const next = new Set(selectedRows);
                            e.target.checked ? next.add(r.idx) : next.delete(r.idx);
                            setSelectedRows(next);
                          }} />
                      </td>
                      <td className="px-2 py-1">{r.date || '⚠️ Inválida'}</td>
                      <td className="px-2 py-1">
                        <Badge variant="outline" className={cn('text-[9px]', r.entry_type === 'ingreso' ? 'text-emerald-700' : 'text-red-700')}>
                          {r.entry_type}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 max-w-[200px] truncate">{r.description}</td>
                      <td className="px-2 py-1 text-right font-barlow font-bold">{r.amount > 0 ? formatCOP(r.amount) : '⚠️'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>← Atrás</Button>
              <Button onClick={handleImport} disabled={loading || selectedRows.size === 0}
                className="bg-primary hover:bg-primary/90">
                {loading ? 'Importando...' : `✅ Importar ${selectedRows.size} registros`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
