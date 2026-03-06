import { cn } from '@/lib/utils';

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton-shimmer', className)} style={style} />;
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[88px] rounded-xl border border-border bg-card p-3.5 px-4">
          <Shimmer className="mb-2 h-3 w-24" />
          <Shimmer className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-4">
              <Shimmer className={cn('h-4', j === 0 ? 'w-20' : 'w-16')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonMachineCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <Shimmer className="mb-3 h-40 w-full rounded-lg" />
          <Shimmer className="mb-2 h-5 w-3/4" />
          <Shimmer className="mb-2 h-4 w-1/2" />
          <div className="flex gap-2 mt-3">
            <Shimmer className="h-6 w-20 rounded-full" />
            <Shimmer className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonChartArea() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <Shimmer className="mb-4 h-5 w-40" />
      <div className="flex items-end gap-2 h-[200px]">
        {[60, 80, 45, 90, 70, 55, 85, 40].map((h, i) => (
          <Shimmer key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonKitCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <Shimmer className="mb-3 h-5 w-3/4" />
          <Shimmer className="mb-2 h-4 w-1/2" />
          <Shimmer className="mb-3 h-3 w-full rounded-full" />
          <div className="flex gap-2">
            <Shimmer className="h-8 w-20 rounded-lg" />
            <Shimmer className="h-8 w-28 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
