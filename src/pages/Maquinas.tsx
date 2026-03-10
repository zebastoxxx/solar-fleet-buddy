import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutGrid, List, Columns3, Trash2 } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonMachineCards } from '@/components/ui/SkeletonLoaders';
import { ActionBar, ActionBarLeft, ActionBarRight } from '@/components/ui/action-bar';
import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { StatusBadge } from '@/components/ui/status-badge';
import { AdvancedFilters, type FilterField } from '@/components/ui/AdvancedFilters';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAllMachines, useAllMachineFinancials } from '@/hooks/useDashboardData';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { deleteMachines } from '@/lib/cascade-delete';
import { CreateMachineModal } from '@/components/machines/CreateMachineModal';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type MachineStatus = Database['public']['Enums']['machine_status'];
type ViewMode = 'cards' | 'table' | 'kanban';

const TYPE_LABELS: Record<string, string> = {
  telehandler: 'Telehandler', manlift: 'Manlift', tijera: 'Tijera', hincadora: 'Hincadora',
  minicargador: 'Minicargador', retroexcavadora: 'Retroexcavadora', camion_grua: 'Camión Grúa', otro: 'Otro',
};

const KANBAN_COLUMNS: { status: MachineStatus; label: string; color: string }[] = [
  { status: 'activa_en_campo', label: 'En campo', color: 'border-t-emerald-500' },
  { status: 'disponible_bodega', label: 'Bodega', color: 'border-t-blue-500' },
  { status: 'en_campo_dañada', label: 'Dañadas', color: 'border-t-red-500' },
  { status: 'varada_bodega', label: 'Varadas', color: 'border-t-amber-500' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'activa_en_campo', label: 'En campo' },
  { value: 'disponible_bodega', label: 'Bodega' },
  { value: 'en_campo_dañada', label: 'Dañadas' },
  { value: 'varada_bodega', label: 'Varadas' },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  ...Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Nombre' },
  { value: 'horometer_current', label: 'Horómetro' },
  { value: 'type', label: 'Tipo' },
  { value: 'year', label: 'Antigüedad' },
  { value: 'profit_margin', label: 'Rentabilidad' },
];

const CUSTOM_FILTERS: FilterField[] = [
  { key: 'status', label: 'Estado', type: 'select', options: STATUS_FILTER_OPTIONS },
  { key: 'type', label: 'Tipo', type: 'select', options: TYPE_FILTER_OPTIONS },
  { key: 'sort', label: 'Ordenar por', type: 'select', options: [{ value: 'all', label: 'Sin orden' }, ...SORT_OPTIONS] },
];

