import { useState, useRef, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Package, Wrench, BriefcaseMedical, Plus, Download, Upload,
  Search, ArrowRightLeft, X, Check, AlertTriangle, Mic, Trash2
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { ActionBar, ActionBarLeft, ActionBarRight } from '@/components/ui/action-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { generateDeliveryActPDF, downloadPDF } from '@/lib/pdf-generator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// ─── Zod Schemas ────────────────────────────────────
const consumableSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  category: z.enum(['combustible', 'lubricante', 'refrigerante', 'desengrasante', 'grasas', 'filtros', 'otros']),
  unit: z.enum(['galón', 'litro', 'kg', 'unidad', 'ml', 'm', 'par']),
  stock_current: z.coerce.number().min(0).default(0),
  stock_minimum: z.coerce.number().min(0).default(0),
  unit_cost: z.coerce.number().min(0).default(0),
  supplier_id: z.string().optional().nullable(),
});

const toolSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  internal_code: z.string().optional(),
  serial_number: z.string().optional(),
  category: z.enum(['electrica', 'manual', 'medicion', 'neumatica', 'otro']),
  status: z.enum(['disponible', 'en_uso', 'en_reparacion', 'de_baja']).default('disponible'),
  purchase_date: z.string().optional(),
  purchase_cost: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type ConsumableForm = z.infer<typeof consumableSchema>;
type ToolForm = z.infer<typeof toolSchema>;

// ─── Category Badges ────────────────────────────────
const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  combustible: { bg: 'bg-warning-bg', text: 'text-warning', icon: '⛽' },
  lubricante: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '🛢️' },
  refrigerante: { bg: 'bg-success-bg', text: 'text-success', icon: '❄️' },
  filtros: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '🔵' },
  grasas: { bg: 'bg-muted', text: 'text-muted-foreground', icon: '⚫' },
  desengrasante: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🧴' },
  otros: { bg: 'bg-muted', text: 'text-muted-foreground', icon: '' },
};

const TOOL_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  disponible: { bg: 'bg-success-bg', text: 'text-success', label: '✓ Disponible' },
  en_uso: { bg: 'bg-blue-100', text: 'text-blue-700', label: '⚙️ En uso' },
  en_reparacion: { bg: 'bg-orange-100', text: 'text-orange-700', label: '🔧 En reparación' },
  de_baja: { bg: 'bg-muted', text: 'text-muted-foreground', label: '✕ De baja' },
};

