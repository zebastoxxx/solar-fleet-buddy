import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useLog } from '@/hooks/useLog';
import { useOTTimerStore, useChrono } from '@/stores/otTimerStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { LogOut, ChevronLeft, ChevronRight, Camera, Mic, MicOff, Plus, Pause, Play, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = { preventivo: 'Preventivo', correctivo: 'Correctivo', inspeccion: 'Inspección', preparacion: 'Preparación' };
const TYPE_STYLES: Record<string, string> = {
  preventivo: 'bg-[#DBEAFE] text-[#1D4ED8]', correctivo: 'bg-[#FDDEDE] text-[#C0392B]',
  inspeccion: 'bg-[#D1FAE5] text-[#065F46]', preparacion: 'bg-[#FEF3C7] text-[#D97706]',
};

function formatCost(n: number) {
  if (!n) return '$0';
  return `$${n.toLocaleString()}`;
}

// ─── LIST VIEW ───
export default function MisOT() {
  const { id } = useParams();
  if (id) return <OTActiveView otId={id} />;
  return <MisOTList />;
}

function MisOTList() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const timerStore = useOTTimerStore();
  const chrono = useChrono();

  const { data: personnelId } = useQuery({
    queryKey: ['my-personnel-id', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('id').eq('user_id', user!.id).single();
      return data?.id || null;
    },
    enabled: !!user?.id,
  });

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['my-work-orders', personnelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('work_order_technicians')
        .select('work_order_id')
        .eq('personnel_id', personnelId!);
      if (!data || data.length === 0) return [];
      const ids = data.map((d: any) => d.work_order_id);
      const { data: ots } = await supabase
        .from('work_orders')
        .select(`*, machines!work_orders_machine_id_fkey(name, internal_code, type), projects!work_orders_project_id_fkey(name)`)
        .in('id', ids)
        .not('status', 'eq', 'firmada')
        .order('created_at', { ascending: false });
      return ots || [];
    },
    enabled: !!personnelId,
  });

  const sorted = [...workOrders].sort((a: any, b: any) => {
    const sOrder: Record<string, number> = { en_curso: 1, pausada: 2, asignada: 3, creada: 4, cerrada: 5 };
    return (sOrder[a.status] || 9) - (sOrder[b.status] || 9);
  });

  const pending = sorted.filter((ot: any) => ['asignada', 'creada'].includes(ot.status));
  const active = sorted.filter((ot: any) => ['en_curso', 'pausada'].includes(ot.status));

  // History
  const { data: history = [] } = useQuery({
    queryKey: ['my-ot-history', personnelId],
    queryFn: async () => {
      const { data: links } = await supabase.from('work_order_technicians').select('work_order_id').eq('personnel_id', personnelId!);
      if (!links || links.length === 0) return [];
      const ids = links.map((d: any) => d.work_order_id);
      const { data } = await supabase.from('work_orders')
        .select(`*, machines!work_orders_machine_id_fkey(name, internal_code)`)
        .in('id', ids).in('status', ['cerrada', 'firmada']).order('closed_at', { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!personnelId,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div>
          <h1 className="font-barlow text-[hsl(var(--gold-bright))] text-lg font-semibold uppercase">Mis Órdenes</h1>
          <p className="text-xs text-muted-foreground font-dm">{user?.full_name}</p>
        </div>
        <button onClick={() => signOut()} className="text-muted-foreground hover:text-foreground"><LogOut className="h-5 w-5" /></button>
      </div>

      <div className="p-4 space-y-4">
        {/* Active OT card */}
        {timerStore.status !== 'idle' && timerStore.activeOTId && (
          <div className="p-4 rounded-xl border-2 border-[hsl(var(--gold))] bg-gradient-to-br from-[hsl(var(--gold)/0.05)] to-[hsl(var(--gold)/0.15)]">
            <p className="font-barlow text-xs uppercase text-muted-foreground mb-1">OT en curso</p>
            <p className="font-barlow text-xl font-semibold text-[hsl(var(--gold-bright))]">{timerStore.activeOTCode}</p>
            <p className="text-sm font-dm">{timerStore.machineName}</p>
            <p className={cn('font-barlow text-2xl font-bold mt-2', timerStore.status === 'running' ? 'text-[hsl(var(--gold-bright))]' : 'text-muted-foreground')}>
              ⏱ {chrono}
            </p>
            <Button className="w-full mt-3 h-10 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase text-xs"
              onClick={() => navigate(`/mis-ot/${timerStore.activeOTId}`)}>
              Ver OT →
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : (
          <>
            {/* Active/Paused */}
            {active.map((ot: any) => timerStore.activeOTId !== ot.id && (
              <OTCard key={ot.id} ot={ot} onClick={() => navigate(`/mis-ot/${ot.id}`)} />
            ))}

            {/* Pending */}
            {pending.length > 0 && (
              <>
                <p className="font-barlow text-xs uppercase text-muted-foreground pt-2">Pendientes ({pending.length})</p>
                {pending.map((ot: any) => <OTCard key={ot.id} ot={ot} onClick={() => navigate(`/mis-ot/${ot.id}`)} />)}
              </>
            )}

            {sorted.length === 0 && !timerStore.activeOTId && (
              <div className="text-center py-12">
                <Clock className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-dm">No tienes órdenes de trabajo asignadas</p>
                <p className="text-xs text-muted-foreground/60 font-dm mt-1">Contacta a tu supervisor para recibir asignaciones</p>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <>
                <p className="font-barlow text-xs uppercase text-muted-foreground pt-4">Historial</p>
                {history.map((ot: any) => (
                  <div key={ot.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div>
                      <p className="text-sm font-dm font-semibold">{ot.code} · {ot.machines?.name || ''}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={ot.status} />
                        <span className="text-[11px] text-muted-foreground font-dm">{ot.actual_hours || 0}h · {formatCost(ot.total_cost)}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-dm">{ot.closed_at ? format(new Date(ot.closed_at), 'dd MMM', { locale: es }) : ''}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OTCard({ ot, onClick }: { ot: any; onClick: () => void }) {
  const priorityBorder: Record<string, string> = {
    critica: 'border-l-4 border-l-[#EF4444]',
    urgente: 'border-l-4 border-l-[#EA580C]',
    normal: 'border-l-4 border-l-border',
  };
  return (
    <button onClick={onClick} className={cn('w-full text-left p-4 rounded-xl border border-border bg-card transition-colors hover:bg-muted/50', priorityBorder[ot.priority] || '')}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-barlow text-sm font-semibold text-[hsl(var(--gold-bright))]">{ot.code}</p>
          <p className="text-sm font-dm">{ot.machines?.name || '—'} [{ot.machines?.internal_code || ''}]</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={cn('inline-flex items-center rounded-[20px] px-2 py-0.5 text-[10px] font-semibold font-dm', TYPE_STYLES[ot.type] || 'bg-muted text-muted-foreground')}>
          {TYPE_LABELS[ot.type] || ot.type}
        </span>
        <StatusBadge status={ot.status} />
        {ot.projects?.name && <span className="text-[11px] text-muted-foreground font-dm truncate">{ot.projects.name}</span>}
      </div>
      {ot.estimated_hours && <p className="text-[11px] text-muted-foreground font-dm mt-1">~{ot.estimated_hours}h estimadas</p>}
    </button>
  );
}

// ─── ACTIVE OT VIEW ───
function OTActiveView({ otId }: { otId: string }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { log } = useLog();
  const qc = useQueryClient();
  const timerStore = useOTTimerStore();
  const chrono = useChrono();

  const [pauseOpen, setPauseOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [customPause, setCustomPause] = useState('');
  const [photoTab, setPhotoTab] = useState<'antes' | 'durante' | 'despues'>('antes');
  const [notes, setNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [partsSheetOpen, setPartsSheetOpen] = useState(false);
  const [partsSearch, setPartsSearch] = useState('');
  const [selectedConsumable, setSelectedConsumable] = useState<any>(null);
  const [partQty, setPartQty] = useState('1');

  // Get personnel id
  const { data: personnelId } = useQuery({
    queryKey: ['my-personnel-id', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('id, hourly_rate').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch OT
  const { data: ot, isLoading } = useQuery({
    queryKey: ['ot-detail', otId],
    queryFn: async () => {
      const { data } = await supabase.from('work_orders')
        .select(`*, machines!work_orders_machine_id_fkey(name, internal_code, type), projects!work_orders_project_id_fkey(name)`)
        .eq('id', otId).single();
      return data;
    },
    enabled: !!otId,
  });

  // Photos
  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['ot-photos-tech', otId],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_photos').select('*').eq('work_order_id', otId).order('uploaded_at');
      return data || [];
    },
    enabled: !!otId,
  });

  // Parts
  const { data: usedParts = [], refetch: refetchParts } = useQuery({
    queryKey: ['ot-parts-tech', otId],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_parts')
        .select('*, inventory_consumables!work_order_parts_consumable_id_fkey(name, unit)')
        .eq('work_order_id', otId);
      return data || [];
    },
    enabled: !!otId,
  });

  // Consumables search
  const { data: consumables = [] } = useQuery({
    queryKey: ['consumables-search', partsSearch, user?.tenant_id],
    queryFn: async () => {
      let q = supabase.from('inventory_consumables').select('*').eq('tenant_id', user!.tenant_id).eq('active', true);
      if (partsSearch) q = q.ilike('name', `%${partsSearch}%`);
      const { data } = await q.limit(20);
      return data || [];
    },
    enabled: partsSheetOpen && !!user?.tenant_id,
  });

  useEffect(() => {
    if (ot?.technician_notes) setNotes(ot.technician_notes);
  }, [ot?.technician_notes]);

  if (isLoading || !ot) return <div className="p-6"><Skeleton className="h-40 w-full rounded-xl" /></div>;

  const handleStart = async () => {
    if (timerStore.status !== 'idle' && timerStore.activeOTId !== otId) {
      toast.error('Ya tienes una OT en curso');
      return;
    }
    await supabase.from('work_orders').update({ status: 'en_curso' as any, started_at: new Date().toISOString() }).eq('id', otId);
    await supabase.from('work_order_timers').insert([{ work_order_id: otId, personnel_id: personnelId?.id, event_type: 'inicio' }]);
    timerStore.startTimer(otId, ot.code, ot.machines?.name || '');
    await log('ordenes-trabajo', 'iniciar_ot', 'work_order', otId, ot.code);
    toast.success('OT iniciada');
    qc.invalidateQueries({ queryKey: ['ot-detail', otId] });
    qc.invalidateQueries({ queryKey: ['my-work-orders'] });
  };

  const handlePause = async () => {
    const reason = pauseReason === 'otro' ? customPause : pauseReason;
    await supabase.from('work_orders').update({ status: 'pausada' as any }).eq('id', otId);
    await supabase.from('work_order_timers').insert([{ work_order_id: otId, personnel_id: personnelId?.id, event_type: 'pausa', pause_reason: reason }]);
    timerStore.pauseTimer();
    await log('ordenes-trabajo', 'pausar_ot', 'work_order', otId, ot.code);
    toast.success('OT pausada');
    setPauseOpen(false);
    setPauseReason('');
    qc.invalidateQueries({ queryKey: ['ot-detail', otId] });
  };

  const handleResume = async () => {
    await supabase.from('work_orders').update({ status: 'en_curso' as any }).eq('id', otId);
    await supabase.from('work_order_timers').insert([{ work_order_id: otId, personnel_id: personnelId?.id, event_type: 'reanudacion' }]);
    timerStore.resumeTimer();
    await log('ordenes-trabajo', 'reanudar_ot', 'work_order', otId, ot.code);
    toast.success('OT reanudada');
    qc.invalidateQueries({ queryKey: ['ot-detail', otId] });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const path = `${user!.tenant_id}/${otId}/${photoTab}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from('ot-photos').upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('ot-photos').getPublicUrl(path);
      await supabase.from('work_order_photos').insert([{
        work_order_id: otId, photo_url: urlData.publicUrl, photo_type: photoTab, uploaded_by: user!.id,
      }]);
      toast.success('Foto subida');
      refetchPhotos();
    } catch (err: any) {
      toast.error(err.message || 'Error al subir foto');
    }
  };

  const handleAddPart = async () => {
    if (!selectedConsumable || !partQty) return;
    const qty = parseFloat(partQty);
    try {
      await supabase.from('work_order_parts').insert([{
        work_order_id: otId, consumable_id: selectedConsumable.id,
        quantity: qty, unit_cost: selectedConsumable.unit_cost || 0, registered_by: user!.id,
      }]);
      // Decrease stock
      const newStock = (selectedConsumable.stock_current || 0) - qty;
      await supabase.from('inventory_consumables').update({ stock_current: Math.max(0, newStock) }).eq('id', selectedConsumable.id);
      // Check minimum
      if (newStock <= (selectedConsumable.stock_minimum || 0)) {
        await supabase.from('alerts').insert([{
          tenant_id: user!.tenant_id, type: 'stock_minimo', severity: 'warning',
          message: `Stock mínimo alcanzado: ${selectedConsumable.name}`,
        }]);
      }
      // Update parts cost
      const totalPartsCost = usedParts.reduce((s: number, p: any) => s + (p.quantity * (p.unit_cost || 0)), 0) + (qty * (selectedConsumable.unit_cost || 0));
      await supabase.from('work_orders').update({ parts_cost: totalPartsCost }).eq('id', otId);

      toast.success('Repuesto agregado');
      setSelectedConsumable(null); setPartQty('1'); setPartsSheetOpen(false);
      refetchParts();
    } catch (err: any) { toast.error(err.message); }
  };

  // Speech recognition
  const toggleSpeech = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.onresult = (e: any) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setNotes(prev => prev + ' ' + transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const hasSpeech = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const filteredPhotos = photos.filter((p: any) => p.photo_type === photoTab);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate('/mis-ot')} className="flex items-center gap-1 text-sm text-muted-foreground font-dm">
          <ChevronLeft className="h-4 w-4" /> Mis OT
        </button>
        <span className="font-barlow font-semibold text-[hsl(var(--gold-bright))]">{ot.code}</span>
        {ot.priority === 'critica' && <Badge className="bg-[#FDDEDE] text-[#C0392B] text-[10px]">🚨 Crítica</Badge>}
        {ot.priority === 'urgente' && <Badge className="bg-[#FFEDD5] text-[#EA580C] text-[10px]">⚡ Urgente</Badge>}
      </div>

      <div className="p-4 space-y-6">
        {/* Machine info */}
        <div className="text-center">
          <p className="font-barlow text-2xl font-semibold">{ot.machines?.name || '—'}</p>
          <p className="text-sm text-muted-foreground font-dm">{ot.machines?.internal_code}</p>
          {ot.projects?.name && <p className="text-xs text-[hsl(var(--gold-bright))] font-dm mt-1">{ot.projects.name}</p>}
        </div>

        {/* Chrono */}
        {timerStore.activeOTId === otId && (
          <div className="text-center">
            <p className={cn('font-barlow text-[56px] font-bold leading-none',
              timerStore.status === 'running' ? 'text-[hsl(var(--gold-bright))]' : 'text-muted-foreground')}>
              {chrono}
            </p>
            <p className="text-[11px] text-muted-foreground font-barlow uppercase mt-1">tiempo trabajado</p>
          </div>
        )}

        <div className="text-center"><StatusBadge status={ot.status} /></div>

        {/* Photos */}
        <div>
          <p className="font-barlow text-xs uppercase text-muted-foreground mb-2">Fotos del trabajo</p>
          <div className="flex gap-2 mb-2">
            {(['antes', 'durante', 'despues'] as const).map(tab => (
              <button key={tab} onClick={() => setPhotoTab(tab)}
                className={cn('flex-1 py-1.5 rounded-lg text-xs font-dm font-semibold capitalize',
                  photoTab === tab ? 'bg-[hsl(var(--gold)/0.1)] text-[hsl(var(--gold-bright))] border border-[hsl(var(--gold))]' : 'bg-muted text-muted-foreground')}>
                {tab === 'despues' ? 'Después' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {filteredPhotos.map((p: any) => (
              <div key={p.id} className="aspect-square rounded-lg overflow-hidden border border-border">
                <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
              <Camera className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground font-dm">Agregar</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
        </div>

        {/* Parts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-barlow text-xs uppercase text-muted-foreground">Repuestos usados</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPartsSheetOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Agregar
            </Button>
          </div>
          {usedParts.length > 0 ? (
            <div className="space-y-1">
              {usedParts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-xs font-dm p-2 rounded-lg bg-muted/50">
                  <span>{p.inventory_consumables?.name || '—'} × {p.quantity}</span>
                  <span>{formatCost((p.quantity || 0) * (p.unit_cost || 0))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground font-dm">Sin repuestos registrados</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-barlow text-xs uppercase text-muted-foreground">Notas técnicas</p>
            {hasSpeech && (
              <Button variant={isRecording ? 'destructive' : 'ghost'} size="sm" className="h-7 text-xs" onClick={toggleSpeech}>
                {isRecording ? <><MicOff className="h-3.5 w-3.5 mr-1" />Grabando...</> : <><Mic className="h-3.5 w-3.5 mr-1" />Dictar</>}
              </Button>
            )}
          </div>
          <Textarea placeholder="Describe lo que encontraste y lo que hiciste..." value={notes}
            onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>

      {/* Sticky bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex gap-3 z-40">
        {ot.status === 'asignada' && (
          <Button className="flex-1 h-[52px] bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase" onClick={handleStart}>
            <Play className="h-5 w-5 mr-2" /> Iniciar OT
          </Button>
        )}

        {ot.status === 'en_curso' && (
          <>
            <Button className="flex-1 h-[52px] border-2 border-border font-barlow uppercase" variant="outline" onClick={() => setPauseOpen(true)}>
              <Pause className="h-5 w-5 mr-2" /> Pausar
            </Button>
            <Button className="flex-1 h-[52px] bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase" onClick={() => setCloseOpen(true)}>
              <CheckCircle2 className="h-5 w-5 mr-2" /> Cerrar OT
            </Button>
          </>
        )}

        {ot.status === 'pausada' && (
          <>
            <Button className="flex-1 h-[52px] bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase" onClick={handleResume}>
              <Play className="h-5 w-5 mr-2" /> Reanudar
            </Button>
            <Button className="flex-1 h-[52px] border-2 border-border font-barlow uppercase" variant="outline" onClick={() => setCloseOpen(true)}>
              <CheckCircle2 className="h-5 w-5 mr-2" /> Cerrar OT
            </Button>
          </>
        )}

        {ot.status === 'cerrada' && (
          <div className="flex-1 text-center py-2">
            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] text-sm px-4 py-1">OT cerrada — pendiente firma</Badge>
          </div>
        )}
      </div>

      {/* Pause Sheet */}
      <Sheet open={pauseOpen} onOpenChange={setPauseOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle className="font-barlow">Motivo de pausa</SheetTitle></SheetHeader>
          <div className="space-y-2 py-4">
            {[{ value: 'espera_repuesto', icon: '⏳', label: 'Espera de repuesto' },
              { value: 'taller_externo', icon: '🏭', label: 'Enviado a taller externo' },
              { value: 'almuerzo', icon: '🍽️', label: 'Almuerzo / Descanso' },
              { value: 'otro', icon: '📝', label: 'Otro motivo' }].map(opt => (
              <button key={opt.value} onClick={() => setPauseReason(opt.value)}
                className={cn('w-full text-left p-3 rounded-lg border-2 text-sm font-dm transition-colors',
                  pauseReason === opt.value ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)]' : 'border-border hover:bg-muted')}>
                {opt.icon} {opt.label}
              </button>
            ))}
            {pauseReason === 'otro' && (
              <Input placeholder="Describe el motivo..." value={customPause} onChange={(e) => setCustomPause(e.target.value)} className="mt-2" />
            )}
            <Button className="w-full h-11 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase mt-4"
              disabled={!pauseReason || (pauseReason === 'otro' && !customPause)} onClick={handlePause}>
              Confirmar pausa
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Close OT Sheet */}
      <CloseOTSheet open={closeOpen} onClose={() => setCloseOpen(false)} ot={ot} otId={otId}
        notes={notes} personnelId={personnelId?.id || ''} hourlyRate={personnelId?.hourly_rate || 0}
        usedParts={usedParts} />

      {/* Parts Sheet */}
      <Sheet open={partsSheetOpen} onOpenChange={setPartsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
          <SheetHeader><SheetTitle className="font-barlow">Agregar repuesto</SheetTitle></SheetHeader>
          <div className="py-4 space-y-3">
            <SearchInput value={partsSearch} onChange={setPartsSearch} placeholder="Buscar consumible..." className="w-full" />
            {selectedConsumable ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm font-dm">
                  <p className="font-semibold">{selectedConsumable.name}</p>
                  <p className="text-xs text-muted-foreground">Stock: {selectedConsumable.stock_current} {selectedConsumable.unit} · ${(selectedConsumable.unit_cost || 0).toLocaleString()}/{selectedConsumable.unit}</p>
                </div>
                <div>
                  <Label className="text-xs font-barlow uppercase">Cantidad</Label>
                  <Input type="number" value={partQty} onChange={(e) => setPartQty(e.target.value)} className="h-9 w-32 mt-1" />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setSelectedConsumable(null)}>Cancelar</Button>
                  <Button className="flex-1 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow" onClick={handleAddPart}>Agregar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {consumables.map((c: any) => (
                  <button key={c.id} onClick={() => setSelectedConsumable(c)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 text-sm font-dm transition-colors">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Stock: {c.stock_current} {c.unit} · ${(c.unit_cost || 0).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── CLOSE OT SHEET ───
function CloseOTSheet({ open, onClose, ot, otId, notes, personnelId, hourlyRate, usedParts }: {
  open: boolean; onClose: () => void; ot: any; otId: string;
  notes: string; personnelId: string; hourlyRate: number; usedParts: any[];
}) {
  const { user } = useAuthStore();
  const { log } = useLog();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const timerStore = useOTTimerStore();
  const chrono = useChrono();
  const [finalNotes, setFinalNotes] = useState(notes);
  const [saving, setSaving] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;
    setTimeout(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; }
    }, 100);
  }, [open]);

  const startDraw = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const draw = (x: number, y: number) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y); ctx.stroke();
    setHasSig(true);
  };
  const endDraw = () => { isDrawing.current = false; };
  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };
  const clearSig = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setHasSig(false); }
  };

  const elapsedMs = timerStore.getElapsedMs();
  const actualHours = parseFloat((elapsedMs / 3600000).toFixed(2));
  const partsCost = usedParts.reduce((s: number, p: any) => s + (p.quantity * (p.unit_cost || 0)), 0);
  const laborCost = actualHours * hourlyRate;
  const totalCost = partsCost + laborCost + (ot.external_cost || 0);

  const handleClose = async () => {
    if (finalNotes.length < 20) { toast.error('Las notas deben tener al menos 20 caracteres'); return; }
    if (!hasSig) { toast.error('Firma requerida para cerrar la OT'); return; }
    setSaving(true);
    try {
      const sigUrl = canvasRef.current?.toDataURL('image/png') || '';
      await supabase.from('work_orders').update({
        status: 'cerrada' as any, closed_at: new Date().toISOString(),
        actual_hours: actualHours, parts_cost: partsCost, labor_cost: laborCost,
        total_cost: totalCost, technician_notes: finalNotes,
        technician_signature_url: sigUrl,
      }).eq('id', otId);

      await supabase.from('work_order_timers').insert([{
        work_order_id: otId, personnel_id: personnelId, event_type: 'cierre',
      }]);

      await supabase.from('cost_entries').insert([{
        tenant_id: user!.tenant_id, machine_id: ot.machine_id, project_id: ot.project_id,
        source: 'ot', source_id: otId, amount: totalCost,
        cost_type: 'mano_obra', description: `OT ${ot.code} — ${ot.machines?.name}`,
        cost_date: new Date().toISOString().split('T')[0], created_by: user!.id,
      }]);

      timerStore.stopTimer();
      await log('ordenes-trabajo', 'cerrar_ot', 'work_order', otId, ot.code);
      toast.success(`${ot.code} cerrada. Horas: ${actualHours}h · Costo: ${formatCost(totalCost)}`);
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['my-work-orders'] });
      onClose();
      navigate('/mis-ot');
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader><SheetTitle className="font-barlow text-lg">Cerrar Orden de Trabajo</SheetTitle></SheetHeader>
        <div className="py-4 space-y-4">
          {/* Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2 text-sm font-dm">
            <div className="flex justify-between"><span className="text-muted-foreground">Tiempo trabajado:</span><span className="font-barlow font-semibold">{chrono}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Horas calculadas:</span><span>{actualHours}h</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Repuestos:</span><span>{usedParts.length} ítems · {formatCost(partsCost)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Mano de obra:</span><span>{formatCost(laborCost)}</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold">
              <span>COSTO TOTAL:</span>
              <span className="font-barlow text-lg text-[hsl(var(--gold-bright))]">{formatCost(totalCost)}</span>
            </div>
          </div>

          {/* Final notes */}
          <div>
            <Label className="font-barlow uppercase text-xs mb-2 block">Notas finales del técnico *</Label>
            <Textarea placeholder="Describe el trabajo realizado, piezas reemplazadas, resultado..." value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)} rows={4} />
            {finalNotes.length > 0 && finalNotes.length < 20 && (
              <p className="text-[11px] text-[hsl(var(--danger))] mt-1">Mínimo 20 caracteres ({finalNotes.length}/20)</p>
            )}
          </div>

          {/* Signature */}
          <div>
            <Label className="font-barlow uppercase text-xs mb-2 block">Firma del técnico</Label>
            <canvas ref={canvasRef} className="w-full h-[180px] border-2 border-dashed border-border rounded-xl bg-white cursor-crosshair touch-none"
              onMouseDown={(e) => { const p = getPos(e); startDraw(p.x, p.y); }}
              onMouseMove={(e) => { const p = getPos(e); draw(p.x, p.y); }}
              onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={(e) => { e.preventDefault(); const p = getPos(e); startDraw(p.x, p.y); }}
              onTouchMove={(e) => { e.preventDefault(); const p = getPos(e); draw(p.x, p.y); }}
              onTouchEnd={endDraw} />
            <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={clearSig}>Limpiar firma</Button>
          </div>

          <Button className="w-full h-[52px] bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow uppercase"
            disabled={saving || !hasSig || finalNotes.length < 20} onClick={handleClose}>
            {saving ? 'Cerrando...' : '✅ Confirmar cierre de OT'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
