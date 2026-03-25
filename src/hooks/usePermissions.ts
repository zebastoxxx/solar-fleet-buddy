import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/stores/authStore';

const PERMISSIONS: Record<string, UserRole[]> = {
  dashboard: ['superadmin', 'gerente', 'supervisor'],
  analytics: ['superadmin', 'gerente'],
  clientes: ['superadmin', 'gerente', 'supervisor'],
  proveedores: ['superadmin', 'gerente', 'supervisor'],
  maquinas: ['superadmin', 'gerente', 'supervisor'],
  personal: ['superadmin', 'gerente', 'supervisor'],
  proyectos: ['superadmin', 'gerente', 'supervisor'],
  preop_view: ['superadmin', 'gerente', 'supervisor'],
  preop_create: ['operario'],
  ot_view: ['superadmin', 'gerente', 'supervisor'],
  ot_own: ['tecnico'],
  inventario: ['superadmin', 'gerente', 'supervisor'],
  compras: ['superadmin', 'gerente', 'supervisor'],
  configuracion: ['superadmin', 'gerente', 'supervisor'],
  logs: ['superadmin', 'gerente'],
  financiero: ['superadmin', 'gerente'],
};

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const can = (permission: keyof typeof PERMISSIONS) =>
    user ? PERMISSIONS[permission]?.includes(user.role) ?? false : false;
  return { can, role: user?.role ?? null };
}
