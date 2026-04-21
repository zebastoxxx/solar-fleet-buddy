
-- a) Ampliar límite del bucket documents a 100 MB
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'documents';

-- c) Añadir tenant_id a machine_documents si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='machine_documents' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.machine_documents ADD COLUMN tenant_id UUID;
    UPDATE public.machine_documents md
      SET tenant_id = m.tenant_id
      FROM public.machines m
      WHERE md.machine_id = m.id;
    ALTER TABLE public.machine_documents
      ALTER COLUMN tenant_id SET NOT NULL,
      ADD CONSTRAINT machine_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- b) RLS en machine_documents
ALTER TABLE public.machine_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machine_documents_select" ON public.machine_documents;
CREATE POLICY "machine_documents_select" ON public.machine_documents
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "machine_documents_insert" ON public.machine_documents;
CREATE POLICY "machine_documents_insert" ON public.machine_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role::text IN ('superadmin','gerente','supervisor')
    )
  );

DROP POLICY IF EXISTS "machine_documents_update" ON public.machine_documents;
CREATE POLICY "machine_documents_update" ON public.machine_documents
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role::text IN ('superadmin','gerente','supervisor')
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role::text IN ('superadmin','gerente','supervisor')
    )
  );

DROP POLICY IF EXISTS "machine_documents_delete" ON public.machine_documents;
CREATE POLICY "machine_documents_delete" ON public.machine_documents
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role::text IN ('superadmin','gerente','supervisor')
    )
  );

-- d) Restringir políticas del bucket documents en storage.objects
DROP POLICY IF EXISTS "documents_select_authenticated" ON storage.objects;
CREATE POLICY "documents_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_insert_managers" ON storage.objects;
CREATE POLICY "documents_insert_managers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role::text IN ('superadmin','gerente','supervisor')
    )
  );

DROP POLICY IF EXISTS "documents_update_managers" ON storage.objects;
CREATE POLICY "documents_update_managers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role::text IN ('superadmin','gerente','supervisor')
    )
  );

DROP POLICY IF EXISTS "documents_delete_managers" ON storage.objects;
CREATE POLICY "documents_delete_managers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role::text IN ('superadmin','gerente','supervisor')
    )
  );
