import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Upload, Download, FileText, Archive, Trash2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PreviewButton } from '@/components/ui/DocumentPreview';
import { downloadDocsAsZip } from '@/lib/download-docs-zip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { MachineStatus } from '@/types';

export default function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const userId = useAuthStore((s) => s.user?.id);
  const { log } = useLog();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*, clients(name, contact_phone)').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Tab: Machines
  const { data: machines = [] } = useQuery({
    queryKey: ['project-machines', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_machines').select('*, machines(id, name, internal_code, type, status, horometer_current)').eq('project_id', id!).is('removed_date', null);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Tab: Personnel
  const { data: personnel = [] } = useQuery({
    queryKey: ['project-personnel', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_personnel').select('*, personnel(id, full_name, type)').eq('project_id', id!).is('end_date', null);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Tab: Preops
  const { data: preops = [] } = useQuery({
    queryKey: ['project-preops', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('preop_records').select('*, machines(name), personnel!preop_records_operator_id_fkey(full_name)').eq('project_id', id!).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Tab: Work Orders
  const { data: workOrders = [] } = useQuery({
    queryKey: ['project-ots', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('work_orders').select('*, machines(name)').eq('project_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Tab: Costs
  const { data: costs = [] } = useQuery({
    queryKey: ['project-costs', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('cost_entries').select('*').eq('project_id', id!).order('cost_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Tab: Documents
  const { data: projectDocs = [], refetch: refetchDocs } = useQuery({
    queryKey: ['project-documents', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_documents').select('*').eq('project_id', id!).order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Document upload state
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('otro');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDocTarget, setDeleteDocTarget] = useState<any>(null);

  const handleUploadDoc = async () => {
    if (!docFile || !docName || !id || !tenantId) return;
    setUploading(true);
    try {
      const path = `projects/${id}/${Date.now()}_${docFile.name}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, docFile);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
      const { error: insertErr } = await supabase.from('project_documents').insert([{
        project_id: id, name: docName, doc_type: docType,
        file_url: urlData.publicUrl, file_name: docFile.name, tenant_id: tenantId, uploaded_by: userId,
      }]);
      if (insertErr) throw insertErr;
      toast.success('Documento subido correctamente');
      refetchDocs();
      setDocModalOpen(false);
      setDocName(''); setDocType('otro'); setDocFile(null);
    } catch (e: any) {
      toast.error('Error al subir: ' + e.message);
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
    await supabase.from('project_documents').delete().eq('id', deleteDocTarget.id);
    toast.success('Documento eliminado');
    refetchDocs();
    setDeleteDocTarget(null);
  };

  // Assign machine modal
  const [assignMachineOpen, setAssignMachineOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const { data: availableMachines = [] } = useQuery({
    queryKey: ['available-machines', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('machines').select('id, name, internal_code').in('status', ['disponible_bodega', 'varada_bodega']);
      if (error) throw error;
      return data;
    },
    enabled: assignMachineOpen,
  });

  const assignMachineMut = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from('project_machines').insert({ project_id: id!, machine_id: selectedMachineId });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('machines').update({ current_project_id: id!, status: 'activa_en_campo' as const }).eq('id', selectedMachineId);
      if (e2) throw e2;
      await log('proyectos', 'asignar_maquina', 'project', id!, project?.name);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-machines'] }); toast.success('Máquina asignada'); setAssignMachineOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMachineMut = useMutation({
    mutationFn: async (pmId: string) => {
      const pm = machines.find((m: any) => m.id === pmId);
      const { error: e1 } = await supabase.from('project_machines').update({ removed_date: new Date().toISOString().split('T')[0] }).eq('id', pmId);
      if (e1) throw e1;
      if (pm?.machine_id) {
        await supabase.from('machines').update({ current_project_id: null, status: 'disponible_bodega' as const }).eq('id', pm.machine_id);
      }
      await log('proyectos', 'remover_maquina', 'project', id!, project?.name);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-machines'] }); toast.success('Máquina removida'); },
  });

  // Assign personnel modal
  const [assignPersonOpen, setAssignPersonOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const { data: availablePersonnel = [] } = useQuery({
    queryKey: ['available-personnel', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('id, full_name, type').eq('status', 'activo');
      if (error) throw error;
      return data;
    },
    enabled: assignPersonOpen,
  });

  const assignPersonMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('project_personnel').insert({ project_id: id!, personnel_id: selectedPersonId });
      if (error) throw error;
      await log('proyectos', 'asignar_persona', 'project', id!, project?.name);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-personnel'] }); toast.success('Persona asignada'); setAssignPersonOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePersonMut = useMutation({
    mutationFn: async (ppId: string) => {
      const { error } = await supabase.from('project_personnel').update({ end_date: new Date().toISOString().split('T')[0] }).eq('id', ppId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project-personnel'] }); toast.success('Persona removida'); },
  });

  if (isLoading) return <div className="space-y-4 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (!project) return <p className="text-center py-12 text-muted-foreground font-dm">Proyecto no encontrado</p>;

  const totalCost = costs.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const daysActive = project.start_date ? differenceInDays(new Date(), new Date(project.start_date)) : 0;
  const budgetPct = project.budget ? (totalCost / project.budget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate('/proyectos')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-barlow text-[22px] font-semibold">{project.name}</h2>
              <StatusBadge status={project.status || 'activo'} />
            </div>
            <p className="text-sm text-muted-foreground font-dm">
              {project.clients?.name || 'Sin cliente'} · {project.city || ''}
              {project.start_date && ` · ${format(new Date(project.start_date), 'dd MMM yyyy', { locale: es })}`}
              {project.end_date_estimated && ` → ${format(new Date(project.end_date_estimated), 'dd MMM yyyy', { locale: es })}`}
            </p>
            {project.budget && <p className="font-barlow text-lg text-[hsl(var(--gold))] font-semibold">${Number(project.budget).toLocaleString()} COP</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumen">
        <TabsList className="font-dm flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="maquinas">Máquinas</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="documentos">Documentos ({projectDocs.length})</TabsTrigger>
          <TabsTrigger value="preops">Preoperacionales</TabsTrigger>
          <TabsTrigger value="ots">Órdenes de Trabajo</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Costo total" value={`$${totalCost.toLocaleString()}`} />
            <StatCard label="OT ejecutadas" value={String(workOrders.length)} />
            <StatCard label="Preoperacionales" value={String(preops.length)} />
            <StatCard label="Días activo" value={String(daysActive)} />
          </div>
        </TabsContent>

        <TabsContent value="maquinas">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setAssignMachineOpen(true)} className="gap-1.5" size="sm">+ Asignar máquina</Button>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow className="bg-secondary">
                {['Máquina', 'Código', 'Tipo', 'Horómetro', 'Desde', 'Acciones'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {machines.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-dm">Sin máquinas asignadas</TableCell></TableRow>}
                {machines.map((pm: any) => (
                  <TableRow key={pm.id} className="h-[44px]">
                    <TableCell className="font-dm text-sm font-medium flex items-center gap-2">
                      {pm.machines?.status && <StatusIndicator status={pm.machines.status as MachineStatus} />}
                      {pm.machines?.name || '—'}
                    </TableCell>
                    <TableCell className="font-dm text-sm text-muted-foreground">{pm.machines?.internal_code}</TableCell>
                    <TableCell><StatusBadge status={pm.machines?.type || ''} /></TableCell>
                    <TableCell className="font-dm text-sm">{Number(pm.machines?.horometer_current || 0).toLocaleString()} h</TableCell>
                    <TableCell className="font-dm text-sm text-muted-foreground">{pm.assigned_date ? format(new Date(pm.assigned_date), 'dd MMM yyyy', { locale: es }) : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => { if (confirm('¿Remover esta máquina del proyecto?')) removeMachineMut.mutate(pm.id); }}>Remover</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="personal">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setAssignPersonOpen(true)} className="gap-1.5" size="sm">+ Asignar persona</Button>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow className="bg-secondary">
                {['Nombre', 'Tipo', 'Desde', 'Acciones'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {personnel.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground font-dm">Sin personal asignado</TableCell></TableRow>}
                {personnel.map((pp: any) => (
                  <TableRow key={pp.id} className="h-[44px]">
                    <TableCell className="font-dm text-sm font-medium">{pp.personnel?.full_name || '—'}</TableCell>
                    <TableCell><StatusBadge status={pp.personnel?.type || ''} /></TableCell>
                    <TableCell className="font-dm text-sm text-muted-foreground">{pp.start_date ? format(new Date(pp.start_date), 'dd MMM yyyy', { locale: es }) : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => { if (confirm('¿Remover esta persona del proyecto?')) removePersonMut.mutate(pp.id); }}>Remover</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documentos">
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              {projectDocs.length > 0 && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadDocsAsZip(projectDocs, `Proyecto_${project?.name || 'docs'}`)}>
                  <Archive className="h-4 w-4" /> Descargar todo (.zip)
                </Button>
              )}
              <Button size="sm" className="gap-1.5" onClick={() => { setDocName(''); setDocType('otro'); setDocFile(null); setDocModalOpen(true); }}>
                <Upload className="h-4 w-4" /> Subir documento
              </Button>
            </div>
            {projectDocs.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-dm">Sin documentos adjuntos</p>
                <p className="text-xs text-muted-foreground font-dm mt-1">Sube PDFs, Excel, Word y más</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader><TableRow className="bg-secondary">
                    <TableHead className="text-[11px] uppercase font-dm">Nombre</TableHead>
                    <TableHead className="text-[11px] uppercase font-dm">Tipo</TableHead>
                    <TableHead className="text-[11px] uppercase font-dm">Fecha</TableHead>
                    <TableHead className="text-[11px] uppercase font-dm w-[100px]">Acciones</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {projectDocs.map((doc: any) => (
                      <TableRow key={doc.id} className="h-[44px]">
                        <TableCell className="font-dm text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" /> {doc.name}
                        </TableCell>
                        <TableCell className="font-dm text-xs text-muted-foreground capitalize">{doc.doc_type || 'otro'}</TableCell>
                        <TableCell className="font-dm text-sm text-muted-foreground">
                          {doc.uploaded_at ? format(new Date(doc.uploaded_at), 'dd MMM yyyy', { locale: es }) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {doc.file_url && (
                              <>
                                <PreviewButton url={doc.file_url} name={doc.name} />
                                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                  <a href={doc.file_url} download={doc.name} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a>
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDocTarget(doc)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="preops">
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow className="bg-secondary">
                {['Fecha', 'Operario', 'Máquina', 'Tipo', 'Horómetro', 'Críticos'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {preops.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-dm">Sin preoperacionales</TableCell></TableRow>}
                {preops.map((r: any) => (
                  <TableRow key={r.id} className="h-[44px]">
                    <TableCell className="font-dm text-sm">{r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy', { locale: es }) : '—'}</TableCell>
                    <TableCell className="font-dm text-sm">{r.personnel?.full_name || '—'}</TableCell>
                    <TableCell className="font-dm text-sm">{r.machines?.name || '—'}</TableCell>
                    <TableCell><StatusBadge status={r.record_type} /></TableCell>
                    <TableCell className="font-dm text-sm">{Number(r.horometer_value).toLocaleString()} h</TableCell>
                    <TableCell>{r.critical_failures_count > 0 ? <span className="inline-flex items-center rounded-[20px] px-2 py-0.5 text-[11px] font-semibold bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))]">⚠️ {r.critical_failures_count}</span> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="ots">
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow className="bg-secondary">
                {['Código', 'Máquina', 'Tipo', 'Prioridad', 'Estado', 'Costo'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {workOrders.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-dm">Sin órdenes de trabajo</TableCell></TableRow>}
                {workOrders.map((ot: any) => (
                  <TableRow key={ot.id} className="h-[44px]">
                    <TableCell className="font-dm text-sm font-medium text-[hsl(var(--gold))]">{ot.code}</TableCell>
                    <TableCell className="font-dm text-sm">{ot.machines?.name || '—'}</TableCell>
                    <TableCell><StatusBadge status={ot.type} /></TableCell>
                    <TableCell><StatusBadge status={ot.priority || 'normal'} /></TableCell>
                    <TableCell><StatusBadge status={ot.status || 'creada'} /></TableCell>
                    <TableCell className="font-dm text-sm">${Number(ot.total_cost || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="costos">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total gastado" value={`$${totalCost.toLocaleString()}`} />
            <StatCard label="% del presupuesto" value={project.budget ? `${budgetPct.toFixed(1)}%` : '—'} />
            <StatCard label="Promedio mensual" value={costs.length > 0 ? `$${Math.round(totalCost / Math.max(1, new Set(costs.map((c: any) => c.cost_date?.substring(0, 7))).size)).toLocaleString()}` : '—'} />
          </div>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow className="bg-secondary">
                {['Fecha', 'Tipo', 'Descripción', 'Fuente', 'Monto'].map((h) => <TableHead key={h} className="text-[11px] uppercase font-dm">{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {costs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-dm">Sin costos registrados</TableCell></TableRow>}
                {costs.map((c: any) => (
                  <TableRow key={c.id} className="h-[44px]">
                    <TableCell className="font-dm text-sm">{c.cost_date ? format(new Date(c.cost_date), 'dd MMM yyyy', { locale: es }) : '—'}</TableCell>
                    <TableCell><StatusBadge status={c.cost_type} /></TableCell>
                    <TableCell className="font-dm text-sm text-muted-foreground">{c.description || '—'}</TableCell>
                    <TableCell className="font-dm text-sm text-muted-foreground">{c.source}</TableCell>
                    <TableCell className="font-dm text-sm font-medium">${Number(c.amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Assign Machine Dialog */}
      <Dialog open={assignMachineOpen} onOpenChange={setAssignMachineOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow">Asignar máquina</DialogTitle>
            <DialogDescription className="font-dm text-sm text-muted-foreground">Selecciona una máquina disponible</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="font-dm text-xs">Máquina</Label>
            <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
              <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {availableMachines.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.internal_code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignMachineOpen(false)}>Cancelar</Button>
            <Button onClick={() => assignMachineMut.mutate()} disabled={!selectedMachineId || assignMachineMut.isPending}>Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Person Dialog */}
      <Dialog open={assignPersonOpen} onOpenChange={setAssignPersonOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-barlow">Asignar persona</DialogTitle>
            <DialogDescription className="font-dm text-sm text-muted-foreground">Selecciona personal activo</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="font-dm text-xs">Persona</Label>
            <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
              <SelectTrigger className="h-10 rounded-lg font-dm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {availablePersonnel.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.type})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignPersonOpen(false)}>Cancelar</Button>
            <Button onClick={() => assignPersonMut.mutate()} disabled={!selectedPersonId || assignPersonMut.isPending}>Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
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
                  {['Contrato', 'Acta', 'Plano', 'Informe', 'Factura', 'Otro'].map(t => <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-dm text-xs">Archivo *</Label>
              <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="h-10 rounded-lg font-dm"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.ppt,.pptx,.txt,.zip,.rar" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleUploadDoc} disabled={uploading || !docFile || !docName}>
              {uploading ? 'Subiendo...' : 'Subir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Doc Confirm */}
      <AlertDialog open={!!deleteDocTarget} onOpenChange={(v) => !v && setDeleteDocTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-barlow">¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription className="font-dm">Se eliminará el archivo del almacenamiento.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); handleDeleteDoc(); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
