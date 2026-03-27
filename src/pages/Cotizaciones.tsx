import { useState, useMemo, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { formatCOP, formatCOPShort } from '@/lib/format';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { StatCard } from '@/components/ui/stat-card';
import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus, Eye, Pencil, Trash2, FileText, Download, Send, CheckCircle, XCircle,
  X, Clock, Filter, RotateCcw, FileDown
} from 'lucide-react';
import jsPDF from 'jspdf';

// ─── Types ───
interface QuotationRow {
  id: string;
  quote_number: string;
  tenant_id: string;
  client_id: string | null;
  project_id: string | null;
  business_line: string;
  status: string;
  title: string | null;
  notes: string | null;
  validity_days: number;
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  freight_amount: number;
  iva_pct: number;
  iva_amount: number;
  total: number;
  pdf_url: string | null;
  sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  clients: { name: string; tax_id: string | null; contact_email: string | null } | null;
  projects: { name: string } | null;
}

interface QuotationItemRow {
  id: string;
  quotation_id: string;
  rate_id: string | null;
  description: string;
  category: string | null;
  period_type: string;
  quantity: number;
  unit_price: number;
  include_operator: boolean;
  operator_price: number;
  subtotal: number;
  tenant_id: string;
  sort_order: number;
}

interface EquipmentRate {
  id: string;
  category: string;
  equipment: string;
  price_monthly: number;
  price_weekly: number;
  price_daily: number;
  operator_monthly: number;
  active: boolean;
}

interface ItemDraft {
  tempId: string;
  rate_id: string | null;
  description: string;
  category: string;
  period_type: string;
  quantity: number;
  unit_price: number;
  include_operator: boolean;
  operator_price: number;
}

const STATUS_STYLES: Record<string, string> = {
  borrador: 'bg-muted text-muted-foreground',
  enviada: 'bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold-bright))]',
  aprobada: 'bg-success-bg text-success',
  rechazada: 'bg-danger-bg text-danger',
};

const BIZ_STYLES: Record<string, { label: string; cls: string }> = {
  renta_equipos: { label: 'Renta', cls: 'bg-[#DBEAFE] text-[#1E40AF]' },
  ejecucion_proyectos: { label: 'Proyectos', cls: 'bg-success-bg text-success' },
};

function calcItemSubtotal(item: ItemDraft): number {
  return (item.unit_price + (item.include_operator ? item.operator_price : 0)) * item.quantity;
}

function getPriceByPeriod(rate: EquipmentRate, period: string): number {
  if (period === 'mensual') return rate.price_monthly || 0;
  if (period === 'semanal') return rate.price_weekly || 0;
  if (period === 'diario') return rate.price_daily || 0;
  return 0;
}

