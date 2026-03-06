import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateMachine } from '@/hooks/useMachineDetail';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

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

const STATUS_OPTIONS = [
  { value: 'disponible_bodega', label: 'Disponible bodega' },
  { value: 'activa_en_campo', label: 'Activa en campo' },
  { value: 'en_campo_dañada', label: 'En campo dañada' },
  { value: 'varada_bodega', label: 'Varada bodega' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateMachineModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const createMachine = useCreateMachine();
  const tenantId = useAuthStore((s) => s.user?.tenant_id);

  const [form, setForm] = useState({
    internal_code: '',
    name: '',
    type: '',
    brand: '',
    model: '',
    year: '',
    serial_number: '',
    status: 'disponible_bodega',
    horometer_current: '0',
    current_project_id: '',
    monthly_cost_estimate: '',
    notes: '',
  });

  const projects = useQuery({
    queryKey: ['active-projects-list', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('tenant_id', tenantId!)
        .eq('status', 'activo');
      return data ?? [];
    },
  });

  const handleSubmit = async () => {
    if (!form.internal_code || !form.name || !form.type) {
      toast({ title: 'Completa los campos obligatorios', variant: 'destructive' });
      return;
    }
    try {
      await createMachine.mutateAsync({
        internal_code: form.internal_code,
        name: form.name,
        type: form.type,
        brand: form.brand || null,
        model: form.model || null,
        year: form.year ? Number(form.year) : null,
        serial_number: form.serial_number || null,
        status: form.status,
        horometer_current: Number(form.horometer_current) || 0,
        current_project_id: form.current_project_id || null,
        monthly_cost_estimate: form.monthly_cost_estimate ? Number(form.monthly_cost_estimate) : null,
        notes: form.notes || null,
      });
      toast({ title: '✓ Máquina creada correctamente' });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error al crear máquina', description: err.message, variant: 'destructive' });
    }
  };

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-barlow text-lg">Nueva Máquina</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-dm text-xs">Código interno *</Label>
              <Input value={form.internal_code} onChange={(e) => set('internal_code', e.target.value)} placeholder="T6" />
            </div>
            <div>
              <Label className="font-dm text-xs">Nombre *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="JCB 533-105" />
            </div>
          </div>

          <div>
            <Label className="font-dm text-xs">Tipo *</Label>
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                {MACHINE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-dm text-xs">Marca</Label>
              <Input value={form.brand} onChange={(e) => set('brand', e.target.value)} />
            </div>
            <div>
              <Label className="font-dm text-xs">Modelo</Label>
              <Input value={form.model} onChange={(e) => set('model', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-dm text-xs">Año</Label>
              <Input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} />
            </div>
            <div>
              <Label className="font-dm text-xs">Nº Serie</Label>
              <Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-dm text-xs">Estado inicial</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-dm text-xs">Horómetro actual</Label>
              <Input type="number" value={form.horometer_current} onChange={(e) => set('horometer_current', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="font-dm text-xs">Proyecto actual</Label>
            <Select value={form.current_project_id} onValueChange={(v) => set('current_project_id', v)}>
              <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
              <SelectContent>
                {projects.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="font-dm text-xs">Costo estimado mensual (COP)</Label>
            <Input type="number" value={form.monthly_cost_estimate} onChange={(e) => set('monthly_cost_estimate', e.target.value)} />
          </div>

          <div>
            <Label className="font-dm text-xs">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMachine.isPending}>
            {createMachine.isPending ? 'Creando...' : 'Crear Máquina'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
