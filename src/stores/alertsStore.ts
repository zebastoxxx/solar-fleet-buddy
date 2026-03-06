import { create } from 'zustand';

export interface Alert {
  id: string;
  tenant_id: string;
  type: string;
  severity: string;
  machine_id: string | null;
  message: string;
  resolved: boolean;
  created_at: string | null;
  resolved_at: string | null;
}

interface AlertsState {
  unresolved: Alert[];
  criticalCount: number;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  resolveAlert: (id: string) => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  unresolved: [],
  criticalCount: 0,
  setAlerts: (alerts) => set({
    unresolved: alerts,
    criticalCount: alerts.filter(a => a.severity === 'critical').length,
  }),
  addAlert: (alert) => set((state) => ({
    unresolved: [alert, ...state.unresolved],
    criticalCount: alert.severity === 'critical'
      ? state.criticalCount + 1
      : state.criticalCount,
  })),
  resolveAlert: (id) => set((state) => ({
    unresolved: state.unresolved.filter(a => a.id !== id),
    criticalCount: state.unresolved.find(a => a.id === id)?.severity === 'critical'
      ? state.criticalCount - 1
      : state.criticalCount,
  })),
}));
