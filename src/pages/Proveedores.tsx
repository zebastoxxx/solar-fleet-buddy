import { useState, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { usePermissions } from '@/hooks/usePermissions';
import { ActionBar, ActionBarLeft, ActionBarRight } from '@/components/ui/action-bar';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { AdvancedFilters } from '@/components/ui/AdvancedFilters';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SafeDeleteDialog } from '@/components/ui/SafeDeleteDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { checkDeleteSupplier } from '@/lib/delete-guards';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Star, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const supplierSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.string().min(1, 'Seleccione un tipo'),
  tax_id: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
  city: z.string().optional(),
  country: z.string().default('Colombia'),
  specialty: z.string().optional(),
  rating: z.number().min(1).max(5).optional().nullable(),
  notes: z.string().optional(),
  status: z.string().default('activo'),
});

type SupplierForm = z.infer<typeof supplierSchema>;
type SupplierRow = {
  id: string; name: string; tax_id: string | null; type: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  city: string | null; country: string | null; specialty: string | null;
  rating: number | null; status: string | null; notes: string | null;
  created_at: string | null; tenant_id: string;
};

const TYPE_FILTERS = [
  { label: 'Todos', value: 'all' },
  { label: 'Taller', value: 'taller_servicio' },
  { label: 'Repuestos', value: 'repuestos' },
  { label: 'Consumibles', value: 'consumibles' },
];

