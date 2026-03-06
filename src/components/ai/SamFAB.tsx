import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onClick: () => void;
  hasUnread?: boolean;
}

export function SamFAB({ onClick, hasUnread }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] right-4 sm:right-6 z-50 flex items-center justify-center',
        'h-14 w-14 rounded-full shadow-lg transition-all',
        'bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-bright))] text-white',
        'hover:scale-105 active:scale-95'
      )}
      aria-label="Abrir asistente Sam"
    >
      <Sparkles className="h-6 w-6" />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive border-2 border-background" />
      )}
    </button>
  );
}
