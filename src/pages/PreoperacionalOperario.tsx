import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useNetworkStatus, useSyncStore } from '@/hooks/useNetworkStatus';
import { useLog } from '@/hooks/useLog';
import { addToOfflineQueue } from '@/lib/offline-queue';
import { PREOP_TEMPLATES } from '@/data/preop-templates';
import type { PreopSection, PreopItem } from '@/data/preop-templates';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { LogOut, ChevronLeft, ChevronDown, ChevronUp, AlertTriangle, WifiOff, CheckCircle2, Camera, Image as ImageIcon } from 'lucide-react';
import { compressImage } from '@/lib/image-compress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type ItemResult = 'bueno' | 'malo' | 'na';
type FormScreen = 'home' | 'formatoA' | 'formatoB';
type MachineStatus = 'sin_novedades' | 'novedades_menores' | 'requiere_revision_urgente';

// ─── MAIN PAGE ───
export default function PreoperacionalOperario() {
  const { user, signOut } = useAuthStore();
  const { isOnline } = useNetworkStatus();
  const syncState = useSyncStore();
  const [screen, setScreen] = useState<FormScreen>('home');

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-[hsl(36,90%,42%)] text-white px-4 py-2 flex items-center gap-2 text-sm font-dm">
          <WifiOff size={16} />
          Sin conexión — los registros se guardarán localmente
        </div>
      )}

      {/* Sync Banner */}
      {syncState.show && (
        <div className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] px-4 py-2 flex items-center gap-2 text-sm font-dm">
          <CheckCircle2 size={16} />
          ✓ {syncState.count} registro(s) sincronizado(s)
        </div>
      )}

      {screen === 'home' && <HomeScreen user={user} signOut={signOut} onNavigate={setScreen} />}
      {screen === 'formatoA' && <FormatoA user={user} onBack={() => setScreen('home')} />}
      {screen === 'formatoB' && <FormatoB user={user} onBack={() => setScreen('home')} />}
    </div>
  );
}

