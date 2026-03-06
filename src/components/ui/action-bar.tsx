import { cn } from "@/lib/utils";

interface ActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <div className={cn(
      "flex h-12 items-center justify-between mb-4",
      className
    )}>
      {children}
    </div>
  );
}

export function ActionBarLeft({ children, className }: ActionBarProps) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>;
}

export function ActionBarRight({ children, className }: ActionBarProps) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>;
}
