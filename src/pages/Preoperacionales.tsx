import { useState, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { deletePreoperacionales } from '@/lib/cascade-delete';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { AdvancedFilters } from '@/components/ui/AdvancedFilters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Download, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Preoperacionales() {
  usePageTitle('Preoperacionales');
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [projectFilter, setProjectFilter] = useState('todos');
  const [machineFilter, setMachineFilter] = useState('todas');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const { data: records, isLoading } = useQuery({
    queryKey: ['preop-records-supervisor', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('preop_records')
        .select('*, machines(name, internal_code), projects(name), personnel!preop_records_operator_id_fkey(full_name)')
        .eq('tenant_id', user!.tenant_id)
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects-filter', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').eq('tenant_id', user!.tenant_id).eq('status', 'activo').order('name');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: machines } = useQuery({
    queryKey: ['machines-filter', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('machines').select('id, name, internal_code').eq('tenant_id', user!.tenant_id).order('name');
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!records) return [];
    return records.filter((r: any) => {
      const machineName = (r.machines as any)?.name || '';
      const machineCode = (r.machines as any)?.internal_code || '';
      const operatorName = (r.personnel as any)?.full_name || '';
      const projectName = (r.projects as any)?.name || '';
      const q = search.toLowerCase();
      if (q && !machineName.toLowerCase().includes(q) && !operatorName.toLowerCase().includes(q) && !projectName.toLowerCase().includes(q) && !machineCode.toLowerCase().includes(q)) return false;
      if (typeFilter === 'inicio' && r.record_type !== 'inicio') return false;
      if (typeFilter === 'cierre' && r.record_type !== 'cierre') return false;
      if (typeFilter === 'criticos' && !r.has_critical_failures) return false;
      if (projectFilter !== 'todos' && r.project_id !== projectFilter) return false;
      if (machineFilter !== 'todas' && r.machine_id !== machineFilter) return false;
      if (dateFrom && r.created_at && r.created_at < dateFrom) return false;
      if (dateTo && r.created_at && r.created_at > dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [records, search, typeFilter, projectFilter, machineFilter, dateFrom, dateTo]);

  const exportCSV = () => {
    const headers = ['Fecha', 'Operario', 'Máquina', 'Proyecto', 'Tipo', 'Horómetro', 'Críticos', 'Estado'];
    const rows = filtered.map((r: any) => [
      format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      (r.personnel as any)?.full_name || '',
      `[${(r.machines as any)?.internal_code}] ${(r.machines as any)?.name}`,
      (r.projects as any)?.name || '',
      r.record_type,
      r.horometer_value,
      r.critical_failures_count || 0,
      r.machine_status_at_close || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r: any) => r.map((c: any) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `preoperacionales_${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('preop_records').delete().eq('tenant_id', user!.tenant_id).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preop-records-supervisor', user?.tenant_id] });
      toast.success(`${selectedRows.length} registro(s) eliminado(s)`);
      setSelectedRows([]);
      setShowBulkDeleteConfirm(false);
    },
    onError: () => toast.error('Error al eliminar los registros seleccionados'),
  });

  const typeFilters = [
    { label: 'Todos', value: 'todos' },
    { label: 'Solo inicio', value: 'inicio' },
    { label: 'Solo cierre', value: 'cierre' },
    { label: 'Con críticos', value: 'criticos' },
  ];

  const preopColumns: Column<any>[] = [
    { key: 'created_at', label: 'Fecha/Hora', sortable: true, render: (r: any) => <span className="text-xs">{format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: es })}</span> },
    { key: 'personnel.full_name', label: 'Operario', sortable: true, render: (r: any) => <span className="text-xs">{(r.personnel as any)?.full_name || '—'}</span> },
    { key: 'machines.name', label: 'Máquina', sortable: true, render: (r: any) => <span className="text-xs">[{(r.machines as any)?.internal_code}] {(r.machines as any)?.name}</span> },
    { key: 'projects.name', label: 'Proyecto', sortable: true, render: (r: any) => <span className="text-xs">{(r.projects as any)?.name || '—'}</span> },
    { key: 'record_type', label: 'Tipo', sortable: true, render: (r: any) => r.record_type === 'inicio'
      ? <Badge className="bg-[hsl(217,80%,93%)] text-[hsl(217,91%,60%)] border-0 text-[10px]">▶ Inicio</Badge>
      : <Badge className="bg-muted text-foreground border-0 text-[10px]">⏹ Cierre</Badge>
    },
    { key: 'horometer_value', label: 'Horómetro', sortable: true, render: (r: any) => <span className="text-xs">{Number(r.horometer_value).toLocaleString('es-CO')}</span> },
    { key: 'critical_failures_count', label: 'Críticos', sortable: true, render: (r: any) => r.critical_failures_count > 0
      ? <Badge variant="destructive" className="text-[10px] animate-pulse">⚠️ {r.critical_failures_count}</Badge>
      : <span className="text-xs text-muted-foreground">—</span>
    },
    { key: 'machine_status_at_close', label: 'Estado', render: (r: any) => <StatusBadge status={r.machine_status_at_close} recordType={r.record_type} /> },
    { key: 'actions', label: '', render: (r: any) => <Button variant="ghost" size="sm" className="text-xs"><Eye size={14} /></Button> },
  ];

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar operario, máquina, proyecto..." className="w-full sm:w-64" />
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-48 h-9"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proyectos</SelectItem>
            {projects?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={machineFilter} onValueChange={setMachineFilter}>
          <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="Máquina" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las máquinas</SelectItem>
            {machines?.map((m: any) => <SelectItem key={m.id} value={m.id}>[{m.internal_code}] {m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <FilterPills options={typeFilters} value={typeFilter} onChange={setTypeFilter} />
        <AdvancedFilters
          dateRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClear={() => { setDateFrom(''); setDateTo(''); }}
          resultCount={filtered.length}
        />
        <Button variant="ghost" size="sm" onClick={exportCSV} className="ml-auto"><Download size={14} className="mr-1" /> CSV</Button>
      </div>

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
        columns={preopColumns}
        isLoading={isLoading}
        onRowClick={(r: any) => setDetailId(r.id)}
        defaultSort={{ key: 'created_at', direction: 'desc' }}
        rowKey={(r: any) => r.id}
        emptyMessage="No hay preoperacionales en el rango seleccionado"
        selectable={true}
        onSelectionChange={setSelectedRows}
      />

      {detailId && <PreopDetailModal id={detailId} onClose={() => setDetailId(null)} />}

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
            <AlertDialogAction onClick={(e) => { e.preventDefault(); bulkDeleteMutation.mutate(selectedRows.map((r: any) => r.id)); }}>
              {bulkDeleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status, recordType }: { status: string | null; recordType: string }) {
  if (recordType === 'inicio' || !status) return <span className="text-xs text-muted-foreground">—</span>;
  if (status === 'sin_novedades') return <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-0 text-[10px]">✓ Sin novedades</Badge>;
  if (status === 'novedades_menores') return <Badge className="bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))] border-0 text-[10px]">⚠ Novedades</Badge>;
  if (status === 'requiere_revision_urgente') return <Badge className="bg-[hsl(var(--danger-bg))] text-destructive border-0 text-[10px]">🚨 Urgente</Badge>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

function PreopDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: record, isLoading } = useQuery({
    queryKey: ['preop-detail', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('preop_records')
        .select('*, machines(name, internal_code, status), projects(name), personnel!preop_records_operator_id_fkey(full_name)')
        .eq('id', id)
        .single();
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ['preop-items', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('preop_items')
        .select('*')
        .eq('record_id', id)
        .order('section');
      return data || [];
    },
  });

  // Group items by section
  const sections = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, any[]>();
    items.forEach((item: any) => {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    });
    return Array.from(map.entries()).map(([name, sectionItems]) => ({ name, items: sectionItems }));
  }, [items]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 py-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : record ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-barlow text-lg">
                Detalle Preoperacional
              </DialogTitle>
            </DialogHeader>

            {/* Header info */}
            <div className="space-y-2 text-sm font-dm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">[{(record.machines as any)?.internal_code}] {(record.machines as any)?.name}</span>
                <Badge className={record.record_type === 'inicio' ? 'bg-[hsl(217,80%,93%)] text-[hsl(217,91%,60%)] border-0 text-[10px]' : 'bg-muted text-foreground border-0 text-[10px]'}>
                  {record.record_type === 'inicio' ? '▶ Inicio' : '⏹ Cierre'}
                </Badge>
              </div>
              <p className="text-muted-foreground">{(record.personnel as any)?.full_name} · {format(new Date(record.created_at!), "dd MMM yyyy HH:mm", { locale: es })}</p>

              {record.has_critical_failures && (
                <div className="bg-[hsl(var(--danger-bg))] text-destructive rounded-lg px-3 py-2 text-xs font-semibold">
                  ⚠️ {record.critical_failures_count} punto(s) crítico(s) fallido(s)
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 bg-secondary rounded-lg p-3 text-xs">
                <div><span className="text-muted-foreground">Horómetro:</span> {Number(record.horometer_value).toLocaleString('es-CO')} h</div>
                <div><span className="text-muted-foreground">Proyecto:</span> {(record.projects as any)?.name || '—'}</div>
                {record.hours_worked != null && <div><span className="text-muted-foreground">Horas trabajadas:</span> {Number(record.hours_worked).toFixed(1)} h</div>}
                {record.machine_status_at_close && (
                  <div><span className="text-muted-foreground">Estado al cierre:</span> <StatusBadge status={record.machine_status_at_close} recordType="cierre" /></div>
                )}
              </div>
            </div>

            {/* Checklist items */}
            {sections.length > 0 && (
              <div className="space-y-2 mt-2">
                {sections.map((section) => (
                  <Collapsible key={section.name} defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full bg-secondary rounded-lg px-3 py-2">
                      <span className="font-barlow text-xs uppercase tracking-wider font-semibold">{section.name}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      {section.items.map((item: any) => (
                        <div key={item.id} className="flex items-start gap-2 py-1.5 px-2 border-b border-border last:border-0">
                          <div className="flex-1 min-w-0">
                            {item.is_critical && <span className="text-[10px] font-barlow uppercase font-bold text-destructive mr-1">CRÍTICO</span>}
                            <span className="text-xs font-dm">{item.item_label}</span>
                            {item.observation && <p className="text-xs text-muted-foreground italic mt-0.5">{item.observation}</p>}
                          </div>
                          <span className={`text-xs font-dm font-semibold shrink-0 ${item.result === 'bueno' ? 'text-[hsl(var(--success))]' : item.result === 'malo' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {item.result === 'bueno' ? '✓ Bueno' : item.result === 'malo' ? '✗ Malo' : '— N/A'}
                          </span>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Signature */}
            {record.digital_signature_url && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground font-dm mb-1">Firma digital</p>
                <img src={record.digital_signature_url} alt="Firma" className="h-24 border border-border rounded-lg" />
              </div>
            )}

            {record.observations && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground font-dm mb-0.5">Observaciones</p>
                <p className="text-sm font-dm">{record.observations}</p>
              </div>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
