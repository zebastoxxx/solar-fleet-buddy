
-- Add area field to consumables
ALTER TABLE public.inventory_consumables
  ADD COLUMN IF NOT EXISTS area text;

-- Lookup table for reusable inventory tags (areas, categories, units, ...)
CREATE TABLE IF NOT EXISTS public.inventory_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lookup_type text NOT NULL CHECK (lookup_type IN ('area','category','unit')),
  value text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lookup_type, value)
);

CREATE INDEX IF NOT EXISTS idx_inventory_lookups_tenant_type
  ON public.inventory_lookups (tenant_id, lookup_type);

ALTER TABLE public.inventory_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.inventory_lookups
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
