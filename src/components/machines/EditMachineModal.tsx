import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MachinePhotoUpload, uploadMachinePhoto } from './MachinePhotoUpload';
import { MachineAlertConfig, type MaintenanceAlert } from './MachineAlertConfig';
import { SafeDeleteDialog } from '@/components/ui/SafeDeleteDialog';
import { checkDeleteMachine } from '@/lib/delete-guards';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Trash2 } from 'lucide-react';

const MACHINE_TYPES = [
  { value: 'telehandler', label: 'Telehandler' },
  { value: 'manlift', label: 'Manlift' },
  { value: 'tijera', label: 'Tijera' },
  { value: 'hincadora', label: 'Hincadora' },
  { value: 'minicargador', label: 'Minicargador' },
  { value: 'retroexcavadora', label: 'Retroexcavadora' },
  { value: 'camion_grua', label: 'Camión Grúa' },
  { value: 'otro', label: 'Otro' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  machine: any;
}

export function EditMachineModal({ open, onClose, machine }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const [form, setForm] = useState({
    name: '', internal_code: '', type: '', brand: '', model: '', year: '',
    serial_number: '', horometer_current: '0', monthly_cost_estimate: '', notes: '',
    weight_kg: '', max_capacity: '', max_height: '', engine_model: '', fuel_type: '', plate_number: '',
  });

  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);

  const existingAlerts = useQuery({
    queryKey: ['machine-maint-alerts', machine?.id],
    enabled: !!machine?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('machine_maintenance_alerts')
        .select('*')
        .eq('machine_id', machine.id);
      return data ?? [];
    },
  });

  const projects = useQuery({
    queryKey: ['active-projects-list', user?.tenant_id],
    enabled: !!user?.tenant_id,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').eq('tenant_id', user!.tenant_id).eq('status', 'activo');
      return data ?? [];
    },
  });

  useEffect(() => {
    if (machine) {
      setForm({
        name: machine.name || '', internal_code: machine.internal_code || '', type: machine.type || '',
        brand: machine.brand || '', model: machine.model || '', year: String(machine.year ?? ''),
        serial_number: machine.serial_number || '', horometer_current: String(machine.horometer_current ?? '0'),
        monthly_cost_estimate: String(machine.monthly_cost_estimate ?? ''), notes: machine.notes || '',
        weight_kg: String(machine.weight_kg ?? ''), max_capacity: machine.max_capacity || '',
        max_height: (machine as any).max_height || '', engine_model: (machine as any).engine_model || '',
        fuel_type: (machine as any).fuel_type || '', plate_number: (machine as any).plate_number || '',
      });
    }
  }, [machine]);

  useEffect(() => {
    if (existingAlerts.data) {
      setAlerts(existingAlerts.data.map((a: any) => ({
        id: a.id, alert_name: a.alert_name, trigger_type: a.trigger_type,
        horometer_interval: a.horometer_interval, calendar_interval_days: a.calendar_interval_days,
        start_date: a.start_date, active: a.active,
      })));
    }
  }, [existingAlerts.data]);

  const handleSubmit = async () => {
    if (!form.internal_code || !form.name || !form.type) {
      toast({ title: 'Completa los campos obligatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Update machine
      const updates: Record<string, any> = {
        name: form.name, internal_code: form.internal_code, type: form.type,
        brand: form.brand || null, model: form.model || null, year: form.year ? Number(form.year) : null,
        serial_number: form.serial_number || null, horometer_current: Number(form.horometer_current) || 0,
        monthly_cost_estimate: form.monthly_cost_estimate ? Number(form.monthly_cost_estimate) : null,
        notes: form.notes || null, weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        max_capacity: form.max_capacity || null, max_height: form.max_height || null,
        engine_model: form.engine_model || null, fuel_type: form.fuel_type || null,
        plate_number: form.plate_number || null,
      };

      const { error } = await supabase.from('machines').update(updates).eq('id', machine.id);
      if (error) throw error;

      // Upload photo if changed
      if (photoFile && user?.tenant_id) {
        await uploadMachinePhoto(photoFile, machine.id, user.tenant_id);
      }

      // Sync alerts: delete all existing, then insert current
      await supabase.from('machine_maintenance_alerts').delete().eq('machine_id', machine.id);
      if (alerts.length > 0) {
        const rows = alerts.map((a) => ({
          machine_id: machine.id,
          tenant_id: user!.tenant_id,
          alert_name: a.alert_name,
          trigger_type: a.trigger_type,
          horometer_interval: a.horometer_interval,
          calendar_interval_days: a.calendar_interval_days,
          start_date: a.start_date,
          active: a.active,
        }));
        await supabase.from('machine_maintenance_alerts').insert(rows);
      }

      toast({ title: '✓ Máquina actualizada' });
      qc.invalidateQueries({ queryKey: ['machine'] });
      qc.invalidateQueries({ queryKey: ['machines'] });
      qc.invalidateQueries({ queryKey: ['machine-maint-alerts'] });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error al actualizar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow text-lg">Editar Máquina</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Photo */}
          <MachinePhotoUpload
            currentUrl={machine?.cover_photo_url}
            machineId={machine?.id}
            onFileSelect={setPhotoFile}
            size="md"
          />

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="font-dm text-xs">Código interno *</Label><Input value={form.internal_code} onChange={(e) => set('internal_code', e.target.value)} /></div>
            <div><Label className="font-dm text-xs">Nombre *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          </div>

          <div><Label className="font-dm text-xs">Tipo *</Label>
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>{MACHINE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="font-dm text-xs">Marca</Label><Input value={form.brand} onChange={(e) => set('brand', e.target.value)} /></div>
            <div><Label className="font-dm text-xs">Modelo</Label><Input value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="font-dm text-xs">Año</Label><Input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} /></div>
            <div><Label className="font-dm text-xs">Nº Serie</Label><Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></div>
            <div><Label className="font-dm text-xs">Horómetro</Label><Input type="number" value={form.horometer_current} onChange={(e) => set('horometer_current', e.target.value)} /></div>
          </div>

          {/* Ficha técnica expandida */}
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-dm font-semibold pt-2">Ficha técnica</p>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="font-dm text-xs">Peso (kg)</Label><Input type="number" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} /></div>
            <div><Label className="font-dm text-xs">Capacidad máx.</Label><Input value={form.max_capacity} onChange={(e) => set('max_capacity', e.target.value)} /></div>
            <div><Label className="font-dm text-xs">Altura máx.</Label><Input value={form.max_height} onChange={(e) => set('max_height', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="font-dm text-xs">Motor</Label><Input value={form.engine_model} onChange={(e) => set('engine_model', e.target.value)} /></div>
            <div><Label className="font-dm text-xs">Combustible</Label>
              <Select value={form.fuel_type || 'none'} onValueChange={(v) => set('fuel_type', v === 'none' ? '' : v)}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="diesel">Diésel</SelectItem>
                  <SelectItem value="gasolina">Gasolina</SelectItem>
                  <SelectItem value="electrico">Eléctrico</SelectItem>
                  <SelectItem value="gas">Gas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="font-dm text-xs">Placa</Label><Input value={form.plate_number} onChange={(e) => set('plate_number', e.target.value)} /></div>
          </div>

          <div><Label className="font-dm text-xs">Costo estimado mensual (COP)</Label><Input type="number" value={form.monthly_cost_estimate} onChange={(e) => set('monthly_cost_estimate', e.target.value)} /></div>
          <div><Label className="font-dm text-xs">Notas</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></div>

          {/* Maintenance alerts */}
          <div className="border-t border-border pt-4">
            <MachineAlertConfig alerts={alerts} onChange={setAlerts} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
