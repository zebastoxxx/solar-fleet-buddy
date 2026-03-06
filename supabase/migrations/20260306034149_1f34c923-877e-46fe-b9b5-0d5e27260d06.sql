
-- 1. Drop old CHECK constraint on cost_type and make it more flexible
ALTER TABLE cost_entries DROP CONSTRAINT IF EXISTS cost_entries_cost_type_check;
ALTER TABLE cost_entries ALTER COLUMN cost_type SET DEFAULT 'general';

-- 2. Seed financial categories for existing tenant
INSERT INTO financial_categories (tenant_id, name, type, icon, color, is_default)
SELECT 
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  unnest(ARRAY['Alquiler de maquinaria','Servicio de operación','Consultoría técnica','Bono de proyecto','Otros ingresos']),
  'ingreso',
  unnest(ARRAY['💰','⚙️','📋','🎯','➕']),
  unnest(ARRAY['#D4881E','#1D4ED8','#6D28D9','#065F46','#6B7280']),
  true
ON CONFLICT DO NOTHING;

INSERT INTO financial_categories (tenant_id, name, type, icon, color, is_default)
SELECT 
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  unnest(ARRAY['Repuestos y piezas','Filtros','Aceites y lubricantes','Combustible y gasolina','Servicio taller externo','Mano de obra técnica','Llantas','Herramientas compradas','Transporte y flete','Grúa y remolque','Insumos de limpieza','Otros gastos']),
  'gasto',
  unnest(ARRAY['🔩','🔵','🛢️','⛽','🏭','👷','🔴','🔧','🚚','🏗️','🧴','📦']),
  unnest(ARRAY['#C0392B','#1D4ED8','#6B7280','#D97706','#6D28D9','#D4881E','#C0392B','#374151','#EA580C','#6D28D9','#065F46','#6B7280']),
  true
ON CONFLICT DO NOTHING;
