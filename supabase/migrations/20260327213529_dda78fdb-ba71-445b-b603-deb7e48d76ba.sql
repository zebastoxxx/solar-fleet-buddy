
-- Tabla de tarifas de equipos
CREATE TABLE IF NOT EXISTS public.quote_equipment_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  category      TEXT NOT NULL,
  equipment     TEXT NOT NULL,
  price_monthly NUMERIC(14,2),
  price_weekly  NUMERIC(14,2),
  price_daily   NUMERIC(14,2),
  operator_monthly NUMERIC(14,2),
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quote_equipment_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.quote_equipment_rates
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Tabla de cotizaciones
CREATE TABLE IF NOT EXISTS public.quotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    TEXT UNIQUE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  client_id       UUID REFERENCES public.clients(id),
  project_id      UUID REFERENCES public.projects(id),
  business_line   TEXT CHECK (business_line IN ('renta_equipos', 'ejecucion_proyectos')) DEFAULT 'renta_equipos',
  status          TEXT CHECK (status IN ('borrador','enviada','aprobada','rechazada')) DEFAULT 'borrador',
  title           TEXT,
  notes           TEXT,
  validity_days   INTEGER DEFAULT 15,
  subtotal        NUMERIC(14,2) DEFAULT 0,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  freight_amount  NUMERIC(14,2) DEFAULT 0,
  iva_pct         NUMERIC(5,2) DEFAULT 19,
  iva_amount      NUMERIC(14,2) DEFAULT 0,
  total           NUMERIC(14,2) DEFAULT 0,
  pdf_url         TEXT,
  sent_at         TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.quotations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Trigger auto-número de cotización
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER; v_year TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) INTO v_count FROM public.quotations
   WHERE tenant_id = NEW.tenant_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.quote_number := 'COT-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_quote_number
  BEFORE INSERT ON public.quotations
  FOR EACH ROW WHEN (NEW.quote_number IS NULL)
  EXECUTE FUNCTION public.generate_quote_number();

CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ítems de la cotización
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  rate_id         UUID REFERENCES public.quote_equipment_rates(id),
  description     TEXT NOT NULL,
  category        TEXT,
  period_type     TEXT CHECK (period_type IN ('diario','semanal','mensual','global')),
  quantity        NUMERIC(10,2) DEFAULT 1,
  unit_price      NUMERIC(14,2) DEFAULT 0,
  include_operator BOOLEAN DEFAULT false,
  operator_price  NUMERIC(14,2) DEFAULT 0,
  subtotal        NUMERIC(14,2) DEFAULT 0,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  sort_order      INTEGER DEFAULT 0
);
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.quotation_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Insertar tarifas base
INSERT INTO public.quote_equipment_rates
  (tenant_id, category, equipment, price_monthly, price_weekly, price_daily, operator_monthly)
SELECT
  (SELECT id FROM public.tenants LIMIT 1),
  unnest(ARRAY[
    'TELEHANDLER','TELEHANDLER','TELEHANDLER','TELEHANDLER','TELEHANDLER','TELEHANDLER',
    'ZANJADORA','HINCADORA','HINCADORA','HINCADORA','HINCADORA',
    'MINICARGADOR','MINICARGADOR','MINICARGADOR','MANLIFT','MANLIFT'
  ]),
  unnest(ARRAY[
    'JCB 540-170 (2018)','JCB 540-170 (2019)','JCB 533','JCB 528S','DIECI RUNNER','GRADALL',
    'RTJ','GAYK','TURCHI','LONGYE H6','LONGYE H7',
    'M2','M3','M4','HA-16','JLG E400 AN'
  ]),
  unnest(ARRAY[
    21500000,21500000,21500000,21500000,21500000,21500000,
    11000000,54000000,54000000,54000000,54000000,
    11000000,11000000,11000000,9000000,7000000
  ]::numeric[]),
  unnest(ARRAY[
    7166667,7166667,7166667,7166667,7166667,7166667,
    3666667,18000000,18000000,18000000,18000000,
    3666667,3666667,3666667,3000000,2333333
  ]::numeric[]),
  unnest(ARRAY[
    1194444,1194444,1194444,1194444,1194444,1194444,
    611111,3000000,3000000,3000000,3000000,
    611111,611111,611111,500000,388889
  ]::numeric[]),
  unnest(ARRAY[
    5500000,5500000,5500000,5500000,5500000,5500000,
    6000000,5500000,5500000,5500000,5500000,
    5000000,5000000,5000000,5500000,5500000
  ]::numeric[]);

-- Índices
CREATE INDEX IF NOT EXISTS idx_quotations_tenant   ON public.quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status   ON public.quotations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotations_client   ON public.quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_q   ON public.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_rates_tenant        ON public.quote_equipment_rates(tenant_id);
