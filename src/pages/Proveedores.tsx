import { useState, useMemo, useRef } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { deleteSuppliers } from '@/lib/cascade-delete';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { usePermissions } from '@/hooks/usePermissions';
import { ActionBar, ActionBarLeft, ActionBarRight } from '@/components/ui/action-bar';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { AdvancedFilters } from '@/components/ui/AdvancedFilters';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Star, RotateCcw, Upload, Download, FileText, AlertCircle, Check, X, Archive } from 'lucide-react';
import { downloadDocsAsZip } from '@/lib/download-docs-zip';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const supplierSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.string().min(1, 'Seleccione un tipo'),
  entity_type: z.enum(['empresa', 'persona']).default('empresa'),
  legal_representative: z.string().optional(),
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

const contactSchema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  is_primary: z.boolean().default(false),
});
type ContactForm = z.infer<typeof contactSchema>;

const SUPPLIER_DOC_TYPES = [
  { value: 'rut', label: 'RUT' },
  { value: 'camara_comercio', label: 'Cámara de Comercio' },
  { value: 'certificado_bancario', label: 'Certificado Bancario' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'otro', label: 'Otro' },
];

const SUPPLIER_DOC_BADGE: Record<string, string> = {
  rut: 'bg-[hsl(217_91%_93%)] text-[hsl(217_91%_40%)]',
  camara_comercio: 'bg-[hsl(142_76%_90%)] text-[hsl(142_76%_35%)]',
  certificado_bancario: 'bg-[hsl(45_100%_90%)] text-[hsl(37_91%_40%)]',
  contrato: 'bg-secondary text-muted-foreground',
  otro: 'bg-secondary text-muted-foreground',
};

