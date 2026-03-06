import { cn } from "@/lib/utils";

interface FilterPillsProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterPills({ options, value, onChange, className }: FilterPillsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 overflow-x-auto", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-7 rounded-[20px] px-3 text-xs font-medium font-dm transition-colors",
            value === opt.value
              ? "bg-gold text-white"
              : "border border-border bg-card text-muted-foreground hover:border-gold"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