// ─── Main Page ───
export default function Cotizaciones() {
  usePageTitle('Cotizaciones');
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { log } = useLog();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [bizFilter, setBizFilter] = useState('todas');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editQuote, setEditQuote] = useState<QuotationRow | null>(null);
  const [detailQuote, setDetailQuote] = useState<QuotationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Queries
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations', user?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select('*, clients(name, tax_id, contact_email), projects(name)')
        .eq('tenant_id', user!.tenant_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as QuotationRow[];
    },
    enabled: !!user,
  });

  const { data: rates = [] } = useQuery({
    queryKey: ['equipment-rates', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('quote_equipment_rates')
        .select('*')
        .eq('tenant_id', user!.tenant_id)
        .eq('active', true)
        .order('category');
      return (data ?? []) as unknown as EquipmentRate[];
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, tax_id, contact_email')
        .eq('tenant_id', user!.tenant_id)
        .eq('status', 'activo')
        .order('name');
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list', user?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, client_id')
        .eq('tenant_id', user!.tenant_id)
        .order('name');
      return data ?? [];
    },
    enabled: !!user,
  });

  // Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const active = quotations.filter(q => q.status !== 'rechazada');
    const sent = quotations.filter(q => q.status === 'enviada');
    const approvedThisMonth = quotations.filter(q =>
      q.status === 'aprobada' && q.approved_at &&
      new Date(q.approved_at) >= monthStart && new Date(q.approved_at) <= monthEnd
    );
    const approvedTotal = approvedThisMonth.reduce((s, q) => s + Number(q.total || 0), 0);
    return { active: active.length, sent: sent.length, approvedMonth: approvedThisMonth.length, approvedTotal };
  }, [quotations]);

  // Filtered list
  const filtered = useMemo(() => {
    return quotations.filter(q => {
      if (statusFilter !== 'todos' && q.status !== statusFilter) return false;
      if (bizFilter !== 'todas' && q.business_line !== bizFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchNum = q.quote_number?.toLowerCase().includes(s);
        const matchTitle = q.title?.toLowerCase().includes(s);
        const matchClient = q.clients?.name?.toLowerCase().includes(s);
        if (!matchNum && !matchTitle && !matchClient) return false;
      }
      return true;
    });
  }, [quotations, statusFilter, bizFilter, search]);

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Cotización eliminada');
    },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('quotations').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      setSelectedIds([]);
      toast.success('Cotizaciones eliminadas');
    },
  });

  const clearFilters = () => {
    setSearch(''); setStatusFilter('todos'); setBizFilter('todas');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="font-barlow text-xl font-bold uppercase tracking-wider text-foreground">Cotizaciones</h1>
        <Button onClick={() => setShowCreate(true)} className="bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))] hover:bg-[hsl(var(--gold-bright))] gap-1.5">
          <Plus className="h-4 w-4" /> Nueva Cotización
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Cotizaciones Activas" value={metrics.active} />
        <StatCard label="Pendientes / Enviadas" value={metrics.sent} className="border-[hsl(var(--gold)/0.3)]" />
        <StatCard label="Aprobadas (mes)" value={metrics.approvedMonth} />
        <StatCard label="Valor Aprobado (mes)" value={formatCOPShort(metrics.approvedTotal)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="# COT, título, cliente..." />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bizFilter} onValueChange={setBizFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="Línea" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="renta_equipos">Renta de Equipos</SelectItem>
            <SelectItem value="ejecucion_proyectos">Ejecución Proyectos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs"><RotateCcw className="h-3 w-3" /> Limpiar</Button>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-primary/5 px-4 py-2 rounded-lg border border-primary/30">
          <span className="text-sm font-dm">{selectedIds.length} seleccionada(s)</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={e => setSelectedIds(e.target.checked ? filtered.map(q => q.id) : [])}
                    className="h-3.5 w-3.5 rounded border-border" />
                </TableHead>
                <TableHead># COT</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden sm:table-cell">Línea</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden md:table-cell">Validez</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground font-dm">No hay cotizaciones</TableCell></TableRow>
              ) : filtered.map(q => {
                const biz = BIZ_STYLES[q.business_line] || BIZ_STYLES.renta_equipos;
                const validUntil = q.created_at ? format(addDays(new Date(q.created_at), q.validity_days || 15), 'd MMM', { locale: es }) : '-';
                return (
                  <TableRow key={q.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailQuote(q)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(q.id)}
                        onChange={e => setSelectedIds(e.target.checked ? [...selectedIds, q.id] : selectedIds.filter(x => x !== q.id))}
                        className="h-3.5 w-3.5 rounded border-border" />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-foreground">{q.quote_number}</TableCell>
                    <TableCell className="font-dm text-sm">{q.clients?.name || '—'}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase font-dm', biz.cls)}>{biz.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase font-dm', STATUS_STYLES[q.status] || STATUS_STYLES.borrador)}>
                        {q.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-barlow font-semibold text-sm">{formatCOP(Number(q.total || 0))}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-dm">{validUntil}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-dm">
                      {q.created_at ? format(new Date(q.created_at), 'd MMM yyyy', { locale: es }) : '-'}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailQuote(q)} title="Ver"><Eye className="h-3.5 w-3.5" /></Button>
                        {['borrador', 'enviada'].includes(q.status) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditQuote(q)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(q)} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modals */}
      {(showCreate || editQuote) && (
        <QuoteFormModal
          open={true}
          onClose={() => { setShowCreate(false); setEditQuote(null); }}
          editData={editQuote}
          rates={rates}
          clients={clients}
          projects={projects}
          tenantId={user!.tenant_id}
          userId={user!.id}
        />
      )}

      {detailQuote && (
        <QuoteDetailModal
          open={true}
          onClose={() => setDetailQuote(null)}
          quote={detailQuote}
          onEdit={(q) => { setDetailQuote(null); setEditQuote(q); }}
          tenantId={user!.tenant_id}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleteTarget?.quote_number}?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => {
              if (deleteTarget) deleteMut.mutate(deleteTarget.id);
              setDeleteTarget(null);
            }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedIds.length} cotización(es)?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => {
              bulkDeleteMut.mutate(selectedIds);
              setBulkDeleteOpen(false);
            }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════
// FORM MODAL (Create / Edit)
// ═══════════════════════════════════════════
function QuoteFormModal({
  open, onClose, editData, rates, clients, projects, tenantId, userId
}: {
  open: boolean;
  onClose: () => void;
  editData: QuotationRow | null;
  rates: EquipmentRate[];
  clients: any[];
  projects: any[];
  tenantId: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const { log } = useLog();
  const isEdit = !!editData;

  const [bizLine, setBizLine] = useState(editData?.business_line || 'renta_equipos');
  const [title, setTitle] = useState(editData?.title || '');
  const [clientId, setClientId] = useState(editData?.client_id || '');
  const [projectId, setProjectId] = useState(editData?.project_id || '');
  const [validityDays, setValidityDays] = useState(editData?.validity_days ?? 15);
  const [notes, setNotes] = useState(editData?.notes || '');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [freight, setFreight] = useState(editData?.freight_amount ?? 0);
  const [discountPct, setDiscountPct] = useState(editData?.discount_pct ?? 0);
  const [ivaPct, setIvaPct] = useState(editData?.iva_pct ?? 19);
  const [saving, setSaving] = useState(false);
  const [loadedItems, setLoadedItems] = useState(false);

  // Load existing items when editing
  const { data: existingItems } = useQuery({
    queryKey: ['quotation-items', editData?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', editData!.id)
        .order('sort_order');
      return (data ?? []) as unknown as QuotationItemRow[];
    },
    enabled: isEdit && !loadedItems,
  });

  if (isEdit && existingItems && !loadedItems) {
    setItems(existingItems.map(it => ({
      tempId: it.id,
      rate_id: it.rate_id,
      description: it.description,
      category: it.category || '',
      period_type: it.period_type || 'mensual',
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      include_operator: it.include_operator,
      operator_price: Number(it.operator_price),
    })));
    setLoadedItems(true);
  }

  const filteredProjects = clientId
    ? projects.filter(p => p.client_id === clientId)
    : projects;

  // Totals calculation
  const itemsSubtotal = items.reduce((s, it) => s + calcItemSubtotal(it), 0);
  const discountAmount = itemsSubtotal * (discountPct / 100);
  const baseGravable = itemsSubtotal + freight - discountAmount;
  const ivaAmount = baseGravable * (ivaPct / 100);
  const grandTotal = baseGravable + ivaAmount;

  const addItem = () => {
    setItems(prev => [...prev, {
      tempId: crypto.randomUUID(),
      rate_id: null,
      description: '',
      category: '',
      period_type: 'mensual',
      quantity: 1,
      unit_price: 0,
      include_operator: false,
      operator_price: 0,
    }]);
  };

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const selectRate = (idx: number, rateId: string) => {
    const rate = rates.find(r => r.id === rateId);
    if (!rate) return;
    const period = items[idx].period_type || 'mensual';
    updateItem(idx, {
      rate_id: rateId,
      description: rate.equipment,
      category: rate.category,
      unit_price: getPriceByPeriod(rate, period),
      operator_price: rate.operator_monthly || 0,
    });
  };

  const changePeriod = (idx: number, period: string) => {
    const item = items[idx];
    const rate = item.rate_id ? rates.find(r => r.id === item.rate_id) : null;
    updateItem(idx, {
      period_type: period,
      ...(rate ? { unit_price: getPriceByPeriod(rate, period) } : {}),
    });
  };

  const handleSave = async (sendStatus?: 'enviada') => {
    if (!title.trim()) { toast.error('Ingresa un título'); return; }
    if (!clientId) { toast.error('Selecciona un cliente'); return; }
    if (bizLine === 'renta_equipos' && items.length === 0) { toast.error('Agrega al menos un equipo'); return; }

    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        client_id: clientId || null,
        project_id: projectId && projectId !== '__none__' ? projectId : null,
        business_line: bizLine,
        title,
        notes: notes || null,
        validity_days: validityDays,
        subtotal: itemsSubtotal,
        discount_pct: discountPct,
        discount_amount: discountAmount,
        freight_amount: freight,
        iva_pct: ivaPct,
        iva_amount: ivaAmount,
        total: grandTotal,
        status: sendStatus || (isEdit ? editData.status : 'borrador'),
        ...(sendStatus === 'enviada' ? { sent_at: new Date().toISOString() } : {}),
        ...(!isEdit ? { created_by: userId } : {}),
      };

      let quotationId: string;

      if (isEdit) {
        const { error } = await supabase.from('quotations').update(payload).eq('id', editData.id);
        if (error) throw error;
        quotationId = editData.id;

        // Delete old items
        await supabase.from('quotation_items').delete().eq('quotation_id', quotationId);
      } else {
        const { data, error } = await supabase.from('quotations').insert(payload).select('id').single();
        if (error) throw error;
        quotationId = data.id;
      }

      // Insert items
      if (items.length > 0) {
        const itemPayloads = items.map((it, idx) => ({
          quotation_id: quotationId,
          tenant_id: tenantId,
          rate_id: it.rate_id || null,
          description: it.description,
          category: it.category || null,
          period_type: it.period_type,
          quantity: it.quantity,
          unit_price: it.unit_price,
          include_operator: it.include_operator,
          operator_price: it.operator_price,
          subtotal: calcItemSubtotal(it),
          sort_order: idx,
        }));
        const { error: itemErr } = await supabase.from('quotation_items').insert(itemPayloads);
        if (itemErr) throw itemErr;
      }

      await log('cotizaciones', isEdit ? 'editar_cotizacion' : 'crear_cotizacion', 'quotation', quotationId, title);
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast.success(isEdit ? 'Cotización actualizada' : `Cotización creada${sendStatus === 'enviada' ? ' y marcada como enviada' : ''}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error guardando cotización');
    } finally {
      setSaving(false);
    }
  };

  const categories = [...new Set(rates.map(r => r.category))];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="font-barlow text-lg">{isEdit ? 'Editar Cotización' : 'Nueva Cotización'}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5">
          {/* Section 1: Header */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-dm font-medium text-muted-foreground mb-1.5 block">Línea de negocio *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBizLine('renta_equipos')}
                  className={cn('px-4 py-2 rounded-full text-sm font-dm font-medium transition-colors border',
                    bizLine === 'renta_equipos' ? 'bg-[#DBEAFE] text-[#1E40AF] border-[#93C5FD]' : 'bg-card text-muted-foreground border-border')}
                >🏗 Renta de Equipos</button>
                <button
                  type="button"
                  onClick={() => setBizLine('ejecucion_proyectos')}
                  className={cn('px-4 py-2 rounded-full text-sm font-dm font-medium transition-colors border',
                    bizLine === 'ejecucion_proyectos' ? 'bg-success-bg text-success border-success/30' : 'bg-card text-muted-foreground border-border')}
                >📋 Ejecución de Proyectos</button>
              </div>
            </div>

            {bizLine === 'ejecucion_proyectos' && (
              <div className="rounded-lg border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)] p-3 text-sm font-dm text-muted-foreground">
                ⚠️ Módulo en desarrollo — próximamente. Solo puedes guardar como borrador.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-dm font-medium text-muted-foreground">Título *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Alquiler Telehandler JCB - Proyecto Solar" />
              </div>
              <div>
                <label className="text-xs font-dm font-medium text-muted-foreground">Cliente *</label>
                <Select value={clientId} onValueChange={v => { setClientId(v); setProjectId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-dm font-medium text-muted-foreground">Proyecto</label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ninguno</SelectItem>
                    {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-dm font-medium text-muted-foreground">Validez (días)</label>
                <Input type="number" value={validityDays} onChange={e => setValidityDays(parseInt(e.target.value) || 15)} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-dm font-medium text-muted-foreground">Notas internas</label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="No aparecen en el PDF" />
              </div>
            </div>
          </div>

          {/* Section 2: Items */}
          {bizLine === 'renta_equipos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-foreground">Equipos</h3>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Agregar equipo
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground font-dm border border-dashed border-border rounded-lg">
                  Haz clic en "Agregar equipo" para comenzar
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={item.tempId} className="rounded-lg border border-border bg-card p-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                        {/* Equipment selector */}
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-dm text-muted-foreground">Equipo</label>
                          <Select value={item.rate_id || 'custom'} onValueChange={v => v === 'custom' ? updateItem(idx, { rate_id: null }) : selectRate(idx, v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">✏️ Personalizado</SelectItem>
                              {categories.map(cat => (
                                <React.Fragment key={cat}>
                                  <SelectItem value={`_cat_${cat}`} disabled className="font-bold text-xs opacity-60">{cat}</SelectItem>
                                  {rates.filter(r => r.category === cat).map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.equipment}</SelectItem>
                                  ))}
                                </React.Fragment>
                              ))}
                            </SelectContent>
                          </Select>
                          {!item.rate_id && (
                            <Input className="mt-1 h-8 text-xs" value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="Descripción" />
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-dm text-muted-foreground">Período</label>
                          <Select value={item.period_type} onValueChange={v => changePeriod(idx, v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="diario">Diario</SelectItem>
                              <SelectItem value="semanal">Semanal</SelectItem>
                              <SelectItem value="mensual">Mensual</SelectItem>
                              <SelectItem value="global">Global</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] font-dm text-muted-foreground">Cant.</label>
                          <Input type="number" min={1} className="h-8 text-xs" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 1 })} />
                        </div>
                        <div>
                          <label className="text-[10px] font-dm text-muted-foreground">Precio Unit.</label>
                          <Input type="number" className="h-8 text-xs" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-dm text-muted-foreground">Subtotal</label>
                            <div className="h-8 flex items-center text-xs font-barlow font-semibold text-foreground">
                              {formatCOP(calcItemSubtotal(item))}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeItem(idx)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {/* Operator toggle */}
                      <div className="flex items-center gap-3">
                        <Checkbox checked={item.include_operator} onCheckedChange={v => updateItem(idx, { include_operator: !!v })} id={`op-${idx}`} />
                        <label htmlFor={`op-${idx}`} className="text-xs font-dm text-muted-foreground cursor-pointer">Incluir operador</label>
                        {item.include_operator && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-dm">$/mes:</span>
                            <Input type="number" className="h-7 w-28 text-xs" value={item.operator_price} onChange={e => updateItem(idx, { operator_price: parseFloat(e.target.value) || 0 })} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Totals */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <h3 className="font-barlow text-sm font-semibold uppercase tracking-wider text-foreground mb-3">Resumen</h3>
            <div className="space-y-1.5 text-sm font-dm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal equipos</span>
                <span className="font-barlow font-semibold">{formatCOP(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">+ Flete / Transporte</span>
                  <Input type="number" className="h-7 w-32 text-xs" value={freight} onChange={e => setFreight(parseFloat(e.target.value) || 0)} />
                </div>
                <span className="font-barlow font-semibold">{formatCOP(freight)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">- Descuento</span>
                  <Input type="number" className="h-7 w-20 text-xs" value={discountPct} onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)} />
                  <span className="text-[10px] text-muted-foreground">%</span>
                </div>
                <span className="font-barlow font-semibold text-danger">-{formatCOP(discountAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <span className="text-muted-foreground">= Base gravable</span>
                <span className="font-barlow font-semibold">{formatCOP(baseGravable)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">+ IVA</span>
                  <Input type="number" className="h-7 w-20 text-xs" value={ivaPct} onChange={e => setIvaPct(parseFloat(e.target.value) || 0)} />
                  <span className="text-[10px] text-muted-foreground">%</span>
                </div>
                <span className="font-barlow font-semibold">{formatCOP(ivaAmount)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-foreground/20 pt-2 mt-2">
                <span className="font-barlow font-bold text-base uppercase">Total</span>
                <span className="font-barlow font-bold text-lg text-[hsl(var(--gold-bright))]">{formatCOP(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => handleSave()} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar borrador'}
            </Button>
            {bizLine !== 'ejecucion_proyectos' && (
              <Button onClick={() => handleSave('enviada')} disabled={saving}
                className="bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))] hover:bg-[hsl(var(--gold-bright))] gap-1">
                <Send className="h-3.5 w-3.5" /> Guardar y enviar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Need React import for Fragment
import React from 'react';

// ═══════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════
function QuoteDetailModal({
  open, onClose, quote, onEdit, tenantId
}: {
  open: boolean;
  onClose: () => void;
  quote: QuotationRow;
  onEdit: (q: QuotationRow) => void;
  tenantId: string;
}) {
  const qc = useQueryClient();
  const { log } = useLog();
  const [tab, setTab] = useState('resumen');
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(quote.clients?.contact_email || '');
  const [sendSubject, setSendSubject] = useState(`Cotización ${quote.quote_number} — Up & Down Lift Co. S.A.S.`);
  const [sendMessage, setSendMessage] = useState(
    `Estimado(a),\n\nAdjunto encontrará la cotización ${quote.quote_number} correspondiente a ${quote.title || 'nuestros servicios'}.\n\nQuedamos atentos a sus comentarios.\n\nCordialmente,\nUp & Down Lift Co. S.A.S.`
  );

  const { data: items = [] } = useQuery({
    queryKey: ['quotation-items', quote.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quote.id)
        .order('sort_order');
      return (data ?? []) as unknown as QuotationItemRow[];
    },
  });

  const handleApprove = async () => {
    await supabase.from('quotations').update({ status: 'aprobada', approved_at: new Date().toISOString() }).eq('id', quote.id);
    await log('cotizaciones', 'aprobar_cotizacion', 'quotation', quote.id, quote.quote_number || '');
    qc.invalidateQueries({ queryKey: ['quotations'] });
    toast.success('Cotización aprobada');
    setApproveOpen(false);
    onClose();
  };

  const handleReject = async () => {
    if (rejectReason.length < 10) { toast.error('Motivo mínimo 10 caracteres'); return; }
    await supabase.from('quotations').update({ status: 'rechazada', rejection_reason: rejectReason, rejected_at: new Date().toISOString() }).eq('id', quote.id);
    await log('cotizaciones', 'rechazar_cotizacion', 'quotation', quote.id, quote.quote_number || '');
    qc.invalidateQueries({ queryKey: ['quotations'] });
    toast.success('Cotización rechazada');
    setRejectOpen(false);
    onClose();
  };

  const handleSendEmail = async () => {
    // Mark as sent
    await supabase.from('quotations').update({ status: 'enviada', sent_at: new Date().toISOString() }).eq('id', quote.id);
    await log('cotizaciones', 'enviar_cotizacion', 'quotation', quote.id, quote.quote_number || '');
    qc.invalidateQueries({ queryKey: ['quotations'] });
    toast.success('Cotización marcada como enviada. Recuerda enviar el PDF manualmente al correo del cliente.');
    setSendOpen(false);
    onClose();
  };

  const generatePDF = () => {
    const doc = new jsPDF('p', 'mm', 'letter');
    const pw = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('UP & DOWN LIFT CO. S.A.S.', 15, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('NIT: 901003077-9', 15, y);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('COTIZACIÓN', pw - 15, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.text(quote.quote_number || '', pw - 15, 27, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Fecha: ${quote.created_at ? format(new Date(quote.created_at), 'd MMM yyyy', { locale: es }) : '-'}`, pw - 15, 33, { align: 'right' });
    doc.text(`Válida por ${quote.validity_days} días`, pw - 15, 38, { align: 'right' });

    y += 12;
    doc.setDrawColor(200);
    doc.line(15, y, pw - 15, y);
    y += 8;

    // Client
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Señores:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.clients?.name || '—', 40, y);
    y += 5;
    if (quote.clients?.tax_id) {
      doc.setFont('helvetica', 'bold');
      doc.text('NIT:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.clients.tax_id, 40, y);
      y += 5;
    }
    if (quote.projects?.name) {
      doc.setFont('helvetica', 'bold');
      doc.text('Proyecto:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.projects.name, 40, y);
      y += 5;
    }
    if (quote.title) {
      doc.setFont('helvetica', 'bold');
      doc.text('Ref:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.title, 40, y);
      y += 5;
    }

    y += 5;

    // Items table header
    const cols = [15, 25, 95, 120, 135, 155, pw - 15];
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 4, pw - 30, 7, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('#', cols[0], y);
    doc.text('Descripción', cols[1], y);
    doc.text('Período', cols[2], y);
    doc.text('Cant.', cols[3], y);
    doc.text('Precio Unit.', cols[4], y);
    doc.text('Subtotal', cols[5], y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    items.forEach((it, idx) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.text(String(idx + 1), cols[0], y);
      doc.text(it.description.substring(0, 40), cols[1], y);
      doc.text(it.period_type || '', cols[2], y);
      doc.text(String(it.quantity), cols[3], y);
      doc.text(formatCOP(Number(it.unit_price)), cols[4], y);
      doc.text(formatCOP(Number(it.subtotal)), cols[5], y, { align: 'right' });
      if (it.include_operator) {
        y += 4;
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text(`  + Operador: ${formatCOP(Number(it.operator_price))}/mes`, cols[1], y);
        doc.setTextColor(0);
        doc.setFontSize(7);
      }
      y += 5;
    });

    y += 5;
    doc.line(15, y, pw - 15, y);
    y += 6;

    // Totals
    const rx = pw - 15;
    doc.setFontSize(8);
    doc.text('Subtotal:', rx - 60, y);
    doc.text(formatCOP(Number(quote.subtotal)), rx, y, { align: 'right' });
    y += 5;
    if (Number(quote.freight_amount) > 0) {
      doc.text('Flete / Transporte:', rx - 60, y);
      doc.text(formatCOP(Number(quote.freight_amount)), rx, y, { align: 'right' });
      y += 5;
    }
    if (Number(quote.discount_pct) > 0) {
      doc.text(`Descuento (${quote.discount_pct}%):`, rx - 60, y);
      doc.text(`-${formatCOP(Number(quote.discount_amount))}`, rx, y, { align: 'right' });
      y += 5;
    }
    doc.text(`IVA (${quote.iva_pct}%):`, rx - 60, y);
    doc.text(formatCOP(Number(quote.iva_amount)), rx, y, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL:', rx - 60, y);
    doc.text(formatCOP(Number(quote.total)), rx, y, { align: 'right' });

    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100);
    const validUntil = quote.created_at ? format(addDays(new Date(quote.created_at), quote.validity_days || 15), 'd MMM yyyy', { locale: es }) : '-';
    doc.text(`Válida hasta: ${validUntil}`, 15, y);
    y += 4;
    doc.text('Up & Down Lift Co. S.A.S. — Contacto: info@updownlift.com', 15, y);

    const clientName = (quote.clients?.name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`${quote.quote_number}_${clientName}.pdf`);
  };

  const biz = BIZ_STYLES[quote.business_line] || BIZ_STYLES.renta_equipos;
  const validUntil = quote.created_at ? format(addDays(new Date(quote.created_at), quote.validity_days || 15), 'd MMM yyyy', { locale: es }) : '-';

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-3 flex-wrap">
              <DialogTitle className="font-barlow text-lg">{quote.quote_number}</DialogTitle>
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase font-dm', STATUS_STYLES[quote.status])}>
                {quote.status}
              </span>
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase font-dm', biz.cls)}>
                {biz.label}
              </span>
            </div>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab} className="px-5 py-3">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="pdf">PDF Preview</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-4 space-y-4">
              {/* Info grid */}
              {quote.title && <h2 className="font-barlow font-semibold text-base text-foreground">{quote.title}</h2>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm font-dm">
                <div><span className="text-muted-foreground text-xs">Cliente</span><p className="font-medium">{quote.clients?.name || '—'}</p></div>
                {quote.clients?.tax_id && <div><span className="text-muted-foreground text-xs">NIT</span><p className="font-medium">{quote.clients.tax_id}</p></div>}
                {quote.projects?.name && <div><span className="text-muted-foreground text-xs">Proyecto</span><p className="font-medium">{quote.projects.name}</p></div>}
                <div><span className="text-muted-foreground text-xs">Fecha</span><p className="font-medium">{quote.created_at ? format(new Date(quote.created_at), 'd MMM yyyy', { locale: es }) : '-'}</p></div>
                <div><span className="text-muted-foreground text-xs">Válida hasta</span><p className="font-medium">{validUntil}</p></div>
              </div>

              {/* Items table */}
              {items.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Operador</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(it => (
                        <TableRow key={it.id}>
                          <TableCell className="font-dm text-sm">{it.description}</TableCell>
                          <TableCell className="text-xs capitalize">{it.period_type}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right font-barlow text-sm">{formatCOP(Number(it.unit_price))}</TableCell>
                          <TableCell className="text-right font-barlow text-sm">{it.include_operator ? formatCOP(Number(it.operator_price)) : '—'}</TableCell>
                          <TableCell className="text-right font-barlow font-semibold text-sm">{formatCOP(Number(it.subtotal))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totals */}
              <div className="rounded-lg border border-border p-3 space-y-1 text-sm font-dm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-barlow font-semibold">{formatCOP(Number(quote.subtotal))}</span></div>
                {Number(quote.freight_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Flete</span><span className="font-barlow">{formatCOP(Number(quote.freight_amount))}</span></div>}
                {Number(quote.discount_pct) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Descuento ({quote.discount_pct}%)</span><span className="font-barlow text-danger">-{formatCOP(Number(quote.discount_amount))}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">IVA ({quote.iva_pct}%)</span><span className="font-barlow">{formatCOP(Number(quote.iva_amount))}</span></div>
                <div className="flex justify-between border-t pt-2 mt-1"><span className="font-barlow font-bold">TOTAL</span><span className="font-barlow font-bold text-lg text-[hsl(var(--gold-bright))]">{formatCOP(Number(quote.total))}</span></div>
              </div>

              {quote.notes && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground font-dm">Notas internas</p>
                  <p className="text-sm font-dm mt-1">{quote.notes}</p>
                </div>
              )}

              {quote.status === 'rechazada' && quote.rejection_reason && (
                <div className="rounded-lg bg-danger-bg p-3 border border-danger/20">
                  <p className="text-xs font-dm font-semibold text-danger">Motivo de rechazo</p>
                  <p className="text-sm font-dm mt-1 text-foreground">{quote.rejection_reason}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                {quote.status === 'borrador' && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => onEdit(quote)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                    <Button size="sm" className="gap-1 bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))]" onClick={() => setSendOpen(true)}><Send className="h-3.5 w-3.5" /> Enviar al cliente</Button>
                  </>
                )}
                {quote.status === 'enviada' && (
                  <>
                    <Button size="sm" className="gap-1 bg-success text-white hover:bg-success/90" onClick={() => setApproveOpen(true)}><CheckCircle className="h-3.5 w-3.5" /> Aprobar</Button>
                    <Button variant="destructive" size="sm" className="gap-1" onClick={() => setRejectOpen(true)}><XCircle className="h-3.5 w-3.5" /> Rechazar</Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setSendOpen(true)}><Send className="h-3.5 w-3.5" /> Reenviar</Button>
                  </>
                )}
                {quote.status === 'aprobada' && (
                  <span className="text-sm font-dm text-success font-medium">✅ Aprobada el {quote.approved_at ? format(new Date(quote.approved_at), 'd MMM yyyy', { locale: es }) : '-'}</span>
                )}
                <Button variant="outline" size="sm" className="gap-1 ml-auto" onClick={generatePDF}><FileDown className="h-3.5 w-3.5" /> Descargar PDF</Button>
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="mt-4 space-y-3">
              <p className="text-sm font-dm text-muted-foreground">Vista previa del PDF generado</p>
              <Button onClick={generatePDF} className="gap-1.5 bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))]">
                <Download className="h-4 w-4" /> Descargar PDF
              </Button>
              <div className="text-xs font-dm text-muted-foreground">
                Nombre: {quote.quote_number}_{(quote.clients?.name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf
              </div>
            </TabsContent>

            <TabsContent value="historial" className="mt-4">
              <div className="space-y-3">
                <TimelineItem icon="📝" label="Creada" date={quote.created_at} />
                {quote.sent_at && <TimelineItem icon="📨" label="Enviada" date={quote.sent_at} />}
                {quote.approved_at && <TimelineItem icon="✅" label="Aprobada" date={quote.approved_at} />}
                {quote.rejected_at && <TimelineItem icon="❌" label="Rechazada" date={quote.rejected_at} note={quote.rejection_reason} />}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Approve confirm */}
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar {quote.quote_number}?</AlertDialogTitle>
            <AlertDialogDescription>La cotización se marcará como aprobada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-success text-white" onClick={handleApprove}>Aprobar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rechazar {quote.quote_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-xs font-dm font-medium text-muted-foreground">Motivo del rechazo *</label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Mínimo 10 caracteres" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleReject}>Rechazar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send email modal */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Enviar cotización</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-dm font-medium text-muted-foreground">Para *</label>
              <Input value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="email@cliente.com" />
            </div>
            <div>
              <label className="text-xs font-dm font-medium text-muted-foreground">Asunto *</label>
              <Input value={sendSubject} onChange={e => setSendSubject(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-dm font-medium text-muted-foreground">Mensaje</label>
              <Textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)} rows={5} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSendOpen(false)}>Cancelar</Button>
              <Button onClick={handleSendEmail} className="bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))] gap-1">
                <Send className="h-3.5 w-3.5" /> Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TimelineItem({ icon, label, date, note }: { icon: string; label: string; date: string | null; note?: string | null }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="font-dm text-sm font-medium text-foreground">{label}</p>
        {date && <p className="text-xs text-muted-foreground font-dm">{format(new Date(date), 'd MMM yyyy, HH:mm', { locale: es })}</p>}
        {note && <p className="text-xs text-muted-foreground font-dm mt-0.5">"{note}"</p>}
      </div>
    </div>
  );
}
