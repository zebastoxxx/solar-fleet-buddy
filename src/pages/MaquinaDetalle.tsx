import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Plus, ChevronDown } from 'lucide-react';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  useMachine,
  useMachineConditions,
  useMachineOTs,
  useMachinePreops,
  useMachineKits,
  useMachineProjects,
  useMachineDocuments,
  useMachineCosts,
  useMachineAlerts,
  useUpdateMachineStatus,
} from '@/hooks/useMachineDetail';
import { supabase } from '@/integrations/supabase/client';
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
  const machine = useMachine(id!);
  const conditions = useMachineConditions(id!);
  const ots = useMachineOTs(id!);
  const preops = useMachinePreops(id!);
  const kits = useMachineKits(id!);
  const projects = useMachineProjects(id!);
  const docs = useMachineDocuments(id!);
  const costs = useMachineCosts(id!);
  const alerts = useMachineAlerts(id!);
  const updateStatus = useUpdateMachineStatus();

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

  // Cost chart data
  const costChartData = (() => {
    if (!costs.data?.length) return [];
    const grouped: Record<string, Record<string, number>> = {};
    costs.data.forEach((c) => {
      const month = format(new Date(c.cost_date), 'MMM yy', { locale: es });
      if (!grouped[month]) grouped[month] = { month, materiales: 0, mano_obra: 0, externo: 0, consumibles: 0 } as any;
      const key = c.cost_type === 'labor' ? 'mano_obra' : c.cost_type === 'external' ? 'externo' : c.cost_type === 'consumable' ? 'consumibles' : 'materiales';
      grouped[month][key] = (grouped[month][key] || 0) + Number(c.amount);
    });
    return Object.values(grouped);
  })();

  const allConditionsOptimal = conditions.data?.length ? conditions.data.every((c) => (c.condition_pct ?? 0) >= 90) : false;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/maquinas')} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Máquinas
      </Button>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Photo placeholder */}
          <div className="w-full md:w-[200px] h-[160px] rounded-xl bg-muted flex items-center justify-center shrink-0">
            <span className="text-5xl opacity-30">🏗️</span>
          </div>

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
              <p className="font-barlow text-[36px] font-bold text-gold">{Number(m.horometer_current ?? 0).toLocaleString()} h</p>
              <p className="text-[11px] text-muted-foreground font-dm uppercase tracking-wider">horas operadas</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1"><Edit className="h-4 w-4" /> Editar</Button>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nueva OT</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">Cambiar estado <ChevronDown className="h-3 w-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s.value} onClick={() => handleStatusChange(s.value)} disabled={m.status === s.value}>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ficha" className="space-y-4">
        <TabsList className="bg-card border border-border h-auto flex-wrap">
          <TabsTrigger value="ficha" className="font-dm text-xs">Ficha Técnica</TabsTrigger>
          <TabsTrigger value="ot" className="font-dm text-xs">Historial OT</TabsTrigger>
          <TabsTrigger value="preop" className="font-dm text-xs">Preoperacionales</TabsTrigger>
          <TabsTrigger value="inventario" className="font-dm text-xs">Inventario</TabsTrigger>
          <TabsTrigger value="proyectos" className="font-dm text-xs">Proyectos</TabsTrigger>
          <TabsTrigger value="docs" className="font-dm text-xs">Documentos</TabsTrigger>
          <TabsTrigger value="costos" className="font-dm text-xs">Costos</TabsTrigger>
          <TabsTrigger value="alertas" className="font-dm text-xs">Alertas</TabsTrigger>
        </TabsList>

        {/* Tab 1 — Ficha Técnica */}
        <TabsContent value="ficha">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                ['Marca', m.brand],
                ['Modelo', m.model],
                ['Año', m.year],
                ['Nº Serie', m.serial_number],
                ['Tipo', TYPE_LABELS[m.type] ?? m.type],
                ['Peso (kg)', m.weight_kg],
                ['Capacidad máx.', m.max_capacity],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-[11px] uppercase text-muted-foreground font-dm">{label as string}</p>
                  <p className="text-sm font-dm text-foreground">{val ?? '—'}</p>
                </div>
              ))}
            </div>
            {m.notes && (
              <div>
                <p className="text-[11px] uppercase text-muted-foreground font-dm mb-1">Notas</p>
                <p className="text-sm font-dm text-foreground">{m.notes}</p>
              </div>
            )}

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-barlow text-sm font-semibold uppercase text-muted-foreground">Condición del equipo</h3>
                {allConditionsOptimal && (
                  <span className="text-[11px] font-semibold text-success bg-success-bg px-2 py-0.5 rounded-full font-dm">En óptimas condiciones ✓</span>
                )}
              </div>
              {conditions.isLoading ? (
                <Skeleton className="h-32" />
              ) : !conditions.data?.length ? (
                <p className="text-sm text-muted-foreground font-dm">Sin datos de condición registrados</p>
              ) : (
                <div className="space-y-3">
                  {conditions.data.map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <p className="w-40 text-sm font-dm text-foreground">{c.item_name}</p>
                      <div className="flex-1">
                        <Slider value={[c.condition_pct ?? 0]} max={100} step={1} disabled className="pointer-events-none" />
                      </div>
                      <span className="w-10 text-right text-sm font-dm font-semibold">{c.condition_pct ?? 0}%</span>
                      {conditionBadge(c.condition_pct ?? 0)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2 — Historial OT */}
        <TabsContent value="ot">
          <div className="rounded-xl border border-border bg-card p-6">
            {ots.isLoading ? <Skeleton className="h-48" /> : !ots.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin órdenes de trabajo registradas</p>
            ) : (
              <div className="relative border-l-2 border-border ml-4 space-y-4">
                {ots.data.map((ot) => (
                  <div key={ot.id} className="relative pl-6">
                    <div
                      className="absolute -left-[9px] top-2 h-4 w-4 rounded-full border-2 border-card"
                      style={{ backgroundColor: OT_TYPE_COLORS[ot.type] ?? '#888' }}
                    />
                    <div className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-barlow text-sm font-semibold text-gold">{ot.code}</span>
                        <StatusBadge status={ot.status ?? 'creada'} />
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-dm">
                        <span className="capitalize">{ot.type}</span>
                        {ot.actual_hours ? <span>· {Number(ot.actual_hours)}h</span> : null}
                        {ot.total_cost ? <span>· ${Number(ot.total_cost).toLocaleString()}</span> : null}
                      </div>
                      {ot.problem_description && (
                        <p className="text-[12px] text-muted-foreground font-dm mt-1 line-clamp-2">{ot.problem_description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground font-dm mt-1">
                        {ot.created_at ? format(new Date(ot.created_at), 'dd MMM yyyy', { locale: es }) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3 — Preoperacionales */}
        <TabsContent value="preop">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {preops.isLoading ? <Skeleton className="h-48 m-4" /> : !preops.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin preoperacionales registrados</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    {['Fecha', 'Operario', 'Tipo', 'Horómetro', 'Críticos', 'Estado'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-dm">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preops.data.map((p) => (
                    <tr key={p.id} className="h-[44px] border-t border-border hover:bg-gold/[0.04]">
                      <td className="px-3 text-sm font-dm">{p.created_at ? format(new Date(p.created_at), 'dd/MM/yy HH:mm') : ''}</td>
                      <td className="px-3 text-sm font-dm">{(p as any).personnel?.full_name ?? '—'}</td>
                      <td className="px-3"><StatusBadge status={p.record_type === 'inicio' ? 'activo' : 'cerrada'} /></td>
                      <td className="px-3 text-sm font-dm">{Number(p.horometer_value).toLocaleString()} h</td>
                      <td className="px-3">
                        {(p.critical_failures_count ?? 0) > 0 ? (
                          <span className="text-[11px] font-semibold text-danger bg-danger-bg px-2 py-0.5 rounded-full">⚠️ {p.critical_failures_count}</span>
                        ) : <span className="text-[11px] text-muted-foreground font-dm">0</span>}
                      </td>
                      <td className="px-3">{p.has_critical_failures ? <StatusBadge status="fuera_servicio" /> : <StatusBadge status="operativo" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Tab 4 — Inventario */}
        <TabsContent value="inventario">
          <div className="rounded-xl border border-border bg-card p-6">
            {kits.isLoading ? <Skeleton className="h-32" /> : !kits.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin kit de emergencia asignado</p>
            ) : (
              <div className="space-y-3">
                {kits.data.map((k) => (
                  <div key={k.id} className="rounded-lg border border-border p-4">
                    <p className="font-barlow text-sm font-semibold">{k.name}</p>
                    <p className="text-[11px] text-muted-foreground font-dm">Estado: {k.status}</p>
                    <p className="text-[11px] text-muted-foreground font-dm mt-1">{(k as any).inventory_kit_items?.length ?? 0} ítems</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 5 — Proyectos */}
        <TabsContent value="proyectos">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {projects.isLoading ? <Skeleton className="h-32 m-4" /> : !projects.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin proyectos asociados</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    {['Proyecto', 'Cliente', 'Asignación', 'Remoción', 'Estado'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-dm">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.data.map((pm) => (
                    <tr key={pm.id} className="h-[44px] border-t border-border hover:bg-gold/[0.04]">
                      <td className="px-3 text-sm font-dm">{(pm as any).projects?.name ?? '—'}</td>
                      <td className="px-3 text-sm font-dm">{(pm as any).projects?.clients?.name ?? '—'}</td>
                      <td className="px-3 text-sm font-dm">{pm.assigned_date ?? '—'}</td>
                      <td className="px-3 text-sm font-dm">{pm.removed_date ?? '—'}</td>
                      <td className="px-3"><StatusBadge status={(pm as any).projects?.status ?? 'activo'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Tab 6 — Documentos */}
        <TabsContent value="docs">
          <div className="rounded-xl border border-border bg-card p-6">
            {docs.isLoading ? <Skeleton className="h-32" /> : !docs.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin documentos cargados</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docs.data.map((doc) => {
                  const daysToExpiry = doc.expiry_date ? differenceInDays(new Date(doc.expiry_date), new Date()) : null;
                  return (
                    <div key={doc.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-dm font-semibold">{doc.name}</p>
                        <span className="text-[10px] uppercase text-muted-foreground font-dm">{doc.doc_type ?? 'otro'}</span>
                      </div>
                      {daysToExpiry !== null && (
                        <span className={`text-[11px] font-semibold font-dm px-2 py-0.5 rounded-full ${
                          daysToExpiry < 0 ? 'bg-danger-bg text-danger' : daysToExpiry <= 30 ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success'
                        }`}>
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

        {/* Tab 7 — Costos */}
        <TabsContent value="costos">
          <div className="rounded-xl border border-border bg-card p-6">
            {costs.isLoading ? <Skeleton className="h-64" /> : !costChartData.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin datos de costos</p>
            ) : (
              <>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costChartData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                      <YAxis tick={{ fontSize: 11, fontFamily: 'DM Sans' }} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                      <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                      <Bar dataKey="materiales" name="Materiales" fill="#3B82F6" stackId="a" />
                      <Bar dataKey="mano_obra" name="Mano de obra" fill="hsl(36, 79%, 47%)" stackId="a" />
                      <Bar dataKey="externo" name="Externo" fill="#6B7280" stackId="a" />
                      <Bar dataKey="consumibles" name="Consumibles" fill="#F97316" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-[11px] uppercase text-muted-foreground font-dm">Total Acumulado</p>
                    <p className="font-barlow text-xl font-bold">${costs.data?.reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] uppercase text-muted-foreground font-dm">Promedio Mensual</p>
                    <p className="font-barlow text-xl font-bold">
                      ${costChartData.length ? Math.round(costs.data!.reduce((s, c) => s + Number(c.amount), 0) / costChartData.length).toLocaleString() : 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] uppercase text-muted-foreground font-dm">Meses Registrados</p>
                    <p className="font-barlow text-xl font-bold">{costChartData.length}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 8 — Alertas */}
        <TabsContent value="alertas">
          <div className="rounded-xl border border-border bg-card p-6">
            {alerts.isLoading ? <Skeleton className="h-32" /> : !alerts.data?.length ? (
              <p className="text-sm text-muted-foreground font-dm text-center py-8">Sin alertas registradas</p>
            ) : (
              <div className="space-y-2">
                {alerts.data.filter((a) => !a.resolved).map((a) => (
                  <div key={a.id} className={`flex items-center justify-between rounded-lg border-l-4 p-3 ${
                    a.severity === 'critical' ? 'border-l-danger bg-danger-bg' : a.severity === 'warning' ? 'border-l-warning bg-warning-bg' : 'border-l-blue-500 bg-blue-50'
                  }`}>
                    <div>
                      <p className="text-sm font-dm font-medium">{a.message}</p>
                      <p className="text-[11px] text-muted-foreground font-dm">
                        {a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es }) : ''}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => resolveAlert(a.id)}>Resolver</Button>
                  </div>
                ))}
                {alerts.data.filter((a) => a.resolved).length > 0 && (
                  <details className="mt-4">
                    <summary className="text-[12px] text-muted-foreground font-dm cursor-pointer">Alertas resueltas ({alerts.data.filter(a => a.resolved).length})</summary>
                    <div className="space-y-2 mt-2">
                      {alerts.data.filter((a) => a.resolved).map((a) => (
                        <div key={a.id} className="rounded-lg border border-border p-3 opacity-60">
                          <p className="text-sm font-dm">{a.message}</p>
                          <p className="text-[11px] text-muted-foreground font-dm">Resuelto {a.resolved_at ? formatDistanceToNow(new Date(a.resolved_at), { addSuffix: true, locale: es }) : ''}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
