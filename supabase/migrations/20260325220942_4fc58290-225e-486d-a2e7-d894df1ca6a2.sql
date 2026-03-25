-- Fix infinite recursion between work_orders and work_order_technicians RLS policies
-- Root cause: work_orders SELECT policy referenced work_order_technicians,
-- while work_order_technicians tenant policy referenced work_orders.

DROP POLICY IF EXISTS tenant_isolation ON public.work_order_technicians;

CREATE POLICY tenant_isolation
ON public.work_order_technicians
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.personnel p
    WHERE p.id = work_order_technicians.personnel_id
      AND p.tenant_id = public.get_user_tenant_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.personnel p
    WHERE p.id = work_order_technicians.personnel_id
      AND p.tenant_id = public.get_user_tenant_id()
  )
);