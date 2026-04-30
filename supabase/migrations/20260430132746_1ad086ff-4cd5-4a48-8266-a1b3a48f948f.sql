CREATE OR REPLACE FUNCTION public.is_admin_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.active IS TRUE
      AND u.role::text IN ('superadmin', 'gerente', 'supervisor')
  );
$$;

DROP POLICY IF EXISTS admin_full_access ON public.quotations;
CREATE POLICY admin_full_access
ON public.quotations
FOR ALL
TO authenticated
USING (public.is_admin_role() AND tenant_id = public.get_user_tenant_id())
WITH CHECK (public.is_admin_role() AND tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS admin_full_access ON public.quotation_items;
CREATE POLICY admin_full_access
ON public.quotation_items
FOR ALL
TO authenticated
USING (public.is_admin_role() AND tenant_id = public.get_user_tenant_id())
WITH CHECK (public.is_admin_role() AND tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS admin_full_access ON public.quote_equipment_rates;
CREATE POLICY admin_full_access
ON public.quote_equipment_rates
FOR ALL
TO authenticated
USING (public.is_admin_role() AND tenant_id = public.get_user_tenant_id())
WITH CHECK (public.is_admin_role() AND tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS admin_full_access ON public.machine_maintenance_alerts;
CREATE POLICY admin_full_access
ON public.machine_maintenance_alerts
FOR ALL
TO authenticated
USING (public.is_admin_role() AND tenant_id = public.get_user_tenant_id())
WITH CHECK (public.is_admin_role() AND tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS admin_full_access ON public.task_templates;
CREATE POLICY admin_full_access
ON public.task_templates
FOR ALL
TO authenticated
USING (public.is_admin_role() AND tenant_id = public.get_user_tenant_id())
WITH CHECK (public.is_admin_role() AND tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS admin_full_access ON public.work_order_notes;
CREATE POLICY admin_full_access
ON public.work_order_notes
FOR ALL
TO authenticated
USING (public.is_admin_role() AND tenant_id = public.get_user_tenant_id())
WITH CHECK (public.is_admin_role() AND tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS admin_full_access ON public.work_order_tasks;
CREATE POLICY admin_full_access
ON public.work_order_tasks
FOR ALL
TO authenticated
USING (public.is_admin_role() AND tenant_id = public.get_user_tenant_id())
WITH CHECK (public.is_admin_role() AND tenant_id = public.get_user_tenant_id());