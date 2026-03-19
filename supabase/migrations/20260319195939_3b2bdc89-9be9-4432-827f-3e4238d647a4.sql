
-- Add updated_at trigger for purchase_orders
CREATE TRIGGER set_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create storage bucket for purchase order documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-orders', 'purchase-orders', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload/read
CREATE POLICY "auth_users_upload_po_docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'purchase-orders');

CREATE POLICY "auth_users_read_po_docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'purchase-orders');

CREATE POLICY "auth_users_delete_po_docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'purchase-orders');
