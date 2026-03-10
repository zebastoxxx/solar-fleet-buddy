import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { startOfWeek, startOfMonth, startOfYear, subMonths, format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'text';
  options?: { value: string; label: string }[];
}

export interface AdvancedFiltersProps {
  dateRange?: boolean;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (v: string) => void;
  onDateToChange?: (v: string) => void;
  customFilters?: FilterField[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onClear?: () => void;
  resultCount?: number;
}

const today = format(new Date(), 'yyyy-MM-dd');

const QUICK_RANGES: { label: string; getRange: () => [string, string] }[] = [
  { label: 'Hoy', getRange: () => [today, today] },
  { label: 'Esta semana', getRange: () => [format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), today] },
  { label: 'Este mes', getRange: () => [format(startOfMonth(new Date()), 'yyyy-MM-dd'), today] },
  { label: 'Último trimestre', getRange: () => [format(subMonths(new Date(), 3), 'yyyy-MM-dd'), today] },
  { label: 'Este año', getRange: () => [format(startOfYear(new Date()), 'yyyy-MM-dd'), today] },
];

export function AdvancedFilters({
  dateRange = false,
  dateFrom = '',
  dateTo = '',
  onDateFromChange,
  onDateToChange,
  customFilters = [],
  filterValues = {},
  onFilterChange,
  onClear,
  resultCount,
}: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);

  const hasActiveFilters = useMemo(() => {
    if (dateFrom || dateTo) return true;
    return Object.values(filterValues).some((v) => v && v !== 'all' && v !== 'todos' && v !== 'todas');
  }, [dateFrom, dateTo, filterValues]);

  return (
    <div className="relative">
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 h-9 text-xs font-dm border-border',
            hasActiveFilters && 'border-primary text-primary'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {hasActiveFilters && (
            <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              ●
            </span>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="absolute right-0 top-full mt-2 z-50 min-w-[480px] max-w-[95vw]">
        <div className="rounded-xl border border-border bg-card shadow-xl p-4 space-y-4">
          {/* Date Range */}
          {dateRange && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-dm font-semibold">📅 Rango de fechas</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange?.(e.target.value)}
                  max={dateTo || today}
                  className="h-9 w-40 text-xs font-dm"
                  placeholder="Desde"
                />
                <span className="text-muted-foreground text-xs">→</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange?.(e.target.value)}
                  min={dateFrom}
                  max={today}
                  className="h-9 w-40 text-xs font-dm"
                  placeholder="Hasta"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_RANGES.map((qr) => (
                  <Button
                    key={qr.label}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-dm"
                    onClick={() => {
                      const [from, to] = qr.getRange();
                      onDateFromChange?.(from);
                      onDateToChange?.(to);
                    }}
                  >
                    {qr.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Filters */}
          {customFilters.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              {customFilters.map((f) => (
                <div key={f.key} className="space-y-1">
                  <p className="text-[11px] uppercase text-muted-foreground font-dm">{f.label}</p>
                  {f.type === 'select' && f.options ? (
                    <Select
                      value={filterValues[f.key] || 'all'}
                      onValueChange={(v) => onFilterChange?.(f.key, v)}
                    >
                      <SelectTrigger className="h-9 w-44 text-xs font-dm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={filterValues[f.key] || ''}
                      onChange={(e) => onFilterChange?.(f.key, e.target.value)}
                      className="h-9 w-44 text-xs font-dm"
                      placeholder={f.label}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-dm gap-1.5"
              onClick={onClear}
            >
              <RotateCcw className="h-3 w-3" />
              Limpiar filtros
            </Button>
            {resultCount !== undefined && (
              <p className="text-xs text-muted-foreground font-dm">
                {resultCount} resultado{resultCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
    </div>
  );
}
