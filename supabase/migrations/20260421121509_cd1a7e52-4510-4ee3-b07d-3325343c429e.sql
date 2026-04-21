-- 1) Add UNIQUE constraint on personnel.user_id (NULLs still allowed in PG)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personnel_user_id_unique'
  ) THEN
    ALTER TABLE public.personnel ADD CONSTRAINT personnel_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 2) Diagnostic view: personnel without linked auth user (only operators/technicians matter)
CREATE OR REPLACE VIEW public.personnel_sin_vincular
WITH (security_invoker=on) AS
SELECT id, tenant_id, full_name, type, email, phone, created_at
FROM public.personnel
WHERE user_id IS NULL
  AND type IN ('tecnico', 'operario');

COMMENT ON VIEW public.personnel_sin_vincular IS 'Personal técnico/operario sin user_id vinculado — diagnóstico para administradores';