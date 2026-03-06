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
import { Plus, Pencil, XCircle } from 'lucide-react';
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
  id: string;
  name: string;
  tax_id: string | null;
  type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  tenant_id: string;
};

const STATUS_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Activos', value: 'activo' },
  { label: 'Inactivos', value: 'inactivo' },
];

export default function Clientes() {
  usePageTitle('Clientes');
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const { log } = useLog();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [detailClient, setDetailClient] = useState<ClientRow | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as ClientRow[];
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  const filtered = clients.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(s) ||
        (c.contact_name?.toLowerCase().includes(s)) ||
        (c.tax_id?.toLowerCase().includes(s))
      );
    }
    return true;
  });

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
      tax_id: c.tax_id || '',
      contact_name: c.contact_name || '',
      contact_phone: c.contact_phone || '',
      contact_email: c.contact_email || '',
      country: c.country || 'Colombia',
      city: c.city || '',
      address: c.address || '',
      notes: c.notes || '',
      status: (c.status as 'activo' | 'inactivo') || 'activo',
    });
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: async (values: ClientForm) => {
      const row = {
        name: values.name,
        type: values.type,
        tax_id: values.tax_id || null,
        contact_name: values.contact_name || null,
        contact_phone: values.contact_phone || null,
        contact_email: values.contact_email || null,
        country: values.country || 'Colombia',
        city: values.city || null,
        address: values.address || null,
        notes: values.notes || null,
        status: values.status || 'activo',
        tenant_id: tenantId!,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente guardado correctamente');
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivate = useMutation({
    mutationFn: async (c: ClientRow) => {
      const { error } = await supabase.from('clients').update({ status: 'inactivo' }).eq('id', c.id);
      if (error) throw error;
      await log('clientes', 'desactivar_cliente', 'client', c.id, c.name);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente desactivado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente..." />
          <FilterPills options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </ActionBarLeft>
        <ActionBarRight>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo Cliente
          </Button>
        </ActionBarRight>
      </ActionBar>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              <TableHead className="text-[11px] uppercase tracking-wider font-dm">Nombre</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-dm">NIT/Cédula</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-dm">Contacto</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-dm">Ciudad</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-dm">País</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-dm">Estado</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-dm">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="h-[44px]">
                {Array.from({ length: 7 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                ))}
              </TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-dm">No hay clientes registrados</TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id} className="h-[44px] cursor-pointer hover:bg-[hsl(var(--gold)/0.04)]" onClick={() => setDetailClient(c)}>
                <TableCell className="font-medium font-dm text-sm">{c.name}</TableCell>
                <TableCell className="font-dm text-sm text-muted-foreground">{c.tax_id || '—'}</TableCell>
                <TableCell className="font-dm text-sm">{c.contact_name || '—'}</TableCell>
                <TableCell className="font-dm text-sm text-muted-foreground">{c.city || '—'}</TableCell>
                <TableCell className="font-dm text-sm text-muted-foreground">{c.country || '—'}</TableCell>
                <TableCell><StatusBadge status={c.status || 'activo'} /></TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('¿Desactivar este cliente?')) deactivate.mutate(c); }}><XCircle className="h-3.5 w-3.5" /></Button>
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
                <Select value={form.watch('type')} onValueChange={(v) => form.setValue('type', v as 'empresa' | 'persona_natural')}>
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
                <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as 'activo' | 'inactivo')}>
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
      <ClientDetailModal client={detailClient} onClose={() => setDetailClient(null)} onEdit={(c) => { setDetailClient(null); openEdit(c); }} />
    </div>
  );
}

function ClientDetailModal({ client, onClose, onEdit }: { client: ClientRow | null; onClose: () => void; onEdit: (c: ClientRow) => void }) {
  const { data: projects = [] } = useQuery({
    queryKey: ['client-projects', client?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('client_id', client!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!client,
  });

  if (!client) return null;

  return (
    <Dialog open={!!client} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-barlow text-lg flex items-center gap-2">
            {client.name}
            <StatusBadge status={client.status || 'activo'} />
          </DialogTitle>
          <DialogDescription className="font-dm text-sm text-muted-foreground">{client.city}{client.country ? `, ${client.country}` : ''}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="projects">
          <TabsList className="font-dm">
            <TabsTrigger value="projects">Proyectos asociados</TabsTrigger>
            <TabsTrigger value="info">Info de contacto</TabsTrigger>
          </TabsList>
          <TabsContent value="projects">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center font-dm">Sin proyectos asociados</p>
            ) : (
              <Table>
                <TableHeader><TableRow className="bg-secondary">
                  <TableHead className="text-[11px] uppercase font-dm">Nombre</TableHead>
                  <TableHead className="text-[11px] uppercase font-dm">Estado</TableHead>
                  <TableHead className="text-[11px] uppercase font-dm">Ciudad</TableHead>
                  <TableHead className="text-[11px] uppercase font-dm">Inicio</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id} className="h-[44px]">
                      <TableCell className="font-dm text-sm font-medium">{p.name}</TableCell>
                      <TableCell><StatusBadge status={p.status || 'activo'} /></TableCell>
                      <TableCell className="font-dm text-sm text-muted-foreground">{p.city || '—'}</TableCell>
                      <TableCell className="font-dm text-sm text-muted-foreground">{p.start_date ? format(new Date(p.start_date), 'dd MMM yyyy', { locale: es }) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="info">
            <div className="grid grid-cols-2 gap-4 py-2">
              {[
                ['Tipo', client.type === 'persona_natural' ? 'Persona natural' : 'Empresa'],
                ['NIT / Cédula', client.tax_id],
                ['Contacto', client.contact_name],
                ['Teléfono', client.contact_phone],
                ['Email', client.contact_email],
                ['Dirección', client.address],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-[11px] uppercase text-muted-foreground font-dm">{label}</p>
                  <p className="text-sm font-dm">{val || '—'}</p>
                </div>
              ))}
              {client.notes && (
                <div className="col-span-2">
                  <p className="text-[11px] uppercase text-muted-foreground font-dm">Notas</p>
                  <p className="text-sm font-dm">{client.notes}</p>
                </div>
              )}
            </div>
            <Button variant="ghost" className="mt-2" onClick={() => onEdit(client)}>Editar</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
