
ALTER TABLE public.inventory_consumables
  ALTER COLUMN category TYPE text USING category::text;
