
-- Drop recursive policies
DROP POLICY IF EXISTS tecnico_own_work_orders ON public.work_orders;
DROP POLICY IF EXISTS tenant_isolation ON public.work_order_technicians;
DROP POLICY IF EXISTS tecnico_own_assignments ON public.work_order_technicians;

-- Helper function (SECURITY DEFINER bypasses RLS, breaking recursion)
CREATE OR REPLACE FUNCTION public.is_technician_of_ot(_ot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.work_order_technicians wot
    JOIN public.personnel p ON p.id = wot.personnel_id
    WHERE wot.work_order_id = _ot_id
      AND p.user_id = auth.uid()
  );
$$;

-- work_orders: tenant isolation only (no recursive technician check)
-- Add a SELECT policy that includes the technician case using the SECURITY DEFINER function
CREATE POLICY work_orders_select
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  OR public.is_technician_of_ot(id)
);

-- work_order_technicians: simple tenant via direct check on work_orders using SECURITY DEFINER helper
CREATE OR REPLACE FUNCTION public.ot_belongs_to_tenant(_ot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.work_orders
    WHERE id = _ot_id AND tenant_id = get_user_tenant_id()
  );
$$;

CREATE POLICY work_order_technicians_all
ON public.work_order_technicians
FOR ALL
TO authenticated
USING (public.ot_belongs_to_tenant(work_order_id))
WITH CHECK (public.ot_belongs_to_tenant(work_order_id));
