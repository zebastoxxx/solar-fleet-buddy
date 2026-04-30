import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, type RowComponentProps } from 'react-window';

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
  /** Force virtualization on/off. By default, enabled when pagination=false and data.length > 100. */
  virtualize?: boolean;
  /** Row height in px for virtualized mode (default 36). */
  virtualRowHeight?: number;
  /** Container height in px for virtualized mode (default 480). */
  virtualHeight?: number;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

const VIRTUALIZE_THRESHOLD = 100;

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
  pagination = true,
  initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  virtualize,
  virtualRowHeight = 36,
  virtualHeight = 480,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSort?.key);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSort?.direction || 'desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(0);

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

  const total = sortedData.length;
  const totalPages = pagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  // Reset to page 0 when data shrinks beyond current page
  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages]);

  const pagedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize, pagination]);

  const getKey = useCallback(
    (row: T, idx: number) => (rowKey ? rowKey(row) : String((row as any).id ?? idx)),
    [rowKey]
  );

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
    if (selected.size === pagedData.length) {
      setSelected(new Set());
      onSelectionChange?.([]);
    } else {
      const all = new Set(pagedData.map((r, i) => getKey(r, i)));
      setSelected(all);
      onSelectionChange?.(pagedData);
    }
  };

  const showPagination = pagination && !isLoading && total > 0;
  const startItem = page * pageSize + 1;
  const endItem = Math.min(total, (page + 1) * pageSize);

  // Auto-virtualize: only when pagination is off and the dataset is large.
  const shouldVirtualize = virtualize ?? (!pagination && total > VIRTUALIZE_THRESHOLD);

  // Virtualized row renderer (uses div+grid layout to avoid table semantics issues
  // when rows are absolutely positioned by react-window)
  const gridTemplate = useMemo(() => {
    const parts: string[] = [];
    if (selectable) parts.push('40px');
    columns.forEach((c) => parts.push(c.width ?? 'minmax(80px, 1fr)'));
    return parts.join(' ');
  }, [columns, selectable]);

  const VirtualRow = useCallback(
    ({ index, style }: RowComponentProps<object>) => {
      const row = pagedData[index];
      const key = getKey(row, index);
      return (
        <div
          style={style as React.CSSProperties}
          className={cn(
            'grid items-center border-b border-border px-3 text-sm font-dm',
            onRowClick && 'cursor-pointer hover:bg-[hsl(var(--gold)/0.04)]',
            rowClassName?.(row)
          )}
          // eslint-disable-next-line react/no-unknown-property
          {...({ 'data-row-key': key } as any)}
          onClick={() => onRowClick?.(row)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: '0.5rem', width: '100%' }}>
            {selectable && (
              <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleSelect(key)} />
              </div>
            )}
            {columns.map((col) => (
              <div
                key={String(col.key)}
                className={cn(
                  'truncate',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.className
                )}
              >
                {col.render ? col.render(row) : (getNestedValue(row, String(col.key)) ?? '—')}
              </div>
            ))}
          </div>
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pagedData, columns, gridTemplate, selectable, selected, onRowClick, rowClassName]
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {shouldVirtualize ? (
        <>
          {/* Header (non-virtualized, mirrors row grid template) */}
          <div
            className="bg-secondary border-b border-border px-3 py-2"
            style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: '0.5rem' }}
          >
            {selectable && (
              <div className="flex items-center">
                <Checkbox
                  checked={pagedData.length > 0 && selected.size === pagedData.length}
                  onCheckedChange={toggleAll}
                />
              </div>
            )}
            {columns.map((col) => (
              <div
                key={String(col.key)}
                className={cn(
                  'flex items-center gap-1 text-[11px] uppercase tracking-wider font-dm',
                  col.sortable && 'cursor-pointer select-none hover:opacity-70 transition-opacity',
                  col.align === 'right' && 'justify-end',
                  col.align === 'center' && 'justify-center',
                  col.className
                )}
                onClick={() => col.sortable && handleSort(String(col.key))}
              >
                {col.label}
                {col.sortable && (
                  <span className="shrink-0">
                    {sortKey === String(col.key) ? (
                      sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <Skeleton key={i} className="h-[28px] w-full" />
              ))}
            </div>
          ) : total === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-dm">
              {emptyState || emptyMessage}
            </div>
          ) : (
            <List
              rowCount={pagedData.length}
              rowHeight={virtualRowHeight}
              rowComponent={VirtualRow}
              rowProps={{}}
              style={{ height: virtualHeight, width: '100%' }}
            />
          )}
        </>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader className={stickyHeader ? 'sticky top-0 z-10' : ''}>
              <TableRow className="bg-secondary">
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pagedData.length > 0 && selected.size === pagedData.length}
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
                            sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
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
              {!isLoading && total === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-12 text-muted-foreground font-dm">
                    {emptyState || emptyMessage}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                pagedData.map((row, idx) => {
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
      )}

      {showPagination && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-border px-3 py-2 bg-card">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-dm text-muted-foreground">Items por página</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-7 w-[70px] text-xs font-dm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs font-dm">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-dm text-muted-foreground tabular-nums">
              {startItem}–{endItem} de {total}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                aria-label="Primera página"
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
              ><ChevronsLeft className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Página anterior"
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
              ><ChevronLeft className="h-3.5 w-3.5" /></button>
              <span className="text-[11px] font-dm text-foreground px-2 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                aria-label="Página siguiente"
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
              ><ChevronRight className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                aria-label="Última página"
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
              ><ChevronsRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
