import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { deleteWorkOrders } from '@/lib/cascade-delete';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { useChrono, useOTTimerStore } from '@/stores/otTimerStore';
import { format, differenceInSeconds } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Plus, Search, Wrench, Eye, UserPlus, Download, Trash2, Edit, ChevronDown, ChevronUp, ArrowUpDown, Calendar, X, Settings } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ─── PROBLEM CHECKBOXES ───
const PROBLEM_OPTIONS: Record<string, string[]> = {
  preventivo: ['Cambio de aceite motor', 'Cambio filtro hidráulico', 'Cambio filtro de aire', 'Revisión sistema hidráulico', 'Engrase general', 'Revisión eléctrica', 'Revisión frenos', 'Revisión llantas'],
  correctivo: ['Fuga hidráulica', 'Falla eléctrica', 'Problema de frenos', 'Falla en boom/pluma', 'Motor no arranca', 'Falla en transmisión', 'Daño estructural', 'Problema de dirección'],
  inspeccion: ['Inspección pre-entrega a cliente', 'Inspección post-proyecto', 'Inspección por seguridad HSEQ', 'Revisión de horómetro'],
  preparacion: ['Limpieza general', 'Pintura y acabados', 'Instalación de accesorios', 'Configuración para proyecto'],
};

const TYPE_ICONS: Record<string, string> = { preventivo: '🔄', correctivo: '🔧', inspeccion: '🔍', preparacion: '⚙️' };
const TYPE_LABELS: Record<string, string> = { preventivo: 'Preventivo', correctivo: 'Correctivo', inspeccion: 'Inspección', preparacion: 'Preparación' };
const TYPE_DESC: Record<string, string> = { preventivo: 'Mantenimiento programado', correctivo: 'Reparación de falla', inspeccion: 'Revisión técnica', preparacion: 'Alistamiento de equipo' };

const STATUS_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'creada', label: 'Creadas' },
  { value: 'asignada', label: 'Asignadas' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'pausada', label: 'Pausadas' },
  { value: 'cerrada', label: 'Cerradas' },
  { value: 'firmada', label: 'Firmadas' },
];

const LOCATION_BADGES: Record<string, { icon: string; label: string }> = {
  bodega_propia: { icon: '🏠', label: 'Bodega' },
  campo_directo: { icon: '📍', label: 'Campo' },
  taller_tercero: { icon: '🔧', label: 'Taller' },
};

const TIMELINE_STEPS = ['creada', 'asignada', 'en_curso', 'cerrada', 'firmada'];

const PHASE_LABELS: Record<string, string> = { antes: 'Antes', durante: 'Durante', despues: 'Después' };

function formatCost(n: number) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── CHRONO PILL ───
function ChronoPill({ otId }: { otId: string }) {
  const display = useChrono();
  const activeOTId = useOTTimerStore((s) => s.activeOTId);
  const status = useOTTimerStore((s) => s.status);
  if (activeOTId !== otId || status === 'idle') return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-barlow font-semibold',
      status === 'running' ? 'bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-bright))]' : 'bg-muted text-muted-foreground'
    )}>
      ⏱ {display}
    </span>
  );
}

// ─── COMPLETION PILL ───
function CompletionPill({ percentage }: { percentage: number }) {
  const color = percentage >= 80 ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]' :
    percentage >= 40 ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#FDDEDE] text-[#C0392B]';
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-barlow font-semibold', color)}>{percentage}%</span>;
}

