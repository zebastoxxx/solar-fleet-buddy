Plan propuesto para trabajar el módulo de Cotizaciones sin romper lo existente:

1. Corregir el error de seguridad al guardar cotizaciones
   - Ajustar las políticas de `quotations`, `quotation_items` y `quote_equipment_rates` para que tengan `WITH CHECK (tenant_id = get_user_tenant_id())` en inserts/updates.
   - Mantener aislamiento por empresa/tenant, sin abrir datos entre tenants.
   - Revisar si hay otras políticas similares que estén causando el mismo patrón de error, pero aplicar el cambio inmediato a Cotizaciones.

2. Agregar tarifa diaria estándar a Máquinas
   - Añadir campo en base de datos para precio diario de alquiler de máquina, por ejemplo `machines.daily_rental_rate` numérico, nullable y default 0.
   - Mostrar/editar este valor en la ficha técnica de máquina y en el modal de edición de máquina.
   - Formato COP y etiqueta clara: “Precio diario de alquiler”.

3. Reemplazar selects simples por buscadores en Cotizaciones
   - Cliente: cambiar `Select` por `SearchableSelect`, con búsqueda en la lista desplegable.
   - Proyecto: cambiar `Select` por `SearchableSelect`, listando todos los proyectos del tenant y filtrando por cliente cuando aplique.
   - Corregir el bug donde Proyecto se está comportando como Cliente o no lista correctamente proyectos.
   - Usar el valor sentinela `__none__` para “Sin proyecto”, evitando valores vacíos problemáticos.

4. Conectar Equipos de cotización con máquinas reales
   - Dejar de depender del selector de tarifas genéricas como principal.
   - Cargar máquinas reales desde `machines` con campos mínimos: `id, internal_code, name, type, brand, model, daily_rental_rate`.
   - Reemplazar “Personalizado” como opción principal por un buscador de máquinas.
   - Al seleccionar una máquina, llenar descripción y precio diario sugerido desde la máquina.
   - El precio diario quedará editable manualmente en la cotización.

5. Ajustar modelo de ítems de cotización para renta por días
   - Añadir columnas opcionales a `quotation_items`:
     - `machine_id` para relacionar el ítem con una máquina real.
     - `days` para cantidad de días cotizados.
     - `daily_rate` como tarifa diaria editable.
     - `operator_daily_rate` para operador por día.
   - Mantener compatibilidad con columnas actuales (`quantity`, `unit_price`, `operator_price`, `period_type`, `subtotal`) para no romper PDF/listados actuales.
   - Para renta de equipos, usar fórmula:
     - Subtotal máquina = `daily_rate * days`
     - Subtotal operador = `operator_daily_rate * days` si está incluido
     - Subtotal ítem = `(daily_rate + operator_daily_rate) * days`
   - Quitar la UX de “Cantidad” para máquinas, porque cada máquina es única. Si necesitan dos máquinas, agregan dos ítems.

6. Fechas opcionales del periodo cotizado
   - Añadir en `quotations`:
     - `period_start_date`
     - `period_end_date`
   - En el formulario, agregar calendarios opcionales para fecha inicio y fecha fin.
   - Usar el componente existente `Calendar` con `pointer-events-auto` para que funcione bien dentro del diálogo.
   - Si ambas fechas están seleccionadas, calcular automáticamente días cotizados y aplicar ese número a los ítems de renta.
   - Si no hay fechas, permitir ingresar los días manualmente por ítem.
   - Validar que la fecha final no sea anterior a la inicial.

7. Actualizar PDF y detalle de cotización
   - Mostrar proyecto correcto, periodo cotizado si existe, días, tarifa diaria y operador por día.
   - Cambiar textos tipo “$/mes” a “$/día” cuando aplique.
   - Mantener flete, descuento, IVA y total como están.

8. QA funcional
   - Crear cotización nueva como supervisor/gerente con cliente, proyecto, máquina real, fechas y operador.
   - Confirmar que guarda sin error RLS.
   - Confirmar que al seleccionar máquina trae el precio diario y permite editarlo.
   - Confirmar que si se cambian fechas se recalculan días y subtotales.
   - Confirmar que si no hay fechas se puede cotizar por días manuales.

Archivos principales a modificar:
- `src/pages/Cotizaciones.tsx`
- `src/pages/MaquinaDetalle.tsx`
- `src/components/machines/EditMachineModal.tsx`
- migración de base de datos para políticas RLS y nuevos campos

Notas técnicas:
- No editaré `src/integrations/supabase/client.ts` ni `types.ts` manualmente.
- Usaré Lovable Cloud para la migración.
- Mantendré las políticas con aislamiento por `tenant_id`, no permisos públicos abiertos.