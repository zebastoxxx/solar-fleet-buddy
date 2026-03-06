

## Plan: Mejoras Completas al Módulo de Máquinas

Este plan abarca 8 áreas: vistas múltiples (cards/tabla/kanban), filtros avanzados, foto de máquina, botones funcionales en detalle, hoja de vida PDF, ficha técnica editable, documentos adjuntos, indicadores de rentabilidad y alertas de mantenimiento preventivo configurables.

---

### Parte 1 — Base de Datos (Migración)

1. **Tabla `machine_maintenance_alerts`** para alertas de mantenimiento preventivo configurables por máquina:
   - `id`, `machine_id`, `tenant_id`, `alert_name` (text), `trigger_type` (enum: 'horometer' | 'calendar'), `horometer_interval` (numeric, nullable), `calendar_interval_days` (int, nullable), `start_date` (date, nullable), `last_triggered_at` (timestamptz), `next_trigger_value` (numeric — next horometer value or date), `active` (bool default true), `created_at`
   - RLS: tenant_isolation via machine_id -> machines.tenant_id

2. **Storage bucket `machine-photos`** (public) para fotos de máquinas.

3. Campos adicionales en `machines` si faltan para ficha técnica completa:
   - `max_height`, `engine_model`, `fuel_type`, `plate_number` (ya tiene weight_kg, max_capacity, serial_number)

---

### Parte 2 — Vista de Máquinas con 3 Modos (`src/pages/Maquinas.tsx`)

Reescribir completamente. Agregar:

- **Toggle de vista**: Tarjetas (grid) | Lista (tabla) | Kanban (por estado)
- **Tarjetas más compactas**: Eliminar la zona de imagen de 130px, reducir a ~90px. Mostrar foto real si `cover_photo_url` existe.
- **Reemplazar FilterPills + SearchInput** por `AdvancedFilters` con:
  - Filtro por estado (las mismas pills pero dentro del panel)
  - Filtro por tipo de máquina
  - Filtro por proyecto actual
  - Filtro por fecha de creación (rango)
  - Ordenar por: nombre, horómetro, tipo, antigüedad (año), rentabilidad
- **SearchInput** se mantiene en el ActionBar (búsqueda rápida)
- **Vista Kanban**: 4 columnas (En campo, Bodega, Dañadas, Varadas), cards mínimas draggables (solo visual, sin drag-and-drop funcional inicialmente)
- **Vista Lista/Tabla**: Usar DataTable con columnas: Código, Nombre, Tipo, Estado, Horómetro, Proyecto, Rentabilidad

---

### Parte 3 — Foto de Máquina (Crear/Editar)

**`CreateMachineModal.tsx`**: Agregar campo de upload de foto al inicio del formulario.
- Input file que sube a bucket `machine-photos` con path `{tenant_id}/{machine_id}.jpg`
- Preview de la imagen seleccionada
- Guardar URL en `cover_photo_url`

**`EditMachineModal.tsx`** (nuevo componente): Modal similar a Create pero con datos precargados. Incluye:
- Todos los campos existentes + campos nuevos de ficha técnica
- Upload/cambio de foto
- Sección de **alertas de mantenimiento preventivo** (ver Parte 8)

---

### Parte 4 — Botones Funcionales en Detalle (`MaquinaDetalle.tsx`)

Actualmente los botones "Editar" y "Nueva OT" no tienen onClick handlers.

- **Editar**: `onClick={() => setShowEdit(true)}` → abre `EditMachineModal`
- **Nueva OT**: `onClick={() => navigate('/ordenes-trabajo?machine=' + id)}` o abrir CreateOTModal con machine preseleccionada
- **Cambiar estado**: Ya funcional (dropdown)
- **Foto clickeable**: En el header, el placeholder de foto se convierte en un upload zone (click para subir/cambiar foto)

---

### Parte 5 — Hoja de Vida PDF (`src/lib/pdf-generator.ts`)