// ─── MAIN ───
export default function OrdenesTrabajo() {
  usePageTitle('Órdenes de Trabajo');
  const { user } = useAuthStore();
  const { log } = useLog();
  const qc = useQueryClient();
  const tenantId = user?.tenant_id;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortCol, setSortCol] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOT, setDetailOT] = useState<any>(null);
  const [selectedOTs, setSelectedOTs] = useState<string[]>([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const bulkDeleteOTs = useMutation({
    mutationFn: async (ids: string[]) => { await deleteWorkOrders(ids); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      toast.success(`${selectedOTs.length} OT(s) eliminada(s)`);
      setSelectedOTs([]);
      setShowBulkDelete(false);
    },
    onError: (err) => {
      console.error('Bulk delete OTs error:', err);
      toast.error('Error al eliminar. Algunas OTs pueden tener dependencias.');
    },
  });

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['work-orders', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`*, machines!work_orders_machine_id_fkey(name, internal_code, status, type), projects!work_orders_project_id_fkey(name), suppliers!work_orders_supplier_id_fkey(name)`)
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: otTechnicians = {} } = useQuery({
    queryKey: ['work-order-technicians', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_technicians')
        .select('work_order_id, personnel!work_order_technicians_personnel_id_fkey(full_name)');
      if (error) throw error;
      const map: Record<string, string[]> = {};
      (data || []).forEach((row: any) => {
        if (!map[row.work_order_id]) map[row.work_order_id] = [];
        map[row.work_order_id].push(row.personnel?.full_name || '');
      });
      return map;
    },
    enabled: !!tenantId,
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let result = [...workOrders];
    // Filters
    if (statusFilter !== 'all') result = result.filter((ot: any) => ot.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter((ot: any) => ot.type === typeFilter);
    if (priorityFilter !== 'all') result = result.filter((ot: any) => ot.priority === priorityFilter);
    if (dateFrom) result = result.filter((ot: any) => ot.created_at >= dateFrom);
    if (dateTo) result = result.filter((ot: any) => ot.created_at <= dateTo + 'T23:59:59');
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((ot: any) => {
        const mn = ot.machines?.name?.toLowerCase() || '';
        const pn = ot.projects?.name?.toLowerCase() || '';
        return ot.code.toLowerCase().includes(s) || mn.includes(s) || pn.includes(s);
      });
    }
    // Sort
    result.sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortCol) {
        case 'code': va = a.code; vb = b.code; break;
        case 'machine': va = a.machines?.name || ''; vb = b.machines?.name || ''; break;
        case 'type': va = a.type; vb = b.type; break;
        case 'priority': { const o: Record<string, number> = { critica: 1, urgente: 2, normal: 3 }; va = o[a.priority] || 3; vb = o[b.priority] || 3; break; }
        case 'status': va = TIMELINE_STEPS.indexOf(a.status); vb = TIMELINE_STEPS.indexOf(b.status); break;
        case 'hours': va = a.actual_hours || 0; vb = b.actual_hours || 0; break;
        case 'cost': va = a.total_cost || 0; vb = b.total_cost || 0; break;
        default: va = a.created_at; vb = b.created_at;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [workOrders, statusFilter, typeFilter, priorityFilter, dateFrom, dateTo, search, sortCol, sortDir]);

  const handleExport = () => {
    const rows = filtered.map((ot: any) => [
      ot.code, ot.machines?.name || '', ot.type, ot.priority, ot.status,
      ot.actual_hours || '', ot.total_cost || '', ot.created_at ? format(new Date(ot.created_at), 'dd/MM/yyyy') : ''
    ]);
    const header = 'Código,Máquina,Tipo,Prioridad,Estado,Horas,Costo,Fecha';
    const csv = header + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ordenes-trabajo.csv'; a.click();
  };

  const SortableHead = ({ col, children, className }: { col: string; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn("cursor-pointer select-none", className)} onClick={() => toggleSort(col)}>
      <span className="inline-flex items-center gap-1">{children} <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* ActionBar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por código, máquina..." className="flex-shrink-0 w-full sm:w-auto" />
        <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-full sm:w-36 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-full sm:w-32 text-xs"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-32 text-xs" placeholder="Desde" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-32 text-xs" placeholder="Hasta" />
          {(dateFrom || dateTo) && <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => { setDateFrom(''); setDateTo(''); }}><X className="h-3.5 w-3.5" /></Button>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowTemplates(true)} title="Gestionar plantillas de tareas"><Settings className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button size="sm" className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Nueva OT</span>
          </Button>
        </div>
      </div>

      {/* Bulk selection bar */}
      {selectedOTs.length > 0 && (
        <div className="flex items-center justify-between bg-primary/5 px-4 py-2 rounded-lg border border-primary/30">
          <span className="text-sm font-dm font-medium">{selectedOTs.length} seleccionada{selectedOTs.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedOTs([])}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={() => setShowBulkDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar ({selectedOTs.length})
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground font-dm">No hay órdenes de trabajo</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-[11px] font-barlow uppercase">
                <TableHead className="w-10">
                  <input type="checkbox"
                    checked={selectedOTs.length === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedOTs(e.target.checked ? filtered.map((o: any) => o.id) : [])}
                    className="h-3.5 w-3.5 rounded border-border" />
                </TableHead>
                <SortableHead col="code">Código</SortableHead>
                <SortableHead col="machine">Máquina</SortableHead>
                <SortableHead col="type">Tipo</SortableHead>
                <SortableHead col="priority">Prioridad</SortableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead className="hidden md:table-cell">Ubicación</TableHead>
                <SortableHead col="status">Estado</SortableHead>
                <SortableHead col="hours" className="hidden md:table-cell">Horas</SortableHead>
                <SortableHead col="cost" className="hidden md:table-cell">Costo</SortableHead>
                <SortableHead col="created_at" className="hidden md:table-cell">Fecha</SortableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ot: any) => {
                const techs = otTechnicians[ot.id] || [];
                const loc = LOCATION_BADGES[ot.location_type] || { icon: '', label: '' };
                return (
                  <TableRow key={ot.id} className={cn("h-11 cursor-pointer hover:bg-muted/50", selectedOTs.includes(ot.id) && "bg-primary/5")} onClick={() => setDetailOT(ot)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedOTs.includes(ot.id)}
                        onChange={e => setSelectedOTs(e.target.checked ? [...selectedOTs, ot.id] : selectedOTs.filter(x => x !== ot.id))}
                        className="h-3.5 w-3.5 rounded border-border" />
                    </TableCell>
                    <TableCell className="font-barlow text-[hsl(var(--gold-bright))] font-semibold text-[13px]">{ot.code}</TableCell>
                    <TableCell className="text-xs font-dm">
                      {ot.machines ? <span>[{ot.machines.internal_code}] {ot.machines.name}</span> : '—'}
                    </TableCell>
                    <TableCell><TypeBadge type={ot.type} /></TableCell>
                    <TableCell><PriorityBadge priority={ot.priority} /></TableCell>
                    <TableCell className="text-xs font-dm max-w-[120px] truncate">
                      {ot.location_type === 'taller_tercero' ? <span>🏭 {ot.suppliers?.name || '—'}</span> :
                        techs.length > 0 ? (techs.length <= 2 ? techs.join(', ') : `${techs.slice(0, 2).join(', ')} +${techs.length - 2}`) : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-[11px] font-dm text-muted-foreground">{loc.icon} {loc.label}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={ot.status} />
                        {(ot.completion_percentage ?? 0) > 0 && <CompletionPill percentage={ot.completion_percentage} />}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-dm">
                      {ot.status === 'en_curso' ? <ChronoPill otId={ot.id} /> : ot.actual_hours ? `${ot.actual_hours}h` : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-dm">{formatCost(ot.total_cost)}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-dm text-muted-foreground">
                      {ot.created_at ? format(new Date(ot.created_at), 'dd MMM yy', { locale: es }) : ''}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setDetailOT(ot); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateOTModal open={createOpen} onClose={() => setCreateOpen(false)} tenantId={tenantId!} userId={user?.id!} />
      {detailOT && <DetailOTModal ot={detailOT} onClose={() => { setDetailOT(null); qc.invalidateQueries({ queryKey: ['work-orders'] }); }} tenantId={tenantId!} userId={user?.id!} />}
      {showTemplates && <TaskTemplatesModal open={showTemplates} onClose={() => setShowTemplates(false)} tenantId={tenantId!} />}

      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">⚠️ ¿Eliminar {selectedOTs.length} OT{selectedOTs.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">Esta acción es irreversible y eliminará técnicos, tareas, fotos y costos asociados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-dm" disabled={bulkDeleteOTs.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-dm"
              disabled={bulkDeleteOTs.isPending}
              onClick={e => { e.preventDefault(); bulkDeleteOTs.mutate(selectedOTs); }}>
              {bulkDeleteOTs.isPending ? 'Eliminando...' : `Eliminar ${selectedOTs.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── TYPE BADGE ───
function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    preventivo: 'bg-[#DBEAFE] text-[#1D4ED8]',
    correctivo: 'bg-[#FDDEDE] text-[#C0392B]',
    inspeccion: 'bg-[#D1FAE5] text-[#065F46]',
    preparacion: 'bg-[#FEF3C7] text-[#D97706]',
  };
  return (
    <span className={cn('inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm', styles[type] || 'bg-muted text-muted-foreground')}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

// ─── PRIORITY BADGE ───
function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'critica') return (
    <span className="inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm bg-[#FDDEDE] text-[#C0392B] animate-pulse-dot">🚨 Crítica</span>
  );
  if (priority === 'urgente') return (
    <span className="inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm bg-[#FFEDD5] text-[#EA580C]">⚡ Urgente</span>
  );
  return (
    <span className="inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm bg-muted text-muted-foreground">Normal</span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━
// CREATE OT MODAL (5 steps now)
// ━━━━━━━━━━━━━━━━━━━━━━━━
function CreateOTModal({ open, onClose, tenantId, userId }: { open: boolean; onClose: () => void; tenantId: string; userId: string }) {
  const { log } = useLog();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [machineId, setMachineId] = useState('');
  const [machineSearch, setMachineSearch] = useState('');
  const [otType, setOTType] = useState('');
  const [priority, setPriority] = useState('normal');

  // Step 2
  const [locationType, setLocationType] = useState('');
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [projectId, setProjectId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [externalCost, setExternalCost] = useState('');

  // Step 3
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [additionalDesc, setAdditionalDesc] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');

  // Step 4: Tasks
  const [selectedTasks, setSelectedTasks] = useState<{ name: string; description?: string; template_id?: string }[]>([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [customTaskName, setCustomTaskName] = useState('');

  // Step 5: Tools
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  // Queries
  const { data: machines = [] } = useQuery({
    queryKey: ['machines-ot', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('machines').select('*').eq('tenant_id', tenantId).order('name');
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians-ot', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('*').eq('tenant_id', tenantId).eq('type', 'tecnico').eq('status', 'activo').order('full_name');
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-ot', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('tenant_id', tenantId).eq('status', 'activo').order('name');
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-ot', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('*').eq('tenant_id', tenantId).eq('status', 'activo').order('name');
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const { data: tools = [] } = useQuery({
    queryKey: ['tools-ot', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_tools').select('*').eq('tenant_id', tenantId).eq('status', 'disponible').order('name');
      return data || [];
    },
    enabled: open && step === 5 && !!tenantId,
  });

  const { data: taskTemplates = [] } = useQuery({
    queryKey: ['task-templates', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('task_templates').select('*').eq('tenant_id', tenantId).eq('active', true).order('name');
      return data || [];
    },
    enabled: open && step === 4 && !!tenantId,
  });

  const filteredTemplates = taskTemplates.filter((t: any) => {
    if (!taskSearch) return true;
    return t.name.toLowerCase().includes(taskSearch.toLowerCase());
  });

  const selectedMachine = machines.find((m: any) => m.id === machineId);
  const filteredMachines = machines.filter((m: any) => {
    if (!machineSearch) return true;
    const s = machineSearch.toLowerCase();
    return m.name.toLowerCase().includes(s) || m.internal_code.toLowerCase().includes(s);
  });

  const resetForm = () => {
    setStep(1); setMachineId(''); setMachineSearch(''); setOTType(''); setPriority('normal');
    setLocationType(''); setSelectedTechnicians([]); setProjectId(''); setSupplierId(''); setExternalCost('');
    setSelectedProblems([]); setAdditionalDesc(''); setEstimatedHours(''); setSelectedTasks([]); setTaskSearch('');
    setCustomTaskName(''); setSelectedTools([]);
  };

  const addCustomTask = async () => {
    if (!customTaskName.trim()) return;
    // Create template if not exists
    const existing = taskTemplates.find((t: any) => t.name.toLowerCase() === customTaskName.trim().toLowerCase());
    if (!existing) {
      await supabase.from('task_templates').insert([{ tenant_id: tenantId, name: customTaskName.trim(), ot_type: otType || null }]);
    }
    setSelectedTasks(prev => [...prev, { name: customTaskName.trim(), template_id: existing?.id }]);
    setCustomTaskName('');
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const { count } = await supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      const code = `OT-${String((count || 0) + 1).padStart(3, '0')}`;

      const { data: ot, error } = await supabase.from('work_orders').insert([{
        tenant_id: tenantId, code, machine_id: machineId || null, type: otType as any,
        priority, location_type: locationType as any, supplier_id: supplierId || null,
        project_id: projectId || null, status: 'creada' as any,
        problem_description: [...selectedProblems, additionalDesc].filter(Boolean).join('\n'),
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        external_cost: externalCost ? parseFloat(externalCost) : 0,
        created_by: userId,
      }]).select().single();
      if (error) throw error;

      // Assign technicians
      if (selectedTechnicians.length > 0 && ot) {
        await supabase.from('work_order_technicians').insert(
          selectedTechnicians.map(pid => ({ work_order_id: ot.id, personnel_id: pid }))
        );
        await supabase.from('work_orders').update({ status: 'asignada' as any }).eq('id', ot.id);
      }

      // Assign tasks
      if (selectedTasks.length > 0 && ot) {
        await supabase.from('work_order_tasks').insert(
          selectedTasks.map((t, i) => ({
            work_order_id: ot.id, tenant_id: tenantId, name: t.name,
            description: t.description || null, template_id: t.template_id || null,
            sort_order: i,
          }))
        );
      }

      // Assign tools
      if (selectedTools.length > 0 && ot) {
        await supabase.from('work_order_tools').insert(
          selectedTools.map(tid => ({ work_order_id: ot.id, tool_id: tid }))
        );
        await supabase.from('inventory_tools')
          .update({ status: 'en_uso' as any, assigned_to_ot: ot.id })
          .in('id', selectedTools);
      }

      await log('ordenes-trabajo', 'crear_ot', 'work_order', ot?.id, code);
      toast.success(`${code} creada correctamente`);
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      resetForm();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear OT');
    } finally {
      setSaving(false);
    }
  };

  const TOTAL_STEPS = 5;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-[680px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow text-lg">Nueva Orden de Trabajo</DialogTitle>
          <DialogDescription>Paso {step} de {TOTAL_STEPS}</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-xs font-barlow font-semibold border-2 transition-colors',
                s < step ? 'bg-[hsl(var(--gold))] border-[hsl(var(--gold))] text-white' :
                s === step ? 'border-[hsl(var(--gold))] text-[hsl(var(--gold-bright))]' :
                'border-border text-muted-foreground'
              )}>
                {s < step ? '✓' : s}
              </div>
              {s < TOTAL_STEPS && <div className={cn('w-6 h-0.5', s < step ? 'bg-[hsl(var(--gold))]' : 'bg-border')} />}
            </div>
          ))}
        </div>

        {/* Step 1: Machine & Type */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="font-barlow uppercase text-xs mb-2 block">Máquina</Label>
              <Input placeholder="Buscar máquina..." value={machineSearch} onChange={(e) => setMachineSearch(e.target.value)} className="mb-2 h-9 text-sm" />
              <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {filteredMachines.map((m: any) => (
                  <button key={m.id} onClick={() => setMachineId(m.id)}
                    className={cn('w-full text-left px-3 py-2 rounded-md text-sm font-dm flex items-center gap-2 transition-colors',
                      machineId === m.id ? 'bg-[hsl(var(--gold)/0.1)] border border-[hsl(var(--gold))]' : 'hover:bg-muted')}>
                    <StatusIndicator status={m.status} />
                    <span className="font-semibold text-xs">[{m.internal_code}]</span>
                    <span>{m.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground capitalize">{m.type?.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
              {selectedMachine && (
                <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border text-sm font-dm">
                  <p className="font-semibold">{selectedMachine.name} · {selectedMachine.internal_code}</p>
                  <p className="text-xs text-muted-foreground">⏱ {selectedMachine.horometer_current?.toLocaleString()} h horómetro</p>
                </div>
              )}
            </div>
            <div>
              <Label className="font-barlow uppercase text-xs mb-2 block">Tipo de OT</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setOTType(k)}
                    className={cn('p-3 rounded-lg border-2 text-center transition-colors',
                      otType === k ? 'border-[hsl(var(--gold))] bg-[#FEF3C7]' : 'border-border hover:bg-muted')}>
                    <span className="text-2xl block">{TYPE_ICONS[k]}</span>
                    <span className="font-barlow text-sm font-semibold block mt-1">{v}</span>
                    <span className="text-[11px] text-muted-foreground font-dm">{TYPE_DESC[k]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="font-barlow uppercase text-xs mb-2 block">Prioridad</Label>
              <div className="flex gap-2">
                {['normal', 'urgente', 'critica'].map((p) => (
                  <button key={p} onClick={() => setPriority(p)}
                    className={cn('flex-1 py-2 rounded-lg border-2 text-sm font-dm font-semibold capitalize transition-colors',
                      priority === p ? (p === 'critica' ? 'border-[#EF4444] bg-[#FDDEDE] text-[#C0392B]' : p === 'urgente' ? 'border-[#EA580C] bg-[#FFEDD5] text-[#EA580C]' : 'border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.1)]') : 'border-border hover:bg-muted')}>
                    {p === 'critica' ? '🚨 Crítica' : p === 'urgente' ? '⚡ Urgente' : 'Normal'}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full h-11 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase"
              disabled={!machineId || !otType} onClick={() => setStep(2)}>
              Siguiente →
            </Button>
          </div>
        )}

        {/* Step 2: Assignment */}
        {step === 2 && (
          <div className="space-y-4">
            <Label className="font-barlow uppercase text-xs block">Ubicación del trabajo</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.entries(LOCATION_BADGES).map(([k, v]) => (
                <button key={k} onClick={() => { setLocationType(k); setSelectedTechnicians([]); setSupplierId(''); }}
                  className={cn('p-3 rounded-lg border-2 text-center transition-colors',
                    locationType === k ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)]' : 'border-border hover:bg-muted')}>
                  <span className="text-xl block">{v.icon}</span>
                  <span className="font-barlow text-xs font-semibold mt-1 block">{v.label}</span>
                </button>
              ))}
            </div>
            {(locationType === 'bodega_propia' || locationType === 'campo_directo') && (
              <div>
                <Label className="font-barlow uppercase text-xs mb-2 block">Técnicos asignados</Label>
                <div className="flex flex-wrap gap-2">
                  {technicians.map((t: any) => (
                    <button key={t.id}
                      onClick={() => setSelectedTechnicians(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-dm border transition-colors',
                        selectedTechnicians.includes(t.id) ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.1)] font-semibold' : 'border-border hover:bg-muted')}>
                      {t.full_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {locationType === 'campo_directo' && (
              <div>
                <Label className="font-barlow uppercase text-xs mb-2 block">Proyecto vinculado</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(projects) ? projects : []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {locationType === 'taller_tercero' && (
              <>
                <div>
                  <Label className="font-barlow uppercase text-xs mb-2 block">Proveedor / Taller</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(suppliers) ? suppliers : []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-barlow uppercase text-xs mb-2 block">Costo externo estimado (COP)</Label>
                  <Input type="number" placeholder="500000" value={externalCost} onChange={(e) => setExternalCost(e.target.value)} className="h-9 text-sm" />
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 h-11" onClick={() => setStep(1)}>← Atrás</Button>
              <Button className="flex-1 h-11 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase"
                disabled={!locationType} onClick={() => setStep(3)}>Siguiente →</Button>
            </div>
          </div>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <div className="space-y-4">
            {otType && PROBLEM_OPTIONS[otType] && (
              <div>
                <Label className="font-barlow uppercase text-xs mb-2 block">Problemas / Tareas</Label>
                <div className="space-y-2">
                  {PROBLEM_OPTIONS[otType].map((prob) => (
                    <label key={prob} className="flex items-center gap-2 text-sm font-dm cursor-pointer">
                      <Checkbox checked={selectedProblems.includes(prob)}
                        onCheckedChange={(checked) => setSelectedProblems(prev => checked ? [...prev, prob] : prev.filter(p => p !== prob))} />
                      {prob}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label className="font-barlow uppercase text-xs mb-2 block">Descripción adicional</Label>
              <Textarea rows={4} placeholder="Describe con detalle la falla o trabajo a realizar..." value={additionalDesc} onChange={(e) => setAdditionalDesc(e.target.value)} />
            </div>
            <div>
              <Label className="font-barlow uppercase text-xs mb-2 block">Horas estimadas</Label>
              <Input type="number" step="0.5" placeholder="4.5" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="h-9 w-32 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 h-11" onClick={() => setStep(2)}>← Atrás</Button>
              <Button className="flex-1 h-11 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase" onClick={() => setStep(4)}>Siguiente →</Button>
            </div>
          </div>
        )}

        {/* Step 4: Tasks */}
        {step === 4 && (
          <div className="space-y-4">
            <Label className="font-barlow uppercase text-xs block">Tareas a realizar</Label>
            <div>
              <Input placeholder="Buscar plantilla de tarea..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)} className="h-9 text-sm mb-2" />
              {taskSearch && filteredTemplates.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2 mb-2">
                  {filteredTemplates.map((t: any) => (
                    <button key={t.id} onClick={() => {
                      if (!selectedTasks.find(st => st.template_id === t.id))
                        setSelectedTasks(prev => [...prev, { name: t.name, description: t.description, template_id: t.id }]);
                      setTaskSearch('');
                    }}
                      className="w-full text-left px-3 py-2 rounded-md text-sm font-dm hover:bg-muted flex items-center justify-between">
                      <span>{t.name}</span>
                      {t.estimated_minutes && <span className="text-[10px] text-muted-foreground">{t.estimated_minutes} min</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input placeholder="Tarea personalizada..." value={customTaskName} onChange={e => setCustomTaskName(e.target.value)} className="h-9 text-sm flex-1"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTask(); } }} />
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={addCustomTask} disabled={!customTaskName.trim()}>+ Agregar</Button>
            </div>

            {selectedTasks.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-barlow uppercase text-muted-foreground">Tareas seleccionadas ({selectedTasks.length})</p>
                {selectedTasks.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm font-dm">
                    <span>{t.name}</span>
                    <button onClick={() => setSelectedTasks(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 h-11" onClick={() => setStep(3)}>← Atrás</Button>
              <Button className="flex-1 h-11 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase" onClick={() => setStep(5)}>Siguiente →</Button>
            </div>
          </div>
        )}

        {/* Step 5: Tools & Confirm */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <Label className="font-barlow uppercase text-xs mb-2 block">Herramientas requeridas (opcional)</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {(Array.isArray(tools) ? tools : []).map((t: any) => (
                  <button key={t.id}
                    onClick={() => setSelectedTools(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-dm border transition-colors',
                      selectedTools.includes(t.id) ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.1)] font-semibold' : 'border-border hover:bg-muted')}>
                    {t.internal_code ? `[${t.internal_code}] ` : ''}{t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-1 text-sm font-dm">
              <p className="font-barlow font-semibold text-xs uppercase text-muted-foreground mb-2">Resumen</p>
              <p><span className="text-muted-foreground">Máquina:</span> {selectedMachine ? `[${selectedMachine.internal_code}] ${selectedMachine.name}` : '—'}</p>
              <p><span className="text-muted-foreground">Tipo:</span> {TYPE_LABELS[otType]} · <span className="text-muted-foreground">Prioridad:</span> {priority}</p>
              <p><span className="text-muted-foreground">Ubicación:</span> {LOCATION_BADGES[locationType]?.label}</p>
              {selectedTechnicians.length > 0 && <p><span className="text-muted-foreground">Técnicos:</span> {technicians.filter((t: any) => selectedTechnicians.includes(t.id)).map((t: any) => t.full_name).join(', ')}</p>}
              {selectedProblems.length > 0 && <p><span className="text-muted-foreground">Problemas:</span> {selectedProblems.join(', ')}</p>}
              {selectedTasks.length > 0 && <p><span className="text-muted-foreground">Tareas:</span> {selectedTasks.map(t => t.name).join(', ')}</p>}
              {estimatedHours && <p><span className="text-muted-foreground">Horas estimadas:</span> {estimatedHours}h</p>}
              {selectedTools.length > 0 && <p><span className="text-muted-foreground">Herramientas:</span> {selectedTools.length} seleccionadas</p>}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 h-11" onClick={() => setStep(4)}>← Atrás</Button>
              <Button className="flex-1 h-12 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase text-sm"
                disabled={saving} onClick={handleCreate}>
                {saving ? 'Creando...' : 'Crear Orden de Trabajo'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━
// DETAIL OT MODAL (enhanced with realtime, notes, tasks, photos tabs, edit, delete)
// ━━━━━━━━━━━━━━━━━━━━━━━━
function DetailOTModal({ ot: initialOT, onClose, tenantId, userId }: { ot: any; onClose: () => void; tenantId: string; userId: string }) {
  const { log } = useLog();
  const qc = useQueryClient();
  const [supervisorNotes, setSupervisorNotes] = useState(initialOT.supervisor_notes || '');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPriority, setEditPriority] = useState(initialOT.priority);
  const [editEstHours, setEditEstHours] = useState(initialOT.estimated_hours?.toString() || '');
  const [editDesc, setEditDesc] = useState(initialOT.problem_description || '');
  const [editSupervisorNotes, setEditSupervisorNotes] = useState(initialOT.supervisor_notes || '');
  const [photoTab, setPhotoTab] = useState('antes');
  const [newTaskName, setNewTaskName] = useState('');
  const [taskTemplateSearch, setTaskTemplateSearch] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSig, setHasSig] = useState(false);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Live OT data
  const { data: liveOT, refetch: refetchOT } = useQuery({
    queryKey: ['ot-live', initialOT.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_orders')
        .select(`*, machines!work_orders_machine_id_fkey(name, internal_code, status, type), projects!work_orders_project_id_fkey(name), suppliers!work_orders_supplier_id_fkey(name)`)
        .eq('id', initialOT.id).single();
      return data;
    },
    initialData: initialOT,
  });
  const ot = liveOT || initialOT;

  // Fetch parts
  const { data: parts = [] } = useQuery({
    queryKey: ['ot-parts', ot.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_parts').select('*, inventory_consumables!work_order_parts_consumable_id_fkey(name, unit)').eq('work_order_id', ot.id);
      return data || [];
    },
  });

  // Fetch tools
  const { data: otTools = [] } = useQuery({
    queryKey: ['ot-tools', ot.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_tools').select('*, inventory_tools!work_order_tools_tool_id_fkey(name, internal_code)').eq('work_order_id', ot.id);
      return data || [];
    },
  });

  // Fetch photos
  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['ot-photos-detail', ot.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_photos').select('*').eq('work_order_id', ot.id).order('uploaded_at');
      return data || [];
    },
  });

  // Fetch notes
  const { data: allNotes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['ot-notes-detail', ot.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_notes').select('*').eq('work_order_id', ot.id).order('created_at');
      return data || [];
    },
  });

  // Fetch tasks
  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['ot-tasks-detail', ot.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_tasks').select('*').eq('work_order_id', ot.id).order('sort_order');
      return data || [];
    },
  });

  // Task templates for supervisor to add tasks
  const { data: detailTaskTemplates = [] } = useQuery({
    queryKey: ['task-templates-detail', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('task_templates').select('*').eq('tenant_id', tenantId).eq('active', true).order('name');
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filteredDetailTemplates = detailTaskTemplates.filter((t: any) => {
    if (!taskTemplateSearch) return true;
    return t.name.toLowerCase().includes(taskTemplateSearch.toLowerCase());
  });

  const handleAddTaskToOT = async (name: string, templateId?: string) => {
    try {
      await supabase.from('work_order_tasks').insert([{
        work_order_id: ot.id, tenant_id: tenantId, name,
        template_id: templateId || null, sort_order: tasks.length,
      }]);
      // Update completion percentage
      const newTotal = tasks.length + 1;
      const completed = tasks.filter((t: any) => t.is_completed).length;
      const pct = Math.round((completed / newTotal) * 100);
      await supabase.from('work_orders').update({ completion_percentage: pct }).eq('id', ot.id);
      toast.success('Tarea agregada');
      refetchTasks();
      setNewTaskName('');
      setTaskTemplateSearch('');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddCustomTask = async () => {
    if (!newTaskName.trim()) return;
    // Also create template if not exists
    const existing = detailTaskTemplates.find((t: any) => t.name.toLowerCase() === newTaskName.trim().toLowerCase());
    if (!existing) {
      await supabase.from('task_templates').insert([{ tenant_id: tenantId, name: newTaskName.trim() }]);
    }
    await handleAddTaskToOT(newTaskName.trim(), existing?.id);
  };

  // Fetch technicians
  const { data: techs = [] } = useQuery({
    queryKey: ['ot-technicians-detail', ot.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_technicians').select('personnel!work_order_technicians_personnel_id_fkey(full_name, specialty, hourly_rate)').eq('work_order_id', ot.id);
      return data || [];
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase.channel(`ot-detail-${ot.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_order_notes', filter: `work_order_id=eq.${ot.id}` }, () => { refetchNotes(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_order_photos', filter: `work_order_id=eq.${ot.id}` }, () => { refetchPhotos(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_order_tasks', filter: `work_order_id=eq.${ot.id}` }, () => { refetchTasks(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_orders', filter: `id=eq.${ot.id}` }, () => { refetchOT(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ot.id]);

  // Notes grouped by phase
  const notesByPhase = useMemo(() => {
    const map: Record<string, any[]> = { antes: [], durante: [], despues: [] };
    allNotes.forEach((n: any) => { if (map[n.phase]) map[n.phase].push(n); });
    return map;
  }, [allNotes]);

  // Photos grouped by phase
  const photosByPhase = useMemo(() => {
    const map: Record<string, any[]> = { antes: [], durante: [], despues: [] };
    photos.forEach((p: any) => { if (map[p.photo_type]) map[p.photo_type].push(p); else map.durante.push(p); });
    return map;
  }, [photos]);

  // Tasks completion
  const completedTasks = tasks.filter((t: any) => t.is_completed).length;
  const taskPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Elapsed time calculation
  const elapsedSeconds = useMemo(() => {
    if (!ot.started_at) return 0;
    const endTime = ot.closed_at ? new Date(ot.closed_at) : new Date();
    let total = differenceInSeconds(endTime, new Date(ot.started_at));
    // Subtract pauses
    const pauses = Array.isArray(ot.pause_history) ? ot.pause_history : [];
    pauses.forEach((p: any) => {
      if (p.start && p.end) {
        total -= differenceInSeconds(new Date(p.end), new Date(p.start));
      }
    });
    return Math.max(0, total);
  }, [ot.started_at, ot.closed_at, ot.pause_history]);

  // Timeline
  const statusOrder = TIMELINE_STEPS;
  const currentIdx = statusOrder.indexOf(ot.status);

  // Canvas signature setup with proper DPR scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 160 * dpr;
      canvas.style.height = '160px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 0;
      }
    };
    setTimeout(setupCanvas, 150);
  }, [ot.status]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };
  const startDraw = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    lastPoint.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const draw = (x: number, y: number) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const prev = lastPoint.current;
    if (prev) {
      const dx = Math.abs(x - prev.x);
      const dy = Math.abs(y - prev.y);
      if (dx < 2 && dy < 2) return;
      ctx.quadraticCurveTo(prev.x, prev.y, (x + prev.x) / 2, (y + prev.y) / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPoint.current = { x, y };
    setHasSig(true);
  };
  const endDraw = () => { isDrawing.current = false; lastPoint.current = null; };
  const clearSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      setHasSig(false);
    }
  };

  const handleMarkStarted = async () => {
    setSaving(true);
    try {
      await supabase.from('work_orders').update({ status: 'en_curso' as any, started_at: new Date().toISOString() }).eq('id', ot.id);
      await log('ordenes-trabajo', 'iniciar_ot', 'work_order', ot.id, ot.code);
      toast.success(`${ot.code} marcada como en curso`);
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      refetchOT();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleSign = async () => {
    if (!hasSig) { toast.error('Firma requerida'); return; }
    setSaving(true);
    try {
      const sigUrl = canvasRef.current?.toDataURL('image/png') || '';
      const partsCost = parts.reduce((sum: number, p: any) => sum + (p.quantity * (p.unit_cost || 0)), 0);
      const totalCost = partsCost + (ot.external_cost || 0); // labor_cost = 0 por ahora

      await supabase.from('work_orders').update({
        status: 'firmada' as any, signed_at: new Date().toISOString(),
        supervisor_signature_url: sigUrl, supervisor_notes: supervisorNotes, total_cost: totalCost,
        labor_cost: 0,
      }).eq('id', ot.id);

      // Cost entry solo si hay materiales
      if (partsCost > 0) {
        await supabase.from('cost_entries').insert([{
          tenant_id: tenantId, machine_id: ot.machine_id, project_id: ot.project_id,
          source: 'ot', source_id: ot.id, amount: partsCost,
          cost_type: 'materiales', description: `OT ${ot.code} — materiales`,
          cost_date: new Date().toISOString().split('T')[0], created_by: userId,
        }]);
      }

      await log('ordenes-trabajo', 'firmar_ot', 'work_order', ot.id, ot.code);
      toast.success(`${ot.code} firmada correctamente`);
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      onClose();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleReturnTool = async (toolAssignment: any) => {
    try {
      await supabase.from('work_order_tools').update({ returned_at: new Date().toISOString() }).eq('id', toolAssignment.id);
      await supabase.from('inventory_tools').update({ status: 'disponible' as any, assigned_to_ot: null }).eq('id', toolAssignment.tool_id);
      toast.success('Herramienta devuelta');
      qc.invalidateQueries({ queryKey: ['ot-tools', ot.id] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteWorkOrders([ot.id]);
      await log('ordenes-trabajo', 'eliminar_ot', 'work_order', ot.id, ot.code);
      toast.success(`${ot.code} eliminada`);
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      onClose();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await supabase.from('work_orders').update({
        priority: editPriority,
        estimated_hours: editEstHours ? parseFloat(editEstHours) : null,
        problem_description: editDesc,
        supervisor_notes: editSupervisorNotes,
      }).eq('id', ot.id);
      toast.success('OT actualizada');
      setEditMode(false);
      refetchOT();
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[780px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow text-xl text-[hsl(var(--gold-bright))] flex items-center gap-2">
            {ot.code}
            {tasks.length > 0 && <CompletionPill percentage={taskPct} />}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <TypeBadge type={ot.type} />
            <PriorityBadge priority={ot.priority} />
            <StatusBadge status={ot.status} />
            {ot.machines && <span className="text-xs font-dm">· {ot.machines.name} [{ot.machines.internal_code}]</span>}
            {ot.projects && <span className="text-xs font-dm text-muted-foreground">· {ot.projects.name}</span>}
            {ot.horometer_start != null && <span className="text-xs font-dm text-muted-foreground">· ⏱ Horómetro: {ot.horometer_start}</span>}
            {ot.started_at && <span className="text-xs font-dm text-muted-foreground">· ⏳ {formatElapsed(elapsedSeconds)}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Edit/Delete actions */}
        <div className="flex items-center gap-2 -mt-2">
          {!editMode && ot.status !== 'firmada' && (
            <>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setEditMode(true)}><Edit className="h-3.5 w-3.5" /> Editar</Button>
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="h-3.5 w-3.5" /> Eliminar</Button>
            </>
          )}
        </div>

        {/* Edit mode */}
        {editMode && (
          <div className="space-y-3 p-3 rounded-lg border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.03)]">
            <p className="font-barlow uppercase text-xs text-[hsl(var(--gold-bright))]">✏️ Editar OT</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prioridad</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Horas estimadas</Label>
                <Input type="number" step="0.5" value={editEstHours} onChange={e => setEditEstHours(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
            </div>
            <div>
              <Label className="text-xs">Notas del supervisor</Label>
              <Textarea value={editSupervisorNotes} onChange={e => setEditSupervisorNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>Cancelar</Button>
              <Button size="sm" className="bg-[hsl(var(--gold))] text-white text-xs" disabled={saving} onClick={handleSaveEdit}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg">
          {statusOrder.map((s, i) => {
            const effectiveIdx = ot.status === 'pausada' ? 2 : currentIdx;
            const completed = i < effectiveIdx;
            const active = i === effectiveIdx;
            return (
              <div key={s} className="flex items-center gap-1">
                <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-barlow font-semibold',
                  completed ? 'bg-[hsl(var(--gold))] text-white' : active ? 'border-2 border-[hsl(var(--gold))] text-[hsl(var(--gold-bright))] animate-pulse-dot' : 'bg-border text-muted-foreground')}>
                  {completed ? '✓' : i + 1}
                </div>
                <span className="text-[10px] font-barlow capitalize hidden sm:inline">{s.replace(/_/g, ' ')}</span>
                {i < statusOrder.length - 1 && <div className={cn('w-4 sm:w-8 h-0.5 mx-1', completed ? 'bg-[hsl(var(--gold))]' : 'bg-border')} />}
              </div>
            );
          })}
        </div>

        {/* Tasks checklist + add tasks */}
        <div className="space-y-2">
          <h3 className="font-barlow text-sm uppercase text-muted-foreground">
            Tareas {tasks.length > 0 ? `(${completedTasks}/${tasks.length})` : ''}
          </h3>
          {tasks.length > 0 && <Progress value={taskPct} className="h-2 [&>div]:bg-[hsl(var(--gold))]" />}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tasks.map((t: any) => (
              <div key={t.id} className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-dm",
                t.is_completed ? "bg-[hsl(var(--success-bg))] opacity-70" : "bg-muted/30"
              )}>
                <span className={cn("flex-1", t.is_completed && "line-through text-muted-foreground")}>
                  {t.is_completed ? '✅' : '⬜'} {t.name}
                </span>
                {t.completed_at && <span className="text-[10px] text-muted-foreground">{format(new Date(t.completed_at), 'dd/MM HH:mm')}</span>}
              </div>
            ))}
          </div>

          {/* Supervisor: add tasks */}
          {ot.status !== 'firmada' && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[11px] font-barlow uppercase text-muted-foreground">Agregar tarea</p>
              <div className="relative">
                <Input placeholder="Buscar plantilla o escribir tarea..." value={taskTemplateSearch || newTaskName}
                  onChange={e => { setTaskTemplateSearch(e.target.value); setNewTaskName(e.target.value); }}
                  className="h-9 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTask(); } }} />
              </div>
              {taskTemplateSearch && filteredDetailTemplates.length > 0 && (
                <div className="max-h-28 overflow-y-auto space-y-1 border border-border rounded-lg p-1.5">
                  {filteredDetailTemplates.map((t: any) => (
                    <button key={t.id}
                      onClick={() => { handleAddTaskToOT(t.name, t.id); setTaskTemplateSearch(''); setNewTaskName(''); }}
                      className="w-full text-left px-3 py-1.5 rounded-md text-xs font-dm hover:bg-muted flex items-center justify-between">
                      <span>{t.name}</span>
                      {t.estimated_minutes && <span className="text-[10px] text-muted-foreground">{t.estimated_minutes}m</span>}
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs w-full" onClick={handleAddCustomTask} disabled={!newTaskName.trim()}>
                + Agregar tarea personalizada
              </Button>
            </div>
          )}
        </div>

        {/* Assignment */}
        <div className="space-y-3">
          <h3 className="font-barlow text-sm uppercase text-muted-foreground">Asignación</h3>
          {techs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {techs.map((t: any, i: number) => (
                <span key={i} className="text-xs font-dm px-2 py-1 rounded-full bg-muted">{t.personnel?.full_name} · {t.personnel?.specialty || '—'}</span>
              ))}
            </div>
          )}
          {ot.suppliers && <p className="text-sm font-dm">🏭 {ot.suppliers.name}</p>}
          <div className="flex gap-4 text-xs font-dm text-muted-foreground">
            <span>Estimadas: {ot.estimated_hours || '—'}h</span>
            <span>Reales: {ot.actual_hours || '—'}h</span>
          </div>
        </div>

        {/* Description */}
        {ot.problem_description && (
          <div className="space-y-1">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Descripción</h3>
            <p className="text-sm font-dm whitespace-pre-line">{ot.problem_description}</p>
          </div>
        )}

        {/* Notes by phase */}
        {allNotes.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Notas del técnico por etapa</h3>
            {(['antes', 'durante', 'despues'] as const).map(phase => {
              const phaseNotes = notesByPhase[phase];
              if (phaseNotes.length === 0) return null;
              return (
                <Collapsible key={phase} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-xs font-barlow uppercase font-semibold text-muted-foreground hover:text-foreground py-1">
                    <ChevronDown className="h-3.5 w-3.5" /> {PHASE_LABELS[phase]} ({phaseNotes.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pl-5">
                    {phaseNotes.map((n: any) => (
                      <div key={n.id} className="text-sm font-dm p-2 rounded-lg bg-muted/50">
                        <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), 'dd/MM HH:mm')}</span>
                        <p className="mt-0.5">{n.content}</p>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}

        {ot.technician_notes && allNotes.length === 0 && (
          <div className="space-y-1">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Notas del técnico</h3>
            <p className="text-sm font-dm whitespace-pre-line">{ot.technician_notes}</p>
          </div>
        )}

        {/* Photos by phase tabs */}
        {photos.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Fotos</h3>
            <Tabs value={photoTab} onValueChange={setPhotoTab}>
              <TabsList className="h-8">
                {(['antes', 'durante', 'despues'] as const).map(p => (
                  <TabsTrigger key={p} value={p} className="text-xs px-3 py-1">
                    {PHASE_LABELS[p]} ({photosByPhase[p].length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {(['antes', 'durante', 'despues'] as const).map(p => (
                <TabsContent key={p} value={p}>
                  {photosByPhase[p].length === 0 ? (
                    <p className="text-xs text-muted-foreground font-dm py-4 text-center">Sin fotos en esta etapa</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {photosByPhase[p].map((ph: any) => (
                        <div key={ph.id} className="aspect-square rounded-lg overflow-hidden border border-border">
                          <img src={ph.photo_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {/* Parts */}
        {parts.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Repuestos y materiales</h3>
            <Table>
              <TableHeader><TableRow className="text-[11px]">
                <TableHead>Nombre</TableHead><TableHead>Cant.</TableHead><TableHead>Unidad</TableHead><TableHead>C. Unit.</TableHead><TableHead>Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {parts.map((p: any) => (
                  <TableRow key={p.id} className="text-xs font-dm">
                    <TableCell>{p.inventory_consumables?.name || '—'}</TableCell>
                    <TableCell>{p.quantity}</TableCell>
                    <TableCell>{p.inventory_consumables?.unit || ''}</TableCell>
                    <TableCell>${(p.unit_cost || 0).toLocaleString()}</TableCell>
                    <TableCell>${((p.quantity || 0) * (p.unit_cost || 0)).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Tools */}
        {otTools.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Herramientas</h3>
            <div className="space-y-1">
              {otTools.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-xs font-dm p-2 rounded-lg bg-muted/50">
                  <span>{t.inventory_tools?.internal_code ? `[${t.inventory_tools.internal_code}] ` : ''}{t.inventory_tools?.name}</span>
                  {t.returned_at ? (
                    <span className="text-[hsl(var(--success))] text-[11px]">✓ Devuelta</span>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] text-[hsl(var(--danger))]" onClick={() => handleReturnTool(t)}>
                      Registrar devolución
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost Summary */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1 text-sm font-dm">
          <div className="flex justify-between"><span className="text-muted-foreground">Materiales:</span><span>${(ot.parts_cost || 0).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Costo externo:</span><span>${(ot.external_cost || 0).toLocaleString()}</span></div>
          <div className="border-t border-border pt-1 flex justify-between font-semibold">
            <span>TOTAL:</span><span className="text-[hsl(var(--gold-bright))]">${((ot.parts_cost || 0) + (ot.external_cost || 0)).toLocaleString()}</span>
          </div>
        </div>

        {/* Signatures */}
        {ot.technician_signature_url && (
          <div className="space-y-1">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Firma del técnico</h3>
            <img src={ot.technician_signature_url} alt="Firma técnico" className="h-20 border border-border rounded-lg" />
          </div>
        )}
        {ot.supervisor_signature_url && (
          <div className="space-y-1">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Firma del supervisor</h3>
            <img src={ot.supervisor_signature_url} alt="Firma supervisor" className="h-20 border border-border rounded-lg" />
          </div>
        )}

        {/* Actions based on status */}
        <div className="flex gap-2 pt-2 border-t border-border">
          {ot.status === 'asignada' && (
            <Button className="flex-1 h-11 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase"
              disabled={saving} onClick={handleMarkStarted}>
              {saving ? 'Procesando...' : 'Marcar como iniciada'}
            </Button>
          )}

          {ot.status === 'cerrada' && (
            <div className="w-full space-y-3">
              <Textarea placeholder="Notas del supervisor..." value={supervisorNotes} onChange={(e) => setSupervisorNotes(e.target.value)} rows={3} />
              <div>
                <Label className="font-barlow uppercase text-xs mb-2 block">Firma del supervisor</Label>
                <canvas ref={canvasRef} className="w-full h-40 border-2 border-dashed border-border rounded-xl bg-white cursor-crosshair touch-none"
                  onMouseDown={(e) => { const p = getPos(e); startDraw(p.x, p.y); }}
                  onMouseMove={(e) => { const p = getPos(e); draw(p.x, p.y); }}
                  onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={(e) => { e.preventDefault(); const p = getPos(e); startDraw(p.x, p.y); }}
                  onTouchMove={(e) => { e.preventDefault(); const p = getPos(e); draw(p.x, p.y); }}
                  onTouchEnd={endDraw} />
                <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={clearSig}>Limpiar firma</Button>
              </div>
              <Button className="w-full h-12 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase"
                disabled={saving || !hasSig} onClick={handleSign}>
                {saving ? 'Firmando...' : '✅ Firmar y Cerrar OT'}
              </Button>
            </div>
          )}

          {ot.status === 'firmada' && (
            <div className="w-full text-center py-2">
              <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] text-sm px-4 py-1">✓ OT Firmada</Badge>
            </div>
          )}

          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-barlow">⚠️ ¿Eliminar {ot.code}?</AlertDialogTitle>
              <AlertDialogDescription className="font-dm">Se eliminarán técnicos, tareas, fotos, notas y costos asociados. Esta acción es irreversible.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-dm" disabled={saving}>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-dm"
                disabled={saving} onClick={e => { e.preventDefault(); handleDelete(); }}>
                {saving ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━
// TASK TEMPLATES MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━
function TaskTemplatesModal({ open, onClose, tenantId }: { open: boolean; onClose: () => void; tenantId: string }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editMinutes, setEditMinutes] = useState('');

  const { data: templates = [], refetch } = useQuery({
    queryKey: ['task-templates-all', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('task_templates').select('*').eq('tenant_id', tenantId).order('name');
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await supabase.from('task_templates').insert([{
      tenant_id: tenantId, name: newName.trim(),
      ot_type: newType || null, estimated_minutes: newMinutes ? parseInt(newMinutes) : null,
    }]);
    setNewName(''); setNewType(''); setNewMinutes('');
    refetch();
    toast.success('Plantilla creada');
  };

  const handleToggleActive = async (t: any) => {
    await supabase.from('task_templates').update({ active: !t.active }).eq('id', t.id).eq('tenant_id', tenantId);
    refetch();
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await supabase.from('task_templates').update({
      name: editName.trim(), ot_type: editType || null,
      estimated_minutes: editMinutes ? parseInt(editMinutes) : null,
    }).eq('id', editingId).eq('tenant_id', tenantId);
    setEditingId(null);
    refetch();
    toast.success('Plantilla actualizada');
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow">Plantillas de tareas</DialogTitle>
          <DialogDescription className="font-dm text-xs">Gestiona las plantillas de tareas reutilizables para las OTs.</DialogDescription>
        </DialogHeader>

        {/* Create new */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs">Nombre</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-9 text-sm" placeholder="Nombre de la tarea..."
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
          </div>
          <div className="w-28">
            <Label className="text-xs">Tipo OT</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Cualquiera" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_types">Cualquiera</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20">
            <Label className="text-xs">Min.</Label>
            <Input type="number" value={newMinutes} onChange={e => setNewMinutes(e.target.value)} className="h-9 text-sm" placeholder="30" />
          </div>
          <Button size="sm" className="h-9 bg-[hsl(var(--gold))] text-white text-xs" onClick={handleCreate} disabled={!newName.trim()}>+ Crear</Button>
        </div>

        {/* List */}
        <div className="space-y-1 mt-4">
          {templates.map((t: any) => (
            <div key={t.id} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-dm", !t.active && "opacity-50")}>
              {editingId === t.id ? (
                <>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-sm flex-1" />
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_types">Cualquiera</SelectItem>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={editMinutes} onChange={e => setEditMinutes(e.target.value)} className="h-7 w-16 text-sm" />
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSaveEdit}>✓</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>✕</Button>
                </>
              ) : (
                <>
                  <span className="flex-1">{t.name}</span>
                  {t.ot_type && <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[t.ot_type] || t.ot_type}</span>}
                  {t.estimated_minutes && <span className="text-[10px] text-muted-foreground">{t.estimated_minutes} min</span>}
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                    setEditingId(t.id); setEditName(t.name); setEditType(t.ot_type || 'all_types'); setEditMinutes(t.estimated_minutes?.toString() || '');
                  }}>✏️</Button>
                  <Button variant="ghost" size="sm" className={cn("h-6 text-xs", t.active ? "text-[hsl(var(--success))]" : "text-muted-foreground")}
                    onClick={() => handleToggleActive(t)}>
                    {t.active ? '✅ Activa' : '⬜ Inactiva'}
                  </Button>
                </>
              )}
            </div>
          ))}
          {templates.length === 0 && <p className="text-sm text-muted-foreground font-dm text-center py-4">No hay plantillas de tareas</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
