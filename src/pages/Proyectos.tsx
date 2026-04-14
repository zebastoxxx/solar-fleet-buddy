import { useState, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { deleteProjects } from '@/lib/cascade-delete';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { usePermissions } from '@/hooks/usePermissions';
import { ActionBar, ActionBarLeft, ActionBarRight } from '@/components/ui/action-bar';
import { SearchInput } from '@/components/ui/search-input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { FilterPills } from '@/components/ui/filter-pills';
import { AdvancedFilters } from '@/components/ui/AdvancedFilters';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, CalendarIcon, Truck, HardHat, Trash2, MoreHorizontal, Pencil, PauseCircle, CheckCircle2, Play } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const projectSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  client_id: z.string().optional(),
  country: z.string().default('Colombia'),
  city: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['activo', 'pausado', 'finalizado', 'prospecto']).default('activo'),
  start_date: z.string().optional(),
  end_date_estimated: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

const STATUS_FILTERS = [
  { label: 'Todos', value: 'all' },
  { label: 'Activos', value: 'activo' },
  { label: 'Pausados', value: 'pausado' },
  { label: 'Finalizados', value: 'finalizado' },
  { label: 'Prospectos', value: 'prospecto' },
];

export default function Proyectos() {
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  usePageTitle('Proyectos');
  const { log } = useLog();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-select', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, city').eq('status', 'activo').order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const filtered = useMemo(() => projects.filter((p: any) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (clientFilter !== 'all' && p.client_id !== clientFilter) return false;
    if (dateFrom && p.start_date && p.start_date < dateFrom) return false;
    if (dateTo && p.start_date && p.start_date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.city?.toLowerCase().includes(q)) || (p.clients?.name?.toLowerCase().includes(q));
    }
    return true;
  }), [projects, statusFilter, clientFilter, dateFrom, dateTo, search]);

  const form = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { country: 'Colombia', status: 'activo' },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', client_id: '', country: 'Colombia', city: '', address: '', status: 'activo', start_date: '', end_date_estimated: '', budget: undefined, description: '' });
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    form.reset({ name: p.name, client_id: p.client_id || '', country: p.country || 'Colombia', city: p.city || '', address: p.address || '', status: p.status || 'activo', start_date: p.start_date || '', end_date_estimated: p.end_date_estimated || '', budget: p.budget || undefined, description: p.description || '' });
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: async (values: ProjectForm) => {
      const row = {
        name: values.name,
        client_id: values.client_id || null,
        country: values.country || 'Colombia',
        city: values.city || null,
        address: values.address || null,
        status: values.status as 'activo' | 'pausado' | 'finalizado' | 'prospecto',
        start_date: values.start_date || null,
        end_date_estimated: values.end_date_estimated || null,
        budget: values.budget || null,
        description: values.description || null,
        tenant_id: tenantId!,
      };
      if (editing) {
        const { error } = await supabase.from('projects').update(row).eq('id', editing.id);
        if (error) throw error;
        await log('proyectos', 'editar_proyecto', 'project', editing.id, values.name);
      } else {
        const { error } = await supabase.from('projects').insert([row]);
        if (error) throw error;
        await log('proyectos', 'crear_proyecto', 'project', undefined, values.name);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Proyecto guardado'); setModalOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await deleteProjects(ids);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', tenantId] });
      toast.success(`${selectedRows.length} proyecto(s) eliminado(s)`);
      setSelectedRows([]);
      setShowBulkDeleteConfirm(false);
    },
    onError: () => toast.error('Error al eliminar los registros seleccionados'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('projects').update({ status: status as any }).eq('id', id);
      if (error) throw error;
      await log('proyectos', 'cambiar_estado_proyecto', 'project', id, status);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Estado actualizado'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const formatBudget = (n: number | null) => {
    if (!n) return '—';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  const projectColumns: Column<any>[] = [
    { key: 'name', label: 'Nombre', sortable: true, render: (p: any) => <span className="font-medium">{p.name}</span> },
    { key: 'clients.name', label: 'Cliente', sortable: true, render: (p: any) => <span className="text-muted-foreground">{p.clients?.name || '—'}</span> },
    { key: 'city', label: 'Ciudad', sortable: true, render: (p: any) => <span className="text-muted-foreground">{p.city || '—'}</span> },
    { key: 'start_date', label: 'Inicio', sortable: true, render: (p: any) => <span className="text-muted-foreground text-xs">{p.start_date ? format(new Date(p.start_date), 'dd MMM yyyy', { locale: es }) : '—'}</span> },
    { key: 'status', label: 'Estado', sortable: true, render: (p: any) => <StatusBadge status={p.status || 'activo'} /> },
    { key: 'budget', label: 'Presupuesto', sortable: true, align: 'right', render: (p: any) => <span className="font-medium">{formatBudget(p.budget)}</span> },
    { key: 'actions', label: '', width: '48px', render: (p: any) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => openEdit(p)}>
            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {p.status !== 'activo' && (
            <DropdownMenuItem onClick={() => statusMutation.mutate({ id: p.id, status: 'activo' })}>
              <Play className="h-3.5 w-3.5 mr-2" /> Marcar Activo
            </DropdownMenuItem>
          )}
          {p.status !== 'pausado' && (
            <DropdownMenuItem onClick={() => statusMutation.mutate({ id: p.id, status: 'pausado' })}>
              <PauseCircle className="h-3.5 w-3.5 mr-2" /> Pausar
            </DropdownMenuItem>
          )}
          {p.status !== 'finalizado' && (
            <DropdownMenuItem onClick={() => statusMutation.mutate({ id: p.id, status: 'finalizado' })}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Finalizar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )},
  ];

  return (
    <div className="space-y-3">
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar proyecto..." />
          <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
          <AdvancedFilters
            dateRange
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            customFilters={[
              { key: 'client', label: 'Cliente', type: 'select', options: [{ value: 'all', label: 'Todos' }, ...clients.map((c: any) => ({ value: c.id, label: c.name }))] },
            ]}
            filterValues={{ client: clientFilter }}
            onFilterChange={(k, v) => { if (k === 'client') setClientFilter(v); }}
            onClear={() => { setDateFrom(''); setDateTo(''); setClientFilter('all'); }}
            resultCount={filtered.length}
          />
        </ActionBarLeft>
        <ActionBarRight>
          <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo Proyecto</Button>
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
        columns={projectColumns}
        isLoading={isLoading}
        onRowClick={(p: any) => navigate(`/proyectos/${p.id}`)}
        defaultSort={{ key: 'start_date', direction: 'desc' }}
        rowKey={(p: any) => p.id}
        emptyMessage="No hay proyectos registrados"
        selectable={true}
        onSelectionChange={setSelectedRows}
      />

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow text-lg">{editing ? 'Editar Proyecto' : 'Nuevo Proyecto'}</DialogTitle>
            <DialogDescription className="font-dm text-sm text-muted-foreground">Completa la información del proyecto</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Nombre proyecto *</Label>
                <Input {...form.register('name')} className="h-10 rounded-lg font-dm" />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Cliente</Label>
                <SearchableSelect
                  value={form.watch('client_id') || ''}
                  onValueChange={(v) => form.setValue('client_id', v)}
                  options={[
                    { value: '', label: 'Sin cliente asignado' },
                    ...clients.map((c: any) => ({ value: c.id, label: `${c.name}${c.city ? ` · ${c.city}` : ''}` }))
                  ]}
                  placeholder="Buscar cliente..."
                  searchPlaceholder="Buscar cliente..."
                  emptyText="No se encontraron clientes."
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Estado</Label>
                <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as any)}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                    <SelectItem value="prospecto">Prospecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">País</Label>
                <Select value={form.watch('country')} onValueChange={(v) => form.setValue('country', v)}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Colombia">Colombia</SelectItem>
                    <SelectItem value="Guatemala">Guatemala</SelectItem>
                    <SelectItem value="USA">USA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Ciudad</Label>
                <Input {...form.register('city')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Dirección</Label>
                <Input {...form.register('address')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Fecha inicio</Label>
                <DateField value={form.watch('start_date')} onChange={(v) => form.setValue('start_date', v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Fecha fin estimada</Label>
                <DateField value={form.watch('end_date_estimated')} onChange={(v) => form.setValue('end_date_estimated', v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Presupuesto (COP)</Label>
                <Input {...form.register('budget')} type="number" placeholder="850000000" className="h-10 rounded-lg font-dm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-dm text-xs">Descripción</Label>
              <Textarea {...form.register('description')} rows={3} className="rounded-lg font-dm" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedRows.length} proyecto{selectedRows.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también todas las órdenes de trabajo, asignaciones de máquinas, personal y registros financieros asociados. Esta acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); bulkDeleteMutation.mutate(selectedRows.map((r: any) => r.id)); }}>
              {bulkDeleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DateField({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('h-10 w-full justify-start text-left font-dm rounded-lg', !date && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd MMM yyyy', { locale: es }) : 'Seleccionar fecha'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { if (d) { onChange(format(d, 'yyyy-MM-dd')); setOpen(false); } }}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
