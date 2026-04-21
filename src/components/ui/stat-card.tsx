import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  /** Pre-computed trend (legacy API) */
  trend?: { value: string; positive: boolean };
  /** New API: pass current + previous and we compute the delta */
  previousValue?: number;
  /** When using previousValue + numeric value, lower is better (e.g. costs) */
  invertTrend?: boolean;
  className?: string;
}

function computeTrend(current: number, previous: number, invert: boolean) {
  if (previous === 0) {
    if (current === 0) return { pct: 0, positive: true, neutral: true };
    return { pct: 100, positive: !invert, neutral: false };
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const isUp = delta > 0;
  return {
    pct: Math.abs(delta),
    positive: invert ? !isUp : isUp,
    neutral: Math.abs(delta) < 0.5,
  };
}

export function StatCard({ label, value, trend, previousValue, invertTrend = false, className }: StatCardProps) {
  // Auto-compute trend from previousValue if provided and value is numeric
  let autoTrend: { value: string; positive: boolean; neutral?: boolean } | null = null;
  if (previousValue !== undefined && typeof value === 'number') {
    const t = computeTrend(value, previousValue, invertTrend);
    autoTrend = {
      value: `${t.neutral ? '' : (value >= previousValue ? '↑' : '↓')} ${t.pct.toFixed(1)}%`,
      positive: t.positive,
      neutral: t.neutral,
    };
  }
  const finalTrend = autoTrend || trend;
  const TrendIcon = finalTrend
    ? (autoTrend?.neutral ? Minus : (finalTrend.positive ? TrendingUp : TrendingDown))
    : null;

  return (
    <div className={cn(
      "min-h-[72px] sm:min-h-[88px] h-auto rounded-xl border border-border bg-card p-3 sm:p-3.5 px-3 sm:px-4 transition-shadow hover:shadow-[0_4px_14px_hsl(var(--foreground)/0.05)]",
      className
    )}>
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-dm">{label}</p>
      <div className="flex items-end justify-between gap-2 mt-0.5 sm:mt-1">
        <p className="text-xl sm:text-[28px] font-bold leading-tight font-barlow text-foreground">{value}</p>
        {finalTrend && TrendIcon && (
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] sm:text-[11px] font-dm font-semibold shrink-0 mb-0.5",
            autoTrend?.neutral
              ? "bg-muted text-muted-foreground"
              : finalTrend.positive
                ? "bg-success-bg text-success"
                : "bg-danger-bg text-danger"
          )}>
            <TrendIcon className="h-3 w-3" aria-hidden />
            {finalTrend.value}
          </span>
        )}
      </div>
    </div>
  );
}
