import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export function useMachine(id: string) {
  return useQuery({
    queryKey: ['machine', id],
    enabled: !!id,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*, projects:current_project_id(name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useMachineConditions(machineId: string) {
  return useQuery({
    queryKey: ['machine-conditions', machineId],
    enabled: !!machineId,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase.from('machine_conditions').select('*').eq('machine_id', machineId);
      return data ?? [];
    },
  });
}

export function useMachineOTs(machineId: string) {
  return useQuery({
    queryKey: ['machine-ots', machineId],
    enabled: !!machineId,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from('work_orders')
        .select('id, code, type, status, priority, problem_description, actual_hours, total_cost, created_at, closed_at')
        .eq('machine_id', machineId)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });
}

export function useMachinePreops(machineId: string) {
  return useQuery({
    queryKey: ['machine-preops', machineId],
    enabled: !!machineId,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from('preop_records')
        .select('*, personnel:operator_id(full_name)')
        .eq('machine_id', machineId)
        .order('created_at', { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });
}

export function useMachineKits(machineId: string) {
  return useQuery({
    queryKey: ['machine-kits', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data } = await supabase.from('inventory_kits').select('*, inventory_kit_items(*)').eq('machine_id', machineId);
      return data ?? [];
    },
  });
}

export function useMachineProjects(machineId: string) {
  return useQuery({
    queryKey: ['machine-projects', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data } = await supabase
        .from('project_machines')
        .select('*, projects:project_id(name, status, clients:client_id(name))')
        .eq('machine_id', machineId)
        .order('assigned_date', { ascending: false });
      return data ?? [];
    },
  });
}

export function useMachineDocuments(machineId: string) {
  return useQuery({
    queryKey: ['machine-documents', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data } = await supabase.from('machine_documents').select('*').eq('machine_id', machineId).order('uploaded_at', { ascending: false });
      return data ?? [];
    },
  });
}

export function useMachineCosts(machineId: string) {
  return useQuery({
    queryKey: ['machine-costs', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data } = await supabase.from('cost_entries').select('*').eq('machine_id', machineId).order('cost_date', { ascending: true });
      return data ?? [];
    },
  });
}

export function useMachineAlerts(machineId: string) {
  return useQuery({
    queryKey: ['machine-alerts', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data } = await supabase.from('alerts').select('*').eq('machine_id', machineId).order('created_at', { ascending: false });
      return data ?? [];
    },
  });
}

export function useMachineFinancials(machineId: string) {
  return useQuery({
    queryKey: ['machine-financials', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data } = await supabase
        .from('machine_financials')
        .select('*')
        .eq('machine_id', machineId)
        .maybeSingle();
      return data;
    },
  });
}

export function useMachineMaintenanceAlerts(machineId: string) {
  return useQuery({
    queryKey: ['machine-maint-alerts', machineId],
    enabled: !!machineId,
    queryFn: async () => {
      const { data } = await supabase.from('machine_maintenance_alerts').select('*').eq('machine_id', machineId).order('created_at', { ascending: false });
      return data ?? [];
    },
  });
}

export function useUpdateMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('machines').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machine'] });
      qc.invalidateQueries({ queryKey: ['machines'] });
    },
  });
}

export function useUpdateMachineStatus() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'disponible_bodega') updates.current_project_id = null;
      const { error } = await supabase.from('machines').update(updates).eq('id', id);
      if (error) throw error;
      if (user) {
        await supabase.from('system_logs').insert({
          tenant_id: user.tenant_id, user_id: user.id, user_name: user.full_name, user_role: user.role,
          module: 'maquinas', action: 'cambiar_estado', entity_type: 'machine', entity_id: id,
          detail: { new_status: status },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines'] });
      qc.invalidateQueries({ queryKey: ['machine'] });
      qc.invalidateQueries({ queryKey: ['fleet-stats'] });
    },
  });
}

export function useCreateMachine() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: async (machine: Record<string, unknown>) => {
      const payload = { ...machine, tenant_id: user!.tenant_id } as any;
      const { data, error } = await supabase.from('machines').insert(payload).select().single();
      if (error) throw error;
      if (user) {
        await supabase.from('system_logs').insert({
          tenant_id: user.tenant_id, user_id: user.id, user_name: user.full_name, user_role: user.role,
          module: 'maquinas', action: 'crear_maquina', entity_type: 'machine', entity_id: data.id, entity_name: data.name,
        });
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines'] });
      qc.invalidateQueries({ queryKey: ['fleet-stats'] });
    },
  });
}

const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100 MB

function sanitizeFilename(name: string): { base: string; ext: string } {
  const lastDot = name.lastIndexOf('.');
  const rawBase = lastDot > 0 ? name.slice(0, lastDot) : name;
  const rawExt = lastDot > 0 ? name.slice(lastDot + 1) : '';
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '');
  const base = norm(rawBase) || 'archivo';
  const ext = norm(rawExt);
  return { base, ext };
}

export function useUploadMachineDocument() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: async ({ machineId, file, name, docType, expiryDate }: {
      machineId: string; file: File; name: string; docType: string; expiryDate?: string;
    }) => {
      if (file.size > MAX_DOC_SIZE) {
        const err = new Error('El archivo excede el límite de 100 MB');
        (err as any).code = 'FILE_TOO_LARGE';
        throw err;
      }
      if (!user?.tenant_id) throw new Error('Sesión no válida');
      const { base, ext } = sanitizeFilename(file.name);
      const path = `${user.tenant_id}/${machineId}/${Date.now()}_${base}${ext ? '.' + ext : ''}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      const { error } = await supabase.from('machine_documents').insert({
        machine_id: machineId,
        tenant_id: user.tenant_id,
        name,
        doc_type: docType,
        file_url: publicUrl,
        expiry_date: expiryDate || null,
        uploaded_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['machine-documents'] }),
  });
}

export function useDeleteMachineDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl?: string | null }) => {
      // Try to remove the storage object first (best effort)
      if (fileUrl) {
        try {
          const marker = '/storage/v1/object/public/documents/';
          const idx = fileUrl.indexOf(marker);
          if (idx >= 0) {
            const path = decodeURIComponent(fileUrl.slice(idx + marker.length));
            await supabase.storage.from('documents').remove([path]);
          }
        } catch { /* ignore storage errors, proceed with DB delete */ }
      }
      const { error } = await supabase.from('machine_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['machine-documents'] }),
  });
}