Nueva función `generateMachineReportPDF(machine, ots, conditions)`:
- Header con logo Up & Down Solar
- Sección "Datos del Equipo": código, nombre, marca, modelo, año, serie, peso, capacidad, tipo, estado actual, horómetro actual (a la fecha)
- Sección "Condición del Equipo": tabla con item_name + condition_pct
- Sección "Historial de Órdenes de Trabajo": tabla con código, tipo, estado, fecha, horas, costo, descripción
- Footer con fecha de generación

Botón "📄 Descargar Hoja de Vida" en el header del detalle de máquina.

---

### Parte 6 — Ficha Técnica Editable

En `MaquinaDetalle.tsx` Tab "Ficha Técnica":
- Convertir campos de solo lectura a editables inline (click para editar, blur para guardar)
- Agregar campos adicionales: motor, combustible, placa, altura máxima
- Mantener la sección de condiciones como está

---

### Parte 7 — Documentos y Upload

En Tab "Documentos":
- Botón "Subir documento" que abre un mini-form: nombre, tipo (SOAT, Tecnomecánica, Póliza, Manual, Foto, Otro), fecha vencimiento (opcional), archivo
- Upload a bucket `documents` con path `machines/{machine_id}/{filename}`
- Guardar en `machine_documents`
- Mostrar documentos con link de descarga + badges de vencimiento (ya existente)

---

### Parte 8 — Indicadores de Rentabilidad

En Tab "Costos" → renombrar a "Financiero":
- Separar ingresos (entry_type='ingreso') y gastos (entry_type='gasto') del cost_entries
- Mostrar: Total Ingresos, Total Gastos, Utilidad (ingresos - gastos), Margen %
- Gráfico de barras agrupadas: ingresos vs gastos por mes
- Indicador visual de recomendación:
  - Si margen < 0%: "⚠️ Evaluar venta del equipo"
  - Si margen 0-15%: "🔧 Requiere optimización"
  - Si margen > 15%: "✅ Rentable"
- En la vista de lista de Maquinas.tsx, agregar columna de rentabilidad y poder ordenar por ella
- Usar vista `machine_financials` ya existente en DB

---

### Parte 9 — Alertas de Mantenimiento Preventivo Configurables

En el `EditMachineModal` y `CreateMachineModal`, nueva sección "Alertas de Mantenimiento":
- Lista de alertas configuradas para esa máquina
- Botón "+ Agregar alerta" con form inline:
  - Nombre (ej: "Cambio de aceite")
  - Tipo: Horómetro (cada X horas) | Calendario (cada X días/anual)
  - Intervalo: número de horas o días
  - Fecha inicio (para calendario)
- **Plantilla por defecto** al crear máquina: pre-cargar alertas comunes:
  - Cambio de aceite (cada 250h)
  - Filtro de aire (cada 500h)
  - Filtro hidráulico (cada 1000h)
  - Engrase general (cada 50h)
  - Revisión de frenos (cada 500h)
  - Inspección general anual (cada 365 días)
- Toggle para aplicar/quitar plantilla
- CRUD completo sobre `machine_maintenance_alerts`

---

### Archivos a crear:
- `src/components/machines/EditMachineModal.tsx`
- `src/components/machines/MachineAlertConfig.tsx`
- `src/components/machines/MachinePhotoUpload.tsx`
- Migración SQL para `machine_maintenance_alerts` + campos adicionales en machines + bucket

### Archivos a modificar:
- `src/pages/Maquinas.tsx` — reescribir con 3 vistas + filtros avanzados
- `src/pages/MaquinaDetalle.tsx` — botones funcionales, foto upload, ficha editable, tab financiero, documentos upload
- `src/components/machines/CreateMachineModal.tsx` — foto + alertas de mantenimiento
- `src/hooks/useMachineDetail.ts` — hooks para alertas, update machine, financials
- `src/lib/pdf-generator.ts` — función de hoja de vida

