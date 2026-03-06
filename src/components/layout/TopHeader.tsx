import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { RoleBadge } from '@/components/ui/role-badge';
import { Menu } from 'lucide-react';

interface TopHeaderProps {
  onMenuClick: () => void;
}

export function TopHeader({ onMenuClick }: TopHeaderProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const current = NAV_ITEMS.find((i) => location.pathname.startsWith(i.path));

  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden text-muted-foreground hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-barlow font-semibold uppercase tracking-wide text-foreground">
          {current?.label || ''}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {user?.role && <RoleBadge role={user.role} />}
        <span className="text-xs font-dm text-muted-foreground">{user?.full_name || ''}</span>
      </div>
    </header>
  );
}
