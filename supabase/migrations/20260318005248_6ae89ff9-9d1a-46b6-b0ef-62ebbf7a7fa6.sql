
-- Add missing columns to clients
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS legal_representative text,
  ADD COLUMN IF NOT EXISTS website text;

-- Create client_contacts table
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text,
  phone text,
  email text,
  is_primary boolean DEFAULT false,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.client_contacts FOR ALL USING (tenant_id = get_user_tenant_id());

-- Create client_documents table
CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  doc_type text DEFAULT 'otro',
  file_url text,
  file_name text,
  uploaded_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id)
);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.client_documents FOR ALL USING (tenant_id = get_user_tenant_id());

-- Create supplier_contacts table
CREATE TABLE public.supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text,
  phone text,
  email text,
  is_primary boolean DEFAULT false,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.supplier_contacts FOR ALL USING (tenant_id = get_user_tenant_id());

-- Create supplier_documents table
CREATE TABLE public.supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  doc_type text DEFAULT 'otro',
  file_url text,
  file_name text,
  uploaded_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id)
);

ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.supplier_documents FOR ALL USING (tenant_id = get_user_tenant_id());
