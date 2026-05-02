-- 1) Restrict work order tables to authenticated role
DROP POLICY IF EXISTS tenant_isolation ON public.work_orders;
CREATE POLICY tenant_isolation ON public.work_orders
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.work_order_tools;
CREATE POLICY tenant_isolation ON public.work_order_tools
  FOR ALL TO authenticated
  USING (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON public.work_order_timers;
CREATE POLICY tenant_isolation ON public.work_order_timers
  FOR ALL TO authenticated
  USING (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON public.work_order_technicians;
CREATE POLICY tenant_isolation ON public.work_order_technicians
  FOR ALL TO authenticated
  USING (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()))
  WITH CHECK (work_order_id IN (SELECT id FROM public.work_orders WHERE tenant_id = public.get_user_tenant_id()));

-- 2) Prevent privilege escalation on users table
DROP POLICY IF EXISTS tenant_isolation ON public.users;

CREATE POLICY users_select_same_tenant ON public.users
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY users_insert_admin_only ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() = ANY (ARRAY['superadmin','gerente'])
  );

CREATE POLICY users_delete_admin_only ON public.users
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() = ANY (ARRAY['superadmin','gerente'])
  );

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() = ANY (ARRAY['superadmin','gerente'])
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.get_user_role() = ANY (ARRAY['superadmin','gerente'])
  );

CREATE POLICY users_update_self_safe ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND active = (SELECT active FROM public.users WHERE id = auth.uid())
  );

-- 3) Make storage buckets private + tenant-scoped policies
UPDATE storage.buckets SET public = false WHERE id IN ('ot-photos','machine-photos','purchase-orders','documents');

DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view machine photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload machine photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update machine photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete machine photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_users_upload_po_docs" ON storage.objects;
DROP POLICY IF EXISTS "auth_users_read_po_docs" ON storage.objects;
DROP POLICY IF EXISTS "auth_users_delete_po_docs" ON storage.objects;
DROP POLICY IF EXISTS "documents_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_managers" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_managers" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_managers" ON storage.objects;

CREATE POLICY "ot_photos_tenant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ot-photos' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "ot_photos_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ot-photos' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "ot_photos_tenant_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ot-photos' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "ot_photos_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ot-photos' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);

CREATE POLICY "machine_photos_tenant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'machine-photos' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "machine_photos_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'machine-photos' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "machine_photos_tenant_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'machine-photos' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "machine_photos_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'machine-photos' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);

CREATE POLICY "purchase_orders_tenant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'purchase-orders' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "purchase_orders_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-orders' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "purchase_orders_tenant_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'purchase-orders' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "purchase_orders_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'purchase-orders' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);

CREATE POLICY "documents_tenant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "documents_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "documents_tenant_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
CREATE POLICY "documents_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);

-- 4) Realtime channel authorization
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realtime_authenticated_tenant ON realtime.messages;
CREATE POLICY realtime_authenticated_tenant ON realtime.messages
  FOR SELECT TO authenticated
  USING (public.get_user_tenant_id() IS NOT NULL);

DROP POLICY IF EXISTS realtime_authenticated_tenant_insert ON realtime.messages;
CREATE POLICY realtime_authenticated_tenant_insert ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_tenant_id() IS NOT NULL);