const TYPE_BADGE: Record<string, string> = {
  taller_servicio: 'bg-[hsl(262_83%_95%)] text-[hsl(262_83%_45%)]',
  repuestos: 'bg-[hsl(217_91%_93%)] text-[hsl(217_91%_40%)]',
  consumibles: 'bg-[hsl(45_100%_90%)] text-[hsl(37_91%_40%)]',
  multiples: 'bg-secondary text-muted-foreground',
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= value ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'text-border'} ${onChange ? 'cursor-pointer' : ''}`} onClick={() => onChange?.(i)} />
      ))}
    </div>
  );
}

export default function Proveedores() {
  usePageTitle('Proveedores');
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const { role } = usePermissions();
  const { log } = useLog();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [detail, setDetail] = useState<SupplierRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [ratingFilter, setRatingFilter] = useState('all');
  const [selectedRows, setSelectedRows] = useState<SupplierRow[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      return data as SupplierRow[];
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      if (!showInactive && s.status === 'inactivo') return false;
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (ratingFilter !== 'all' && (s.rating || 0) < Number(ratingFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.specialty?.toLowerCase().includes(q)) || (s.city?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [suppliers, typeFilter, ratingFilter, search, showInactive]);

  const form = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { type: '', country: 'Colombia', status: 'activo', rating: null },
  });

  const openCreate = () => { setEditing(null); form.reset({ name: '', type: '', country: 'Colombia', status: 'activo', rating: null, tax_id: '', contact_name: '', contact_phone: '', contact_email: '', city: '', specialty: '', notes: '' }); setModalOpen(true); };

  const openEdit = (s: SupplierRow) => {
    setEditing(s);
    form.reset({ name: s.name, type: s.type || '', tax_id: s.tax_id || '', contact_name: s.contact_name || '', contact_phone: s.contact_phone || '', contact_email: s.contact_email || '', city: s.city || '', country: s.country || 'Colombia', specialty: s.specialty || '', rating: s.rating, notes: s.notes || '', status: s.status || 'activo' });
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: async (values: SupplierForm) => {
      const row = {
        name: values.name, type: values.type || null, tax_id: values.tax_id || null,
        contact_name: values.contact_name || null, contact_phone: values.contact_phone || null,
        contact_email: values.contact_email || null, city: values.city || null,
        country: values.country || 'Colombia', specialty: values.specialty || null,
        rating: values.rating ?? null, notes: values.notes || null,
        status: values.status || 'activo', tenant_id: tenantId!,
      };
      if (editing) {
        const { error } = await supabase.from('suppliers').update(row).eq('id', editing.id);
        if (error) throw error;
        await log('proveedores', 'editar_proveedor', 'supplier', editing.id, values.name);
      } else {
        const { error } = await supabase.from('suppliers').insert([row]);
        if (error) throw error;
        await log('proveedores', 'crear_proveedor', 'supplier', undefined, values.name);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Proveedor guardado'); setModalOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = async (hardDelete: boolean) => {
    if (!deleteTarget) return;
    if (hardDelete) {
      await supabase.from('suppliers').delete().eq('id', deleteTarget.id);
    } else {
      await supabase.from('suppliers').update({ status: 'inactivo' }).eq('id', deleteTarget.id);
    }
    qc.invalidateQueries({ queryKey: ['suppliers'] });
    toast.success(hardDelete ? 'Proveedor eliminado' : 'Proveedor desactivado');
  };

  const reactivate = async (s: SupplierRow) => {
    await supabase.from('suppliers').update({ status: 'activo' }).eq('id', s.id);
    qc.invalidateQueries({ queryKey: ['suppliers'] });
    toast.success('Registro reactivado correctamente');
  };

  const canManage = role === 'superadmin' || role === 'gerente';

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('suppliers').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', tenantId] });
      toast.success(`${selectedRows.length} registro(s) eliminado(s)`);
      setSelectedRows([]);
      setShowBulkDeleteConfirm(false);
    },
    onError: () => toast.error('Error al eliminar los registros seleccionados'),
  });

  const columns: Column<SupplierRow>[] = [
    { key: 'name', label: 'Nombre', sortable: true, render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'type', label: 'Tipo', sortable: true, render: (s) => s.type ? <span className={`inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm ${TYPE_BADGE[s.type] || 'bg-secondary text-muted-foreground'}`}>{s.type.replace(/_/g, ' ')}</span> : <span className="text-muted-foreground">—</span> },
    { key: 'specialty', label: 'Especialidad', sortable: true, render: (s) => <span className="text-muted-foreground">{s.specialty || '—'}</span> },
    { key: 'city', label: 'Ciudad', sortable: true, render: (s) => <span className="text-muted-foreground">{s.city || '—'}</span> },
    { key: 'rating', label: 'Rating', sortable: true, render: (s) => <StarRating value={s.rating || 0} /> },
    { key: 'status', label: 'Estado', render: (s) => <StatusBadge status={s.status || 'activo'} /> },
    {
      key: 'actions', label: 'Acciones', render: (s) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
          {canManage && s.status === 'inactivo' && <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => reactivate(s)}><RotateCcw className="h-3.5 w-3.5" /></Button>}
          {canManage && s.status !== 'inactivo' && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar proveedor..." />
          <FilterPills options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
          <AdvancedFilters
            customFilters={[
              { key: 'rating', label: 'Rating mínimo', type: 'select', options: [{ value: 'all', label: 'Todos' }, { value: '3', label: '≥ 3 ⭐' }, { value: '4', label: '≥ 4 ⭐' }, { value: '5', label: '5 ⭐' }] },
            ]}
            filterValues={{ rating: ratingFilter }}
            onFilterChange={(k, v) => { if (k === 'rating') setRatingFilter(v); }}
            onClear={() => setRatingFilter('all')}
            resultCount={filtered.length}
          />
        </ActionBarLeft>
        <ActionBarRight>
          {canManage && (
            <Button variant="outline" size="sm" className="text-xs font-dm" onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? 'Ocultar inactivos' : 'Ver inactivos'}
            </Button>
          )}
          <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo Proveedor</Button>
        </ActionBarRight>
      </ActionBar>

      {selectedRows.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-dm font-medium">
            {selectedRows.length} seleccionado{selectedRows.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedRows([])}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={() => setShowBulkDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar {selectedRows.length}
            </Button>
          </div>
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(s) => setDetail(s)}
        defaultSort={{ key: 'name', direction: 'asc' }}
        rowKey={(s) => s.id}
        emptyMessage="No hay proveedores registrados"
        selectable={true}
        onSelectionChange={setSelectedRows}
      />

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow text-lg">{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
            <DialogDescription className="font-dm text-sm text-muted-foreground">Completa la información del proveedor</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Nombre *</Label>
                <Input {...form.register('name')} className="h-10 rounded-lg font-dm" />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Tipo *</Label>
                <Select value={form.watch('type')} onValueChange={(v) => form.setValue('type', v)}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="taller_servicio">Taller de servicio</SelectItem>
                    <SelectItem value="repuestos">Repuestos</SelectItem>
                    <SelectItem value="consumibles">Consumibles</SelectItem>
                    <SelectItem value="multiples">Múltiples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">NIT</Label>
                <Input {...form.register('tax_id')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Especialidad</Label>
                <Input {...form.register('specialty')} placeholder="Ej: Telehandlers JCB" className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Contacto</Label>
                <Input {...form.register('contact_name')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Teléfono</Label>
                <Input {...form.register('contact_phone')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Email</Label>
                <Input {...form.register('contact_email')} type="email" className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Ciudad</Label>
                <Input {...form.register('city')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Rating</Label>
                <StarRating value={form.watch('rating') || 0} onChange={(v) => form.setValue('rating', v)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-dm text-xs">Notas</Label>
              <Textarea {...form.register('notes')} rows={3} className="rounded-lg font-dm" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <SupplierDetailModal
        supplier={detail}
        onClose={() => setDetail(null)}
        onEdit={(s) => { setDetail(null); openEdit(s); }}
        onDelete={canManage ? (s) => { setDetail(null); setDeleteTarget(s); } : undefined}
      />

      {/* Safe Delete */}
      {deleteTarget && (
        <SafeDeleteDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          entityName={deleteTarget.name}
          checkFn={() => checkDeleteSupplier(deleteTarget.id)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function SupplierDetailModal({ supplier, onClose, onEdit, onDelete }: {
  supplier: SupplierRow | null; onClose: () => void; onEdit: (s: SupplierRow) => void; onDelete?: (s: SupplierRow) => void;
}) {
  const { data: ots = [] } = useQuery({
    queryKey: ['supplier-ots', supplier?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('work_orders').select('*, machines(name)').eq('supplier_id', supplier!.id).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!supplier,
  });

  const { data: costEntries = [] } = useQuery({
    queryKey: ['supplier-costs', supplier?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('cost_entries').select('*').eq('supplier_id', supplier!.id).order('cost_date', { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!supplier,
  });

  if (!supplier) return null;

  const totalOTCost = ots.reduce((s: number, o: any) => s + Number(o.total_cost || 0), 0);
  const activeOTs = ots.filter((o: any) => !['cerrada', 'firmada'].includes(o.status));
  const totalPaid = costEntries.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  return (
    <Dialog open={!!supplier} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow text-lg flex items-center gap-2">
            {supplier.name}
            {supplier.type && <span className={`inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm ${TYPE_BADGE[supplier.type] || ''}`}>{supplier.type.replace(/_/g, ' ')}</span>}
          </DialogTitle>
          <div className="font-dm text-sm text-muted-foreground flex items-center gap-2">
            {supplier.city || ''}{supplier.specialty ? ` · ${supplier.specialty}` : ''} <StarRating value={supplier.rating || 0} />
          </div>
        </DialogHeader>
        <Tabs defaultValue="info">
          <TabsList className="font-dm">
            <TabsTrigger value="info">📋 Información</TabsTrigger>
            <TabsTrigger value="ots">🔧 OT ({ots.length})</TabsTrigger>
            <TabsTrigger value="invoices">💰 Facturas</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <div className="grid grid-cols-2 gap-4 py-2">
              {[
                ['Especialidad', supplier.specialty],
                ['NIT', supplier.tax_id],
                ['Contacto', supplier.contact_name],
                ['Teléfono', supplier.contact_phone ? <a href={`tel:${supplier.contact_phone}`} className="text-primary hover:underline">{supplier.contact_phone}</a> : null],
                ['Email', supplier.contact_email ? <a href={`mailto:${supplier.contact_email}`} className="text-primary hover:underline">{supplier.contact_email}</a> : null],
                ['Ciudad', supplier.city],
              ].map(([l, v]) => (
                <div key={l as string}><p className="text-[11px] uppercase text-muted-foreground font-dm">{l as string}</p><p className="text-sm font-dm">{v || '—'}</p></div>
              ))}
              {supplier.notes && <div className="col-span-2"><p className="text-[11px] uppercase text-muted-foreground font-dm">Notas</p><p className="text-sm font-dm whitespace-pre-wrap">{supplier.notes}</p></div>}
            </div>
          </TabsContent>

          <TabsContent value="ots">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-secondary rounded-lg p-2.5 text-center">
                <p className="text-[11px] uppercase text-muted-foreground font-dm">Total OT</p>
                <p className="text-lg font-barlow font-semibold">{ots.length}</p>
              </div>
              <div className="bg-secondary rounded-lg p-2.5 text-center">
                <p className="text-[11px] uppercase text-muted-foreground font-dm">En curso</p>
                <p className="text-lg font-barlow font-semibold">{activeOTs.length}</p>
              </div>
              <div className="bg-secondary rounded-lg p-2.5 text-center">
                <p className="text-[11px] uppercase text-muted-foreground font-dm">Costo total</p>
                <p className="text-lg font-barlow font-semibold">${totalOTCost.toLocaleString()}</p>
              </div>
            </div>
            {ots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center font-dm">Sin órdenes de trabajo</p>
            ) : (
              <Table>
                <TableHeader><TableRow className="bg-secondary">
                  {['Código', 'Máquina', 'Tipo', 'Costo', 'Estado'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>
                  {ots.map((ot: any) => (
                    <TableRow key={ot.id} className="h-[44px]">
                      <TableCell className="font-dm text-sm font-medium text-[hsl(var(--gold))]">{ot.code}</TableCell>
                      <TableCell className="font-dm text-sm">{ot.machines?.name || '—'}</TableCell>
                      <TableCell><StatusBadge status={ot.type} /></TableCell>
                      <TableCell className="font-dm text-sm">${Number(ot.total_cost || 0).toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={ot.status || 'creada'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="invoices">
            <div className="bg-secondary rounded-lg p-3 mb-3 text-center">
              <p className="text-[11px] uppercase text-muted-foreground font-dm">Total pagado</p>
              <p className="text-xl font-barlow font-semibold">${totalPaid.toLocaleString()}</p>
            </div>
            {costEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center font-dm">Sin movimientos financieros</p>
            ) : (
              <Table>
                <TableHeader><TableRow className="bg-secondary">
                  {['Fecha', 'Factura #', 'Descripción', 'Monto'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>
                  {costEntries.map((e: any) => (
                    <TableRow key={e.id} className="h-[44px]">
                      <TableCell className="font-dm text-sm text-muted-foreground">{format(new Date(e.cost_date), 'dd MMM yyyy', { locale: es })}</TableCell>
                      <TableCell className="font-dm text-sm">{e.invoice_number || '—'}</TableCell>
                      <TableCell className="font-dm text-sm">{e.description || '—'}</TableCell>
                      <TableCell className="font-dm text-sm font-medium">${Number(e.amount).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" className="gap-1.5 font-dm" onClick={() => onEdit(supplier)}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          {onDelete && supplier.status !== 'inactivo' && (
            <Button variant="ghost" size="sm" className="gap-1.5 font-dm text-destructive" onClick={() => onDelete(supplier)}>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
