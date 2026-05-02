-- 1) Harden SECURITY DEFINER / trigger functions: set fixed search_path
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE v_count INTEGER; v_year TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) INTO v_count FROM public.quotations
   WHERE tenant_id = NEW.tenant_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.quote_number := 'COT-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_count INTEGER;
  v_year  TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) INTO v_count
    FROM public.purchase_orders
   WHERE tenant_id = NEW.tenant_id
     AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.order_number := 'OC-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
  RETURN NEW;
END;
$function$;

-- 2) Harden tenant/role helpers: fixed search_path + safer NULL handling
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  select tenant_id from public.users where id = auth.uid() and active is true
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  select role::text from public.users where id = auth.uid() and active is true
$function$;

-- 3) Restrict RLS policies to {authenticated} role across business tables.
-- Recreate the existing tenant_isolation policy on each table with TO authenticated
-- (preserves current logic, just removes anonymous role from the role list).

-- alerts
DROP POLICY IF EXISTS tenant_isolation ON public.alerts;
CREATE POLICY tenant_isolation ON public.alerts
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- clients
DROP POLICY IF EXISTS tenant_isolation ON public.clients;
CREATE POLICY tenant_isolation ON public.clients
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- cost_entries
DROP POLICY IF EXISTS tenant_isolation ON public.cost_entries;
CREATE POLICY tenant_isolation ON public.cost_entries
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- delivery_acts
DROP POLICY IF EXISTS tenant_isolation ON public.delivery_acts;
CREATE POLICY tenant_isolation ON public.delivery_acts
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- financial_categories
DROP POLICY IF EXISTS tenant_isolation ON public.financial_categories;
CREATE POLICY tenant_isolation ON public.financial_categories
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- inventory_consumables
DROP POLICY IF EXISTS tenant_isolation ON public.inventory_consumables;
CREATE POLICY tenant_isolation ON public.inventory_consumables
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- inventory_kit_items (uses subquery)
DROP POLICY IF EXISTS tenant_isolation ON public.inventory_kit_items;
CREATE POLICY tenant_isolation ON public.inventory_kit_items
  FOR ALL TO authenticated
  USING (kit_id IN (SELECT id FROM public.inventory_kits WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (kit_id IN (SELECT id FROM public.inventory_kits WHERE tenant_id = public.get_user_tenant_id()));

-- inventory_kits
DROP POLICY IF EXISTS tenant_isolation ON public.inventory_kits;
CREATE POLICY tenant_isolation ON public.inventory_kits
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- inventory_movements
DROP POLICY IF EXISTS tenant_isolation ON public.inventory_movements;
CREATE POLICY tenant_isolation ON public.inventory_movements
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- inventory_tools
DROP POLICY IF EXISTS tenant_isolation ON public.inventory_tools;
CREATE POLICY tenant_isolation ON public.inventory_tools
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- machine_conditions (subquery via machines)
DROP POLICY IF EXISTS tenant_isolation ON public.machine_conditions;
CREATE POLICY tenant_isolation ON public.machine_conditions
  FOR ALL TO authenticated
  USING (machine_id IN (SELECT id FROM public.machines WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (machine_id IN (SELECT id FROM public.machines WHERE tenant_id = public.get_user_tenant_id()));

-- machines
DROP POLICY IF EXISTS tenant_isolation ON public.machines;
CREATE POLICY tenant_isolation ON public.machines
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- personnel
DROP POLICY IF EXISTS tenant_isolation ON public.personnel;
CREATE POLICY tenant_isolation ON public.personnel
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- preop_items (subquery)
DROP POLICY IF EXISTS tenant_isolation ON public.preop_items;
CREATE POLICY tenant_isolation ON public.preop_items
  FOR ALL TO authenticated
  USING (record_id IN (SELECT id FROM public.preop_records WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (record_id IN (SELECT id FROM public.preop_records WHERE tenant_id = public.get_user_tenant_id()));

-- preop_records
DROP POLICY IF EXISTS tenant_isolation ON public.preop_records;
CREATE POLICY tenant_isolation ON public.preop_records
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- project_machines (subquery)
DROP POLICY IF EXISTS tenant_isolation ON public.project_machines;
CREATE POLICY tenant_isolation ON public.project_machines
  FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE tenant_id = public.get_user_tenant_id()));

-- project_personnel (subquery)
DROP POLICY IF EXISTS tenant_isolation ON public.project_personnel;
CREATE POLICY tenant_isolation ON public.project_personnel
  FOR ALL TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE tenant_id = public.get_user_tenant_id()));

-- projects
DROP POLICY IF EXISTS tenant_isolation ON public.projects;
CREATE POLICY tenant_isolation ON public.projects
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- suppliers
DROP POLICY IF EXISTS tenant_isolation ON public.suppliers;
CREATE POLICY tenant_isolation ON public.suppliers
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- system_logs (split insert/select)
DROP POLICY IF EXISTS logs_insert ON public.system_logs;
DROP POLICY IF EXISTS logs_select ON public.system_logs;
CREATE POLICY logs_insert ON public.system_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY logs_select ON public.system_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.get_user_role() = ANY (ARRAY['superadmin','gerente']));

-- tenants
DROP POLICY IF EXISTS tenant_own ON public.tenants;
CREATE POLICY tenant_own ON public.tenants
  FOR ALL TO authenticated
  USING (id = public.get_user_tenant_id())
  WITH CHECK (id = public.get_user_tenant_id());

-- users (sensitive: phone, role, etc.)
DROP POLICY IF EXISTS tenant_isolation ON public.users;
CREATE POLICY tenant_isolation ON public.users
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- work_order_parts (subquery)
DROP POLICY IF EXISTS tenant_isolation ON public.work_order_parts;
CREATE POLICY tenant_isolation ON public.work_order_parts
  FOR ALL TO authenticated
  USING (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()));

-- work_order_photos (subquery)
DROP POLICY IF EXISTS tenant_isolation ON public.work_order_photos;
CREATE POLICY tenant_isolation ON public.work_order_photos
  FOR ALL TO authenticated
  USING (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()));