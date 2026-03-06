import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { icon: 'text-3xl', title: 'text-sm', desc: 'text-xs', padding: 'py-8' },
  md: { icon: 'text-5xl', title: 'text-base', desc: 'text-sm', padding: 'py-16' },
  lg: { icon: 'text-7xl', title: 'text-xl', desc: 'text-base', padding: 'py-24' },
};

export function EmptyState({ icon, title, description, action, size = 'md', className }: EmptyStateProps) {
  const s = sizes[size];
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", s.padding, className)}>
      <span className={cn(s.icon, "mb-4 select-none")} role="img" aria-hidden="true">{icon}</span>
      <h3 className={cn("font-barlow font-bold uppercase tracking-wide text-foreground", s.title)}>{title}</h3>
      <p className={cn("mt-1 max-w-xs text-muted-foreground font-dm", s.desc)}>{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-5 gap-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}