// ─── Signature Canvas ───────────────────────────────
function SignatureCanvas({ onSignature, height = 150 }: { onSignature: (data: string | null) => void; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const start = (e: any) => {
    drawing.current = true;
    hasDrawn.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const move = (e: any) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    onSignature(canvasRef.current!.toDataURL('image/png'));
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    hasDrawn.current = false;
    onSignature(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={height}
        className="w-full border-2 border-dashed border-border rounded-xl bg-card touch-none"
        style={{ height: `${height}px` }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <Button variant="ghost" size="sm" onClick={clear} className="mt-1 text-xs text-muted-foreground">
        Limpiar firma
      </Button>
    </div>
  );
}

// ─── Main Inventario Page ───────────────────────────
export default function Inventario() {
  usePageTitle('Inventario');
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.tenant_id;
  const { log } = useLog();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('consumibles');
  const [search, setSearch] = useState('');

  // ── KPI Queries ──
  const { data: consumables = [], isLoading: loadingC } = useQuery({
    queryKey: ['inventory-consumables', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_consumables')
        .select('*, suppliers(name)')
        .eq('active', true)
        .order('category').order('name');
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: tools = [], isLoading: loadingT } = useQuery({
    queryKey: ['inventory-tools', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_tools')
        .select('*, work_orders(code, machines(name)), personnel(full_name)')
        .order('status').order('name');
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: kits = [], isLoading: loadingK } = useQuery({
    queryKey: ['inventory-kits', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_kits')
        .select('*, machines(name, internal_code, type), inventory_kit_items(id, item_type)')
        .order('status').order('name');
      return data || [];
    },
    enabled: !!tenantId,
  });

  const criticalCount = consumables.filter((c: any) => (c.stock_current ?? 0) <= (c.stock_minimum ?? 0) && (c.stock_minimum ?? 0) > 0).length;
  const toolsInUse = tools.filter((t: any) => t.status === 'en_uso').length;

  const handleTabChange = (v: string) => { setActiveTab(v); setSearch(''); };

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Consumibles" value={consumables.length} />
        <StatCard label="Stock crítico" value={criticalCount} className={criticalCount > 0 ? 'border-destructive/50' : ''} />
        <StatCard label="Herramientas" value={tools.length} />
        <StatCard label="En uso" value={toolsInUse} />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start bg-card border border-border overflow-x-auto">
          <TabsTrigger value="consumibles" className="gap-1.5 font-dm text-xs">
            <Package className="h-3.5 w-3.5" /> Consumibles
          </TabsTrigger>
          <TabsTrigger value="herramientas" className="gap-1.5 font-dm text-xs">
            <Wrench className="h-3.5 w-3.5" /> Herramientas
          </TabsTrigger>
          <TabsTrigger value="kits" className="gap-1.5 font-dm text-xs">
            <BriefcaseMedical className="h-3.5 w-3.5" /> Kits de Emergencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consumibles">
          <ConsumablesTab consumables={consumables} loading={loadingC} search={search} setSearch={setSearch} tenantId={tenantId!} userId={user?.id!} log={log} qc={qc} />
        </TabsContent>
        <TabsContent value="herramientas">
          <ToolsTab tools={tools} loading={loadingT} search={search} setSearch={setSearch} tenantId={tenantId!} userId={user?.id!} userName={user?.full_name!} log={log} qc={qc} />
        </TabsContent>
        <TabsContent value="kits">
          <KitsTab kits={kits} loading={loadingK} search={search} setSearch={setSearch} tenantId={tenantId!} userId={user?.id!} userName={user?.full_name!} log={log} qc={qc} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// TAB 1 — CONSUMIBLES
// ═══════════════════════════════════════════════════
function ConsumablesTab({ consumables, loading, search, setSearch, tenantId, userId, log, qc }: any) {
  const [catFilter, setCatFilter] = useState('todos');
  const [stockFilter, setStockFilter] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showExit, setShowExit] = useState<any>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [showHistory, setShowHistory] = useState<any>(null);
  const [selectedConsumables, setSelectedConsumables] = useState<string[]>([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const bulkDeleteConsumables = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('inventory_consumables').delete().eq('tenant_id', tenantId).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-consumables'] });
      toast.success(`${selectedConsumables.length} consumible(s) eliminado(s)`);
      setSelectedConsumables([]);
      setShowBulkDelete(false);
    },
    onError: () => toast.error('Error al eliminar. Algunos pueden tener movimientos asociados.'),
  });

  const catOptions = [
    { label: 'Todos', value: 'todos' }, { label: 'Combustible', value: 'combustible' },
    { label: 'Lubricante', value: 'lubricante' }, { label: 'Refrigerante', value: 'refrigerante' },
    { label: 'Filtros', value: 'filtros' }, { label: 'Grasas', value: 'grasas' },
    { label: 'Desengrasante', value: 'desengrasante' }, { label: 'Otros', value: 'otros' },
  ];

  const filtered = consumables.filter((c: any) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c.category || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== 'todos' && c.category !== catFilter) return false;
    if (stockFilter === 'bajo' && (c.stock_current ?? 0) > (c.stock_minimum ?? 0)) return false;
    if (stockFilter === 'agotado' && (c.stock_current ?? 0) > 0) return false;
    return true;
  });

  const exportCSV = () => {
    const rows = [['Nombre', 'Categoría', 'Stock', 'Mín', 'Unidad', 'Costo', 'Proveedor']];
    filtered.forEach((c: any) => rows.push([c.name, c.category, c.stock_current, c.stock_minimum, c.unit, c.unit_cost, c.suppliers?.name || '']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadPDF(blob, `consumibles-${Date.now()}.csv`);
  };

  return (
    <>
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar consumible..." />
          <FilterPills options={catOptions} value={catFilter} onChange={setCatFilter} />
        </ActionBarLeft>
        <ActionBarRight>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-36 h-9 text-xs font-dm"><SelectValue placeholder="Stock" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="bajo">Bajo mínimo</SelectItem>
              <SelectItem value="agotado">Agotado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setShowEntry(true)} className="gap-1 text-xs font-dm">
            <Download className="h-3.5 w-3.5" /> Registrar entrada
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1 text-xs font-dm bg-gold hover:bg-gold-bright text-white">
            <Plus className="h-3.5 w-3.5" /> Nuevo consumible
          </Button>
        </ActionBarRight>
      </ActionBar>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground font-dm">Sin consumibles registrados. Agrega el primero.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {selectedConsumables.length > 0 && (
            <div className="flex items-center justify-between bg-primary/5 px-4 py-2 border-b border-primary/30">
              <span className="text-sm font-dm font-medium">{selectedConsumables.length} seleccionado{selectedConsumables.length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedConsumables([])}>Cancelar</Button>
                <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={() => setShowBulkDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar ({selectedConsumables.length})
                </Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox"
                    checked={selectedConsumables.length === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedConsumables(e.target.checked ? filtered.map((c: any) => c.id) : [])}
                    className="h-3.5 w-3.5 rounded border-border" />
                </TableHead>
                <TableHead className="font-dm text-xs">Nombre</TableHead>
                <TableHead className="font-dm text-xs">Categoría</TableHead>
                <TableHead className="font-dm text-xs">Stock</TableHead>
                <TableHead className="font-dm text-xs">Mín</TableHead>
                <TableHead className="font-dm text-xs">Unidad</TableHead>
                <TableHead className="font-dm text-xs">Costo unit.</TableHead>
                <TableHead className="font-dm text-xs">Proveedor</TableHead>
                <TableHead className="font-dm text-xs">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => {
                const isCritical = (c.stock_current ?? 0) <= (c.stock_minimum ?? 0) && (c.stock_minimum ?? 0) > 0;
                const isWarning = !isCritical && (c.stock_current ?? 0) <= (c.stock_minimum ?? 0) * 1.5 && (c.stock_minimum ?? 0) > 0;
                const style = CATEGORY_STYLES[c.category] || CATEGORY_STYLES.otros;
                  return (
                    <TableRow key={c.id} className={isCritical ? 'bg-danger-bg/40' : isWarning ? 'bg-warning-bg/40' : selectedConsumables.includes(c.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <input type="checkbox" checked={selectedConsumables.includes(c.id)}
                          onChange={e => setSelectedConsumables(e.target.checked ? [...selectedConsumables, c.id] : selectedConsumables.filter(x => x !== c.id))}
                          className="h-3.5 w-3.5 rounded border-border" />
                      </TableCell>
                    <TableCell>
                      <button className="text-sm font-medium font-dm text-foreground hover:text-gold transition-colors text-left" onClick={() => setShowHistory(c)}>
                        {c.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
                        {style.icon} {c.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold font-barlow text-sm ${isCritical ? 'text-destructive' : 'text-success'}`}>
                        {isCritical && (c.stock_current ?? 0) === 0 ? '🚨 ' : isCritical ? '⚠️ ' : ''}
                        {c.stock_current ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-dm">{c.stock_minimum ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-dm">{c.unit}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-dm">${(c.unit_cost ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-dm">{c.suppliers?.name || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] text-orange-600 font-dm" onClick={() => setShowExit(c)}>
                          📤 Salida
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] font-dm" onClick={() => { setEditing(c); setShowForm(true); }}>
                          ✏️
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {showForm && (
        <ConsumableFormModal
          open={showForm}
          onClose={() => setShowForm(false)}
          editing={editing}
          tenantId={tenantId}
          userId={userId}
          log={log}
          qc={qc}
        />
      )}
      {showExit && (
        <ExitModal
          open={!!showExit}
          onClose={() => setShowExit(null)}
          consumable={showExit}
          tenantId={tenantId}
          userId={userId}
          log={log}
          qc={qc}
        />
      )}
      {showEntry && (
        <EntryModal
          open={showEntry}
          onClose={() => setShowEntry(false)}
          consumables={consumables}
          tenantId={tenantId}
          userId={userId}
          log={log}
          qc={qc}
        />
      )}
      {showHistory && (
        <HistoryModal
          open={!!showHistory}
          onClose={() => setShowHistory(null)}
          consumable={showHistory}
        />
      )}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">⚠️ ¿Eliminar {selectedConsumables.length} consumible{selectedConsumables.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">Esta acción es permanente. Consumibles con movimientos asociados pueden fallar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-dm" disabled={bulkDeleteConsumables.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-dm" disabled={bulkDeleteConsumables.isPending}
              onClick={e => { e.preventDefault(); bulkDeleteConsumables.mutate(selectedConsumables); }}>
              {bulkDeleteConsumables.isPending ? 'Eliminando...' : `Eliminar ${selectedConsumables.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Consumable Form Modal ──
function ConsumableFormModal({ open, onClose, editing, tenantId, userId, log, qc }: any) {
  const [saving, setSaving] = useState(false);
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-select'],
    queryFn: async () => { const { data } = await supabase.from('suppliers').select('id, name').eq('status', 'activo'); return data || []; },
  });

  const form = useForm<ConsumableForm>({
    resolver: zodResolver(consumableSchema),
    defaultValues: editing ? {
      name: editing.name,
      category: editing.category,
      unit: editing.unit,
      stock_current: editing.stock_current ?? 0,
      stock_minimum: editing.stock_minimum ?? 0,
      unit_cost: editing.unit_cost ?? 0,
      supplier_id: editing.supplier_id || undefined,
    } : { stock_current: 0, stock_minimum: 0, unit_cost: 0 },
  });

  const onSubmit = async (vals: ConsumableForm) => {
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('inventory_consumables').update(vals).eq('id', editing.id);
        log('inventario', 'editar_consumible', 'inventory_consumables', editing.id, vals.name);
        toast.success('Consumible actualizado');
      } else {
        const { data } = await supabase.from('inventory_consumables').insert([{ ...vals, tenant_id: tenantId }] as any).select().single();
        if (vals.stock_current > 0 && data) {
          await supabase.from('inventory_movements').insert({
            tenant_id: tenantId, movement_type: 'entrada', item_type: 'consumible',
            item_id: data.id, quantity: vals.stock_current, unit_cost: vals.unit_cost,
            reason: 'Stock inicial', registered_by: userId,
          });
        }
        log('inventario', 'crear_consumible', 'inventory_consumables', data?.id, vals.name);
        toast.success('Consumible creado');
      }
      qc.invalidateQueries({ queryKey: ['inventory-consumables'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-barlow">{editing ? 'Editar consumible' : 'Nuevo consumible'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="font-dm text-xs">Nombre *</FormLabel>
                  <FormControl><Input {...field} className="font-dm text-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm text-xs">Categoría *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {['combustible', 'lubricante', 'refrigerante', 'desengrasante', 'grasas', 'filtros', 'otros'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm text-xs">Unidad *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {['galón', 'litro', 'kg', 'unidad', 'ml', 'm', 'par'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stock_current" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm text-xs">Stock actual</FormLabel>
                  <FormControl><Input type="number" {...field} className="font-dm text-sm" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="stock_minimum" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm text-xs">Stock mínimo</FormLabel>
                  <FormControl><Input type="number" {...field} className="font-dm text-sm" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="unit_cost" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm text-xs">Costo unitario (COP)</FormLabel>
                  <FormControl><Input type="number" {...field} className="font-dm text-sm" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="supplier_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm text-xs">Proveedor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl><SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <Button type="submit" disabled={saving} className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear consumible'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Exit Modal ──
function ExitModal({ open, onClose, consumable, tenantId, userId, log, qc }: any) {
  const [qty, setQty] = useState(1);
  const [linkType, setLinkType] = useState<'ot' | 'project' | 'none'>('none');
  const [linkedOT, setLinkedOT] = useState('');
  const [linkedProject, setLinkedProject] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: activeOTs = [] } = useQuery({
    queryKey: ['active-ots-select'],
    queryFn: async () => {
      const { data } = await supabase.from('work_orders').select('id, code, machines(name)')
        .in('status', ['creada', 'asignada', 'en_curso']);
      return data || [];
    },
  });

  const { data: activeProjects = [] } = useQuery({
    queryKey: ['active-projects-select'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').eq('status', 'activo');
      return data || [];
    },
  });

  const resultStock = (consumable.stock_current ?? 0) - qty;

  const handleSubmit = async () => {
    if (qty <= 0 || qty > (consumable.stock_current ?? 0)) return;
    setSaving(true);
    try {
      await supabase.from('inventory_consumables').update({ stock_current: resultStock }).eq('id', consumable.id);
      await supabase.from('inventory_movements').insert({
        tenant_id: tenantId, movement_type: 'salida', item_type: 'consumible',
        item_id: consumable.id, quantity: qty, unit_cost: consumable.unit_cost,
        related_ot_id: linkType === 'ot' ? linkedOT : null,
        related_project_id: linkType === 'project' ? linkedProject : null,
        reason, registered_by: userId,
      });

      if (resultStock <= (consumable.stock_minimum ?? 0)) {
        await supabase.from('alerts').insert({
          tenant_id: tenantId, type: 'stock_minimo',
          severity: resultStock === 0 ? 'critical' : 'warning',
          message: `${consumable.name} — stock bajo mínimo (${resultStock} ${consumable.unit})`,
        });
      }

      if (linkType === 'ot' && linkedOT) {
        await supabase.from('work_order_parts').insert({
          work_order_id: linkedOT, consumable_id: consumable.id,
          quantity: qty, unit_cost: consumable.unit_cost, registered_by: userId,
        });
        await supabase.rpc('update_ot_parts_cost', { ot_id: linkedOT });
      }

      log('inventario', 'salida_consumible', 'inventory_consumables', consumable.id, consumable.name);
      toast.success(`Salida registrada: ${qty} ${consumable.unit} de ${consumable.name}`);
      qc.invalidateQueries({ queryKey: ['inventory-consumables'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-barlow">Salida de stock — {consumable.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground font-dm">Stock disponible: <strong>{consumable.stock_current} {consumable.unit}</strong></p>
        <div className="space-y-4">
          <div>
            <Label className="font-dm text-xs">Cantidad a retirar *</Label>
            <Input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} min={1} max={consumable.stock_current ?? 0} className="font-dm" />
            {qty > 0 && qty <= (consumable.stock_current ?? 0) && (
              <p className="text-xs text-muted-foreground mt-1 font-dm">Stock resultante: {resultStock}</p>
            )}
            {qty > (consumable.stock_current ?? 0) && (
              <p className="text-xs text-destructive mt-1 font-dm">Cantidad supera el stock disponible</p>
            )}
          </div>
          <div>
            <Label className="font-dm text-xs mb-2 block">Vincular a</Label>
            <div className="flex gap-2">
              {(['ot', 'project', 'none'] as const).map(lt => (
                <button key={lt} onClick={() => setLinkType(lt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-dm border transition-colors ${linkType === lt ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted-foreground'}`}>
                  {lt === 'ot' ? 'Orden de Trabajo' : lt === 'project' ? 'Proyecto' : 'Uso general'}
                </button>
              ))}
            </div>
          </div>
          {linkType === 'ot' && (
            <Select value={linkedOT} onValueChange={setLinkedOT}>
              <SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona OT" /></SelectTrigger>
              <SelectContent>
                {activeOTs.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.code} · {o.machines?.name || ''}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {linkType === 'project' && (
            <Select value={linkedProject} onValueChange={setLinkedProject}>
              <SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona proyecto" /></SelectTrigger>
              <SelectContent>
                {activeProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div>
            <Label className="font-dm text-xs">Motivo / observación</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Opcional" className="font-dm text-sm" />
          </div>
          <Button onClick={handleSubmit} disabled={saving || qty <= 0 || qty > (consumable.stock_current ?? 0)}
            className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
            {saving ? 'Registrando...' : 'Confirmar salida'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Entry Modal ──
function EntryModal({ open, onClose, consumables, tenantId, userId, log, qc }: any) {
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [invoice, setInvoice] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = consumables.find((c: any) => c.id === selectedId);

  useEffect(() => {
    if (selected) setUnitCost(selected.unit_cost ?? 0);
  }, [selected]);

  const handleSubmit = async () => {
    if (!selected || qty <= 0) return;
    setSaving(true);
    try {
      const newStock = (selected.stock_current ?? 0) + qty;
      await supabase.from('inventory_consumables').update({ stock_current: newStock, unit_cost: unitCost }).eq('id', selectedId);
      await supabase.from('inventory_movements').insert({
        tenant_id: tenantId, movement_type: 'entrada', item_type: 'consumible',
        item_id: selectedId, quantity: qty, unit_cost: unitCost,
        reason: `Factura: ${invoice || 'S/N'} — ${obs}`, registered_by: userId,
      });

      // Resolve existing stock alerts
      await supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('type', 'stock_minimo').eq('resolved', false).ilike('message', `%${selected.name}%`);

      log('inventario', 'entrada_consumible', 'inventory_consumables', selectedId, selected.name);
      toast.success(`Entrada registrada: ${qty} ${selected.unit} de ${selected.name}`);
      qc.invalidateQueries({ queryKey: ['inventory-consumables'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-barlow">Registrar entrada de stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="font-dm text-xs">Consumible *</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona consumible" /></SelectTrigger>
              <SelectContent>
                {consumables.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.stock_current} {c.unit})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground font-dm">Stock actual: <strong>{selected.stock_current} {selected.unit}</strong></p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-dm text-xs">Cantidad *</Label>
              <Input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} min={1} className="font-dm" />
              {selected && qty > 0 && (
                <p className="text-xs text-muted-foreground mt-1 font-dm">Stock resultante: {(selected.stock_current ?? 0) + qty}</p>
              )}
            </div>
            <div>
              <Label className="font-dm text-xs">Costo unitario (COP)</Label>
              <Input type="number" value={unitCost} onChange={e => setUnitCost(Number(e.target.value))} className="font-dm" />
            </div>
          </div>
          <div>
            <Label className="font-dm text-xs">N° factura / remisión</Label>
            <Input value={invoice} onChange={e => setInvoice(e.target.value)} placeholder="Opcional" className="font-dm text-sm" />
          </div>
          <div>
            <Label className="font-dm text-xs">Observaciones</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Opcional" className="font-dm text-sm" />
          </div>
          <Button onClick={handleSubmit} disabled={saving || !selectedId || qty <= 0}
            className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
            {saving ? 'Registrando...' : 'Confirmar entrada'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── History Modal ──
function HistoryModal({ open, onClose, consumable }: any) {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['inventory-movements', consumable.id],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_movements')
        .select('*, users(full_name)')
        .eq('item_id', consumable.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!consumable.id,
  });

  // Build chart data from movements (reverse chronological → chronological)
  const chartData = [...movements].reverse().reduce((acc: any[], mv: any, i: number) => {
    const prev = i > 0 ? acc[i - 1].stock : 0;
    const stock = mv.movement_type === 'entrada' ? prev + mv.quantity : prev - mv.quantity;
    acc.push({ date: format(new Date(mv.created_at), 'dd/MM', { locale: es }), stock: Math.max(0, stock) });
    return acc;
  }, []);

  const style = CATEGORY_STYLES[consumable.category] || CATEGORY_STYLES.otros;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow flex items-center gap-2">
            {consumable.name}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
              {style.icon} {consumable.category}
            </span>
          </DialogTitle>
        </DialogHeader>
        <p className="text-2xl font-bold font-barlow text-foreground">{consumable.stock_current} <span className="text-sm text-muted-foreground font-dm">{consumable.unit}</span></p>

        {chartData.length > 2 && (
          <div className="h-40 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine y={consumable.stock_minimum ?? 0} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label="Mín" />
                <Line type="monotone" dataKey="stock" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="space-y-1 mt-4">
          <p className="text-xs font-dm uppercase tracking-wider text-muted-foreground font-semibold">Movimientos</p>
          {isLoading ? <Skeleton className="h-20 w-full" /> : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground font-dm py-4 text-center">Sin movimientos registrados</p>
          ) : movements.map((mv: any) => (
            <div key={mv.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-lg">{mv.movement_type === 'entrada' ? '📥' : '📤'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold font-dm ${mv.movement_type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                  {mv.movement_type === 'entrada' ? '+' : '-'}{mv.quantity} {consumable.unit}
                </p>
                <p className="text-xs text-muted-foreground font-dm truncate">{mv.reason || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-dm">{mv.users?.full_name || '—'}</p>
                <p className="text-[10px] text-muted-foreground font-dm">{format(new Date(mv.created_at), 'dd MMM HH:mm', { locale: es })}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════
// TAB 2 — HERRAMIENTAS
// ═══════════════════════════════════════════════════
function ToolsTab({ tools, loading, search, setSearch, tenantId, userId, userName, log, qc }: any) {
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showAssign, setShowAssign] = useState<any>(null);
  const [showReturn, setShowReturn] = useState<any>(null);

  const statusOptions = [
    { label: 'Todas', value: 'todos' }, { label: 'Disponible', value: 'disponible' },
    { label: 'En uso', value: 'en_uso' }, { label: 'En reparación', value: 'en_reparacion' },
    { label: 'De baja', value: 'de_baja' },
  ];

  const filtered = tools.filter((t: any) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !(t.internal_code || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'todos' && t.status !== statusFilter) return false;
    return true;
  });

  return (
    <>
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar herramienta..." />
          <FilterPills options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
        </ActionBarLeft>
        <ActionBarRight>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1 text-xs font-dm bg-gold hover:bg-gold-bright text-white">
            <Plus className="h-3.5 w-3.5" /> Nueva herramienta
          </Button>
        </ActionBarRight>
      </ActionBar>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground font-dm">Sin herramientas en inventario.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-dm text-xs">Código</TableHead>
                <TableHead className="font-dm text-xs">Nombre</TableHead>
                <TableHead className="font-dm text-xs">Categoría</TableHead>
                <TableHead className="font-dm text-xs">Estado</TableHead>
                <TableHead className="font-dm text-xs">Asignada a</TableHead>
                <TableHead className="font-dm text-xs">Costo compra</TableHead>
                <TableHead className="font-dm text-xs">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t: any) => {
                const st = TOOL_STATUS_STYLES[t.status] || TOOL_STATUS_STYLES.disponible;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs font-barlow text-gold">{t.internal_code || '—'}</TableCell>
                    <TableCell className="text-sm font-dm font-medium">{t.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-dm capitalize">{t.category || '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-dm">
                      {t.work_orders ? `${t.work_orders.code} · ${t.work_orders.machines?.name || ''}` :
                       t.personnel?.full_name || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-dm">{t.purchase_cost ? `$${t.purchase_cost.toLocaleString()}` : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {t.status === 'disponible' && (
                          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-blue-600 font-dm" onClick={() => setShowAssign(t)}>
                            Asignar a OT
                          </Button>
                        )}
                        {t.status === 'en_uso' && (
                          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-green-600 font-dm" onClick={() => setShowReturn(t)}>
                            Devolver
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] font-dm" onClick={() => { setEditing(t); setShowForm(true); }}>
                          ✏️
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {showForm && (
        <ToolFormModal open={showForm} onClose={() => setShowForm(false)} editing={editing} tenantId={tenantId} log={log} qc={qc} />
      )}
      {showAssign && (
        <AssignToolModal open={!!showAssign} onClose={() => setShowAssign(null)} tool={showAssign} tenantId={tenantId} userId={userId} userName={userName} log={log} qc={qc} />
      )}
      {showReturn && (
        <ReturnToolModal open={!!showReturn} onClose={() => setShowReturn(null)} tool={showReturn} tenantId={tenantId} userId={userId} log={log} qc={qc} />
      )}
    </>
  );
}

// ── Tool Form Modal ──
function ToolFormModal({ open, onClose, editing, tenantId, log, qc }: any) {
  const [saving, setSaving] = useState(false);
  const form = useForm<ToolForm>({
    resolver: zodResolver(toolSchema),
    defaultValues: editing ? {
      name: editing.name, internal_code: editing.internal_code || '', serial_number: editing.serial_number || '',
      category: editing.category || 'manual', status: editing.status || 'disponible',
      purchase_date: editing.purchase_date || '', purchase_cost: editing.purchase_cost ?? 0, notes: editing.notes || '',
    } : { status: 'disponible', category: 'manual' },
  });

  const onSubmit = async (vals: ToolForm) => {
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('inventory_tools').update(vals).eq('id', editing.id);
        log('inventario', 'editar_herramienta', 'inventory_tools', editing.id, vals.name);
        toast.success('Herramienta actualizada');
      } else {
        const { data } = await supabase.from('inventory_tools').insert([{ ...vals, tenant_id: tenantId }] as any).select().single();
        log('inventario', 'crear_herramienta', 'inventory_tools', data?.id, vals.name);
        toast.success('Herramienta creada');
      }
      qc.invalidateQueries({ queryKey: ['inventory-tools'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-barlow">{editing ? 'Editar herramienta' : 'Nueva herramienta'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="font-dm text-xs">Nombre *</FormLabel>
                  <FormControl><Input {...field} className="font-dm text-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="internal_code" render={({ field }) => (
                <FormItem><FormLabel className="font-dm text-xs">Código interno</FormLabel><FormControl><Input {...field} className="font-dm text-sm" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="serial_number" render={({ field }) => (
                <FormItem><FormLabel className="font-dm text-xs">N° serie</FormLabel><FormControl><Input {...field} className="font-dm text-sm" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm text-xs">Categoría *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="font-dm text-sm"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {['electrica', 'manual', 'medicion', 'neumatica', 'otro'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dm text-xs">Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="font-dm text-sm"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {['disponible', 'en_uso', 'en_reparacion', 'de_baja'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="purchase_date" render={({ field }) => (
                <FormItem><FormLabel className="font-dm text-xs">Fecha compra</FormLabel><FormControl><Input type="date" {...field} className="font-dm text-sm" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="purchase_cost" render={({ field }) => (
                <FormItem><FormLabel className="font-dm text-xs">Costo compra (COP)</FormLabel><FormControl><Input type="number" {...field} className="font-dm text-sm" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel className="font-dm text-xs">Notas</FormLabel><FormControl><Textarea {...field} rows={2} className="font-dm text-sm" /></FormControl></FormItem>
              )} />
            </div>
            <Button type="submit" disabled={saving} className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear herramienta'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Tool to OT Modal ──
function AssignToolModal({ open, onClose, tool, tenantId, userId, userName, log, qc }: any) {
  const [selectedOT, setSelectedOT] = useState('');
  const [selectedTech, setSelectedTech] = useState('');
  const [obs, setObs] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: activeOTs = [] } = useQuery({
    queryKey: ['active-ots-assign'],
    queryFn: async () => {
      const { data } = await supabase.from('work_orders').select('id, code, machines(name), type')
        .in('status', ['creada', 'asignada', 'en_curso']);
      return data || [];
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians-select'],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('id, full_name, specialty')
        .eq('type', 'tecnico').eq('status', 'activo');
      return data || [];
    },
  });

  const selectedOTData = activeOTs.find((o: any) => o.id === selectedOT);
  const selectedTechData = technicians.find((t: any) => t.id === selectedTech);

  const handleSubmit = async () => {
    if (!selectedOT || !selectedTech || !signature) return;
    setSaving(true);
    try {
      await supabase.from('inventory_tools').update({
        status: 'en_uso', assigned_to_ot: selectedOT, assigned_to_person: selectedTech,
      }).eq('id', tool.id);

      await supabase.from('work_order_tools').insert({
        work_order_id: selectedOT, tool_id: tool.id,
      });

      await supabase.from('inventory_movements').insert({
        tenant_id: tenantId, movement_type: 'salida', item_type: 'herramienta',
        item_id: tool.id, quantity: 1, related_ot_id: selectedOT,
        reason: `Asignada a ${selectedOTData?.code}`, registered_by: userId,
      });

      await supabase.from('delivery_acts').insert({
        tenant_id: tenantId, act_type: 'herramienta_ot', work_order_id: selectedOT,
        personnel_id: selectedTech,
        items: [{ tool_id: tool.id, name: tool.name, code: tool.internal_code }],
        signature_delivery_url: signature,
      });

      // Generate PDF
      try {
        const pdfBlob = await generateDeliveryActPDF({
          type: 'herramienta_ot',
          items: [{ name: tool.name, code: tool.internal_code || '', quantity: 1, unit: 'unidad' }],
          deliveredTo: selectedTechData?.full_name || '',
          deliveredBy: userName,
          otCode: selectedOTData?.code,
          machineName: selectedOTData?.machines?.name,
          signatureDelivery: signature,
          date: new Date(),
        });
        downloadPDF(pdfBlob, `Acta-${selectedOTData?.code}-${tool.internal_code || tool.name}.pdf`);
      } catch { /* PDF generation optional */ }

      log('inventario', 'asignar_herramienta', 'inventory_tools', tool.id, tool.name);
      toast.success('Herramienta asignada y acta generada');
      qc.invalidateQueries({ queryKey: ['inventory-tools'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-barlow">Asignar — {tool.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="font-dm text-xs">OT destino *</Label>
            <Select value={selectedOT} onValueChange={setSelectedOT}>
              <SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona OT" /></SelectTrigger>
              <SelectContent>
                {activeOTs.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.code} · {o.machines?.name || ''} · {o.type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-dm text-xs">Técnico receptor *</Label>
            <Select value={selectedTech} onValueChange={setSelectedTech}>
              <SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona técnico" /></SelectTrigger>
              <SelectContent>
                {technicians.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name} {t.specialty ? `· ${t.specialty}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-dm text-xs">Firma del técnico receptor *</Label>
            <SignatureCanvas onSignature={setSignature} height={120} />
          </div>
          <Button onClick={handleSubmit} disabled={saving || !selectedOT || !selectedTech || !signature}
            className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
            {saving ? 'Generando acta...' : 'Generar acta y asignar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Return Tool Modal ──
function ReturnToolModal({ open, onClose, tool, tenantId, userId, log, qc }: any) {
  const [returnStatus, setReturnStatus] = useState('disponible');
  const [obs, setObs] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusOptions = [
    { value: 'disponible', label: '✅ En buen estado', bg: 'border-green-500 bg-success-bg' },
    { value: 'disponible_danos', label: '⚠️ Con daños menores', bg: 'border-yellow-500 bg-warning-bg' },
    { value: 'en_reparacion', label: '🔧 Requiere reparación', bg: 'border-orange-500 bg-orange-50' },
    { value: 'de_baja', label: '✕ Dada de baja', bg: 'border-red-500 bg-danger-bg' },
  ];

  const handleSubmit = async () => {
    if (!signature) return;
    setSaving(true);
    const finalStatus = (returnStatus === 'disponible_danos' ? 'disponible' : returnStatus) as 'disponible' | 'en_uso' | 'en_reparacion' | 'de_baja';
    try {
      await supabase.from('inventory_tools').update({
        status: finalStatus, assigned_to_ot: null, assigned_to_person: null,
        notes: obs ? `${obs} — Devuelta el ${new Date().toLocaleDateString('es-CO')}` : tool.notes,
      }).eq('id', tool.id);

      if (tool.assigned_to_ot) {
        await supabase.from('work_order_tools').update({
          returned_at: new Date().toISOString(), delivery_act_signed: true,
        }).eq('tool_id', tool.id).eq('work_order_id', tool.assigned_to_ot);
      }

      await supabase.from('inventory_movements').insert({
        tenant_id: tenantId, movement_type: 'entrada', item_type: 'herramienta',
        item_id: tool.id, quantity: 1,
        reason: `Devuelta — Estado: ${returnStatus}`, registered_by: userId,
      });

      log('inventario', 'devolver_herramienta', 'inventory_tools', tool.id, tool.name);
      toast.success('Devolución registrada correctamente');
      qc.invalidateQueries({ queryKey: ['inventory-tools'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-barlow">Devolución — {tool.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="font-dm text-xs mb-2 block">Estado al devolver</Label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map(opt => (
                <button key={opt.value} onClick={() => setReturnStatus(opt.value)}
                  className={`p-3 rounded-lg border-2 text-xs font-dm text-left transition-all ${returnStatus === opt.value ? opt.bg : 'border-border bg-card'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-dm text-xs">Observaciones</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className="font-dm text-sm" />
          </div>
          <div>
            <Label className="font-dm text-xs">Firma de recepción *</Label>
            <SignatureCanvas onSignature={setSignature} height={120} />
          </div>
          <Button onClick={handleSubmit} disabled={saving || !signature}
            className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
            {saving ? 'Registrando...' : 'Confirmar devolución'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════
// TAB 3 — KITS DE EMERGENCIA
// ═══════════════════════════════════════════════════
function KitsTab({ kits, loading, search, setSearch, tenantId, userId, userName, log, qc }: any) {
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showNewKit, setShowNewKit] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showSend, setShowSend] = useState<any>(null);
  const [showReceive, setShowReceive] = useState<any>(null);

  const statusOptions = [
    { label: 'Todos', value: 'todos' }, { label: 'En bodega', value: 'en_bodega' },
    { label: 'En campo', value: 'en_campo' }, { label: 'Incompleto', value: 'incompleto' },
  ];

  const filtered = kits.filter((k: any) => {
    if (search && !k.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'todos' && k.status !== statusFilter) return false;
    return true;
  });

  const KIT_STATUS: Record<string, { bg: string; text: string; label: string }> = {
    en_bodega: { bg: 'bg-success-bg', text: 'text-success', label: '✓ En bodega' },
    en_campo: { bg: 'bg-blue-100', text: 'text-blue-700', label: '📍 En campo' },
    incompleto: { bg: 'bg-warning-bg', text: 'text-warning', label: '⚠️ Incompleto' },
  };

  return (
    <>
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar kit..." />
          <FilterPills options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
        </ActionBarLeft>
        <ActionBarRight>
          <Button size="sm" onClick={() => setShowNewKit(true)} className="gap-1 text-xs font-dm bg-gold hover:bg-gold-bright text-white">
            <Plus className="h-3.5 w-3.5" /> Nuevo kit
          </Button>
        </ActionBarRight>
      </ActionBar>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <BriefcaseMedical className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground font-dm">Sin kits de emergencia configurados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((k: any) => {
            const st = KIT_STATUS[k.status] || KIT_STATUS.en_bodega;
            const items = k.inventory_kit_items || [];
            const toolItems = items.filter((i: any) => i.item_type === 'herramienta').length;
            const consumableItems = items.filter((i: any) => i.item_type === 'consumible').length;

            return (
              <div key={k.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-barlow font-semibold text-[15px] text-foreground">🧰 {k.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                      {k.machines && (
                        <span className="text-[11px] text-muted-foreground font-dm">{k.machines.name} [{k.machines.internal_code}]</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-dm mb-1">
                    <span>{items.length} ítems</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gold rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground font-dm">
                  🔧 {toolItems} herramientas · ⛽ {consumableItems} consumibles
                </p>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1 h-8 text-[11px] font-dm" onClick={() => setShowDetail(k)}>
                    Ver kit
                  </Button>
                  {k.status === 'en_bodega' && (
                    <Button variant="ghost" size="sm" className="flex-1 h-8 text-[11px] font-dm text-blue-600" onClick={() => setShowSend(k)}>
                      Enviar a campo →
                    </Button>
                  )}
                  {k.status === 'en_campo' && (
                    <Button variant="ghost" size="sm" className="flex-1 h-8 text-[11px] font-dm text-green-600" onClick={() => setShowReceive(k)}>
                      Recibir de campo
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewKit && (
        <NewKitModal open={showNewKit} onClose={() => setShowNewKit(false)} tenantId={tenantId} log={log} qc={qc} />
      )}
      {showDetail && (
        <KitDetailModal open={!!showDetail} onClose={() => setShowDetail(null)} kit={showDetail} />
      )}
      {showSend && (
        <SendKitModal open={!!showSend} onClose={() => setShowSend(null)} kit={showSend} tenantId={tenantId} userId={userId} userName={userName} log={log} qc={qc} />
      )}
      {showReceive && (
        <ReceiveKitModal open={!!showReceive} onClose={() => setShowReceive(null)} kit={showReceive} tenantId={tenantId} userId={userId} log={log} qc={qc} />
      )}
    </>
  );
}

// ── New Kit Modal ──
function NewKitModal({ open, onClose, tenantId, log, qc }: any) {
  const [name, setName] = useState('');
  const [machineId, setMachineId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: machines = [] } = useQuery({
    queryKey: ['machines-select-kits'],
    queryFn: async () => {
      const { data } = await supabase.from('machines').select('id, name, internal_code');
      return data || [];
    },
  });

  const handleSubmit = async () => {
    if (!name) return;
    setSaving(true);
    try {
      const { data } = await supabase.from('inventory_kits').insert({
        tenant_id: tenantId, name, machine_id: machineId || null,
      }).select().single();
      log('inventario', 'crear_kit', 'inventory_kits', data?.id, name);
      toast.success('Kit creado. Agrega ítems desde "Ver kit".');
      qc.invalidateQueries({ queryKey: ['inventory-kits'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-barlow">Nuevo kit de emergencia</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="font-dm text-xs">Nombre del kit *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Kit Telehandler T6" className="font-dm text-sm" />
          </div>
          <div>
            <Label className="font-dm text-xs">Máquina asociada</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {machines.map((m: any) => <SelectItem key={m.id} value={m.id}>[{m.internal_code}] {m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} disabled={saving || !name} className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
            {saving ? 'Creando...' : 'Crear kit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Kit Detail Modal ──
function KitDetailModal({ open, onClose, kit }: any) {
  const [addingItem, setAddingItem] = useState(false);
  const [itemType, setItemType] = useState<'consumible' | 'herramienta'>('consumible');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [isReturnable, setIsReturnable] = useState(true);
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: kitItems = [], isLoading } = useQuery({
    queryKey: ['kit-items', kit.id],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_kit_items')
        .select('*, inventory_consumables(name, unit), inventory_tools(name, internal_code)')
        .eq('kit_id', kit.id);
      return data || [];
    },
  });

  const { data: consumablesList = [] } = useQuery({
    queryKey: ['consumables-for-kit'],
    queryFn: async () => { const { data } = await supabase.from('inventory_consumables').select('id, name, unit').eq('active', true); return data || []; },
    enabled: addingItem && itemType === 'consumible',
  });

  const { data: toolsList = [] } = useQuery({
    queryKey: ['tools-for-kit'],
    queryFn: async () => { const { data } = await supabase.from('inventory_tools').select('id, name, internal_code').eq('status', 'disponible'); return data || []; },
    enabled: addingItem && itemType === 'herramienta',
  });

  const { data: deliveryActs = [] } = useQuery({
    queryKey: ['kit-acts', kit.id],
    queryFn: async () => {
      const { data } = await supabase.from('delivery_acts').select('*, personnel(full_name)')
        .eq('kit_id', kit.id).order('delivered_at', { ascending: false }).limit(10);
      return data || [];
    },
  });

  const handleAddItem = async () => {
    if (!selectedItemId) return;
    try {
      await supabase.from('inventory_kit_items').insert({
        kit_id: kit.id, item_type: itemType,
        consumable_id: itemType === 'consumible' ? selectedItemId : null,
        tool_id: itemType === 'herramienta' ? selectedItemId : null,
        quantity: itemQty, is_returnable: isReturnable,
      });
      toast.success('Ítem agregado al kit');
      qc.invalidateQueries({ queryKey: ['kit-items', kit.id] });
      qc.invalidateQueries({ queryKey: ['inventory-kits'] });
      setAddingItem(false);
      setSelectedItemId('');
      setItemQty(1);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow flex items-center gap-2">
            🧰 {kit.name}
            {kit.machines && <span className="text-sm text-muted-foreground font-dm">· {kit.machines.name} [{kit.machines.internal_code}]</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-dm uppercase tracking-wider text-muted-foreground font-semibold">Ítems del kit ({kitItems.length})</p>
            <Button variant="ghost" size="sm" className="text-xs font-dm text-gold" onClick={() => setAddingItem(!addingItem)}>
              {addingItem ? 'Cancelar' : '+ Agregar ítem'}
            </Button>
          </div>

          {addingItem && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setItemType('consumible')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-dm border ${itemType === 'consumible' ? 'border-gold bg-gold/10 text-gold' : 'border-border'}`}>
                  ⛽ Consumible
                </button>
                <button onClick={() => setItemType('herramienta')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-dm border ${itemType === 'herramienta' ? 'border-gold bg-gold/10 text-gold' : 'border-border'}`}>
                  🔧 Herramienta
                </button>
              </div>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger className="font-dm text-sm"><SelectValue placeholder={`Selecciona ${itemType}`} /></SelectTrigger>
                <SelectContent>
                  {(itemType === 'consumible' ? consumablesList : toolsList).map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.internal_code ? `[${item.internal_code}] ` : ''}{item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="font-dm text-xs">Cantidad</Label>
                  <Input type="number" value={itemQty} onChange={e => setItemQty(Number(e.target.value))} min={1} className="font-dm text-sm" />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-dm cursor-pointer">
                    <input type="checkbox" checked={isReturnable} onChange={e => setIsReturnable(e.target.checked)} className="rounded" />
                    Retornable
                  </label>
                </div>
              </div>
              <Button size="sm" onClick={handleAddItem} disabled={!selectedItemId} className="bg-gold hover:bg-gold-bright text-white font-dm text-xs">
                Agregar al kit
              </Button>
            </div>
          )}

          {isLoading ? <Skeleton className="h-20 w-full" /> : kitItems.length === 0 ? (
            <p className="text-sm text-muted-foreground font-dm text-center py-6">Kit vacío. Agrega ítems.</p>
          ) : (
            <div className="space-y-1">
              {kitItems.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-sm">{item.item_type === 'consumible' ? '⛽' : '🔧'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-dm font-medium">
                      {item.item_type === 'consumible' ? item.inventory_consumables?.name : item.inventory_tools?.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-dm">
                      Qty: {item.quantity} · {item.is_returnable ? 'Retornable' : 'Consumible'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {deliveryActs.length > 0 && (
            <>
              <p className="text-xs font-dm uppercase tracking-wider text-muted-foreground font-semibold mt-4">Historial de envíos</p>
              {deliveryActs.map((act: any) => (
                <div key={act.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-sm">📦</span>
                  <div className="flex-1">
                    <p className="text-xs font-dm">{act.personnel?.full_name}</p>
                    <p className="text-[10px] text-muted-foreground font-dm">
                      {format(new Date(act.delivered_at), 'dd MMM yyyy HH:mm', { locale: es })}
                      {act.received_at && ` → Recibido ${format(new Date(act.received_at), 'dd MMM', { locale: es })}`}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Send Kit to Field Modal ──
function SendKitModal({ open, onClose, kit, tenantId, userId, userName, log, qc }: any) {
  const [operarioId, setOperarioId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sigSupervisor, setSigSupervisor] = useState<string | null>(null);
  const [sigOperario, setSigOperario] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios-select'],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('id, full_name').eq('type', 'operario').eq('status', 'activo');
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['active-projects-kit'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').eq('status', 'activo');
      return data || [];
    },
  });

  const { data: kitItems = [] } = useQuery({
    queryKey: ['kit-items-send', kit.id],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_kit_items')
        .select('*, inventory_consumables(name, unit), inventory_tools(name, internal_code, id)')
        .eq('kit_id', kit.id);
      return data || [];
    },
  });

  const operarioData = operarios.find((o: any) => o.id === operarioId);

  const handleSubmit = async () => {
    if (!operarioId || !projectId || !sigSupervisor || !sigOperario) return;
    setSaving(true);
    try {
      await supabase.from('inventory_kits').update({ status: 'en_campo' }).eq('id', kit.id);

      const itemsToSend = kitItems.map((i: any) => ({
        item_type: i.item_type,
        item_id: i.item_type === 'consumible' ? i.consumable_id : i.tool_id,
        name: i.item_type === 'consumible' ? i.inventory_consumables?.name : i.inventory_tools?.name,
        quantity: i.quantity,
        is_returnable: i.is_returnable,
      }));

      await supabase.from('delivery_acts').insert({
        tenant_id: tenantId, act_type: 'kit_campo', kit_id: kit.id,
        personnel_id: operarioId, items: itemsToSend,
        signature_delivery_url: sigSupervisor, signature_receipt_url: sigOperario,
      });

      // Mark tools as in_uso
      const toolItems = kitItems.filter((i: any) => i.item_type === 'herramienta' && i.tool_id);
      if (toolItems.length > 0) {
        const toolIds = toolItems.map((i: any) => i.tool_id);
        await supabase.from('inventory_tools').update({ status: 'en_uso', assigned_to_person: operarioId }).in('id', toolIds);
      }

      // Generate PDF
      try {
        const pdfBlob = await generateDeliveryActPDF({
          type: 'kit_campo',
          items: itemsToSend.map((i: any) => ({ name: i.name, quantity: i.quantity })),
          deliveredTo: operarioData?.full_name || '',
          deliveredBy: userName,
          projectName: projects.find((p: any) => p.id === projectId)?.name,
          signatureDelivery: sigSupervisor,
          signatureReceipt: sigOperario,
          date: new Date(),
        });
        downloadPDF(pdfBlob, `Acta-Kit-${kit.name}-${Date.now()}.pdf`);
      } catch { /* optional */ }

      log('inventario', 'enviar_kit', 'inventory_kits', kit.id, kit.name);
      toast.success('Kit enviado a campo y acta generada');
      qc.invalidateQueries({ queryKey: ['inventory-kits'] });
      qc.invalidateQueries({ queryKey: ['inventory-tools'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow">Envío a campo — {kit.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="font-dm text-xs">Operario receptor *</Label>
            <Select value={operarioId} onValueChange={setOperarioId}>
              <SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona operario" /></SelectTrigger>
              <SelectContent>
                {operarios.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-dm text-xs">Proyecto destino *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="font-dm text-sm"><SelectValue placeholder="Selecciona proyecto" /></SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-xs font-dm uppercase tracking-wider text-muted-foreground font-semibold mb-2">Ítems a enviar ({kitItems.length})</p>
            {kitItems.map((item: any) => (
              <div key={item.id} className="flex items-center gap-2 py-1.5 text-xs font-dm border-b border-border last:border-0">
                <span>{item.item_type === 'consumible' ? '⛽' : '🔧'}</span>
                <span className="flex-1">{item.item_type === 'consumible' ? item.inventory_consumables?.name : item.inventory_tools?.name}</span>
                <span className="text-muted-foreground">x{item.quantity}</span>
              </div>
            ))}
          </div>

          <div>
            <Label className="font-dm text-xs">Firma del operario que recibe *</Label>
            <SignatureCanvas onSignature={setSigOperario} height={120} />
          </div>
          <div>
            <Label className="font-dm text-xs">Firma del supervisor que entrega *</Label>
            <SignatureCanvas onSignature={setSigSupervisor} height={120} />
          </div>

          <Button onClick={handleSubmit} disabled={saving || !operarioId || !projectId || !sigSupervisor || !sigOperario}
            className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
            {saving ? 'Generando acta...' : 'Confirmar envío y generar acta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Receive Kit from Field Modal ──
function ReceiveKitModal({ open, onClose, kit, tenantId, userId, log, qc }: any) {
  const [signature, setSignature] = useState<string | null>(null);
  const [toolStatuses, setToolStatuses] = useState<Record<string, string>>({});
  const [consumableReturns, setConsumableReturns] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const { data: kitItems = [] } = useQuery({
    queryKey: ['kit-items-receive', kit.id],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_kit_items')
        .select('*, inventory_consumables(id, name, unit, stock_current), inventory_tools(id, name, internal_code)')
        .eq('kit_id', kit.id);
      return data || [];
    },
  });

  const { data: lastAct } = useQuery({
    queryKey: ['kit-last-act', kit.id],
    queryFn: async () => {
      const { data } = await supabase.from('delivery_acts')
        .select('id, delivered_at, personnel(full_name)')
        .eq('kit_id', kit.id).is('received_at', null)
        .order('delivered_at', { ascending: false }).limit(1).single();
      return data;
    },
  });

  const handleSubmit = async () => {
    if (!signature) return;
    setSaving(true);
    try {
      // Handle tool returns
      const toolItems = kitItems.filter((i: any) => i.item_type === 'herramienta' && i.tool_id);
      for (const item of toolItems) {
        const status = (toolStatuses[item.tool_id] || 'disponible') as 'disponible' | 'en_uso' | 'en_reparacion' | 'de_baja';
        await supabase.from('inventory_tools').update({
          status, assigned_to_person: null,
        }).eq('id', item.tool_id);
      }

      // Handle consumable returns
      const consumableItems = kitItems.filter((i: any) => i.item_type === 'consumible' && i.consumable_id);
      for (const item of consumableItems) {
        const returned = consumableReturns[item.consumable_id] ?? 0;
        if (returned > 0 && item.inventory_consumables) {
          const newStock = (item.inventory_consumables.stock_current ?? 0) + returned;
          await supabase.from('inventory_consumables').update({ stock_current: newStock }).eq('id', item.consumable_id);
        }
        const consumed = item.quantity - (returned || 0);
        if (consumed > 0) {
          await supabase.from('inventory_movements').insert({
            tenant_id: tenantId, movement_type: 'salida', item_type: 'consumible',
            item_id: item.consumable_id, quantity: consumed,
            reason: `Consumido en campo — Kit ${kit.name}`, registered_by: userId,
          });
        }
      }

      await supabase.from('inventory_kits').update({ status: 'en_bodega' }).eq('id', kit.id);

      if (lastAct) {
        await supabase.from('delivery_acts').update({
          received_at: new Date().toISOString(), signature_receipt_url: signature,
        }).eq('id', lastAct.id);
      }

      log('inventario', 'recibir_kit', 'inventory_kits', kit.id, kit.name);
      toast.success('Kit recibido y stocks actualizados');
      qc.invalidateQueries({ queryKey: ['inventory-kits'] });
      qc.invalidateQueries({ queryKey: ['inventory-tools'] });
      qc.invalidateQueries({ queryKey: ['inventory-consumables'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toolItemsList = kitItems.filter((i: any) => i.item_type === 'herramienta');
  const consumableItemsList = kitItems.filter((i: any) => i.item_type === 'consumible');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow">Recepción de campo — {kit.name}</DialogTitle>
        </DialogHeader>
        {lastAct && (
          <p className="text-xs text-muted-foreground font-dm">
            Enviado el {format(new Date(lastAct.delivered_at), 'dd MMM yyyy', { locale: es })} a {(lastAct as any).personnel?.full_name}
          </p>
        )}
        <div className="space-y-4">
          {toolItemsList.length > 0 && (
            <div>
              <p className="text-xs font-dm uppercase tracking-wider text-muted-foreground font-semibold mb-2">Herramientas</p>
              {toolItemsList.map((item: any) => (
                <div key={item.id} className="py-2 border-b border-border last:border-0">
                  <p className="text-sm font-dm font-medium mb-1">🔧 {item.inventory_tools?.name} [{item.inventory_tools?.internal_code}]</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { v: 'disponible', l: '✅ Buen estado' },
                      { v: 'en_reparacion', l: '🔧 Reparación' },
                      { v: 'de_baja', l: '✕ Perdida/baja' },
                    ].map(opt => (
                      <button key={opt.v} onClick={() => setToolStatuses(prev => ({ ...prev, [item.tool_id]: opt.v }))}
                        className={`px-2 py-1 rounded text-[10px] font-dm border ${(toolStatuses[item.tool_id] || 'disponible') === opt.v ? 'border-gold bg-gold/10' : 'border-border'}`}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {consumableItemsList.length > 0 && (
            <div>
              <p className="text-xs font-dm uppercase tracking-wider text-muted-foreground font-semibold mb-2">Consumibles</p>
              {consumableItemsList.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-dm">⛽ {item.inventory_consumables?.name}</p>
                    <p className="text-[10px] text-muted-foreground font-dm">Enviado: {item.quantity} {item.inventory_consumables?.unit}</p>
                  </div>
                  <div className="w-20">
                    <Input type="number" min={0} max={item.quantity}
                      value={consumableReturns[item.consumable_id] ?? 0}
                      onChange={e => setConsumableReturns(prev => ({ ...prev, [item.consumable_id]: Number(e.target.value) }))}
                      className="font-dm text-xs h-8"
                      placeholder="Regresa"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-dm w-16">
                    Usado: {item.quantity - (consumableReturns[item.consumable_id] ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label className="font-dm text-xs">Firma de quien devuelve *</Label>
            <SignatureCanvas onSignature={setSignature} height={120} />
          </div>

          <Button onClick={handleSubmit} disabled={saving || !signature}
            className="w-full bg-gold hover:bg-gold-bright text-white font-dm">
            {saving ? 'Procesando...' : 'Confirmar recepción'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
