import { useState, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { deleteClients } from '@/lib/cascade-delete';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
import { Plus, Pencil, Trash2, Eye, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const clientSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.enum(['empresa', 'persona_natural']),
  tax_id: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
  country: z.string().default('Colombia'),
  city: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['activo', 'inactivo']).default('activo'),
});

type ClientForm = z.infer<typeof clientSchema>;

type ClientRow = {
  id: string; name: string; tax_id: string | null; type: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  country: string | null; city: string | null; address: string | null;
  status: string | null; notes: string | null; created_at: string | null; tenant_id: string;
};

const STATUS_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Activos', value: 'activo' },
  { label: 'Inactivos', value: 'inactivo' },
];

export default function Clientes() {
  usePageTitle('Clientes');
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const { role } = usePermissions();
  const { log } = useLog();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [detailClient, setDetailClient] = useState<ClientRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedRows, setSelectedRows] = useState<ClientRow[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Advanced filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data as ClientRow[];
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  const countries = useMemo(() => {
    const set = new Set(clients.map((c) => c.country).filter(Boolean));
    return Array.from(set).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (!showInactive && c.status === 'inactivo') return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (countryFilter !== 'all' && c.country !== countryFilter) return false;
      if (dateFrom && c.created_at && c.created_at < dateFrom) return false;
      if (dateTo && c.created_at && c.created_at > dateTo + 'T23:59:59') return false;
      if (search) {
        const s = search.toLowerCase();
        return c.name.toLowerCase().includes(s) || (c.contact_name?.toLowerCase().includes(s)) || (c.tax_id?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [clients, statusFilter, countryFilter, dateFrom, dateTo, search, showInactive]);

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { type: 'empresa', country: 'Colombia', status: 'activo' },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ type: 'empresa', country: 'Colombia', status: 'activo', name: '', tax_id: '', contact_name: '', contact_phone: '', contact_email: '', city: '', address: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (c: ClientRow) => {
    setEditing(c);
    form.reset({
      name: c.name,
      type: (c.type as 'empresa' | 'persona_natural') || 'empresa',
      tax_id: c.tax_id || '', contact_name: c.contact_name || '', contact_phone: c.contact_phone || '',
      contact_email: c.contact_email || '', country: c.country || 'Colombia', city: c.city || '',
      address: c.address || '', notes: c.notes || '', status: (c.status as 'activo' | 'inactivo') || 'activo',
    });
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: async (values: ClientForm) => {
      const row = {
        name: values.name, type: values.type, tax_id: values.tax_id || null,
        contact_name: values.contact_name || null, contact_phone: values.contact_phone || null,
        contact_email: values.contact_email || null, country: values.country || 'Colombia',
        city: values.city || null, address: values.address || null, notes: values.notes || null,
        status: values.status || 'activo', tenant_id: tenantId!,
      };
      if (editing) {
        const { error } = await supabase.from('clients').update(row).eq('id', editing.id);
        if (error) throw error;
        await log('clientes', 'editar_cliente', 'client', editing.id, values.name);
      } else {
        const { error } = await supabase.from('clients').insert([row]);
        if (error) throw error;
        await log('clientes', 'crear_cliente', 'client', undefined, values.name);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Cliente guardado correctamente'); setModalOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClients([deleteTarget.id]);
      await log('clientes', 'eliminar_cliente', 'client', deleteTarget.id, deleteTarget.name);
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente eliminado');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error('Error al eliminar: ' + e.message);
    }
  };

  const reactivate = async (c: ClientRow) => {
    await supabase.from('clients').update({ status: 'activo' }).eq('id', c.id);
    qc.invalidateQueries({ queryKey: ['clients'] });
    toast.success('Registro reactivado correctamente');
  };

  const canManage = role === 'superadmin' || role === 'gerente';

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('clients').delete().eq('tenant_id', tenantId!).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients', tenantId] });
      toast.success(`${selectedRows.length} registro(s) eliminado(s)`);
      setSelectedRows([]);
      setShowBulkDeleteConfirm(false);
    },
    onError: () => toast.error('Error al eliminar los registros seleccionados'),
  });

  const columns: Column<ClientRow>[] = [
    { key: 'name', label: 'Nombre', sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'tax_id', label: 'NIT/Cédula', sortable: true, render: (c) => <span className="text-muted-foreground">{c.tax_id || '—'}</span> },
    { key: 'contact_name', label: 'Contacto', sortable: true },
    { key: 'city', label: 'Ciudad', sortable: true, render: (c) => <span className="text-muted-foreground">{c.city || '—'}</span> },
    { key: 'country', label: 'País', sortable: true, render: (c) => <span className="text-muted-foreground">{c.country || '—'}</span> },
    { key: 'created_at', label: 'Registrado', sortable: true, render: (c) => <span className="text-muted-foreground text-xs">{c.created_at ? format(new Date(c.created_at), 'dd MMM yyyy', { locale: es }) : '—'}</span> },
    { key: 'status', label: 'Estado', render: (c) => <StatusBadge status={c.status || 'activo'} /> },
    {
      key: 'actions', label: 'Acciones', render: (c) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
          {canManage && c.status === 'inactivo' && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => reactivate(c)}><RotateCcw className="h-3.5 w-3.5" /></Button>
          )}
          {canManage && c.status !== 'inactivo' && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      )
    },
  ];

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setCountryFilter('all'); setStatusFilter('all'); };

  return (
    <div className="space-y-3">
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente..." />
          <FilterPills options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <AdvancedFilters
            dateRange
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            customFilters={[
              { key: 'country', label: 'País', type: 'select', options: [{ value: 'all', label: 'Todos' }, ...countries.map((c) => ({ value: c!, label: c! }))] },
            ]}
            filterValues={{ country: countryFilter }}
            onFilterChange={(k, v) => { if (k === 'country') setCountryFilter(v); }}
            onClear={clearFilters}
            resultCount={filtered.length}
          />
        </ActionBarLeft>
        <ActionBarRight>
          {canManage && (
            <Button variant="outline" size="sm" className="text-xs font-dm" onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? 'Ocultar inactivos' : 'Ver inactivos'}
            </Button>
          )}
          <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo Cliente</Button>
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
        onRowClick={(c) => setDetailClient(c)}
        defaultSort={{ key: 'name', direction: 'asc' }}
        rowKey={(c) => c.id}
        emptyMessage="No hay clientes registrados"
        selectable={true}
        onSelectionChange={setSelectedRows}
      />

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow text-lg">{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            <DialogDescription className="font-dm text-sm text-muted-foreground">
              {editing ? 'Modifica los datos del cliente' : 'Ingresa los datos del nuevo cliente'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Nombre / Razón social *</Label>
                <Input {...form.register('name')} className="h-10 rounded-lg font-dm" />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Tipo</Label>
                <Select value={form.watch('type')} onValueChange={(v) => form.setValue('type', v as any)}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="persona_natural">Persona natural</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">NIT / Cédula</Label>
                <Input {...form.register('tax_id')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Estado</Label>
                <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as any)}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Contacto principal</Label>
                <Input {...form.register('contact_name')} placeholder="Nombre" className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Teléfono</Label>
                <Input {...form.register('contact_phone')} className="h-10 rounded-lg font-dm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">Email</Label>
                <Input {...form.register('contact_email')} type="email" className="h-10 rounded-lg font-dm" />
                {form.formState.errors.contact_email && <p className="text-xs text-destructive">{form.formState.errors.contact_email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-dm text-xs">País</Label>
                <Select value={form.watch('country')} onValueChange={(v) => form.setValue('country', v)}>
                  <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Colombia">Colombia</SelectItem>
                    <SelectItem value="Guatemala">Guatemala</SelectItem>
                    <SelectItem value="USA">USA</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
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
      <ClientDetailModal
        client={detailClient}
        onClose={() => setDetailClient(null)}
        onEdit={(c) => { setDetailClient(null); openEdit(c); }}
        onDelete={canManage ? (c) => { setDetailClient(null); setDeleteTarget(c); } : undefined}
      />

      {/* Safe Delete */}
      {deleteTarget && (
        <SafeDeleteDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          entityName={deleteTarget.name}
          checkFn={() => checkDeleteClient(deleteTarget.id)}
          onConfirm={handleDelete}
        />
      )}

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedRows.length} registro{selectedRows.length !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los registros seleccionados serán eliminados permanentemente.
            </AlertDialogDescription>
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

// ─── Client Detail Modal ───
function ClientDetailModal({ client, onClose, onEdit, onDelete }: {
  client: ClientRow | null; onClose: () => void; onEdit: (c: ClientRow) => void; onDelete?: (c: ClientRow) => void;
}) {
  const { data: projects = [] } = useQuery({
    queryKey: ['client-projects', client?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('client_id', client!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!client,
  });

  const { data: financials } = useQuery({
    queryKey: ['client-financials', client?.id],
    queryFn: async () => {
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length === 0) return { income: 0, expenses: 0 };
      const { data: entries } = await supabase
        .from('cost_entries')
        .select('amount, entry_type')
        .in('project_id', projectIds);
      const income = (entries || []).filter((e) => e.entry_type === 'ingreso').reduce((s, e) => s + Number(e.amount), 0);
      const expenses = (entries || []).filter((e) => e.entry_type === 'gasto').reduce((s, e) => s + Number(e.amount), 0);
      return { income, expenses };
    },
    enabled: !!client && projects.length > 0,
  });

  if (!client) return null;

  const activeProjects = projects.filter((p: any) => p.status === 'activo');
  const finishedProjects = projects.filter((p: any) => p.status === 'finalizado');
  const totalBudget = projects.reduce((s: number, p: any) => s + (Number(p.budget) || 0), 0);
  const initials = client.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[680px] rounded-2xl max-h-[85vh] overflow-y-auto">
        {/* Hero */}
        <div className="flex items-start gap-4 pb-4 border-b border-border">
          <div className="h-16 w-16 rounded-xl bg-[hsl(var(--gold)/0.15)] flex items-center justify-center text-[hsl(var(--gold-bright))] font-barlow text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-barlow text-xl font-semibold">{client.name}</h2>
              <StatusBadge status={client.status || 'activo'} />
              <span className="text-[11px] font-dm bg-secondary text-muted-foreground rounded-full px-2 py-0.5">
                {client.type === 'persona_natural' ? 'Persona natural' : 'Empresa'}
              </span>
            </div>
            {client.tax_id && <p className="text-xs text-muted-foreground font-dm mt-0.5">NIT: {client.tax_id}</p>}
            <p className="text-xs text-muted-foreground font-dm">{client.city}{client.country ? `, ${client.country}` : ''}</p>
          </div>
        </div>

        <Tabs defaultValue="info">
          <TabsList className="font-dm">
            <TabsTrigger value="info">📋 Información</TabsTrigger>
            <TabsTrigger value="projects">📁 Proyectos ({projects.length})</TabsTrigger>
            <TabsTrigger value="financial">💰 Financiero</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <div className="grid grid-cols-2 gap-4 py-3">
              {[
                ['Contacto principal', client.contact_name],
                ['Teléfono', client.contact_phone ? <a href={`tel:${client.contact_phone}`} className="text-primary hover:underline">{client.contact_phone}</a> : null],
                ['Email', client.contact_email ? <a href={`mailto:${client.contact_email}`} className="text-primary hover:underline">{client.contact_email}</a> : null],
                ['Dirección', client.address],
                ['Fecha de registro', client.created_at ? format(new Date(client.created_at), 'dd MMM yyyy', { locale: es }) : null],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-[11px] uppercase text-muted-foreground font-dm">{label as string}</p>
                  <p className="text-sm font-dm">{val || '—'}</p>
                </div>
              ))}
              {client.notes && (
                <div className="col-span-2">
                  <p className="text-[11px] uppercase text-muted-foreground font-dm">Notas</p>
                  <p className="text-sm font-dm whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="projects">
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                ['Total', projects.length],
                ['Activos', activeProjects.length],
                ['Finalizados', finishedProjects.length],
                ['Presupuesto', totalBudget >= 1_000_000 ? `$${(totalBudget / 1_000_000).toFixed(0)}M` : `$${totalBudget.toLocaleString()}`],
              ].map(([label, val]) => (
                <div key={label as string} className="bg-secondary rounded-lg p-2.5 text-center">
                  <p className="text-[11px] uppercase text-muted-foreground font-dm">{label as string}</p>
                  <p className="text-lg font-barlow font-semibold">{val as any}</p>
                </div>
              ))}
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center font-dm">Sin proyectos asociados</p>
            ) : (
              <Table>
                <TableHeader><TableRow className="bg-secondary">
                  <TableHead className="text-[11px] uppercase font-dm">Nombre</TableHead>
                  <TableHead className="text-[11px] uppercase font-dm">Estado</TableHead>
                  <TableHead className="text-[11px] uppercase font-dm">Ciudad</TableHead>
                  <TableHead className="text-[11px] uppercase font-dm">Inicio</TableHead>
                  <TableHead className="text-[11px] uppercase font-dm">Presupuesto</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {projects.map((p: any) => (
                    <TableRow key={p.id} className="h-[44px]">
                      <TableCell className="font-dm text-sm font-medium">{p.name}</TableCell>
                      <TableCell><StatusBadge status={p.status || 'activo'} /></TableCell>
                      <TableCell className="font-dm text-sm text-muted-foreground">{p.city || '—'}</TableCell>
                      <TableCell className="font-dm text-sm text-muted-foreground">{p.start_date ? format(new Date(p.start_date), 'dd MMM yyyy', { locale: es }) : '—'}</TableCell>
                      <TableCell className="font-dm text-sm">{p.budget ? `$${Number(p.budget).toLocaleString()}` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="financial">
            <div className="grid grid-cols-3 gap-3 py-3">
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-[11px] uppercase text-muted-foreground font-dm">Ingresos</p>
                <p className="text-lg font-barlow font-semibold text-[hsl(var(--success))]">
                  ${(financials?.income || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-[11px] uppercase text-muted-foreground font-dm">Gastos</p>
                <p className="text-lg font-barlow font-semibold text-destructive">
                  ${(financials?.expenses || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-[11px] uppercase text-muted-foreground font-dm">Utilidad</p>
                <p className="text-lg font-barlow font-semibold">
                  ${((financials?.income || 0) - (financials?.expenses || 0)).toLocaleString()}
                </p>
              </div>
            </div>
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 font-dm">Sin proyectos para calcular financiero</p>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" className="gap-1.5 font-dm" onClick={() => onEdit(client)}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          {onDelete && client.status !== 'inactivo' && (
            <Button variant="ghost" size="sm" className="gap-1.5 font-dm text-destructive" onClick={() => onDelete(client)}>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
