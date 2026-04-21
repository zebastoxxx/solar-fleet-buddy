import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PreviewButton } from '@/components/ui/DocumentPreview';
import { ArrowLeft, Edit, Plus, ChevronDown, FileDown, Upload, Camera, Archive, Download, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { downloadDocsAsZip } from '@/lib/download-docs-zip';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useMachine, useMachineConditions, useMachineOTs, useMachinePreops,
  useMachineKits, useMachineProjects, useMachineDocuments, useMachineCosts,
  useMachineAlerts, useUpdateMachineStatus, useMachineFinancials,
  useUpdateMachine, useUploadMachineDocument, useDeleteMachineDocument,
} from '@/hooks/useMachineDetail';
import { EditMachineModal } from '@/components/machines/EditMachineModal';
import { MachinePhotoUpload } from '@/components/machines/MachinePhotoUpload';
import { generateMachineReportPDF, downloadPDF } from '@/lib/pdf-generator';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { Database } from '@/integrations/supabase/types';

type MachineStatus = Database['public']['Enums']['machine_status'];

const STATUS_OPTIONS: { value: MachineStatus; label: string }[] = [
  { value: 'activa_en_campo', label: 'Activa en campo' },
  { value: 'disponible_bodega', label: 'Disponible bodega' },
  { value: 'en_campo_dañada', label: 'En campo dañada' },
  { value: 'varada_bodega', label: 'Varada bodega' },
];

const TYPE_LABELS: Record<string, string> = {
  telehandler: 'Telehandler', manlift: 'Manlift', tijera: 'Tijera', hincadora: 'Hincadora',
  minicargador: 'Minicargador', retroexcavadora: 'Retroexcavadora', camion_grua: 'Camión Grúa', otro: 'Otro',
};

const OT_TYPE_COLORS: Record<string, string> = {
  preventivo: '#3B82F6', correctivo: '#EF4444', inspeccion: '#22C55E', preparacion: '#F59E0B',
};

function conditionBadge(pct: number) {
  if (pct >= 80) return <span className="text-[11px] font-semibold text-success font-dm">Excelente</span>;
  if (pct >= 50) return <span className="text-[11px] font-semibold text-warning font-dm">Regular</span>;
  return <span className="text-[11px] font-semibold text-danger font-dm">Crítico</span>;
}

