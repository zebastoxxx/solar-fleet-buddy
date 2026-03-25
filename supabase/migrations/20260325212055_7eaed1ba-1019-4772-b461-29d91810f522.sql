-- Permitir a técnicos leer su propio registro en personnel
DROP POLICY IF EXISTS "own_personnel" ON public.personnel;
CREATE POLICY "own_personnel" ON public.personnel
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id = get_user_tenant_id()
  );

-- Permitir a técnicos leer work_order_technicians donde están asignados
DROP POLICY IF EXISTS "tecnico_own_assignments" ON public.work_order_technicians;
CREATE POLICY "tecnico_own_assignments" ON public.work_order_technicians
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnel p
      WHERE p.id = work_order_technicians.personnel_id
      AND p.user_id = auth.uid()
    )
  );

-- Permitir a técnicos leer work_orders donde están asignados
DROP POLICY IF EXISTS "tecnico_own_work_orders" ON public.work_orders;
CREATE POLICY "tecnico_own_work_orders" ON public.work_orders
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    OR EXISTS (
      SELECT 1 FROM public.work_order_technicians wot
      JOIN public.personnel p ON p.id = wot.personnel_id
      WHERE wot.work_order_id = work_orders.id
      AND p.user_id = auth.uid()
    )
  );

-- Permitir a operarios leer preoperacionales propios
DROP POLICY IF EXISTS "operario_own_preop" ON public.preop_records;
CREATE POLICY "operario_own_preop" ON public.preop_records
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    OR operator_id = auth.uid()
  );