import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { ActionBar, ActionBarLeft, ActionBarRight } from '@/components/ui/action-bar';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, XCircle, Star } from 'lucide-react';
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
        <Star
          key={i}
          className={`h-4 w-4 ${i <= value ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'text-border'} ${onChange ? 'cursor-pointer' : ''}`}
          onClick={() => onChange?.(i)}
        />
      ))}
    </div>
  );
}

export default function Proveedores() {
  usePageTitle('Proveedores');
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const { log } = useLog();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [detail, setDetail] = useState<SupplierRow | null>(null);

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

  const filtered = suppliers.filter((s) => {
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.specialty?.toLowerCase().includes(q)) || (s.city?.toLowerCase().includes(q));
    }
    return true;
  });

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
        name: values.name,
        type: values.type || null,
        tax_id: values.tax_id || null,
        contact_name: values.contact_name || null,
        contact_phone: values.contact_phone || null,
        contact_email: values.contact_email || null,
        city: values.city || null,
        country: values.country || 'Colombia',
        specialty: values.specialty || null,
        rating: values.rating ?? null,
        notes: values.notes || null,
        status: values.status || 'activo',
        tenant_id: tenantId!,
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

  return (
    <div>
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar proveedor..." />
          <FilterPills options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
        </ActionBarLeft>
        <ActionBarRight>
          <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo Proveedor</Button>
        </ActionBarRight>
      </ActionBar>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              {['Nombre', 'Tipo', 'Especialidad', 'Ciudad', 'Rating', 'Estado', 'Acciones'].map((h) => (
                <TableHead key={h} className="text-[11px] uppercase tracking-wider font-dm">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="h-[44px]">{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-dm">No hay proveedores registrados</TableCell></TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id} className="h-[44px] cursor-pointer hover:bg-[hsl(var(--gold)/0.04)]" onClick={() => setDetail(s)}>
                <TableCell className="font-medium font-dm text-sm">{s.name}</TableCell>
                <TableCell>
                  {s.type && <span className={`inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm ${TYPE_BADGE[s.type] || 'bg-secondary text-muted-foreground'}`}>
                    {s.type.replace(/_/g, ' ')}
                  </span>}
                </TableCell>
                <TableCell className="font-dm text-sm text-muted-foreground">{s.specialty || '—'}</TableCell>
                <TableCell className="font-dm text-sm text-muted-foreground">{s.city || '—'}</TableCell>
                <TableCell><StarRating value={s.rating || 0} /></TableCell>
                <TableCell><StatusBadge status={s.status || 'activo'} /></TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      if (confirm('¿Desactivar este proveedor?')) {
                        supabase.from('suppliers').update({ status: 'inactivo' }).eq('id', s.id).then(() => {
                          qc.invalidateQueries({ queryKey: ['suppliers'] });
                          toast.success('Proveedor desactivado');
                        });
                      }
                    }}><XCircle className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
      <SupplierDetailModal supplier={detail} onClose={() => setDetail(null)} onEdit={(s) => { setDetail(null); openEdit(s); }} />
    </div>
  );
}

function SupplierDetailModal({ supplier, onClose, onEdit }: { supplier: SupplierRow | null; onClose: () => void; onEdit: (s: SupplierRow) => void }) {
  const { data: ots = [] } = useQuery({
    queryKey: ['supplier-ots', supplier?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('work_orders').select('*, machines(name)').eq('supplier_id', supplier!.id).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!supplier,
  });

  if (!supplier) return null;

  return (
    <Dialog open={!!supplier} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-barlow text-lg flex items-center gap-2">
            {supplier.name}
            {supplier.type && <span className={`inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm ${TYPE_BADGE[supplier.type] || ''}`}>{supplier.type.replace(/_/g, ' ')}</span>}
          </DialogTitle>
          <DialogDescription className="font-dm text-sm text-muted-foreground flex items-center gap-2">
            {supplier.city || ''} <StarRating value={supplier.rating || 0} />
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="ots">
          <TabsList className="font-dm">
            <TabsTrigger value="ots">Historial OT</TabsTrigger>
            <TabsTrigger value="info">Información</TabsTrigger>
          </TabsList>
          <TabsContent value="ots">
            {ots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center font-dm">Sin órdenes de trabajo con este proveedor</p>
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
          <TabsContent value="info">
            <div className="grid grid-cols-2 gap-4 py-2">
              {[['Especialidad', supplier.specialty], ['NIT', supplier.tax_id], ['Contacto', supplier.contact_name], ['Teléfono', supplier.contact_phone], ['Email', supplier.contact_email], ['Ciudad', supplier.city]].map(([l, v]) => (
                <div key={l as string}><p className="text-[11px] uppercase text-muted-foreground font-dm">{l}</p><p className="text-sm font-dm">{v || '—'}</p></div>
              ))}
            </div>
            <Button variant="ghost" className="mt-2" onClick={() => onEdit(supplier)}>Editar</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
