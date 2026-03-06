
-- Fix: financial_categories RLS policy is restrictive, needs to be permissive
DROP POLICY IF EXISTS "tenant_isolation" ON financial_categories;
CREATE POLICY "tenant_isolation" ON financial_categories
  FOR ALL USING (tenant_id = get_user_tenant_id());
