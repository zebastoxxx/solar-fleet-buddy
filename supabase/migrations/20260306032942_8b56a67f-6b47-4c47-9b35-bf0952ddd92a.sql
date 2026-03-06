
-- Fix security definer views by setting security_invoker = true
CREATE OR REPLACE VIEW machine_financials WITH (security_invoker = true) AS
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

CREATE OR REPLACE VIEW project_financials WITH (security_invoker = true) AS
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
