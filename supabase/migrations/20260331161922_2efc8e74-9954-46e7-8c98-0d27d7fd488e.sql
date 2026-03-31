
-- Fix client_contacts: convert RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "tenant_isolation" ON public.client_contacts;
CREATE POLICY "tenant_isolation" ON public.client_contacts
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Fix supplier_contacts: convert RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "tenant_isolation" ON public.supplier_contacts;
CREATE POLICY "tenant_isolation" ON public.supplier_contacts
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());
