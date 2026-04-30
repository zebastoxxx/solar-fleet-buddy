
-- 1) Fix RLS WITH CHECK for quotations / quotation_items / quote_equipment_rates
DROP POLICY IF EXISTS "tenant_isolation" ON public.quotations;
CREATE POLICY "tenant_isolation" ON public.quotations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON public.quotation_items;
CREATE POLICY "tenant_isolation" ON public.quotation_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON public.quote_equipment_rates;
CREATE POLICY "tenant_isolation" ON public.quote_equipment_rates
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- 2) Daily rental rate on machines
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS daily_rental_rate NUMERIC(14,2);

-- 3) Period dates on quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS period_start_date DATE,
  ADD COLUMN IF NOT EXISTS period_end_date DATE;

-- 4) Extra fields on quotation_items for daily rental model
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS days NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS operator_daily_rate NUMERIC(14,2);

-- Loosen period_type check to allow 'por_dias' (días calculados)
DO $$
BEGIN
  ALTER TABLE public.quotation_items DROP CONSTRAINT IF EXISTS quotation_items_period_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;
ALTER TABLE public.quotation_items
  ADD CONSTRAINT quotation_items_period_type_check
  CHECK (period_type IS NULL OR period_type IN ('diario','semanal','mensual','global','por_dias'));
