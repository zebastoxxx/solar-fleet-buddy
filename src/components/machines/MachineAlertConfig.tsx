import { useState } from 'react';
import { Plus, Trash2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export interface MaintenanceAlert {
  id?: string;
  alert_name: string;
  trigger_type: 'horometer' | 'calendar';
  horometer_interval: number | null;
  calendar_interval_days: number | null;
  start_date: string | null;
  active: boolean;
}

const DEFAULT_TEMPLATE: MaintenanceAlert[] = [
  { alert_name: 'Cambio de aceite', trigger_type: 'horometer', horometer_interval: 250, calendar_interval_days: null, start_date: null, active: true },
  { alert_name: 'Filtro de aire', trigger_type: 'horometer', horometer_interval: 500, calendar_interval_days: null, start_date: null, active: true },
  { alert_name: 'Filtro hidráulico', trigger_type: 'horometer', horometer_interval: 1000, calendar_interval_days: null, start_date: null, active: true },
  { alert_name: 'Engrase general', trigger_type: 'horometer', horometer_interval: 50, calendar_interval_days: null, start_date: null, active: true },
  { alert_name: 'Revisión de frenos', trigger_type: 'horometer', horometer_interval: 500, calendar_interval_days: null, start_date: null, active: true },
  { alert_name: 'Inspección general anual', trigger_type: 'calendar', horometer_interval: null, calendar_interval_days: 365, start_date: null, active: true },
];

interface Props {
  alerts: MaintenanceAlert[];
  onChange: (alerts: MaintenanceAlert[]) => void;
}

export function MachineAlertConfig({ alerts, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newAlert, setNewAlert] = useState<MaintenanceAlert>({
    alert_name: '', trigger_type: 'horometer', horometer_interval: 250, calendar_interval_days: null, start_date: null, active: true,
  });

  const applyTemplate = () => onChange([...alerts, ...DEFAULT_TEMPLATE]);
  const removeAll = () => onChange([]);

  const addAlert = () => {
    if (!newAlert.alert_name) return;
    onChange([...alerts, { ...newAlert }]);
    setNewAlert({ alert_name: '', trigger_type: 'horometer', horometer_interval: 250, calendar_interval_days: null, start_date: null, active: true });
    setShowAdd(false);
  };

  const removeAlert = (idx: number) => onChange(alerts.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h4 className="font-barlow text-sm font-semibold">Alertas de Mantenimiento</h4>
        </div>
        <div className="flex gap-1.5">
          {alerts.length === 0 && (
            <Button type="button" variant="outline" size="sm" className="text-[11px] h-7 font-dm" onClick={applyTemplate}>
              Usar plantilla
            </Button>
          )}
          {alerts.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="text-[11px] h-7 font-dm text-muted-foreground" onClick={removeAll}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-dm">
              <span className="flex-1 truncate">{a.alert_name}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {a.trigger_type === 'horometer' ? `c/${a.horometer_interval}h` : `c/${a.calendar_interval_days}d`}
              </span>
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeAlert(i)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
          <div>
            <Label className="font-dm text-xs">Nombre *</Label>
            <Input value={newAlert.alert_name} onChange={(e) => setNewAlert({ ...newAlert, alert_name: e.target.value })} placeholder="Ej: Cambio de aceite" className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="font-dm text-xs">Tipo</Label>
              <Select value={newAlert.trigger_type} onValueChange={(v) => setNewAlert({ ...newAlert, trigger_type: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horometer">Horómetro</SelectItem>
                  <SelectItem value="calendar">Calendario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-dm text-xs">{newAlert.trigger_type === 'horometer' ? 'Cada X horas' : 'Cada X días'}</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={newAlert.trigger_type === 'horometer' ? (newAlert.horometer_interval ?? '') : (newAlert.calendar_interval_days ?? '')}
                onChange={(e) => {
                  const val = Number(e.target.value) || null;
                  if (newAlert.trigger_type === 'horometer') setNewAlert({ ...newAlert, horometer_interval: val });
                  else setNewAlert({ ...newAlert, calendar_interval_days: val as any });
                }}
              />
            </div>
          </div>
          {newAlert.trigger_type === 'calendar' && (
            <div>
              <Label className="font-dm text-xs">Fecha inicio</Label>
              <Input type="date" className="h-8 text-xs" value={newAlert.start_date ?? ''} onChange={(e) => setNewAlert({ ...newAlert, start_date: e.target.value || null })} />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" className="h-7 text-xs" onClick={addAlert}>Agregar</Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="text-xs h-7 font-dm gap-1 w-full" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3" /> Agregar alerta
        </Button>
      )}
    </div>
  );
}
