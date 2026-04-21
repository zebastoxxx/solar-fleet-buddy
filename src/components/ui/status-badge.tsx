import { cn } from "@/lib/utils";
import {
  Play, Pause, AlertTriangle, CheckCircle2, Circle, Wrench,
  Ban, Clock, FileSignature, Zap,
} from "lucide-react";

type BadgeStatus =
  | 'operativo' | 'mantenimiento' | 'fuera_servicio'
  | 'creada' | 'asignada' | 'en_curso' | 'pausada' | 'cerrada' | 'firmada'
  | 'normal' | 'urgente' | 'critica'
  | 'activo' | 'inactivo'
  | string;

const BADGE_STYLES: Record<string, { cls: string; Icon: any; pulse?: boolean }> = {
  // Machine
  operativo:        { cls: "bg-success-bg text-success",                 Icon: Play },
  mantenimiento:    { cls: "bg-warning-bg text-warning",                 Icon: Wrench },
  fuera_servicio:   { cls: "bg-danger-bg text-danger",                   Icon: Ban,            pulse: true },
  // OT
  creada:           { cls: "bg-muted text-muted-foreground",             Icon: Circle },
  asignada:         { cls: "bg-warning-bg text-warning",                 Icon: Clock },
  en_curso:         { cls: "bg-[hsl(var(--gold)/0.12)] text-gold",       Icon: Zap },
  pausada:          { cls: "bg-warning-bg text-warning",                 Icon: Pause },
  cerrada:          { cls: "bg-[#DBEAFE] text-[#1E40AF] dark:bg-[#1E40AF]/20 dark:text-[#93C5FD]", Icon: CheckCircle2 },
  firmada:          { cls: "bg-success-bg text-success",                 Icon: FileSignature },
  // Priority
  normal:           { cls: "bg-muted text-muted-foreground",             Icon: Circle },
  urgente:          { cls: "bg-warning-bg text-warning",                 Icon: AlertTriangle },
  critica:          { cls: "bg-danger-bg text-danger",                   Icon: AlertTriangle,  pulse: true },
  // General
  activo:           { cls: "bg-success-bg text-success",                 Icon: CheckCircle2 },
  inactivo:         { cls: "bg-muted text-muted-foreground",             Icon: Circle },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const cfg = BADGE_STYLES[status] || { cls: "bg-muted text-muted-foreground", Icon: Circle };
  const { cls, Icon, pulse } = cfg;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[11px] font-semibold uppercase font-dm",
      cls,
      pulse && "priority-critical-badge",
      className
    )}>
      {showIcon && <Icon className="h-3 w-3 shrink-0" aria-hidden />}
      {status.replace(/_/g, ' ')}
    </span>
  );
}
