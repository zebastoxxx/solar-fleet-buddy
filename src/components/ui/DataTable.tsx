import { useState, useMemo, useCallback, useEffect } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  stickyHeader?: boolean;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  rowKey?: (row: T) => string;
  skeletonRows?: number;
  /** When true (default), shows pagination controls. Set false for already-paginated/small datasets. */
  pagination?: boolean;
  /** Initial page size (default 25). */
  initialPageSize?: number;
  /** Available page-size options. */
  pageSizeOptions?: number[];
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  emptyState,
  emptyMessage = 'No hay registros',
  onRowClick,
  rowClassName,
  defaultSort,
  stickyHeader = false,
  selectable = false,
  onSelectionChange,
  rowKey,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSort?.key);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSort?.direction || 'desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey);
      const bVal = getNestedValue(b, sortKey);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal), 'es');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const getKey = (row: T, idx: number) => rowKey ? rowKey(row) : String((row as any).id ?? idx);

  const toggleSelect = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    if (onSelectionChange) {
      onSelectionChange(sortedData.filter((_, i) => next.has(getKey(sortedData[i], i))));
    }
  };

  const toggleAll = () => {
    if (selected.size === sortedData.length) {
      setSelected(new Set());
      onSelectionChange?.([]);
    } else {
      const all = new Set(sortedData.map((r, i) => getKey(r, i)));
      setSelected(all);
      onSelectionChange?.(sortedData);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
      <Table className="min-w-[640px]">
        <TableHeader className={stickyHeader ? 'sticky top-0 z-10' : ''}>
          <TableRow className="bg-secondary">
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={sortedData.length > 0 && selected.size === sortedData.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={String(col.key)}
                className={cn(
                  'text-[11px] uppercase tracking-wider font-dm',
                  col.sortable && 'cursor-pointer select-none hover:bg-accent/50 transition-colors',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.className
                )}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => col.sortable && handleSort(String(col.key))}
              >
                <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end', col.align === 'center' && 'justify-center')}>
                  {col.label}
                  {col.sortable && (
                    <span className="shrink-0">
                      {sortKey === String(col.key) ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-primary" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                      )}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={`skel-${i}`} className="h-[32px] md:h-[36px]">
                {selectable && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                {columns.map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {!isLoading && sortedData.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-12 text-muted-foreground font-dm">
                {emptyState || emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            sortedData.map((row, idx) => {
              const key = getKey(row, idx);
              return (
                <TableRow
                  key={key}
                  className={cn(
                    'h-[32px] md:h-[36px]',
                    onRowClick && 'cursor-pointer hover:bg-[hsl(var(--gold)/0.04)]',
                    rowClassName?.(row)
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleSelect(key)} />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={String(col.key)}
                      className={cn(
                        'font-dm text-sm',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : (getNestedValue(row, String(col.key)) ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
