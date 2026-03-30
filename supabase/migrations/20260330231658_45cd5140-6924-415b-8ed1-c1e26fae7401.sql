
-- Fix client_documents: change RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "tenant_isolation" ON public.client_documents;
CREATE POLICY "tenant_isolation" ON public.client_documents
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Fix supplier_documents: change RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "tenant_isolation" ON public.supplier_documents;
CREATE POLICY "tenant_isolation" ON public.supplier_documents
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());
