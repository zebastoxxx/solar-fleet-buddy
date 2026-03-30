import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function StatCard({ label, value, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      "min-h-[72px] sm:min-h-[88px] h-auto rounded-xl border border-border bg-card p-3 sm:p-3.5 px-3 sm:px-4",
      className
    )}>
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-dm">{label}</p>
      <p className="mt-0.5 sm:mt-1 text-xl sm:text-[28px] font-bold leading-tight font-barlow text-foreground">{value}</p>
      {trend && (
        <p className={cn("text-xs font-dm", trend.positive ? "text-success" : "text-danger")}>
          {trend.value}
        </p>
      )}
    </div>
  );
}
