
-- Create documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Anyone can read documents"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');

-- Function to update OT parts cost
CREATE OR REPLACE FUNCTION public.update_ot_parts_cost(ot_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE work_orders SET 
    parts_cost = COALESCE((SELECT SUM(quantity * COALESCE(unit_cost, 0)) FROM work_order_parts WHERE work_order_id = ot_id), 0)
  WHERE id = ot_id;
  
  UPDATE work_orders SET 
    total_cost = COALESCE(parts_cost, 0) + COALESCE(labor_cost, 0) + COALESCE(external_cost, 0)
  WHERE id = ot_id;
$$;
