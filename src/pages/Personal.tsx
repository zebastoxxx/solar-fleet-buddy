import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { deletePersonnel } from '@/lib/cascade-delete';
import { ActionBar, ActionBarLeft, ActionBarRight } from '@/components/ui/action-bar';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const personSchema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.enum(['tecnico', 'operario']),
  id_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  specialty: z.string().optional(),
  contract_type: z.enum(['empresa', 'proyecto', 'jornada']).default('empresa'),
  monthly_salary: z.coerce.number().min(0).optional(),
  hourly_rate: z.coerce.number().min(0).optional(),
  status: z.string().default('activo'),
  notes: z.string().optional(),
});

type PersonForm = z.infer<typeof personSchema>;
type PersonRow = {
  id: string; full_name: string; type: string; id_number: string | null;
  phone: string | null; email: string | null; specialty: string | null;
  hourly_rate: number | null; monthly_salary: number | null; contract_type: string | null;
  status: string | null; notes: string | null;
  tenant_id: string; created_at: string | null;
};

const TYPE_FILTERS = [
  { label: 'Todos', value: 'all' },
  { label: 'Técnicos', value: 'tecnico' },
  { label: 'Operarios', value: 'operario' },
];

const SPECIALTY_BADGE: Record<string, string> = {
  mecanico_hidraulico: 'bg-[hsl(217_91%_93%)] text-[hsl(217_91%_40%)]',
  mecanico_electrico: 'bg-[hsl(50_93%_94%)] text-[hsl(40_84%_29%)]',
  mecanico_general: 'bg-secondary text-muted-foreground',
  multifuncion: 'bg-[hsl(262_83%_95%)] text-[hsl(262_83%_45%)]',
};

const SPECIALTY_LABEL: Record<string, string> = {
  mecanico_hidraulico: 'Hidráulico',
  mecanico_electrico: 'Eléctrico',
  mecanico_general: 'General',
  multifuncion: 'Multifunción',
};

const CONTRACT_LABEL: Record<string, string> = {
  empresa: 'Empresa',
  proyecto: 'Por proyecto',
  jornada: 'Por jornada',
};

function formatSalary(person: PersonRow) {
  const ct = person.contract_type || 'empresa';
  if (ct === 'empresa') {
    return `$${Number(person.monthly_salary || 0).toLocaleString()}/mes`;
  }
  return `$${Number(person.hourly_rate || 0).toLocaleString()}/h`;
}

