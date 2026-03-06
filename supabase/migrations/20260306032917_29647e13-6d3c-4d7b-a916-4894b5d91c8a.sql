
-- 1. Tabla de categorías financieras personalizables
CREATE TABLE IF NOT EXISTS financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text CHECK (type IN ('ingreso','gasto')) NOT NULL,
  icon text DEFAULT '📦',
  color text DEFAULT '#6B7280',
  is_default boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Extend cost_entries
ALTER TABLE cost_entries 
  ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'gasto',
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES financial_categories(id),
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_url text,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES work_orders(id),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS imported_from text;

-- 3. View: machine financials
CREATE OR REPLACE VIEW machine_financials AS
SELECT 
  m.id as machine_id,
  m.name as machine_name,
  m.internal_code,
  m.type as machine_type,
  m.tenant_id,
  COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0) as total_income,
  COALESCE(SUM(CASE WHEN ce.entry_type = 'gasto' THEN ce.amount ELSE 0 END), 0) as total_expenses,
  COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN ce.entry_type = 'gasto' THEN ce.amount ELSE 0 END), 0) as profit,
  CASE 
    WHEN COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0) = 0 THEN 0
    ELSE ROUND(
      ((COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN ce.entry_type = 'gasto' THEN ce.amount ELSE 0 END), 0)) /
       NULLIF(COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0), 0)) * 100, 2
    )
  END as profit_margin_pct
FROM machines m
LEFT JOIN cost_entries ce ON ce.machine_id = m.id
GROUP BY m.id, m.name, m.internal_code, m.type, m.tenant_id;

-- 4. View: project financials
CREATE OR REPLACE VIEW project_financials AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  p.budget,
  p.tenant_id,
  c.name as client_name,
  COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0) as total_income,
  COALESCE(SUM(CASE WHEN ce.entry_type = 'gasto' THEN ce.amount ELSE 0 END), 0) as total_expenses,
  COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN ce.entry_type = 'gasto' THEN ce.amount ELSE 0 END), 0) as profit,
  CASE
    WHEN p.budget IS NULL OR p.budget = 0 THEN null
    ELSE ROUND(
      (COALESCE(SUM(CASE WHEN ce.entry_type = 'gasto' THEN ce.amount ELSE 0 END), 0) / NULLIF(p.budget, 0)) * 100, 2
    )
  END as budget_used_pct,
  CASE 
    WHEN COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0) = 0 THEN 0
    ELSE ROUND(
      ((COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN ce.entry_type = 'gasto' THEN ce.amount ELSE 0 END), 0)) /
       NULLIF(COALESCE(SUM(CASE WHEN ce.entry_type = 'ingreso' THEN ce.amount ELSE 0 END), 0), 0)) * 100, 2
    )
  END as profit_margin_pct
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN cost_entries ce ON ce.project_id = p.id
GROUP BY p.id, p.name, p.budget, p.tenant_id, c.name;

-- 5. RLS
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON financial_categories
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id());
