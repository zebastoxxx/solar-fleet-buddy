
-- Fix purchase_orders: drop restrictive policy, create permissive one
DROP POLICY IF EXISTS "tenant_isolation" ON public.purchase_orders;
CREATE POLICY "tenant_isolation" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Fix purchase_order_items: drop restrictive policy, create permissive one
DROP POLICY IF EXISTS "tenant_isolation" ON public.purchase_order_items;
CREATE POLICY "tenant_isolation" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Fix purchase_order_documents: drop restrictive policy, create permissive one
DROP POLICY IF EXISTS "tenant_isolation" ON public.purchase_order_documents;
CREATE POLICY "tenant_isolation" ON public.purchase_order_documents
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());