export default function Maquinas() {
  usePageTitle('Máquinas');
  const navigate = useNavigate();
  const { can } = usePermissions();
  const tenantId = useAuthStore((s) => s.user?.tenant_id);
  const qc = useQueryClient();
  const machines = useAllMachines();
  const financials = useAllMachineFinancials();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showCreate, setShowCreate] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await deleteMachines(ids);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-machines', tenantId] });
      toast.success(`${selectedRows.length} registro(s) eliminado(s)`);
      setSelectedRows([]);
      setShowBulkDeleteConfirm(false);
    },
    onError: () => toast.error('Error al eliminar los registros seleccionados'),
  });

  const financialsMap = useMemo(() => {
    const m = new Map<string, any>();
    (financials.data ?? []).forEach((f: any) => m.set(f.machine_id, f));
    return m;
  }, [financials.data]);

  const filtered = useMemo(() => {
    let list = (machines.data ?? []).map((m: any) => ({
      ...m,
      financials: financialsMap.get(m.id),
      profit_margin: financialsMap.get(m.id)?.profit_margin_pct ?? null,
    }));

    const sf = filterValues.status;
    if (sf && sf !== 'all') list = list.filter((m) => m.status === sf);
    const tf = filterValues.type;
    if (tf && tf !== 'all') list = list.filter((m) => m.type === tf);

    if (dateFrom) list = list.filter((m) => m.created_at && m.created_at >= dateFrom);
    if (dateTo) list = list.filter((m) => m.created_at && m.created_at <= dateTo + 'T23:59:59');

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        m.name.toLowerCase().includes(q) || m.internal_code.toLowerCase().includes(q) ||
        (m.brand ?? '').toLowerCase().includes(q) || (m.model ?? '').toLowerCase().includes(q)
      );
    }

    const sortKey = filterValues.sort;
    if (sortKey && sortKey !== 'all') {
      list.sort((a: any, b: any) => {
        const av = sortKey === 'profit_margin' ? (a.profit_margin ?? -9999) : a[sortKey];
        const bv = sortKey === 'profit_margin' ? (b.profit_margin ?? -9999) : b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (sortKey === 'year') return (Number(av) || 0) - (Number(bv) || 0);
        if (typeof av === 'number') return (bv as number) - av;
        return String(av).localeCompare(String(bv), 'es');
      });
    }
    return list;
  }, [machines.data, search, filterValues, dateFrom, dateTo, financialsMap]);

  const clearFilters = () => {
    setFilterValues({});
    setDateFrom('');
    setDateTo('');
  };

  const profitBadge = (margin: number | null) => {
    if (margin == null) return <span className="text-[11px] text-muted-foreground font-dm">—</span>;
    if (margin < 0) return <span className="text-[11px] font-semibold text-danger font-dm">⚠️ {margin.toFixed(0)}%</span>;
    if (margin < 15) return <span className="text-[11px] font-semibold text-warning font-dm">🔧 {margin.toFixed(0)}%</span>;
    return <span className="text-[11px] font-semibold text-success font-dm">✅ {margin.toFixed(0)}%</span>;
  };

  // Table columns
  const tableColumns: Column<any>[] = [
    { key: 'internal_code', label: 'Código', sortable: true, width: '90px' },
    { key: 'name', label: 'Nombre', sortable: true, render: (r) => <span className="font-semibold">{r.name}</span> },
    { key: 'type', label: 'Tipo', sortable: true, render: (r) => TYPE_LABELS[r.type] ?? r.type },
    { key: 'status', label: 'Estado', sortable: true, render: (r) => <StatusIndicator status={r.status as MachineStatus} showLabel /> },
    { key: 'horometer_current', label: 'Horómetro', sortable: true, align: 'right', render: (r) => `${Number(r.horometer_current ?? 0).toLocaleString()} h` },
    { key: 'project_name', label: 'Proyecto', render: (r) => (r as any).projects?.name ?? '—' },
    { key: 'profit_margin', label: 'Rentabilidad', sortable: true, align: 'center', render: (r) => profitBadge(r.profit_margin) },
  ];

  return (
    <div className="space-y-4">
      <ActionBar>
        <ActionBarLeft>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar máquina..." />
          <AdvancedFilters
            dateRange
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            customFilters={CUSTOM_FILTERS}
            filterValues={filterValues}
            onFilterChange={(k, v) => setFilterValues((p) => ({ ...p, [k]: v }))}
            onClear={clearFilters}
            resultCount={filtered.length}
          />
        </ActionBarLeft>
        <ActionBarRight>
          <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
            {([['cards', LayoutGrid], ['table', List], ['kanban', Columns3]] as const).map(([mode, Icon]) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => { setViewMode(mode); setSelectedRows([]); }}
                >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
          {can('maquinas') && (
            <Button onClick={() => setShowCreate(true)} className="gap-1">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva Máquina</span>
            </Button>
          )}
        </ActionBarRight>
      </ActionBar>

      {machines.isLoading ? (
        <SkeletonMachineCards />
      ) : !filtered.length ? (
        <EmptyState
          icon="🏗️"
          title="Sin máquinas registradas"
          description="Agrega tu primera máquina al sistema."
          action={can('maquinas') ? { label: '+ Nueva Máquina', onClick: () => setShowCreate(true) } : undefined}
        />
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m: any) => (
            <div
              key={m.id}
              className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary transition-colors cursor-pointer"
              onClick={() => navigate(`/maquinas/${m.id}`)}
            >
              {/* Compact photo area */}
              <div className="h-[90px] bg-muted flex items-center justify-center overflow-hidden">
                {m.cover_photo_url ? (
                  <img src={m.cover_photo_url} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl opacity-20">⚙️</span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <StatusIndicator status={m.status as MachineStatus} showLabel={false} />
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground font-dm bg-muted px-1.5 py-0.5 rounded-md">
                    {TYPE_LABELS[m.type] ?? m.type}
                  </span>
                  {profitBadge(m.profit_margin)}
                </div>
                <p className="font-barlow text-sm font-semibold text-foreground truncate">{m.name}</p>
                <p className="text-[11px] text-muted-foreground font-dm">{m.internal_code} · {m.brand ?? ''} {m.model ?? ''}</p>
                <p className="text-[12px] font-dm text-foreground mt-1">⏱ {Number(m.horometer_current ?? 0).toLocaleString()} h</p>
                {(m as any).projects?.name && (
                  <p className="text-[11px] text-primary font-dm truncate">📍 {(m as any).projects.name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'table' ? (
        <>
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
          columns={tableColumns}
          onRowClick={(r: any) => navigate(`/maquinas/${r.id}`)}
          defaultSort={{ key: 'name', direction: 'asc' }}
          selectable={true}
          rowKey={(r: any) => r.id}
          onSelectionChange={setSelectedRows}
        />
        </>
      ) : (
        /* Kanban */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const items = filtered.filter((m: any) => m.status === col.status);
            return (
              <div key={col.status} className={cn('rounded-xl border border-border bg-card overflow-hidden border-t-4', col.color)}>
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="font-barlow text-sm font-semibold">{col.label}</span>
                  <span className="text-[11px] text-muted-foreground font-dm bg-muted rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground font-dm text-center py-4">Sin máquinas</p>
                  ) : items.map((m: any) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-border p-2.5 bg-background hover:border-primary/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/maquinas/${m.id}`)}
                    >
                      <p className="font-barlow text-sm font-semibold truncate">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground font-dm">{m.internal_code} · {TYPE_LABELS[m.type] ?? m.type}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] font-dm">⏱ {Number(m.horometer_current ?? 0).toLocaleString()}h</span>
                        {profitBadge(m.profit_margin)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateMachineModal open={showCreate} onClose={() => setShowCreate(false)} />}

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
