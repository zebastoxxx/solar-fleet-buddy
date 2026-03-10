import { supabase } from '@/integrations/supabase/client';

// Helper: OT cascade cleanup (reused by machines, projects, standalone)
async function cleanupWorkOrders(otIds: string[]) {
  if (!otIds.length) return;
  await supabase.from('work_order_technicians').delete().in('work_order_id', otIds);
  await supabase.from('work_order_parts').delete().in('work_order_id', otIds);
  await supabase.from('work_order_photos').delete().in('work_order_id', otIds);
  await supabase.from('work_order_tools').delete().in('work_order_id', otIds);
  await supabase.from('work_order_timers').delete().in('work_order_id', otIds);
  await supabase.from('cost_entries').delete().in('work_order_id', otIds);
  await supabase.from('delivery_acts').delete().in('work_order_id', otIds);
}

// ─── MÁQUINAS ────────────────────────────────
export async function deleteMachines(ids: string[]) {
  if (!ids.length) return;
  const { data: ots } = await supabase.from('work_orders').select('id').in('machine_id', ids);
  await cleanupWorkOrders((ots ?? []).map((o: any) => o.id));
  await supabase.from('work_orders').delete().in('machine_id', ids);
  await supabase.from('project_machines').delete().in('machine_id', ids);
  await supabase.from('preop_records').delete().in('machine_id', ids);
  await supabase.from('machine_maintenance_alerts').delete().in('machine_id', ids);
  await supabase.from('machine_conditions').delete().in('machine_id', ids);
  await supabase.from('machine_documents').delete().in('machine_id', ids);
  await supabase.from('cost_entries').delete().in('machine_id', ids);
  // Unlink kits referencing these machines
  await supabase.from('inventory_kits').update({ machine_id: null } as any).in('machine_id', ids);
  const { error } = await supabase.from('machines').delete().in('id', ids);
  if (error) throw error;
}

// ─── CLIENTES ────────────────────────────────
export async function deleteClients(ids: string[]) {
  if (!ids.length) return;
  const { data: projects } = await supabase.from('projects').select('id').in('client_id', ids);
  const pIds = (projects ?? []).map((p: any) => p.id);
  if (pIds.length) await deleteProjects(pIds);
  const { error } = await supabase.from('clients').delete().in('id', ids);
  if (error) throw error;
}

// ─── PROVEEDORES ─────────────────────────────
export async function deleteSuppliers(ids: string[]) {
  if (!ids.length) return;
  await supabase.from('work_orders').update({ supplier_id: null } as any).in('supplier_id', ids);
  await supabase.from('inventory_consumables').update({ supplier_id: null } as any).in('supplier_id', ids);
  await supabase.from('cost_entries').update({ supplier_id: null } as any).in('supplier_id', ids);
  const { error } = await supabase.from('suppliers').delete().in('id', ids);
  if (error) throw error;
}

// ─── PROYECTOS ───────────────────────────────
export async function deleteProjects(ids: string[]) {
  if (!ids.length) return;
  const { data: ots } = await supabase.from('work_orders').select('id').in('project_id', ids);
  await cleanupWorkOrders((ots ?? []).map((o: any) => o.id));
  await supabase.from('work_orders').delete().in('project_id', ids);
  await supabase.from('project_machines').delete().in('project_id', ids);
  await supabase.from('project_personnel').delete().in('project_id', ids);
  await supabase.from('cost_entries').delete().in('project_id', ids);
  await supabase.from('preop_records').delete().in('project_id', ids);
  // Unlink machines referencing these projects
  await supabase.from('machines').update({ current_project_id: null } as any).in('current_project_id', ids);
  const { error } = await supabase.from('projects').delete().in('id', ids);
  if (error) throw error;
}

// ─── PERSONAL ────────────────────────────────
export async function deletePersonnel(ids: string[]) {
  if (!ids.length) return;
  await supabase.from('work_order_technicians').delete().in('personnel_id', ids);
  await supabase.from('project_personnel').delete().in('personnel_id', ids);
  await supabase.from('delivery_acts').update({ personnel_id: null } as any).in('personnel_id', ids);
  await supabase.from('inventory_tools').update({ assigned_to_person: null } as any).in('assigned_to_person', ids);
  // Unlink preop operator references
  await supabase.from('preop_records').update({ operator_id: null } as any).in('operator_id', ids);
  const { error } = await supabase.from('personnel').delete().in('id', ids);
  if (error) throw error;
}

// ─── ÓRDENES DE TRABAJO ──────────────────────
export async function deleteWorkOrders(ids: string[]) {
  if (!ids.length) return;
  await cleanupWorkOrders(ids);
  const { error } = await supabase.from('work_orders').delete().in('id', ids);
  if (error) throw error;
}

// ─── INVENTARIO CONSUMIBLES ──────────────────
export async function deleteConsumables(ids: string[]) {
  if (!ids.length) return;
  await supabase.from('inventory_kit_items').delete().in('consumable_id', ids);
  await supabase.from('work_order_parts').delete().in('consumable_id', ids);
  const { error } = await supabase.from('inventory_consumables').delete().in('id', ids);
  if (error) throw error;
}

// ─── INVENTARIO HERRAMIENTAS ─────────────────
export async function deleteTools(ids: string[]) {
  if (!ids.length) return;
  await supabase.from('inventory_kit_items').delete().in('tool_id', ids);
  await supabase.from('work_order_tools').delete().in('tool_id', ids);
  const { error } = await supabase.from('inventory_tools').delete().in('id', ids);
  if (error) throw error;
}

// ─── INVENTARIO KITS ─────────────────────────
export async function deleteKits(ids: string[]) {
  if (!ids.length) return;
  await supabase.from('inventory_kit_items').delete().in('kit_id', ids);
  await supabase.from('delivery_acts').delete().in('kit_id', ids);
  const { error } = await supabase.from('inventory_kits').delete().in('id', ids);
  if (error) throw error;
}

// ─── PREOPERACIONALES ────────────────────────
export async function deletePreoperacionales(ids: string[]) {
  if (!ids.length) return;
  await supabase.from('preop_items').delete().in('record_id', ids);
  const { error } = await supabase.from('preop_records').delete().in('id', ids);
  if (error) throw error;
}
