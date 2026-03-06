import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const ROLE_STYLES: Record<UserRole, string> = {
  superadmin: "bg-dark text-gold-bright",
  gerente: "bg-dark text-gold-bright",
  supervisor: "bg-[#1e3a5f] text-[#93c5fd]",
  tecnico: "bg-[#431407] text-[#fdba74]",
  operario: "bg-secondary text-mid",
};

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold uppercase font-dm",
      ROLE_STYLES[role],
      className
    )}>
      {role}
    </span>
  );
}
