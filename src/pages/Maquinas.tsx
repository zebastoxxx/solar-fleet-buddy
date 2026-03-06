import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonMachineCards } from '@/components/ui/SkeletonLoaders';
import { ActionBar, ActionBarLeft, ActionBarRight } from '@/components/ui/action-bar';
import { SearchInput } from '@/components/ui/search-input';
import { FilterPills } from '@/components/ui/filter-pills';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllMachines } from '@/hooks/useDashboardData';
import { usePermissions } from '@/hooks/usePermissions';
import { CreateMachineModal } from '@/components/machines/CreateMachineModal';
import type { Database } from '@/integrations/supabase/types';

type MachineStatus = Database['public']['Enums']['machine_status'];

const FILTER_OPTIONS = [
  { label: 'Todas', value: 'all' },
  { label: 'En campo', value: 'activa_en_campo' },
  { label: 'Bodega', value: 'disponible_bodega' },
  { label: 'Dañadas', value: 'en_campo_dañada' },
  { label: 'Varadas', value: 'varada_bodega' },
];

const TYPE_LABELS: Record<string, string> = {
  telehandler: 'Telehandler',
  manlift: 'Manlift',
  tijera: 'Tijera',
  hincadora: 'Hincadora',
  minicargador: 'Minicargador',
  retroexcavadora: 'Retroexcavadora',
  camion_grua: 'Camión Grúa',
  otro: 'Otro',
};

export default function Maquinas() {
  usePageTitle('Máquinas');
  const navigate = useNavigate();
  const { can } = usePermissions();
  const machines = useAllMachines();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = (machines.data ?? []).filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.internal_code.toLowerCase().includes(q) ||
        (m.brand ?? '').toLowerCase().includes(q) ||
        (m.model ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <ActionBar>
        <ActionBarLeft>
          <FilterPills options={FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar máquina..." />
        </ActionBarLeft>
        <ActionBarRight>
          {can('maquinas') && (
            <Button onClick={() => setShowCreate(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Nueva Máquina
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
          description="Agrega tu primera máquina al sistema para comenzar a gestionar tu flota."
          action={can('maquinas') ? { label: '+ Nueva Máquina', onClick: () => setShowCreate(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary transition-colors card-hover cursor-pointer" onClick={() => navigate(`/maquinas/${m.id}`)}>
              {/* Placeholder image area */}
              <div className="h-[130px] bg-muted flex items-center justify-center">
                <span className="text-4xl opacity-30">
                  {m.type === 'telehandler' ? '🏗️' : m.type === 'manlift' ? '🏗️' : m.type === 'retroexcavadora' ? '🚜' : m.type === 'minicargador' ? '🚜' : m.type === 'camion_grua' ? '🏗️' : '⚙️'}
                </span>
              </div>

              <div className="p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusIndicator status={m.status as MachineStatus} showLabel={false} />
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground font-dm rounded-md bg-muted px-1.5 py-0.5">
                    {TYPE_LABELS[m.type] ?? m.type}
                  </span>
                </div>

                <p className="font-barlow text-base font-semibold text-foreground">{m.name}</p>
                <p className="text-[12px] text-muted-foreground font-dm">
                  Código: {m.internal_code} · {m.brand ?? ''} {m.model ?? ''}
                </p>

                <div className="mt-2 space-y-0.5">
                  <p className="text-[13px] font-dm text-foreground">⏱ {Number(m.horometer_current ?? 0).toLocaleString()} h</p>
                  {(m as any).projects?.name && (
                    <p className="text-[12px] text-gold font-dm">📍 {(m as any).projects.name}</p>
                  )}
                  {m.monthly_cost_estimate && (
                    <p className="text-[12px] text-muted-foreground font-dm">
                      💰 ${(Number(m.monthly_cost_estimate) / 1_000_000).toFixed(1)}M / mes
                    </p>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/maquinas/${m.id}`)}
                  className="mt-3 w-full rounded-lg border border-border py-2 text-center text-[13px] font-barlow font-semibold text-gold hover:border-gold transition-colors"
                >
                  Ver detalle →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateMachineModal open={showCreate} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
