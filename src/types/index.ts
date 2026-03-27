export type UserRole = 'superadmin' | 'gerente' | 'supervisor' | 'tecnico' | 'operario';

export type MachineStatus = 'activa_en_campo' | 'disponible_bodega' | 'en_campo_dañada' | 'varada_bodega';

export type MachineType = 'telehandler' | 'manlift' | 'tijera' | 'hincadora' | 'minicargador' | 'retroexcavadora' | 'camion_grua' | 'otro';

export type OTStatus = 'creada' | 'asignada' | 'en_curso' | 'pausada' | 'cerrada' | 'firmada';

export type OTType = 'preventivo' | 'correctivo' | 'inspeccion' | 'preparacion';

export type PreopResult = 'bueno' | 'malo' | 'na';

export interface Tenant {
  id: string;
  name: string;
  tax_id: string;
  logo_url: string | null;
  monthly_budget: number;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  tax_id: string | null;
  type: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  country: string;
  city: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  tax_id: string | null;
  type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  city: string | null;
  specialty: string | null;
  rating: number | null;
  status: string;
  created_at: string;
}

export interface Personnel {
  id: string;
  tenant_id: string;
  user_id: string | null;
  full_name: string;
  id_number: string | null;
  phone: string | null;
  email: string | null;
  type: 'tecnico' | 'operario';
  specialty: string | null;
  hourly_rate: number;
  status: string;
  created_at: string;
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  client_id: string | null;
  country: string;
  city: string | null;
  status: string;
  start_date: string | null;
  end_date_estimated: string | null;
  budget: number | null;
  description: string | null;
  created_at: string;
}

export interface Machine {
  id: string;
  tenant_id: string;
  internal_code: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  serial_number: string | null;
  type: MachineType;
  status: MachineStatus;
  horometer_current: number;
  current_project_id: string | null;
  cover_photo_url: string | null;
  monthly_cost_estimate: number | null;
  notes: string | null;
  created_at: string;
}

export interface WorkOrder {
  id: string;
  tenant_id: string;
  code: string;
  machine_id: string | null;
  project_id: string | null;
  type: OTType;
  priority: string;
  location_type: 'bodega_propia' | 'campo_directo' | 'taller_tercero';
  supplier_id: string | null;
  status: OTStatus;
  problem_description: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  parts_cost: number;
  labor_cost: number;
  external_cost: number;
  total_cost: number;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
  signed_at: string | null;
}

export interface PreopRecord {
  id: string;
  tenant_id: string;
  machine_id: string | null;
  project_id: string | null;
  operator_id: string | null;
  record_type: 'inicio' | 'cierre';
  horometer_value: number;
  hours_worked: number | null;
  machine_status_at_close: string | null;
  has_critical_failures: boolean;
  observations: string | null;
  digital_signature_url: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface InventoryConsumable {
  id: string;
  tenant_id: string;
  name: string;
  category: string | null;
  unit: string | null;
  stock_current: number;
  stock_minimum: number;
  unit_cost: number | null;
  supplier_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  tenant_id: string;
  type: string | null;
  severity: string | null;
  machine_id: string | null;
  message: string | null;
  resolved: boolean;
  created_at: string;
}

// Permissions config
export const ROLE_REDIRECTS: Record<UserRole, string> = {
  superadmin: '/dashboard',
  gerente: '/dashboard',
  supervisor: '/maquinas',
  tecnico: '/mis-ot',
  operario: '/preoperacional',
};

export const PERMISSIONS: Record<string, UserRole[]> = {
  dashboard: ['superadmin', 'gerente', 'supervisor'],
  analytics: ['superadmin', 'gerente'],
  clientes: ['superadmin', 'gerente', 'supervisor'],
  proveedores: ['superadmin', 'gerente', 'supervisor'],
  maquinas: ['superadmin', 'gerente', 'supervisor'],
  personal: ['superadmin', 'gerente', 'supervisor'],
  proyectos: ['superadmin', 'gerente', 'supervisor'],
  cotizaciones: ['superadmin', 'gerente', 'supervisor'],
  preop_view: ['superadmin', 'gerente', 'supervisor'],
  preop_create: ['operario'],
  ot_view: ['superadmin', 'gerente', 'supervisor'],
  ot_own: ['tecnico'],
  inventario: ['superadmin', 'gerente', 'supervisor'],
  compras: ['superadmin', 'gerente', 'supervisor'],
  financiero: ['superadmin', 'gerente'],
  configuracion: ['superadmin', 'gerente'],
  logs: ['superadmin', 'gerente'],
};

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  permission: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'BarChart3', permission: 'dashboard' },
  { label: 'Analytics', path: '/analytics', icon: 'TrendingUp', permission: 'analytics' },
  { label: 'Clientes', path: '/clientes', icon: 'Users', permission: 'clientes' },
  { label: 'Proveedores', path: '/proveedores', icon: 'Factory', permission: 'proveedores' },
  { label: 'Máquinas', path: '/maquinas', icon: 'Truck', permission: 'maquinas' },
  { label: 'Personal', path: '/personal', icon: 'HardHat', permission: 'personal' },
  { label: 'Proyectos', path: '/proyectos', icon: 'FolderOpen', permission: 'proyectos' },
  { label: 'Cotizaciones', path: '/cotizaciones', icon: 'FileText', permission: 'cotizaciones' },
  { label: 'Preoperacionales', path: '/preoperacionales', icon: 'ClipboardList', permission: 'preop_view' },
  { label: 'Órdenes de Trabajo', path: '/ordenes-trabajo', icon: 'Wrench', permission: 'ot_view' },
  { label: 'Inventario', path: '/inventario', icon: 'Package', permission: 'inventario' },
  { label: 'Compras', path: '/compras', icon: 'ShoppingCart', permission: 'compras' },
  { label: 'Financiero', path: '/financiero', icon: 'DollarSign', permission: 'financiero' },
  { label: 'Configuración', path: '/configuracion', icon: 'Settings', permission: 'configuracion' },
];
