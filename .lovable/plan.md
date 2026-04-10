

## Plan: Plantilla preoperacional universal con inhabilitación automática de máquinas

### Resumen
Reemplazar las plantillas por tipo de máquina con una **plantilla universal única** basada en el Excel proporcionado. Todos los ítems incluyen la opción "N/A" (ya existe en el UI). Al enviar un Formato A con ítems **críticos** marcados como "malo", el sistema automáticamente cambia la máquina a estado `en_campo_dañada` y genera alertas.

### Ítems del Excel (9 categorías, ~48 ítems)

Los ítems marcados con **★** son críticos (amarillos en el Excel). Muchos ítems ya dicen "(SI APLICA)" lo cual refuerza que el operario puede marcar N/A.

| Categoría | Ítems | Críticos ★ |
|---|---|---|
| ESTRUCTURA | 9 ítems (carrocería, escalera, vidrios, limpiabrisas, retrovisores, asiento, puertas, horquillas, mástil) | Ninguno |
| CANASTA/PLATAFORMA | 3 (canasta, puntos de anclaje, barandas) | Ninguno |
| LLANTAS | 1 (llantas en buen estado) | Ninguno |
| ORUGAS | 3 (orugas, tren de rodaje, barra defensiva) | Ninguno |
| FLUIDOS E INDICADORES | 4 | ★ Nivel aceite, ★ Nivel agua/refrigerante, ★ Indicadores, ★ Tanque combustible |
| SEGURIDAD | 9 | ★ Frenos, ★ Parada de emergencia, ★ Estado de baterías |
| LUCES Y SONIDOS | 6 (delanteras, traseras, direccionales, alarma retroceso, pito, baliza) | Ninguno |
| ESTADO MECÁNICO | 11 | ★ Equipos sin fugas, ★ Freno de servicio, ★ Cilindros en buen estado, ★ Estado del bastidor |
| MANDOS Y FUNCIONES | 5 | ★ Funciones de control hidráulico, ★ Pedales y/o mandos en buen estado |

### Opción N/A
El componente `ChecklistItem` **ya tiene el botón N/A** (línea 587: `<button ... onClick={() => onResult('na')}>N/A</button>`). El tipo `ItemResult = 'bueno' | 'malo' | 'na'` ya lo soporta. Los ítems que dicen "(SI APLICA)" simplemente se marcan N/A si no aplican a esa máquina. No se requiere cambio en la lógica de N/A.

### Validación de completitud
Actualmente, `step2Valid` requiere que **todos** los ítems tengan respuesta (bueno, malo o N/A). Esto ya funciona correctamente: el operario debe responder cada ítem pero puede elegir N/A para los que no apliquen.

---

### Cambios a implementar

#### 1. Reescribir `src/data/preop-templates.ts`
- Eliminar todas las plantillas por tipo (minicargador, retroexcavadora, telehandler, manlift, camion_grua, hincadora, otro).
- Exportar una constante `PREOP_UNIVERSAL: PreopTemplate` con las 9 secciones y los ~48 ítems exactos del Excel.
- Los 13 ítems críticos marcados con `critical: true`.
- Mantener las interfaces `PreopItem`, `PreopSection`, `PreopTemplate`.

#### 2. Modificar `src/pages/PreoperacionalOperario.tsx` — FormatoA
- **Selección de plantilla** (líneas 253-256): Cambiar de `PREOP_TEMPLATES[machineType]` a usar siempre `PREOP_UNIVERSAL`. Eliminar `templateMissing` y el componente `MissingTemplateState`.
- **handleSave** (líneas 270-330): Después de guardar exitosamente, si `has_critical_failures === true`:
  - Actualizar la máquina: `supabase.from('machines').update({ status: 'en_campo_dañada' }).eq('id', machineId)`
  - La alerta ya se crea (líneas 312-319), solo agregar los nombres de los ítems críticos fallidos al mensaje.
- **Bottom nav** (líneas 407-421): Eliminar la condición de `templateMissing` del botón.

#### 3. Verificar `src/pages/Preoperacionales.tsx`
- El modal de detalle (`PreopDetailModal`) ya agrupa ítems por sección dinámicamente desde la DB. No requiere cambios.

#### 4. Verificar Dashboard y MaquinaDetalle
- El Dashboard ya muestra alertas críticas con banner rojo. El `StatusIndicator` ya tiene `en_campo_dañada` con punto rojo palpitante. No requiere cambios.
- `MaquinaDetalle.tsx` ya permite cambiar el estado manualmente a cualquier valor (superadmins/supervisores). No requiere cambios.

### Archivos a modificar
1. `src/data/preop-templates.ts` — reescribir completamente
2. `src/pages/PreoperacionalOperario.tsx` — simplificar plantilla + auto-inhabilitar máquina

### Sin cambios de base de datos
No se requieren migraciones. Se usan las tablas y columnas existentes (`preop_records`, `preop_items`, `alerts`, `machines`).

