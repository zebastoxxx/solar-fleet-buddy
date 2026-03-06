
-- Add new fields to machines table for ficha técnica completa
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS max_height text,
  ADD COLUMN IF NOT EXISTS engine_model text,
  ADD COLUMN IF NOT EXISTS fuel_type text,
  ADD COLUMN IF NOT EXISTS plate_number text;

-- Create machine_maintenance_alerts table
CREATE TABLE public.machine_maintenance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  alert_name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'horometer',
  horometer_interval numeric,
  calendar_interval_days integer,
  start_date date,
  last_triggered_at timestamptz,
  next_trigger_value numeric,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.machine_maintenance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.machine_maintenance_alerts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Create machine-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('machine-photos', 'machine-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for machine-photos bucket
CREATE POLICY "Anyone can view machine photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'machine-photos');

CREATE POLICY "Authenticated users can upload machine photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'machine-photos');

CREATE POLICY "Authenticated users can update machine photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'machine-photos');

CREATE POLICY "Authenticated users can delete machine photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'machine-photos');
