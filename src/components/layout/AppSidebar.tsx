import { useLocation, Link, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useOTTimerStore, useChrono } from '@/stores/otTimerStore';
import { useAlertsStore } from '@/stores/alertsStore';
import { RoleBadge } from '@/components/ui/role-badge';
import {
  BarChart3, TrendingUp, Users, Factory, Truck, HardHat,
  FolderOpen, ClipboardList, Wrench, Package, Settings, LogOut, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoImg from '@/assets/logo.png';

const ICON_MAP: Record<string, React.ElementType> = {
  BarChart3, TrendingUp, Users, Factory, Truck, HardHat,
  FolderOpen, ClipboardList, Wrench, Package, Settings, DollarSign,
};

// Map nav permission keys to usePermissions keys
const PERM_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  analytics: 'analytics',
  clientes: 'clientes',
  proveedores: 'proveedores',
  maquinas: 'maquinas',
  personal: 'personal',
  proyectos: 'proyectos',
  preop_view: 'preop_view',
  ot_view: 'ot_view',
  inventario: 'inventario',
  financiero: 'financiero',
  configuracion: 'configuracion',
};

interface AppSidebarProps {
  onClose: () => void;
}

function OTTimerChip() {
  const timerStore = useOTTimerStore();
  const chrono = useChrono();
  const navigate = useNavigate();
  if (timerStore.status === 'idle') return null;
  return (
    <div className="mx-2 mb-2 p-3 rounded-lg border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.08)]">
      <p className="text-[11px] font-barlow uppercase text-[hsl(var(--gold-bright))]">🔧 {timerStore.activeOTCode} en curso</p>
      <p className={cn('font-barlow text-lg font-bold', timerStore.status === 'running' ? 'text-[hsl(var(--gold-bright))]' : 'text-muted-foreground')}>⏱ {chrono}</p>
      <p className="text-[11px] text-[hsl(var(--sidebar-text))] font-dm">{timerStore.machineName}</p>
      <button onClick={() => navigate(`/mis-ot/${timerStore.activeOTId}`)} className="text-[11px] text-[hsl(var(--gold-bright))] font-dm font-semibold mt-1 hover:underline">Ver OT →</button>
    </div>
  );
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { can } = usePermissions();
  const { criticalCount } = useAlertsStore();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter((item) => {
    const permKey = PERM_MAP[item.permission] || item.permission;
    return can(permKey as any);
  });

  return (
    <>
      {/* Logo area */}
      <div className="flex flex-col items-center gap-1 px-4 py-4">
        <img src={logoImg} alt="Up & Down Solar" className="h-12 w-auto object-contain" />
        <span className="text-[10px] font-barlow font-semibold uppercase tracking-wider text-gold-bright">
          Solar OS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {visibleItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || Settings;
          const active = location.pathname.startsWith(item.path);
          const showBadge = item.path === '/dashboard' && criticalCount > 0;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                "nav-item flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-barlow font-medium uppercase tracking-wide transition-colors relative",
                active
                  ? "border-l-[3px] border-gold bg-gold/[0.08] text-gold-bright"
                  : "border-l-[3px] border-transparent text-[hsl(var(--sidebar-text))] hover:bg-white/[0.05]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {showBadge && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse-dot">
                  {criticalCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* OT Timer Chip */}
      <OTTimerChip />

      {/* Footer */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-dm font-medium text-white truncate">
              {user?.full_name || 'Usuario'}
            </p>
            {user?.role && <RoleBadge role={user.role} className="mt-0.5" />}
          </div>
          <button
            onClick={handleLogout}
            className="text-[hsl(var(--sidebar-text))] hover:text-white transition-colors shrink-0"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
