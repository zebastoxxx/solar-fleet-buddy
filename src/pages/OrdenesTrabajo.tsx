import { useState, useEffect, useRef, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { useChrono, useOTTimerStore } from '@/stores/otTimerStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Plus, Search, Wrench, Eye, UserPlus, Download, Trash2 } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

function formatCost(n: number) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOT, setDetailOT] = useState<any>(null);
  const [selectedOTs, setSelectedOTs] = useState<string[]>([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const bulkDeleteOTs = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from('work_order_technicians').delete().in('work_order_id', ids);
      await supabase.from('work_order_parts').delete().in('work_order_id', ids);
      await supabase.from('work_order_photos').delete().in('work_order_id', ids);
      await supabase.from('work_order_tools').delete().in('work_order_id', ids);
      await supabase.from('work_order_timers').delete().in('work_order_id', ids);
      const { error } = await supabase.from('work_orders').delete().eq('tenant_id', tenantId!).in('id', ids);
      if (error) throw error;
    },
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

  // Fetch work orders
  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['work-orders', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          machines!work_orders_machine_id_fkey(name, internal_code, status, type),
          projects!work_orders_project_id_fkey(name),
          suppliers!work_orders_supplier_id_fkey(name)
        `)
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch technicians for each OT
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

  // Sort by priority then date
  const sorted = [...workOrders].sort((a: any, b: any) => {
    const pOrder: Record<string, number> = { critica: 1, urgente: 2, normal: 3 };
    const pa = pOrder[a.priority] || 3;
    const pb = pOrder[b.priority] || 3;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Filters
  const filtered = sorted.filter((ot: any) => {
    if (statusFilter !== 'all' && ot.status !== statusFilter) return false;
    if (typeFilter !== 'all' && ot.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && ot.priority !== priorityFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const mn = ot.machines?.name?.toLowerCase() || '';
      const pn = ot.projects?.name?.toLowerCase() || '';
      if (!ot.code.toLowerCase().includes(s) && !mn.includes(s) && !pn.includes(s)) return false;
    }
    return true;
  });

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
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button size="sm" className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Nueva OT</span>
          </Button>
        </div>
      </div>

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
                <TableHead>Código</TableHead>
                <TableHead>Máquina</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead className="hidden md:table-cell">Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Horas</TableHead>
                <TableHead className="hidden md:table-cell">Costo</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ot: any) => {
                const techs = otTechnicians[ot.id] || [];
                const loc = LOCATION_BADGES[ot.location_type] || { icon: '', label: '' };
                return (
                  <TableRow key={ot.id} className="h-11 cursor-pointer hover:bg-muted/50" onClick={() => setDetailOT(ot)}>
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
                    <TableCell><StatusBadge status={ot.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-dm">
                      {ot.status === 'en_curso' ? <ChronoPill otId={ot.id} /> :
                        ot.actual_hours ? `${ot.actual_hours}h` : '—'}
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

      {/* Create OT Modal */}
      <CreateOTModal open={createOpen} onClose={() => setCreateOpen(false)} tenantId={tenantId!} userId={user?.id!} />

      {/* Detail OT Modal */}
      {detailOT && (
        <DetailOTModal ot={detailOT} onClose={() => setDetailOT(null)} tenantId={tenantId!} userId={user?.id!} />
      )}
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
    <span className="inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm bg-[#FDDEDE] text-[#C0392B] animate-pulse-dot">
      🚨 Crítica
    </span>
  );
  if (priority === 'urgente') return (
    <span className="inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm bg-[#FFEDD5] text-[#EA580C]">
      ⚡ Urgente
    </span>
  );
  return (
    <span className="inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm bg-muted text-muted-foreground">
      Normal
    </span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━
// CREATE OT MODAL
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

  // Step 4
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
    enabled: open && step === 4 && !!tenantId,
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
    setSelectedProblems([]); setAdditionalDesc(''); setEstimatedHours(''); setSelectedTools([]);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      // Generate sequential code
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-[680px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow text-lg">Nueva Orden de Trabajo</DialogTitle>
          <DialogDescription>Paso {step} de 4</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-xs font-barlow font-semibold border-2 transition-colors',
                s < step ? 'bg-[hsl(var(--gold))] border-[hsl(var(--gold))] text-white' :
                s === step ? 'border-[hsl(var(--gold))] text-[hsl(var(--gold-bright))]' :
                'border-border text-muted-foreground'
              )}>
                {s < step ? '✓' : s}
              </div>
              {s < 4 && <div className={cn('w-8 h-0.5', s < step ? 'bg-[hsl(var(--gold))]' : 'bg-border')} />}
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
              <div className="grid grid-cols-2 gap-2">
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
            <div className="grid grid-cols-3 gap-2">
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

        {/* Step 4: Tools & Confirm */}
        {step === 4 && (
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
              {selectedProblems.length > 0 && <p><span className="text-muted-foreground">Tareas:</span> {selectedProblems.join(', ')}</p>}
              {estimatedHours && <p><span className="text-muted-foreground">Horas estimadas:</span> {estimatedHours}h</p>}
              {selectedTools.length > 0 && <p><span className="text-muted-foreground">Herramientas:</span> {selectedTools.length} seleccionadas</p>}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 h-11" onClick={() => setStep(3)}>← Atrás</Button>
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
// DETAIL OT MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━
function DetailOTModal({ ot, onClose, tenantId, userId }: { ot: any; onClose: () => void; tenantId: string; userId: string }) {
  const { log } = useLog();
  const qc = useQueryClient();
  const [supervisorNotes, setSupervisorNotes] = useState(ot.supervisor_notes || '');
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSig, setHasSig] = useState(false);
  const isDrawing = useRef(false);

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
  const { data: photos = [] } = useQuery({
    queryKey: ['ot-photos', ot.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_photos').select('*').eq('work_order_id', ot.id).order('uploaded_at');
      return data || [];
    },
  });

  // Fetch technicians
  const { data: techs = [] } = useQuery({
    queryKey: ['ot-technicians-detail', ot.id],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_technicians').select('personnel!work_order_technicians_personnel_id_fkey(full_name, specialty, hourly_rate)').eq('work_order_id', ot.id);
      return data || [];
    },
  });

  // Timeline
  const statusOrder = TIMELINE_STEPS;
  const currentIdx = statusOrder.indexOf(ot.status);
  const pausedIdx = ot.status === 'pausada' ? 2 : -1; // show pausada at en_curso position

  // Canvas signature setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = 160;
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
  }, [ot.status]);

  const startDraw = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const draw = (x: number, y: number) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y); ctx.stroke();
    setHasSig(true);
  };
  const endDraw = () => { isDrawing.current = false; };
  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };
  const clearSig = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setHasSig(false); }
  };

  const handleMarkStarted = async () => {
    setSaving(true);
    try {
      await supabase.from('work_orders').update({ status: 'en_curso' as any, started_at: new Date().toISOString() }).eq('id', ot.id);
      await log('ordenes-trabajo', 'iniciar_ot', 'work_order', ot.id, ot.code);
      toast.success(`${ot.code} marcada como en curso`);
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      onClose();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleSign = async () => {
    if (!hasSig) { toast.error('Firma requerida'); return; }
    setSaving(true);
    try {
      const sigUrl = canvasRef.current?.toDataURL('image/png') || '';
      const partsCost = parts.reduce((sum: number, p: any) => sum + (p.quantity * (p.unit_cost || 0)), 0);
      const totalCost = (ot.labor_cost || 0) + partsCost + (ot.external_cost || 0);

      await supabase.from('work_orders').update({
        status: 'firmada' as any,
        signed_at: new Date().toISOString(),
        supervisor_signature_url: sigUrl,
        supervisor_notes: supervisorNotes,
        total_cost: totalCost,
      }).eq('id', ot.id);

      // Create cost entry
      await supabase.from('cost_entries').insert([{
        tenant_id: tenantId, machine_id: ot.machine_id, project_id: ot.project_id,
        source: 'ot', source_id: ot.id, amount: totalCost,
        cost_type: 'mano_obra', description: `OT ${ot.code}`,
        cost_date: new Date().toISOString().split('T')[0], created_by: userId,
      }]);

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

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[780px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow text-xl text-[hsl(var(--gold-bright))]">{ot.code}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <TypeBadge type={ot.type} />
            <PriorityBadge priority={ot.priority} />
            <StatusBadge status={ot.status} />
            {ot.machines && <span className="text-xs font-dm">· {ot.machines.name} [{ot.machines.internal_code}]</span>}
            {ot.projects && <span className="text-xs font-dm text-muted-foreground">· {ot.projects.name}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Timeline */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg mb-4">
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

        {ot.technician_notes && (
          <div className="space-y-1">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Notas del técnico</h3>
            <p className="text-sm font-dm whitespace-pre-line">{ot.technician_notes}</p>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-barlow text-sm uppercase text-muted-foreground">Fotos</h3>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p: any) => (
                <div key={p.id} className="aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
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
          <div className="flex justify-between"><span className="text-muted-foreground">Mano de obra:</span><span>${(ot.labor_cost || 0).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Materiales:</span><span>${(ot.parts_cost || 0).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Costo externo:</span><span>${(ot.external_cost || 0).toLocaleString()}</span></div>
          <div className="border-t border-border pt-1 flex justify-between font-semibold">
            <span>TOTAL:</span><span className="text-[hsl(var(--gold-bright))]">${(ot.total_cost || 0).toLocaleString()}</span>
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
      </DialogContent>
    </Dialog>
  );
}
