import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { RoleBadge } from '@/components/ui/role-badge';
import { Menu, Settings, LogOut, User } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface TopHeaderProps {
  onMenuClick: () => void;
}

function initials(name?: string) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export function TopHeader({ onMenuClick }: TopHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const current = NAV_ITEMS.find((i) => location.pathname.startsWith(i.path));

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const canSeeSettings = user && ['superadmin', 'gerente', 'supervisor'].includes(user.role);

  return (
    <header className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden flex items-center justify-center h-10 w-10 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-barlow font-semibold uppercase tracking-wide text-foreground">
          {current?.label || ''}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
          {user?.role && <RoleBadge role={user.role} />}
          <span className="hidden sm:inline text-xs font-dm text-muted-foreground max-w-[160px] truncate">
            {user?.full_name || ''}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold text-[11px] font-barlow font-bold uppercase">
            {initials(user?.full_name)}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-dm">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground truncate">{user?.full_name || 'Usuario'}</span>
              <span className="text-[11px] text-muted-foreground capitalize">{user?.role || ''}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="font-dm cursor-pointer" onSelect={() => navigate('/personal')}>
            <User className="h-4 w-4 mr-2" />
            Mi perfil
          </DropdownMenuItem>
          {canSeeSettings && (
            <DropdownMenuItem className="font-dm cursor-pointer" onSelect={() => navigate('/configuracion')}>
              <Settings className="h-4 w-4 mr-2" />
              Configuración
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="font-dm cursor-pointer text-danger focus:text-danger" onSelect={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
