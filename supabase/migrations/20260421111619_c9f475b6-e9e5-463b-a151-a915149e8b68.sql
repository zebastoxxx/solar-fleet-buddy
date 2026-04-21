-- Eliminar política redundante en machine_documents (la específica por comando ya cubre)
DROP POLICY IF EXISTS "tenant_isolation" ON public.machine_documents;

-- client_documents: políticas por rol para insert/update/delete, select abierto al tenant
DROP POLICY IF EXISTS "tenant_isolation" ON public.client_documents;

CREATE POLICY "client_documents_select" ON public.client_documents
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "client_documents_insert" ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );

CREATE POLICY "client_documents_update" ON public.client_documents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );

CREATE POLICY "client_documents_delete" ON public.client_documents
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );

-- supplier_documents
DROP POLICY IF EXISTS "tenant_isolation" ON public.supplier_documents;

CREATE POLICY "supplier_documents_select" ON public.supplier_documents
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "supplier_documents_insert" ON public.supplier_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );

CREATE POLICY "supplier_documents_update" ON public.supplier_documents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );

CREATE POLICY "supplier_documents_delete" ON public.supplier_documents
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );

-- project_documents
DROP POLICY IF EXISTS "tenant_isolation" ON public.project_documents;

CREATE POLICY "project_documents_select" ON public.project_documents
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "project_documents_insert" ON public.project_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );

CREATE POLICY "project_documents_update" ON public.project_documents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );

CREATE POLICY "project_documents_delete" ON public.project_documents
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role::text IN ('superadmin','gerente','supervisor'))
  );