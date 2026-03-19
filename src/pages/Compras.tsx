import { useState, useRef, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ShoppingCart, Plus, Search, Filter, Trash2, Eye, Pencil,
  ArrowUpDown, ArrowUp, ArrowDown, X, Check, Upload, Download,
  FileText, Clock, CheckCircle2, XCircle, Package, AlertTriangle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-compress';

// ─── Constants ──────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'pendiente_aprobacion', label: 'Pendiente' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'recibida', label: 'Recibida' },
  { value: 'cancelada', label: 'Cancelada' },
];

const CATEGORY_OPTIONS = [
  { value: 'todos', label: 'Todas' },
  { value: 'repuesto', label: 'Repuesto' },
  { value: 'inventario', label: 'Inventario' },
  { value: 'servicio', label: 'Servicio' },
  { value: 'flete', label: 'Flete' },
  { value: 'mano_obra_externa', label: 'Mano obra ext.' },
  { value: 'herramienta', label: 'Herramienta' },
  { value: 'viatico', label: 'Viático' },
  { value: 'otro', label: 'Otro' },
];

const PRIORITY_OPTIONS = [
  { value: 'todos', label: 'Todas' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'critica', label: 'Crítica' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  borrador: { bg: 'bg-muted', text: 'text-muted-foreground', label: '📝 Borrador' },
  pendiente_aprobacion: { bg: 'bg-warning/10', text: 'text-warning', label: '⏳ Pendiente' },
  aprobada: { bg: 'bg-success/10', text: 'text-success', label: '✅ Aprobada' },
  rechazada: { bg: 'bg-destructive/10', text: 'text-destructive', label: '❌ Rechazada' },
  recibida: { bg: 'bg-primary/10', text: 'text-primary', label: '📦 Recibida' },
  cancelada: { bg: 'bg-muted', text: 'text-muted-foreground', label: '🚫 Cancelada' },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  normal: { bg: 'bg-muted', text: 'text-muted-foreground' },
  urgente: { bg: 'bg-warning/10', text: 'text-warning' },
  critica: { bg: 'bg-destructive/10', text: 'text-destructive' },
};

type SortField = 'order_number' | 'title' | 'status' | 'priority' | 'category' | 'total_estimated' | 'created_at';
type SortDir = 'asc' | 'desc';

// ─── Main Component ─────────────────────────────────
export default function Compras() {
  usePageTitle('Compras');
  const { user } = useAuthStore();
  const tenantId = user?.tenant_id || '';
  const userId = user?.id || '';
  const log = useLog();
  const qc = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [catFilter, setCatFilter] = useState('todos');
  const [prioFilter, setPrioFilter] = useState('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Selection
  const [selected, setSelected] = useState<string[]>([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [detailOC, setDetailOC] = useState<any>(null);
  const [editOC, setEditOC] = useState<any>(null);
  const [deleteOC, setDeleteOC] = useState<any>(null);

  // Pre-fill from inventory
  const [prefill, setPrefill] = useState<any>(null);

  // Check URL params for prefill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pf = params.get('prefill');
    if (pf) {
      try {
        setPrefill(JSON.parse(decodeURIComponent(pf)));
        setShowCreate(true);
        window.history.replaceState({}, '', '/compras');
      } catch {}
    }
  }, []);

  // ─── Queries ────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(name), machines(name, internal_code), projects(name), users!purchase_orders_requested_by_fkey(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // ─── Filter & Sort ─────────────────────────────
  const filtered = orders.filter((o: any) => {
    if (search) {
      const s = search.toLowerCase();
      if (!(o.title || '').toLowerCase().includes(s) && !(o.order_number || '').toLowerCase().includes(s)) return false;
    }
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (catFilter !== 'todos' && o.category !== catFilter) return false;
    if (prioFilter !== 'todos' && o.priority !== prioFilter) return false;
    if (dateFrom && o.created_at < dateFrom) return false;
    if (dateTo && o.created_at > dateTo + 'T23:59:59') return false;
    return true;
  }).sort((a: any, b: any) => {
    const av = a[sortField] ?? '';
    const bv = b[sortField] ?? '';
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-gold" /> : <ArrowDown className="h-3 w-3 ml-1 text-gold" />;
  };

  // Metrics
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const activeCount = orders.filter((o: any) => !['recibida', 'cancelada', 'rechazada'].includes(o.status)).length;
  const pendingCount = orders.filter((o: any) => o.status === 'pendiente_aprobacion').length;
  const approvedMonth = orders.filter((o: any) => o.status === 'aprobada' && o.approved_at && o.approved_at >= monthStart).length;
  const totalApprovedMonth = orders
    .filter((o: any) => ['aprobada', 'recibida'].includes(o.status) && o.approved_at && o.approved_at >= monthStart)
    .reduce((s: number, o: any) => s + (o.total_approved || o.total_estimated || 0), 0);

  const clearFilters = () => {
    setSearch(''); setStatusFilter('todos'); setCatFilter('todos'); setPrioFilter('todos'); setDateFrom(''); setDateTo('');
  };

  const toggleAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map((o: any) => o.id));
  };

  // Bulk delete
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('purchase_orders').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Órdenes eliminadas');
      setSelected([]);
      setShowBulkDelete(false);
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Single delete
  const singleDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Orden eliminada');
      setDeleteOC(null);
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold font-barlow text-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-gold" /> Compras
          </h1>
          <p className="text-xs text-muted-foreground font-dm">Gestión de órdenes de compra y solicitudes</p>
        </div>
        <Button size="sm" className="bg-gold hover:bg-gold-bright text-black font-dm gap-1" onClick={() => { setPrefill(null); setEditOC(null); setShowCreate(true); }}>
          <Plus className="h-4 w-4" /> Nueva solicitud
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Activas" value={activeCount} />
        <StatCard label="Pendientes aprobación" value={pendingCount} className={pendingCount > 0 ? 'border-warning/50' : ''} />
        <StatCard label="Aprobadas este mes" value={approvedMonth} />
        <StatCard label="Gasto aprobado mes" value={`$${totalApprovedMonth.toLocaleString()}`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar título o # OC..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs font-dm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs font-dm"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs font-dm"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={prioFilter} onValueChange={setPrioFilter}>
          <SelectTrigger className="w-[110px] h-8 text-xs font-dm"><SelectValue /></SelectTrigger>
          <SelectContent>{PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[130px] h-8 text-xs font-dm" placeholder="Desde" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[130px] h-8 text-xs font-dm" placeholder="Hasta" />
        <Button variant="ghost" size="sm" className="h-8 text-xs font-dm gap-1" onClick={clearFilters}><X className="h-3 w-3" /> Limpiar</Button>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted border border-border">
          <span className="text-xs font-dm font-medium">{selected.length} seleccionada{selected.length !== 1 ? 's' : ''}</span>
          <Button variant="destructive" size="sm" className="h-7 text-xs font-dm gap-1" onClick={() => setShowBulkDelete(true)}>
            <Trash2 className="h-3 w-3" /> Eliminar
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-dm">
          <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay órdenes de compra</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8">
                  <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-border" />
                </TableHead>
                <TableHead className="text-[11px] font-dm cursor-pointer select-none" onClick={() => toggleSort('order_number')}># OC <SortIcon field="order_number" /></TableHead>
                <TableHead className="text-[11px] font-dm cursor-pointer select-none" onClick={() => toggleSort('title')}>Título <SortIcon field="title" /></TableHead>
                <TableHead className="text-[11px] font-dm cursor-pointer select-none" onClick={() => toggleSort('status')}>Estado <SortIcon field="status" /></TableHead>
                <TableHead className="text-[11px] font-dm cursor-pointer select-none" onClick={() => toggleSort('priority')}>Prioridad <SortIcon field="priority" /></TableHead>
                <TableHead className="text-[11px] font-dm cursor-pointer select-none" onClick={() => toggleSort('category')}>Categoría <SortIcon field="category" /></TableHead>
                <TableHead className="text-[11px] font-dm">Proveedor</TableHead>
                <TableHead className="text-[11px] font-dm cursor-pointer select-none text-right" onClick={() => toggleSort('total_estimated')}>Total Est. <SortIcon field="total_estimated" /></TableHead>
                <TableHead className="text-[11px] font-dm cursor-pointer select-none" onClick={() => toggleSort('created_at')}>Días <SortIcon field="created_at" /></TableHead>
                <TableHead className="text-[11px] font-dm text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o: any) => {
                const st = STATUS_STYLES[o.status] || STATUS_STYLES.borrador;
                const pr = PRIORITY_STYLES[o.priority] || PRIORITY_STYLES.normal;
                const days = differenceInDays(now, new Date(o.created_at));
                const isLate = o.status === 'pendiente_aprobacion' && days > 3;
                return (
                  <TableRow key={o.id} className={cn(selected.includes(o.id) && 'bg-primary/5', isLate && 'bg-warning/5', 'cursor-pointer')} onClick={() => setDetailOC(o)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(o.id)} onChange={e => setSelected(e.target.checked ? [...selected, o.id] : selected.filter(x => x !== o.id))} className="h-3.5 w-3.5 rounded border-border" />
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium text-foreground">{o.order_number || '—'}</TableCell>
                    <TableCell className="text-xs font-dm font-medium text-foreground max-w-[200px] truncate">{o.title}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span></TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${pr.bg} ${pr.text}`}>{o.priority}</span></TableCell>
                    <TableCell className="text-[11px] font-dm text-muted-foreground">{o.category || '—'}</TableCell>
                    <TableCell className="text-[11px] font-dm text-muted-foreground">{o.suppliers?.name || '—'}</TableCell>
                    <TableCell className="text-xs font-barlow font-bold text-right">${(o.total_estimated || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={cn('text-xs font-dm', isLate ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                        {days}d {isLate && <AlertTriangle className="inline h-3 w-3 ml-0.5" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailOC(o)}><Eye className="h-3.5 w-3.5" /></Button>
                        {o.status === 'borrador' && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditOC(o); setShowCreate(true); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteOC(o)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <CreateOCModal
          open={showCreate}
          onClose={() => { setShowCreate(false); setEditOC(null); setPrefill(null); }}
          tenantId={tenantId}
          userId={userId}
          log={log}
          qc={qc}
          editing={editOC}
          prefill={prefill}
        />
      )}

      {/* Detail Modal */}
      {detailOC && (
        <DetailOCModal
          open={!!detailOC}
          onClose={() => setDetailOC(null)}
          oc={detailOC}
          tenantId={tenantId}
          userId={userId}
          userRole={user?.role || ''}
          log={log}
          qc={qc}
          onEdit={(o: any) => { setDetailOC(null); setEditOC(o); setShowCreate(true); }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteOC} onOpenChange={() => setDeleteOC(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">⚠️ ¿Eliminar orden {deleteOC?.order_number}?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">Esta acción eliminará la orden y todos sus ítems y documentos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-dm">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-dm" onClick={e => { e.preventDefault(); singleDelete.mutate(deleteOC.id); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">⚠️ ¿Eliminar {selected.length} órdenes?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">Se eliminarán permanentemente con sus ítems y documentos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-dm">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-dm" onClick={e => { e.preventDefault(); bulkDelete.mutate(selected); }}>
              Eliminar {selected.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── CREATE / EDIT MODAL ────────────────────────────
function CreateOCModal({ open, onClose, tenantId, userId, log, qc, editing, prefill }: any) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(editing?.title || prefill?.title || '');
  const [category, setCategory] = useState(editing?.category || prefill?.category || '');
  const [priority, setPriority] = useState(editing?.priority || 'normal');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [supplierId, setSupplierId] = useState(editing?.supplier_id || '');
  const [machineId, setMachineId] = useState(editing?.machine_id || '');
  const [projectId, setProjectId] = useState(editing?.project_id || '');
  const [items, setItems] = useState<any[]>(editing ? [] : (prefill?.items || [{ description: '', quantity: 1, unit: 'unidad', unit_price: 0 }]));
  const [loadedItems, setLoadedItems] = useState(false);

  // Load items for editing
  useEffect(() => {
    if (editing && !loadedItems) {
      supabase.from('purchase_order_items').select('*').eq('purchase_order_id', editing.id).then(({ data }) => {
        setItems(data && data.length > 0 ? data : [{ description: '', quantity: 1, unit: 'unidad', unit_price: 0 }]);
        setLoadedItems(true);
      });
    }
  }, [editing, loadedItems]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-select'],
    queryFn: async () => { const { data } = await supabase.from('suppliers').select('id, name').eq('status', 'activo'); return data || []; },
  });
  const { data: machines = [] } = useQuery({
    queryKey: ['machines-select'],
    queryFn: async () => { const { data } = await supabase.from('machines').select('id, name, internal_code').eq('active', true); return data || []; },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-select'],
    queryFn: async () => { const { data } = await supabase.from('projects').select('id, name'); return data || []; },
  });

  const totalEstimated = items.reduce((s: number, i: any) => s + ((i.quantity || 0) * (i.unit_price || 0)), 0);

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit: 'unidad', unit_price: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, val: any) => setItems(items.map((item, i) => i === idx ? { ...item, [field]: val } : item));

  const handleSave = async () => {
    if (!title.trim()) return toast.error('El título es obligatorio');
    if (items.length === 0 || !items[0].description) return toast.error('Agrega al menos un ítem');
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('purchase_orders').update({
          title, category: category || null, priority, notes: notes || null,
          supplier_id: supplierId || null, machine_id: machineId || null, project_id: projectId || null,
          total_estimated: totalEstimated,
        }).eq('id', editing.id);
        // Replace items
        await supabase.from('purchase_order_items').delete().eq('purchase_order_id', editing.id);
        if (items.length > 0) {
          await supabase.from('purchase_order_items').insert(
            items.filter((i: any) => i.description).map((i: any) => ({
              purchase_order_id: editing.id, description: i.description, quantity: i.quantity || 1,
              unit: i.unit || 'unidad', unit_price: i.unit_price || 0, tenant_id: tenantId,
            }))
          );
        }
        log('compras', 'editar_oc', 'purchase_orders', editing.id, title);
        toast.success('Orden actualizada');
      } else {
        const { data: oc, error } = await supabase.from('purchase_orders').insert({
          title, category: category || null, priority, notes: notes || null,
          supplier_id: supplierId || null, machine_id: machineId || null, project_id: projectId || null,
          total_estimated: totalEstimated, requested_by: userId, tenant_id: tenantId,
        } as any).select().single();
        if (error) throw error;
        if (items.length > 0 && oc) {
          await supabase.from('purchase_order_items').insert(
            items.filter((i: any) => i.description).map((i: any) => ({
              purchase_order_id: oc.id, description: i.description, quantity: i.quantity || 1,
              unit: i.unit || 'unidad', unit_price: i.unit_price || 0, tenant_id: tenantId,
            }))
          );
        }
        log('compras', 'crear_oc', 'purchase_orders', oc?.id, title);
        toast.success('Orden de compra creada');
      }
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow">{editing ? '✏️ Editar OC' : '🛒 Nueva Solicitud de Compra'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-dm">Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="text-sm font-dm" placeholder="Ej: Compra de filtros hidráulicos" />
            </div>
            <div>
              <Label className="text-xs font-dm">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-sm font-dm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{CATEGORY_OPTIONS.filter(o => o.value !== 'todos').map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-dm">Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="text-sm font-dm"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.filter(o => o.value !== 'todos').map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-dm">Proveedor</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="text-sm font-dm"><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Sin proveedor</SelectItem>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-dm">Máquina (opcional)</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger className="text-sm font-dm"><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Ninguna</SelectItem>
                  {machines.map((m: any) => <SelectItem key={m.id} value={m.id} className="text-xs">{m.internal_code} — {m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-dm">Proyecto (opcional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="text-sm font-dm"><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Ninguno</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-dm">Notas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="text-sm font-dm" rows={2} placeholder="Observaciones adicionales..." />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-dm font-semibold">Ítems</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs font-dm gap-1" onClick={addItem}><Plus className="h-3 w-3" /> Agregar</Button>
            </div>
            <div className="space-y-2">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-start p-2 rounded-lg bg-muted/50 border border-border">
                  <div className="flex-1">
                    <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Descripción del ítem" className="text-xs font-dm h-8 mb-1" />
                    <div className="flex gap-2">
                      <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-20 text-xs font-dm h-7" placeholder="Cant." />
                      <Input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-20 text-xs font-dm h-7" placeholder="Unidad" />
                      <Input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-24 text-xs font-dm h-7" placeholder="Precio unit." />
                      <span className="text-xs font-barlow font-bold self-center min-w-[60px] text-right">${((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}</span>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive shrink-0 mt-1" onClick={() => removeItem(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-right mt-2">
              <span className="text-sm font-barlow font-bold text-foreground">Total estimado: ${totalEstimated.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="font-dm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="bg-gold hover:bg-gold-bright text-black font-dm gap-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear solicitud'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DETAIL MODAL ───────────────────────────────────
function DetailOCModal({ open, onClose, oc, tenantId, userId, userRole, log, qc, onEdit }: any) {
  const [tab, setTab] = useState('resumen');
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canApprove = ['superadmin', 'gerente'].includes(userRole);

  // Items
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['po-items', oc.id],
    queryFn: async () => {
      const { data } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', oc.id).order('created_at');
      return data || [];
    },
  });

  // Documents
  const { data: docs = [], refetch: refetchDocs } = useQuery({
    queryKey: ['po-docs', oc.id],
    queryFn: async () => {
      const { data } = await supabase.from('purchase_order_documents').select('*').eq('purchase_order_id', oc.id).order('uploaded_at', { ascending: false });
      return data || [];
    },
  });

  const totalItems = items.reduce((s: number, i: any) => s + ((i.quantity || 0) * (i.unit_price || 0)), 0);

  // Status transitions
  const sendToApproval = async () => {
    setSubmitting(true);
    try {
      await supabase.from('purchase_orders').update({ status: 'pendiente_aprobacion' }).eq('id', oc.id);
      toast.success('Enviada a aprobación');
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const markReceived = async () => {
    setSubmitting(true);
    try {
      await supabase.from('purchase_orders').update({ status: 'recibida', received_at: new Date().toISOString() }).eq('id', oc.id);
      // Create cost entry
      await supabase.from('cost_entries').insert({
        tenant_id: tenantId, amount: oc.total_approved || oc.total_estimated || 0,
        cost_date: new Date().toISOString().split('T')[0],
        description: `OC ${oc.order_number}: ${oc.title}`,
        machine_id: oc.machine_id || null, project_id: oc.project_id || null,
        entry_type: 'gasto', source: 'compra', cost_type: oc.category || 'general',
        supplier_id: oc.supplier_id || null, created_by: userId,
      } as any);
      toast.success('Orden marcada como recibida y gasto registrado');
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const cancelOrder = async () => {
    await supabase.from('purchase_orders').update({ status: 'cancelada' }).eq('id', oc.id);
    toast.success('Orden cancelada');
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    onClose();
  };

  // Upload document
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('cotizacion');
  const [showUpload, setShowUpload] = useState(false);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !docName) return toast.error('Nombre y archivo son requeridos');
    setUploading(true);
    try {
      const path = `purchase-orders/${oc.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('purchase-orders').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('purchase-orders').getPublicUrl(path);
      await supabase.from('purchase_order_documents').insert({
        purchase_order_id: oc.id, name: docName, doc_type: docType,
        file_url: publicUrl, file_name: file.name, uploaded_by: userId, tenant_id: tenantId,
      });
      toast.success('Documento adjuntado');
      setShowUpload(false);
      setDocName('');
      refetchDocs();
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const deleteDoc = async (id: string) => {
    await supabase.from('purchase_order_documents').delete().eq('id', id);
    toast.success('Documento eliminado');
    refetchDocs();
  };

  const st = STATUS_STYLES[oc.status] || STATUS_STYLES.borrador;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-barlow flex items-center gap-2">
              📋 {oc.order_number || 'OC'} — {oc.title}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="resumen" className="text-xs font-dm">Resumen</TabsTrigger>
              <TabsTrigger value="items" className="text-xs font-dm">Ítems ({items.length})</TabsTrigger>
              <TabsTrigger value="documentos" className="text-xs font-dm">Documentos ({docs.length})</TabsTrigger>
              <TabsTrigger value="historial" className="text-xs font-dm">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3 text-xs font-dm">
                <div><span className="text-muted-foreground">Categoría:</span> <span className="font-medium ml-1">{oc.category || '—'}</span></div>
                <div><span className="text-muted-foreground">Prioridad:</span> <span className="font-medium ml-1">{oc.priority}</span></div>
                <div><span className="text-muted-foreground">Proveedor:</span> <span className="font-medium ml-1">{oc.suppliers?.name || '—'}</span></div>
                <div><span className="text-muted-foreground">Máquina:</span> <span className="font-medium ml-1">{oc.machines ? `${oc.machines.internal_code} — ${oc.machines.name}` : '—'}</span></div>
                <div><span className="text-muted-foreground">Proyecto:</span> <span className="font-medium ml-1">{oc.projects?.name || '—'}</span></div>
                <div><span className="text-muted-foreground">Solicitado por:</span> <span className="font-medium ml-1">{oc.users?.full_name || '—'}</span></div>
                <div><span className="text-muted-foreground">Creada:</span> <span className="font-medium ml-1">{oc.created_at ? format(new Date(oc.created_at), 'dd MMM yyyy HH:mm', { locale: es }) : '—'}</span></div>
                <div><span className="text-muted-foreground">Total estimado:</span> <span className="font-bold font-barlow ml-1 text-sm">${(oc.total_estimated || 0).toLocaleString()}</span></div>
                {oc.total_approved != null && (
                  <div><span className="text-muted-foreground">Total aprobado:</span> <span className="font-bold font-barlow ml-1 text-sm text-success">${(oc.total_approved || 0).toLocaleString()}</span></div>
                )}
                {oc.approved_at && (
                  <div><span className="text-muted-foreground">Aprobada:</span> <span className="font-medium ml-1">{format(new Date(oc.approved_at), 'dd MMM yyyy HH:mm', { locale: es })}</span></div>
                )}
                {oc.received_at && (
                  <div><span className="text-muted-foreground">Recibida:</span> <span className="font-medium ml-1">{format(new Date(oc.received_at), 'dd MMM yyyy HH:mm', { locale: es })}</span></div>
                )}
                {oc.rejection_reason && (
                  <div className="col-span-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                    <span className="text-destructive font-medium">Motivo rechazo:</span> <span className="ml-1">{oc.rejection_reason}</span>
                  </div>
                )}
              </div>
              {oc.notes && (
                <div className="p-2 rounded bg-muted/50 text-xs font-dm">
                  <span className="text-muted-foreground font-medium">Notas:</span> {oc.notes}
                </div>
              )}
              {oc.approved_signature_url && (
                <div>
                  <span className="text-xs font-dm text-muted-foreground">Firma de aprobación:</span>
                  <img src={oc.approved_signature_url} alt="Firma" className="h-16 mt-1 rounded border border-border bg-white" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="items" className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-dm">Descripción</TableHead>
                    <TableHead className="text-[11px] font-dm text-right">Cant.</TableHead>
                    <TableHead className="text-[11px] font-dm">Unidad</TableHead>
                    <TableHead className="text-[11px] font-dm text-right">P. Unit.</TableHead>
                    <TableHead className="text-[11px] font-dm text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs font-dm">{i.description}</TableCell>
                      <TableCell className="text-xs font-barlow text-right">{i.quantity}</TableCell>
                      <TableCell className="text-xs font-dm">{i.unit || '—'}</TableCell>
                      <TableCell className="text-xs font-barlow text-right">${(i.unit_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-barlow font-bold text-right">${((i.quantity || 0) * (i.unit_price || 0)).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right mt-2 text-sm font-barlow font-bold">Total: ${totalItems.toLocaleString()}</div>
            </TabsContent>

            <TabsContent value="documentos" className="mt-3 space-y-3">
              <Button variant="outline" size="sm" className="text-xs font-dm gap-1" onClick={() => setShowUpload(true)}>
                <Upload className="h-3 w-3" /> Adjuntar documento
              </Button>
              {docs.length === 0 ? (
                <p className="text-xs text-muted-foreground font-dm py-4 text-center">Sin documentos adjuntos</p>
              ) : (
                <div className="space-y-2">
                  {docs.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-dm font-medium">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground font-dm">{d.doc_type} · {d.file_name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs font-dm" onClick={() => window.open(d.file_url, '_blank')}>
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteDoc(d.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload sub-dialog */}
              {showUpload && (
                <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-dm">Nombre *</Label>
                      <Input value={docName} onChange={e => setDocName(e.target.value)} className="text-xs h-8 font-dm" placeholder="Nombre del documento" />
                    </div>
                    <div>
                      <Label className="text-xs font-dm">Tipo</Label>
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger className="h-8 text-xs font-dm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cotizacion" className="text-xs">Cotización</SelectItem>
                          <SelectItem value="factura" className="text-xs">Factura</SelectItem>
                          <SelectItem value="comprobante_pago" className="text-xs">Comprobante</SelectItem>
                          <SelectItem value="otro" className="text-xs">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <input ref={fileRef} type="file" className="text-xs" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs font-dm bg-gold hover:bg-gold-bright text-black" onClick={handleUpload} disabled={uploading}>
                      {uploading ? 'Subiendo...' : 'Subir'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-dm" onClick={() => setShowUpload(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historial" className="mt-3">
              <div className="space-y-3 pl-4 border-l-2 border-border">
                <TimelineItem icon="📝" title="Creada" date={oc.created_at} detail={`Por ${oc.users?.full_name || '—'}`} />
                {oc.status !== 'borrador' && <TimelineItem icon="📤" title="Enviada a aprobación" date={oc.updated_at} />}
                {oc.status === 'aprobada' && <TimelineItem icon="✅" title="Aprobada" date={oc.approved_at} detail={`Monto: $${(oc.total_approved || 0).toLocaleString()}`} />}
                {oc.status === 'rechazada' && <TimelineItem icon="❌" title="Rechazada" date={oc.updated_at} detail={oc.rejection_reason} />}
                {oc.status === 'recibida' && <TimelineItem icon="📦" title="Recibida" date={oc.received_at} />}
                {oc.status === 'cancelada' && <TimelineItem icon="🚫" title="Cancelada" date={oc.updated_at} />}
              </div>
            </TabsContent>
          </Tabs>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-border">
            {oc.status === 'borrador' && (
              <>
                <Button variant="outline" size="sm" className="text-xs font-dm" onClick={() => onEdit(oc)}>✏️ Editar</Button>
                <Button size="sm" className="text-xs font-dm bg-gold hover:bg-gold-bright text-black" onClick={sendToApproval} disabled={submitting}>
                  📤 Enviar a aprobación
                </Button>
              </>
            )}
            {oc.status === 'pendiente_aprobacion' && canApprove && (
              <>
                <Button size="sm" className="text-xs font-dm bg-success hover:bg-success/90 text-white" onClick={() => setShowApprove(true)}>✅ Aprobar</Button>
                <Button variant="destructive" size="sm" className="text-xs font-dm" onClick={() => setShowReject(true)}>❌ Rechazar</Button>
              </>
            )}
            {oc.status === 'aprobada' && (
              <Button size="sm" className="text-xs font-dm bg-primary hover:bg-primary/90 text-primary-foreground" onClick={markReceived} disabled={submitting}>
                📦 Marcar como Recibida
              </Button>
            )}
            {!['recibida', 'cancelada'].includes(oc.status) && (
              <Button variant="ghost" size="sm" className="text-xs font-dm text-muted-foreground" onClick={cancelOrder}>🚫 Cancelar</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve modal */}
      {showApprove && (
        <ApproveModal
          open={showApprove}
          onClose={() => setShowApprove(false)}
          oc={oc}
          userId={userId}
          qc={qc}
          onDone={() => { setShowApprove(false); onClose(); }}
        />
      )}

      {/* Reject modal */}
      {showReject && (
        <RejectModal
          open={showReject}
          onClose={() => setShowReject(false)}
          oc={oc}
          qc={qc}
          onDone={() => { setShowReject(false); onClose(); }}
        />
      )}
    </>
  );
}

function TimelineItem({ icon, title, date, detail }: { icon: string; title: string; date?: string; detail?: string }) {
  return (
    <div className="relative -left-[9px]">
      <div className="flex items-start gap-2">
        <span className="text-sm">{icon}</span>
        <div>
          <p className="text-xs font-dm font-medium">{title}</p>
          {date && <p className="text-[10px] text-muted-foreground font-dm">{format(new Date(date), 'dd MMM yyyy HH:mm', { locale: es })}</p>}
          {detail && <p className="text-[10px] text-muted-foreground font-dm mt-0.5">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── APPROVE MODAL ──────────────────────────────────
function ApproveModal({ open, onClose, oc, userId, qc, onDone }: any) {
  const [amount, setAmount] = useState(oc.total_estimated || 0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 120 * dpr;
    canvas.style.height = '120px';
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, 120);
    }
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e: any) => {
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
  };
  const draw = (e: any) => {
    if (!drawingRef.current || !canvasRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d')!;
    const pos = getPos(e);
    const last = lastPointRef.current!;
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
    lastPointRef.current = pos;
  };
  const stopDraw = () => { drawingRef.current = false; lastPointRef.current = null; };

  const clearSig = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, rect.width, 120);
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      let sigUrl = null;
      const canvas = canvasRef.current;
      if (canvas) {
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
        if (blob) {
          const path = `signatures/approve_${oc.id}_${Date.now()}.png`;
          await supabase.storage.from('documents').upload(path, blob);
          const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
          sigUrl = publicUrl;
        }
      }
      await supabase.from('purchase_orders').update({
        status: 'aprobada', approved_by: userId, approved_at: new Date().toISOString(),
        total_approved: amount, approval_notes: notes || null, approved_signature_url: sigUrl,
      }).eq('id', oc.id);
      toast.success('Orden aprobada');
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-barlow">✅ Aprobar OC {oc.order_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-dm">Monto aprobado</Label>
            <Input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className="text-sm font-barlow" />
          </div>
          <div>
            <Label className="text-xs font-dm">Notas de aprobación (opcional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="text-xs font-dm" rows={2} />
          </div>
          <div>
            <Label className="text-xs font-dm">Firma del aprobador</Label>
            <canvas
              ref={canvasRef}
              className="w-full border border-border rounded-lg bg-white cursor-crosshair touch-none"
              style={{ height: 120 }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />
            <Button variant="ghost" size="sm" className="text-[10px] font-dm mt-1" onClick={clearSig}>Limpiar firma</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="font-dm" onClick={onClose}>Cancelar</Button>
          <Button className="bg-success hover:bg-success/90 text-white font-dm" onClick={handleApprove} disabled={saving}>
            {saving ? 'Aprobando...' : 'Confirmar aprobación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── REJECT MODAL ───────────────────────────────────
function RejectModal({ open, onClose, oc, qc, onDone }: any) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReject = async () => {
    if (reason.trim().length < 20) return toast.error('El motivo debe tener al menos 20 caracteres');
    setSaving(true);
    try {
      await supabase.from('purchase_orders').update({
        status: 'rechazada', rejection_reason: reason,
      }).eq('id', oc.id);
      toast.success('Orden rechazada');
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-barlow">❌ Rechazar OC {oc.order_number}</DialogTitle>
        </DialogHeader>
        <div>
          <Label className="text-xs font-dm">Motivo del rechazo * (mín. 20 caracteres)</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} className="text-xs font-dm" rows={3} placeholder="Explica el motivo del rechazo..." />
          <p className="text-[10px] text-muted-foreground font-dm mt-1">{reason.length}/20 caracteres mínimo</p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="font-dm" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" className="font-dm" onClick={handleReject} disabled={saving || reason.trim().length < 20}>
            {saving ? 'Rechazando...' : 'Confirmar rechazo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
