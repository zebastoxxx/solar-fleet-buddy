
CREATE TABLE public.project_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  doc_type text DEFAULT 'otro',
  file_url text,
  file_name text,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES public.users(id)
);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.project_documents
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());