export default function MaquinaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const machine = useMachine(id!);
  const conditions = useMachineConditions(id!);
  const ots = useMachineOTs(id!);
  const preops = useMachinePreops(id!);
  const kits = useMachineKits(id!);
  const projects = useMachineProjects(id!);
  const docs = useMachineDocuments(id!);
  const costs = useMachineCosts(id!);
  const alerts = useMachineAlerts(id!);
  const financials = useMachineFinancials(id!);
  const updateStatus = useUpdateMachineStatus();
  const updateMachine = useUpdateMachine();
  const uploadDoc = useUploadMachineDocument();
  const deleteDoc = useDeleteMachineDocument();

  const [showEdit, setShowEdit] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docForm, setDocForm] = useState({ name: '', doc_type: 'otro', expiry_date: '' });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<{ id: string; name: string; file_url: string } | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const canManageDocs = !!user && ['superadmin', 'gerente', 'supervisor'].includes(user.role);

  const m = machine.data;

  const handleStatusChange = async (status: MachineStatus) => {
    try {
      await updateStatus.mutateAsync({ id: id!, status });
      toast({ title: `Estado actualizado a ${STATUS_OPTIONS.find(s => s.value === status)?.label}` });
    } catch {
      toast({ title: 'Error al cambiar estado', variant: 'destructive' });
    }
  };

  const resolveAlert = async (alertId: string) => {
    await supabase.from('alerts').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', alertId);
    alerts.refetch();
    toast({ title: 'Alerta resuelta' });
  };

  const handleDownloadPDF = async () => {
    if (!m) return;
    try {
      const blob = await generateMachineReportPDF({
        machine: m, conditions: conditions.data ?? [], ots: ots.data ?? [],
        financials: financials.data,
      });
      downloadPDF(blob, `Hoja_de_Vida_${m.internal_code}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast({ title: '📄 Hoja de vida descargada' });
    } catch {
      toast({ title: 'Error al generar PDF', variant: 'destructive' });
    }
  };

  const handleInlineEdit = async (field: string, value: string) => {
    try {
      const parsed = ['weight_kg', 'horometer_current', 'year'].includes(field)
        ? (Number(value) || null) : (value || null);
      await updateMachine.mutateAsync({ id: id!, updates: { [field]: parsed } });
      machine.refetch();
      toast({ title: 'Campo actualizado' });
    } catch {
      toast({ title: 'Error al actualizar', variant: 'destructive' });
    }
    setEditingField(null);
  };

  const handleDocSubmit = async () => {
    if (!docFile || !docForm.name) { toast({ title: 'Completa nombre y archivo', variant: 'destructive' }); return; }
    try {
      await uploadDoc.mutateAsync({
        machineId: id!, file: docFile, name: docForm.name,
        docType: docForm.doc_type, expiryDate: docForm.expiry_date || undefined,
      });
      toast({ title: '✓ Documento subido' });
      setShowDocUpload(false); setDocFile(null); setDocForm({ name: '', doc_type: 'otro', expiry_date: '' });
    } catch (err: any) {
      toast({ title: 'Error al subir', description: err.message, variant: 'destructive' });
    }
  };

  if (machine.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>;
  }

  if (!m) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground font-dm">Máquina no encontrada</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/maquinas')}>← Volver</Button>
      </div>
    );
  }

  // Financial data
  const fin = financials.data;
  const totalIncome = Number(fin?.total_income ?? 0);
  const totalExpenses = Number(fin?.total_expenses ?? 0);
  const profit = Number(fin?.profit ?? 0);
  const margin = Number(fin?.profit_margin_pct ?? 0);

  // Cost chart - split by income/expense
  const costChartData = (() => {
    if (!costs.data?.length) return [];
    const grouped: Record<string, { month: string; ingresos: number; gastos: number }> = {};
    costs.data.forEach((c) => {
      const month = format(new Date(c.cost_date), 'MMM yy', { locale: es });
      if (!grouped[month]) grouped[month] = { month, ingresos: 0, gastos: 0 };
      if (c.entry_type === 'ingreso') grouped[month].ingresos += Number(c.amount);
      else grouped[month].gastos += Number(c.amount);
    });
    return Object.values(grouped);
  })();

  const profitRecommendation = () => {
    if (!fin) return null;
    if (margin < 0) return <span className="text-danger font-semibold text-sm font-dm">⚠️ Evaluar venta del equipo — Margen negativo</span>;
    if (margin < 15) return <span className="text-warning font-semibold text-sm font-dm">🔧 Requiere optimización — Margen bajo ({margin.toFixed(1)}%)</span>;
    return <span className="text-success font-semibold text-sm font-dm">✅ Equipo rentable — Margen {margin.toFixed(1)}%</span>;
  };

  // Editable field component
  const EditableField = ({ label, field, value, type = 'text' }: { label: string; field: string; value: any; type?: string }) => {
    if (editingField === field) {
      return (
        <div>
          <p className="text-[11px] uppercase text-muted-foreground font-dm">{label}</p>
          <Input
            autoFocus
            type={type}
            defaultValue={editValue}
            className="h-8 text-sm"
            onBlur={(e) => handleInlineEdit(field, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleInlineEdit(field, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingField(null); }}
          />
        </div>
      );
    }
    return (
      <div
        className="cursor-pointer hover:bg-muted/50 rounded-md px-1 -mx-1 py-0.5 transition-colors"
        onClick={() => { setEditingField(field); setEditValue(String(value ?? '')); }}
      >
        <p className="text-[11px] uppercase text-muted-foreground font-dm">{label}</p>
        <p className="text-sm font-dm text-foreground">{value ?? '—'}</p>
      </div>
    );
  };

  const allConditionsOptimal = conditions.data?.length ? conditions.data.every((c) => (c.condition_pct ?? 0) >= 90) : false;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/maquinas')} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Máquinas
      </Button>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <MachinePhotoUpload
            currentUrl={m.cover_photo_url}
            machineId={m.id}
            onUrlChange={() => machine.refetch()}
            className="w-full md:w-[200px] shrink-0"
            size="md"
          />

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <StatusIndicator status={m.status as MachineStatus} showLabel />
              <span className="text-[11px] font-semibold uppercase text-muted-foreground font-dm bg-muted px-2 py-0.5 rounded-md">
                {TYPE_LABELS[m.type] ?? m.type}
              </span>
            </div>
            <h2 className="font-barlow text-[28px] font-bold text-foreground">{m.name}</h2>
            <p className="text-sm text-muted-foreground font-dm">{m.internal_code} | {m.brand ?? ''} {m.model ?? ''} {m.year ?? ''}</p>
            <div className="mt-3">
              <p className="font-barlow text-[36px] font-bold text-primary">{Number(m.horometer_current ?? 0).toLocaleString()} h</p>
              <p className="text-[11px] text-muted-foreground font-dm uppercase tracking-wider">horas operadas</p>
            </div>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowEdit(true)}>
              <Edit className="h-4 w-4" /> Editar
            </Button>
            <Button size="sm" className="gap-1" onClick={() => navigate(`/ordenes-trabajo?machine=${id}`)}>
              <Plus className="h-4 w-4" /> Nueva OT
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">Cambiar estado <ChevronDown className="h-3 w-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s.value} onClick={() => handleStatusChange(s.value)} disabled={m.status === s.value}>{s.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleDownloadPDF}>
              <FileDown className="h-4 w-4" /> Hoja de Vida
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ficha" className="space-y-4">
        <TabsList className="bg-card border border-border h-auto flex-wrap overflow-x-auto w-full">
          <TabsTrigger value="ficha" className="font-dm text-xs">Ficha Técnica</TabsTrigger>
          <TabsTrigger value="ot" className="font-dm text-xs">Historial OT</TabsTrigger>
          <TabsTrigger value="preop" className="font-dm text-xs">Preoperacionales</TabsTrigger>
          <TabsTrigger value="inventario" className="font-dm text-xs">Inventario</TabsTrigger>
          <TabsTrigger value="proyectos" className="font-dm text-xs">Proyectos</TabsTrigger>
          <TabsTrigger value="docs" className="font-dm text-xs">Documentos</TabsTrigger>
          <TabsTrigger value="financiero" className="font-dm text-xs">Financiero</TabsTrigger>
          <TabsTrigger value="alertas" className="font-dm text-xs">Alertas</TabsTrigger>
        </TabsList>

        {/* Ficha Técnica — Editable */}
        <TabsContent value="ficha">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <EditableField label="Marca" field="brand" value={m.brand} />
              <EditableField label="Modelo" field="model" value={m.model} />
              <EditableField label="Año" field="year" value={m.year} type="number" />
              <EditableField label="Nº Serie" field="serial_number" value={m.serial_number} />
              <EditableField label="Tipo" field="type" value={TYPE_LABELS[m.type] ?? m.type} />
              <EditableField label="Peso (kg)" field="weight_kg" value={m.weight_kg} type="number" />
              <EditableField label="Capacidad máx." field="max_capacity" value={m.max_capacity} />
              <EditableField label="Altura máx." field="max_height" value={(m as any).max_height} />
              <EditableField label="Motor" field="engine_model" value={(m as any).engine_model} />
              <EditableField label="Combustible" field="fuel_type" value={(m as any).fuel_type} />
              <EditableField label="Placa" field="plate_number" value={(m as any).plate_number} />
            </div>
            {m.notes && (
              <div><p className="text-[11px] uppercase text-muted-foreground font-dm mb-1">Notas</p><p className="text-sm font-dm text-foreground">{m.notes}</p></div>
            )}

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-barlow text-sm font-semibold uppercase text-muted-foreground">Condición del equipo</h3>
                {allConditionsOptimal && <span className="text-[11px] font-semibold text-success bg-success-bg px-2 py-0.5 rounded-full font-dm">En óptimas condiciones ✓</span>}
              </div>
              {conditions.isLoading ? <Skeleton className="h-32" /> : !conditions.data?.length ? (
                <p className="text-sm text-muted-foreground font-dm">Sin datos de condición registrados</p>
              ) : (
                <div className="space-y-3">
                  {conditions.data.map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <p className="w-40 text-sm font-dm text-foreground">{c.item_name}</p>
                      <div className="flex-1"><Slider value={[c.condition_pct ?? 0]} max={100} step={1} disabled className="pointer-events-none" /></div>
                      <span className="w-10 text-right text-sm font-dm font-semibold">{c.condition_pct ?? 0}%</span>
                      {conditionBadge(c.condition_pct ?? 0)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Historial OT */}
        <TabsContent value="ot">
          <div className="rounded-xl border border-border bg-card p-6">
            {ots.isLoading ? <Skeleton className="h-48" /> : !ots.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin órdenes de trabajo registradas</p>
            ) : (
              <div className="relative border-l-2 border-border ml-4 space-y-4">
                {ots.data.map((ot) => (
                  <div key={ot.id} className="relative pl-6">
                    <div className="absolute -left-[9px] top-2 h-4 w-4 rounded-full border-2 border-card" style={{ backgroundColor: OT_TYPE_COLORS[ot.type] ?? '#888' }} />
                    <div className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-barlow text-sm font-semibold text-primary">{ot.code}</span>
                        <StatusBadge status={ot.status ?? 'creada'} />
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-dm">
                        <span className="capitalize">{ot.type}</span>
                        {ot.actual_hours ? <span>· {Number(ot.actual_hours)}h</span> : null}
                        {ot.total_cost ? <span>· ${Number(ot.total_cost).toLocaleString()}</span> : null}
                      </div>
                      {ot.problem_description && <p className="text-[12px] text-muted-foreground font-dm mt-1 line-clamp-2">{ot.problem_description}</p>}
                      <p className="text-[11px] text-muted-foreground font-dm mt-1">{ot.created_at ? format(new Date(ot.created_at), 'dd MMM yyyy', { locale: es }) : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Preoperacionales */}
        <TabsContent value="preop">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {preops.isLoading ? <Skeleton className="h-48 m-4" /> : !preops.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin preoperacionales registrados</p>
            ) : (
              <table className="w-full">
                <thead><tr className="bg-muted">{['Fecha', 'Operario', 'Tipo', 'Horómetro', 'Críticos', 'Estado'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-dm">{h}</th>
                ))}</tr></thead>
                <tbody>{preops.data.map((p) => (
                  <tr key={p.id} className="h-[44px] border-t border-border hover:bg-primary/[0.04]">
                    <td className="px-3 text-sm font-dm">{p.created_at ? format(new Date(p.created_at), 'dd/MM/yy HH:mm') : ''}</td>
                    <td className="px-3 text-sm font-dm">{(p as any).personnel?.full_name ?? '—'}</td>
                    <td className="px-3"><StatusBadge status={p.record_type === 'inicio' ? 'activo' : 'cerrada'} /></td>
                    <td className="px-3 text-sm font-dm">{Number(p.horometer_value).toLocaleString()} h</td>
                    <td className="px-3">{(p.critical_failures_count ?? 0) > 0 ? <span className="text-[11px] font-semibold text-danger bg-danger-bg px-2 py-0.5 rounded-full">⚠️ {p.critical_failures_count}</span> : <span className="text-[11px] text-muted-foreground font-dm">0</span>}</td>
                    <td className="px-3">{p.has_critical_failures ? <StatusBadge status="fuera_servicio" /> : <StatusBadge status="operativo" />}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Inventario */}
        <TabsContent value="inventario">
          <div className="rounded-xl border border-border bg-card p-6">
            {kits.isLoading ? <Skeleton className="h-32" /> : !kits.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin kit de emergencia asignado</p>
            ) : (
              <div className="space-y-3">{kits.data.map((k) => (
                <div key={k.id} className="rounded-lg border border-border p-4">
                  <p className="font-barlow text-sm font-semibold">{k.name}</p>
                  <p className="text-[11px] text-muted-foreground font-dm">Estado: {k.status}</p>
                  <p className="text-[11px] text-muted-foreground font-dm mt-1">{(k as any).inventory_kit_items?.length ?? 0} ítems</p>
                </div>
              ))}</div>
            )}
          </div>
        </TabsContent>

        {/* Proyectos */}
        <TabsContent value="proyectos">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {projects.isLoading ? <Skeleton className="h-32 m-4" /> : !projects.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin proyectos asociados</p>
            ) : (
              <table className="w-full">
                <thead><tr className="bg-muted">{['Proyecto', 'Cliente', 'Asignación', 'Remoción', 'Estado'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-dm">{h}</th>
                ))}</tr></thead>
                <tbody>{projects.data.map((pm) => (
                  <tr key={pm.id} className="h-[44px] border-t border-border hover:bg-primary/[0.04]">
                    <td className="px-3 text-sm font-dm">{(pm as any).projects?.name ?? '—'}</td>
                    <td className="px-3 text-sm font-dm">{(pm as any).projects?.clients?.name ?? '—'}</td>
                    <td className="px-3 text-sm font-dm">{pm.assigned_date ?? '—'}</td>
                    <td className="px-3 text-sm font-dm">{pm.removed_date ?? '—'}</td>
                    <td className="px-3"><StatusBadge status={(pm as any).projects?.status ?? 'activo'} /></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="docs">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-barlow text-sm font-semibold">Documentos</h3>
              <div className="flex gap-2">
                {docs.data && docs.data.length > 0 && (
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => downloadDocsAsZip(docs.data!, `Maquina_${machine.data?.internal_code || ''}_${machine.data?.name || 'docs'}`)}>
                    <Archive className="h-3 w-3" /> Descargar todo (.zip)
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowDocUpload(true)}>
                  <Upload className="h-3 w-3" /> Subir documento
                </Button>
              </div>
            </div>
            {docs.isLoading ? <Skeleton className="h-32" /> : !docs.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin documentos cargados</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docs.data.map((doc) => {
                  const daysToExpiry = doc.expiry_date ? differenceInDays(new Date(doc.expiry_date), new Date()) : null;
                  return (
                    <div key={doc.id} className="rounded-lg border border-border p-4 hover:border-primary/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-dm font-semibold">{doc.name}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground font-dm">{doc.doc_type ?? 'otro'}</span>
                          <PreviewButton url={doc.file_url} name={doc.name} />
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={doc.file_url} download={doc.name} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a>
                          </Button>
                          {canManageDocs && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-danger hover:text-danger hover:bg-danger-bg"
                              onClick={() => setDeleteDocTarget({ id: doc.id, name: doc.name, file_url: doc.file_url })}
                              title="Eliminar documento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {daysToExpiry !== null && (
                        <span className={`text-[11px] font-semibold font-dm px-2 py-0.5 rounded-full ${daysToExpiry < 0 ? 'bg-danger-bg text-danger' : daysToExpiry <= 30 ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success'}`}>
                          {daysToExpiry < 0 ? 'Vencido' : daysToExpiry <= 30 ? `Vence en ${daysToExpiry} días` : 'Vigente'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Financiero */}
        <TabsContent value="financiero">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center"><p className="text-[11px] uppercase text-muted-foreground font-dm">Ingresos</p><p className="font-barlow text-xl font-bold text-success">${totalIncome.toLocaleString()}</p></div>
              <div className="text-center"><p className="text-[11px] uppercase text-muted-foreground font-dm">Gastos</p><p className="font-barlow text-xl font-bold text-danger">${totalExpenses.toLocaleString()}</p></div>
              <div className="text-center"><p className="text-[11px] uppercase text-muted-foreground font-dm">Utilidad</p><p className={`font-barlow text-xl font-bold ${profit >= 0 ? 'text-success' : 'text-danger'}`}>${profit.toLocaleString()}</p></div>
              <div className="text-center"><p className="text-[11px] uppercase text-muted-foreground font-dm">Margen</p><p className={`font-barlow text-xl font-bold ${margin >= 15 ? 'text-success' : margin >= 0 ? 'text-warning' : 'text-danger'}`}>{margin.toFixed(1)}%</p></div>
            </div>

            {/* Recommendation */}
            <div className="rounded-lg border border-border p-3 text-center">{profitRecommendation() || <span className="text-muted-foreground text-sm font-dm">Sin datos financieros</span>}</div>

            {/* Chart */}
            {costChartData.length > 0 && (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costChartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: 'DM Sans' }} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#22C55E" />
                    <Bar dataKey="gastos" name="Gastos" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Alertas */}
        <TabsContent value="alertas">
          <div className="rounded-xl border border-border bg-card p-6">
            {alerts.isLoading ? <Skeleton className="h-32" /> : !alerts.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin alertas registradas</p>
            ) : (
              <div className="space-y-2">
                {alerts.data.filter((a) => !a.resolved).map((a) => (
                  <div key={a.id} className={`flex items-center justify-between rounded-lg border-l-4 p-3 ${a.severity === 'critical' ? 'border-l-danger bg-danger-bg' : a.severity === 'warning' ? 'border-l-warning bg-warning-bg' : 'border-l-blue-500 bg-blue-50'}`}>
                    <div>
                      <p className="text-sm font-dm font-medium">{a.message}</p>
                      <p className="text-[11px] text-muted-foreground font-dm">{a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es }) : ''}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => resolveAlert(a.id)}>Resolver</Button>
                  </div>
                ))}
                {alerts.data.filter((a) => a.resolved).length > 0 && (
                  <details className="mt-4">
                    <summary className="text-[12px] text-muted-foreground font-dm cursor-pointer">Alertas resueltas ({alerts.data.filter(a => a.resolved).length})</summary>
                    <div className="space-y-2 mt-2">{alerts.data.filter((a) => a.resolved).map((a) => (
                      <div key={a.id} className="rounded-lg border border-border p-3 opacity-60">
                        <p className="text-sm font-dm">{a.message}</p>
                        <p className="text-[11px] text-muted-foreground font-dm">Resuelto {a.resolved_at ? formatDistanceToNow(new Date(a.resolved_at), { addSuffix: true, locale: es }) : ''}</p>
                      </div>
                    ))}</div>
                  </details>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      {showEdit && <EditMachineModal open={showEdit} onClose={() => { setShowEdit(false); machine.refetch(); }} machine={m} />}

      {/* Document Upload Dialog */}
      <Dialog open={showDocUpload} onOpenChange={setShowDocUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-barlow">Subir Documento</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label className="font-dm text-xs">Nombre *</Label><Input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} /></div>
            <div><Label className="font-dm text-xs">Tipo</Label>
              <Select value={docForm.doc_type} onValueChange={(v) => setDocForm({ ...docForm, doc_type: v })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['SOAT', 'Tecnomecánica', 'Póliza', 'Manual', 'Foto', 'Otro'].map((t) => <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="font-dm text-xs">Fecha vencimiento</Label><Input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })} /></div>
            <div><Label className="font-dm text-xs">Archivo *</Label><Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocUpload(false)}>Cancelar</Button>
            <Button onClick={handleDocSubmit} disabled={uploadDoc.isPending}>{uploadDoc.isPending ? 'Subiendo...' : 'Subir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete document confirmation */}
      {deleteDocTarget && (
        <ConfirmDialog
          open={!!deleteDocTarget}
          onClose={() => setDeleteDocTarget(null)}
          title="Eliminar documento"
          message={`¿Seguro que deseas eliminar "${deleteDocTarget.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          isLoading={deleteDoc.isPending}
          onConfirm={async () => {
            try {
              await deleteDoc.mutateAsync({ id: deleteDocTarget.id, fileUrl: deleteDocTarget.file_url });
              toast({ title: '✓ Documento eliminado' });
              setDeleteDocTarget(null);
            } catch (err: any) {
              toast({ title: 'Error', description: err?.message ?? 'No se pudo eliminar', variant: 'destructive' });
            }
          }}
        />
      )}
    </div>
  );
}
