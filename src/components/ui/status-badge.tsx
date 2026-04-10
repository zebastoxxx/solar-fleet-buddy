import { cn } from "@/lib/utils";

type BadgeStatus = 'operativo' | 'mantenimiento' | 'fuera_servicio' | string;

const BADGE_STYLES: Record<string, string> = {
  operativo: "bg-success-bg text-success",
  mantenimiento: "bg-warning-bg text-warning",
  fuera_servicio: "bg-danger-bg text-danger",
  // OT statuses
  creada: "bg-muted text-muted-foreground",
  asignada: "bg-warning-bg text-warning",
  en_curso: "bg-[#DBEAFE] text-[#1E40AF]",
  pausada: "bg-warning-bg text-warning",
  cerrada: "bg-[#DBEAFE] text-[#1E40AF]",
  firmada: "bg-success-bg text-success",
  // Priority
  normal: "bg-muted text-muted-foreground",
  urgente: "bg-warning-bg text-warning",
  critica: "bg-danger-bg text-danger",
  // General
  activo: "bg-success-bg text-success",
  inactivo: "bg-muted text-muted-foreground",
};

interface StatusBadgeProps {
  status: BadgeStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = BADGE_STYLES[status] || "bg-muted text-muted-foreground";
  return (
    <span className={cn(
      "inline-flex items-center rounded-[20px] px-2.5 py-0.5 text-[11px] font-semibold uppercase font-dm",
      style,
      className
    )}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