export default function Personal() {
  usePageTitle('Personal');
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const { log } = useLog();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PersonRow | null>(null);
  const [detail, setDetail] = useState<PersonRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<PersonRow | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['personnel', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').order('type').order('full_name');
      if (error) throw error;
      return data as PersonRow[];
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  const filtered = personnel.filter((p) => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) || (p.email?.toLowerCase().includes(q)) || (p.id_number?.toLowerCase().includes(q));
    }
    return true;
  });

  const tecnicos = filtered.filter((p) => p.type === 'tecnico');
  const operarios = filtered.filter((p) => p.type === 'operario');

  const form = useForm<PersonForm>({
    resolver: zodResolver(personSchema),
    defaultValues: { type: 'tecnico', status: 'activo', contract_type: 'empresa' },
  });
  const watchType = form.watch('type');
  const watchContract = form.watch('contract_type');

  const openCreate = () => {
    setEditing(null);
    form.reset({ full_name: '', type: 'tecnico', status: 'activo', id_number: '', phone: '', email: '', specialty: '', contract_type: 'empresa', monthly_salary: 0, hourly_rate: 0, notes: '' });
    setModalOpen(true);
  };
  const openEdit = (p: PersonRow) => {
    setEditing(p);
    form.reset({
      full_name: p.full_name,
      type: p.type as 'tecnico' | 'operario',
      id_number: p.id_number || '',
      phone: p.phone || '',
      email: p.email || '',
      specialty: p.specialty || '',
      contract_type: (p.contract_type as 'empresa' | 'proyecto' | 'jornada') || 'empresa',
      monthly_salary: p.monthly_salary || 0,
      hourly_rate: p.hourly_rate || 0,
      status: p.status || 'activo',
      notes: p.notes || '',
    });
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: async (values: PersonForm) => {
      const row: any = {
        full_name: values.full_name,
        type: values.type,
        id_number: values.id_number || null,
        phone: values.phone || null,
        email: values.email || null,
        specialty: values.type === 'tecnico' ? (values.specialty || null) : null,
        contract_type: values.contract_type || 'empresa',
        monthly_salary: values.contract_type === 'empresa' ? (values.monthly_salary || 0) : 0,
        hourly_rate: values.contract_type !== 'empresa' ? (values.hourly_rate || 0) : 0,
        status: values.status || 'activo',
        notes: values.notes || null,
        tenant_id: tenantId!,
      };
      if (editing) {
        const { error } = await supabase.from('personnel').update(row).eq('id', editing.id);
        if (error) throw error;
        await log('personal', 'editar_persona', 'personnel', editing.id, values.full_name);
      } else {
        const { error } = await supabase.from('personnel').insert([row]);
        if (error) throw error;
        await log('personal', 'crear_persona', 'personnel', undefined, values.full_name);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['personnel'] }); toast.success('Persona guardada'); setModalOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => { await deletePersonnel(ids); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('Eliminado correctamente');
      setDeleteTarget(null);
      setShowBulkDelete(false);
      setSelectedIds(new Set());
    },
    onError: (e: Error) => { toast.error('Error al eliminar'); console.error(e); },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (people: PersonRow[]) => {
    const allSelected = people.every(p => selectedIds.has(p.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      people.forEach(p => { if (allSelected) next.delete(p.id); else next.add(p.id); });
      return next;
    });
  };

  const renderTable = (people: PersonRow[], isTecnico: boolean) => (
    <div className="overflow-x-auto">
    <Table className="min-w-[640px]">
      <TableHeader>
        <TableRow className="bg-secondary">
          <TableHead className="w-10">
            <Checkbox
              checked={people.length > 0 && people.every(p => selectedIds.has(p.id))}
              onCheckedChange={() => toggleAll(people)}
            />
          </TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-dm">Nombre</TableHead>
          {isTecnico && <TableHead className="text-[11px] uppercase tracking-wider font-dm hidden sm:table-cell">Especialidad</TableHead>}
          <TableHead className="text-[11px] uppercase tracking-wider font-dm hidden md:table-cell">Contratación</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-dm">Salario</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-dm">Estado</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-dm">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.length === 0 && (
          <TableRow><TableCell colSpan={isTecnico ? 7 : 6} className="text-center py-8 text-muted-foreground font-dm">Sin registros</TableCell></TableRow>
        )}
        {people.map((p) => (
          <TableRow
            key={p.id}
            className={`h-[44px] cursor-pointer hover:bg-[hsl(var(--gold)/0.04)] ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}
            onClick={() => setDetail(p)}
          >
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
            </TableCell>
            <TableCell className="font-medium font-dm text-sm">{p.full_name}</TableCell>
            {isTecnico && (
              <TableCell className="hidden sm:table-cell">
                {p.specialty && <span className={`inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm ${SPECIALTY_BADGE[p.specialty] || 'bg-secondary text-muted-foreground'}`}>{SPECIALTY_LABEL[p.specialty] || p.specialty}</span>}
              </TableCell>
            )}
            <TableCell className="hidden md:table-cell">
              <span className="inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm bg-secondary text-muted-foreground">
                {CONTRACT_LABEL[p.contract_type || 'empresa'] || p.contract_type}
              </span>
            </TableCell>
            <TableCell className="font-dm text-sm">{formatSalary(p)}</TableCell>
            <TableCell><StatusBadge status={p.status || 'activo'} /></TableCell>
            <TableCell>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );

  return (
    <div>
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar persona..." />
          <FilterPills options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
        </ActionBarLeft>
        <ActionBarRight>
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={() => setShowBulkDelete(true)} className="gap-1.5">
              <Trash2 className="h-4 w-4" /> Eliminar ({selectedIds.size})
            </Button>
          )}
          <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Agregar Persona</Button>
        </ActionBarRight>
      </ActionBar>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[44px] w-full" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {(typeFilter === 'all' || typeFilter === 'tecnico') && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-dm mb-2">Técnicos ({tecnicos.length})</p>
              <div className="rounded-xl border border-border bg-card">{renderTable(tecnicos, true)}</div>
            </div>
          )}
          {(typeFilter === 'all' || typeFilter === 'operario') && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-dm mb-2">Operarios ({operarios.length})</p>
              <div className="rounded-xl border border-border bg-card">{renderTable(operarios, false)}</div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow text-lg">{editing ? 'Editar Persona' : 'Agregar Persona'}</DialogTitle>
            <DialogDescription className="font-dm text-sm text-muted-foreground">Completa la información</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Nombre completo *</Label>
                <Input {...form.register('full_name')} className="h-10 rounded-lg font-dm" />
                {form.formState.errors.full_name && <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Tipo *</Label>
                <Select value={watchType} onValueChange={(v) => form.setValue('type', v as 'tecnico' | 'operario')}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tecnico">Técnico</SelectItem>
                    <SelectItem value="operario">Operario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Cédula</Label>
                <Input {...form.register('id_number')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Teléfono</Label>
                <Input {...form.register('phone')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Email</Label>
                <Input {...form.register('email')} type="email" className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Estado</Label>
                <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v)}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="en_proyecto">En proyecto</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                    <SelectItem value="de_baja">De baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {watchType === 'tecnico' && (
                <div className="space-y-1.5">
                  <Label className="font-dm text-xs">Especialidad</Label>
                  <Select value={form.watch('specialty') || ''} onValueChange={(v) => form.setValue('specialty', v)}>
                    <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mecanico_hidraulico">Mecánico hidráulico</SelectItem>
                      <SelectItem value="mecanico_electrico">Mecánico eléctrico</SelectItem>
                      <SelectItem value="mecanico_general">Mecánico general</SelectItem>
                      <SelectItem value="multifuncion">Multifunción</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Tipo de contratación</Label>
                <Select value={watchContract} onValueChange={(v) => form.setValue('contract_type', v as 'empresa' | 'proyecto' | 'jornada')}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa">Contrato empresa (salario mensual)</SelectItem>
                    <SelectItem value="proyecto">Por proyecto (tarifa/hora)</SelectItem>
                    <SelectItem value="jornada">Por jornada (tarifa/hora)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {watchContract === 'empresa' ? (
                <div className="space-y-1.5">
                  <Label className="font-dm text-xs">Salario mensual (COP)</Label>
                  <Input {...form.register('monthly_salary')} type="number" placeholder="2500000" className="h-10 rounded-lg font-dm" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="font-dm text-xs">Tarifa / hora (COP)</Label>
                  <Input {...form.register('hourly_rate')} type="number" placeholder="45000" className="h-10 rounded-lg font-dm" />
                </div>
              )}
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

      {/* Single Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">¿Eliminar "{deleteTarget?.full_name}"?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">
              Se eliminarán todas las asignaciones a OTs, proyectos y registros asociados. Esta acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-dm" disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-dm"
              disabled={deleteMutation.isPending}
              onClick={(e) => { e.preventDefault(); if (deleteTarget) deleteMutation.mutate([deleteTarget.id]); }}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">¿Eliminar {selectedIds.size} persona(s)?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">
              Se eliminarán todas las asignaciones a OTs, proyectos y registros asociados. Esta acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-dm" disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-dm"
              disabled={deleteMutation.isPending}
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(Array.from(selectedIds)); }}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Modal */}
      <PersonDetailModal person={detail} onClose={() => setDetail(null)} onEdit={(p) => { setDetail(null); openEdit(p); }} />
    </div>
  );
}

function PersonDetailModal({ person, onClose, onEdit }: { person: PersonRow | null; onClose: () => void; onEdit: (p: PersonRow) => void }) {
  const isTecnico = person?.type === 'tecnico';

  const { data: ots = [] } = useQuery({
    queryKey: ['person-ots', person?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_technicians')
        .select('work_order_id, work_orders(id, code, type, status, actual_hours, total_cost, created_at, machines(name))')
        .eq('personnel_id', person!.id)
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!person && isTecnico,
  });

  const { data: preops = [] } = useQuery({
    queryKey: ['person-preops', person?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preop_records')
        .select('*, machines(name), projects(name)')
        .eq('operator_id', person!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!person && !isTecnico,
  });

  if (!person) return null;

  const ct = person.contract_type || 'empresa';

  return (
    <Dialog open={!!person} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-barlow text-lg flex items-center gap-2">
            {person.full_name}
            <StatusBadge status={person.status || 'activo'} />
            {isTecnico && person.specialty && (
              <span className={`inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold font-dm ${SPECIALTY_BADGE[person.specialty] || 'bg-secondary text-muted-foreground'}`}>{SPECIALTY_LABEL[person.specialty] || person.specialty}</span>
            )}
          </DialogTitle>
          <DialogDescription className="font-dm text-sm text-muted-foreground">
            {isTecnico ? 'Técnico' : 'Operario'} · {CONTRACT_LABEL[ct]} · {formatSalary(person)}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="info">
          <TabsList className="font-dm">
            <TabsTrigger value="info">Información</TabsTrigger>
            {isTecnico && <TabsTrigger value="ots">Órdenes de Trabajo</TabsTrigger>}
            {!isTecnico && <TabsTrigger value="preops">Preoperacionales</TabsTrigger>}
          </TabsList>
          <TabsContent value="info">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              {[
                ['Cédula', person.id_number],
                ['Teléfono', person.phone],
                ['Email', person.email],
                ['Estado', person.status],
                ['Contratación', CONTRACT_LABEL[ct]],
                ['Remuneración', formatSalary(person)],
              ].map(([l, v]) => (
                <div key={l as string}><p className="text-[11px] uppercase text-muted-foreground font-dm">{l}</p><p className="text-sm font-dm">{v || '—'}</p></div>
              ))}
              {person.notes && <div className="col-span-2"><p className="text-[11px] uppercase text-muted-foreground font-dm">Notas</p><p className="text-sm font-dm">{person.notes}</p></div>}
            </div>
            <Button variant="ghost" className="mt-2" onClick={() => onEdit(person)}>Editar</Button>
          </TabsContent>
          {isTecnico && (
            <TabsContent value="ots">
              {ots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center font-dm">Sin órdenes de trabajo</p>
              ) : (
                <Table>
                  <TableHeader><TableRow className="bg-secondary">
                    {['Código', 'Máquina', 'Tipo', 'Estado', 'Horas', 'Costo'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>
                    {ots.map((row: any) => {
                      const wo = row.work_orders;
                      if (!wo) return null;
                      return (
                        <TableRow key={wo.id} className="h-[44px]">
                          <TableCell className="font-dm text-sm font-medium text-[hsl(var(--gold))]">{wo.code}</TableCell>
                          <TableCell className="font-dm text-sm">{wo.machines?.name || '—'}</TableCell>
                          <TableCell><StatusBadge status={wo.type} /></TableCell>
                          <TableCell><StatusBadge status={wo.status || 'creada'} /></TableCell>
                          <TableCell className="font-dm text-sm">{wo.actual_hours || 0}h</TableCell>
                          <TableCell className="font-dm text-sm">${Number(wo.total_cost || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          )}
          {!isTecnico && (
            <TabsContent value="preops">
              {preops.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center font-dm">Sin preoperacionales</p>
              ) : (
                <Table>
                  <TableHeader><TableRow className="bg-secondary">
                    {['Fecha', 'Máquina', 'Proyecto', 'Tipo', 'Horómetro'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>
                    {preops.map((r: any) => (
                      <TableRow key={r.id} className="h-[44px]">
                        <TableCell className="font-dm text-sm">{r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy', { locale: es }) : '—'}</TableCell>
                        <TableCell className="font-dm text-sm">{r.machines?.name || '—'}</TableCell>
                        <TableCell className="font-dm text-sm text-muted-foreground">{r.projects?.name || '—'}</TableCell>
                        <TableCell><StatusBadge status={r.record_type} /></TableCell>
                        <TableCell className="font-dm text-sm">{Number(r.horometer_value).toLocaleString()} h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
