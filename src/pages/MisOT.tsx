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
import { LogOut, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Camera, Image as ImageIcon, Mic, MicOff, Plus, Pause, Play, CheckCircle2, Clock, Send, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-compress';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/SignaturePad';
import { uploadSignature } from '@/lib/upload-signature';

const TYPE_LABELS: Record<string, string> = { preventivo: 'Preventivo', correctivo: 'Correctivo', inspeccion: 'Inspección', preparacion: 'Preparación' };
const TYPE_STYLES: Record<string, string> = {
  preventivo: 'bg-[#DBEAFE] text-[#1D4ED8]', correctivo: 'bg-[#FDDEDE] text-[#C0392B]',
  inspeccion: 'bg-[#D1FAE5] text-[#065F46]', preparacion: 'bg-[#FEF3C7] text-[#D97706]',
};
const PHASE_LABELS: Record<string, string> = { antes: 'Antes', durante: 'Durante', despues: 'Después' };

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

  const { data: personnelId, isLoading: isLoadingPersonnel, error: personnelError } = useQuery({
    queryKey: ['my-personnel-id', user?.id],
    queryFn: async () => {
      console.log('[MisOT] Querying personnel for user:', user!.id);
      const { data, error } = await supabase.from('personnel').select('id').eq('user_id', user!.id).maybeSingle();
      if (error) {
        console.error('[MisOT] Personnel query error:', error);
        throw error;
      }
      console.log('[MisOT] Personnel result:', data);
      return data?.id || null;
    },
    enabled: !!user?.id,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['my-work-orders', personnelId],
    queryFn: async () => {
      console.log('[MisOT] Querying work orders for personnel:', personnelId);
      const { data, error: techErr } = await supabase
        .from('work_order_technicians')
        .select('work_order_id')
        .eq('personnel_id', personnelId!);
      if (techErr) {
        console.error('[MisOT] Technician assignments query error:', techErr);
        throw techErr;
      }
      if (!data || data.length === 0) return [];
      const ids = data.map((d: any) => d.work_order_id);
      const { data: ots, error: otsErr } = await supabase
        .from('work_orders')
        .select(`*, machines!work_orders_machine_id_fkey(name, internal_code, type), projects!work_orders_project_id_fkey(name)`)
        .in('id', ids)
        .not('status', 'eq', 'firmada')
        .order('created_at', { ascending: false });
      if (otsErr) {
        console.error('[MisOT] Work orders query error:', otsErr);
        throw otsErr;
      }
      console.log('[MisOT] Work orders found:', ots?.length);
      return ots || [];
    },
    enabled: !!personnelId,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  const sorted = [...workOrders].sort((a: any, b: any) => {
    const sOrder: Record<string, number> = { en_curso: 1, pausada: 2, asignada: 3, creada: 4, cerrada: 5 };
    return (sOrder[a.status] || 9) - (sOrder[b.status] || 9);
  });

  const pending = sorted.filter((ot: any) => ['asignada', 'creada'].includes(ot.status));
  const active = sorted.filter((ot: any) => ['en_curso', 'pausada'].includes(ot.status));

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

  if (!personnelId && !isLoadingPersonnel) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div>
            <h1 className="font-barlow text-[hsl(var(--gold-bright))] text-lg font-semibold uppercase">Mis Órdenes</h1>
            <p className="text-xs text-muted-foreground font-dm">{user?.full_name}</p>
          </div>
          <button onClick={() => signOut()} className="text-muted-foreground hover:text-foreground"><LogOut className="h-5 w-5" /></button>
        </div>
        <div className="p-6 text-center space-y-3 mt-12">
          {personnelError ? (
            <>
              <p className="font-barlow text-base text-destructive">
                Error al cargar tu perfil de técnico
              </p>
              <p className="text-sm font-dm text-muted-foreground">
                {(personnelError as any)?.message || 'Error de conexión. Intenta recargar la página.'}
              </p>
            </>
          ) : (
            <>
              <p className="font-barlow text-base text-muted-foreground">
                Tu perfil de técnico no está vinculado correctamente.
              </p>
              <p className="text-sm font-dm text-muted-foreground">
                Contacta al administrador para que verifique tu registro en Personal.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div>
          <h1 className="font-barlow text-[hsl(var(--gold-bright))] text-lg font-semibold uppercase">Mis Órdenes</h1>
          <p className="text-xs text-muted-foreground font-dm">{user?.full_name}</p>
        </div>
        <button onClick={() => signOut()} className="text-muted-foreground hover:text-foreground"><LogOut className="h-5 w-5" /></button>
      </div>

      <div className="p-4 space-y-4">
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
            {active.map((ot: any) => timerStore.activeOTId !== ot.id && (
              <OTCard key={ot.id} ot={ot} onClick={() => navigate(`/mis-ot/${ot.id}`)} />
            ))}

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
  const [partsSheetOpen, setPartsSheetOpen] = useState(false);
  const [partsSearch, setPartsSearch] = useState('');
  const [selectedConsumable, setSelectedConsumable] = useState<any>(null);
  const [partQty, setPartQty] = useState('1');

  // Horometer state (for pre-start)
  const [horometerStart, setHorometerStart] = useState('');
  const [attachHorometerPhoto, setAttachHorometerPhoto] = useState(false);
  const [horometerPhotoFile, setHorometerPhotoFile] = useState<File | null>(null);

  // Brief collapsible (persisted per OT)
  const briefKey = `brief-open-${otId}`;
  const [briefOpen, setBriefOpen] = useState(() => {
    const saved = localStorage.getItem(briefKey);
    return saved !== null ? saved === 'true' : true;
  });
  useEffect(() => { localStorage.setItem(briefKey, String(briefOpen)); }, [briefOpen, briefKey]);

  // Phase notes
  const [noteText, setNoteText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Get personnel id
  const { data: personnelId } = useQuery({
    queryKey: ['my-personnel-id', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('id, hourly_rate').eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
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

  // Phase notes query
  const { data: phaseNotes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['ot-phase-notes', otId, photoTab],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_notes')
        .select('*')
        .eq('work_order_id', otId)
        .eq('phase', photoTab)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!otId,
  });

  // Tasks query
  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['ot-tasks', otId],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_tasks')
        .select('*').eq('work_order_id', otId).order('sort_order');
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

  if (isLoading || !ot) return <div className="p-6"><Skeleton className="h-40 w-full rounded-xl" /></div>;

  const isPreStart = ['asignada', 'creada'].includes(ot.status);

  const handleStart = async () => {
    if (timerStore.status !== 'idle' && timerStore.activeOTId !== otId) {
      toast.error('Ya tienes una OT en curso');
      return;
    }
    if (!horometerStart || isNaN(parseFloat(horometerStart))) {
      toast.error('Ingresa el horómetro actual de la máquina');
      return;
    }

    const updates: any = {
      status: 'en_curso' as any,
      started_at: new Date().toISOString(),
      horometer_start: parseFloat(horometerStart),
    };

    // Upload horometer photo if provided
    if (attachHorometerPhoto && horometerPhotoFile) {
      try {
        const compressed = await compressImage(horometerPhotoFile);
        const path = `${user!.tenant_id}/${otId}/horometer/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('ot-photos').upload(path, compressed);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('ot-photos').getPublicUrl(path);
          updates.horometer_photo_url = urlData.publicUrl;
        }
      } catch {}
    }

    await supabase.from('work_orders').update(updates).eq('id', otId);
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
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        const path = `${user!.tenant_id}/${otId}/${photoTab}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error: uploadErr } = await supabase.storage.from('ot-photos').upload(path, compressed);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('ot-photos').getPublicUrl(path);
        await supabase.from('work_order_photos').insert([{
          work_order_id: otId, photo_url: urlData.publicUrl, photo_type: photoTab, uploaded_by: user!.id,
        }]);
      } catch (err: any) {
        toast.error(`Error: ${err.message || 'Error al subir foto'}`);
      }
    }
    toast.success(`${files.length} foto(s) subida(s)`);
    refetchPhotos();
    e.target.value = '';
  };

  const handleDeletePhoto = async (photo: any) => {
    try {
      // Extract storage path from public URL
      const url = new URL(photo.photo_url);
      const pathMatch = url.pathname.match(/\/object\/public\/ot-photos\/(.+)/);
      if (pathMatch) {
        await supabase.storage.from('ot-photos').remove([decodeURIComponent(pathMatch[1])]);
      }
      await supabase.from('work_order_photos').delete().eq('id', photo.id);
      toast.success('Foto eliminada');
      refetchPhotos();
    } catch (err: any) {
      toast.error('Error al eliminar foto');
    }
  };

  const handleToggleTask = async (task: any) => {
    const newCompleted = !task.is_completed;
    await supabase.from('work_order_tasks').update({
      is_completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
      completed_by: newCompleted ? user!.id : null,
    }).eq('id', task.id);
    refetchTasks();
    // Update completion_percentage on work_orders
    const updatedTasks = tasks.map((t: any) => t.id === task.id ? { ...t, is_completed: newCompleted } : t);
    const completed = updatedTasks.filter((t: any) => t.is_completed).length;
    const pct = updatedTasks.length > 0 ? Math.round((completed / updatedTasks.length) * 100) : 0;
    await supabase.from('work_orders').update({ completion_percentage: pct }).eq('id', otId);
    qc.invalidateQueries({ queryKey: ['ot-detail', otId] });
  };

  const handleAddPart = async () => {
    if (!selectedConsumable || !partQty) return;
    const qty = parseFloat(partQty);
    try {
      await supabase.from('work_order_parts').insert([{
        work_order_id: otId, consumable_id: selectedConsumable.id,
        quantity: qty, unit_cost: selectedConsumable.unit_cost || 0, registered_by: user!.id,
      }]);
      const newStock = (selectedConsumable.stock_current || 0) - qty;
      await supabase.from('inventory_consumables').update({ stock_current: Math.max(0, newStock) }).eq('id', selectedConsumable.id);
      if (newStock <= (selectedConsumable.stock_minimum || 0)) {
        await supabase.from('alerts').insert([{
          tenant_id: user!.tenant_id, type: 'stock_minimo', severity: 'warning',
          message: `Stock mínimo alcanzado: ${selectedConsumable.name}`,
        }]);
      }
      const totalPartsCost = usedParts.reduce((s: number, p: any) => s + (p.quantity * (p.unit_cost || 0)), 0) + (qty * (selectedConsumable.unit_cost || 0));
      await supabase.from('work_orders').update({ parts_cost: totalPartsCost }).eq('id', otId);

      toast.success('Repuesto agregado');
      setSelectedConsumable(null); setPartQty('1'); setPartsSheetOpen(false);
      refetchParts();
    } catch (err: any) { toast.error(err.message); }
  };

  // Save phase note
  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    try {
      await supabase.from('work_order_notes').insert([{
        work_order_id: otId,
        phase: photoTab,
        content: noteText.trim(),
        created_by: user!.id,
        tenant_id: user!.tenant_id,
      }]);
      setNoteText('');
      refetchNotes();
      toast.success('Nota guardada');
    } catch (err: any) {
      toast.error('Error al guardar nota');
    }
  };

  // Speech recognition for notes
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
      setNoteText(prev => prev + ' ' + transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const hasSpeech = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const filteredPhotos = photos.filter((p: any) => p.photo_type === photoTab);
  const completedTasks = tasks.filter((t: any) => t.is_completed).length;
  const taskPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const pctColor = taskPct >= 80 ? 'bg-[hsl(var(--success))] text-white' : taskPct >= 40 ? 'bg-[hsl(var(--warning))] text-white' : 'bg-[hsl(var(--danger))] text-white';

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate('/mis-ot')} className="flex items-center gap-1 text-sm text-muted-foreground font-dm">
          <ChevronLeft className="h-4 w-4" /> Mis OT
        </button>
        <div className="flex items-center gap-2">
          <span className="font-barlow font-semibold text-[hsl(var(--gold-bright))]">{ot.code}</span>
          {tasks.length > 0 && (
            <span className={cn('inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold font-barlow min-w-[28px]', pctColor)}>
              {taskPct}%
            </span>
          )}
        </div>
        {ot.priority === 'critica' && <Badge className="bg-[#FDDEDE] text-[#C0392B] text-[10px]">🚨 Crítica</Badge>}
        {ot.priority === 'urgente' && <Badge className="bg-[#FFEDD5] text-[#EA580C] text-[10px]">⚡ Urgente</Badge>}
      </div>

      <div className="p-4 space-y-6">
        {/* ─── 1. BRIEF DEL SUPERVISOR ─── */}
        <Collapsible open={briefOpen} onOpenChange={setBriefOpen}>
          <div className="rounded-xl border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.05)] p-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <span className="font-barlow text-sm uppercase text-[hsl(var(--gold-bright))] font-semibold">📋 Briefing del supervisor</span>
              {briefOpen ? <ChevronUp className="h-4 w-4 text-[hsl(var(--gold-bright))]" /> : <ChevronDown className="h-4 w-4 text-[hsl(var(--gold-bright))]" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {/* Machine + project */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-dm font-semibold">{ot.machines?.name || '—'}</span>
                <span className="text-xs text-muted-foreground font-dm">[{ot.machines?.internal_code || ''}]</span>
                {ot.projects?.name && (
                  <span className="text-xs text-[hsl(var(--gold-bright))] font-dm">· {ot.projects.name}</span>
                )}
              </div>
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('inline-flex items-center rounded-[20px] px-2 py-0.5 text-[10px] font-semibold font-dm', TYPE_STYLES[ot.type] || 'bg-muted text-muted-foreground')}>
                  {TYPE_LABELS[ot.type] || ot.type}
                </span>
                <StatusBadge status={ot.priority || 'normal'} />
                {ot.estimated_hours && (
                  <span className="text-xs text-muted-foreground font-dm">~{ot.estimated_hours}h estimadas</span>
                )}
              </div>
              {/* Problem description */}
              {ot.problem_description && (
                <p className="text-sm font-dm text-foreground/80 whitespace-pre-wrap">{ot.problem_description}</p>
              )}
              {/* Supervisor notes */}
              {ot.supervisor_notes && (
                <div className="mt-2 p-2 rounded-lg bg-[hsl(var(--gold)/0.08)] border border-[hsl(var(--gold)/0.2)]">
                  <p className="text-[11px] font-barlow uppercase text-[hsl(var(--gold-bright))] mb-1">Notas del supervisor</p>
                  <p className="text-sm font-dm text-foreground/80 whitespace-pre-wrap">{ot.supervisor_notes}</p>
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Machine info (compact) */}
        <div className="text-center">
          <p className="font-barlow text-2xl font-semibold">{ot.machines?.name || '—'}</p>
          <p className="text-sm text-muted-foreground font-dm">{ot.machines?.internal_code}</p>
        </div>

        {/* ─── 3. HORÓMETRO PRE-START ─── */}
        {isPreStart && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <Label className="font-barlow uppercase text-xs block">Horómetro actual de la máquina *</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="Ej: 2450.5"
              value={horometerStart}
              onChange={(e) => setHorometerStart(e.target.value)}
              className="h-11 text-lg font-barlow"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="attach-horo-photo"
                checked={attachHorometerPhoto}
                onCheckedChange={(c) => setAttachHorometerPhoto(!!c)}
              />
              <Label htmlFor="attach-horo-photo" className="text-xs font-dm cursor-pointer">
                Adjuntar foto del horómetro
              </Label>
            </div>
            {attachHorometerPhoto && (
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setHorometerPhotoFile(e.target.files?.[0] || null)}
                className="text-xs"
              />
            )}
          </div>
        )}

        {/* ─── TASKS CHECKLIST ─── */}
        {tasks.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="font-barlow text-xs uppercase text-muted-foreground">Tareas asignadas</p>
            <div className="space-y-1">
              <Progress value={taskPct} className="h-2 [&>div]:bg-[hsl(var(--gold))]" />
              <p className="text-[11px] text-muted-foreground font-dm">
                {completedTasks} de {tasks.length} tareas completadas ({taskPct}%)
              </p>
            </div>
            <div className="space-y-1">
              {tasks.map((task: any) => (
                <button
                  key={task.id}
                  onClick={() => handleToggleTask(task)}
                  className={cn(
                    'w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-colors hover:bg-muted/50',
                    task.is_completed && 'opacity-60'
                  )}
                >
                  <div className={cn(
                    'mt-0.5 h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center',
                    task.is_completed ? 'bg-[hsl(var(--gold))] border-[hsl(var(--gold))]' : 'border-border'
                  )}>
                    {task.is_completed && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className={cn('text-sm font-dm', task.is_completed && 'line-through')}>{task.name}</p>
                    {task.description && <p className="text-[11px] text-muted-foreground font-dm">{task.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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
                {PHASE_LABELS[tab]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {filteredPhotos.map((p: any) => (
              <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleDeletePhoto(p)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
              <Camera className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground font-dm">Cámara</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
            </label>
            <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
              <ImageIcon className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground font-dm">Galería</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
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

        {/* ─── 2. PHASE NOTES ─── */}
        <div>
          <p className="font-barlow text-xs uppercase text-muted-foreground mb-2">
            Notas técnicas — {PHASE_LABELS[photoTab]}
          </p>

          {/* Notes history */}
          {phaseNotes.length > 0 && (
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {phaseNotes.map((note: any) => (
                <div key={note.id} className="p-2.5 rounded-lg bg-muted/50 border border-border">
                  <p className="text-[10px] text-muted-foreground font-dm mb-0.5">
                    {format(new Date(note.created_at), 'dd/MM HH:mm', { locale: es })}
                  </p>
                  <p className="text-sm font-dm whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* New note input */}
          <div className="space-y-2">
            <Textarea
              placeholder={`Agregar observación para etapa ${PHASE_LABELS[photoTab]}...`}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              {hasSpeech && (
                <Button variant={isRecording ? 'destructive' : 'ghost'} size="sm" className="h-8 text-xs" onClick={toggleSpeech}>
                  {isRecording ? <><MicOff className="h-3.5 w-3.5 mr-1" />Grabando...</> : <><Mic className="h-3.5 w-3.5 mr-1" />Dictar</>}
                </Button>
              )}
              <Button
                size="sm"
                className="h-8 text-xs ml-auto bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-white font-barlow"
                disabled={!noteText.trim()}
                onClick={handleSaveNote}
              >
                <Send className="h-3.5 w-3.5 mr-1" /> Guardar nota
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex gap-3 z-40">
        {isPreStart && (
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
        personnelId={personnelId?.id || ''} hourlyRate={personnelId?.hourly_rate || 0}
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
function CloseOTSheet({ open, onClose, ot, otId, personnelId, hourlyRate, usedParts }: {
  open: boolean; onClose: () => void; ot: any; otId: string;
  personnelId: string; hourlyRate: number; usedParts: any[];
}) {
  const { user } = useAuthStore();
  const { log } = useLog();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const timerStore = useOTTimerStore();
  const chrono = useChrono();
  const [finalNotes, setFinalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Load all notes to concatenate for technician_notes
  const { data: allNotes = [] } = useQuery({
    queryKey: ['ot-all-notes', otId],
    queryFn: async () => {
      const { data } = await supabase.from('work_order_notes')
        .select('*')
        .eq('work_order_id', otId)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (allNotes.length > 0 && !finalNotes) {
      const summary = allNotes
        .map((n: any) => `[${PHASE_LABELS[n.phase] || n.phase}] ${n.content}`)
        .join('\n');
      setFinalNotes(summary);
    }
  }, [allNotes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;
    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 180 * dpr;
      canvas.style.height = '180px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 0;
      }
    };
    setTimeout(setupCanvas, 150);
  }, [open]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };
  const startDraw = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    lastPoint.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const draw = (x: number, y: number) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const prev = lastPoint.current;
    if (prev) {
      const dx = Math.abs(x - prev.x);
      const dy = Math.abs(y - prev.y);
      if (dx < 2 && dy < 2) return;
      ctx.quadraticCurveTo(prev.x, prev.y, (x + prev.x) / 2, (y + prev.y) / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPoint.current = { x, y };
    setHasSig(true);
  };
  const endDraw = () => { isDrawing.current = false; lastPoint.current = null; };
  const clearSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      setHasSig(false);
    }
  };

  const elapsedMs = timerStore.getElapsedMs();
  const actualHours = parseFloat((elapsedMs / 3600000).toFixed(2));
  const partsCost = usedParts.reduce((s: number, p: any) => s + (p.quantity * (p.unit_cost || 0)), 0);
  const laborCost = 0; // Mano de obra deshabilitada por ahora
  const totalCost = partsCost + (ot.external_cost || 0);

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

      // Cost entry solo si hay costo de materiales
      if (partsCost > 0) {
        await supabase.from('cost_entries').insert([{
          tenant_id: user!.tenant_id, machine_id: ot.machine_id, project_id: ot.project_id,
          source: 'ot', source_id: otId, amount: partsCost,
          cost_type: 'materiales', description: `OT ${ot.code} — materiales`,
          cost_date: new Date().toISOString().split('T')[0], created_by: user!.id,
        }]);
      }

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