const REQUIRED_DOCS = ['rut', 'camara_comercio', 'certificado_bancario'];

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
    defaultValues: { type: '', entity_type: 'empresa', country: 'Colombia', status: 'activo', rating: null },
  });

  const watchEntityType = form.watch('entity_type');

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', type: '', entity_type: 'empresa', country: 'Colombia', status: 'activo', rating: null, tax_id: '', contact_name: '', contact_phone: '', contact_email: '', city: '', specialty: '', notes: '', legal_representative: '' });
    setModalOpen(true);
  };

  const openEdit = (s: SupplierRow) => {
    setEditing(s);
    form.reset({ name: s.name, type: s.type || '', entity_type: 'empresa', tax_id: s.tax_id || '', contact_name: s.contact_name || '', contact_phone: s.contact_phone || '', contact_email: s.contact_email || '', city: s.city || '', country: s.country || 'Colombia', specialty: s.specialty || '', rating: s.rating, notes: s.notes || '', status: s.status || 'activo', legal_representative: '' });
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSuppliers([deleteTarget.id]);
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Proveedor eliminado');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error('Error al eliminar: ' + e.message);
    }
  };

  const reactivate = async (s: SupplierRow) => {
    await supabase.from('suppliers').update({ status: 'activo' }).eq('id', s.id);
    qc.invalidateQueries({ queryKey: ['suppliers'] });
    toast.success('Registro reactivado correctamente');
  };

  const canManage = role === 'superadmin' || role === 'gerente';

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => { await deleteSuppliers(ids); },
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
            customFilters={[{ key: 'rating', label: 'Rating mínimo', type: 'select', options: [{ value: 'all', label: 'Todos' }, { value: '3', label: '≥ 3 ⭐' }, { value: '4', label: '≥ 4 ⭐' }, { value: '5', label: '5 ⭐' }] }]}
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
          <span className="text-sm font-dm font-medium">{selectedRows.length} seleccionado{selectedRows.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedRows([])}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={() => setShowBulkDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar {selectedRows.length}
            </Button>
          </div>
        </div>
      )}

      <DataTable
        data={filtered} columns={columns} isLoading={isLoading}
        onRowClick={(s) => setDetail(s)}
        defaultSort={{ key: 'name', direction: 'asc' }}
        rowKey={(s) => s.id} emptyMessage="No hay proveedores registrados"
        selectable={true} onSelectionChange={setSelectedRows}
      />

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow text-lg">{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
            <DialogDescription className="font-dm text-sm text-muted-foreground">Completa la información del proveedor</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Nombre *</Label>
                <Input {...form.register('name')} className="h-10 rounded-lg font-dm" />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Tipo de servicio *</Label>
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
                <Label className="font-dm text-xs">Tipo de entidad</Label>
                <div className="flex gap-4 pt-2">
                  {(['empresa', 'persona'] as const).map(et => (
                    <label key={et} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="entity_type" value={et} checked={watchEntityType === et}
                        onChange={() => form.setValue('entity_type', et)} className="accent-[hsl(var(--primary))]" />
                      <span className="font-dm text-sm capitalize">{et}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">NIT</Label>
                <Input {...form.register('tax_id')} className="h-10 rounded-lg font-dm" />
              </div>
              {watchEntityType === 'empresa' && (
                <div className="space-y-1.5 col-span-2">
                  <Label className="font-dm text-xs">Representante legal</Label>
                  <Input {...form.register('legal_representative')} className="h-10 rounded-lg font-dm" />
                </div>
              )}
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

      {/* Delete Confirm */}
      {deleteTarget && (
        <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-barlow">¿Eliminar "{deleteTarget.name}"?</AlertDialogTitle>
              <AlertDialogDescription className="font-dm">Esta acción eliminará el proveedor y desvinculará sus referencias. No se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-dm">Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-dm" onClick={(e) => { e.preventDefault(); handleDelete(); }}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedRows.length} registro{selectedRows.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); bulkDeleteMutation.mutate(selectedRows.map(r => r.id)); }}>
              {bulkDeleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Supplier Detail Modal ───
function SupplierDetailModal({ supplier, onClose, onEdit, onDelete }: {
  supplier: SupplierRow | null; onClose: () => void; onEdit: (s: SupplierRow) => void; onDelete?: (s: SupplierRow) => void;
}) {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const qc = useQueryClient();

  // Contacts
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deleteContactTarget, setDeleteContactTarget] = useState<any>(null);
  const contactForm = useForm<ContactForm>({ resolver: zodResolver(contactSchema), defaultValues: { is_primary: false } });

  // Documents
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('otro');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ['supplier-contacts', supplier?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier_contacts').select('*').eq('supplier_id', supplier!.id).order('is_primary', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplier,
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: ['supplier-documents', supplier?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier_documents').select('*').eq('supplier_id', supplier!.id).order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplier,
  });

  const saveContact = async (values: ContactForm) => {
    if (!supplier || !tenantId) return;
    try {
      if (values.is_primary) {
        await supabase.from('supplier_contacts').update({ is_primary: false }).eq('supplier_id', supplier.id).eq('is_primary', true);
      }
      const row = { full_name: values.full_name, role: values.role || null, phone: values.phone || null, email: values.email || null, is_primary: values.is_primary };
      if (editingContact) {
        await supabase.from('supplier_contacts').update(row).eq('id', editingContact.id);
      } else {
        await supabase.from('supplier_contacts').insert([{ ...row, supplier_id: supplier.id, tenant_id: tenantId }]);
      }
      toast.success('Contacto guardado');
      refetchContacts();
      setContactModalOpen(false);
      setEditingContact(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteContactTarget) return;
    await supabase.from('supplier_contacts').delete().eq('id', deleteContactTarget.id);
    toast.success('Contacto eliminado');
    refetchContacts();
    setDeleteContactTarget(null);
  };

  const handleUploadDoc = async () => {
    if (!docFile || !docName || !supplier || !tenantId) return;
    setUploading(true);
    try {
      const path = `suppliers/${supplier.id}/${Date.now()}_${docFile.name}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, docFile);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
      await supabase.from('supplier_documents').insert([{
        supplier_id: supplier.id, name: docName, doc_type: docType,
        file_url: urlData.publicUrl, file_name: docFile.name, tenant_id: tenantId,
      }]);
      toast.success('Documento subido');
      refetchDocs();
      setDocModalOpen(false);
      setDocName(''); setDocType('otro'); setDocFile(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocTarget) return;
    if (deleteDocTarget.file_url) {
      const path = deleteDocTarget.file_url.split('/documents/')[1];
      if (path) await supabase.storage.from('documents').remove([path]);
    }
    await supabase.from('supplier_documents').delete().eq('id', deleteDocTarget.id);
    toast.success('Documento eliminado');
    refetchDocs();
    setDeleteDocTarget(null);
  };

  if (!supplier) return null;

  const totalOTCost = ots.reduce((s: number, o: any) => s + Number(o.total_cost || 0), 0);
  const activeOTs = ots.filter((o: any) => !['cerrada', 'firmada'].includes(o.status));
  const totalPaid = costEntries.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const existingDocTypes = documents.map((d: any) => d.doc_type);

  return (
    <>
      <Dialog open={!!supplier} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[720px] rounded-2xl max-h-[85vh] overflow-y-auto">
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
              <TabsTrigger value="contacts">👥 Contactos ({contacts.length})</TabsTrigger>
              <TabsTrigger value="documents">📎 Documentos ({documents.length})</TabsTrigger>
              <TabsTrigger value="ots">🔧 OT ({ots.length})</TabsTrigger>
              <TabsTrigger value="invoices">💰 Facturas</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
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

            {/* Contacts Tab */}
            <TabsContent value="contacts">
              <div className="space-y-3 py-2">
                <div className="flex justify-end">
                  <Button size="sm" className="gap-1.5" onClick={() => { setEditingContact(null); contactForm.reset({ full_name: '', role: '', phone: '', email: '', is_primary: false }); setContactModalOpen(true); }}>
                    <Plus className="h-4 w-4" /> Agregar contacto
                  </Button>
                </div>
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 font-dm">Sin contactos registrados</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow className="bg-secondary">
                      <TableHead className="text-[11px] uppercase font-dm">Nombre</TableHead>
                      <TableHead className="text-[11px] uppercase font-dm">Cargo</TableHead>
                      <TableHead className="text-[11px] uppercase font-dm">Teléfono</TableHead>
                      <TableHead className="text-[11px] uppercase font-dm">Email</TableHead>
                      <TableHead className="text-[11px] uppercase font-dm w-[80px]"></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {contacts.map((ct: any) => (
                        <TableRow key={ct.id} className="h-[44px]">
                          <TableCell className="font-dm text-sm font-medium">
                            {ct.full_name}
                            {ct.is_primary && <Badge variant="default" className="ml-2 text-[10px]">Principal</Badge>}
                          </TableCell>
                          <TableCell className="font-dm text-sm text-muted-foreground">{ct.role || '—'}</TableCell>
                          <TableCell className="font-dm text-sm">{ct.phone ? <a href={`tel:${ct.phone}`} className="text-primary hover:underline">{ct.phone}</a> : '—'}</TableCell>
                          <TableCell className="font-dm text-sm">{ct.email ? <a href={`mailto:${ct.email}`} className="text-primary hover:underline">{ct.email}</a> : '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                setEditingContact(ct);
                                contactForm.reset({ full_name: ct.full_name, role: ct.role || '', phone: ct.phone || '', email: ct.email || '', is_primary: ct.is_primary || false });
                                setContactModalOpen(true);
                              }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteContactTarget(ct)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents">
              <div className="space-y-3 py-2">
                {/* Required docs checklist */}
                <div className="rounded-lg border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)] p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                    <p className="text-xs font-dm text-muted-foreground">Para aprobar pagos se requieren: RUT, Cámara de Comercio y Certificado Bancario</p>
                  </div>
                  <div className="flex gap-4">
                    {REQUIRED_DOCS.map(docKey => {
                      const has = existingDocTypes.includes(docKey);
                      const label = SUPPLIER_DOC_TYPES.find(d => d.value === docKey)?.label || docKey;
                      return (
                        <div key={docKey} className="flex items-center gap-1.5">
                          {has ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <X className="h-4 w-4 text-destructive" />}
                          <span className={`text-xs font-dm ${has ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  {documents.length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadDocsAsZip(documents, `Proveedor_${supplier?.name || 'docs'}`)}>
                      <Archive className="h-4 w-4" /> Descargar todo (.zip)
                    </Button>
                  )}
                  <Button size="sm" className="gap-1.5" onClick={() => { setDocName(''); setDocType('otro'); setDocFile(null); setDocModalOpen(true); }}>
                    <Upload className="h-4 w-4" /> Subir documento
                  </Button>
                </div>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 font-dm">Sin documentos</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow className="bg-secondary">
                      <TableHead className="text-[11px] uppercase font-dm">Nombre</TableHead>
                      <TableHead className="text-[11px] uppercase font-dm">Tipo</TableHead>
                      <TableHead className="text-[11px] uppercase font-dm">Fecha</TableHead>
                      <TableHead className="text-[11px] uppercase font-dm w-[80px]"></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {documents.map((doc: any) => (
                        <TableRow key={doc.id} className="h-[44px]">
                          <TableCell className="font-dm text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" /> {doc.name}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm ${SUPPLIER_DOC_BADGE[doc.doc_type] || SUPPLIER_DOC_BADGE.otro}`}>
                              {SUPPLIER_DOC_TYPES.find(d => d.value === doc.doc_type)?.label || doc.doc_type}
                            </span>
                          </TableCell>
                          <TableCell className="font-dm text-sm text-muted-foreground">
                            {doc.uploaded_at ? format(new Date(doc.uploaded_at), 'dd MMM yyyy', { locale: es }) : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {doc.file_url && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a>
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDocTarget(doc)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ots">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {[['Total OT', ots.length], ['En curso', activeOTs.length], ['Costo total', `$${totalOTCost.toLocaleString()}`]].map(([l, v]) => (
                  <div key={l as string} className="bg-secondary rounded-lg p-2.5 text-center">
                    <p className="text-[11px] uppercase text-muted-foreground font-dm">{l as string}</p>
                    <p className="text-lg font-barlow font-semibold">{v as any}</p>
                  </div>
                ))}
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

      {/* Contact Modal */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow text-lg">{editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={contactForm.handleSubmit(saveContact)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-dm text-xs">Nombre *</Label>
              <Input {...contactForm.register('full_name')} className="h-10 rounded-lg font-dm" />
              {contactForm.formState.errors.full_name && <p className="text-xs text-destructive">{contactForm.formState.errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="font-dm text-xs">Cargo</Label>
              <Input {...contactForm.register('role')} placeholder="Ej: Gerente de Compras" className="h-10 rounded-lg font-dm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Teléfono</Label>
                <Input {...contactForm.register('phone')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Email</Label>
                <Input {...contactForm.register('email')} type="email" className="h-10 rounded-lg font-dm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={contactForm.watch('is_primary')} onCheckedChange={(v) => contactForm.setValue('is_primary', !!v)} />
              <Label className="font-dm text-xs cursor-pointer">Marcar como contacto principal</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setContactModalOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Document Upload Modal */}
      <Dialog open={docModalOpen} onOpenChange={setDocModalOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow text-lg">Subir Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-dm text-xs">Nombre del documento *</Label>
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} className="h-10 rounded-lg font-dm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-dm text-xs">Tipo</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPLIER_DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-dm text-xs">Archivo</Label>
              <Input type="file" ref={fileRef} onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="h-10 rounded-lg font-dm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleUploadDoc} disabled={uploading || !docFile || !docName}>{uploading ? 'Subiendo...' : 'Subir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Confirm */}
      <AlertDialog open={!!deleteContactTarget} onOpenChange={(v) => !v && setDeleteContactTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); handleDeleteContact(); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Doc Confirm */}
      <AlertDialog open={!!deleteDocTarget} onOpenChange={(v) => !v && setDeleteDocTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">Se eliminará el archivo del almacenamiento. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); handleDeleteDoc(); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
