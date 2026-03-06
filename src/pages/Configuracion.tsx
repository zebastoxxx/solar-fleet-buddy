import { useState, useEffect, useRef } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useAlertsStore } from '@/stores/alertsStore';
import { useLog } from '@/hooks/useLog';
import { RoleBadge } from '@/components/ui/role-badge';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Plus, CheckCircle, Eye, EyeOff, Dice5, Users, Building2, SlidersHorizontal, Bell, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

const TABS = [
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'empresa', label: 'Empresa', icon: Building2 },
  { key: 'parametros', label: 'Parámetros', icon: SlidersHorizontal },
  { key: 'alertas', label: 'Alertas', icon: Bell },
  { key: 'logs', label: 'Logs del Sistema', icon: ScrollText },
];

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── USUARIOS TAB ───
function UsuariosTab() {
  const user = useAuthStore(s => s.user);
  const { log } = useLog();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<any>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<any>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['config-users', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('*, personnel:personnel(specialty, hourly_rate, type)')
        .eq('tenant_id', user!.tenant_id).order('role').order('full_name');
      return data ?? [];
    },
    enabled: !!user,
  });

  const filtered = (users ?? []).filter(u => {
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar usuario..." />
        <FilterPills options={[
          { label: 'Todos', value: 'all' },
          { label: 'Activos', value: 'active' },
          ...(['superadmin', 'gerente', 'supervisor', 'tecnico', 'operario'] as const).map(r => ({ label: r, value: r })),
        ]} value={roleFilter} onChange={setRoleFilter} />
        <Button onClick={() => setShowCreate(true)} className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1" /> Nuevo Usuario
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-dm text-sm">{u.full_name}</TableCell>
                  <TableCell><RoleBadge role={u.role as UserRole} /></TableCell>
                  <TableCell>
                    <span className={cn('inline-flex items-center gap-1.5 text-xs font-dm', u.active ? 'text-success' : 'text-muted-foreground')}>
                      <span className={cn('h-2 w-2 rounded-full', u.active ? 'bg-success' : 'bg-muted-foreground')} />
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-dm">
                    {u.last_login ? formatDistanceToNow(new Date(u.last_login), { addSuffix: true, locale: es }) : 'Nunca'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setShowEdit(u)}>✏️</Button>
                      {u.id !== user?.id && (
                        u.active ? (
                          <Button variant="ghost" size="sm" onClick={() => setDeactivateTarget(u)} className="text-destructive">🔒</Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={async () => {
                            await supabase.from('users').update({ active: true }).eq('id', u.id);
                            qc.invalidateQueries({ queryKey: ['config-users'] });
                            toast.success('Usuario activado');
                          }} className="text-success">✅</Button>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal open={showCreate} onOpenChange={setShowCreate} onSuccess={() => qc.invalidateQueries({ queryKey: ['config-users'] })} />

      {/* Edit User Modal */}
      {showEdit && (
        <EditUserModal user={showEdit} open={!!showEdit} onOpenChange={() => setShowEdit(null)} onSuccess={() => qc.invalidateQueries({ queryKey: ['config-users'] })} />
      )}

      {/* Deactivate confirmation */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar a {deactivateTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>No podrá ingresar al sistema.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => {
              await supabase.from('users').update({ active: false }).eq('id', deactivateTarget.id);
              await log('configuracion', 'desactivar_usuario', 'user', deactivateTarget.id, deactivateTarget.full_name);
              qc.invalidateQueries({ queryKey: ['config-users'] });
              toast.success('Usuario desactivado');
              setDeactivateTarget(null);
            }}>Desactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateUserModal({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
  const currentUser = useAuthStore(s => s.user);
  const { log } = useLog();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<UserRole>('tecnico');
  const [specialty, setSpecialty] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!fullName || !email || !password || password.length < 8) {
      toast.error('Completa todos los campos requeridos (contraseña mín. 8 caracteres)');
      return;
    }
    setSaving(true);
    try {
      // Call edge function to create auth user
      const { data: result, error: fnErr } = await supabase.functions.invoke('create-user', {
        body: { email, password, fullName, role, tenantId: currentUser!.tenant_id },
      });
      if (fnErr || result?.error) {
        toast.error(result?.error || fnErr?.message || 'Error creando usuario');
        setSaving(false);
        return;
      }

      const authUserId = result.user.id;

      // Insert into users table
      await supabase.from('users').insert({
        id: authUserId,
        tenant_id: currentUser!.tenant_id,
        full_name: fullName,
        role,
        active: true,
        created_by: currentUser!.id,
      });

      // If tecnico/operario, insert personnel
      if (['tecnico', 'operario'].includes(role)) {
        await supabase.from('personnel').insert({
          tenant_id: currentUser!.tenant_id,
          user_id: authUserId,
          full_name: fullName,
          phone: phone || null,
          email,
          type: role as 'tecnico' | 'operario',
          specialty: specialty || null,
          hourly_rate: parseFloat(hourlyRate) || 0,
          id_number: idNumber || null,
          status: 'activo',
        });
      }

      await log('configuracion', 'crear_usuario', 'user', authUserId, fullName);
      toast.success(`Usuario ${fullName} creado. Ya puede ingresar con su email y contraseña.`);
      onSuccess();
      onOpenChange(false);
      // Reset
      setFullName(''); setEmail(''); setPassword(''); setRole('tecnico');
      setSpecialty(''); setHourlyRate(''); setIdNumber(''); setPhone('');
    } catch (err: any) {
      toast.error(err.message || 'Error creando usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Nombre completo *</label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Email *</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Contraseña temporal *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPassword(generatePassword())}><Dice5 className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Rol *</label>
            <Select value={role} onValueChange={v => setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['superadmin', 'gerente', 'supervisor', 'tecnico', 'operario'] as const).map(r => (
                  <SelectItem key={r} value={r}><div className="flex items-center gap-2"><RoleBadge role={r} /> {r}</div></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {['tecnico', 'operario'].includes(role) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-dm font-medium text-muted-foreground">Cédula / ID</label>
                  <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-dm font-medium text-muted-foreground">Teléfono</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              {role === 'tecnico' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-dm font-medium text-muted-foreground">Especialidad</label>
                    <Input value={specialty} onChange={e => setSpecialty(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-dm font-medium text-muted-foreground">Tarifa/hora (COP)</label>
                    <Input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          <Button onClick={handleCreate} disabled={saving} className="w-full bg-primary text-primary-foreground">
            {saving ? 'Creando...' : 'Crear usuario'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditUserModal({ user: editUser, open, onOpenChange, onSuccess }: { user: any; open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
  const { log } = useLog();
  const [fullName, setFullName] = useState(editUser.full_name);
  const [role, setRole] = useState(editUser.role);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('users').update({ full_name: fullName, role }).eq('id', editUser.id);
      await log('configuracion', 'editar_usuario', 'user', editUser.id, fullName);
      toast.success('Usuario actualizado');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar Usuario</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Nombre completo</label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Rol</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['superadmin', 'gerente', 'supervisor', 'tecnico', 'operario'] as const).map(r => (
                  <SelectItem key={r} value={r}><RoleBadge role={r} /></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── EMPRESA TAB ───
function EmpresaTab() {
  const currentUser = useAuthStore(s => s.user);
  const { log } = useLog();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-detail', currentUser?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('*').eq('id', currentUser!.tenant_id).single();
      return data;
    },
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (tenant) setForm(tenant);
  }, [tenant]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('tenants').update({
        name: form.name,
        tax_id: form.tax_id,
        phone: form.phone,
        email: form.email,
        country: form.country,
        city: form.city,
      }).eq('id', currentUser!.tenant_id);
      await log('configuracion', 'editar_empresa', 'tenant', currentUser!.tenant_id, form.name);
      toast.success('Datos de empresa actualizados');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground">Identidad</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Nombre empresa *</label>
            <Input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">NIT / Tax ID</label>
            <Input value={form.tax_id ?? ''} onChange={e => setForm({ ...form, tax_id: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contacto</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Teléfono</label>
            <Input value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Email</label>
            <Input value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">País</label>
            <Select value={form.country ?? 'Colombia'} onValueChange={v => setForm({ ...form, country: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Colombia">Colombia</SelectItem>
                <SelectItem value="Guatemala">Guatemala</SelectItem>
                <SelectItem value="USA">USA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-dm font-medium text-muted-foreground">Ciudad</label>
            <Input value={form.city ?? ''} onChange={e => setForm({ ...form, city: e.target.value })} />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
        {saving ? 'Guardando...' : 'Guardar cambios empresa'}
      </Button>
    </div>
  );
}

// ─── PARÁMETROS TAB ───
function ParametrosTab() {
  const currentUser = useAuthStore(s => s.user);
  const { log } = useLog();
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ['tenant-params', currentUser?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('monthly_maintenance_budget').eq('id', currentUser!.tenant_id).single();
      return data;
    },
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (tenant) setBudget(String(tenant.monthly_maintenance_budget ?? ''));
  }, [tenant]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('tenants').update({ monthly_maintenance_budget: parseFloat(budget) || 0 }).eq('id', currentUser!.tenant_id);
      await log('configuracion', 'editar_presupuesto', 'tenant', currentUser!.tenant_id);
      toast.success('Presupuesto actualizado');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground">Presupuesto de Mantenimiento</h3>
        <div>
          <label className="text-xs font-dm font-medium text-muted-foreground">Presupuesto mensual (COP)</label>
          <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="12000000" />
          <p className="text-[11px] text-muted-foreground font-dm mt-1">Se usa para calcular el % de gasto en el dashboard</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
          {saving ? 'Guardando...' : 'Actualizar presupuesto'}
        </Button>
      </div>
    </div>
  );
}

// ─── ALERTAS TAB ───
function AlertasTab() {
  const { unresolved } = useAlertsStore();
  const qc = useQueryClient();

  const resolveAlert = async (id: string) => {
    await supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id);
    useAlertsStore.getState().resolveAlert(id);
    toast.success('Alerta resuelta');
  };

  const resolveAll = async () => {
    const ids = unresolved.map(a => a.id);
    if (!ids.length) return;
    await supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString() }).in('id', ids);
    useAlertsStore.getState().setAlerts([]);
    toast.success('Todas las alertas resueltas');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Alertas activas sin resolver ({unresolved.length})
          </h3>
          {unresolved.length > 0 && (
            <Button variant="outline" size="sm" onClick={resolveAll}>Resolver todas</Button>
          )}
        </div>
        {unresolved.length === 0 ? (
          <p className="text-sm text-muted-foreground font-dm text-center py-6">Sin alertas pendientes ✓</p>
        ) : (
          <div className="space-y-2">
            {unresolved.map(a => (
              <div key={a.id} className={cn(
                'flex items-center justify-between rounded-lg border-l-4 p-3',
                a.severity === 'critical' ? 'border-l-destructive bg-destructive/5' : 'border-l-primary bg-primary/5'
              )}>
                <div>
                  <p className="text-sm font-dm text-foreground">{a.message}</p>
                  <p className="text-[11px] text-muted-foreground font-dm">
                    {a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es }) : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => resolveAlert(a.id)}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Resolver
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LOGS TAB ───
function LogsTab() {
  const user = useAuthStore(s => s.user);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['system-logs', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('system_logs').select('*')
        .eq('tenant_id', user!.tenant_id).order('created_at', { ascending: false }).limit(200);
      return data ?? [];
    },
    enabled: !!user,
  });

  const filtered = (logs ?? []).filter(l => {
    if (search && !(l.user_name?.toLowerCase().includes(search.toLowerCase()) || l.action?.toLowerCase().includes(search.toLowerCase()) || l.entity_name?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (moduleFilter !== 'all' && l.module !== moduleFilter) return false;
    return true;
  });

  const getRowBg = (action: string) => {
    if (action.includes('crear')) return 'bg-success/5';
    if (action.includes('editar')) return 'bg-blue-500/5';
    if (action.includes('eliminar') || action.includes('desactivar')) return 'bg-destructive/5';
    if (action.includes('cerrar') || action.includes('firmar')) return 'bg-primary/5';
    return '';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('crear')) return '✅';
    if (action.includes('editar')) return '✏️';
    if (action.includes('eliminar')) return '🗑️';
    if (action.includes('login')) return '🔑';
    if (action.includes('cerrar')) return '🔒';
    if (action.includes('firmar')) return '✍️';
    return '📝';
  };

  const handleExport = () => {
    if (!filtered.length) return;
    const rows = filtered.map(l => ({
      timestamp: l.created_at, usuario: l.user_name, rol: l.user_role, modulo: l.module,
      accion: l.action, entidad: l.entity_name ?? '', detalle: l.detail ? JSON.stringify(l.detail) : '',
    }));
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r as any)[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar en logs..." />
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Módulo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {['clientes', 'proveedores', 'maquinas', 'personal', 'proyectos', 'preoperacionales', 'ordenes-trabajo', 'inventario', 'configuracion'].map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={handleExport} className="ml-auto">
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id} className={getRowBg(l.action)}>
                  <TableCell className="text-xs font-dm text-muted-foreground whitespace-nowrap">
                    {l.created_at ? format(new Date(l.created_at), 'dd MMM yyyy, HH:mm:ss', { locale: es }) : ''}
                  </TableCell>
                  <TableCell className="text-sm font-dm">{l.user_name}</TableCell>
                  <TableCell><RoleBadge role={l.user_role as UserRole} /></TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-dm">{l.module}</span>
                  </TableCell>
                  <TableCell className="text-sm font-dm">
                    {getActionIcon(l.action)} {l.action}
                  </TableCell>
                  <TableCell className="text-sm font-dm text-muted-foreground">{l.entity_name ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ───
export default function Configuracion() {
  usePageTitle('Configuración');
  const [activeTab, setActiveTab] = useState('usuarios');

  return (
    <div className="space-y-6">
      <h1 className="font-barlow text-xl font-bold uppercase tracking-wider text-foreground">Configuración</h1>
      <div className="flex gap-6">
        {/* Vertical tabs */}
        <nav className="w-[180px] shrink-0 space-y-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-sm font-dm transition-colors text-left',
                  activeTab === tab.key
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'usuarios' && <UsuariosTab />}
          {activeTab === 'empresa' && <EmpresaTab />}
          {activeTab === 'parametros' && <ParametrosTab />}
          {activeTab === 'alertas' && <AlertasTab />}
          {activeTab === 'logs' && <LogsTab />}
        </div>
      </div>
    </div>
  );
}