// ─── HOME SCREEN ───
function HomeScreen({ user, signOut, onNavigate }: { user: any; signOut: () => void; onNavigate: (s: FormScreen) => void }) {
  // Get personnel id for this user
  const { data: personnel } = useQuery({
    queryKey: ['personnel-by-user', user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('personnel')
        .select('id')
        .eq('user_id', user.id)
        .eq('tenant_id', user.tenant_id)
        .single();
      return data;
    },
  });

  const operatorId = personnel?.id;

  // Check today's preops
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayPreops, isLoading: loadingToday } = useQuery({
    queryKey: ['today-preops', operatorId],
    queryFn: async () => {
      if (!operatorId) return [];
      const { data } = await supabase
        .from('preop_records')
        .select('id, record_type, created_at')
        .eq('operator_id', operatorId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!operatorId,
  });

  const todayInicio = todayPreops?.find((p) => p.record_type === 'inicio');
  const todayCierre = todayPreops?.find((p) => p.record_type === 'cierre');

  // Recent history
  const { data: history } = useQuery({
    queryKey: ['preop-history', operatorId],
    queryFn: async () => {
      if (!operatorId) return [];
      const { data } = await supabase
        .from('preop_records')
        .select('id, record_type, created_at, horometer_value, has_critical_failures, machine_id, machines(name, internal_code)')
        .eq('operator_id', operatorId)
        .order('created_at', { ascending: false })
        .limit(7);
      return data || [];
    },
    enabled: !!operatorId,
  });

  const formatDate = (d: string) => {
    const date = new Date(d);
    if (isToday(date)) return 'Hoy';
    if (isYesterday(date)) return 'Ayer';
    return format(date, 'd MMM', { locale: es });
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div>
          <h1 className="font-barlow text-[hsl(var(--gold))] text-base font-semibold tracking-wide">UP & DOWN SOLAR</h1>
          <p className="text-sm text-muted-foreground font-dm">{user.full_name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}><LogOut size={18} /></Button>
      </div>

      {/* Formato A Card */}
      <div className="rounded-xl border border-border bg-card p-4 mb-3 border-l-4 border-l-[hsl(var(--gold))]">
        <h2 className="font-barlow text-base font-semibold">Formato A — Inicio de Jornada</h2>
        <p className="text-xs text-muted-foreground font-dm mt-0.5">Registra el estado del equipo al comenzar</p>
        {loadingToday ? (
          <Skeleton className="h-12 mt-3" />
        ) : todayInicio ? (
          <div className="mt-3 flex items-center gap-2">
            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-0">✓ Completado hoy</Badge>
            <span className="text-xs text-muted-foreground">{format(new Date(todayInicio.created_at!), 'hh:mm a')}</span>
          </div>
        ) : (
          <Button className="w-full mt-3 h-12 font-barlow text-sm uppercase tracking-wide bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-bright))] text-white" onClick={() => onNavigate('formatoA')}>
            Iniciar Formato A →
          </Button>
        )}
      </div>

      {/* Formato B Card */}
      <div className={`rounded-xl border border-border bg-card p-4 mb-6 border-l-4 border-l-[hsl(217,91%,60%)] ${!todayInicio ? 'opacity-50' : ''}`}>
        <h2 className="font-barlow text-base font-semibold">Formato B — Cierre de Jornada</h2>
        <p className="text-xs text-muted-foreground font-dm mt-0.5">Registra el estado final y horas trabajadas</p>
        {!todayInicio ? (
          <p className="text-xs text-muted-foreground mt-3 font-dm">Primero completa el Formato A</p>
        ) : todayCierre ? (
          <div className="mt-3 flex items-center gap-2">
            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-0">✓ Completado hoy</Badge>
            <span className="text-xs text-muted-foreground">{format(new Date(todayCierre.created_at!), 'hh:mm a')}</span>
          </div>
        ) : (
          <Button className="w-full mt-3 h-12 font-barlow text-sm uppercase tracking-wide bg-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,50%)] text-white" onClick={() => onNavigate('formatoB')}>
            Iniciar Formato B →
          </Button>
        )}
      </div>

      {/* History */}
      <h3 className="font-barlow text-xs uppercase tracking-widest text-muted-foreground mb-2">Mis últimos registros</h3>
      {!history?.length ? (
        <p className="text-sm text-muted-foreground font-dm py-4 text-center">No tienes registros aún. ¡Comienza con el Formato A!</p>
      ) : (
        <div className="space-y-0">
          {history.map((h: any) => (
            <div key={h.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
              <span className="text-lg">{h.record_type === 'inicio' ? '🌅' : '🌇'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-dm font-medium">{formatDate(h.created_at)}</span>
                  {h.has_critical_failures && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">⚠️ Críticos</Badge>}
                </div>
                <p className="text-xs text-muted-foreground font-dm truncate">
                  {h.machines ? `[${(h.machines as any).internal_code}] ${(h.machines as any).name}` : '—'}
                </p>
              </div>
              <span className="text-xs text-muted-foreground font-dm">{Number(h.horometer_value).toLocaleString('es-CO')} h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FORMATO A ───
function FormatoA({ user, onBack }: { user: any; onBack: () => void }) {
  const { log } = useLog();
  const { isOnline } = useNetworkStatus();
  const [step, setStep] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [horometer, setHorometer] = useState('');
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [criticalModalItem, setCriticalModalItem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: personnel } = useQuery({
    queryKey: ['personnel-by-user', user.id],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('id').eq('user_id', user.id).eq('tenant_id', user.tenant_id).single();
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['active-projects', user.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, city').eq('tenant_id', user.tenant_id).eq('status', 'activo').order('name');
      return data || [];
    },
  });

  const { data: machines } = useQuery({
    queryKey: ['project-machines', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await supabase
        .from('project_machines')
        .select('machine_id, machines(id, name, internal_code, type, status, horometer_current)')
        .eq('project_id', projectId)
        .is('removed_date', null);
      return (data || []).map((d: any) => d.machines).filter(Boolean);
    },
    enabled: !!projectId,
  });

  const selectedMachine = machines?.find((m: any) => m.id === machineId);
  const machineType = selectedMachine?.type as string | undefined;
  const template = machineType ? PREOP_TEMPLATES[machineType] : null;
  const allItems = template?.sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.name }))) || [];
  const totalItems = allItems.length;
  const completedItems = allItems.filter((i) => results[i.id]).length;

  const step1Valid = projectId && machineId && horometer && parseFloat(horometer) > 0;
  const step2Valid = totalItems > 0 && completedItems === totalItems;

  const setResult = (itemId: string, result: ItemResult, item: PreopItem & { section: string }) => {
    setResults((prev) => ({ ...prev, [itemId]: result }));
    if (result === 'malo' && item.critical) {
      setCriticalModalItem(item.label);
    }
  };

  const handleSave = async (signatureDataUrl: string) => {
    if (!personnel?.id) return;
    setSaving(true);
    try {
      const record = {
        tenant_id: user.tenant_id,
        machine_id: machineId,
        project_id: projectId,
        operator_id: personnel.id,
        record_type: 'inicio',
        horometer_value: parseFloat(horometer),
        has_critical_failures: allItems.some((i) => i.critical && results[i.id] === 'malo'),
        critical_failures_count: allItems.filter((i) => i.critical && results[i.id] === 'malo').length,
        digital_signature_url: signatureDataUrl,
        offline_created: !isOnline,
        created_at: new Date().toISOString(),
      };

      const items = allItems.map((item) => ({
        section: item.section,
        item_label: item.label,
        is_critical: item.critical,
        result: results[item.id],
        observation: observations[item.id] || null,
      }));

      if (isOnline) {
        const { data: preop, error } = await supabase.from('preop_records').insert([record]).select().single();
        if (error) throw error;
        if (preop) {
          await supabase.from('preop_items').insert(items.map((i) => ({ ...i, record_id: preop.id })));
        }
      } else {
        await addToOfflineQueue({
          id: crypto.randomUUID(),
          action: 'create_preop_inicio',
          payload: { record, items },
          createdAt: new Date().toISOString(),
          retries: 0,
        });
      }

      if (record.has_critical_failures && isOnline) {
        await supabase.from('alerts').insert([{
          tenant_id: user.tenant_id,
          type: 'preop_critico',
          severity: 'critical',
          machine_id: machineId,
          message: `Preoperacional con ${record.critical_failures_count} punto(s) crítico(s) — ${selectedMachine?.name}`,
        }]);
      }

      await log('preoperacionales', 'crear_preop_inicio', 'preop_record', undefined, selectedMachine?.name);
      toast.success('Formato A guardado correctamente');
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft size={18} /> Volver</Button>
        <span className="font-barlow font-semibold text-sm">Formato A — Inicio</span>
        <span className="text-xs text-muted-foreground font-dm">Paso {step} de 3</span>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 py-3">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-barlow font-semibold ${s < step ? 'bg-[hsl(var(--gold))] text-white' : s === step ? 'bg-[hsl(var(--gold))] text-white' : 'bg-muted text-muted-foreground'}`}>
              {s < step ? '✓' : s}
            </div>
            {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-[hsl(var(--gold))]' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {step === 1 && (
          <Step1Identification
            projectId={projectId} setProjectId={(v) => { setProjectId(v); setMachineId(''); }}
            machineId={machineId} setMachineId={setMachineId}
            horometer={horometer} setHorometer={setHorometer}
            projects={projects || []} machines={machines || []}
            selectedMachine={selectedMachine}
          />
        )}
        {step === 2 && template && (
          <Step2Checklist
            template={template} results={results} observations={observations}
            setResult={setResult} setObservation={(id, v) => setObservations((p) => ({ ...p, [id]: v }))}
            totalItems={totalItems} completedItems={completedItems}
          />
        )}
        {step === 3 && (
          <Step3Signature
            machineName={selectedMachine ? `[${selectedMachine.internal_code}] ${selectedMachine.name}` : ''}
            projectName={projects?.find((p: any) => p.id === projectId)?.name || ''}
            horometer={horometer}
            results={results} allItems={allItems}
            onSave={handleSave} saving={saving}
          />
        )}
      </div>

      {/* Critical modal */}
      <Dialog open={!!criticalModalItem} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} hideCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-barlow">
              <AlertTriangle size={20} /> PUNTO CRÍTICO DE SEGURIDAD
            </DialogTitle>
            <DialogDescription className="font-dm text-sm pt-2">
              "<span className="font-semibold text-foreground">{criticalModalItem}</span>"
              <br /><br />
              Este equipo NO puede operar hasta que este punto sea revisado.
              <br /><br />
              Notifica inmediatamente a tu supervisor antes de continuar.
            </DialogDescription>
          </DialogHeader>
          <Button className="w-full bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-bright))] text-white font-barlow" onClick={() => setCriticalModalItem(null)}>
            Entendido — notifiqué
          </Button>
        </DialogContent>
      </Dialog>

      {/* Bottom nav */}
      {step < 3 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
          <Button
            className="w-full h-12 font-barlow uppercase tracking-wide bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-bright))] text-white"
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 2 && !step2Valid ? `Faltan ${totalItems - completedItems} ítems por revisar` : 'Siguiente →'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── STEP 1: IDENTIFICATION ───
function Step1Identification({ projectId, setProjectId, machineId, setMachineId, horometer, setHorometer, projects, machines, selectedMachine }: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-dm font-medium text-muted-foreground mb-1.5 uppercase">Proyecto *</label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona un proyecto" /></SelectTrigger>
          <SelectContent>
            {(Array.isArray(projects) ? projects : []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-xs font-dm font-medium text-muted-foreground mb-1.5 uppercase">Máquina *</label>
        <Select value={machineId} onValueChange={setMachineId} disabled={!projectId}>
          <SelectTrigger className="h-11"><SelectValue placeholder={projectId ? 'Selecciona una máquina' : 'Primero selecciona un proyecto'} /></SelectTrigger>
          <SelectContent>
            {(Array.isArray(machines) ? machines : []).map((m: any) => (
              <SelectItem key={m.id} value={m.id}>[{m.internal_code}] {m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-xs font-dm font-medium text-muted-foreground mb-1.5 uppercase">Horómetro actual (horas) *</label>
        <input
          type="text" inputMode="numeric" value={horometer}
          onChange={(e) => setHorometer(e.target.value.replace(/[^0-9.]/g, ''))}
          className="w-full h-16 text-center text-3xl font-barlow font-semibold border border-border rounded-lg bg-card focus:border-[hsl(var(--gold))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--gold))]"
          placeholder="0.0"
        />
        {selectedMachine && (
          <p className="text-xs text-muted-foreground font-dm mt-1">Último registrado: {Number(selectedMachine.horometer_current).toLocaleString('es-CO')} h</p>
        )}
      </div>

      <div className="bg-secondary rounded-lg p-3">
        <p className="text-xs font-dm text-muted-foreground">
          📅 {format(new Date(), "EEEE d 'de' MMMM, yyyy · hh:mm a", { locale: es })}
        </p>
      </div>
    </div>
  );
}

// ─── STEP 2: CHECKLIST ───
function Step2Checklist({ template, results, observations, setResult, setObservation, totalItems, completedItems }: {
  template: { sections: PreopSection[] }; results: Record<string, ItemResult>; observations: Record<string, string>;
  setResult: (id: string, r: ItemResult, item: any) => void; setObservation: (id: string, v: string) => void;
  totalItems: number; completedItems: number;
}) {
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-[hsl(var(--gold))] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-dm text-muted-foreground whitespace-nowrap">{completedItems}/{totalItems} · {pct}%</span>
      </div>

      {template.sections.map((section) => {
        const sectionDone = section.items.every((i) => results[i.id]);
        return (
          <Collapsible key={section.name} defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full bg-secondary rounded-lg px-3 py-2.5">
              <span className="font-barlow text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
                {section.name}
                {sectionDone && <CheckCircle2 size={14} className="text-[hsl(var(--success))]" />}
              </span>
              <span className="text-xs text-muted-foreground font-dm">
                {section.items.filter((i) => results[i.id]).length}/{section.items.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-0">
              {section.items.map((item) => (
                <ChecklistItem
                  key={item.id} item={item} sectionName={section.name}
                  result={results[item.id]} observation={observations[item.id] || ''}
                  onResult={(r) => setResult(item.id, r, { ...item, section: section.name })}
                  onObservation={(v) => setObservation(item.id, v)}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function ChecklistItem({ item, result, observation, onResult, onObservation }: {
  item: PreopItem; sectionName: string; result?: ItemResult; observation: string;
  onResult: (r: ItemResult) => void; onObservation: (v: string) => void;
}) {
  const { user } = useAuthStore();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = `${user.tenant_id}/preop/${Date.now()}_${item.id}.jpg`;
      const { error } = await supabase.storage.from('ot-photos').upload(path, compressed);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('ot-photos').getPublicUrl(path);
      setPhotoUrl(urlData.publicUrl);
      // Store URL in observation for persistence
      onObservation((observation ? observation + ' ' : '') + `[foto: ${urlData.publicUrl}]`);
      toast.success('Foto adjuntada');
    } catch (err: any) {
      toast.error('Error al subir foto');
    } finally {
      setUploading(false);
    }
  };

  const btnClass = (type: ItemResult) => {
    const base = 'min-h-[44px] min-w-[52px] rounded-lg font-barlow font-semibold text-sm transition-all touch-manipulation';
    if (result !== type) return `${base} bg-card border border-border text-muted-foreground`;
    if (type === 'bueno') return `${base} bg-[hsl(var(--success-bg))] border-2 border-[hsl(138,65%,40%)] text-[hsl(var(--success))]`;
    if (type === 'malo') return `${base} bg-[hsl(var(--danger-bg))] border-2 border-destructive text-destructive`;
    return `${base} bg-secondary border-2 border-muted-foreground/40 text-foreground`;
  };

  return (
    <div className="border-b border-border py-2.5 px-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {item.critical && <span className="text-[10px] font-barlow uppercase font-bold text-destructive mr-1">CRÍTICO</span>}
          <span className="text-[13px] font-dm leading-tight">{item.label}</span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button className={btnClass('bueno')} onClick={() => onResult('bueno')}>B</button>
          <button className={btnClass('malo')} onClick={() => onResult('malo')}>M</button>
          <button className={btnClass('na')} onClick={() => onResult('na')}>N/A</button>
        </div>
      </div>
      {result === 'malo' && (
        <div className="mt-2 space-y-2">
          {!item.critical && (
            <Textarea
              className="text-xs" rows={2} placeholder="Describe la novedad observada..."
              value={observation} onChange={(e) => onObservation(e.target.value)}
            />
          )}
          {/* Photo evidence for bad items */}
          <div className="flex gap-2">
            {photoUrl && (
              <div className="h-16 w-16 rounded-lg overflow-hidden border border-border">
                <img src={photoUrl} alt="Evidencia" className="w-full h-full object-cover" />
              </div>
            )}
            <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 text-muted-foreground">
              <Camera className="h-4 w-4" />
              <span className="text-[9px] font-dm">{uploading ? '...' : 'Cámara'}</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
            </label>
            <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              <span className="text-[9px] font-dm">Galería</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STEP 3: SIGNATURE ───
function Step3Signature({ machineName, projectName, horometer, results, allItems, onSave, saving, isFormatoB, extraSummary }: {
  machineName: string; projectName: string; horometer: string;
  results: Record<string, ItemResult>; allItems: any[];
  onSave: (sig: string) => void; saving: boolean;
  isFormatoB?: boolean; extraSummary?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const buenos = allItems.filter((i) => results[i.id] === 'bueno').length;
  const malos = allItems.filter((i) => results[i.id] === 'malo').length;
  const nas = allItems.filter((i) => results[i.id] === 'na').length;
  const criticalMalos = allItems.filter((i) => i.critical && results[i.id] === 'malo').length;

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: any) => {
    isDrawing.current = true;
    setHasSignature(true);
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    lastPoint.current = { x: pos.x, y: pos.y };
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: any) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 0;
    const prev = lastPoint.current;
    if (prev) {
      const dx = Math.abs(pos.x - prev.x), dy = Math.abs(pos.y - prev.y);
      if (dx < 2 && dy < 2) return;
      ctx.quadraticCurveTo(prev.x, prev.y, (pos.x + prev.x) / 2, (pos.y + prev.y) / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPoint.current = { x: pos.x, y: pos.y };
  };

  const stopDraw = () => { isDrawing.current = false; lastPoint.current = null; };

  const clearSignature = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = 200;
    }
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="font-barlow text-lg font-semibold">Firma del Operario</h2>
      <p className="text-xs text-muted-foreground font-dm">Al firmar confirmas que el checklist fue completado con veracidad</p>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full border-2 border-dashed border-border rounded-xl bg-card touch-none"
          style={{ height: 200 }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        />
        {!hasSignature && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">✍️ Firma aquí con tu dedo</p>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={clearSignature} className="text-xs">Limpiar firma</Button>

      {/* Summary */}
      <div className="bg-secondary rounded-xl p-4 space-y-2 text-sm font-dm">
        <p><span className="text-muted-foreground">Máquina:</span> {machineName}</p>
        <p><span className="text-muted-foreground">Proyecto:</span> {projectName}</p>
        {isFormatoB && extraSummary ? extraSummary : (
          <>
            <p><span className="text-muted-foreground">Horómetro:</span> {parseFloat(horometer).toLocaleString('es-CO')} h</p>
            <p>
              <span className="text-[hsl(var(--success))]">Bueno: {buenos}</span> | <span className="text-destructive">Malo: {malos}</span> | <span className="text-muted-foreground">N/A: {nas}</span>
            </p>
            {criticalMalos > 0 && (
              <p className="text-destructive font-semibold">⚠️ {criticalMalos} punto(s) crítico(s) detectado(s)</p>
            )}
          </>
        )}
      </div>

      <Button
        className="w-full h-12 font-barlow uppercase tracking-wide bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-bright))] text-white"
        disabled={!hasSignature || saving}
        onClick={() => onSave(canvasRef.current!.toDataURL('image/png'))}
      >
        {saving ? 'Guardando...' : isFormatoB ? 'Guardar Formato B' : 'Guardar Formato A'}
      </Button>
    </div>
  );
}

// ─── FORMATO B ───
function FormatoB({ user, onBack }: { user: any; onBack: () => void }) {
  const { log } = useLog();
  const { isOnline } = useNetworkStatus();
  const [step, setStep] = useState(1);
  const [horometerFinal, setHorometerFinal] = useState('');
  const [machineStatusClose, setMachineStatusClose] = useState<MachineStatus | ''>('');
  const [urgentDescription, setUrgentDescription] = useState('');
  const [generalObs, setGeneralObs] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: personnel } = useQuery({
    queryKey: ['personnel-by-user', user.id],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('id, full_name').eq('user_id', user.id).eq('tenant_id', user.tenant_id).single();
      return data;
    },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: formatoA } = useQuery({
    queryKey: ['today-formato-a', personnel?.id],
    queryFn: async () => {
      if (!personnel?.id) return null;
      const { data } = await supabase
        .from('preop_records')
        .select('*, machines(id, name, internal_code, horometer_current), projects(name)')
        .eq('operator_id', personnel.id)
        .eq('record_type', 'inicio')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!personnel?.id,
  });

  if (!formatoA) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Skeleton className="h-40 w-64" />
    </div>
  );

  const machine = formatoA.machines as any;
  const project = formatoA.projects as any;
  const horometerInicial = Number(formatoA.horometer_value);
  const horometerFinalNum = parseFloat(horometerFinal);
  const horometerValid = !isNaN(horometerFinalNum) && horometerFinalNum >= horometerInicial;
  const hoursWorked = horometerValid ? (horometerFinalNum - horometerInicial).toFixed(1) : null;
  const step1Valid = horometerValid && machineStatusClose !== '' && (machineStatusClose !== 'requiere_revision_urgente' || urgentDescription.trim());

  const handleSave = async (signatureDataUrl: string) => {
    if (!personnel?.id) return;
    setSaving(true);
    try {
      const record = {
        tenant_id: user.tenant_id,
        machine_id: machine.id,
        project_id: formatoA.project_id,
        operator_id: personnel.id,
        record_type: 'cierre',
        horometer_value: horometerFinalNum,
        hours_worked: horometerFinalNum - horometerInicial,
        machine_status_at_close: machineStatusClose,
        observations: [urgentDescription, generalObs].filter(Boolean).join(' | ') || null,
        digital_signature_url: signatureDataUrl,
        offline_created: !isOnline,
        created_at: new Date().toISOString(),
      };

      if (isOnline) {
        const { error } = await supabase.from('preop_records').insert([record]);
        if (error) throw error;

        // Update horometer
        if (horometerFinalNum > Number(machine.horometer_current)) {
          await supabase.from('machines').update({ horometer_current: horometerFinalNum }).eq('id', machine.id);
        }

        if (machineStatusClose === 'requiere_revision_urgente') {
          await supabase.from('alerts').insert([{
            tenant_id: user.tenant_id,
            type: 'preop_critico',
            severity: 'critical',
            machine_id: machine.id,
            message: `Equipo ${machine.name} requiere revisión urgente — reportado por ${personnel.full_name}`,
          }]);
        }
      } else {
        await addToOfflineQueue({
          id: crypto.randomUUID(),
          action: 'create_preop_cierre',
          payload: { record },
          createdAt: new Date().toISOString(),
          retries: 0,
        });
      }

      await log('preoperacionales', 'crear_preop_cierre', 'preop_record', undefined, machine.name);
      toast.success('Formato B guardado correctamente');
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const statusOptions: { value: MachineStatus; icon: string; label: string; style: string; activeStyle: string }[] = [
    { value: 'sin_novedades', icon: '✅', label: 'Sin novedades', style: 'bg-card border-border', activeStyle: 'bg-[hsl(var(--success-bg))] border-2 border-[hsl(138,65%,40%)]' },
    { value: 'novedades_menores', icon: '⚠️', label: 'Novedades menores', style: 'bg-card border-border', activeStyle: 'bg-[hsl(var(--warning-bg))] border-2 border-[hsl(36,90%,42%)]' },
    { value: 'requiere_revision_urgente', icon: '🚨', label: 'Requiere revisión urgente', style: 'bg-card border-border', activeStyle: 'bg-[hsl(var(--danger-bg))] border-2 border-destructive' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft size={18} /> Volver</Button>
        <span className="font-barlow font-semibold text-sm">Formato B — Cierre</span>
        <span className="text-xs text-muted-foreground font-dm">Paso {step} de 2</span>
      </div>

      <div className="flex items-center justify-center gap-2 py-3">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-barlow font-semibold ${s <= step ? 'bg-[hsl(var(--gold))] text-white' : 'bg-muted text-muted-foreground'}`}>
              {s < step ? '✓' : s}
            </div>
            {s < 2 && <div className={`w-8 h-0.5 ${s < step ? 'bg-[hsl(var(--gold))]' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {step === 1 && (
          <div className="space-y-4">
            {/* Summary from Formato A */}
            <div className="bg-secondary rounded-xl p-4 text-sm font-dm space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-barlow tracking-wider mb-1">📋 Registro de inicio de hoy</p>
              <p><span className="text-muted-foreground">Máquina:</span> [{machine.internal_code}] {machine.name}</p>
              <p><span className="text-muted-foreground">Proyecto:</span> {project?.name}</p>
              <p><span className="text-muted-foreground">Horómetro inicial:</span> {horometerInicial.toLocaleString('es-CO')} h</p>
              <p><span className="text-muted-foreground">Hora de inicio:</span> {format(new Date(formatoA.created_at!), 'hh:mm a')}</p>
            </div>

            <div>
              <label className="block text-xs font-dm font-medium text-muted-foreground mb-1.5 uppercase">Horómetro final *</label>
              <input
                type="text" inputMode="numeric" value={horometerFinal}
                onChange={(e) => setHorometerFinal(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full h-16 text-center text-3xl font-barlow font-semibold border border-border rounded-lg bg-card focus:border-[hsl(var(--gold))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--gold))]"
                placeholder="0.0"
              />
              {horometerFinal && !horometerValid && (
                <p className="text-xs text-destructive mt-1 font-dm">El horómetro final no puede ser menor al inicial</p>
              )}
            </div>

            {hoursWorked && (
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground font-dm">⏱ Horas trabajadas hoy:</p>
                <p className="text-3xl font-barlow font-bold text-[hsl(var(--gold))]">{hoursWorked} h</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-dm font-medium text-muted-foreground mb-2 uppercase">Estado del equipo al cierre</label>
              <div className="space-y-2">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full rounded-xl border p-3 text-left transition-all flex items-center gap-3 touch-manipulation ${machineStatusClose === opt.value ? opt.activeStyle : opt.style}`}
                    onClick={() => setMachineStatusClose(opt.value)}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span className="font-dm text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {machineStatusClose === 'requiere_revision_urgente' && (
              <Textarea
                placeholder="Describe el problema urgente *" rows={3} value={urgentDescription}
                onChange={(e) => setUrgentDescription(e.target.value)} className="text-sm"
              />
            )}

            <Textarea
              placeholder="¿Algo más que reportar del turno?" rows={3} value={generalObs}
              onChange={(e) => setGeneralObs(e.target.value)} className="text-sm"
            />
          </div>
        )}
        {step === 2 && (
          <Step3Signature
            machineName={`[${machine.internal_code}] ${machine.name}`}
            projectName={project?.name || ''}
            horometer={horometerFinal}
            results={{}} allItems={[]}
            onSave={handleSave} saving={saving}
            isFormatoB
            extraSummary={
              <>
                <p><span className="text-muted-foreground">Horómetro:</span> {horometerInicial.toLocaleString('es-CO')} h → {horometerFinalNum.toLocaleString('es-CO')} h</p>
                <p><span className="text-muted-foreground">Horas trabajadas:</span> {hoursWorked} h</p>
                <p><span className="text-muted-foreground">Estado:</span> {machineStatusClose === 'sin_novedades' ? '✅ Sin novedades' : machineStatusClose === 'novedades_menores' ? '⚠️ Novedades menores' : '🚨 Revisión urgente'}</p>
              </>
            }
          />
        )}
      </div>

      {step === 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
          <Button
            className="w-full h-12 font-barlow uppercase tracking-wide bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-bright))] text-white"
            disabled={!step1Valid} onClick={() => setStep(2)}
          >
            Siguiente →
          </Button>
        </div>
      )}
    </div>
  );
}
