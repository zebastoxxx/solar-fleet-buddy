
ALTER TABLE public.personnel 
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS monthly_salary numeric DEFAULT 0;
