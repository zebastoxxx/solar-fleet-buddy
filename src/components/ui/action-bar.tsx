import { cn } from "@/lib/utils";

interface ActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <div className={cn(
      "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4",
      className
    )}>
      {children}
    </div>
  );
}

export function ActionBarLeft({ children, className }: ActionBarProps) {
  return <div className={cn("flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto", className)}>{children}</div>;
}

export function ActionBarRight({ children, className }: ActionBarProps) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
