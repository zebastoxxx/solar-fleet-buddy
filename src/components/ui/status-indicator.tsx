import { cn } from "@/lib/utils";
import type { MachineStatus } from "@/types";

const STATUS_CONFIG: Record<MachineStatus, { color: string; pulse: string }> = {
  activa_en_campo: { color: "bg-[#22C55E]", pulse: "animate-pulse-dot" },
  disponible_bodega: { color: "bg-[#16A34A]", pulse: "" },
  en_campo_dañada: { color: "bg-[#EF4444]", pulse: "animate-pulse-dot-slow" },
  varada_bodega: { color: "bg-[#374151]", pulse: "" },
};

const STATUS_LABELS: Record<MachineStatus, string> = {
  activa_en_campo: "Activa en campo",
  disponible_bodega: "Disponible bodega",
  en_campo_dañada: "En campo dañada",
  varada_bodega: "Varada bodega",
};

interface StatusIndicatorProps {
  status: MachineStatus;
  showLabel?: boolean;
  className?: string;
}

export function StatusIndicator({ status, showLabel = false, className }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("h-2.5 w-2.5 rounded-full", config.color, config.pulse)} />
      {showLabel && <span className="text-xs font-dm text-muted-foreground">{STATUS_LABELS[status]}</span>}
    </span>
  );
}
