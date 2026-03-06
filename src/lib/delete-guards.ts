import { supabase } from '@/integrations/supabase/client';

export interface DeleteCheckResult {
  canDelete: boolean;
  hardDelete: boolean;
  dependencies: string[];
  warnings: string[];
}

export async function checkDeleteClient(clientId: string): Promise<DeleteCheckResult> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, status')
    .eq('client_id', clientId);

  const activeProjects = projects?.filter((p) => p.status === 'activo') || [];
  const allProjects = projects || [];

  if (activeProjects.length > 0) {
    return {
      canDelete: false,
      hardDelete: false,
      dependencies: [
        `${activeProjects.length} proyecto(s) activo(s): ${activeProjects.map((p) => p.name).join(', ')}`,
      ],
      warnings: [],
    };
  }

  return {
    canDelete: true,
    hardDelete: false,
    dependencies: [],
    warnings:
      allProjects.length > 0
        ? [`Este cliente tiene ${allProjects.length} proyecto(s) histórico(s) que quedarán sin cliente asignado`]
        : [],
  };
}

export async function checkDeleteSupplier(supplierId: string): Promise<DeleteCheckResult> {
  const { data: openOTs } = await supabase
    .from('work_orders')
    .select('id, code')
    .eq('supplier_id', supplierId)
    .in('status', ['creada', 'asignada', 'en_curso', 'pausada']);

  if (openOTs && openOTs.length > 0) {
    return {
      canDelete: false,
      hardDelete: false,
      dependencies: [`${openOTs.length} OT(s) abiertas: ${openOTs.map((o) => o.code).join(', ')}`],
      warnings: [],
    };
  }

  return { canDelete: true, hardDelete: false, dependencies: [], warnings: [] };
}

export async function checkDeletePersonnel(personnelId: string): Promise<DeleteCheckResult> {
  const { data: techRows } = await supabase
    .from('work_order_technicians')
    .select('work_order_id')
    .eq('personnel_id', personnelId);

  if (techRows && techRows.length > 0) {
    const otIds = techRows.map((r) => r.work_order_id);
    const { data: activeOTs } = await supabase
      .from('work_orders')
      .select('code, status')
      .in('id', otIds)
      .in('status', ['creada', 'asignada', 'en_curso', 'pausada']);

    if (activeOTs && activeOTs.length > 0) {
      return {
        canDelete: false,
        hardDelete: false,
        dependencies: [`${activeOTs.length} OT(s) asignada(s) actualmente`],
        warnings: [],
      };
    }
  }

  return {
    canDelete: true,
    hardDelete: false,
    dependencies: [],
    warnings: ['El historial de OT y preoperacionales se conservará'],
  };
}

export async function checkDeleteProject(projectId: string): Promise<DeleteCheckResult> {
  const { data: machines } = await supabase
    .from('project_machines')
    .select('machine_id')
    .eq('project_id', projectId)
    .is('removed_date', null);

  const { data: openOTs } = await supabase
    .from('work_orders')
    .select('code')
    .eq('project_id', projectId)
    .in('status', ['creada', 'asignada', 'en_curso']);

  const deps: string[] = [];
  if (machines && machines.length > 0) deps.push(`${machines.length} máquina(s) actualmente asignada(s)`);
  if (openOTs && openOTs.length > 0) deps.push(`${openOTs.length} OT(s) abiertas`);

  if (deps.length > 0) {
    return { canDelete: false, hardDelete: false, dependencies: deps, warnings: [] };
  }

  return {
    canDelete: true,
    hardDelete: false,
    dependencies: [],
    warnings: ['Todos los registros históricos (preops, OT, costos) se conservarán'],
  };
}

export async function checkDeleteMachine(machineId: string): Promise<DeleteCheckResult> {
  const { data: openOTs } = await supabase
    .from('work_orders')
    .select('code')
    .eq('machine_id', machineId)
    .in('status', ['creada', 'asignada', 'en_curso', 'pausada']);

  if (openOTs && openOTs.length > 0) {
    return {
      canDelete: false,
      hardDelete: false,
      dependencies: [`${openOTs.length} OT(s) abiertas en esta máquina`],
      warnings: [],
    };
  }

  return {
    canDelete: true,
    hardDelete: false,
    dependencies: [],
    warnings: ['El historial de OT, preops y costos se conservará'],
  };
}

export async function checkDeleteCostEntry(_id: string): Promise<DeleteCheckResult> {
  return { canDelete: true, hardDelete: true, dependencies: [], warnings: [] };
}
